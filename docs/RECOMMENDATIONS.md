# Rekomendasi

Disusun berdasarkan dampak terhadap produk, bukan berdasarkan mudahnya dikerjakan. Bagian 1 adalah
hal yang **harus** selesai sebelum menerima uang dari siswa.

---

## 1. Wajib sebelum berjualan

### ~~1.1 Waktu ujian harus dipegang server~~ — **selesai**

Tenggat tiap subtes kini tersimpan sebagai timestamp absolut di `attempts.section_deadlines`,
ditetapkan sekali saat siswa menekan "Mulai", dan dikunci trigger database. Browser hanya
menampilkan hitung mundur lalu mencocokkan ulang tiap 20 detik. Jawaban lewat tenggat ditolak di
`/save` (409) dan diabaikan lagi di `/submit`. Rinciannya di
[ARCHITECTURE.md § Waktu ujian dipegang server](ARCHITECTURE.md).

Yang masih perlu dilakukan: **uji beban** jalur ini sebelum try out akbar pertama (lihat §5).

### ~~1.2 Driver Supabase untuk attempt dan leaderboard~~ — **selesai, belum diuji live**

`src/lib/db/supabase.ts` mengimplementasikan antarmuka `Db` yang sama dengan driver berkas, dan
`getDb()` memilih otomatis dari environment. Autentikasi bercabang dengan pola yang sama di
`src/lib/auth.ts`.

**Belum diuji terhadap project Supabase sungguhan.** Sebelum deploy: buat project, jalankan keempat
migrasi, lalu ulangi alur daftar → bayar → OTP → ujian → hasil → papan peringkat di sana. Perhatikan
khususnya trigger `guard_section_deadlines` (harus menolak perpanjangan tenggat) dan `v_leaderboard`
(harus menyaring skor integritas di bawah 60).

### ~~1.3 Webhook pembayaran, bukan tombol "bayar"~~ — **selesai, belum diuji live**

Midtrans Snap terpasang. Kuota hanya diberikan dari `/api/webhooks/midtrans` setelah signature dan
nominal terverifikasi; endpoint simulasi otomatis 403 begitu kunci Midtrans terisi atau di produksi.

**Belum diuji terhadap akun Midtrans sungguhan.** Sebelum menerima uang: jalankan Simulator Sandbox
untuk `settlement`, `deny`, `expire`, dan **notifikasi ganda** — yang terakhir memastikan kuota tidak
diberikan dua kali.

### ~~1.4 Bank soal yang cukup~~ — **satu form penuh tercapai, kalibrasi belum**

Bank kini berisi **647 soal** (605 orisinal + 42 contoh), cukup menyusun **satu
form penuh untuk keempat ujian** tanpa soal terulang — sudah diverifikasi dengan
menyusun form nyata lewat `/api/attempts` untuk SAT, UTBK, CSCA, dan A Level.

| Ujian | Soal | Satu form | Target jual |
|---|---|---|---|
| SAT | 206 | 98 ✓ | 800 |
| UTBK | 332 | 160 ✓ | 1.550 |
| CSCA | 592 | 304 ✓ | 640 |
| A Level | 126 | 63 ✓ | 200/subject |

