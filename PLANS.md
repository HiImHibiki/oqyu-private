# PLANS.md — Keputusan Desain & Rencana Development

> Ringkasan cara kerja aplikasi, alasan di balik alurnya, analisis deploy, dan backlog.
> Keputusan baru dari sesi brainstorm WAJIB dicatat di sini. Eksekusinya dilacak
> bernomor di `TASKS.md`.
>
> Catatan: D1–D8 **direkonstruksi dari kode & riwayat commit** (24 Sep 2026) karena
> belum pernah didokumentasikan. Kalau ada yang keliru, betulkan dan tandai
> "(dikonfirmasi user, tanggal)".

## Gambaran alur besar

```
GURU                                   MURID / PEMBELI UMUM
Exact Worksheet (Mac)                  https://practice2.exactprintsolution.com
 topik/foto → Gemini → naskah → PDF      /latihan: cari kode ujian, bank soal acak
      │ Ke Practice (butir + nama PDF)    /ujian/[id]: kerjakan (jam server, autosave)
      ▼                                      │ Tanya guru → antrean Exact Canvas
POST /api/latihan/terbit ──► paket.json      ▼
   + soal masuk bank (approved)         /hasil/[id]: nilai + pembahasan
      │                                      │
/admin/latihan: cetak PDF, terbit/sembunyi   ▼
/admin/kelas: siapa sampai nomor berapa, nomor mana paling sering salah
```

## Keputusan desain (dengan alasan)

### D1. Practice = cabang Exact Try Out, bukan aplikasi baru
Mesin ujian (jam server, sanitasi kunci, skoring, proctoring, pembayaran, afiliasi) sudah
teruji di Try Out; Practice menambah jenis ujian `LATIHAN` dan modul `src/lib/practice/`.
**Konsekuensi:** banyak kode & dokumen warisan (SAT/UTBK/CSCA, Stripe/Midtrans, `docs/`)
yang tidak dipakai Exact Course tapi masih ikut ter-build. Lihat backlog B6.

### D2. Worksheet yang membuat soal, Practice hanya menerima
Otomasi Gemini lewat Chrome (tanpa API berbayar) sudah ada dan rapuh; Practice tidak
menulis ulangnya. Worksheet mendorong butir hasil `naskah.urai()` ke `/api/latihan/terbit`;
Practice mengubahnya jadi `Question` (`butirKeQuestion`). Soal esai/majemuk yang tidak
bisa dinilai otomatis dilewati (tercatat di `paket.dilewati`).

### D3. Kunci bersama, bukan sesi, untuk jalur Worksheet → Practice
Permintaan datang dari server, bukan peramban; dan di balik tunnel semua asal alamat tampak
localhost. Maka header `x-exact-kunci` dibandingkan waktu-konstan. Kunci disimpan Worksheet
di `practice.json` terpisah dari `setelan.json` (yang ditulis ulang borang — kunci pernah
hilang 14 Sep 2026).

### D4. Satu lembar multi-set → satu paket per set
Guru membagi kelas ("kiri kode A, kanan kode B"). Tiap set punya kode ujian 6 huruf sendiri
(tanpa 0/O/1/I agar aman dibacakan lewat WA). Terbit ulang lembar yang sama memperbarui.

### D5. Murid gratis & disetujui guru; umum bayar via transfer manual
Murid Exact Course masuk via akun Canvas (No. HP + sandi, atau token sesi dari halaman murid
Canvas) atau daftar dengan kode kelas → menunggu *Setujui* di `/admin/peserta`. Umum membeli
paket berjangka (1 minggu Rp20.000 / 1 bulan Rp60.000 / 3 bulan Rp150.000) lewat transfer +
konfirmasi WA; akun & sandi sementara lahir saat admin menandai lunas. **Alasan:** tanpa
payment gateway = tanpa biaya & verifikasi merchant; volume kecil cukup dikelola manual.

### D6. Mode berkas sebagai mode produksi (sementara)
Semua fitur khas Exact Course (D5, paket, sandi sementara) dibangun hanya untuk mode berkas.
**Alasan (dugaan):** jalan di satu Mac, cepat dibangun, tanpa biaya Supabase.
**Akibat:** tidak bisa dipindah ke platform serverless apa pun tanpa migrasi penyimpanan.

