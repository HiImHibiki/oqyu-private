# TASKS.md — Riwayat Tugas Bernomor (Exact Worksheet)

> ✅ selesai · 🔄 berjalan · ⬜ direncanakan · ❌ dibatalkan.
> **Aturan:** tiap tugas selesai ditambahkan di bawah dengan nomor berurut (`W-xxx`),
> satu baris ringkas. Nomor dipakai sebagai prefix commit git (`W-xxx: deskripsi`) supaya
> riwayat & rollback bersih — satu task = satu commit (atau satu rangkaian commit).
> Tugas yang juga menyentuh Exact Practice: sebut nomor pasangannya (`↔ P-xxx`).
> Latar keputusan ada di `PLANS.md`; panduan kerja di `AGENTS.md`.
>
> W-001 s/d W-034 direkonstruksi dari `git log` (112 commit lama, dikelompokkan).

## Fondasi (13 Sep 2026)
- ✅ W-001 Exact Worksheet Automation: foto → PDF lewat Gemini tanpa API; perbaikan pasang.sh & galat acak "Perintah tidak terkirim"
- ✅ W-002 Terima PDF, komposisi soal, simpan ke Desktop dengan penamaan WSM, dua berkas keluaran (soal / soal+jawaban), pilihan kolom, menu bar
- ✅ W-003 Bank soal: hasil generate masuk bank, susun ulang tanpa AI, pemilihan otomatis (tab Bank/Arsip kemudian dihapus)
- ✅ W-004 Mesin Worksheet Maker masuk repo (`wsm/`), Chrome tanpa jendela, satu aplikasi bertab
- ✅ W-005 Tab Hasil: pratinjau, cetak ke printer Mac, cetak lewat gambar (monokrom), bolak-balik otomatis/manual, pilihan cetak diingat
- ✅ W-006 Autostart, antrean satu tugas, pembersihan cache, cegah multi-proses, `/diag` (localhost)
- ✅ W-007 Foto dari kamera, tab Kunci Jawaban (tata letak baca sendiri), tab Rangkuman
- ✅ W-008 Aplikasi Android: Open with → kirim ke Mac, titip lalu buka aplikasi, pilihan soal/jawaban
- ✅ W-009 Keandalan Gemini: bingkai berbeda tiap ulangan, larang kode program, mata Gemini untuk foto, buang draf ganda, penyaring jawaban ganda
- ✅ W-010 Claude sebagai mesin kedua (`claudecli.py`, `claude-proyek/`), biaya diukur
- ✅ W-011 Diagram: sisakan jenis yang bisa dipercaya; soal koordinat pakai kertas grafik kosong; fix balok tercetak 12 px
- ✅ W-012 Ganti nama jadi Exact Worksheet; pindah ke Documents/PROJECT EXACT GROUP; `naskah/` keluar dari git
- ✅ W-013 Pasang di Mac baru: jalur tidak tertanam keras, aplikasi di /Applications terpisah dari sumber & data, penjaga kesehatan
- ✅ W-014 Stabilitas: tunggu render, ketik bertahap, cap waktu langkah, tombol Hentikan, tugas macet berhenti sendiri, Hasil membaca Desktop secukupnya

## Jembatan Practice & keandalan (14 Sep 2026)
- ✅ W-015 Layar Gemini terlihat dari aplikasi; izin Desktop dipulihkan; kirim lewat klik; `ProcessType Interactive`; balasan "materi belum terlampir" diulang
- ✅ W-016 Endpoint jembatan untuk Practice: `/api/soal`, `/api/render`, `/api/potret-html` (↔ P-002)
- ✅ W-017 Tombol Ke Practice dari baris tugas & tab Hasil (↔ P-007)
- ✅ W-018 `naskah.urai`: tiap SET diurai sendiri dengan kunci & pembahasannya (↔ P-010)
- ✅ W-019 Restart Chrome / Restart aplikasi (halaman + menu bar EW); kunci Practice pindah ke `practice.json`; meta nama & durasi per set; fix kirim PDF/foto macet
- ✅ W-020 Tombol Bagikan PDF (Web Share → WA); Ke Practice mengirim nama PDF agar pulih setelah restart
- ✅ W-021 Prompt dihaluskan (3 jenis), "tanpa tautan sumber", pemanasan dua giliran dimatikan, soal grafik hanya menulis tag graph
- ✅ W-022 PASANG-MAC-BARU.md: tiap Mac lengkap (Worksheet + Canvas + Practice) dengan domain sendiri (↔ P-013)
- ✅ W-023 Blok Pembahasan saat menyusun naskah dari soal; salin prompt AI dari menu bar