Satu cacat besar sudah diperbaiki: versi pertama menaruh **89% kunci di opsi A**,
yang membuat tebakan buta bernilai 89%. Urutan opsi kini diacak merata
(masing-masing 23–25%), dan `npm run validate` memberi peringatan bila berkas
baru mengulang pola yang sama. Rinciannya di
[`question-bank/README.md`](../question-bank/README.md#posisi-kunci-jawaban).

Yang **masih** kurang untuk berjualan:

- **Pengulangan antar-percobaan.** Diukur dari dua susunan paket dengan seed
  berbeda, 40 kali: UTBK **47%**, A Level **49%**, CSCA **49%** — ketiganya
  sudah punya form kedua penuh. Tersisa **SAT 92%**: modul 1 masih 1:1 dan
  butuh sekitar 110 soal lagi. Perlu dicatat bahwa angka SAT dihitung atas
  susunan beku yang memuat KEDUA varian modul 2, sehingga yang benar-benar
  dikerjakan peserta lebih sedikit daripada 147.
- ~~**Modul adaptif SAT** butuh dua varian untuk setiap modul kedua~~ **selesai** —
  kedua varian kini tersusun, routing diputuskan server dari hasil modul 1, dan
  modul mudah dipetakan ke 200–600. Sebelumnya `adaptive` hanya ada di blueprint
  dan di teks beranda; tidak ada kode yang membacanya.
- **Impor soal baru harus `--status approved`.** Default impor adalah `draft`,
  dan `composeLayout()` hanya memakai soal berstatus `approved`. 304 soal CSCA
  form 2 sempat masuk sebagai draft dan sama sekali tidak terpakai — form tetap
  tersusun dari stok lama, dan pengulangannya tetap 100%. Tidak ada pesan
  kesalahan; yang terlihat hanya angka yang tidak berubah.
- **Urutan opsi belum dibekukan ke dalam attempt.** `FormSectionLayout` hanya
  menyimpan `questionIds`; huruf opsi dibaca langsung dari bank saat halaman
  ujian dirender. Jadi apa pun yang menulis ulang urutan opsi di tengah ujian —
  penyeimbang kunci, impor, atau suntingan lewat `/admin/soal` — menggeser huruf
  di bawah kaki peserta: jawaban "A" yang tersimpan tiba-tiba menunjuk opsi lain.
  `scripts/balance-keys.mjs` kini idempoten (soal bertanda `meta.keyBalanced`
  tidak pernah diacak ulang) dan menolak menulis selama ada attempt
  `in_progress`, jadi jalur itu tertutup. Jalur admin **belum**. Perbaikan
  sebenarnya: simpan urutan opsi per attempt di `formLayout`, sebagaimana
  `questionIds` sudah dibekukan dengan alasan yang persis sama.
- **Kalibrasi `irtB`.** Angka sekarang adalah tebakan penulis, bukan hasil uji
  lapangan. Penilaian IRT tetap berjalan, tetapi skalanya belum berarti.
- **Tinjauan guru.** Seluruh soal berstatus `meta.reviewed: false`. Validator
  memeriksa struktur, bukan kebenaran kunci.

Rincian kebijakan penulisan dan batasan hak cipta ada di
[`question-bank/README.md`](../question-bank/README.md).

### 1.5 Kepatuhan hukum — **sisi kodenya selesai, sisi manusianya belum**

- ~~**UU PDP (No. 27/2022) / GDPR.**~~ **Selesai sebagai kode dan sudah diuji ujung ke ujung:**
  kebijakan privasi dan T&C tiga bahasa (`/privasi`, `/ketentuan`), banner cookie yang hanya
  meminta izin untuk cookie rujukan afiliasi, kotak persetujuan wajib saat mendaftar yang
  merekam versi dokumen ke `profiles.consent`, ekspor data (`GET /api/privacy/export`), dan
  penghapusan akun (`POST /api/privacy/delete`) yang menganonimkan — bukan menghapus — catatan
  keuangan. Rinciannya di [`DEPLOY.md`](DEPLOY.md#2-kepatuhan-data-pribadi-gdpr--uu-pdp).

  **Yang masih perlu manusia, bukan kode:** naskah kebijakan ditinjau pengacara (naskah sekarang
  mencantumkan sendiri bahwa ia draf), perwakilan di UE (GDPR Art. 27) bila peserta Eropa jadi
  bagian berarti, dan Data Processing Agreement dengan Supabase serta penyedia pembayaran.
  Persetujuan wali untuk siswa di bawah 18 tahun baru berupa pernyataan di kotak persetujuan —
  belum ada alur verifikasi wali yang sesungguhnya.
- **Merek dagang.** SAT dan Bluebook milik College Board; A Level milik Cambridge. Tulis di footer
  dan halaman harga: *"Exact Try Out tidak berafiliasi dengan, tidak disponsori oleh, dan tidak
  didukung oleh College Board maupun Cambridge Assessment."* Jangan memakai logo mereka. Aman
  menyebut nama ujian untuk menerangkan isi produk; tidak aman menyiratkan kerja sama.
- **Transparansi AI.** Cantumkan bahwa soal disusun dengan bantuan AI dan ditinjau pengajar. Ini
  justru membangun kepercayaan, dan melindungimu saat ada soal yang keliru.
- Syarat & ketentuan: masa berlaku kuota, kebijakan refund, aturan pembatalan skor karena
  pelanggaran integritas.

---

## 1b. Audit fitur — temuan (28 Agustus 2026)

Ditelusuri satu per satu: 34 route API, alur ujian, pembayaran, afiliasi, dan
hak atas data. Yang **sudah benar** dan terverifikasi: seluruh route admin
dijaga `adminOrNull()`; seluruh route attempt dijaga kepemilikan lewat
`loadAttempt()`; tenggat section ditetapkan sekali dan membuka ulang section
tidak menambah waktu; jawaban yang masuk setelah tenggat ditolak dan diganti
jawaban tersimpan; kunci jawaban tidak pernah keluar dari server selama ujian;
merujuk diri sendiri ditolak; verifikasi tanda tangan webhook lulus 31 uji.

**Diperbaiki dalam audit ini:**

- ~~**Kuota tidak ditegakkan di driver berkas.**~~ **selesai.** `createAttempt`
  menaikkan `attemptsUsed` hanya bila masih ada sisa, lalu tetap membuat
  attempt-nya. Begitu kuota habis, attempt berbayar menjadi gratis tanpa batas.
  Terukur di `.data/db.json`: **41 attempt berbayar terhadap total kuota 24** —
  16 SAT atas jatah 6, 7 CSCA atas jatah 4, 9 A Level atas jatah 4. Driver
  Supabase melempar «Kuota try out habis» dalam keadaan yang sama, jadi paywall
  ada di produksi tetapi tidak ada di mode yang dipakai untuk mengujinya.
- ~~**Penghapusan akun menghancurkan catatan keuangan di Supabase.**~~
  **selesai** (`0011_erasure_financial.sql`). `commissions` dan `payouts` masih
  `on delete cascade` ke `auth.users`, sehingga `auth.admin.deleteUser()`
  menghapus seluruh riwayat komisi dan pencairan orang itu — termasuk bukti
  bahwa uang pernah dibayarkan kepadanya. Migrasi 0008 sudah menangani
  `orders`; dua tabel ini terlewat. Driver berkas menganonimkan dengan benar,
  jadi sekali lagi dua driver berbeda perilaku. Sekaligus: `payouts.method`
  berisi nomor rekening — itu data pribadi dan kini ikut dihapus, bukan
  dianonimkan.
- ~~**`/api/checkout/create` dan `/checkout/status` tanpa pembatas laju.**~~
  **selesai.** Keduanya sengaja tanpa sesi karena pendaftar belum login saat
  membayar, jadi `orderId` berperan sebagai token. UUID tidak bisa ditebak,
  tetapi ikut muncul di URL `/daftar?order=…` sehingga bisa bocor lewat riwayat
  peramban, referrer, atau log; halaman Stripe menampilkan email pemilik
  pesanan. Pembatas laju menahan penyalahgunaan orderId yang bocor dan
  pembuatan sesi gateway tanpa batas.

**Belum diperbaiki — perlu keputusan Anda:**

- **Papan peringkat menerbitkan nama dan sekolah tanpa autentikasi, tanpa opsi
  keluar.** `GET /api/leaderboard` terbuka untuk siapa saja dan mengembalikan
  nama pendek, sekolah, dan `userId` setiap peserta. Untuk peserta yang sebagian
  besar di bawah umur, itu data pribadi yang diterbitkan tanpa persetujuan
  terpisah. Perbaikannya butuh keputusan produk: kolom `leaderboard_opt_in` di
  profil, defaultnya mati, plus saklar di `/pengaturan`. Papan peringkat adalah
  fitur penjualan, jadi defaultnya bukan keputusan teknis.
- **Pembatas laju hanya di memori proses.** Di Vercel setiap invocation bisa
  proses baru, jadi di produksi pembatasnya nyaris tidak berlaku — ini lebih
  serius daripada «cukup untuk satu instance» yang tertulis di komentarnya.
  Gantinya Upstash Redis; antarmuka fungsinya sudah dibuat sama supaya
  penggantiannya satu berkas.
- ~~**Tidak ada uji otomatis di luar webhook.**~~ **sebagian besar selesai.**
  `npm run test:exams` menjalankan 31 uji atas jalur ujian: penegakan kuota
  (termasuk entitlement kedaluwarsa), pembekuan akomodasi waktu, pemulihan
  jawaban setelah memuat ulang, autosave kosong yang tidak boleh menghapus
  apa pun, penutupan attempt yang ditinggalkan, rentang skor keempat ujian,
  dan penilaian esai dari ujung ke ujung. Ditambah 31 uji webhook, seluruhnya
  62. Uji-nya berjalan di atas salinan data lewat `EXACT_DATA_DIR`, jadi tidak
  pernah menyentuh `.data` yang sedang dipakai — menyalin-dan-memulihkan
  bekerja sampai satu uji gagal di tengah jalan dan pemulihannya tidak pernah
  terjadi. Diverifikasi bahwa uji-nya benar-benar menangkap regresi: dua
  perbaikan dirusak sengaja, empat uji langsung gagal.
  **Yang masih belum terjaga:** penghapusan data pribadi, dan perbandingan
  perilaku antara kedua driver.
- **Dua driver basis data mudah menyimpang tanpa ketahuan.** Dua dari tiga
  cacat di audit fitur adalah divergensi `dev.ts` versus `supabase.ts`.
  Keduanya mengimplementasikan `FullDb` yang sama, tetapi TypeScript hanya
  menyamakan bentuknya — bukan perilakunya. `test:exams` sekarang menjaga
  perilaku itu, tetapi hanya pada driver berkas; menjalankan skenario yang
  sama terhadap Supabase butuh project uji dan belum ada. Sampai itu ada,
  setiap perubahan pada salah satu driver harus dibaca berdampingan dengan
  pasangannya.

## 1c. Apakah sudah layak disebut try out? — audit teknis

Diukur terhadap apa yang harus dimiliki simulasi ujian, bukan terhadap daftar
fitur. **Sudah ada dan terverifikasi:** tandai soal, coret opsi, penyorot,
anotasi, kalkulator, lembar rumus, perbesar teks, pintasan papan tik; jam
otoritatif di server; tenggat sekali tetapkan; jawaban terlambat ditolak; kunci
jawaban tidak pernah sampai ke browser; halaman hasil dengan pembahasan,
alasan tiap pengecoh, dan peta domain; proktor mencatat pindah tab, keluar
layar penuh, salin-tempel, klik kanan, dan dugaan devtools.

**Diperbaiki dalam audit ini:**

- ~~**Memuat ulang halaman menampilkan seluruh jawaban kosong.**~~ **selesai.**
  `responses` selalu dimulai `{}` dan jawaban tersimpan tidak pernah dikirim
  balik. Datanya sebenarnya aman — `saveResponses` menggabungkan, tidak
  menimpa — tetapi peserta tidak bisa tahu itu: yang ia lihat adalah seluruh
  pekerjaannya lenyap di tengah ujian berwaktu. Untuk sebuah try out itu saja
  sudah cukup merusak kepercayaan.
- ~~**Tidak ada penyelamatan saat tab ditutup.**~~ **selesai.** Autosave tiap
  15 detik, tanpa apa pun saat halaman ditinggalkan. Sekarang `pagehide` dan
  `visibilitychange` mengirim sekali lagi dengan `keepalive` — `beforeunload`
  sengaja tidak dipakai karena Safari dan peramban ponsel kerap melewatkannya.
- ~~**Attempt yang ditinggalkan menggantung selamanya.**~~ **selesai.** Tidak
  ada auto-submit sama sekali: baterai habis di tengah ujian berarti kuota
  terpakai, jawaban tersimpan, tetapi nilai tidak pernah keluar. Sekarang
  halaman ujian menutupnya sendiri bila seluruh tenggat sudah lewat, dan
  `scripts/finalize-abandoned.mjs` menyapu sisanya. Aturannya sengaja
  konservatif — attempt yang section berikutnya belum dimulai masih hak
  pesertanya, jadi hanya ditutup lewat `--stale-days` yang harus diminta.
- ~~**Peserta A Level yang sempurna hanya memperoleh 73%.**~~ **selesai.**
  Soal esai bernilai rubrik tidak bisa dinilai mesin — `gradeAnswer`
  mengembalikan credit 0 dan berkomentar «dinilai terpisah» — tetapi tetap
  ikut masuk penyebut. Akibatnya pekerjaan sempurna menghasilkan nilai **B**.
  Menghitung sesuatu yang tidak pernah bisa benar sebagai jawaban salah bukan
  penilaian, melainkan kesalahan. Soal rubrik kini dikeluarkan dari hitungan
  dan halaman hasil menyebutkan berapa yang menunggu penilaian pengajar.
  Diverifikasi ulang untuk keempat ujian: SAT 400–1600, UTBK 115–885,
  CSCA 0–100, A Level 0–100 dengan nilai U–A*.

**Belum ada — dan ini yang memisahkan «berfungsi» dari «standar»:**

- ~~**Waktu tambahan untuk akomodasi.**~~ **selesai**
  (`0012_time_accommodation.sql`). Pengali 1 / 1,5 / 2 ditetapkan admin di
  `/admin/peserta`, dikalikan ke dalam susunan paket saat attempt dibuat, lalu
  **dibekukan** bersama attempt — sama seperti susunan soal, dan karena alasan
  yang sama: mengubah hak peserta di tengah ujian tidak boleh mengubah ujian
  yang sedang berjalan, ke arah mana pun. Diverifikasi: SAT RW 32→48→64 menit,
  Math 35→53→70; menaikkan akomodasi di tengah ujian tidak menggeser tenggat
  yang sudah berjalan tetapi berlaku pada try out berikutnya; nilai yang tidak
  diakui (1,7× · 3× · 0 · teks) dinormalkan ke 1, bukan dibulatkan. Pengali
  dibaca dari profil di server, tidak pernah dari badan permintaan, dan tidak
  ada satu pun jalur peserta yang bisa menulisnya — di Supabase dikunci lagi
  oleh trigger `guard_time_multiplier`. Peserta berakomodasi melihat penanda
  «2× waktu» di header ujian supaya tidak mengira jamnya rusak, dan halaman
  hasil mencatatnya.
- ~~**Penilaian esai.**~~ **selesai** (`0013_essay_marking.sql`). Antrean di
  `/admin/esai` menampilkan setiap jawaban uraian yang menunggu, lengkap dengan
  rubriknya per kriteria, jawaban peserta, dan jawaban teladan. Pengajar
  memberi poin per kriteria dan menulis umpan balik; skor attempt langsung
  dihitung ulang, dan peserta melihat rincian poin serta komentarnya di halaman
  hasil. Total **dijumlahkan ulang di server** dari rubrik soalnya, tidak
  pernah dipercaya dari browser — nilai esai adalah satu-satunya bagian skor
  yang tidak bisa diperiksa ulang oleh mesin, jadi kalau totalnya boleh
  dikirim apa adanya, satu permintaan yang disusun tangan bisa memberi nilai
  berapa pun tanpa terlihat janggal di layar penilai. Tiap kriteria dijepit ke
  poin maksimalnya; masukan tak masuk akal (tak hingga, teks, bukan array)
  menjadi nol, bukan nilai maksimum.
- **UTBK sempurna hanya mencapai 885/1000.** Itu perilaku wajar penskalaan
  IRT dengan theta terbatas, bukan bug — tetapi peserta yang menjawab seluruh
  soal dengan benar akan bertanya. Perlu dijelaskan di halaman hasil, atau
  kurva penskalaannya dikalibrasi ulang setelah ada data lapangan.
- **Belum diuji berbarengan.** Semua pengukuran di atas satu proses, satu
  peserta. Perilaku saat ratusan peserta menekan «mulai» pada detik yang sama
  belum pernah diamati.

## 1d. Pengujian putaran kedua — temuan

Diuji lewat HTTP sungguhan terhadap server yang berjalan, bukan lewat pembacaan
kode. **Yang terbukti benar:** tidak ada nilai kunci jawaban yang sampai ke
browser pada keempat ujian (yang terkirim hanya `answer.mode`, yang memang
dibutuhkan renderer); keenam mode jawaban menilai dengan benar pada 1.051 soal
(kunci→benar, ngawur→salah); routing adaptif SAT utuh ujung ke ujung — dua
varian dibekukan, tidak satu pun terlihat sebelum routing, modul 1 lemah→mudah
dan kuat→sulit, routing tidak bisa diulang, rute mudah berplafon 1200 dan rute
sulit mencapai 1600; melompati section, indeks negatif, dan indeks bukan angka
ditolak; jawaban soal dari attempt lain tidak masuk paket; isi section
berikutnya tidak ada di halaman; submit kedua tidak menilai ulang; batas demo
menolak dengan 429; kode OTP dev tidak pernah bocor di jalur produksi.

**Diperbaiki:**

- ~~**Komisi afiliasi menjumlahkan mata uang yang berbeda.**~~ **selesai.**
  Aplikasi menjual dalam empat mata uang, tetapi seluruh komisi seorang
  afiliasi dijumlahkan menjadi satu angka lalu dilabeli dengan mata uang
  komisi yang kebetulan pertama (`currency: mine[0]?.currency`). Terukur:
  satu pembeli Indonesia (komisi Rp 52.350) dan satu pembeli Amerika (komisi
  US$ 9) menghasilkan **«Rp 52.359»** — angka yang bukan rupiah, bukan dolar,
  dan tidak bisa dibayarkan. Afiliasinya dibayar Rp 9 untuk komisi US$ 9,
  meleset sekitar 16.000 kali lipat. Saldo kini dipisah per mata uang di kedua
  driver, angka utama selalu berasal dari satu mata uang saja, dan mata uang
  lain ditampilkan terpisah di panel afiliasi supaya tidak ada komisi yang
  hilang dari layar. Sengaja TIDAK dikonversi ke satu mata uang: aplikasi ini
  tidak punya kurs, dan mengarang kurs berarti menukar kesalahan yang
  kelihatan dengan kesalahan yang tersembunyi.

- ~~**Penjumlahan lintas mata uang di sisi SQL dan ringkasan admin.**~~
  **selesai** (`0014_affiliate_currency.sql`). `affiliate_stats` kini BERHENTI
  melaporkan uang sama sekali dan hanya mengembalikan klik, pendaftar, dan
  konversi — angka yang memang tidak bermata uang; saldo dihitung driver
  langsung dari tabel, dipisah per mata uang. Versi bergrup-mata-uang sempat
  dicoba tetapi mengembalikan nol baris saat afiliasinya belum punya komisi,
  sehingga klik dan pendaftar ikut hilang. `commissionOwedIdr` di ringkasan
  admin kini benar-benar hanya rupiah — persis seperti `revenueIdr` tepat di
  atasnya, yang sejak awal sudah memfilter mata uang — dan mata uang lain
  dirinci terpisah di `commissionOwed` serta ditampilkan di panel admin.
- ~~**Ekspor data mengklaim memuat «seluruh data pribadi».**~~ **selesai.**
  Klaim itu tidak benar: catatan sesi login tidak disertakan. Pengecualiannya
  memang benar — token sesi adalah kunci masuk ke akun, dan menyalinnya ke
  berkas yang bisa berpindah tangan justru membahayakan pemiliknya — tetapi
  menyebut cakupan secara mutlak lalu diam-diam meninggalkan satu kategori
  lebih buruk daripada meninggalkannya dengan penjelasan. Catatannya kini
  menyebut pengecualian itu beserta alasannya.

- ~~**Pendaftaran bisa disisir.**~~ **selesai.** `POST /api/auth/otp/send` kini
  menjawab identik ada atau tidak ada akunnya: «Kalau email itu terdaftar,
  kodenya sudah dikirim.» Kekhawatiran bahwa ini merugikan pengguna yang salah
  ketik email ternyata tidak berlaku — satu-satunya pemanggil endpoint ini
  adalah tombol «kirim ulang» di alur pendaftaran, yang akunnya baru saja
  dibuat sehingga selalu ada. Halaman masuk sudah lebih dulu memakai pola yang
  sama lewat «Email atau kata sandi salah». Yang bocor bukan sekadar
  keberadaan akun: bahwa seseorang ikut bimbingan persiapan ujian bukan hal
  yang wajib ia bagikan.
- ~~**Tidak ada cara mengakhiri seluruh sesi.**~~ **selesai.** Halaman
  Pengaturan punya «Keluarkan dari semua perangkat», dan `POST
  /api/auth/sessions` mengambil userId dari sesi yang berjalan — tidak pernah
  dari badan permintaan, karena kalau boleh dikirim siapa pun bisa mengeluarkan
  orang lain dari akunnya. Sesi yang sedang dipakai ikut diakhiri: orang yang
  menekan tombol ini menduga akunnya dipakai orang lain, dan menyisakan satu
  sesi hidup membuat tindakannya setengah jadi. Diverifikasi bahwa sesi
  pengguna lain tidak ikut terputus.

- ~~**`hashPw` memakai SHA-256 polos.**~~ **selesai.** SHA-256 dirancang untuk
  CEPAT — justru yang tidak diinginkan dari hash kata sandi; terukur di mesin
  ini **0,00 ms** per hash melawan **20 ms** untuk scrypt, dan perbandingan itu
  persis yang dinikmati pemecah sandi. Imbuhan tetap `"::exact"` juga bukan
  garam: dua orang dengan sandi sama menghasilkan hash sama. Diganti scrypt
  bergaram per pengguna, format `scrypt$<garam>$<hash>`, memakai modul `crypto`
  bawaan Node tanpa dependensi baru. Hash lama tetap bisa diperiksa dan
  **ditingkatkan otomatis saat pemiliknya berhasil masuk** — itu satu-satunya
  saat sandi aslinya tersedia, jadi satu-satunya kesempatan mengubah formatnya
  tanpa mengunci siapa pun di luar. Perbandingan hash kini memakai
  `timingSafeEqual`.

**Cacat yang saya buat sendiri dan tertangkap di putaran ini:** pembungkus
antrean driver memanggil `fn(...args)` alih-alih `fn.apply(mentah, args)`,
sehingga `this` menjadi undefined dan `login()` melempar — **seluruh jalur masuk
rusak**. Tidak ada satu pun yang menangkapnya sampai ada uji yang benar-benar
mencoba masuk. Sekarang ada, dan sudah diverifikasi bahwa merusaknya kembali
membuat rangkaian uji gagal dengan exit code 1.

**Belum diperbaiki:** —

**Yang diperiksa dan ternyata sudah benar:** sesi memakai token acak 24 byte
dengan masa tujuh hari, kedaluwarsa diperiksa saat dipakai dan dibersihkan saat
login baru; papan peringkat mengecualikan attempt demo, attempt yang belum
selesai, dan attempt dengan integritas di bawah 60, mengurutkan menurun dengan
benar, menghitung rata-rata dengan benar, dan hanya menampilkan nama pendek.

## 2. Mutu soal — pembeda yang sesungguhnya

Ini yang membuat siswa mau bayar lagi tahun depan, dan tidak bisa ditiru pesaing dalam semalam.

### 2.1 Uji lapangan sebelum dinilai

Sisipkan 3–5 soal baru ke setiap paket sebagai **soal tidak bernilai** (unscored, tidak diberi tahu
siswa). Setelah 200 jawaban terkumpul, hitung:

- **p-value** — proporsi benar. Target 0,30–0,85. Di luar itu, soal terlalu sulit/mudah.
- **point-biserial** — korelasi antara benar-soal-ini dan skor total. Di bawah 0,15 berarti soal
  tidak membedakan siswa kuat dan lemah — buang.
- **Analisis distraktor** — setiap opsi salah harus dipilih minimal 5% siswa. Opsi yang tidak pernah
  dipilih membuat soal 5-opsi menjadi soal 4-opsi.

Kolom `times_served`, `times_correct`, dan `avg_time_sec` sudah disiapkan di tabel `questions`.

### 2.2 Kalibrasi ulang `irtB`

`irtB` dari AI hanya tebakan. Setelah 200 respons per soal, hitung ulang dengan estimasi Rasch dan
tulis balik ke database. Skor UTBK-mu akan langsung jauh lebih dipercaya.

Jalankan sebagai cron mingguan. `estimateTheta()` di `scoring.ts` sudah memuat matematikanya.

### 2.3 Tinjauan dua lapis

Model kedua menjalankan `prompts/_shared/review.md` menangkap kunci ganda dan teka-teki logika
bersolusi jamak — dua kesalahan paling merusak. Setelah itu, guru mata pelajaran memberi status
`approved`. Tanpa lapis kedua ini, satu soal salah yang viral di grup siswa bisa menghapus
kepercayaan yang dibangun berbulan-bulan.

### 2.4 Kontrol paparan soal (item exposure)

Kalau soal yang sama muncul di banyak paket, jawabannya akan beredar. Terapkan aturan sederhana:
setiap soal maksimal muncul di 25% form aktif, dan pensiunkan (`status = 'retired'`) soal yang sudah
disajikan lebih dari 2.000 kali.

---

## 3. Yang membuat produk terasa jauh lebih mahal

Diurutkan berdasarkan rasio dampak terhadap usaha.

### 3.1 Buku catatan kesalahan (paling tinggi rasionya)

Kumpulkan otomatis setiap soal yang siswa jawab salah ke satu halaman, dikelompokkan per skill, dan
munculkan kembali versi paralelnya 3 hari, 7 hari, dan 21 hari kemudian. Ini menerapkan spaced
repetition tanpa siswa perlu tahu istilahnya, dan mengubah try out dari alat ukur menjadi alat
belajar. Datanya sudah tersimpan di tabel `responses` — tinggal dipakai.

### 3.2 Drill per-skill dengan tingkat kesulitan adaptif

Siswa memilih satu skill (mis. *Linear inequalities*), lalu mengerjakan soal yang tingkat
kesulitannya menyesuaikan θ berjalan. Ini pola ALEKS yang kamu sebut. Sudah 80% terbangun:
`estimateTheta()` ada, dan `mcq_single` sampai `graph_plot` semuanya sudah bisa dirender. Yang perlu
ditambahkan hanya pemilih soal berikutnya dan tampilan penguasaan per skill.

### 3.3 Peta penguasaan (knowledge map)

Tampilkan grafik semua skill dalam satu ujian, diwarnai menurut penguasaan, dengan prasyarat
digambar sebagai panah. Siswa langsung melihat "aku lemah di fungsi kuadrat karena aku belum kuat di
faktorisasi". Ini yang membuat ALEKS terasa berbeda dari bank soal biasa.

### 3.4 Penentu target dan rencana belajar

Siswa memasukkan kampus dan program studi tujuan. Sistem menghitung selisih antara skor sekarang dan
skor yang dibutuhkan, lalu memecahnya menjadi target per subtes dan jumlah jam latihan per minggu.
Untuk UTBK, tambahkan estimasi peluang berdasar sebaran skor pengguna sendiri — dan **tampilkan
sebagai estimasi, bukan janji**.

### 3.5 Try out akbar terjadwal

Semua peserta mengerjakan paket yang sama pada waktu yang sama, sekali sebulan. Peringkatnya menjadi
bermakna karena bandingannya setara. Ini juga peristiwa pemasaran yang paling murah: siswa yang
mendaftar akan mengajak teman sekelasnya.

### 3.6 Pembahasan video pendek

Tempelkan video 60–90 detik pada soal yang paling sering dijawab salah (data ini sudah kamu punya
dari §2.1). Tidak perlu untuk semua soal — 200 soal teratas menutupi sebagian besar keluhan.

---

## 4. Proctoring yang lebih serius

Yang ada sekarang adalah lockdown lunak. Peningkatan berurutan sesuai biaya:

| tingkat | tambahan | biaya |
|---|---|---|
| 1 (ada) | layar penuh, pindah tab, copy/paste, devtools, skor integritas | — |
| 2 | foto webcam berkala (tiap 30–60 detik), disimpan ke Supabase Storage | rendah |
| 3 | deteksi wajah di browser (`FaceDetector` / MediaPipe): tidak ada wajah, lebih dari satu wajah, wajah berpaling | sedang |
| 4 | verifikasi identitas sebelum ujian: foto KTP/kartu pelajar + swafoto | sedang |
| 5 | peninjauan manusia atas attempt berskor integritas rendah | tenaga kerja |

Yang **tidak** saya sarankan: perekaman layar penuh dan pengawasan kamera terus-menerus. Biaya
penyimpanannya besar, konsekuensi privasinya berat (terutama untuk anak di bawah umur di bawah UU
PDP), dan manfaat tambahannya kecil dibanding tingkat 2–3.

Yang murah dan terbukti efektif: **janji kejujuran** yang harus diketik ulang siswa sebelum ujian
dimulai. Penelitian perilaku menunjukkan ini menurunkan kecurangan lebih banyak daripada yang
diduga, dengan biaya nol.

---

## 5. Ketahanan teknis

- **Koneksi putus.** Simpan jawaban ke IndexedDB di sisi browser, sinkronkan saat online kembali.
  Siswa Indonesia mengerjakan ujian dari jaringan yang tidak selalu stabil, dan kehilangan jawaban
  adalah pengalaman yang tidak dimaafkan.
- **Lanjutkan attempt.** Kalau browser tertutup, siswa harus bisa melanjutkan dengan sisa waktu yang
  benar (dihitung dari `section_deadline` server, bukan dari awal lagi).
- ~~**Rate limiting**~~ — **selesai** untuk OTP (5 / 15 menit per email dan per IP), login (8 / 15
  menit), pendaftaran (10 / 15 menit per IP), dan demo (5 / jam per IP). Implementasinya berbasis
  memori proses di `src/lib/ratelimit.ts`, jadi **hanya berlaku per instance**. Begitu kamu berjalan
  di lebih dari satu instance Vercel, ganti isinya dengan Upstash Redis — antarmuka fungsinya sengaja
  dibuat sama supaya penggantiannya satu berkas.
- **Nomor HP diverifikasi**, tidak hanya diformat. OTP WhatsApp lewat penyedia lokal lebih murah
  daripada SMS, dan tingkat bacanya lebih tinggi.
- **Uji beban** sebelum try out akbar pertama. 500 siswa yang men-submit pada menit yang sama akan
  menemukan setiap masalah yang tersembunyi.

---

## 6. Aksesibilitas dan jangkauan

- **Akomodasi waktu tambahan** (1,5× dan 2×) — ini standar di SAT dan A Level, dan sering dibutuhkan
  siswa dengan disleksia. Tambahkan pengali pada profil, gunakan di `sectionDeadline`.
- **Navigasi papan ketik penuh** dan label ARIA di ruang ujian. Sebagian sudah ada; perlu diaudit
  ujung ke ujung.
- **Teks ke suara** untuk bacaan panjang, memakai Web Speech API bawaan browser (gratis).
- **Tampilan ponsel** untuk mode drill dan dashboard. Ujian penuh sebaiknya tetap desktop-only, dan
  itu jujur untuk dikatakan — ujian aslinya juga begitu.
- Tema *Focus Sepia* dan *High Contrast* sudah tersedia; tambahkan pengatur ukuran huruf di ruang
  ujian.

---

## 7. Model bisnis

- **B2B ke bimbel dan sekolah** adalah jalur dengan margin terbaik. Yang dibutuhkan: dashboard guru,
  pembuatan kelas, unggah daftar siswa massal, laporan per kelas dan per siswa, penjadwalan try out
  internal. Satu sekolah = 200 lisensi sekaligus, dengan biaya akuisisi hampir nol dibanding menjual
  satu per satu.
- **Kode rujukan.** Siswa yang mengajak teman mendapat 1 kuota tambahan. Pasar bimbel Indonesia
  bergerak lewat grup WhatsApp angkatan.
- **Bundel lintas ujian.** Siswa yang mengambil SAT sering juga mengambil UTBK sebagai cadangan.
  Bundel SAT + UTBK dengan diskon 25% menaikkan nilai transaksi rata-rata.
- **Demo yang lebih baik.** 10 soal gratis sekarang tidak memerlukan email. Pertimbangkan meminta
  email **setelah** soal ke-10 untuk melihat hasil — konversinya jauh lebih tinggi karena siswa sudah
  berinvestasi waktu.
- **Sertifikat hasil** yang bisa dibagikan (PDF dengan tautan verifikasi). Gratis dibuat, dan setiap
  yang dibagikan adalah iklan.

---

## 8. CSCA — sudah dikalibrasi ke spesifikasi resmi

Blueprint CSCA sebelumnya salah total: ia mengarang lima subtes (Chinese, Math, English, Science,
Logic) dengan skala 0–150. Struktur resminya berbeda sama sekali, dan sekarang sudah diperbaiki:

| Mata uji | Waktu | Soal | Bahasa | Diwajibkan untuk |
|---|---|---|---|---|
| Mathematics 数学 | 60 menit | 48 | EN atau 中文 | **semua pelamar** |
| Physics 物理 | 60 menit | 48 | EN atau 中文 | Teknik, Ilmu Komputer, Sains Fisik |
| Chemistry 化学 | 60 menit | 48 | EN atau 中文 | Kedokteran, Teknik Kimia, Ilmu Hayati |
| Humanities Chinese 文科中文 | 90 menit | 80 | 中文 saja | Program Mandarin: humaniora, seni, hukum, sosial |
| STEM Chinese 理科中文 | 90 menit | 80 | 中文 saja | Program Mandarin: STEM, teknik, kedokteran |

Seluruhnya pilihan ganda, 100 poin per mata uji, tanpa kalkulator. Diselenggarakan **China
Scholarship Council**, wajib untuk beasiswa CSC sejak intake 2026, diperkirakan wajib bagi seluruh
pelamar S1 pada 2028.

**Yang tetap perlu kamu lakukan:** CSCA baru berjalan sejak Desember 2025 dan spesifikasinya masih
bisa berubah cepat. Cek `csca.cn` sebelum tiap musim, lalu perbarui `blueprints.ts` dan
`reference.ts`. Matriks mata uji per rumpun program studi di `/admin/referensi` adalah pola umum —
setiap universitas menetapkan syaratnya sendiri.

**Peluang pasar yang mungkin belum kamu lihat:** karena CSCA baru berumur beberapa bulan, hampir
belum ada penyedia latihan yang seriusnya setara. Ini satu-satunya dari empat ujian di aplikasi ini
yang belum punya pemain dominan.

## 9. Rencana 90 hari

| Minggu | Fokus |
|---|---|
| 1 | ~~Driver Supabase, waktu di server, webhook Midtrans, rate limiting~~ **sudah** — tinggal uji terhadap project Supabase & sandbox Midtrans sungguhan |
| 2 | Rate limit terdistribusi (Upstash), uji notifikasi ganda Midtrans, uji resume attempt |
| 3–4 | ~~Kebijakan privasi + T&C, penafian merek dagang~~ **sudah** — tinggal tinjauan pengacara dan verifikasi domain email |
| 3–8 | Produksi bank soal: 12 batch/minggu, dua guru peninjau, uji lapangan mulai minggu 5 |
| 5–6 | Buku catatan kesalahan, drill per-skill, ketahanan koneksi putus |
| 7–8 | Dashboard guru untuk B2B, pembuatan kelas, laporan |
| 9–10 | Proctoring tingkat 2–3, akomodasi waktu tambahan |
| 11 | Uji beban, try out akbar percobaan tertutup |
| 12–13 | Try out akbar publik pertama, kalibrasi `irtB` dari data nyata |

Satu hal yang saya sarankan **jangan** dilakukan lebih dulu: menambah ujian baru (IELTS, TOEFL,
GMAT). Empat ujian yang ada belum punya bank soal yang dalam, dan kedalaman satu ujian lebih laku
daripada kedangkalan tujuh ujian.