### D7. Satu Mac = satu instalasi lengkap (Worksheet + Canvas + Practice + domain sendiri)
`PASANG-MAC-BARU.md` (14 Sep 2026): data tiap Mac milik Mac itu; yang dibagi hanya kode di
GitHub. Tunnel per Mac (`pasang-tunnel.sh`).

### D8. Cetak PDF lewat Worksheet; render ulang bila PDF tidak ada di Mac ini
PDF lembar tinggal di Desktop Mac yang membuatnya. Bila paket diterbitkan dari Mac lain,
`/api/latihan/cetak` merender ulang dari bank lewat `/api/render` Worksheet.

## Deploy — analisis (24 Sep 2026)

**Pertanyaan user:** versi lama (ExactQuiz) di Vercel; apakah Cloudflare lebih lancar, dan
apakah perlu database terpisah atau semua bisa di Cloudflare?

### Fakta yang menentukan
1. Practice **sudah** di belakang Cloudflare (Tunnel dari Mac). Yang belum: menjalankan
   kodenya DI Cloudflare (Workers) sehingga tidak bergantung Mac menyala.
2. Mode berkas (produksi sekarang) menulis ke disk → **tidak bisa jalan di Workers maupun
   Vercel**. Pindah ke cloud = WAJIB database.
3. Worksheet **tidak bisa** ke cloud sama sekali: Python + Chrome kendali login Gemini +
   OCR Vision macOS + printer. Ia tetap di Mac.
4. Practice memanggil Worksheet (`127.0.0.1:7790`, tanpa auth) untuk: buat soal dari panel
   Practice, cetak PDF, potret HTML (gambar untuk Tanya guru). Dari cloud, 127.0.0.1 tidak
   terjangkau.
5. Practice memanggil Canvas (`../exact-canvas`, dicek 24 Sep 2026) lewat `EXACT_CANVAS_URL`.
   Dari cloud, bila URL itu diarahkan ke domain Tunnel Canvas: login murid
   (`/api/akun/masuk|saya`) dan Tanya guru (`/api/kelas/masuk|tanya`, PIN) **tetap bisa**.
   Yang putus hanya **sesi papan guru** (`/api/akun/sesi`) karena sengaja melayani loopback
   saja dan menolak permintaan ber-header proxy. Catatan: PIN lalu ikut lewat internet —
   harus 6–8 digit.
6. Arah sebaliknya (Worksheet → Practice `/terbit`) aman: cukup ganti URL ke domain publik.
7. Build Next.js hijau (Next 15.1.6). Cloudflare Workers menjalankan Next.js lewat adapter
   `@opennextjs/cloudflare` (+ `nodejs_compat`). Batas ukuran Worker (3 MB gratis / 10 MB
   berbayar, terkompresi) perlu diukur — kemungkinan butuh paket Workers Paid ($5/bln).
8. Pembatas laju (`ratelimit.ts`) berbasis memori proses — di Workers tiap isolate punya
   memori sendiri, jadi melemah. Perlu KV/Durable Object/Rate Limiting binding.

### Opsi
| | A. Status quo (Mac + Tunnel) | B. Hibrida: Practice di Workers + DB cloud, Worksheet & Canvas tetap di Mac |
|---|---|---|
| Kerja kode | nol | besar (penyimpanan baru + jembatan dibalik) |
| Mac harus menyala | ya, untuk semua | hanya untuk membuat soal & Tanya guru |
| Fitur yang terdampak | — | buat-soal-dari-Practice, cetak PDF, potret untuk Tanya guru (Worksheet); papan guru (Canvas) |
| Biaya | listrik Mac | Workers (±$5) + DB (Supabase free/pro atau D1) |

### Pilihan database untuk opsi B
- **Supabase (Postgres)** — driver `supabase.ts` + 15 migrasi + RLS sudah ada (warisan Try
  Out), ExactQuiz lama juga Supabase. Kurang: tabel paket, sandi sementara, auth
  email+sandi/kode kelas/Canvas (sekarang mode Supabase hanya Google OAuth).
