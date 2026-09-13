# Exact Try Out

Platform simulasi ujian bergaya Bluebook untuk **Digital SAT**, **UTBK-SNBT**, **CSCA**
(China Scholastic Competency Assessment), dan **Cambridge A Level**.

Bank soalnya dibangun dengan AI memakai pustaka prompt di [`prompts/`](prompts/), divalidasi
otomatis, lalu ditinjau manusia sebelum dipakai.

---

## Menjalankan sekarang

```bash
npm install
npm run dev
# buka http://localhost:3000
```

Aplikasi **langsung jalan tanpa konfigurasi apa pun**. Tanpa `.env.local`, ia memakai driver
pengembangan yang menyimpan data ke `.data/db.json`; karena tidak ada project Supabase, `/masuk`
menampilkan kotak **Development sign-in** yang membuat akun lokal dari email apa pun. Begitu
variabel Supabase diisi, aplikasi berpindah ke Supabase — dan ke Google — tanpa perubahan kode.

### Mencoba alur lengkap

1. `/demo` — kerjakan 10 soal gratis tanpa daftar.
2. `/daftar` — satu tombol: masuk dengan Google (di lokal: kotak Development sign-in).
3. `/dashboard` — mulai try out, lihat tren skor dan peta domain.
4. `/journey` — riwayat setiap tes.
5. `/leaderboard` — peringkat berdasar skor terbaik dan rata-rata.
6. `/afiliasi` — aktifkan tautan rujukan, lihat komisi, ajukan pencairan.
7. `/pengaturan` — sembilan tema tampilan.
8. `/admin/masuk` — panel admin. Isi `ADMIN_EMAILS` di `.env.local` sebelum mendaftar, atau jalankan
   `npm run make-admin -- email@kamu.com` setelahnya.

---

## Apa yang sudah ada

**Ruang ujian**
- Navigasi soal di panel samping: aktif / terjawab / dikunjungi / ditandai
- **Waktu dipegang server**: tenggat tiap subtes disimpan sebagai timestamp absolut,
  browser hanya menampilkan hitung mundur dan mencocokkan ulang tiap 20 detik.
  Menghentikan jam di devtools, menutup tab, atau mengubah jam komputer tidak menambah waktu
- Timer per subtes, bisa disembunyikan, dengan layar istirahat resmi
- Kalkulator ilmiah bawaan yang bisa digeser, plus mode grafik (pengganti Desmos)
- Lembar rumus yang bisa dicari: SAT reference sheet, MF19, data booklet 9702/9701, rumus UTBK
- Stabilo untuk menyorot bacaan, dan coret opsi (eliminasi ABCD)
- Tampilan terbelah bacaan | soal untuk subtes berbasis teks
- Proctoring: layar penuh dipaksa, deteksi pindah tab, copy/paste/cut, klik kanan, shortcut,
  dugaan devtools, dan skor integritas
- Simpan otomatis tiap 15 detik; pindah soal dengan panah kiri/kanan, tandai dengan `F`

**Bentuk soal** — 12 tipe: pilihan ganda, pilih-N, isian angka (grid-in), banyak kotak angka, isian
teks, pernyataan Benar/Salah, matriks centang, menjodohkan, mengurutkan, cloze dropdown, plot titik
di bidang koordinat, dan uraian berubrik.

**Grafik & diagram** — 12 jenis figur digambar dari data JSON, bukan gambar: plot fungsi, scatter
dengan garis regresi, batang, garis, histogram, pai, box plot, garis bilangan, geometri bebas
(termasuk sudut siku dan tanda sama panjang), tabel, dan rangkaian listrik.

**Skoring** — SAT skala 200–800 per section dengan routing modul adaptif, UTBK dengan estimasi
kemampuan IRT (Rasch) ke skala 0–1000, CSCA 100 poin per mata uji, A Level dengan grade boundary
A*–E. Semua penilaian **di server** — kunci jawaban tidak pernah dikirim ke browser selama ujian.

**Basis data referensi** — spesifikasi resmi tiap ujian beserta **sumber dan tanggal verifikasinya**,
model skoring lengkap dengan batas kepercayaannya, taksonomi domain-skill, dan lembar rumus. Bisa
dilihat di `/admin/referensi`. Angka yang terverifikasi dari dokumen resmi dibedakan terang-terangan
dari yang berasal dari sumber sekunder.

