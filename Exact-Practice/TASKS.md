# TASKS.md — Riwayat Tugas Bernomor (Exact Practice)

> ✅ selesai · 🔄 berjalan · ⬜ direncanakan · ❌ dibatalkan.
> **Aturan:** tiap tugas selesai ditambahkan di bawah dengan nomor berurut (`P-xxx`),
> satu baris ringkas. Nomor dipakai sebagai prefix commit git (`P-xxx: deskripsi`) supaya
> riwayat & rollback bersih — satu task = satu commit (atau satu rangkaian commit).
> Tugas yang juga menyentuh Exact Worksheet: sebut nomor pasangannya (`↔ W-xxx`).
> Latar keputusan ada di `PLANS.md`; panduan kerja di `AGENTS.md`.
>
> P-001 s/d P-029 direkonstruksi dari `git log` (commit lama belum berprefix nomor).

## Fondasi (14 Sep 2026)
- ✅ P-001 Cabang awal dari Exact Try Out
- ✅ P-002 Exact Practice: paket latihan, buat soal via Worksheet, ujian tanpa kuota, tanya guru ke Canvas, pantau kelas (↔ W-016)
- ✅ P-003 pasang-app.sh: tunggu bootout selesai sebelum bootstrap
- ✅ P-004 Merek Exact Practice di kepala situs; murid bisa ganti sandi di Pengaturan
- ✅ P-005 Masuk dengan akun Exact Canvas (No. HP + sandi, atau token sesi halaman murid Canvas) (↔ C-030)
- ✅ P-006 Gratis & persetujuan guru: akun baru menunggu Setujui di /admin/peserta; alamat practice2
- ✅ P-007 Terima paket dari Worksheet: POST /api/latihan/terbit dengan kunci bersama (↔ W-017)
- ✅ P-008 Umum berbayar & murid gratis: paket berjangka, beli via transfer+WA, sandi sementara saat Tandai lunas, afiliasi murid, kode ujian per paket
- ✅ P-009 Menu bar EP (status layanan, pintasan guru, nyala/mati) sebagai Login Item
- ✅ P-010 Lembar multi-set: satu paket per set (judul — Set n, kode sendiri), id soal ikut nomor set (↔ W-018)
- ✅ P-011 Bahasa bawaan Indonesia; spanduk cookie & menu admin warisan Try Out dihapus
- ✅ P-012 Cetak paket: render ulang dari bank bila PDF tidak ada di Mac ini
- ✅ P-013 PASANG-MAC-BARU.md + pasang-tunnel.sh: tiap Mac lengkap dengan domain Cloudflare sendiri, nama tunnel per Mac (↔ W-022)
- ✅ P-014 Alur "Tempel dari AI" di panel guru
- ✅ P-015 Gambar tag diagram & tabel di teks soal
- ✅ P-016 Cetak PDF ikut jawaban murid setelah ia mengerjakan

## Ruang latihan & konten (16–18 Sep 2026)
- ✅ P-020 Papan guru Exact Canvas ditanam di halaman soal; tampil sejak awal & tetap di halaman hasil (↔ C-033)
- ✅ P-021 package-lock disamakan dengan npm install di Mac
- ✅ P-022 Durasi latihan default 120 menit
- ✅ P-023 Nomor set bisa ditentukan guru dan diubah dari panel (↔ W-030)
- ✅ P-024 Sinkron diagrams.js dari Worksheet: nilai sumbu y grafik gerak (↔ W-031)
- ✅ P-025 Rumus: pangkat di dalam \text{} diangkat keluar sebelum KaTeX (↔ W-031)
- ✅ P-026 Teks bacaan dari Worksheet jadi stimulus soal (↔ W-033)
- ✅ P-027 Sinkron diagrams.js: diagram gaya lebih rapi (↔ W-034)
- ✅ P-028 Sinkron diagrams.js: gaya rumah standar A-Level (↔ W-034)

## Infrastruktur kerja Claude
- ✅ P-030 CLAUDE.md + AGENTS.md (peta, mode penyimpanan, jembatan, invarian) + PLANS.md (D1–D8, analisis deploy, K1–K4) + TASKS.md bernomor (24 Sep 2026)
- ✅ P-031 Baseline di clone bersih (24 Sep 2026, Node 22.23): `npm ci` ✅ · `typecheck` ✅ · `build` ✅ · `test:webhooks` 39/39 ✅ · `test:exams` ❌ (lihat P-032)

