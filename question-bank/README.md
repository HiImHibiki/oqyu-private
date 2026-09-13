# Bank soal produksi

2.003 soal orisinal, ditulis untuk berkas ini. Digabung dengan 42 soal contoh di
[`sample-tests/`](../sample-tests/), bank berisi **2.045 soal**.

Ukuran yang benar bukan «berapa soal», melainkan **apakah bank sanggup menepati
paket yang dijual**. Paket menjanjikan sejumlah try out; bank harus sanggup
memberi sebanyak itu paket yang seluruh soalnya baru.

| Paket | Dijual | Bank memberi | Selisih |
|---|---|---|---|
| SAT Starter | 2 | 3 | **terpenuhi** |
| UTBK Starter | 3 | 3 | **terpenuhi** |
| A Level per Subject | 4 | **4** | **terpenuhi** |
| CSCA Standard | 4 | 3 | +304 soal |
| SAT Intensive | 6 | 3 | +441 soal |
| UTBK Pro | 10 | 3 | +1.120 soal |

Isi bank per ujian:

| Ujian | Soal | Satu paket | Paket sepenuhnya baru | Terulang antar percobaan |
|---|---|---|---|---|
| SAT | 425 | 147 | 3 | 33% |
| UTBK-SNBT | 462 | 160 | 3 | 33% |
| CSCA | 875 | 304 | 3 | 33% |
| A Level | 241 | 63 | **4** | **26%** |

Setiap section pada keempat ujian kini berada di **3,0×** isi satu paket. Itu
bukan kebetulan: tiap batch ditulis tepat sebanyak kekurangan yang diukur
`npm run coverage`, section demi section.

CSCA adalah yang terberat: 304 soal per paket, dan 160 di antaranya berbahasa
Mandarin akademik yang harus ditulis dwibahasa penuh.

| Bagian CSCA | Isi | Per paket | Rasio |
|---|---|---|---|
| `csca_math` | 144 | 48 | **3,0×** |
| `csca_physics` | 144 | 48 | **3,0×** |
| `csca_chemistry` | 144 | 48 | **3,0×** |
| `csca_chinese_stem` | 240 | 80 | **3,0×** |
| `csca_chinese_hum` | 240 | 80 | **3,0×** |

Soal terulang antar dua percobaan acak untuk CSCA turun dari 49% ke **33%**.

«Paket sepenuhnya baru» adalah berapa paket berturut-turut yang seluruh soalnya
belum pernah dilihat peserta itu — lihat bagian berikutnya. Angka di tabel ini
adalah proyeksi setelah batch 3 dan 4 (220 soal, status `in_review`) disetujui
di `/admin/soal`.

Perhatikan kolom «satu paket» untuk SAT: modul adaptif memakan DUA kali
jatahnya, karena varian mudah dan varian sulit sama-sama disusun dan dibekukan
bersama attempt. Satu percobaan SAT memakai 147 soal, bukan 98.

Sejak `composeLayout()` mendahulukan soal yang belum pernah dilihat peserta
(lihat [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)), ukuran yang benar
bukan lagi «berapa persen dua paket acak bertumpang tindih», melainkan **berapa
paket berturut-turut yang seluruh soalnya baru** bagi satu peserta.

Bandingkan dengan yang dijual: SAT Intensive 6 percobaan, UTBK Pro 10, CSCA
Standard 4, A Level 4. **Bank belum menepati satu pun dari angka itu.** Batas
tersebut tidak diciptakan oleh perubahan mana pun — sebelumnya ia tersamar oleh
pengacakan, yang membuat tiap percobaan tampak «42% baru» alih-alih
memperlihatkan bahwa banknya memang habis. Pilihannya dua: menumbuhkan bank,
atau mengecilkan jumlah percobaan yang dijual.

Angka-angka ini diukur, bukan diperkirakan — jalankan sendiri:

```bash
npm run coverage
```

Alat itu menyusun paket dua kali dengan seed berbeda, 40 kali berturut-turut,
lalu membandingkan himpunan id seluruh paket. Ia juga melaporkan isi tiap
section, rasionya terhadap satu form, dan sebaran E/M/H — tiga angka yang
menentukan apakah janji «6 try out» benar-benar berisi enam paket berbeda.
Setel `EXACT_DATA_DIR` untuk mengukur bank lain, misalnya salinan yang soal
barunya sudah dianggap disetujui.

Perhatikan kolom «satu form» untuk SAT: modul adaptif memakan DUA kali jatahnya,
karena varian mudah dan varian sulit sama-sama disusun dan dibekukan bersama
attempt. Satu percobaan SAT memakai 147 soal, bukan 98.

