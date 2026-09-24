# CLAUDE.md — Workspace Exact (Worksheet + Canvas + Practice)

> Kalau kamu dipanggil sebagai **mesin pembuat naskah** Exact Worksheet
> (cwd = `Exact-Worksheet/claude-proyek/`), ABAIKAN file ini dan ikuti
> `claude-proyek/CLAUDE.md` saja.

Folder ini BUKAN repo git. Isinya tiga repo terpisah yang saling memanggil lewat HTTP dan
(saat ini) jalan bersama di SATU Mac guru, dibuka ke internet lewat Cloudflare Tunnel:

| Folder | Repo | Stack | Port | Prefix tugas |
|---|---|---|---|---|
| `Exact-Worksheet/` | `Exact-Digital/Exact-Worksheet` | Python 3 stdlib + Chrome (CDP) + Swift OCR, macOS | 7790 | `W-xxx` |
| `exact-canvas/` | `ricokurniawan18-ui/exact-canvas` | Tauri 2 (Rust/axum) + React 19 + Vite, macOS | 4747 | `C-xxx` |
| `Exact-Practice/` | `Exact-Digital/Exact-Practice` | Next.js 15 + React 19 + (berkas JSON / Supabase) | 8770 | `P-xxx` |

```
Worksheet ──terbit (kunci bersama)──► Practice ◄──login akun, Tanya guru, papan guru── Canvas
   ▲                                      │                                          ▲
   └──── buat soal, cetak PDF, potret ────┘ (127.0.0.1, tanpa auth)    tombol 📝 ────┘
```

Kontrak antar-repo yang harus dijaga bersama:
- **Butir soal** (`naskah.urai()` Worksheet ↔ `Butir` di Practice `src/lib/practice/worksheet.ts`).
- **`diagrams.js`** — sumber tunggal `Exact-Worksheet/wsm/diagrams.js`; disalin identik ke
  Practice (`src/lib/practice/diagrams.js`) dan ke Canvas (`src/lib/diagrams.js`, + ekor export
  via `scripts/salin-diagrams.mjs`).
- **Endpoint Canvas** yang dipakai Practice: `/api/akun/masuk|saya|sesi`, `/api/kelas/masuk|tanya`.

Catatan: Exact-Practice **bukan** turunan ExactQuiz lama (`~/Projects/ExactSuper/ExactQuiz`,
Express + pg di Vercel) — Practice adalah cabang dari **Exact Try Out**.

Sebelum mengerjakan apa pun, masuk ke repo yang relevan dan baca `CLAUDE.md` di sana
(→ `AGENTS.md`, `PLANS.md`, `TASKS.md`). Perubahan yang menyentuh kontrak antar-repo WAJIB
dicatat di semua `TASKS.md` yang terlibat dengan nomor pasangannya (`↔ P-xxx` dst.).
Analisis deploy & keputusan terbuka ada di `Exact-Practice/PLANS.md` §Deploy.