> **Tidak ada soal past paper di sini, dan memang tidak boleh ada.** Soal SAT milik College Board,
> past paper A Level milik Cambridge, dan soal UTBK tidak pernah dipublikasikan. Yang dibangun adalah
> spesifikasinya — dari sanalah prompt AI menghasilkan soal orisinal yang berperilaku seperti soal
> aslinya.

**Akun** — satu tombol **Lanjut dengan Google**, lalu dashboard. Tidak ada formulir, tidak ada kode
verifikasi, tidak ada kata sandi yang dibuat. ID peserta adalah alamat Google-nya. Kata sandi hanya
dipakai `/admin/masuk` sebagai jalur cadangan bagi tim operasional.

**Pembayaran** — dua cara, dan yang tidak dikonfigurasi tidak muncul. **Transfer bank manual**:
pesanan berkode `EX-XXXXXXXX`, pembeli mengirim bukti lewat WhatsApp, admin menekan «Tandai lunas»
di `/admin/pesanan`. **Gateway**: Midtrans Snap untuk rupiah, Stripe untuk mata uang lain, keduanya
dengan webhook terverifikasi signature. Semuanya berakhir di `fulfillOrder()` yang idempoten —
kuota tidak pernah diberikan dari browser.

**Dua driver data** — Supabase untuk produksi (auth, tabel, RLS, view) dan driver berkas untuk
pengembangan. Dipilih otomatis dari environment; route handler tidak tahu bedanya.

**Program afiliasi** — setiap peserta bisa mengaktifkan tautan rujukan sendiri (`/r/KODE`), mendapat
15% komisi dari tiap paket yang terjual lewat tautannya, dan yang diajak mendapat 1 kuota try out
bonus. Komisi ditahan 14 hari (masa refund), disetujui admin, lalu dicairkan dengan minimum
Rp100.000. Klik, pendaftaran, dan konversi terhitung otomatis.

**Panel admin** — halaman masuk terpisah di `/admin/masuk`, dengan peran `admin` dan `reviewer`.
Isinya: ringkasan pendapatan & attempt, **bank soal** dengan **pembuat soal AI bawaan**, daftar
peserta (ubah peran, lihat asal rujukan), daftar pesanan, dan pengelolaan afiliasi.

**Pembuat soal AI** — form kriteria + lampiran (screenshot tempel, gambar, PDF) + pilihan mesin
**Claude / Gemini / ChatGPT**. Dua tombol: **Salin prompt** (untuk dikerjakan di aplikasi chat) dan
**Buat soal** (panggil API langsung). Prompt dirakit dari berkas Markdown di `prompts/`, jadi yang
disalin sama persis dengan yang dikirim ke API — menyunting prompt tidak perlu menyentuh kode.

**Akses internasional** — antarmuka dalam **English, Bahasa Indonesia, dan 简体中文**, dipilih otomatis
dari `Accept-Language` browser dan bisa diganti kapan saja. Harga ditetapkan per mata uang (USD, EUR,
CNY, IDR) — bukan hasil konversi kurs. Nomor telepon divalidasi terhadap negaranya dan disimpan dalam
format E.164. Tanggal, waktu, dan angka mengikuti bahasa yang dipilih. Soal CSCA yang bilingual
otomatis tampil dalam bahasa antarmuka peserta.

**Dua gateway pembayaran** — **Stripe** untuk seluruh mata uang selain rupiah (kartu, Apple Pay,
Google Pay, metode lokal), **Midtrans** untuk rupiah (VA, QRIS, GoPay, OVO, DANA). Gateway dipilih
otomatis dari negara peserta. Keduanya memverifikasi signature dan nominal di webhook, dan hanya
webhook yang boleh memberikan kuota.

**Tema** — sembilan tema dalam empat kelompok: Netral (Midnight Ink, Porcelain), Maskulin (Cobalt
Steel, Graphite Amber), Feminin (Rosewood, Lavender Mist, Plum Night), Aksesibilitas (Focus Sepia,
High Contrast).

---

## Struktur

