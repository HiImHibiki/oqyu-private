# Arsitektur

## Satu kontrak, tiga konsumen

`src/lib/types.ts` mendefinisikan tipe `Question`. Tipe itu adalah satu-satunya kontrak antara:

1. **Prompt AI** (`prompts/`) — menghasilkan JSON dengan bentuk itu
2. **Validator** (`scripts/validate-questions.mjs`) — menolak yang tidak sesuai
3. **Renderer** (`src/components/exam/QuestionView.tsx`) — menggambar apa pun yang lolos

Menambah satu tipe soal baru berarti menyentuh empat tempat, dan hanya empat:

```
src/lib/types.ts                          tambahkan ke union QuestionType + Answer
src/components/exam/QuestionView.tsx      tambahkan case di Body()
src/lib/exams/grade.ts                    tambahkan case di gradeAnswer()
prompts/_schema/question.schema.json      tambahkan ke enum + oneOf
```

Kalau salah satu terlewat, validator akan menangkapnya sebelum soal masuk bank.

## Aliran data satu attempt

```
POST /api/attempts             -> buat attempt, ambil satu kuota. TANPA tenggat:
                                  jam belum berjalan
GET  /ujian/[attemptId]        -> server: buildForm() -> stripSections() -> ExamRunner
                                  (kunci jawaban DIBUANG di server)
POST /api/attempts/[id]/section-> siswa menekan "Mulai": server menetapkan tenggat
                                  absolut untuk section itu, sekali dan selamanya
selama ujian                   -> autosave 15 s ke /save, sinkron waktu 20 s ke /state,
                                  event proctoring lewat /proctor
POST /api/attempts/[id]/submit -> server memilih jawaban yang sah, menilai,
                                  menyimpan score + integrity, status = submitted
GET  /hasil/[attemptId]        -> server membaca ulang bank soal, kali ini DENGAN kunci
```

## Waktu ujian dipegang server

Timer di browser tidak bisa dipercaya: satu baris di devtools menghentikannya. Karena itu jam
ujian hidup di database.

| lapis | penjagaan |
|---|---|
| penetapan | `startSection()` menulis tenggat **hanya kalau belum ada** — memanggil ulang endpoint tidak menambah waktu |
| database | trigger `guard_section_deadlines` menolak perubahan tenggat yang sudah ditulis, bahkan dari service-role |
| penyimpanan | `/save` menolak jawaban lewat tenggat dengan HTTP 409 `{expired:true}` |
| pengiriman | `/submit` memakai jawaban tersimpan untuk section yang tenggatnya lewat, dan menolak jawaban untuk section yang tenggatnya **tidak pernah ada** (tanda section itu tak pernah dimulai lewat server) |
| tampilan | browser menghitung mundur untuk kenyamanan, lalu mencocokkan ulang ke `/state` tiap 20 detik, saat tab kembali aktif, dan saat koneksi pulih |

Toleransi `GRACE_SEC = 10` detik menutupi latensi jaringan tanpa memberi ruang curang.

Konsekuensi desain yang perlu diingat: **satu soal tidak boleh muncul di dua section** dalam satu
paket, karena pemetaan soal → section itulah yang dipakai menegakkan tenggat. `buildForm()` menjaga
invarian ini dengan `Set` soal terpakai.

### Mengapa kunci jawaban tidak boleh ikut ke browser

Next.js mengirim props Server Component ke client sebagai payload RSC yang bisa dibaca siapa saja di
tab Network. Kalau objek `Question` dikirim utuh, seluruh kunci jawaban ikut terkirim sebelum siswa
menjawab soal pertama.

`src/lib/exams/sanitize.ts` membuang `answer.value`, `explanation`, `hints`, dan
`distractorRationale`, menyisakan hanya `answer.mode` (dibutuhkan renderer untuk memilih bentuk
input). Penilaian sepenuhnya di server.

Ini diverifikasi ulang setiap kali ada perubahan:

```bash
curl -s localhost:3000/ujian/<id> | grep -c '"explanation"'   # harus 0
```

## Skoring

`src/lib/exams/scoring.ts` memisahkan tiga hal yang sering dicampur:

- **raw** — jumlah poin yang diperoleh
- **percent** — raw ÷ maksimum
- **scaled** — skor yang dilihat siswa, dihitung berbeda per ujian

| ujian | metode | catatan |
|---|---|---|
| SAT | kurva pangkat `200 + 600·p^0.86`, dibatasi bila modul 2 mudah | meniru perilaku plafon skor Bluebook |
| UTBK | estimasi θ Rasch (Newton-Raphson), lalu `500 + 110·θ` | butuh `irtB` per soal |
| CSCA | `150·p^0.92` per subtes | total 0–750 |
| A Level | persen → grade boundary A*–U | boundary di `ALEVEL_BOUNDARIES` |

`estimateTheta()` memakai model 1-parameter (Rasch) dengan `b` diambil dari `irtB` atau, kalau
kosong, dari `difficulty` (E = −1, M = 0, H = +1). Begitu ada data jawaban nyata, `irtB` harus
dikalibrasi ulang — lihat RECOMMENDATIONS §2.

## Modul adaptif SAT

Blueprint menandai section dengan `adaptive: { module: 2, routesFrom: "sat_rw_m1", threshold: 0.6 }`.
Tabel `form_items` punya kolom `variant` bernilai `base` / `hard` / `easy`. Alurnya:

1. Siswa menyelesaikan modul 1 (`variant: "base"`).
2. Server menghitung rasio benar, `routeAdaptive()` mengembalikan `hard` atau `easy`.
3. Hasilnya disimpan di `attempts.route`, lalu modul 2 diambil dengan varian itu.
4. `satScaled()` membatasi plafon skor bila siswa dirutekan ke modul mudah.

Bank soal karena itu harus punya **dua varian modul 2 untuk setiap form** — inilah alasan angka
target soal SAT di SETUP.md terlihat besar.

## Renderer figur

`src/components/charts/Figure.tsx` menggambar SVG langsung dari data JSON. Tidak ada pustaka chart,
dan itu disengaja:

- Ukuran bundel kecil (penting karena halaman ujian harus cepat di jaringan lambat)
- Warna memakai token tema (`var(--fg)`, `var(--border)`), jadi otomatis benar di sembilan tema
- Deterministik — figur yang sama selalu tergambar sama, penting untuk soal ujian
- AI bisa menghasilkannya sebagai data, bukan gambar

Plot fungsi memakai `src/lib/mathexpr.ts`, evaluator ekspresi buatan sendiri (Pratt parser) yang
**tidak memakai `eval()`**. Evaluator yang sama menjalankan kalkulator ilmiah bawaan.

## Proctoring

`useProctor` memasang pendengar untuk `visibilitychange`, `blur`, `fullscreenchange`, `copy`, `cut`,
`paste`, `contextmenu`, `beforeprint`, `offline`, `keydown`, dan `resize`. Tiap jenis pelanggaran
punya bobot, dan skor integritas = `100 − total bobot`.

Ini **lockdown lunak**: pengawasan berbasis browser bisa dilewati oleh orang yang menentukan hati
(mesin virtual, kamera ponsel ke layar, monitor kedua). Yang realistis dicapai adalah:

- mencegah kecurangan spontan
- memberi sinyal yang cukup untuk meninjau ulang skor yang mencurigakan
- membuat siswa jujur merasa ujiannya serius

Skor integritas di bawah 60 sebaiknya mengeluarkan attempt dari papan peringkat, bukan langsung
membatalkannya — keputusan itu milik manusia.

## Dua driver, satu kontrak

`src/lib/db/types.ts` mendefinisikan antarmuka `Db`. Ada dua implementasi:

| driver | kapan aktif | catatan |
|---|---|---|
| `db/dev.ts` | `NEXT_PUBLIC_SUPABASE_URL` atau `SUPABASE_SERVICE_ROLE_KEY` kosong | menulis ke `.data/db.json`; tidak jalan di Vercel |
| `db/supabase.ts` | keduanya terisi | service-role, hanya di server |

`getDb()` di `db/index.ts` memilihnya. **Route handler tidak boleh mengimpor salah satu driver
langsung** — kalau ada yang melakukannya, aplikasi akan diam-diam memakai driver yang salah di
produksi.

Autentikasi bercabang dengan pola yang sama di `src/lib/auth.ts`:

- Supabase: `signInWithOAuth({provider:"google"})` → Google → `/auth/callback` →
  `exchangeCodeForSession` → profil dilengkapi
- Dev: `/api/auth/dev-login` membuat pengguna di `.data/db.json`, sesi cookie `httpOnly`

**Peserta hanya punya satu cara masuk: Google.** Tidak ada kata sandi yang dibuat, tidak ada kode
verifikasi yang dikirim, tidak ada formulir pendaftaran. Nama dan email datang dari Google; negara
ditebak dari bahasa antarmuka dan bisa diperbaiki di `/pengaturan`. Alasannya bukan kemalasan:
alur lama menaruh empat langkah — data diri, pembayaran, OTP, membuat kata sandi — di antara «mau
coba» dan layar pertama, dan setiap langkah adalah tempat orang berhenti.

Kata sandi tetap ada, tetapi **hanya untuk `/admin/masuk`**. Itu disengaja: kalau OAuth Google
bermasalah, tim operasional tetap harus bisa masuk untuk mengonfirmasi pembayaran orang lain.
`/pengaturan` karenanya hanya menampilkan kolom kata sandi kepada admin — menawarkannya kepada
peserta berarti menawarkan sesuatu yang tidak bisa ia pakai untuk masuk.

## Pembayaran

```
transfer bank (paling sederhana)
/api/orders {method:"manual"} -> pesanan provider="manual", status pending
   pembeli transfer + kirim bukti ke admin lewat WhatsApp
/api/admin/orders/confirm     -> admin mencocokkan mutasi -> fulfillOrder()

gateway
/api/checkout/create   -> Snap token (Midtrans) atau Checkout Session (Stripe)
   browser membuka jendela gateway
/api/webhooks/midtrans -> verifikasi signature -> cek nominal -> fulfillOrder()
/api/checkout/status   -> halaman paket menunggu (polling 3 detik)
```

Jalur manual tidak melewati webhook mana pun, jadi penjaganya adalah manusia: hanya peran `admin`
— bukan `reviewer` — yang boleh menekan «Tandai lunas», dan tombolnya menyebut nominal serta kode
pesanan supaya yang dicocokkan admin adalah mutasi rekening, bukan ingatannya.

`fulfillOrder()` di `src/lib/checkout.ts` adalah satu-satunya tempat kuota diberikan, dan ia
idempoten: `markOrderPaid()` memakai update bersyarat `status = 'pending'`, sehingga notifikasi
ganda dari Midtrans tidak menggandakan kuota.

`/api/checkout/pay` (simulasi) mengembalikan 403 begitu `MIDTRANS_SERVER_KEY` terisi atau
`NODE_ENV=production` — kalau tidak, ia menjadi cara gratis mendapatkan kuota.

## Keamanan yang sudah dipasang

- RLS aktif di semua tabel; `questions` tidak punya policy SELECT untuk siswa sama sekali
- Kunci jawaban dibuang sebelum meninggalkan server
- Penilaian di server, tidak bisa dipalsukan dari browser
- Cookie sesi `httpOnly`, `sameSite: lax`
- Entitlement hanya boleh ditulis service-role (di produksi: webhook pembayaran)
- Validasi input registrasi dengan Zod, termasuk pola nomor HP Indonesia
- Markdown soal di-escape sebelum dirender; tidak ada HTML mentah dari AI yang lolos
- Waktu ujian di server, dikunci trigger database
- Pembatas laju pada login admin (8 / 15 menit per email dan per IP) dan pembuatan pesanan
- Webhook pembayaran memverifikasi signature **dan** nominal
- Trigger `guard_attempt_columns` mengunci kolom skor/status/tenggat dari update siswa

## Keputusan yang sengaja diambil

| Keputusan | Alasan |
|---|---|
| SVG buatan sendiri, bukan Recharts/D3 | bundel kecil, sadar tema, deterministik, ramah AI |
| Evaluator ekspresi buatan sendiri | `eval()` tidak boleh menyentuh input dari AI |
| Markdown subset, bukan `react-markdown` | HTML dari AI harus terkendali penuh |
| Skoring di server | satu-satunya cara membuat skor tidak bisa dipalsukan |
| Blueprint sebagai kode, bukan data | prompt AI, timer, dan validator membaca sumber yang sama |
| Tema lewat CSS variable, bukan class Tailwind | sembilan tema tanpa menggandakan CSS |

