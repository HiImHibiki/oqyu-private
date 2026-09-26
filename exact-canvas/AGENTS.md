# AGENTS.md — Panduan Kerja Claude di Exact Canvas

> Baca file ini SETIAP memulai sesi. Pilih PERAN yang cocok, ikuti playbook-nya, patuhi
> INVARIAN di bawah. File pendamping: `PLANS.md`, `TASKS.md` (SELALU diupdate).

## Konteks project

**Exact Canvas** = aplikasi kanvas sketsa macOS untuk pen tablet (Wacom), dipisah dari modul
Canvas di Exact Dashboard Workspace, lalu dikembangkan jadi **papan kelas langsung** Exact
Course: guru menulis di Mac/tablet, TV dan HP murid mengikuti, murid bertanya (teks/foto),
dan murid berizin boleh mencoret kanvasnya sendiri.

Stack: **Tauri 2** (Rust) + **React 19 + Vite 7 + TypeScript + Tailwind 4 + zustand**.
Server HTTP + WebSocket **axum** hidup DI DALAM aplikasi Mac (port **4747**) saat
*Share on this network* menyala. Data lokal: **vault** folder JSON + SQLite
`exact-canvas.db`. Akses internet lewat **Cloudflare Tunnel** (`meet2.exactprintsolution.com`
di Mac utama). Hanya macOS; Mac tidak boleh tidur selama kelas.

Tidak bisa dipindah ke cloud: server dan data melekat pada aplikasi desktop guru.

### Peran & layar

| Siapa | Perangkat | Alamat | Auth |
|---|---|---|---|
| Guru | Mac | aplikasi Tauri (asal `tauri://localhost`) | token internal |
| Guru | tablet | `/admin` (editor web penuh) | kata sandi admin (`x-exact-admin`) |
| TV | smart TV | `/tv` (pengikut, `&mode=fit`, `?ruang=N`) | PIN |
| Murid | HP | `/tv?murid=1` (publik: `/`) | akun No. HP + sandi → sesi (`x-exact-sesi`), disetujui guru |
| Exact Practice | server | `/api/kelas/*`, `/api/akun/*` | PIN (`x-exact-pin`); `/api/akun/sesi` loopback saja |

### Peta direktori

```
src-tauri/src/
  lib.rs        bootstrap Tauri, vault, WAL SQLite
  server.rs     axum: semua rute, CORS, PIN + pembatas percobaan, hub WebSocket (/ws), aset
  akun.rs       akun murid (PBKDF2), sesi, persetujuan, reset, /api/akun/sesi (untuk Practice)
  kelas.rs      kelas langsung: masuk, antrean tanya (foto), paham, izin coret, grup
  db.rs         skema SQLite (settings, canvases, accounts, sessions, students, groups, questions)
  vault.rs      lokasi vault (~/ExactCanvas atau iCloud), berkas sketsa, backup/<id>/
  office.rs     impor Word/PowerPoint (LibreOffice / textutil)
  menu.rs, windows.rs   menu macOS, multi-jendela
src/
  modules/canvas/   editor kanvas (alat, instrumen, bentuk, lapisan, halaman)
  tv/main.ts        halaman pengikut TV/HP murid (tv.html) — termasuk tombol 📝 Practice
  lib/              api, sinkron (gabung tiga arah), kelas, pdf, vault, diagrams.js (SALINAN)
  components/       Pengaturan, TeksRumus (KaTeX), Toast
scripts/cloudflare-setup.sh   tunnel per Mac
scripts/salin-diagrams.mjs    salin wsm/diagrams.js dari Worksheet (+ baris export)
scripts/uji/                  uji regresi terhadap aplikasi yang sedang menyala (lihat README)
docs/RENCANA-*.md             rencana fitur kelas langsung & kelas-tugas
```

### Data

| Apa | Di mana |
|---|---|
| Sketsa (goresan) | `<vault>/canvas/*.json` + cadangan `backup/<id>/` (30 versi) |
| Indeks, setelan, akun, sesi, murid, grup, antrean | `<vault>/exact-canvas.db` (SQLite WAL) |
| Foto pertanyaan | `<vault>/tanya/` — dihapus bersama barisnya setelah sehari |
| Lokasi vault | `~/ExactCanvas` (atau iCloud Drive `ExactCanvas`), penunjuk di Application Support |

## Perintah penting

