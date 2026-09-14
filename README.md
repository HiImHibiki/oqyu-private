# Exact Practice

Latihan & ujian online untuk murid bimbel Exact Course — cabang dari Exact Try Out
(Next.js 15, React 19, mesin ujian & bank soal yang sama), ditambah:

- **Dari Exact Worksheet** — alur utama: guru membuat lembar seperti biasa di [Exact Worksheet](https://github.com/Exact-Digital/Exact-Worksheet) (topik/foto), lalu menekan **Ke Practice** (di baris tugas atau tombol **Practice** di tab Hasil). Worksheet mengirim butir soal ke `POST /api/latihan/terbit` (kunci bersama `EXACT_PRACTICE_KUNCI` = `practice_kunci` di setelan.json Worksheet); jadi paket terbit + masuk bank soal.
- **Buat soal dari Practice** — `/admin/latihan` juga bisa memerintah Worksheet langsung (topik → Gemini → paket).
- **Bisa dicetak** — PDF lembar soal / kunci dirender Exact Worksheet Maker (`/api/latihan/cetak?id=…[&kunci=1]`).
- **Bisa dikerjakan online** — ruang ujian Exact Try Out (jam di server, autosave, hasil & pembahasan), tanpa kuota berbayar.
- **Bank soal untuk murid** — murid memilih mapel/kelas/topik dan mendapat latihan acak.
- **Tanya guru** — dari ruang ujian, soal yang sedang dibuka dikirim (teks + gambar) ke antrean pertanyaan **Exact Canvas**, lalu layar murid Canvas terbuka di tab baru.
- **Pantau kelas** — guru melihat per murid: paket mana yang dikerjakan, sampai nomor berapa, nomor mana yang salah; dan per paket, nomor yang paling sering salah.

Alamat publik: https://practice2.exactprintsolution.com (Cloudflare Tunnel `exact-practice` → port 8770).

## Menu

| Siapa | Halaman | Isi |
|---|---|---|
| Murid | `/latihan` | paket dari guru, bank soal (latihan acak), riwayat |
| Murid | `/ujian/[id]` | ruang ujian + tombol **Tanya guru** |
| Guru | `/admin/latihan` | buat soal dengan Gemini, susun paket dari bank, cetak PDF, terbitkan/sembunyikan |
| Guru | `/admin/kelas` | pantauan kemajuan & kesalahan |
| Guru | `/admin/soal` | bank soal (warisan Try Out) |

**Gratis** — tidak ada paket berbayar, kuota, maupun langganan. Murid masuk dengan akun Exact Canvas (No. HP + sandi), atau mendaftar di `/daftar` dengan **kode kelas** (`EXACT_KODE_KELAS`) lalu menunggu **persetujuan guru** di `/admin/peserta` (tombol Setujui).
Email di `ADMIN_EMAILS` otomatis berperan guru/admin saat mendaftar.

## Berkas penting

- `src/lib/practice/worksheet.ts` — jembatan ke Exact Worksheet (`/buat`, `/status`, `/api/soal`, `/api/render`, `/api/potret-html`, `/berkas`) + konversi butir ↔ `Question`.
- `src/lib/practice/canvas.ts` — jembatan ke Exact Canvas (`/api/kelas/masuk`, `/api/kelas/tanya`, header `x-exact-pin`).
- `src/lib/practice/paket.ts` — penyimpanan paket (`<data>/paket.json`).
- `src/lib/practice/latihan.ts` — attempt dari paket/acak, ringkasan kemajuan untuk guru.
- `src/app/api/latihan/*`, `src/app/api/admin/latihan/*` — rute API.
- `pasang-app.sh` — build, salin ke `~/Library/Application Support/Exact Practice/app`, pasang LaunchAgent `com.exactcourse.practice`.

Cara pasang di Mac lain: lihat [PASANG.md](PASANG.md).