Satu catatan tentang cara mengukurnya. Percobaan pertama saya membandingkan
`a[i]` dengan `b[i]` per bagian dan memperoleh angka 73–98% yang tampak masuk
akal — padahal urutan bagian bisa berbeda antar susunan, sehingga yang
dibandingkan adalah bagian yang tidak sama. Angka itu salah dan sempat menutupi
kenyataan bahwa CSCA masih 100% terulang. Perbandingan sekarang dilakukan pada
himpunan id seluruh paket, tanpa bergantung pada urutan.

## Batch kelima: A Level menepati paketnya

Berkas `alevel-05.json` (60 soal) ditulis terhadap satu sasaran: membuat paket
**A Level per Subject yang menjual 4 try out** benar-benar sanggup memberi
empat paket yang seluruh soalnya baru. Itu tercapai — keempat section kini
tepat **4,0×**, dan A Level menjadi paket multi-percobaan pertama di luar paket
pemula yang janjinya ditepati sepenuhnya oleh bank.

| Section | Kurang | Ditulis | Sesudah |
|---|---|---|---|
| `al_chem_p1` | 39 | 39 | 4,0× |
| `al_math_p1` | 10 | 10 | 4,0× |
| `al_phys_p2` | 7 | 7 | 4,0× |
| `al_econ_p2` | 4 | 4 | 4,0× |

Topiknya sengaja tidak mengulang batch sebelumnya, dan condong ke penekanan
yang menonjol pada paper Cambridge terkini: **ekonomi atom** dan hasil persen
(9701), konteks praktikum seperti kalorimetri netralisasi dan uji halida
dengan amonia encer/pekat, keterbatasan energi ikatan rata-rata, serta soal
spektrum massa yang jawabannya justru «ambigu» — dua fragmen bermassa 29 yang
tidak dapat dipisahkan tanpa bukti lain. Pada 9708, soal esainya menilai
apakah kenaikan PDB per kapita layak dibaca sebagai naiknya taraf hidup,
dengan data koefisien Gini dan jam kerja yang menariknya ke arah berlawanan.

## Batch keempat: satu paket penuh untuk SAT dan A Level

Berkas berakhiran `-04` (87 soal) ditulis terhadap satu sasaran yang dihitung
lebih dulu, bukan terhadap perasaan bahwa «bank perlu ditambah»: berapa soal
tepatnya yang kurang agar setiap section mencapai **3× isi satu paket**, yang
berarti paket ketiga yang seluruh soalnya baru.

| Section | Kurang | Ditulis | Sesudah |
|---|---|---|---|
| `al_chem_p1` | 19 | 20 | 3,0× |
| `al_math_p1` | 2 | 3 | 3,1× |
| `al_phys_p2` | 1 | 2 | 3,1× |
| `sat_rw_m1` | 12 | 12 | 3,0× |
| `sat_rw_m2` | 24 | 24 | 3,0× |
| `sat_math_m1` | 6 | 6 | 3,0× |
| `sat_math_m2` | 20 | 20 | 3,0× |

Sasaran tingkat kesulitannya juga dihitung, bukan disebar rata. Kuota varian
adaptif menuntut 15 soal E, 24 M, dan 15 H dari `sat_rw_m2` pada setiap
percobaan, jadi untuk tiga paket dibutuhkan 45 E — dan kekurangannya ada di
tingkat E, bukan di jumlah keseluruhan. Karena itu 24 soal `sat_rw_m2` batch ini
terdiri dari 11 E, 7 M, dan 6 H.

Cara yang sama diterapkan pada UTBK: 122 soal di tujuh subtes, masing-masing
tepat sebanyak kekurangannya — 26 di `utbk_pu`, 27 di `utbk_lbi`, 19 di
`utbk_lbe`, 18 di `utbk_ppu`, 12 di `utbk_pbm`, serta 10 di `utbk_pk` dan
`utbk_pm`. Ketujuhnya kini 3,0×.

Hasilnya, diukur dengan `npm run coverage`: **SAT, UTBK, dan A Level kini
memberi 3 paket berturut-turut yang seluruh soalnya baru.** CSCA masih 2, dan
tabel di awal berkas ini mencantumkan berapa soal lagi yang dibutuhkan.

## Batch ketiga: menutup lubang yang terukur

Berkas berakhiran `-03` (79 soal) tidak ditulis untuk menambah jumlah, melainkan
untuk menutup dua lubang yang ditunjukkan `bank-coverage.mjs`:

