# Menjalankan Exact Try Out untuk pengguna internasional

Dokumen ini menjawab tiga pertanyaan yang hanya muncul saat aplikasi
benar-benar dipakai orang di luar satu negara: **di mana datanya disimpan**,
**apa yang wajib dipenuhi secara hukum**, dan **bagaimana membuktikan jalur
pembayarannya aman sebelum uang sungguhan lewat**.

---

## 1. Memilih region Supabase

Region ditetapkan saat proyek dibuat dan **tidak bisa diubah setelahnya** —
memindahkannya berarti membuat proyek baru lalu memigrasikan data. Karena itu
pilihannya perlu ditimbang sekali di depan.

Yang menentukan bukan lokasi tim pengembang, melainkan lokasi **peserta saat
ujian berlangsung**. Setiap penyimpanan jawaban, sinkronisasi jam server, dan
autosave adalah satu perjalanan bolak-balik ke database. Latensi 250 ms terasa
seperti aplikasi yang tersendat, dan itu terjadi di saat paling buruk: ketika
jam ujian sedang berjalan.

| Pasar terbesar | Region | Latensi kasar dari pasar itu |
| --- | --- | --- |
| Indonesia (UTBK) | `ap-southeast-1` Singapura | 20–40 ms |
| Tiongkok daratan (CSCA) | `ap-southeast-1` Singapura | 90–150 ms |
| Asia Timur (Jepang, Korea) | `ap-northeast-1` Tokyo | 20–50 ms |
| Asia Selatan (India) | `ap-south-1` Mumbai | 20–50 ms |
| Eropa + Timur Tengah | `eu-central-1` Frankfurt | 20–60 ms |
| Amerika Utara | `us-east-1` Virginia | 20–60 ms |

**Rekomendasi untuk peluncuran: `ap-southeast-1` (Singapura).**
Dua pasar terbesar produk ini — UTBK dan CSCA — sama-sama dilayani dengan baik
dari sana, dan Singapura adalah satu-satunya region yang tidak mengorbankan
salah satunya. Peserta SAT dan A Level di Eropa atau Amerika akan merasakan
tambahan 200–250 ms; itu terlihat pada waktu muat halaman, tetapi tidak pada
pengerjaan soal, karena isi ujian sudah dimuat lebih dulu dan autosave berjalan
di latar belakang.

Beberapa catatan yang sering terlewat:

- **Tiongkok daratan.** Supabase tidak punya region di sana, dan trafik ke luar
  melewati penyaringan yang tidak bisa kita kendalikan. Untuk CSCA dalam skala
  besar, uji lebih dulu dari jaringan sungguhan di sana sebelum berjanji apa pun
  soal keandalan.
- **Data pribadi warga Uni Eropa** boleh disimpan di luar UE, tetapi transfernya
  harus punya dasar hukum. Bila peserta Eropa menjadi bagian penting dari
  pengguna, region `eu-central-1` — atau proyek kedua khusus UE — menghapus
  seluruh pertanyaan itu sekaligus.
- **Ganti region tidak bisa dilakukan diam-diam.** Rencanakan sebagai migrasi:
  proyek baru, jalankan ulang migrasi `supabase/migrations/`, salin data,
  ubah `NEXT_PUBLIC_SUPABASE_URL`.

Jadwal pencadangan otomatis mengikuti paket Supabase; untuk data ujian
berbayar, paket gratis (tanpa PITR) tidak memadai.

---

## 2. Kepatuhan data pribadi (GDPR / UU PDP)

Yang sudah berjalan di kode, bukan sekadar dijanjikan di halaman kebijakan:

| Hak | Dasar | Di mana |
| --- | --- | --- |
| Akses & portabilitas | GDPR Art. 15 & 20, UU PDP Ps. 5–6 | `GET /api/privacy/export` → JSON |
| Penghapusan | GDPR Art. 17, UU PDP Ps. 8 | `POST /api/privacy/delete` |
| Bukti persetujuan | GDPR Art. 7(1) | kolom `profiles.consent` |
| Persetujuan cookie | ePrivacy Art. 5(3) | banner `CookieConsent` |

Tiga keputusan desain yang perlu diketahui sebelum mengubahnya:

1. **Penghapusan tidak menghapus catatan keuangan — ia menganonimkannya.**
   Kewajiban pembukuan dan perpajakan menuntut transaksi tetap tersimpan, dan
   GDPR Art. 17(3)(b) memang mengecualikannya. Yang dilakukan adalah melepas
   identitas dari pesanan (`orders.user_id → NULL`), bukan menghapus barisnya.
   Migrasi `0008_privacy.sql` yang membuat ini mungkin.
2. **Hanya satu cookie yang dimintakan izin.** Cookie sesi, bahasa, dan tema
   bersifat esensial dan tidak memerlukan persetujuan. Yang butuh izin hanya
   cookie rujukan afiliasi, karena ia mengikuti pengunjung 30 hari demi
   kepentingan komersial kita. Bila izin ditolak, kode rujukan tetap ikut di
   URL selama sesi itu — parameter navigasi bukan cookie — sehingga rujukan
   yang langsung mendaftar tetap terhitung.
3. **`LEGAL_VERSION` harus dinaikkan setiap kebijakan berubah secara
   material.** Persetujuan atas versi lama tidak berlaku untuk versi baru;
   tanpa penomoran ini, "pengguna sudah setuju" tidak bisa dibuktikan.

Sebelum menerima peserta dari Uni Eropa dalam jumlah berarti, masih perlu
dilengkapi oleh manusia, bukan oleh kode: **perwakilan di UE** (Art. 27, bila
tidak berbadan hukum di sana), **Data Processing Agreement** dengan Supabase
dan penyedia pembayaran, serta **peninjauan naskah kebijakan oleh pengacara**.
Naskah di `src/lib/legal.ts` sengaja mencantumkan sendiri bahwa ia draf.

---

## 3. Menguji jalur pembayaran

```bash
npm run test:webhooks
```

Menguji fungsi verifikasi yang sesungguhnya dipakai webhook produksi —
diimpor, bukan disalin — sehingga perubahan implementasi ikut teruji. Tidak
memerlukan kunci Stripe atau Midtrans dan berjalan offline.

Yang dibuktikan: tanda tangan sah diterima; payload yang diubah setelah
ditandatangani ditolak; tanda tangan dari kunci lain ditolak; notifikasi lama
(replay) ditolak; dan bila kunci belum diset, verifikasi **gagal** alih-alih
lolos diam-diam. Ditambah satu lapis lagi: nominal yang dibayar harus cocok
dengan pesanan tersimpan — tanda tangan sah hanya membuktikan pesan datang
dari gateway, bukan bahwa jumlahnya benar.

### Uji dengan akun sandbox sungguhan

Verifikasi lokal tidak membuktikan gateway benar-benar memanggil kita. Untuk
itu perlu sandbox:

**Stripe.** Ambil kunci uji di dashboard (mode Test), lalu:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# salin whsec_... yang tercetak ke STRIPE_WEBHOOK_SECRET
stripe trigger checkout.session.completed
```

Kartu uji: `4242 4242 4242 4242` (berhasil), `4000 0000 0000 9995` (ditolak
karena dana kurang), `4000 0025 0000 3155` (memerlukan 3D Secure).

**Midtrans.** Daftar sandbox, isi `MIDTRANS_SERVER_KEY`,
`MIDTRANS_CLIENT_KEY`, dan biarkan `MIDTRANS_IS_PRODUCTION` kosong. Webhook
lokal perlu URL publik (`ngrok http 3000`), lalu daftarkan
`https://…/api/webhooks/midtrans` di Settings → Configuration. Simulator kartu
sandbox ada di `simulator.sandbox.midtrans.com`.

Yang harus dipastikan pada kedua gateway: kuota **hanya** bertambah setelah
webhook masuk, tidak pernah dari respons browser; dan mengirim webhook yang
sama dua kali tidak menggandakan kuota (`fulfillOrder()` idempoten).

Tanpa kunci mana pun, aplikasi memakai jalur simulasi di
`/api/checkout/pay` — cukup untuk pengembangan, tidak boleh aktif di produksi.

---

## 4. Daftar periksa sebelum produksi

### 4a. Empat hal yang membuat aplikasi TERLIHAT jalan padahal belum