- ✅ P-037 Dokumen diperbarui setelah repo exact-canvas ikut dicek: endpoint Canvas dikoreksi (hanya `/api/akun/sesi` yang loopback-only), K3 dipersempit (24 Sep 2026)

## Keamanan (24 Sep 2026)
- ✅ P-038 Upgrade keamanan: next 15.1.6 → 15.5.26 (tutup 30+ advisori termasuk RCE React flight / CVE-2025-55182 & CVE-2025-66478, bypass middleware CVE-2025-29927, RCE Image Optimizer, SSRF), react/react-dom 19.0.0 → 19.0.8, postcss di dalam next dipaksa ≥ 8.5.28 lewat `overrides`; `typedRoutes` keluar dari `experimental`. `npm audit` 0 · typecheck ✅ · build ✅ · test:webhooks 39/39 · test:exams 101/101
- ✅ P-032 `test:exams` jalan di clone bersih: peserta & akun afiliasi uji dibuat sendiri, bank dibangun dari `question-bank/` + `sample-tests/` bila `.data` tidak ada. Hasil 15.1.6 vs 15.5.26 pada data kosong identik (regresi bukan karena upgrade)

## QA lokal (24 Sep 2026)
- ✅ P-040 Temuan: mode dev membocorkan kunci & pembahasan ke halaman ujian (debug info I/O React dev, saat cache bank habis); build produksi terbukti bersih (2 fetch, cache dingin & habis). Dijadikan invarian #10 di AGENTS.md
- ✅ P-041 QA alur X-1 di MacBook lokal (dev): terbit dari Worksheet (`terbit.py`) → paket kode SNNZ9M → daftar kode kelas (salah ditolak) → /menunggu → guru setujui → murid lihat paket → mulai → section (tenggat 15 mnt dari server) → save → submit 5/7 benar → hasil + pembahasan → pantau kelas; murid ditolak dari /admin, /terbit tanpa kunci 401

- ✅ P-042 Halaman tampil Mandarin di browser berbahasa "Inggris + Mandarin": deteksi Accept-Language melewati `en` lalu memilih `zh` di urutan mana pun. Deteksi dibuang — bahasa = cookie pilihan pengguna, selain itu Indonesia


## Internal & kode ujian (25 Sep 2026) — PLANS D10
- ✅ P-043 Hapus penjualan & afiliasi: /beli, /paket, /afiliasi, /r/[kode], /admin/pesanan, /admin/afiliasi, API orders/checkout/coupons/webhooks/affiliate/refund/payout/commissions, lib packages/payment/stripe/midtrans/snap/checkout/coupons/refunds/affiliate/mail/entitlements, sandi sementara, login Google, peran `umum`; ringkasan admin tanpa pendapatan; `test:webhooks` & `close-stale-orders` dihapus. (Metode order/komisi di driver DB masih ada sebagai kode mati — dibersihkan bersama keputusan FP-50/FP-60)
- ✅ P-044 Login username + sandi: daftar (nama, username, sandi) langsung aktif — tanpa email, kode kelas global, maupun persetujuan guru (/menunggu dihapus); `ADMIN_USERNAMES` (ADMIN_EMAILS lama tetap dibaca); form masuk murid & admin pakai username; akun Canvas jadi jalur kedua di /masuk; tujuan bawaan setelah masuk = /latihan
- ✅ P-045 Kode ujian per paket: murid memasukkan kode → paket masuk "Paket saya" (`POST /api/latihan/gabung`, dibatasi 20 percobaan/15 mnt); hanya peserta paket terbit yang boleh mulai & cetak (`bolehBuka`); terbit ulang dari Worksheet mempertahankan peserta; tautan guru `/latihan?kode=XXXXXX` mengisi kotak kode; panel guru menampilkan jumlah murid bergabung; latihan acak dari bank dihapus. Uji: test:exams 87/87 (11 uji kode ujian baru) + e2e di server lokal
- ✅ P-034 `.env.example` (warisan Try Out) dilebur ke `.env.contoh`
- ✅ P-046 UI: halaman Buat latihan, Pantau kelas (admin) dan Latihan (murid) tidak punya pembungkus `mx-auto max-w-* px-6 py-8` seperti halaman warisan Try Out — judul menempel di pojok kiri atas & kartu menempel di tepi kanan. Diberi pembungkus standar
- ✅ P-047 Buat soal tanpa Worksheet jadi alur utama: tab "Prompt → AI → Tempel" jadi tab pertama & bawaan, tombol "Salin & buka Claude" (claude.ai/new), tab Gemini-otomatis dipindah terakhir dengan keterangan butuh Worksheet. Uji: prompt dirender → naskah 5 soal SPLDV ditulis Claude → tempel → paket 34LQKR (5/5 soal, 0 dilewati) → murid gabung & kerjakan → nilai 4/5 sesuai jawaban, pembahasan tampil, soal tanpa kunci

