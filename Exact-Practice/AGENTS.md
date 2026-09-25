# AGENTS.md — Panduan Kerja Claude di Exact Practice

> Baca file ini SETIAP memulai sesi. Pilih PERAN yang cocok dengan permintaan user,
> ikuti playbook-nya, dan patuhi INVARIAN di bawah. File pendamping: `PLANS.md`
> (keputusan desain & alasannya), `TASKS.md` (riwayat tugas bernomor — SELALU diupdate).

## Konteks project

**Exact Practice** = latihan & ujian online murid bimbel **Exact Course**. Cabang dari
**Exact Try Out** (mesin ujian SAT/UTBK/CSCA/A-Level) yang ditambah jenis ujian `LATIHAN`:
guru membuat lembar di **Exact Worksheet**, menekan *Ke Practice*, lalu murid
mengerjakannya online (jam di server, autosave, hasil & pembahasan).

Stack: Next.js 15.1 (App Router) + React 19 + TypeScript + Tailwind 4. Node ≥ 20.
Saat ini berjalan **di Mac guru** sebagai LaunchAgent (`com.exactcourse.practice`, port
8770) dan dibuka publik lewat **Cloudflare Tunnel** (`practice2.exactprintsolution.com`).
Belum pernah dideploy ke Vercel/Cloudflare Workers — lihat PLANS.md §Deploy.

### Ekosistem (3 aplikasi, semuanya ada di workspace ini: `../Exact-Worksheet`, `../exact-canvas`)

```
 Exact Worksheet (Mac, :7790, Python)            Exact Canvas (Mac, :4747, Tauri)
   buat soal via Gemini/Claude, render PDF          kanvas kelas, akun murid (No. HP),
        │  ▲                                        antrean pertanyaan, papan guru
 push   │  │ pull (HTTP, tanpa auth, 127.0.0.1)            ▲  /api/akun/masuk|saya (login murid)
 terbit │  │ /buat /status /api/soal /batal                │  /api/kelas/masuk|tanya (x-exact-pin)
        ▼  │ /api/render /berkas /api/potret-html          │  /api/akun/sesi (PIN + loopback saja)
 ┌──────────────── Exact Practice (:8770, Next.js) ─────────┘
 │ POST /api/latihan/terbit  (header x-exact-kunci = EXACT_PRACTICE_KUNCI)
 └── publik lewat Cloudflare Tunnel → murid (masuk dengan kode ujian)
```

### Peta direktori

```
src/app/                    halaman & route API (App Router)
  (app)/latihan             murid: paket dari guru, bank soal acak, riwayat, cari kode ujian
  ujian/[attemptId]         ruang ujian (ExamRunner) + tombol Tanya guru + PapanGuru (iframe Canvas)
  hasil/[attemptId]         hasil & pembahasan
  admin/latihan             guru: buat soal, susun paket, cetak PDF, terbit/sembunyi
  admin/kelas               pantau kemajuan & kesalahan per murid/paket
  admin/peserta             peran & akomodasi waktu murid
  api/latihan/terbit        MASUKAN dari Worksheet (kunci bersama)
  api/latihan/cetak|tanya   KELUARAN ke Worksheet (PDF) / Canvas (tanya guru)
  api/admin/latihan/*       buat (via Worksheet), bank, paket, tempel (naskah dari AI)
src/lib/db/                 SATU pintu penyimpanan: getDb() → dev.ts (berkas) | supabase.ts
src/lib/practice/           khas Exact Course: paket.ts, latihan.ts, worksheet.ts, canvas.ts,
                            sandi.ts, akses.ts, naskah.ts, promptAI.ts, diagrams.js (SALINAN)
src/lib/exams/              mesin ujian warisan Try Out: bank, attempt, grade, scoring, sanitize…
src/lib/auth.ts             sesi: cookie sendiri (mode berkas) / Supabase Auth (mode Supabase)
src/components/exam/        ExamPlayer, QuestionView, RichText (KaTeX), PapanGuru, Calculator
supabase/migrations/        0001–0015 skema Postgres + RLS (warisan Try Out; BELUM ada tabel paket)
prompts/                    prompt AI warisan Try Out (SAT/UTBK/CSCA/A-Level)
question-bank/              ±100 berkas JSON soal Try Out (diimpor lewat `npm run import`)
scripts/                    import/seed/validate/make-admin + test-exams & test-webhooks
menubar/                    menu bar macOS "EP" (Swift)
pasang-app.sh               build → ~/Library/Application Support/Exact Practice/app + LaunchAgent
pasang-tunnel.sh            Cloudflare Tunnel per Mac
```

### Dua mode penyimpanan — PENTING

`src/lib/db/index.ts`: `usingDev()` = true selama `NEXT_PUBLIC_SUPABASE_URL` atau
`SUPABASE_SERVICE_ROLE_KEY` kosong. **Produksi saat ini memakai MODE BERKAS.**

