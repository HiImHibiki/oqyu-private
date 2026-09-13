# Exact Practice

Latihan & ujian online untuk murid bimbel Exact Course — cabang dari Exact Try Out
(Next.js 15, React 19, mesin ujian & bank soal yang sama), ditambah:

- **Buat soal otomatis** — guru mengetik topik, Gemini (lewat [Exact Worksheet](https://github.com/Exact-Digital/Exact-Worksheet)) menulis soal, kunci, dan pembahasannya; hasilnya langsung masuk bank soal (`exam: LATIHAN`) dan jadi paket.
- **Bisa dicetak** — PDF lembar soal / kunci dirender Exact Worksheet Maker (`/api/latihan/cetak?id=…[&kunci=1]`).
- **Bisa dikerjakan online** — ruang ujian Exact Try Out (jam di server, autosave, hasil & pembahasan), tanpa kuota berbayar.
- **Bank soal untuk murid** — murid memilih mapel/kelas/topik dan mendapat latihan acak.
- **Tanya guru** — dari ruang ujian, soal yang sedang dibuka dikirim (teks + gambar) ke antrean pertanyaan **Exact Canvas**, lalu layar murid Canvas terbuka di tab baru.
- **Pantau kelas** — guru melihat per murid: paket mana yang dikerjakan, sampai nomor berapa, nomor mana yang salah; dan per paket, nomor yang paling sering salah.

Alamat publik: https://practice.exactprintsolution.com (Cloudflare Tunnel `exact-practice` → port 8770).

## Menu

| Siapa | Halaman | Isi |
|---|---|---|
| Murid | `/latihan` | paket dari guru, bank soal (latihan acak), riwayat |
| Murid | `/ujian/[id]` | ruang ujian + tombol **Tanya guru** |
| Guru | `/admin/latihan` | buat soal dengan Gemini, susun paket dari bank, cetak PDF, terbitkan/sembunyikan |
| Guru | `/admin/kelas` | pantauan kemajuan & kesalahan |
| Guru | `/admin/soal` | bank soal (warisan Try Out) |

Murid mendaftar sendiri di `/daftar` dengan **kode kelas** (`EXACT_KODE_KELAS` di `.env.local`).
Email di `ADMIN_EMAILS` otomatis berperan guru/admin saat mendaftar.

## Berkas penting

- `src/lib/practice/worksheet.ts` — jembatan ke Exact Worksheet (`/buat`, `/status`, `/api/soal`, `/api/render`, `/api/potret-html`, `/berkas`) + konversi butir ↔ `Question`.
- `src/lib/practice/canvas.ts` — jembatan ke Exact Canvas (`/api/kelas/masuk`, `/api/kelas/tanya`, header `x-exact-pin`).
- `src/lib/practice/paket.ts` — penyimpanan paket (`<data>/paket.json`).
- `src/lib/practice/latihan.ts` — attempt dari paket/acak, ringkasan kemajuan untuk guru.
- `src/app/api/latihan/*`, `src/app/api/admin/latihan/*` — rute API.
- `pasang-app.sh` — build, salin ke `~/Library/Application Support/Exact Practice/app`, pasang LaunchAgent `com.exactcourse.practice`.

Cara pasang di Mac lain: lihat [PASANG.md](PASANG.md).