- **Cloudflare D1 (SQLite)** — satu vendor, murah, latensi rendah dari Worker. Kurang: driver
  ketiga harus ditulis dari nol (~900 baris setara `dev.ts`), migrasi SQL ditulis ulang,
  auth sendiri. Tidak ada RLS.
- Rekomendasi awal Claude: **Supabase** (paling sedikit kode baru), dengan auth tetap cookie
  sendiri seperti mode berkas (bukan Supabase Auth) agar alur kode kelas & Canvas tidak
  berubah. Menunggu keputusan user (K1).

### Keputusan user (24 Sep 2026)
**K1 = A: tetap Mac + Cloudflare Tunnel.** K2–K3 tidak berlaku. User ingin memakai MacBook-nya
sendiri sebagai server dengan akun/domain Cloudflare sendiri → lihat D9.

### D9. Pengaturan Cloudflare/domain dipisah dari kode (24 Sep 2026, diminta user)
Domain (`practice2.`/`meet2.exactprintsolution.com`) dan nama tunnel masih tertanam di kode
(`src/lib/practice/canvas.ts`, `src/lib/exams/reference.ts`, `menubar/MenuBar.swift`, `.env.contoh`,
Canvas `src/tv/main.ts`). Tiap pemasang (Mac) harus bisa memakai akun & domain Cloudflare-nya
sendiri hanya dengan konfigurasi. Eksekusi: P-039 (↔ C-046).

### Keputusan yang dulu menunggu user (arsip)
- **K1.** Tetap di Mac + Tunnel (A), atau pindah ke Workers (B)? Bila B: Supabase atau D1?
- **K2.** Bila B: fitur yang menarik dari Worksheet — (a) buka Worksheet lewat Tunnel +
  tambah auth di Worksheet, atau (b) balik arah: Worksheet mengunggah PDF ke R2 saat terbit
  dan tombol "buat soal" di Practice dihapus (guru selalu dari Worksheet)?
- **K3.** Bila B: papan guru Canvas di halaman soal — tambah jalur `/api/akun/sesi` berkunci
  bersama di Canvas (perubahan kecil di `akun.rs`, lihat Canvas PLANS B2), atau nonaktifkan
  papan guru di versi cloud? (Login akun Canvas & Tanya guru tetap jalan lewat Tunnel.)
- **K4.** Fitur warisan Try Out yang tidak dipakai (SAT/UTBK/CSCA, Stripe/Midtrans, leaderboard,
  journey, demo) — dibuang atau dibiarkan?

## Backlog (rencana berikutnya)

- **B1. ✅ SELESAI (P-038).** ~~Keamanan dependensi (prioritas tinggi, tidak tergantung K1).~~ Next 15.1.6 + React
  19.0.0 terdampak CVE-2025-29927 (bypass middleware) dan CVE-2025-55182 / CVE-2025-66478
  (RCE React Server Components, Des 2025) — Practice memakai App Router, jadi terdampak. Naikkan ke rilis patch 15.x terbaru + React 19 patch, lalu typecheck/build/uji.
- **B2. ✅ SELESAI (P-032).** `test:exams` bisa jalan di clone bersih — buat user uji sendiri di `EXACT_DATA_DIR`
  sementara alih-alih membaca `users[0]` data yang ada.
- **B3. Satukan `.env.contoh` & `.env.example`** — satu berkas, dikelompokkan "wajib Exact
  Course" vs "opsional/warisan Try Out".
- **B4. CI GitHub Actions** — typecheck + build + test:webhooks + test:exams di tiap push.
- **B5. Migrasi penyimpanan** (bila K1 = B): tabel paket, sandi sementara, auth lokal di driver
  DB cloud; skrip migrasi data dari `db.json`/`paket.json`/`question-bank.json`.
- **B6. Pangkas warisan Try Out** (tergantung K4).
- **B7. Rate limit terdistribusi** (bila K1 = B).
- **B8. Adaptor Cloudflare** (bila K1 = B): `@opennextjs/cloudflare`, `wrangler.jsonc`,
  secrets, domain, ukur ukuran bundle.