## Modul adaptif SAT

Pada SAT digital, modul 2 tidak sama untuk semua orang: hasil modul 1
menentukan apakah peserta menerima modul yang lebih mudah atau lebih sulit,
dan modul mudah membatasi plafon skornya.

Alurnya di sini:

1. **Saat attempt dibuat**, `composeLayout()` menyusun **dua** varian modul 2
   untuk RW dan Math — satu condong ke soal E/M, satu ke M/H. Keduanya
   dibekukan bersama attempt. Menyusunnya belakangan berarti mengambil dari
   bank yang mungkin sudah berubah, dan itu merusak pembekuan susunan paket.
2. **Saat peserta meminta modul 2**, `decideRouting()` menilai jawaban modul 1
   yang sudah tersimpan, memanggil `routeAdaptive()`, lalu menuliskan hasilnya
   ke `attempts.routing`. Penulisan ini **sekali saja** — kalau bisa diulang,
   peserta yang memanggil endpoint dua kali akan dapat mencoba kedua varian.
3. **Saat menyajikan**, `resolveLayout()` hanya mengembalikan varian yang
   terpilih. Varian yang tidak terpilih tidak pernah dikirim ke browser.
4. **Saat menilai**, `scoreAttempt()` menerima `attempt.routing` dan memetakan
   modul mudah ke rentang 200–600, bukan 200–800.

Bila bank soal belum cukup untuk dua varian penuh dari pool section itu
sendiri, `composeLayout()` **tidak** memalsukan adaptivitas: ia jatuh ke satu
modul tunggal. Varian «mudah» yang diisi soal pinjaman dari section lain
bukanlah varian yang lebih mudah, hanya kumpulan soal lain.

## Isi soal dikirim per bagian, bukan sekaligus

Halaman ujian hanya mengirim soal untuk bagian yang sudah dicapai peserta.
Soal bagian berikutnya baru tiba dari `/api/attempts/[id]/section` ketika
server memulai bagian itu.

Sebelumnya seluruh paket dikirim sekaligus saat halaman dimuat — 160 soal UTBK,
304 soal CSCA — sehingga peserta yang membuka devtools pada bagian pertama
sudah dapat membaca semua soal berikutnya. Itu meniadakan arti pembagian waktu
per bagian: seseorang bisa memakai 30 menit bagian pertama untuk mengerjakan
bagian ketiga. Kunci jawaban memang sudah dibuang sejak awal, tetapi isi
soalnya tidak.

## Pengacakan pemilihan soal

`composeLayout()` mengacak bank dengan benih dari attempt, lalu mengambil
sejumlah soal pertama tiap section. Kualitas pengacaknya menentukan apakah
seluruh bank benar-benar terpakai.

Versi pertama memakai LCG modulo $2^{31}$ dan mengambil indeks dari `h % (i+1)`
— yaitu bit rendahnya. Bit rendah LCG semacam itu berperiode sangat pendek,
sehingga permutasinya jauh dari seragam. Diukur pada pool 80 soal yang diambil
40:

| | terendah | tertinggi | simpangan baku |
|---|---|---|---|
| LCG bit rendah | 19,3% | 57,1% | 7,47 poin |
| mulberry32 | 48,0% | 51,9% | 0,84 poin |
| acak sempurna | — | — | ~0,79 poin |

Artinya sebagian soal nyaris tidak pernah muncul sementara sebagian lain
terpapar tiga kali lebih sering. Untuk bank yang mahal ditulis dan ditinjau,
itu pemborosan; untuk keamanan ujian, paparan berlebih pada sebagian soal
justru yang paling ingin dihindari.

## Paket berikutnya tidak mengulang soal yang sudah dilihat

`composeLayout()` menerima daftar soal yang **sudah pernah dilihat peserta ini**
dan mendahulukan yang belum. `/api/attempts` mengumpulkannya dari seluruh
attempt sebelumnya milik peserta itu, demo dikecualikan.

