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

## Siapa boleh apa

| Pengguna | Cara masuk | Biaya | Tanya guru (Canvas) |
|---|---|---|---|
| Murid Exact Course | akun Exact Canvas (No. HP + sandi) atau daftar dengan kode kelas → disetujui guru di `/admin/peserta` | gratis | ya |
| Umum (teman murid) | `/beli`: pilih paket, isi nama/email/WA (+ kode afiliasi), transfer, konfirmasi WA → admin **Tandai lunas** di `/admin/pesanan` → akun + **sandi sementara** dibuat otomatis (tampil di halaman pesanan, tombol "Kirim akun via WA") | paket berjangka: 1 minggu Rp20.000, 1 bulan Rp60.000, 3 bulan Rp150.000 (`src/lib/packages.ts`, `exam: LATIHAN`) | tidak |

Tiap paket latihan punya **kode ujian** 6 huruf (kartu di `/admin/latihan`, tombol Salin kode / Salin tautan). Murid & pembeli mencari ujian di `/latihan` dengan nama atau kode.

**Afiliasi**: murid mengaktifkan kode di `/afiliasi`; tautan `/r/KODE` → `/beli?ref=KODE`. Komisi (15%, `src/lib/affiliate.ts`) lahir saat admin menandai lunas; pencairan manual di `/admin/afiliasi`.

Isi `NEXT_PUBLIC_ADMIN_WHATSAPP` (nomor WA admin) dan `NEXT_PUBLIC_BANK_*` (rekening) di `.env.local` agar tombol konfirmasi & instruksi transfer muncul.
Email di `ADMIN_EMAILS` otomatis berperan guru/admin saat mendaftar.

## Berkas penting

- `src/lib/practice/worksheet.ts` — jembatan ke Exact Worksheet (`/buat`, `/status`, `/api/soal`, `/api/render`, `/api/potret-html`, `/berkas`) + konversi butir ↔ `Question`.
- `src/lib/practice/canvas.ts` — jembatan ke Exact Canvas (`/api/kelas/masuk`, `/api/kelas/tanya`, header `x-exact-pin`).
- `src/lib/practice/paket.ts` — penyimpanan paket (`<data>/paket.json`).
- `src/lib/practice/latihan.ts` — attempt dari paket/acak, ringkasan kemajuan untuk guru.
- `src/app/api/latihan/*`, `src/app/api/admin/latihan/*` — rute API.
- `pasang-app.sh` — build, salin ke `~/Library/Application Support/Exact Practice/app`, pasang LaunchAgent `com.exactcourse.practice`.

Cara pasang di Mac lain: lihat [PASANG.md](PASANG.md).