```
src/
  app/                    halaman & API route
    (app)/                area login: dashboard, journey, leaderboard, afiliasi, pengaturan
    admin/                panel admin (login sendiri di /admin/masuk)
    r/[code]/             tautan rujukan afiliasi
    ujian/[attemptId]/    ruang ujian
    hasil/[attemptId]/    hasil & pembahasan (demo bisa dilihat tanpa akun)
    api/                  auth, checkout, attempts, webhooks, leaderboard
  components/
    exam/                 ExamPlayer, QuestionView, Calculator, FormulaSheet, useProctor
    charts/Figure.tsx     renderer 12 jenis figur (SVG murni)
    ui/                   AppShell, tema, header
  lib/
    types.ts              kontrak data inti — baca ini lebih dulu
    exams/                blueprints, formulas, grade, scoring, seed, sanitize
      reference.ts        spesifikasi resmi + sumber + tanggal verifikasi + model skoring
      bank.ts             sumber soal: Supabase / berkas impor / seed
      formBuilder.ts      composeLayout() memilih soal, sectionsFrom() membangun ulang
      validate.ts         aturan validasi, dipakai CLI dan panel admin
    auth.ts               autentikasi dua jalur (Google lewat Supabase / driver berkas)
    checkout.ts           fulfillOrder() — idempoten, satu-satunya pemberi kuota
    midtrans.ts           Snap + verifikasi signature webhook
    ratelimit.ts          pembatas laju login & pembuatan pesanan
    payment.ts            rekening transfer manual, kontak admin, kode pesanan
    affiliate.ts          aturan komisi, kode rujukan, cookie
    geo.ts                negara, mata uang, normalisasi nomor E.164
    stripe.ts             Stripe Checkout + verifikasi signature webhook
    i18n/                 kamus EN/ID/ZH + pemilihan bahasa sisi server
    ai/promptRegistry.ts  merakit prompt dari berkas /prompts + kriteria
    ai/providers.ts       Claude (SDK resmi) / Gemini / OpenAI di satu antarmuka
    adminGuard.ts         requireAdmin() / adminOrNull()
    db/                   types (kontrak), dev.ts, supabase.ts, index.ts (pemilih driver)
    supabase/             klien browser, server, middleware
sample-tests/             42 soal contoh orisinal, satu berkas per ujian
prompts/                  pustaka prompt AI per subtes
supabase/migrations/      skema, RLS, view & RPC
scripts/                  validate-questions.mjs, import-questions.mjs, make-admin.mjs
docs/                     SETUP, ARCHITECTURE, DEPLOY, RECOMMENDATIONS
```

---

## Membuat paket soal

Paket tidak disusun manual. Kamu mengisi **bank soal**, lalu setiap kali siswa memulai try out,
sistem menyusun paketnya sendiri dari blueprint ujian dan membekukannya pada attempt itu.

```
prompt AI  ->  impor  ->  tinjau  ->  approved  ->  bank soal
                                                      |
                                    siswa klik "Mulai try out"
                                                      v
                              composeLayout() memilih soal per section
                              sesuai blueprint, lalu MEMBEKUKANNYA
```

Sudah ada **42 soal contoh** yang lolos validasi dan siap dikerjakan — lihat
[`sample-tests/`](sample-tests/): 10 SAT, 12 UTBK, 12 CSCA (bilingual), 8 A Level.

**Langkahnya:**

1. Hasilkan soal. Buka **`/admin/soal` → Buat soal dengan AI**, lalu:
   - isi kriteria (subtes, jumlah, domain, komposisi kesulitan, tema, instruksi tambahan)
   - opsional: tempel screenshot dengan `Cmd/Ctrl+V`, seret berkas, atau unggah PDF sebagai materi acuan
   - pilih mesin: **Claude**, **Gemini**, atau **ChatGPT**
   - tekan **Buat soal** untuk memanggil API langsung, atau **Salin prompt** untuk mengerjakannya
     sendiri di aplikasi chat (berguna kalau kunci API belum diisi)

   Hasilnya divalidasi otomatis, ditampilkan temuannya, lalu bisa diimpor dengan satu tombol.
2. Atau impor JSON yang sudah kamu punya lewat **`/admin/soal` → Impor soal dari JSON**, atau lewat terminal:
   ```bash
   npm run validate hasil.json -- --strict
   npm run import   hasil.json -- --status in_review
   ```
3. Tinjau dengan [`prompts/_shared/review.md`](prompts/_shared/review.md) dan guru mata pelajaran.
4. Di `/admin/soal`, pilih soal yang lolos lalu **Setujui**. Hanya status `approved` yang dipakai.

Kartu ringkasan di `/admin/soal` menunjukkan berapa soal `approved` yang sudah ada dibanding
kebutuhan satu paket penuh per ujian.

