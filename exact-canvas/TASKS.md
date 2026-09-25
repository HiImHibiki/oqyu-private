# TASKS.md — Riwayat Tugas Bernomor (Exact Canvas)

> ✅ selesai · 🔄 berjalan · ⬜ direncanakan · ❌ dibatalkan.
> **Aturan:** tiap tugas selesai ditambahkan di bawah dengan nomor berurut (`C-xxx`),
> satu baris ringkas. Nomor dipakai sebagai prefix commit git (`C-xxx: deskripsi`) supaya
> riwayat & rollback bersih. Tugas yang juga menyentuh repo lain: sebut pasangannya
> (`↔ P-xxx` Practice, `↔ W-xxx` Worksheet). Latar keputusan di `PLANS.md`.
>
> C-001 s/d C-035 direkonstruksi dari `git log` (86 commit lama, dikelompokkan).

## Kanvas mandiri (6 Sep 2026)
- ✅ C-001 Aplikasi kanvas mandiri dari modul Canvas Exact Dashboard Workspace
- ✅ C-002 Kursor per alat, penggaris/busur/jangka, grafik fungsi & tabel, pengenalan bentuk (persegi lebih toleran), label busur adaptif, goresan terkunci instrumen bisa dihapus
- ✅ C-003 Esc bertingkat (lepas suntingan → lipat panel), sembunyikan daftar halaman
- ✅ C-004 Impor beberapa PDF sekaligus (berurutan, satu halaman per kertas)
- ✅ C-005 Dokumen rencana kelas & tugas, rencana kelas langsung (`docs/`)

## Berbagi & kelas langsung (6 Sep 2026)
- ✅ C-010 Server axum + hub WebSocket, halaman TV pengikut, editor tablet via HTTP, gestur sentuh, cadangan per sketsa, simpan-sebelum-muat
- ✅ C-011 Sinkron dua arah Mac ↔ tablet (gabung tiga arah, goresan langsung, poll 5 dtk); hapusan/undo/bentuk disiarkan langsung
- ✅ C-012 Tablet: S Pen tombol samping = penghapus, rel & bilah diperbesar, batas isi permintaan dinaikkan
- ✅ C-013 Pengikut ringan: gambar dilayani terpisah + cache, HP mengikuti zoom guru, hanya yang terlihat yang digambar ulang
- ✅ C-014 Kelas langsung: masuk nama & ruangan, antrean tanya berfoto, grup, lampu fokus, bunyi "dibahas", mode menunggu HP, notifikasi
- ✅ C-015 Kanvas khusus per murid & grup, lampiran PDF dari HP, murid menjelajah lalu kembali mengikuti
- ✅ C-016 Skrip uji regresi, alur kelas, gambar via DevTools, beban 40 murid (`scripts/uji/`)
- ✅ C-017 Alamat publik (Cloudflare) untuk tautan & QR, PIN 4–8 digit, pembatas percobaan PIN, skrip Cloudflare Tunnel
- ✅ C-018 Anti-spam antrean (jeda, kuota, bisukan, batas per alamat, hitung mundur)
- ✅ C-019 Sandi admin untuk editor & endpoint pengubah data; `/` publik → murid, `/admin` → guru
- ✅ C-020 Akun murid dengan persetujuan guru, izin coret per murid (pencabutan seketika), grup permanen; CORS header kredensial

## Keandalan & fitur murid (8–12 Sep 2026)
- ✅ C-021 Fix kebocoran antar-kanvas, auth admin, grup belajar mandiri
- ✅ C-022 Grafik implisit, riwayat kanvas grup, hapus massal
- ✅ C-023 Foto murid: beberapa sekaligus dari galeri, tombol Kamera/Galeri terpisah, latar putih (fix foto hitam), dikodekan di server
- ✅ C-024 Tablet: foto pertanyaan masuk kanvas, toolbar auto-lipat, tempel-ulang lampiran, tawaran refresh saat versi baru
- ✅ C-025 Tombol Send macet di HP (batas waktu tiap permintaan); kueri diulang saat DB terkunci; goresan murid dipulihkan sendiri
- ✅ C-026 PDF di WKWebView: pengisi Promise.withResolvers, pdf.js legacy + pengisi Iterator
- ✅ C-027 Ketuk dua jari = undo (tablet & murid); putar/ukur foto tanpa ganti alat; tempelan langsung bisa diseret
- ✅ C-028 Murid berizin: bentuk, penggaris, busur, jangka, hold-to-shape; ikon menu bar