Tanpa ini, dua percobaan sama-sama mengambil acak dari pool yang sama. Dengan
bank dua kali ukuran satu form — keadaan keempat ujian sekarang — percobaan
kedua mengulang sekitar separuh soalnya. Bukan karena banknya kurang, melainkan
karena pemilihannya tidak pernah tahu apa yang sudah pernah keluar. Terukur
lewat API sungguhan, satu peserta UTBK mengerjakan tiga paket berturut-turut:

| paket | soal | baru | terulang |
|---|---|---|---|
| 1 | 160 | 160 | 0 |
| 2 | 160 | 160 | **0** |
| 3 | 160 | 18 | 142 |

Sebelumnya paket kedua memperoleh 47% soal baru; sekarang 100%. Paket ketiga
memperlihatkan batas yang sebenarnya: bank UTBK berisi 338 soal, dan dua paket
sudah memakan 320 di antaranya. Batas itu tidak diciptakan oleh perubahan ini —
ia hanya berhenti disamarkan oleh pengacakan.

Tiga hal yang dijaga dan diuji di `npm run test:exams`:

- **Mendahulukan, bukan menyaring.** Begitu soal yang belum terlihat habis,
  paket tetap tersusun penuh dari sisa yang ada. Paket setengah jadi lebih
  buruk daripada paket yang mengulang.
- **Varian adaptif yang tidak dikerjakan tidak dianggap sudah dilihat.** Susunan
  paket SAT membekukan kedua varian modul 2, tetapi peserta hanya mengerjakan
  satu. Menandai keduanya akan menghanguskan sepertiga bank SAT setelah satu
  percobaan.
- **Keacakan antar peserta tetap.** Urutan tetap diacak dari benih attempt di
  dalam tiap kelompok; yang berubah hanya prioritas kelompoknya. Dua peserta
  berbeda tetap memperoleh paket yang berbeda.

`npm run coverage` melaporkan angka ini per ujian, termasuk **berapa paket yang
sepenuhnya baru** yang sanggup diberikan bank — angka yang menentukan berapa
percobaan yang jujur untuk dijual.

## Ruang ujian dan pembaca layar

Aplikasi ini menjual akomodasi waktu 1,5× dan 2× — fitur yang ada justru untuk peserta
disabilitas. Ruang ujiannya sendiri sempat tidak memenuhi janji itu.

Pilihan jawaban dirender sebagai `<button>`, bukan `<input type="radio">`, karena tata letaknya
menuntut hal yang tidak bisa dicapai kontrol bawaan. Itu keputusan yang sah, tetapi
konsekuensinya harus ditanggung: sebelum diperbaiki, **status terpilih hanya disampaikan lewat
warna dan bayangan**. Pembaca layar mengumumkan setiap opsi sebagai tombol biasa, sehingga peserta
tunanetra dapat memilih jawaban tetapi tidak dapat mengetahui jawaban mana yang sudah ia pilih —
di ujian berbatas waktu, tempat memeriksa ulang jawaban adalah bagian dari mengerjakannya.

Yang dipasang:

| Elemen | Sebelum | Sesudah |
|---|---|---|
| Daftar pilihan tunggal | `<ul>` biasa | `role="radiogroup"` bernama |
| Opsi pilihan tunggal | `<button>` | `role="radio"` + `aria-checked` |
| Opsi pilihan ganda | `<button>` | `role="checkbox"` + `aria-checked` |
| Jam hitung mundur | angka telanjang | `role="timer"` + `aria-label` |

Jam **sengaja tidak** memakai `aria-live`. Angkanya berubah setiap detik, dan mengumumkannya tiap
detik akan menenggelamkan segala hal lain yang ingin didengar peserta — lebih buruk daripada
diam. Sebagai gantinya ada wilayah `aria-live="polite"` tersembunyi yang hanya berbunyi pada dua
ambang, 5 menit dan 1 menit. Ambang itu sama persis dengan denyut merah yang dilihat peserta awas,
sehingga keduanya memperoleh isyarat yang setara.

Pesan galat kalkulator melewati jalur yang sama alasannya: `src/lib/mathexpr.ts` melempar **kode**,
bukan kalimat, dan komponen yang menampilkan menerjemahkannya. Lihat catatan di berkas itu.
