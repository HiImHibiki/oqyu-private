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

## Direncanakan (lihat detail di PLANS.md Backlog)
- ❌ P-033 (digabung ke P-038)
- ⬜ P-034 Satukan `.env.contoh` & `.env.example` — B3
- ⬜ P-035 CI GitHub Actions (typecheck, build, test) — B4
- ✅ P-036 Keputusan deploy: tetap Mac + Cloudflare Tunnel (opsi A), dikonfirmasi user 24 Sep 2026
- ⬜ P-039 Pisahkan pengaturan Cloudflare/domain dari kode (domain & tunnel per pemasang lewat konfigurasi, bukan tertanam) — PLANS D9