- ✅ P-048 Prompt "Prompt → AI → Tempel" untuk diagram: katalog lengkap bangun datar (7 bentuk) & bangun ruang (7 bentuk) + parameter label, jaring, pandangan, anotasi `teks=`; aturan: sisi yang ditanyakan wajib berlabel huruf, segitiga istimewa pakai segitiga-siku berproporsi benar + teks sudut (bukan `[[sudut]]` yang selalu sama sisi); isian wajib bilangan bulat/desimal sederhana (hasil akar → tripel Pythagoras / PG). Sinkron diagrams.js (↔ W-047). Uji: 10 soal isian Pythagoras (segitiga istimewa, trapesium, balok, kerucut, limas, tangga) → paket WQHYRK 10/10 → tangkapan layar ruang ujian: semua gambar tampil, label benar, jawaban tidak tercetak

## Pengerjaan, perbaikan & pantauan (25 Sep 2026) — PLANS D11
- ✅ P-049 Riwayat & perbaikan: attempt diberi `paketId`; `statusPaket` (nilai awal → sekarang, nomor yang masih salah = belum pernah benar di attempt selesai mana pun); "Kerjakan yang salah" = attempt perbaikan berisi nomor yang masih salah saja, tanpa batas waktu (`tanpaWaktu`, jam disembunyikan, nomor asli dipertahankan lewat `nomorAsli`); satu attempt berjalan per paket (mulai lagi = lanjutkan); kartu paket murid: nilai, nomor salah, tombol, riwayat; halaman hasil latihan: benar X/N, nomor salah, tombol perbaikan, guru boleh membuka hasil murid (baca saja)
- ✅ P-050 Waktu: attempt utama berwaktu sesuai durasi paket; jam habis → pemutar mengirim otomatis (diuji di browser: 00:02 → /hasil); tab ditinggal → `tutupYangKedaluwarsa` menutup saat Latihan/Pantau kelas dibuka; soal kosong = salah
- ✅ P-051 Pantau kelas ditulis ulang: per murid per paket, progres langsung (dijawab/benar/salah/nomor salah/sisa waktu, tiap autosave 15 dtk), nilai awal → sekarang, masih salah, riwayat, rekap nomor tersering salah; muat ulang otomatis tiap 10 dtk
- ✅ P-052 Tanpa kunci layar: layar penuh, proctoring, skor integritas, dan gerbang mulai dimatikan untuk LATIHAN (langsung mulai)
- ✅ P-053 Tanya guru dihapus (tombol, POST /api/latihan/tanya, tanyaGuru, potretHtml); papan Canvas lewat `GET /api/latihan/papan`: murid username dibuatkan akun Canvas otomatis (↔ C-049). Uji: test:exams 98/98 (+11) · e2e salinan terpisah (murid & guru, tangkapan layar)

## QA menyeluruh (26 Sep 2026)
- ✅ P-054 QA ujung-ke-ujung di server lokal (skrip API + Chrome headless): akun & akses (fitur terhapus 404, murid ditolak dari admin), tempel naskah, kode ujian (tutup/buka paket), pengerjaan berwaktu (soal tanpa kunci, lanjutkan attempt, kirim, kosong = salah), hasil (guru boleh lihat, murid lain tidak), perbaikan (nomor salah saja, tanpa waktu, nilai 50 → 75), cetak PDF soal/berkunci lewat Worksheet, progres langsung di Pantau kelas, kanvas coret Canvas (akun otomatis, goresan tersimpan di Canvas guru), tampilan desktop & HP 390px (tanpa gulir mendatar, tanpa galat JS). 70 pemeriksaan; 3 "gagal" ternyata pencocokan HTML di skrip (penanda `<!-- -->` React), bukan bug. Perbaikan dari QA: judul panel "Kanvas coret" (dulu menyuruh "tekan Tanya guru"), laci daftar soal tertutup di HP (dulu menutupi soal)

- ✅ P-055 Papan peringkat dihapus (halaman, API, menu murid & header, metode `leaderboard` di kedua driver DB, tipe LeaderRow) — permintaan user 26 Sep 2026
- ✅ P-056 Judul tab halaman hasil "Hasil latihan" (dulu "Hasil try out")

