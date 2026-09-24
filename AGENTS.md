# AGENTS.md — Panduan Kerja Claude di Exact Worksheet

> Baca file ini SETIAP memulai sesi. Pilih PERAN yang cocok, ikuti playbook-nya, patuhi
> INVARIAN di bawah. File pendamping: `PLANS.md` (keputusan & jalan buntu), `TASKS.md`
> (riwayat bernomor — SELALU diupdate setelah tugas selesai).

## Konteks project

**Exact Worksheet** = satu instruksi (topik / foto soal / PDF) jadi lembar kerja PDF siap
cetak untuk Exact Course. Naskah dikarang **Gemini lewat Chrome kendali** (tanpa API, pakai
langganan Google milik Rico) atau **Claude CLI** (langganan Pro, `claudecli.py`), diurai jadi
butir soal, lalu dirender **Exact Worksheet Maker** (`wsm/`, JS vanilla) jadi PDF.
Hasilnya bisa dicetak ke printer Mac, dibagikan ke WA, atau diterbitkan ke **Exact Practice**.

Stack: **Python 3.9+ stdlib saja** (tanpa pip), Chrome DevTools Protocol (klien WS sendiri
di `cdp.py`), Swift (OCR Vision, menu bar), Node (hanya untuk `wsm/test.js` & `node --check`),
Android (Java, kirim foto dari HP). **Hanya macOS.** Server: `cari.py`, port **7790**.

Tidak bisa dipindah ke cloud: butuh Chrome ber-login Gemini, OCR Vision, printer CUPS,
dan Desktop Mac. Lihat `../Exact-Practice/PLANS.md` §Deploy.

### Tiga tempat — jangan dicampur

| Apa | Di mana | Sifat |
|---|---|---|
| Kode sumber | folder repo ini | boleh dipindah; tidak pernah ditulisi saat jalan |
| Aplikasi | `/Applications/Exact Worksheet.app` (`bangun-app.sh` menyalin *.py, wsm, statik, ocr-mac, claude-proyek) | yang dijalankan launchd; salinan, bukan tautan |
| Data | `~/Library/Application Support/Exact Worksheet` (`lokasi.data()`, bisa ditimpa `EXACT_DATA`) | `exact.db`, `chrome-otomatis/`, `setelan.json`, `practice.json`, `naskah/`, `thumb/` |
| Keluaran | `~/Desktop` (PDF) | dilindungi TCC → butuh Full Disk Access `/usr/bin/python3` |

### Peta berkas

```
cari.py             server HTTP (7790): semua rute GET/POST, /diag (localhost), jembatan Practice
buat.py             halaman aplikasi bertab + alur latar belakang (antrean satu tugas)
otomasi.py          Gemini via Chrome + render lembar jadi PDF lewat wsm di Chrome
cdp.py              klien DevTools Protocol + WebSocket; nyalakan/matikan Chrome kendali
claudecli.py        mesin Claude: `claude -p` dengan cwd claude-proyek/ (format-*.md)
naskah.py           naskah teks → butir (urai); multi-SET, Bacaan, Pembahasan
gemini_baca.py / gemini_impor.py   baca PDF/teks Gemini jadi soal terstruktur
jawab.py / rangkum.py / lembar*.py  kunci & pembahasan, rangkuman, tata letak lembar
terbit.py           Ke Practice: POST <practice_url>/api/latihan/terbit (header x-exact-kunci)
wsmaker.py          jembatan ke Worksheet Maker
setelan.py          isian borang yang diingat (setelan.json — DITULIS ULANG tiap simpan)
lokasi.py           KODE vs DATA
penjaga.py          cek kesehatan tiap 2 menit via HTTP, restart lewat launchctl
serupa.py, bangun_indeks.py, labeli.py, klasifikasi.py, panen.py  bank soal/arsip (opsional)
klip.py, kolom.py, pilih.py, triase.py, titipan.py, pecah_soal.py, gabung_ocr.py  utilitas alur
wsm/                Exact Worksheet Maker (app.js parser/renderer, diagrams.js, prompt-builder.js, test.js)
claude-proyek/      CLAUDE.md + format-soal/pembahasan/rangkuman.md = SPESIFIKASI NASKAH
ocr-mac/            VisionOCR.swift (dikompilasi pasang.sh) + jalankan_ocr.py
menubar/            menu bar "EW" (Swift): restart Chrome/aplikasi, salin prompt
android/            aplikasi Android "Exact Worksheet": Open with → kirim foto ke Mac (Tailscale)
tolok/              skrip tolok ukur & uji manual (bukan suite otomatis)
*.sh                pasang, bangun-app, pasang-autostart, mulai, mulai-ulang, perbarui-mesin, rantai
```

## Perintah penting

```bash
./pasang.sh                     # cek kebutuhan, kompilasi OCR, DB kosong
./bangun-app.sh                 # salin kode ke /Applications (ULANGI tiap kode berubah)
./pasang-autostart.sh --lan     # LaunchAgent server + penjaga (+ menu bar)
./mulai-ulang.sh                # restart resmi (JANGAN pkill)
EXACT_TAMPIL=1 ./mulai.sh       # Chrome kendali berjendela (login Gemini sekali)
curl -s http://127.0.0.1:7790/diag | python3 -m json.tool   # keadaan server (localhost saja)
tail -f /tmp/exact-worksheet.log                            # log; awalan [gemini] untuk kegagalan AI

# Uji
node wsm/test.js                # 94 uji parser/renderer/diagram — WAJIB hijau
node --check wsm/*.js           # tiap kali menyunting JS halaman
python3 -m py_compile *.py      # sintaks Python
EXACT_DATA=$(mktemp -d) python3 cari.py   # server uji tanpa menyentuh data asli
```