## Naskah Manual, kop, diagram (15–18 Sep 2026)
- ✅ W-024 Fix draf ganda/hilang di Kunci Jawaban & Rangkuman; nama mapel dipetakan ke slug prompt-builder
- ✅ W-025 Tab Naskah Manual: soal dari AI mana pun atau ditulis sendiri
- ✅ W-026 Menu bar dirapikan; Android preset Mac ketiga
- ✅ W-027 Kop: pilihan kode depan judul (MATH, PHYS, …) di baris "Kop & bentuk lembar"
- ✅ W-028 Render: tab WSM selalu baru (tab hidden → 1 kolom kosong); blok Pembahasan dipecah di penanda kode
- ✅ W-029 Maker: slider ukuran gambar, kolom opsi PG per soal, preset ukuran diagram
- ✅ W-030 Ke Practice: judul paket = kode kop, isian "set ke-" (↔ P-023)
- ✅ W-031 Grafik gerak: nilai titik di sumbu y; rumus: pangkat di dalam `\text{}` diangkat keluar (↔ P-024, P-025)
- ✅ W-032 Naskah Manual: jenis pembahasan & rangkuman, topik pindah ke Kop, pagar ``` dibuang, pilihan ukuran diagram di form
- ✅ W-033 Teks bacaan (B. Indonesia/Inggris) dari perintah AI sampai Practice (↔ P-026)
- ✅ W-034 Diagram gaya rumah A-Level untuk semua penggambar (fisika, grafik/statistik, geometri, kimia/biologi, alat titrasi) (↔ P-027, P-028)

## Infrastruktur kerja Claude
- ✅ W-040 CLAUDE.md (dengan pengaman untuk mesin claude-proyek) + AGENTS.md + PLANS.md + TASKS.md bernomor (24 Sep 2026)
- ✅ W-041 Baseline (24 Sep 2026): `node wsm/test.js` 94/94 ✅ · `py_compile *.py` ✅ (1 SyntaxWarning `buat.py:931`)

## Keamanan (24 Sep 2026)
- ✅ W-045 KaTeX yang di-vendor (`statik/katex`, `wsm/vendor/katex`) 0.16.9 → 0.16.47: menutup CVE-2024-28243/28244 (DoS maxExpand), CVE-2024-28245 (bypass protokol `\includegraphics`), CVE-2024-28246 & CVE-2025-23207 (XSS `\htmlData`). Diuji: rumus, pecahan, `\ce` mhchem ter-render; `wsm/test.js` 94/94. Python stdlib saja (tanpa dependensi); `/berkas` menolak `/` & `..`

## QA lokal (24 Sep 2026)
- ✅ W-046 Dipasang di MacBook lokal (poppler via brew, `pasang.sh`, OCR terkompilasi, DB kosong), server `python3 cari.py` :7790 — semua tab 200; `terbit.py` → Practice lokal berhasil (↔ P-041). Catatan: keluaran & tab Hasil membaca seluruh PDF di ~/Desktop

## Diagram (25 Sep 2026)
- ✅ W-047 Label sisi bangun bisa ditimpa (`labelSisi`, bertanda PATCH EXACT di `wsm/diagrams.js`): bangun datar `labelalas/labeltinggi/labelmiring`, `labela/b/c`, `labelsisi`, `labelpanjang/labellebar`, `labelatas/labelbawah/labelkiri/labelkanan`, `labeljari`; bangun ruang `labelsisi/labelpanjang/labellebar/labeltinggi/labeljari/labelalas`; nilai `-`/`kosong` = tanpa label. Dulu angka ukuran selalu tercetak → soal "cari tinggi" membocorkan jawaban lewat gambar. wsm/test.js 96/96 (+2). Disinkron ke Practice & Canvas (↔ P-048, C-048)

## Direncanakan (lihat detail di PLANS.md Backlog)
- ⬜ W-042 Perbaiki SyntaxWarning `buat.py:931` — B1
- ⬜ W-043 Satu perintah uji `./uji.sh` — B2
- ❌ W-044 Menyesuaikan jembatan untuk Practice di cloud — tidak diperlukan, user memilih tetap Mac + Tunnel (24 Sep 2026)