- **A Level paling tipis.** Seluruh sectionnya duduk di rasio 2,0–2,1×, dan
  `al_econ_p2` hanya punya 8 soal untuk 4 soal per form. Sekarang 2,5–3,0×, dan
  soal yang terulang antar percobaan turun dari 49% ke **39%**.
- **Kelaparan soal mudah.** `utbk_pm` tidak punya satu pun soal tingkat E,
  begitu pula `al_econ_p2` dan `al_phys_p2`; `al_chem_p1` hanya 4 dari 81. Bank
  yang isinya hampir seluruhnya M dan H salah menggambarkan ujiannya — past
  paper mana pun dibuka dengan soal yang bisa dikerjakan — dan membuat varian
  «mudah» pada modul adaptif menjadi tidak nyata. Batch ini menambah 30 soal
  tingkat E.

| Section | Sebelum | Sesudah | E sebelum → sesudah |
|---|---|---|---|
| `al_chem_p1` | 2,0× | 2,5× | 4 → 12 |
| `al_math_p1` | 2,1× | 2,8× | 1 → 4 |
| `al_phys_p2` | 2,1× | 2,9× | 0 → 2 |
| `al_econ_p2` | 2,0× | 3,0× | 0 → 2 |
| `utbk_pm` | 2,1× | 2,5× | **0 → 4** |
| `utbk_pk` | 2,1× | 2,5× | 2 → 5 |
| `utbk_pbm` | 2,1× | 2,4× | 2 → 4 |
| `sat_rw_m1` | 2,3× | 2,6× | 9 → 12 |
| `sat_math_m1` | 2,4× | 2,7× | 8 → 12 |
| `sat_rw_m2` | 2,0× | 2,6× | **22 → 35** |
| `sat_math_m2` | 2,0× | 2,5× | **18 → 29** |

Angka «sesudah» adalah proyeksi: batch ini masuk dengan status `in_review` dan
belum ikut menyusun paket. Ia baru berlaku setelah disetujui di `/admin/soal`.

### Kenapa modul 2 dibobotkan ke tingkat E

Varian adaptif tidak mengambil soal sembarangan: ada kuota per tingkat
kesulitan. Varian mudah mengambil E:M:H sebesar 0,40 : 0,45 : 0,15, varian sulit
0,15 : 0,45 : 0,40, dan keduanya disusun untuk setiap attempt. Untuk
`sat_rw_m2` itu berarti **15 soal tingkat E terpakai di setiap percobaan** —
dari 22 yang tersedia. Soal E-lah yang paling cepat habis, dan itulah pendorong
sebenarnya angka pengulangan SAT, bukan jumlah soal secara keseluruhan.

Karena itu 54 soal modul 2 dalam batch ini dibobotkan ke tingkat E (24 dari 54),
bukan disebar rata. Hasilnya terukur: pengulangan SAT turun dari 49% ke **38%**,
terendah di antara keempat ujian.

### Satu cacat yang tersingkap saat menulis batch ini

`npm run validate` memperingatkan 47% kunci berkas `sat-rw-m2-03` jatuh di opsi
B, jadi penyeimbang dijalankan. Sesudahnya, tiga pembahasan menunjuk opsi yang
keliru.

Penyebabnya ada di `scripts/balance-keys.mjs`: pola pencari rujukan huruf
mengenali «Option B» tetapi tidak «option B», karena polanya peka huruf
besar-kecil. Rujukan huruf kecil lolos dari pemetaan ulang, lalu diam-diam
menunjuk opsi lain setelah urutannya digeser.

Penyisiran seluruh bank menemukan **6 butir yang sudah rusak sejak sebelum batch
ini** — lima CSCA dan satu UTBK. Salah satunya, `csca-zhh-a03`, menyebut «option
C» dua kali untuk dua opsi yang berbeda; yang lain, `csca-zst-d05`, menjelaskan
sebuah pengecoh sambil menunjuk opsi yang justru kuncinya. Pembahasan adalah
bagian yang dibayar pembeli, jadi ini bukan cacat kosmetik.

Polanya kini `/gi`, dan kesembilan butir sudah diperbaiki dengan menyebut **isi
opsinya, bukan hurufnya** — «白发三千丈 adalah 夸张», bukan «opsi C adalah 夸张».
Itu pula aturan untuk soal baru: urutan opsi tidak dibekukan ke dalam attempt,
sehingga huruf apa pun yang disebut di dalam pembahasan bisa bergeser di
kemudian hari. Menyebut isinya tidak pernah bisa salah.