| Data | Mode berkas (produksi sekarang) | Mode Supabase |
|---|---|---|
| akun (username di kolom `email`), sesi, attempt | `<data>/db.json` (dev.ts) | tabel Postgres (supabase.ts) |
| bank soal | `<data>/question-bank.json` | tabel `questions` |
| paket latihan + peserta (kode ujian) | `<data>/paket.json` | **tetap berkas** (paket.ts selalu fs) |
| daftar username + sandi (langsung aktif) | ✅ | ❌ "hanya untuk mode berkas" |
| masuk pakai akun Canvas | ✅ | ❌ |
| login | username+sandi (cookie sendiri) | sandi Supabase (warisan, tidak dipakai) |

`<data>` = `EXACT_DATA_DIR` atau `./.data`. Di Mac produksi:
`~/Library/Application Support/Exact Practice/data/`.
Artinya: **semua fitur khas Exact Course hanya jalan di mode berkas** — dan mode berkas
butuh filesystem yang bisa ditulis (tidak ada di Vercel/Cloudflare Workers).

## Perintah penting

```bash
npm ci                       # pasang dependensi (pakai lockfile)
npm run dev                  # http://localhost:8770 (mode berkas bila .env.local tanpa Supabase)
npm run typecheck            # tsc --noEmit — WAJIB hijau
npm run build                # next build — WAJIB hijau sebelum pasang-app.sh / deploy
npm run test:exams           # uji mesin ujian + kode ujian (data sementara sendiri)
npm run validate             # validasi struktur JSON soal
npm run import -- <file>     # impor soal ke bank
node scripts/make-admin.mjs email@guru   # jadikan admin (mode berkas: set EXACT_DATA_DIR)
./pasang-app.sh [--tanpa-build]          # pasang/ulang layanan di Mac
```

Uji yang menulis data: selalu `EXACT_DATA_DIR=$(mktemp -d)` — JANGAN menyentuh folder
data produksi di Application Support.

### Variabel lingkungan

Salin `.env.contoh` (khas Exact Course) — `.env.example` adalah warisan Try Out
(Supabase, Stripe, Midtrans, Resend, kunci AI) dan kebanyakan tidak dipakai di mode berkas.

| Var | Guna |
|---|---|
| `ADMIN_USERNAMES` | username yang otomatis jadi guru/admin saat mendaftar (`ADMIN_EMAILS` lama masih dibaca) |
| `EXACT_WORKSHEET_URL` | alamat Worksheet (bawaan `http://127.0.0.1:7790`) |
| `EXACT_CANVAS_URL` / `EXACT_CANVAS_PUBLIC` / `EXACT_CANVAS_PIN` | Canvas lokal, publik, PIN berbagi |
| `EXACT_PRACTICE_KUNCI` | kunci bersama dengan Worksheet (`practice.json` → `kunci`) |
| `EXACT_PRACTICE_PUBLIC`, `NEXT_PUBLIC_SITE_URL` | alamat publik Practice |
| `EXACT_DATA_DIR` | lokasi folder data mode berkas |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | diisi = pindah ke mode Supabase |

## Peran (pilih sesuai permintaan)

### 1. Dev Aplikasi
- Ubah sekecil mungkin, ikuti idiom yang ada: komentar Bahasa Indonesia yang menjelaskan
  **mengapa** (lihat gaya komentar di `paket.ts`, `dev.ts`), nama fungsi Indonesia untuk
  kode khas Practice, Inggris untuk kode warisan Try Out.
- Akses data HANYA lewat `getDb()` / modul di `src/lib/practice/`. Route jangan mengimpor
  `devDb`/`supabaseDb` langsung.
- Fitur baru yang menyimpan data: tentukan dulu perilakunya di KEDUA mode, atau tolak
  dengan pesan jelas di mode yang tidak didukung (pola `usingDev()` yang sudah ada).
  Catat di PLANS.md kalau menambah utang "hanya mode berkas".
- Selesai: `npm run typecheck && npm run build`, jalankan QA (peran 4), update TASKS.md.

### 2. Integrasi Worksheet / Canvas
- Kontrak butir soal (`Butir` di `src/lib/practice/worksheet.ts`) = keluaran
  `naskah.urai()` di Worksheet. Ubah di satu sisi → ubah sisi lain di commit berpasangan,
  catat di kedua TASKS.md.
- `diagrams.js` di sini adalah SALINAN IDENTIK `Exact-Worksheet/wsm/diagrams.js`.
  Jangan disunting di sini; sunting di Worksheet lalu salin
  (`cp ../Exact-Worksheet/wsm/diagrams.js src/lib/practice/diagrams.js`), commit
  "Sinkron diagrams.js dari Worksheet: …". Cek: `diff -q` harus kosong. Canvas juga
  memegang salinannya — sinkronkan sekalian.
- Endpoint Worksheet yang dipakai: `/buat`, `/status`, `/api/soal`, `/batal`, `/api/render`,
  `/berkas`, `/api/potret-html`. Endpoint itu TANPA autentikasi — hanya aman di loopback.