```bash
npm ci
npm run dev                  # Vite saja (UI di browser, tanpa Rust) — port 1421
npm run build                # tsc --noEmit + vite build — WAJIB hijau
npm run app                  # tauri dev (butuh Rust stable + Xcode CLT)
# `tauri dev` menyajikan halaman TV/HP murid (/tv, /admin) dari folder dist/ — jalankan
# `npm run build` dulu (dan ulangi setelah mengubah src/tv atau tv.html), kalau tidak /tv = 404.
VITE_PRACTICE_URL="https://PRACTICE_HOST" npm run app:build   # .app + .dmg
ditto "src-tauri/target/release/bundle/macos/Exact Canvas.app" "/Applications/Exact Canvas.app"
node scripts/salin-diagrams.mjs ../Exact-Worksheet/wsm/diagrams.js   # sinkron diagram
ADMIN=<sandi admin> node scripts/uji/uji-fungsi.mjs                   # butuh aplikasi menyala, PIN 1234
./scripts/cloudflare-setup.sh kanvas.domain.com
```

Catatan: `salin-diagrams.mjs` tanpa argumen mencari Worksheet di
`~/Documents/PROJECT EXACT GROUP/Exact Worksheet` — di workspace ini beri jalurnya.

## Peran (pilih sesuai permintaan)

### 1. Dev Aplikasi (frontend React / kanvas)
- Ikuti idiom yang ada; komentar menjelaskan MENGAPA. `npm run build` harus hijau.
- Perubahan halaman pengikut (`src/tv/`) diuji di HP sungguhan / Chrome mode perangkat —
  iPhone Safari & WKWebView pernah punya kekhasan (Promise.withResolvers, pdf.js legacy).

### 2. Dev Server (Rust)
- Setiap rute baru: tentukan auth (`sah` / `admin_sah` / sesi) SEBELUM logika. Rute yang
  mengubah data wajib admin; murid hanya menyentuh kanvasnya sendiri.
- Perubahan skema: `CREATE TABLE IF NOT EXISTS` / tambah kolom — jangan ubah kolom lama;
  database guru yang sudah jalan harus tetap terbuka.
- Butuh Rust untuk mengompilasi (`rustup`); tanpa itu hanya frontend yang bisa diverifikasi.

### 3. Integrasi Exact Practice / Worksheet
- Practice memakai: `/api/akun/masuk`, `/api/akun/saya` (login murid), `/api/kelas/masuk`,
  `/api/kelas/tanya` (Tanya guru, PIN), `/api/akun/sesi` (sesi papan guru, loopback + PIN,
  menolak permintaan lewat proxy). Ubah kontraknya → ubah `Exact-Practice/src/lib/auth.ts`
  & `src/lib/practice/canvas.ts` di commit berpasangan, catat di kedua TASKS.md.
- `src/lib/diagrams.js` = `Exact-Worksheet/wsm/diagrams.js` + satu baris `export` di ekor.
  Jangan disunting di sini; pakai `salin-diagrams.mjs`.
- Tombol 📝 Practice di HP murid mengarah ke `VITE_PRACTICE_URL` (ditetapkan saat build).

### 4. QA
- `npm run build` + skrip `scripts/uji/` yang relevan terhadap aplikasi menyala
  (data uji berawalan `uji_`, dibersihkan sendiri). `uji-beban.mjs` untuk perubahan hub.

### 5. Pemasangan / Ops
- Ikuti `PASANG-MAC-BARU.md` langkah 3. Aplikasi tidak ditandatangani — `xattr -dr
  com.apple.quarantine` bila macOS menolak.
- PIN untuk akses internet 6–8 digit (4 digit hanya untuk Wi-Fi lokal).

### 6. Dokumentasi
- `TASKS.md` (C-xxx, prefix commit), `PLANS.md` (Dxx), `docs/RENCANA-*.md` untuk rencana besar.

## INVARIAN (jangan dilanggar tanpa persetujuan user)

1. **Local-first**: seluruh data di vault milik guru. Tidak ada layanan cloud untuk data.
2. **PIN tidak pernah tampil di alamat HP murid** — murid memakai sesi akun; PIN salah
   berulang dari satu asal diblokir sementara (PIN benar pun).
3. **Sandi murid di-hash PBKDF2 bergaram**; akun baru menunggu persetujuan guru.
4. **Murid berizin hanya mencoret kanvasnya sendiri** (kanvas "Tanya · Nama" atau grupnya) —
   tidak objek, teks, gambar, atau kanvas lain. Pencabutan izin berlaku seketika.
5. **`/api/akun/sesi` hanya untuk loopback tanpa header proxy** — itu yang mencegah orang luar
   mencetak sesi atas nama murid.
6. **Setiap tulis sketsa menyimpan versi sebelumnya** (`backup/<id>/`); simpan-sebelum-muat
   dan gabung tiga arah menjaga goresan dari Mac/tablet tidak saling menimpa.
7. **`diagrams.js` identik dengan Worksheet** (+ ekor export).
8. **SQL bebas (`/api/sql`) hanya untuk admin/editor**, tidak pernah untuk murid.