## Soal ini orisinal, bukan salinan past paper

Setiap butir ditulis dari nol. Yang diambil dari ujian sungguhan hanyalah hal
yang memang tidak dilindungi hak cipta dan memang harus sama agar latihan ini
bermakna:

- **struktur** — jumlah soal, durasi, dan pembagian bagian tiap ujian;
- **cakupan materi** — domain dan skill sesuai silabus resmi;
- **bentuk soal** — panjang stem, jumlah opsi, gaya perintah;
- **tingkat kesulitan** — sebaran mudah/sedang/sulit menyerupai form asli.

Yang **tidak** diambil: teks soal, bacaan, angka, gambar, atau opsi jawaban dari
naskah ujian mana pun. Tidak ada satu kalimat pun yang disalin. Kebijakan ini
tidak boleh dilonggarkan: memasukkan soal past paper ke bank akan membuat
seluruh produk melanggar hak cipta College Board, Cambridge, maupun penyelenggara
UTBK.

## Posisi kunci jawaban

Versi pertama bank ini memiliki cacat yang serius: **89% kunci jatuh di opsi A**.
Penyebabnya sederhana — saat menulis, jawaban benar disusun lebih dulu lalu
pengecoh ditambahkan sesudahnya. Akibatnya siswa yang selalu memilih A akan
benar 89% kali tanpa membaca satu soal pun, dan seluruh bank kehilangan
validitasnya.

Urutan opsi kini diacak ulang secara deterministik sehingga sebarannya merata:

| | A | B | C | D | E |
|---|---|---|---|---|---|
| sebelum | 89,3% | 5,1% | 4,3% | 1,1% | 0,2% |
| sesudah | 24,6% | 24,0% | 23,7% | 23,1% | 4,6%\* |

\*E hanya ada pada soal 5 opsi (UTBK); di dalam kelompok itu sebarannya
19–21% untuk kelima opsi.

Pengacakan menjaga empat hal tetap konsisten: `answer.value`,
`distractorRationale` (kuncinya id opsi), `i18n.*.choices` (validator menuntut
urutan id sama persis dengan versi utama), dan rujukan huruf di dalam
pembahasan («Option B», «**A**») — 43 pembahasan mengandung rujukan semacam itu
dan seluruhnya ikut dipetakan ulang. Opsi seperti «tidak dapat ditentukan»
tetap dikunci di posisi terakhir.

```bash
npm run balance-keys              # laporan saja
npm run balance-keys -- --write   # tulis perubahan
npm run balance-keys -- --adopt --write   # tandai yang ada sebagai sudah rapi
```

`npm run validate` kini melaporkan sebaran kunci setiap berkas dan memberi
peringatan bila satu opsi melebihi 45%. Cacat ini tidak terlihat per soal —
hanya terlihat pada tingkat berkas — sehingga pemeriksaannya ada di CLI, bukan
di `validate.ts`. Peringatan itu terbukti berguna: setiap batch form 2 keluar
dengan 75–100% kunci di opsi B, karena kebiasaan menulis menaruh jawaban benar
di posisi kedua. Tanpa peringatan itu tidak ada yang akan menyadarinya.

Penyeimbang bersifat **idempoten**: soal yang sudah pernah diseimbangkan
ditandai `meta.keyBalanced` dan tidak pernah diacak ulang; soal baru mengisi
huruf yang paling jarang terpakai, dihitung terpisah untuk soal 4 opsi dan
5 opsi. Ini bukan sekadar kerapian. Urutan opsi **tidak** ikut dibekukan ke
dalam attempt — `FormSectionLayout` hanya menyimpan `questionIds`, dan huruf
opsi dibaca dari bank saat halaman ujian dirender. Mengacak ulang soal yang
sedang dikerjakan berarti menggeser huruf di bawah kaki peserta: jawaban «A»
yang tersimpan tiba-tiba menunjuk opsi lain. Karena itu penyeimbang menolak
menulis bila soal yang hendak diacak sedang dipakai attempt berstatus
`in_progress`; `--force` menembusnya, dan hanya itu yang boleh dipakai bila
attempt-nya memang bukan peserta sungguhan.

## Pemeriksaan lintas berkas

`npm run check-scripts` memeriksa dua hal yang mustahil terlihat dari validator
per berkas:

- **id ganda.** Impor memetakan soal ke dalam `Map` berdasarkan id, jadi soal
  yang bertabrakan tertimpa tanpa pesan apa pun. Ini bukan kekhawatiran teoretis:
  16 soal fisika form 2 memakai id yang sudah dipakai form 1, bank menyusut 13
  soal saat impor, dan tidak ada satu pun peringatan. Yang menyingkapkannya
  hanyalah keganjilan angka — form CSCA keluar 290 soal padahal blueprint
  meminta 304.
- **aksara nyasar.** Kata Mandarin di dalam stem berbahasa Inggris, atau kata
  Inggris di dalam opsi berbahasa Mandarin. Bentuk JSON-nya sah, jadi validator
  meloloskannya; yang salah adalah isinya. Pinyin di dalam kurung — 溶解（róng）—
  dikecualikan, karena di soal pelafalan memang harus ada.

## Yang belum dilakukan

Seluruh soal lolos validator struktural (`npm run validate <file> -- --strict`)
tanpa satu pun BLOCKER atau MAJOR. Validator memeriksa skema, kecocokan
domain/skill dengan blueprint, keseimbangan LaTeX, kelengkapan figure, dan
kewajiban dwibahasa CSCA.

Tinjauan kunci dilakukan lewat `/admin/soal` — klik soal mana pun untuk membuka
panel yang menampilkan kunci, pembahasan, alasan tiap pengecoh, dan versi
dwibahasa. Putusan «setujui» atau «kembalikan» tersimpan bersama email peninjau
dan waktunya; pengembalian wajib disertai alasan. Rinciannya di
[`docs/SETUP.md`](../docs/SETUP.md#51-bagaimana-guru-meninjau-kunci-jawaban).

Untuk memulai, buka `/admin/tinjauan`: antrean itu mengurutkan soal menurut
peluang kekeliruannya lolos tanpa disadari — hitungan panjang, isian angka tanpa
pengecoh pembanding, soal dwibahasa, dan soal bergambar naik ke atas. Rinciannya
di [`docs/SETUP.md`](../docs/SETUP.md#52-dari-mana-memulai--antrean-tinjauan).

**Validator tidak memeriksa kebenaran kunci jawaban.** Saya sudah memeriksa
setiap perhitungan sendiri dan memperbaiki beberapa kunci yang keliru selama
penulisan, tetapi itu bukan pengganti tinjauan guru. Seluruh soal masuk dengan
`meta.reviewed: false`. Sebelum dipakai untuk ujian berbayar, setiap butir perlu:

1. tinjauan guru mata pelajaran atas kunci dan pembahasan;
2. uji lapangan untuk mengalibrasi `irtB` — angka sekarang adalah tebakan awal,
   bukan hasil pengukuran;
3. penyuntingan bahasa oleh penutur asli untuk bagian Mandarin dan Inggris.

## Menambah soal

**Periksa dulu apakah nama berkasnya sudah dipakai.** Menulis ke nama yang sudah
ada akan menimpanya tanpa satu pun peringatan, dan `check-scripts` tetap lolos
karena id soal barunya memang unik — yang hilang adalah isi berkas lamanya.
Kesalahan ini sudah terjadi dua kali di sini (`sat-math-04.json` dan ketiga
berkas `csca-*-04.json`), keduanya ketahuan hanya karena jumlah soal tidak cocok
dengan yang diharapkan. Pemulihannya lewat `git checkout HEAD -- <berkas>`.

```bash
ls question-bank/ | grep <pola>        # pastikan namanya belum dipakai
npm run validate question-bank/berkas-baru.json -- --strict
npm run import   question-bank/berkas-baru.json -- --status in_review
```

Impor dengan status `in_review` agar soal tidak langsung masuk paket ujian;
setujui di `/admin/soal` setelah ditinjau. Berkas di direktori ini diimpor
dengan status `approved` karena dibutuhkan untuk membuktikan bahwa form penuh
dapat tersusun.

## Status tinjauan

Tiap soal membawa field `status` (`draft` / `in_review` / `approved` / `retired`)
di berkas sumbernya. Di situlah status tinggal — bukan di `.data/question-bank.json`,
yang merupakan hasil olahan dan tidak masuk git.

```bash
npm run seed          # bangun ulang .data/question-bank.json dari berkas sumber
```

Sebelumnya status hanya hidup di berkas runtime, sehingga `git pull` di perangkat
lain menghasilkan bank yang seluruhnya `draft` dan tidak satu pun soal bisa
menyusun paket. Menyetujui soal lewat `/admin/soal` atau `npm run approve`
mengubah berkas runtime; salin hasilnya ke berkas sumber agar persetujuan itu
ikut tersimpan di git.