- Endpoint Canvas (repo `../exact-canvas`, lihat AGENTS.md di sana):
  `/api/akun/masuk` & `/api/akun/saya` (login murid, publik), `/api/kelas/masuk` &
  `/api/kelas/tanya` (PIN `x-exact-pin`), `/api/akun/sesi` (PIN + loopback saja, menolak
  permintaan lewat proxy). Ubah pemakaiannya → commit berpasangan di Canvas (`C-xxx`).

### 3. Deploy / Infrastruktur
- Status quo: Mac + LaunchAgent + Cloudflare Tunnel (`PASANG.md`, `PASANG-MAC-BARU.md`).
  Jangan jalankan server produksi dari terminal; pakai `pasang-app.sh`.
- Jangan pernah menjalankan tunnel yang sama di dua Mac.
- Rencana pindah ke Cloudflare Workers: ikuti PLANS.md §Deploy. Keputusan K1–K4 di sana
  harus dijawab user dulu — jangan mulai migrasi penyimpanan tanpa itu.

### 4. QA / Testing
- Minimal sebelum menyatakan selesai: `npm run typecheck`, `npm run build`,
dan `npm run test:exams` (dengan `EXACT_DATA_DIR` sementara
  yang berisi satu user).
- Perubahan ruang ujian: pastikan kunci jawaban tidak bocor —
  `curl -s localhost:8770/ujian/<id> | grep -c '"explanation"'` harus 0.
- Perubahan jembatan Worksheet: uji ujung-ke-ujung (buat lembar → Ke Practice → paket
  muncul di `/admin/latihan` → dikerjakan → hasil benar).

### 5. Dokumentasi
- `TASKS.md`: tiap tugas selesai → baris bernomor `P-xxx`. Commit: `P-xxx: deskripsi`.
- `PLANS.md`: keputusan baru / perubahan arah → catat dengan alasannya (Dxx).
- `README.md` untuk manusia; `AGENTS.md` untuk Claude; runbook pasang di `PASANG*.md`.

### 6. Brainstorm / Analisa kebutuhan
- Gali kode & data dulu sebelum bertanya. Keputusan yang menentukan arah bisnis
  (siapa bayar, siapa boleh apa, di mana data disimpan) → TANYA user, jangan diasumsikan.
- Hasilnya dicatat di PLANS.md, eksekusinya di TASKS.md.

## INVARIAN (jangan dilanggar tanpa persetujuan user)

1. **Kunci jawaban tidak pernah dikirim ke browser sebelum submit.** Soal untuk ruang ujian
   selalu lewat `src/lib/exams/sanitize.ts`; penilaian 100% di server.
2. **Jam ujian dipegang server.** Tenggat section ditulis sekali (`startSection`), `/save`
   menolak jawaban lewat tenggat (409). Satu soal tidak boleh muncul di dua section.
3. **Satu pintu penyimpanan**: `getDb()`. Penulisan berkas selalu atomik (tulis `.tmp` lalu
   `rename`) dan berurutan (antrean janji di `dev.ts`) — jangan dibypass.
4. **Uji tidak menyentuh data produksi**: pakai `EXACT_DATA_DIR` sementara. Jalur berkas bank
   hanya ditentukan di `bankFile()`.
5. **`/api/latihan/terbit` dijaga kunci bersama** (`timingSafeEqual`), bukan alamat asal —
   di balik tunnel semua permintaan tampak dari localhost.
6. **Id soal latihan stabil**: `prc-<paketId>-<kode>[-s<set>]`; menerbitkan ulang lembar yang
   sama (PDF + set sama) MEMPERBARUI paket yang sama, bukan membuat baru.
7. **Redirect di balik tunnel memakai `Location` relatif** — origin yang dilihat Node adalah
   `http://localhost`; memakainya melempar murid keluar dari HTTPS.
8. **Internal, tidak dijual; kode ujian adalah gerbangnya.** Murid daftar sendiri (nama +
   username + sandi, langsung aktif, tanpa email/HP/persetujuan). Murid hanya melihat &
   membuka paket terbit yang kodenya sudah ia masukkan — `bolehBuka()` di `paket.ts` WAJIB
   dipakai setiap rute yang membuka isi paket (mulai, cetak). `savePaket` mempertahankan
   `peserta` bila pemanggil tidak menyebutnya (terbit ulang dari Worksheet). Tidak ada
   pembayaran/afiliasi/pesanan (dihapus P-043).
9. **`diagrams.js` identik dengan Worksheet (dan Canvas)** (lihat peran 2).
10. **Server untuk murid WAJIB build produksi** (`next build` + `next start`, lewat
    `pasang-app.sh`), JANGAN `npm run dev`. Mode dev React/Next menyerialisasi hasil I/O
    server ke browser untuk DevTools — isi `question-bank.json` (kunci + pembahasan) ikut
    terkirim ke halaman ujian (terbukti 24 Sep 2026, P-040). `npm run dev` hanya untuk
    pengembangan di localhost.
11. **Rahasia tidak masuk git**: `.env.local`, `practice.json`, `~/.cloudflared/*`,
    folder data.