## Peran (pilih sesuai permintaan)

### 1. Dev Aplikasi (server & halaman)
- Python stdlib saja — jangan menambah dependensi pip. Ikuti gaya yang ada: nama Indonesia,
  komentar yang menjelaskan MENGAPA (sering dengan tanggal kejadian).
- Menulis berkas data: selalu atomik (`.tmp` + `os.replace`) dan lewat `lokasi.data()`.
- JS halaman: setelah menyunting, `node --check`. Satu galat sintaks mematikan seluruh
  skrip dan gejalanya cuma "tombol tidak jalan".
- Uji di server sementara (`EXACT_DATA=...`), lalu `./bangun-app.sh && ./mulai-ulang.sh`.
- Update TASKS.md.

### 2. Otomasi Gemini / Chrome (paling rapuh)
- Baca bagian "Jalan buntu" di README & PLANS dulu — JANGAN mengulang yang sudah gagal.
- Semua ketik/klik/hapus lewat `Input.*` CDP; JavaScript hanya untuk membaca.
- Uji dengan rantai penuh di PASANG.md §8 (40–160 detik), bukan asumsi.

### 3. Mesin render / format naskah (`wsm/`, `naskah.py`, `claude-proyek/`)
- Format naskah adalah KONTRAK tiga pihak: prompt (`wsm/prompt-builder.js`, `jawab.py`,
  `rangkum.py`, `claude-proyek/format-*.md`), pengurai (`naskah.py`, `wsm/app.js`), dan
  Exact Practice (`Butir`). Ubah satu → periksa ketiganya.
- `wsm/diagrams.js` disalin ke DUA tempat: identik ke
  `../Exact-Practice/src/lib/practice/diagrams.js`, dan ke `../exact-canvas/src/lib/diagrams.js`
  (+ baris export, lewat `node scripts/salin-diagrams.mjs ../Exact-Worksheet/wsm/diagrams.js`).
  Setelah mengubahnya: `node wsm/test.js`, salin ke keduanya, commit di masing-masing
  "Sinkron diagrams.js dari Worksheet: …" (↔ P-xxx, C-xxx).
- Patch lokal bertanda `PATCH EXACTSEARCH` di `wsm/diagrams.js` — jangan hilang saat
  `perbarui-mesin.sh`. Skrip itu juga menimpa `wsm/vendor/` — KaTeX harus tetap ≥ 0.16.47
  (W-045); periksa `grep -o 'version:"[0-9.]*"' wsm/vendor/katex/katex.min.js` sesudahnya.

### 4. Integrasi Exact Practice
- Arah dorong: `terbit.py` → `POST /api/latihan/terbit` dengan `x-exact-kunci`. URL & kunci
  dari `practice.json` (`{"url", "kunci"}`), fallback `setelan.json` lama.
- Arah tarik (dipanggil Practice): `/buat`, `/status`, `/api/soal`, `/batal`, `/api/render`,
  `/berkas`, `/api/potret-html`. **Tanpa autentikasi** — aman hanya di loopback/Tailscale.
  Jangan pernah membukanya lewat tunnel publik tanpa menambah auth dulu.

### 5. Pemasangan / Ops
- Ikuti `PASANG.md` berurutan; berhenti di verifikasi yang gagal.
- Hal yang hanya bisa dilakukan Rico: login Google Gemini, Full Disk Access, akses repo.

### 6. QA
- `node wsm/test.js` + `python3 -m py_compile *.py` + `node --check` JS yang diubah.
- Perubahan alur buat/terbit: uji rantai PASANG.md §8 + terbit ke Practice lokal.

### 7. Dokumentasi
- `TASKS.md` (W-xxx, prefix commit), `PLANS.md` (Dxx + jalan buntu), README untuk manusia.

## INVARIAN (jangan dilanggar tanpa persetujuan user)

1. **Gemini hanya diajak bicara lewat `Input.*` CDP.** Peristiwa JS buatan diabaikan;
   `innerHTML=''` di kotak perintah mematikan tombol kirim permanen.
2. **Klik hanya ke tab `visible`** — `Page.bringToFront` dan tunggu `visible` dulu.
3. **Render WSM lewat tombol `#btnRender`**; mengisi `rawInput` saja menghasilkan PDF kosong.
   Tab Worksheet Maker selalu baru per render.
4. **Restart hanya lewat `./mulai-ulang.sh` / launchd**, bukan `pkill` — izin Desktop melekat
   pada proses launchd; python tangan merebut port lalu layanan resmi menyerah.
5. **Layanan launchd `ProcessType Interactive`** — tanpa itu foto tak pernah terkirim.
6. **Kode, aplikasi, dan data terpisah** (tabel di atas). Kode tidak pernah menulis ke folder
   aplikasi/sumber.
7. **Kunci & pembahasan selalu menyala saat halaman dibuka; mapel/kelas/jenjang tidak
   diingat** — keduanya pernah menyebabkan lembar salah yang baru ketahuan setelah dicetak.
8. **`practice.json` terpisah dari `setelan.json`** — `setelan.simpan()` menulis ulang hanya
   medan borang (kunci Practice pernah hilang 14 Sep 2026).
9. **Format naskah** (kode bagian `(PG)`, bobot `[2]`, kunci `PG1-A`, blok `Bacaan`, `SOAL n /
   JAWAB: / BAHAS:`, `JUDUL:/INTI:/BAGIAN:`) tidak diubah tanpa memperbarui prompt, pengurai,
   test, dan Practice sekaligus.
10. **`diagrams.js` identik di Worksheet, Practice, dan Canvas** (Canvas + ekor export).
11. **Tidak pernah di-commit**: `exact.db`, `chrome-otomatis/` (sesi login pribadi),
    `setelan.json`, `practice.json`, `naskah/`, APK.