**Kenapa paket dibekukan.** Susunan soal disimpan di `attempts.form_layout` saat attempt dibuat.
Tanpa itu, mengimpor soal baru atau memensiunkan soal lama di tengah jalan akan mengubah paket yang
sedang dikerjakan seseorang — dan nilainya salah tanpa ada yang menyadari. Soal yang sudah
dipensiunkan tetap bisa dibaca untuk attempt lama, tetapi tidak dipakai lagi di paket baru.

Rincian prompt di [`prompts/README.md`](prompts/README.md).

---

## Menyambungkan Supabase

```bash
cp .env.example .env.local     # isi URL + anon key + service role key
```

Jalankan kedelapan migrasi di `supabase/migrations/` lewat SQL Editor Supabase secara berurutan.
Rinciannya di [`docs/SETUP.md`](docs/SETUP.md).

Region proyek Supabase **tidak bisa diubah setelah dibuat** dan menentukan latensi yang dirasakan
peserta saat jam ujian berjalan. Pertimbangannya — beserta rekomendasi untuk peluncuran — ada di
[`docs/DEPLOY.md`](docs/DEPLOY.md#1-memilih-region-supabase).

### Data pribadi

Hak akses dan penghapusan sudah berjalan sebagai kode, bukan janji di halaman kebijakan:
`GET /api/privacy/export` mengeluarkan seluruh data seseorang sebagai JSON, dan
`POST /api/privacy/delete` menghapusnya seketika — kecuali catatan keuangan, yang dipertahankan
dalam keadaan **dianonimkan** karena kewajiban pembukuan menuntutnya. Persetujuan direkam beserta
versi dokumennya di `profiles.consent`, dan banner cookie hanya meminta izin untuk satu-satunya
cookie yang memang memerlukannya: rujukan afiliasi.

Naskah di `src/lib/legal.ts` masih **draf** dan mencantumkan sendiri bahwa ia perlu ditinjau
pengacara sebelum dipakai sungguhan. Rinciannya di
[`docs/DEPLOY.md`](docs/DEPLOY.md#2-kepatuhan-data-pribadi-gdpr--uu-pdp).

### Menguji jalur pembayaran

```bash
npm run test:webhooks
```

Menguji fungsi verifikasi tanda tangan yang sesungguhnya dipakai webhook produksi — diimpor, bukan
disalin — tanpa memerlukan kunci Stripe atau Midtrans. 31 pemeriksaan: payload yang diubah, tanda
tangan dari kunci lain, notifikasi lama (replay), dan kunci yang belum diset semuanya harus
**ditolak**. Untuk uji dengan akun sandbox sungguhan, lihat
[`docs/DEPLOY.md`](docs/DEPLOY.md#3-menguji-jalur-pembayaran).

---

## Yang belum ada

Lihat [`docs/RECOMMENDATIONS.md`](docs/RECOMMENDATIONS.md) untuk daftar lengkap beserta alasan
prioritasnya.

**Bank soal** kini berisi **647 soal orisinal** — cukup menyusun satu form penuh untuk keempat
ujian tanpa soal terulang, dan sudah diverifikasi dengan menyusun form nyata lewat `/api/attempts`.
Yang belum: variasi untuk peserta paket banyak percobaan, varian kedua modul adaptif SAT, kalibrasi
`irtB` lewat uji lapangan, dan **tinjauan guru atas kunci jawaban** — validator memeriksa struktur,
bukan kebenaran. Kebijakan penulisan dan batasan hak cipta ada di
[`question-bank/README.md`](question-bank/README.md); target jual ada di
[`docs/SETUP.md`](docs/SETUP.md#5-isi-bank-soal).

Jalur Supabase, Midtrans, dan Stripe sudah ditulis lengkap dan lolos typecheck, tetapi **belum diuji
terhadap project Supabase dan akun gateway sungguhan** — yang sudah diuji jalan end-to-end adalah
driver pengembangan, ditambah verifikasi tanda tangan lewat `npm run test:webhooks`. Verifikasi
tanda tangan yang lulus tidak membuktikan gateway benar-benar memanggil kita; uji sandbox keduanya
sebelum menerima pembayaran pertama.

Untuk peserta Uni Eropa, sisi kodenya sudah siap tetapi masih perlu dilengkapi oleh manusia:
perwakilan di UE, Data Processing Agreement dengan Supabase dan penyedia pembayaran, serta
peninjauan naskah kebijakan oleh pengacara. Daftar periksanya di
[`docs/DEPLOY.md`](docs/DEPLOY.md#4-daftar-periksa-sebelum-produksi).