## Integrasi Exact Practice (14–18 Sep 2026)
- ✅ C-030 Tombol 📝 Practice di halaman murid (sesi akun ini), alamat via `VITE_PRACTICE_URL` saat build (↔ P-005)
- ✅ C-031 PASANG-MAC-BARU.md: tiap Mac lengkap dengan domain sendiri (↔ P-013, W-022)
- ✅ C-032 Rumus di kartu antrean; soal teks kiriman Practice ditempel ke kanvas sebagai gambar; tag diagram `[[…]]` di kartu & tempelan
- ✅ C-033 Layar murid mode tertanam untuk Practice + sesi atas nama Practice (`/api/akun/sesi`) (↔ P-020)
- ✅ C-034 Pembatas PIN per perangkat; klien tertinggal memuat ulang; murid berizin lepas dari mengikuti guru; tombol matikan ketuk-dua-jari
- ✅ C-035 Masuk langsung ke kanvas sendiri/grup; kanvas lama disingkirkan otomatis (per hari); sinkron diagrams.js & rumus `\text{}` (↔ W-031, W-034)

## Infrastruktur kerja Claude
- ✅ C-040 CLAUDE.md + AGENTS.md + PLANS.md + TASKS.md bernomor (24 Sep 2026)
- ✅ C-041 Baseline (24 Sep 2026): `npm ci` ✅ · `npm run build` (tsc + vite) ✅ · `cargo check` belum — Rust tidak terpasang di Mac ini · `src/lib/diagrams.js` = Worksheet + ekor export ✅

## Keamanan (24 Sep 2026)
- ✅ C-045 Audit dependensi: `npm audit` 0 (React 19.2.8 hanya client, tanpa Server Components → tidak terdampak CVE-2025-55182). `Cargo.lock` dicocokkan ke OSV: 9 temuan, tidak ada yang dapat dieksploitasi di aplikasi ini — `rsa` (Marvin, via sqlx-mysql; hanya fitur sqlite dipakai, tanpa perbaikan hulu), `rkyv` 0.7.46 (RUSTSEC-2026-0235, via rust_decimal; aplikasi tidak mendeserialisasi arsip rkyv), `glib` (khusus Linux/GTK, tidak dikompilasi di macOS), `unic-*` & `proc-macro-error` (hanya tidak dipelihara). Tinjau ulang dengan `cargo audit` setelah Rust terpasang (C-042)

## QA lokal (24 Sep 2026)
- ✅ C-042 Rust 1.98.1 terpasang (rustup), `tauri dev` terkompilasi & aplikasi jalan di MacBook lokal
- ✅ C-047 Fix `npm run app` tidak pernah jalan: Vite di port 1420 sementara `tauri.conf.json` (devUrl + CSP) menunggu 1421 — Vite disamakan ke 1421, HMR 1422

- ✅ C-048 Sinkron diagrams.js dari Worksheet: label sisi bangun bisa ditimpa (↔ W-047)

## Direncanakan (lihat PLANS.md Backlog)
- ❌ C-043 Jalur sesi Practice untuk Practice di cloud — tidak diperlukan, user memilih tetap Mac + Tunnel (24 Sep 2026)
- ⬜ C-044 CI build — B3
- ⬜ C-046 Default alamat Practice (`VITE_PRACTICE_URL`) & placeholder alamat publik tidak lagi menunjuk domain Mac utama (↔ P-039)