- ✅ P-057 Akses internet on/off lewat Cloudflare Tunnel dari laptop: `run-server.sh publik on|off|status|setup` — tanpa setup = 2 tunnel cepat trycloudflare (Practice & Canvas), dengan `setup <host> <host>` = named tunnel domain sendiri (ingress Practice+Canvas saja). Practice di-restart dengan alamat publik (tanpa build ulang), ditolak bila mode dev. Proses latar dilepas penuh (`lepas`: fd warisan ditutup, sesi sendiri) — pipa pemanggil tak lagi menggantung. Default `EXACT_CANVAS_PUBLIC` tidak lagi domain Mac teman (localhost). Diuji lewat internet: halaman 200, login (cookie Secure), papan pakai alamat Canvas publik, goresan tersimpan lewat WebSocket tunnel, Worksheet tak terjangkau; lalu ditutup lagi (sebagian P-039)

- ✅ P-058 Pantauan langsung per murid: posisi nomor yang sedang dibuka (memori proses, `POST /api/attempts/[id]/posisi` tiap pindah soal), jawaban latihan terkirim ±1,5 dtk setelah diisi; Pantau kelas menampilkan "di nomor X" + kanvas coret mini murid yang sedang mengerjakan (refresh 5 dtk); halaman `/admin/kelas/[attempt]`: soal yang sedang dikerjakan, peta nomor benar/salah/kosong, soal + jawaban murid + kunci tiap nomor, kanvas coret langsung (refresh 3 dtk). Diuji dua browser (murid tablet & guru laptop)

- ✅ P-059 Guru menulis di kanvas murid dari web admin: halaman detail murid menanam editor Canvas lengkap (`/admin?admin=<tiket>&buka=<kanvas>`) + tombol "Buka layar penuh"; tiket admin 12 jam diminta server Practice ke Canvas (loopback + PIN). Aplikasi Canvas di Mac tetap bisa dipakai bersamaan (kanvas sama). Diuji: goresan guru dari web tersimpan di kanvas murid

- ✅ P-060 Rombak sesuai alur les privat (guru di laptop: buat soal → pantau + tulis di kanvas; murid di HP/tablet: kode → kerjakan + coret → hasil → perbaikan). Dibuang: Dashboard, Journey, Demo, Ringkasan admin (/admin → Pantau kelas), Bank soal Try Out, Tinjauan, Penilaian esai, Referensi, API /api/admin/{ai,questions,marks}, POST /api/attempts (mulai try out), tautan Ujian/Fitur/Harga & pemilih bahasa. Menu guru: Buat latihan · Pantau kelas · Murid; menu murid: Latihan · Pengaturan. Mesin ujian & kode Try Out di lib dibiarkan (dipakai pemutar ujian & tes)

- ✅ P-061 Kanvas di web admin dihapus (permintaan user: halaman jadi bermasalah; guru memakai aplikasi Exact Canvas di Mac). Pantau kelas & detail murid kini tanpa iframe kanvas — hanya progres, nomor sekarang, soal, jawaban & kunci; menyebut nama sketsa "Tanya · <murid> · tanggal" untuk dibuka di aplikasi. Helper kanvasMurid/urlLihatKanvas/tiketAdminCanvas/urlEditorKanvas dibuang. (Endpoint Canvas `?lihat=` & tiket admin tetap ada tapi tidak dipakai Practice)

- ✅ P-062 Panel "Ubah paket" (tombol pensil di Buat latihan) menggantikan dialog prompt judul: judul, mapel, kelas, topik, **durasi (5–600 menit, berlaku untuk pengerjaan berikutnya)**, set ke-, status terbit, daftar murid bergabung + Keluarkan, dan Ganti kode (kode lama langsung tidak berlaku). API: GET `?id=` memberi nama peserta; PATCH menerima mapel/kelas/topik/hapusPeserta/kodeBaru. Token CSS `var(--line)` yang tidak terdefinisi diganti `var(--border)`. Diuji lewat API + headless (laptop & HP) pada paket sementara

## Direncanakan (lihat detail di PLANS.md Backlog)
- ❌ P-033 (digabung ke P-038)
- ⬜ P-035 CI GitHub Actions (typecheck, build, test) — B4
- ✅ P-036 Keputusan deploy: tetap Mac + Cloudflare Tunnel (opsi A), dikonfirmasi user 24 Sep 2026
- ⬜ P-039 Pisahkan pengaturan Cloudflare/domain dari kode (domain & tunnel per pemasang lewat konfigurasi, bukan tertanam) — PLANS D9