Keempatnya lolos `npm run build` tanpa satu pun peringatan, dan baru ketahuan
saat ada orang sungguhan memakainya. Periksa satu per satu sebelum membuka
akses ke siapa pun.

**1. Masih memakai database berkas, bukan Supabase.**
`usingDev()` di `src/lib/db/index.ts` bernilai `true` selama
`NEXT_PUBLIC_SUPABASE_URL` **atau** `SUPABASE_SERVICE_ROLE_KEY` kosong. Ketika
itu terjadi, seluruh akun, pesanan, dan hasil ujian ditulis ke `.data/db.json`
— berkas yang masuk `.gitignore`. Aplikasinya jalan mulus, sampai server
di-deploy ulang tanpa volume dan semuanya hilang tanpa jejak. Tidak ada pesan
galat apa pun yang memberitahukan hal ini.

Cara memastikan: buat satu akun uji, lalu cek tabel `profiles` di Supabase.
Kalau akunnya tidak muncul di sana, Anda masih memakai berkas.

**2. Tidak ada gateway pembayaran — pembeli mentok setelah checkout.**
Tanpa `MIDTRANS_SERVER_KEY` maupun `STRIPE_SECRET_KEY`, `/api/orders` tetap
berhasil membuat pesanan dan mengembalikan `gateway: "simulation"`. Tetapi
`/api/checkout/pay` sengaja menolak dengan 403 di produksi, karena kalau tidak
ia menjadi cara gratis memperoleh kuota. Akibatnya pembeli memperoleh nomor
pesanan yang tidak akan pernah bisa dibayar.

Ini bukan kerusakan yang perlu diperbaiki di kode — hanya konfigurasi yang
belum diisi. Tetapi bila dibiarkan, yang menanggung kebingungannya adalah
pembeli pertama Anda.

**3. `RESEND_API_KEY` kosong.**
Tidak lagi menghalangi siapa pun masuk: peserta masuk lewat Google, dan tidak
ada kode aktivasi yang perlu dikirim. Yang hilang hanyalah **struk pembelian
dan surat pengembalian dana** — `sendMail` mencatat kegagalannya sebagai
`console.error` dan alur pembeliannya tetap selesai.

Yang justru wajib diperiksa di tempatnya: **provider Google di Supabase**
(*Authentication → Providers*) dan **Redirect URLs** yang memuat
`https://domainmu.com/auth/callback`. Keduanya kosong berarti tidak ada
seorang pun yang bisa masuk sama sekali.

**4. `NEXT_PUBLIC_SITE_URL` kosong.**
`src/app/api/checkout/create/route.ts` memakainya untuk menyusun URL kembali
setelah pembayaran, dan jatuh ke `http://localhost:3000` bila kosong. Pembeli
yang selesai membayar di Midtrans atau Stripe akan dilempar ke alamat yang
tidak ada. Tautan undangan afiliasi (`src/lib/affiliate.ts`) memakai variabel
yang sama.

### 4b. Daftar periksa

- [ ] Region Supabase dipilih sadar (lihat bagian 1) dan PITR aktif
- [ ] Akun uji sungguhan muncul di tabel `profiles` Supabase, bukan di `.data/db.json`
- [ ] `RESEND_API_KEY` terisi dan satu surel uji benar-benar diterima
- [ ] `NEXT_PUBLIC_SITE_URL` menunjuk domain produksi ber-HTTPS
- [ ] Seluruh migrasi `supabase/migrations/0001`–`0015` sudah dijalankan
- [ ] `SUPABASE_SERVICE_ROLE_KEY` hanya ada di server, tidak pernah di klien
- [ ] `npm run test:webhooks` lulus
- [ ] Webhook sandbox Stripe dan Midtrans sudah diuji ujung ke ujung
- [ ] `MIDTRANS_IS_PRODUCTION=true` dan kunci produksi terpasang
- [ ] Naskah `src/lib/legal.ts` sudah ditinjau pengacara; `LEGAL_VERSION` sesuai
- [ ] Ekspor dan penghapusan data diuji dengan satu akun sungguhan
- [ ] Akun admin dibuat lewat `npm run make-admin`, bukan lewat pendaftaran biasa
- [ ] Bank soal tidak memuat satu pun soal past paper berhak cipta
