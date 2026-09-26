# oqyu-private

Monorepo tiga aplikasi Exact Course yang bekerja bersama di satu Mac server
(dibuka ke internet lewat Cloudflare Tunnel):

| Folder | Aplikasi | Stack | Port |
|---|---|---|---|
| [`Exact-Worksheet/`](Exact-Worksheet/README.md) | pembuat lembar kerja & soal (Gemini/Claude → PDF) | Python + Chrome + Swift, macOS | 7790 |
| [`exact-canvas/`](exact-canvas/README.md) | kanvas kelas langsung (guru, TV, HP murid) | Tauri (Rust) + React | 4747 |
| [`Exact-Practice/`](Exact-Practice/README.md) | latihan & ujian online murid | Next.js 15 + React 19 | 8770 |

Basis kode per 24 Sep 2026, digabung dari tiga repo asal dengan riwayat commit utuh:
`Exact-Digital/Exact-Worksheet`, `ricokurniawan18-ui/exact-canvas`,
`Exact-Digital/Exact-Practice`.

Menjalankan semua server di Mac ini: `./run-server.sh` (status: `./run-server.sh status`,
matikan: `stop`, log: `logs <worksheet|practice|canvas>`, Practice mode dev: `dev`).

Pemasangan di Mac: `Exact-Practice/PASANG-MAC-BARU.md`. Daftar fitur: [`FITUR.md`](FITUR.md).
Untuk pengembang (dan Claude): mulai dari [`CLAUDE.md`](CLAUDE.md).
