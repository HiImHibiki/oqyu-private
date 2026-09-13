# Setup

## 1. Jalankan lokal (tanpa konfigurasi)

```bash
npm install
npm run seed
npm run dev
```

`npm run seed` membangun `.data/question-bank.json` dari berkas sumber di `question-bank/` dan
`sample-tests/`. Berkas hasilnya tidak masuk git — ia besar dan sepenuhnya bisa dilahirkan ulang —
jadi di perangkat baru bank soal kosong sampai perintah ini dijalankan. Ulangi tiap kali menarik
perubahan soal dari perangkat lain.

Tanpa `.env.local`, aplikasi memakai **driver pengembangan**: seluruh data (pengguna, pesanan,
attempt, respons) disimpan di `.data/db.json`. Karena tidak ada project Supabase, masuk lewat Google
juga tidak ada — `/masuk` menampilkan kotak **Development sign-in**: isi email apa pun dan akun
lokalnya langsung jadi. Hapus `.data/` untuk mengosongkan semuanya.

## 2. Sambungkan Supabase

### 2.1 Buat project

1. Buat project baru di [supabase.com](https://supabase.com).
2. **Project Settings → API**, salin:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (**hanya di server**, jangan pernah di client)

```bash
cp .env.example .env.local
```

### 2.1b Pilih region

Region ditetapkan saat proyek dibuat dan **tidak bisa diubah** — memindahkannya berarti membuat
proyek baru lalu memigrasikan data. Yang menentukan bukan lokasi tim, melainkan lokasi peserta saat
jam ujian berjalan. Pertimbangan lengkapnya di [`DEPLOY.md`](DEPLOY.md#1-memilih-region-supabase);
rekomendasi untuk peluncuran: **`ap-southeast-1` (Singapura)**.

### 2.2 Jalankan migrasi

SQL Editor → jalankan berurutan:

| urutan | berkas | isi |
|---|---|---|
| 1 | `supabase/migrations/0001_schema.sql` | tabel, enum, trigger profil otomatis |
| 2 | `supabase/migrations/0002_rls.sql` | Row Level Security |
| 3 | `supabase/migrations/0003_views.sql` | view leaderboard, RPC ringkasan |
| 4 | `supabase/migrations/0004_attempt_runtime.sql` | kolom tenggat waktu, trigger pengunci kolom, statistik butir |
| 5 | `supabase/migrations/0005_affiliate_admin.sql` | tabel afiliasi, komisi, pencairan, RPC ringkasan admin |
| 6 | `supabase/migrations/0006_form_layout.sql` | susunan paket dibekukan pada attempt |
| 7 | `supabase/migrations/0007_international.sql` | mata uang, negara, zona waktu, bahasa |
| 8 | `supabase/migrations/0008_privacy.sql` | rekaman persetujuan, pesanan boleh yatim setelah akun dihapus |
| 9 | `supabase/migrations/0009_question_review.sql` | jejak tinjauan soal (siapa, kapan, putusan, catatan) |
| 10 | `supabase/migrations/0010_adaptive_routing.sql` | varian modul adaptif SAT yang dipilih server |
| 11 | `supabase/migrations/0011_erasure_financial.sql` | penghapusan akun menyisakan catatan keuangan |
| 12 | `supabase/migrations/0012_time_accommodation.sql` | pengali waktu ujian per peserta |
| 13 | `supabase/migrations/0013_essay_marking.sql` | antrean penilaian esai dan rubriknya |
| 14 | `supabase/migrations/0014_affiliate_currency.sql` | komisi tidak lagi dijumlahkan lintas mata uang |
| 15 | `supabase/migrations/0015_coupons.sql` | jejak kupon pada pesanan (`coupon_code`, `discount`) |

Migrasi ke-8 membuat `orders.user_id` boleh `NULL` dan mengubah foreign key-nya menjadi
`on delete set null`. Itu bukan kelalaian: penghapusan akun **menganonimkan** pesanan alih-alih
menghapusnya, karena kewajiban pembukuan menuntut transaksi tetap tersimpan. Tanpa migrasi ini,
`POST /api/privacy/delete` akan gagal di tengah jalan pada Supabase.

Atau dengan CLI:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

### 2.3 Masuk lewat Google

Peserta hanya punya satu cara masuk, dan inilah yang perlu disiapkan.

**a. Buat OAuth client di Google.** [console.cloud.google.com](https://console.cloud.google.com) →
*APIs & Services* → *Credentials* → **Create credentials → OAuth client ID** → tipe **Web
application**.

- *Authorized JavaScript origins*: `https://domainmu.com` (dan `http://localhost:3000` untuk uji)
- *Authorized redirect URIs*: **`https://<ref>.supabase.co/auth/v1/callback`**

URI kembalinya menunjuk ke **Supabase**, bukan ke aplikasi ini. Ini bagian yang paling sering salah:
Google memulangkan pengguna ke Supabase, Supabase-lah yang kemudian memanggil `/auth/callback` milik
aplikasi. Alamat persisnya tertulis di dasbor Supabase pada langkah berikutnya.

**b. Nyalakan providernya di Supabase.** *Authentication → Providers → Google*: tempelkan **Client
ID** dan **Client Secret** dari langkah (a), lalu simpan.

**c. Daftarkan URL kembali aplikasi.** *Authentication → URL Configuration*:

```
Site URL       https://domainmu.com
Redirect URLs  https://domainmu.com/auth/callback
               http://localhost:3000/auth/callback
```

Tanpa baris ini, Supabase menolak memulangkan pengguna dan alurnya berhenti dengan «redirect_uri
mismatch» — galat yang bunyinya menuduh Google padahal yang kurang ada di sini.

**d. Pastikan `NEXT_PUBLIC_SITE_URL` benar.** Alamat kembali dibangun dari variabel ini, bukan dari
host permintaan — di belakang proxy, host permintaan bisa saja alamat internal yang tidak bisa
dijangkau peramban.

Tidak ada yang perlu disiapkan untuk email: **tidak ada kode OTP yang dikirim.** `RESEND_API_KEY`
hanya dipakai untuk struk pembelian dan surat pengembalian dana, dan boleh dikosongkan.

### 2.4 Buat akun admin

Tiga cara, pilih salah satu:

**a. Sebelum mendaftar** — isi `.env.local`, lalu masuk lewat Google seperti biasa; akun dengan
email di daftar ini langsung berperan `admin` pada masuk pertamanya:

```
ADMIN_EMAILS=kamu@domain.com,rekan@domain.com
```

**b. Setelah mendaftar** — jalankan skrip:

```bash
npm run make-admin -- kamu@domain.com
npm run make-admin -- rekan@domain.com reviewer
```

**c. Langsung di SQL Editor:**

```sql
update public.profiles set role = 'admin' where email = 'kamu@domain.com';
```

Panel admin ada di **`/admin`**, dan penjaganya adalah peran akun — bukan cara masuknya. Sesi dari
Google sudah cukup: admin yang sudah masuk sebagai peserta tinggal membuka `/admin`.

**`/admin/masuk`** tetap ada sebagai jalur cadangan berkata sandi, untuk keadaan ketika OAuth Google
sedang tidak bisa dipakai — kunci klien kedaluwarsa, domain belum diizinkan, akun Google tim
terkunci. Kata sandinya dibuat dari `/pengaturan` oleh akun yang sudah berperan admin; kolom itu
memang hanya muncul untuk admin.

| peran | bisa |
|---|---|
| `student` | hanya sisi peserta |
| `reviewer` | membaca panel admin dan tabel `questions` (untuk meninjau soal) |
| `admin` | semua, termasuk mengubah peran, menyetujui komisi, dan memproses pencairan |

Akun admin tidak bisa mengubah perannya sendiri — penjaga supaya admin terakhir tidak mengunci
dirinya di luar panel.

## 3. Pembayaran

Tiga jalur, dan **tidak ada yang wajib**. Yang kunci atau rekeningnya kosong tidak muncul sebagai
pilihan — lebih baik daripada menawarkan tombol yang pasti gagal.

### 3.1 Transfer bank manual — jalur paling sederhana

Tidak butuh pendaftaran merchant, tidak butuh webhook, dan bisa hidup dalam lima menit. Isi
`.env.local`:

```
NEXT_PUBLIC_BANK_NAME=BCA
NEXT_PUBLIC_BANK_ACCOUNT=1234567890
NEXT_PUBLIC_BANK_HOLDER=PT Exact Group Indonesia
NEXT_PUBLIC_ADMIN_WHATSAPP=+6281234567890
NEXT_PUBLIC_ADMIN_EMAIL=admin@domainmu.com      # opsional
```

Dua yang pertama menentukan apakah pilihan «Transfer bank» muncul sama sekali. Semuanya
`NEXT_PUBLIC_` karena memang harus tampil di layar pembeli — tidak ada rahasia di sini.

Alurnya:

1. Pembeli memilih paket di `/paket` lalu memilih **Transfer bank**. Pesanan dibuat berstatus
   `pending` dengan `provider = "manual"`.
2. Layarnya menampilkan bank, nomor rekening, nominal persis, dan **kode pesanan** (`EX-XXXXXXXX`)
   yang harus ditulis di berita transfer — masing-masing dengan tombol salin.
3. Tombol **Kirim bukti lewat WhatsApp** membuka chat ke admin dengan pesan yang sudah terisi:
   kode pesanan, paket, dan nominal. Pembeli tinggal melampirkan bukti transfernya.
4. Admin membuka **`/admin/pesanan`**, mencocokkan kode dan nominalnya dengan mutasi rekening, lalu
   menekan **Tandai lunas**.

Langkah 4 melewati `fulfillOrder()` yang sama dengan webhook, jadi struk, komisi afiliasi, dan kuota
bonus rujukan mengikuti persis seperti pembayaran otomatis — dan menekannya dua kali tidak
menggandakan kuota siapa pun. Hanya peran `admin` yang boleh; `reviewer` tidak punya urusan dengan
uang.

Pesanan yang menunggu tidak hilang: `/paket` menampilkan kembali instruksi transfernya berapa pun
umurnya, dan `/admin/pesanan` menandainya di atas halaman.

### 3.2 Midtrans — otomatis untuk rupiah

Integrasinya **sudah terpasang**. Yang perlu kamu lakukan hanya mengisi kunci dan mendaftarkan URL
webhook.

1. Daftar di [midtrans.com](https://midtrans.com), ambil Server Key & Client Key (sandbox dulu).
2. Isi di `.env.local`:

```
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxx
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false
```

3. Dashboard Midtrans → **Settings → Configuration → Payment Notification URL**:

```
https://domainmu.com/api/webhooks/midtrans
```

4. Uji dengan **Simulator Sandbox** Midtrans, atau bayar memakai kartu uji
   `4811 1111 1111 1114` (OTP `112233`).

### 3.3 Stripe — pembayaran internasional

Midtrans hanya melayani rupiah dengan metode lokal Indonesia, sehingga peserta di luar Indonesia
tidak bisa memakainya sama sekali. Setiap mata uang selain IDR dirutekan ke Stripe.

1. Ambil kunci di [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys), lalu isi:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

2. Dashboard Stripe → **Developers → Webhooks** → tambahkan endpoint:

```
https://domainmu.com/api/webhooks/stripe
```

dengan event **`checkout.session.completed`**, **`charge.refunded`**, dan
**`checkout.session.expired`**. Salin *signing secret*-nya ke `STRIPE_WEBHOOK_SECRET`.

Event kedua itu penting: tanpa berlangganan `charge.refunded`, refund yang dilakukan dari dasbor
Stripe tidak sampai ke aplikasi, sehingga uang kembali ke pembeli sementara kuotanya tetap utuh
dan komisi afiliasinya tetap tertagih.

3. Uji lokal dengan Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

Webhook Stripe memeriksa empat hal berurutan, semuanya wajib lolos: signature HMAC-SHA256 atas
`"<timestamp>.<raw body>"`, umur notifikasi (menolak yang lebih tua dari 5 menit untuk menutup replay
attack), nominal terhadap `amount_total`, dan mata uang terhadap pesanan.

### Bagaimana alurnya dijaga

| berkas | perannya |
|---|---|
| `/api/checkout/create` | memilih gateway dari mata uang pesanan, lalu membuat sesi pembayaran |
| `/api/webhooks/midtrans` | pemberi kuota untuk pembayaran rupiah |
| `/api/webhooks/stripe` | pemberi kuota untuk seluruh mata uang lain |
| `/api/checkout/status` | halaman paket menunggu webhook tiba (polling 3 detik) |
| `/api/admin/orders/confirm` | admin menyatakan transfer bank sudah masuk; hanya peran `admin` |
| `/api/checkout/pay` | simulasi; **otomatis 403** begitu `MIDTRANS_SERVER_KEY` terisi atau `NODE_ENV=production` |
| `src/lib/checkout.ts` | `fulfillOrder()` — idempoten, dipakai keempat jalur |
| `src/lib/payment.ts` | rekening, kontak admin, dan rumus kode pesanan `EX-XXXXXXXX` |

Webhook memeriksa tiga hal berurutan, dan semuanya wajib lolos:

1. **Signature** `sha512(order_id + status_code + gross_amount + serverKey)`, dibandingkan dengan
   `crypto.timingSafeEqual`.
2. **Nominal** — `gross_amount` harus sama dengan `amount_idr` pesanan. Ini menutup celah notifikasi
   yang nominalnya diubah.
3. **Status** — hanya `settlement`, atau `capture` yang `fraud_status`-nya bukan `challenge`/`deny`.

Notifikasi ganda aman: `markOrderPaid()` memakai update bersyarat `status = 'pending'`, jadi kuota
tidak pernah diberikan dua kali.

## 3b. Waktu ujian

Tenggat tiap subtes disimpan di `attempts.section_deadlines` sebagai timestamp absolut, ditetapkan
saat siswa menekan "Mulai ujian" dan **tidak pernah bisa diperpanjang** — trigger
`guard_section_deadlines` menolak perubahannya bahkan lewat service-role.

Browser hanya menampilkan hitung mundur, lalu mencocokkan ulang ke `/api/attempts/[id]/state` setiap
20 detik dan setiap kali tab kembali aktif. Jawaban yang tiba setelah tenggat (+10 detik toleransi
jaringan) ditolak `/save` dengan HTTP 409, dan diabaikan lagi saat `/submit`.

Tidak ada yang perlu dikonfigurasi; pastikan saja jam server benar (di Vercel sudah otomatis).

## 3c. Program afiliasi

Tidak ada konfigurasi wajib; angkanya ada di `src/lib/affiliate.ts`:

| tetapan | nilai | arti |
|---|---|---|
| `defaultRate` | 0,15 | komisi 15% dari nilai paket |
| `minPayoutIdr` | 100.000 | batas minimum pencairan |
| `holdDays` | 14 | masa tahan komisi sebelum bisa disetujui (menutupi masa refund) |
| `cookieDays` | 30 | berapa lama tautan rujukan diingat browser |
| `refereeBonusAttempts` | 1 | kuota bonus untuk yang diajak, di pembelian pertamanya |

Alurnya:

```
/r/KODE  -> catat klik, set cookie 30 hari, lempar ke /daftar
/daftar  -> cookie mengikat pendaftar ke kode (sekali seumur akun)
webhook  -> fulfillOrder() membuat komisi `pending` + kuota bonus
admin    -> setujui komisi setelah 14 hari, lalu proses pencairan
```

Penjaga yang sudah terpasang, semuanya diuji:

- merujuk diri sendiri ditolak (`affiliate.userId === buyerId`)
- satu akun hanya bisa terikat ke satu kode, selamanya
- komisi unik per `order_id`, jadi notifikasi webhook ganda tidak menggandakannya
- kuota bonus hanya untuk pesanan pertama
- pencairan di bawah minimum ditolak, dan menandai pencairan lunas otomatis menutup komisi senilai itu

Komisi kini dibatalkan otomatis saat pesanan direfund — lihat bagian berikutnya.

## 3d-bis. Pengembalian dana

Ketentuan Layanan menjanjikan pengembalian penuh **dalam 14 hari sejak pembayaran, sepanjang
pembeli belum memulai lebih dari satu try out**. Janji itu kini punya pelaksananya.

**Uangnya dikembalikan lewat dasbor gateway**, bukan dari aplikasi ini — Midtrans dan Stripe
memegang kredensial refund, dan aplikasi sengaja tidak. Yang ditangani aplikasi adalah
pembukuannya, dan itu ada tiga hal yang harus terjadi bersama-sama:

1. status pesanan menjadi `refunded`;
2. **sisa** kuota dicabut — yang sudah terpakai tidak diutak-atik, sehingga riwayat attempt
   peserta tetap utuh dan dapat ditelusuri;
3. komisi afiliasi atas pesanan itu dibatalkan (`void`).

Dua jalan masuk:

| Jalan | Kapan dipakai |
|---|---|
| Webhook Stripe `charge.refunded` | Otomatis. Wajib didaftarkan di dasbor Stripe. |
| Webhook Midtrans `transaction_status: refund` | Otomatis. Tidak perlu pendaftaran terpisah — URL webhooknya sama. |
| Tombol **Refund** di `/admin/pesanan` | Refund di luar gateway, dan pesanan Stripe lama yang charge-nya belum membawa `order_id`. |

Syarat dari Ketentuan diperiksa di server (`src/lib/refunds.ts`), satu tempat saja. Bila tidak
memenuhi syarat, tombolnya menolak dan menyebutkan alasannya — «sudah lewat 14 hari», «peserta
sudah memulai lebih dari 1 try out». Admin tetap boleh melanjutkan dengan menekan sekali lagi;
tindakan itu tercatat di log sebagai keputusan di luar syarat, bukan sebagai syarat yang
dilonggarkan diam-diam.

Dua hal yang **tidak** dilakukan otomatis, dan keduanya disengaja:

- **Refund sebagian** tidak mencabut kuota. Berapa try out yang setara dengan sebagian uang
  adalah keputusan manusia, bukan aturan yang pantas dikarang di kode.
- **Komisi yang sudah dibayar** tidak dibatalkan. Uangnya sudah keluar; membatalkannya hanya akan
  membuat saldo afiliasi tidak cocok dengan yang benar-benar ditransfer. Penagihan kembali adalah
  urusan manual yang harus terlihat.

Hanya peran `admin` yang boleh, bukan `reviewer` — peninjau soal tidak punya urusan dengan uang.

### Pesanan yang tidak jadi dibayar

Notifikasi Midtrans `expire`, `cancel`, `deny`, dan `failure` kini **menutup** pesanan —
`expire` menjadi `expired`, sisanya menjadi `failed`. Sebelumnya notifikasi itu hanya dicatat di
log dan pesanan tetap `pending` selamanya, sehingga banner «pembayaran belum selesai» di dashboard
peserta terus menagih orang untuk virtual account yang sudah mati berbulan-bulan.

Stripe setara: `checkout.session.expired` menutup pesanan yang ditinggalkan di halaman pembayaran
(sesi Stripe mati setelah 24 jam).

Penutupan hanya berlaku dari `pending`: notifikasi `deny` atau `checkout.session.expired` yang
datang terlambat tidak dapat menurunkan pesanan yang sudah lunas. Ini diuji, bukan diandaikan.

Untuk pesanan yang gatewaynya tidak pernah mengabarkan apa pun — pembeli menutup tab sebelum
halaman pembayaran terbuka — ada penyapu berkala:

```bash
npm run close-stale-orders                    # laporan saja, ambang 14 hari
npm run close-stale-orders -- --days 30        # ambang lain
npm run close-stale-orders -- --days 30 --write
```

Skrip ini sengaja **tidak** otomatis. Tombol «Lanjutkan pembayaran» di `/paket` membuat sesi
gateway baru setiap kali ditekan, jadi pesanan lama secara teknis masih bisa dibayar. Menutupnya
adalah pilihan kerapian yang berhak diambil pemilik toko, bukan oleh cron yang diam-diam
berjalan — sama seperti pemisahan «tenggat habis» dan «basi» pada `finalize-abandoned.mjs`.

Satu catatan tentang pemeriksaan nominal. `gross_amount` dicocokkan **hanya** pada notifikasi
pelunasan — di situlah kuota diberikan, dan di situlah selisih nominal berbahaya. Notifikasi
refund dan kegagalan tidak memberi apa pun, dan menolaknya karena selisih nominal hanya akan
membuat Midtrans mengulang kiriman yang tidak akan pernah diterima. Keasliannya sudah dijamin
signature.

### Bahasa surat transaksional

Struk pembayaran dan pemberitahuan pengembalian dana mengikuti **bahasa yang dipilih pembeli**
(`profiles.locale`), bukan bahasa pemilik toko — termasuk format mata uangnya: `Rp 249.000` untuk
pembeli Indonesia, `$19.00` untuk pembeli Amerika, `¥249.00` untuk pembeli Tiongkok. Aplikasi ini
menjual SAT ke Nigeria dan CSCA ke Kazakhstan; struk berbahasa Indonesia yang dikirim ke sana
adalah pesan bahwa pembelinya tidak benar-benar diperhitungkan.

Teksnya ada di `src/lib/i18n/dictionaries.ts` bersama seluruh teks antarmuka, sehingga TypeScript
menolak kompilasi bila satu bahasa terlewat — jaminan yang sama yang sudah dinikmati antarmuka.

Tidak ada surat OTP: peserta masuk lewat Google, jadi satu-satunya surat yang dikirim aplikasi ini
adalah struk dan pemberitahuan pengembalian dana.

## 3e. Kupon

Daftar kupon ada di `src/lib/coupons.ts`, bukan di basis data — kampanye harga pantas ikut
ter-review bersama kode, dan jumlahnya sedikit. Kosongkan `COUPONS` untuk mematikan semua promo.

| kolom | arti |
|---|---|
| `code` | kode yang diketik pembeli (huruf besar, tanpa spasi) |
| `percentOff` | potongan persen (maksimum 70) |
| `amountOff` | potongan tetap **per mata uang**; mata uang yang tidak terdaftar berarti tidak berlaku |
| `endsAt` | tanggal berakhir — sebaiknya selalu diisi, diskon tanpa akhir adalah harga baru |
| `packages` / `exams` | membatasi kupon ke paket atau ujian tertentu |
| `maxRedemptions` | batas jumlah pesanan **lunas** yang boleh memakai kode ini |
| `firstPurchaseOnly` | hanya untuk pembeli yang belum pernah punya pesanan lunas |

Aturan yang dijaga kode:

- Potongan dihitung **di server**, dari harga paket di server. Peramban hanya mengirim kodenya —
  kalau peramban boleh mengirim nominalnya, harga menjadi milik pembeli.
- Pembulatan selalu ke bawah (rupiah ke ribuan terdekat), jadi selisih pembulatan menjadi milik
  pembeli, bukan milik kita.
- Ada batas bawah nominal tagihan per mata uang (`MIN_TOTAL`) supaya gateway tidak menerima
  tagihan yang terlalu kecil untuk diproses.
- `maxRedemptions` dihitung dari pesanan yang **lunas**. Kalau pesanan pending ikut dihitung, satu
  orang bisa menghabiskan kuota kampanye hanya dengan membuka halaman checkout.
- Kupon terkunci begitu pesanan dibuat: nominal yang dikirim ke gateway adalah nominal pesanan itu.
- `/api/coupons/validate` dibatasi 20 percobaan per 10 menit per IP — kode enam huruf bisa disisir
  dari satu peramban dalam hitungan menit.

Jejaknya tersimpan di `orders.coupon_code` dan `orders.discount` (migrasi 0015). `orders.amount`
tetap berarti **nominal yang ditagih**, sudah bersih dari potongan, jadi laporan pendapatan yang
lama tidak berubah artinya — dan komisi afiliasi ikut dihitung dari nominal setelah potongan.

## 4. Deploy

Vercel adalah jalur termudah:

```bash
npx vercel
```

Isi environment variable yang sama di dashboard Vercel. Catatan penting:

- Driver pengembangan **tidak berfungsi di Vercel** (filesystem baca-saja). Supabase wajib
  dikonfigurasi sebelum deploy.
- `SUPABASE_SERVICE_ROLE_KEY` ditandai sebagai server-only (tanpa awalan `NEXT_PUBLIC_`).
- Atur `NEXT_PUBLIC_SITE_URL` ke domain produksi agar tautan di email benar.

## 3d. Akses internasional

Tidak ada yang perlu dikonfigurasi — sudah aktif. Yang perlu kamu ketahui:

**Bahasa.** Antarmuka tersedia dalam English, Bahasa Indonesia, dan 简体中文. Bahasa ditentukan
berurutan: cookie pilihan pengguna → header `Accept-Language` browser → **English**. Bahasa Inggris
sengaja menjadi default, bukan Indonesia: pengunjung dari negara mana pun harus memahami halaman
pertama yang ia lihat.

Kamusnya ada di `src/lib/i18n/dictionaries.ts`. `en` adalah acuan — TypeScript **menolak kompilasi**
kalau ada kunci yang belum diterjemahkan ke `id` atau `zh`, sehingga teks yang hilang tidak mungkin
lolos ke produksi.

**Panel admin sengaja tetap berbahasa Indonesia.** Penggunanya tim operasional Exact, bukan peserta
internasional, dan menerjemahkannya hanya menambah beban perawatan tanpa manfaat.

**Mata uang.** Ditetapkan dari negara yang dipilih peserta saat mendaftar, dengan harga tersendiri
per mata uang di `src/lib/packages.ts` — bukan hasil konversi kurs harian. Sebelum peserta memilih
negara, halaman depan menampilkan mata uang yang ditebak dari bahasa (id → IDR, zh → CNY, sisanya
USD).

Paket UTBK ditandai `indonesiaOnly` dan otomatis disembunyikan dari pengunjung berma­ta uang lain,
supaya daftar harga tidak memuat produk yang tidak relevan bagi mereka.

**Nomor telepon.** Divalidasi terhadap negara yang dipilih dan disimpan dalam format E.164
(`+2348031234567`). Nomor lokal berawalan nol tetap diterima dan dinormalkan otomatis, karena hampir
semua orang mengetikkannya begitu.

**Zona waktu.** Tanggal dan jam diformat dengan `Intl` mengikuti bahasa yang dipilih. Jam ujian
sendiri memakai timestamp absolut di server, jadi zona waktu peserta tidak memengaruhi durasinya.

**Soal bilingual.** Soal CSCA yang punya `i18n.zh` otomatis ditampilkan dalam bahasa antarmuka
peserta — mahasiswa Tiongkok melihat 中文, pelamar dari Nigeria melihat English, tanpa perlu memilih
apa pun.

## 4b. Kunci API pembuat soal

Panel `/admin/soal` bisa memanggil tiga penyedia. Isi yang kamu pakai saja di `.env.local`:

```
ANTHROPIC_API_KEY=      # Claude   - console.anthropic.com/settings/keys
GOOGLE_API_KEY=         # Gemini   - aistudio.google.com/apikey
OPENAI_API_KEY=         # ChatGPT  - platform.openai.com/api-keys
```

Jalankan ulang server setelah mengisinya. Penyedia yang kuncinya kosong tampil nonaktif, tetapi
tombol **Salin prompt** tetap berfungsi — kamu bisa menempelkannya di aplikasi chat berlangganan
tanpa kunci API sama sekali.

| | Claude | Gemini | ChatGPT |
|---|---|---|---|
| Model bawaan | `claude-opus-5` | `gemini-2.5-pro` | `gpt-5` |
| Gambar | ya | ya | ya |
| PDF | ya | ya | ya |
| Cara dipanggil | SDK resmi `@anthropic-ai/sdk` (streaming) | REST `generateContent` | REST Responses API |

Kunci hanya dibaca di sisi server dan tidak pernah dikirim ke browser — panel hanya menerima
informasi penyedia mana yang sudah terisi. Pembuatan dibatasi **20 kali per jam per admin** supaya
satu klik beruntun tidak menghabiskan kuota API.

Perhatikan: lampiran (screenshot/PDF) hanya ikut pada jalur **Buat soal**. Tombol **Salin prompt**
menyalin teks saja — lampirkan berkasnya manual di aplikasi chat.

## 5. Isi bank soal

Dua jalur, hasilnya sama:

**Lewat panel** — `/admin/soal` → *Impor soal dari JSON* → tempel keluaran AI → pilih status →
**Impor**. Validasi berjalan otomatis; soal ber-BLOCKER tidak masuk dan temuannya ditampilkan
per soal. Setelah ditinjau, centang soalnya lalu tekan **Setujui**.

**Lewat terminal:**

```bash
npm run validate batch-01.json -- --strict
npm run import   batch-01.json -- --status in_review
```

Lalu setujui di `/admin/soal`, atau langsung di SQL:

```sql
update public.questions set status = 'approved', reviewed_at = now()
where id in ('utbk-pk-0142', ...);
```

Empat status: `draft` → `in_review` → `approved` → `retired`. **Hanya `approved` yang dipakai
menyusun paket.** Memensiunkan soal tidak merusak attempt lama — susunan paketnya sudah dibekukan.

### 5.1 Bagaimana guru meninjau kunci jawaban

Buka `/admin/soal`, lalu **klik soal mana pun**. Panel tinjauan menampilkan hal-hal
yang tidak pernah dikirim ke halaman peserta:

- stimulus, gambar, dan stem lengkap;
- **seluruh opsi dengan kunci ditandai hijau**;
- pembahasan;
- alasan tiap pengecoh;
- untuk CSCA, versi 中文 disandingkan agar terjemahannya ikut terperiksa.

Dua putusan tersedia:

| Putusan | Akibat |
|---|---|
| **Kunci benar — setujui** | status jadi `approved`, `meta.reviewed` jadi `true` |
| **Ada yang keliru — kembalikan** | status jadi `in_review`, soal langsung keluar dari bank aktif |

Pengembalian **wajib disertai alasan**. Tanpa itu penulis tidak tahu apa yang harus
diperbaiki, dan soal yang sama akan kembali lagi. Setiap putusan menyimpan email
peninjau dan waktunya, sehingga saat ada soal keliru lolos ke ujian berbayar,
riwayatnya dapat ditelusuri.

Peran `reviewer` bisa mengembalikan soal tetapi **tidak** bisa menyetujui — hanya
`admin` yang bisa. Ini memisahkan yang menulis dari yang meloloskan.

### 5.2 Dari mana memulai — antrean tinjauan

Meninjau 647 soal menurut urutan id berarti soal paling berbahaya baru tersentuh
berminggu-minggu kemudian. `/admin/tinjauan` membalik urutannya: soal yang
kekeliruannya paling mungkin **lolos tanpa disadari** naik ke atas.

Skornya menjumlahkan sinyal, dan setiap sinyal menjelaskan alasannya saat
ditunjuk — supaya peninjau tahu apa yang harus dicurigai, bukan sekadar melihat
angka:

| Sinyal | Bobot | Mengapa berisiko |
|---|---|---|
| pernah dikembalikan | 40 | perbaikannya belum diperiksa |
| hitungan panjang | 30 | satu salah tanda di tengah tetap terlihat masuk akal |
| angka kunci tak muncul | 30 | pola khas kunci diubah tanpa pembahasan ikut diubah |
| isian angka | 25 | tidak ada opsi yang bisa menjadi pemeriksa silang |
| rubrik | 25 | penilaian uraian butuh guru mata pelajaran |
| dwibahasa | 20 | terjemahan bisa menggeser makna atau membocorkan kunci |
| bergambar | 20 | angka di gambar dan di pembahasan harus cocok |
| ada hitungan | 15 | perlu diperiksa langkah demi langkah |
| sulit | 12 | langkahnya halus, dan salahnya lebih merugikan |
| pengecoh tanpa alasan | 10 | pengecoh tanpa alasan sering ternyata tidak salah |

**Skor tinggi bukan berarti soal itu keliru** — hanya berarti kalau ia keliru,
kekeliruannya lebih sulit terlihat. Bobot di atas adalah pertimbangan, bukan hasil
pengukuran; setelah ada data soal mana yang benar-benar dikembalikan, bobotnya
perlu dikalibrasi ulang terhadap kenyataan.

Soal yang sudah disetujui otomatis keluar dari antrean. Bilah kemajuan di atas
halaman menunjukkan berapa persen bank yang sudah benar-benar disentuh manusia —
angka itu **0% sampai guru mulai bekerja**, dan tidak boleh dinaikkan dengan cara
lain.

Yang perlu diperiksa manusia dan tidak bisa diperiksa validator:

1. kunci benar secara faktual;
2. seluruh pengecoh benar-benar salah — bukan sekadar kurang tepat;
3. pembahasan sungguh menjelaskan *mengapa*, bukan mengulang jawabannya;
4. untuk soal dwibahasa, terjemahan tidak mengubah makna atau membocorkan kunci.

Target minimum sebelum berjualan:

| Ujian | Soal `approved` minimum | Alasan |
|---|---|---|
| UTBK | 1.550 (10 paket × 155) | paket tidak boleh mengulang soal antar-percobaan |
| SAT | 800 (4 form × 2 modul × 2 varian) | modul adaptif butuh varian mudah **dan** sulit |
| CSCA | 640 (4 paket × 160) | bilingual, jadi bebannya dua kali lipat |
| A Level | 200 per subject | paper lebih sedikit soal tapi lebih berat |
