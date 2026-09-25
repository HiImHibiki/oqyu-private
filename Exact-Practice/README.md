# Exact Practice

Latihan & ujian online untuk murid les privat Exact Course (pemakaian internal, tidak dijual) — cabang dari Exact Try Out
(Next.js 15, React 19, mesin ujian & bank soal yang sama), ditambah:

- **Dari Exact Worksheet** — alur utama: guru membuat lembar seperti biasa di [Exact Worksheet](https://github.com/Exact-Digital/Exact-Worksheet) (topik/foto), lalu menekan **Ke Practice** (di baris tugas atau tombol **Practice** di tab Hasil). Worksheet mengirim butir soal ke `POST /api/latihan/terbit` (kunci bersama `EXACT_PRACTICE_KUNCI` = `practice_kunci` di setelan.json Worksheet); jadi paket terbit + masuk bank soal.
- **Buat soal dari Practice** — `/admin/latihan` juga bisa memerintah Worksheet langsung (topik → Gemini → paket).
- **Bisa dicetak** — PDF lembar soal / kunci dirender Exact Worksheet Maker (`/api/latihan/cetak?id=…[&kunci=1]`).
- **Bisa dikerjakan online** — ruang ujian Exact Try Out (jam di server, autosave, hasil & pembahasan).
- **Kode ujian** — murid daftar sendiri (nama + username + sandi, langsung aktif), lalu memasukkan kode ujian 6 huruf dari guru; hanya paket yang kodenya dimasukkan yang terlihat.
- **Tanya guru** — dari ruang ujian, soal yang sedang dibuka dikirim (teks + gambar) ke antrean pertanyaan **Exact Canvas**, lalu layar murid Canvas terbuka di tab baru.
- **Pantau kelas** — guru melihat per murid: paket mana yang dikerjakan, sampai nomor berapa, nomor mana yang salah; dan per paket, nomor yang paling sering salah.

Server: port 8770 di Mac guru, dibuka ke internet lewat Cloudflare Tunnel milik pemasang (`pasang-tunnel.sh`).

## Menu

| Siapa | Halaman | Isi |
|---|---|---|
| Murid | `/latihan` | masukkan kode ujian, Paket saya, riwayat |
| Murid | `/ujian/[id]` | ruang ujian + tombol **Tanya guru** |
| Guru | `/admin/latihan` | buat soal dengan Gemini, susun paket dari bank, cetak PDF, terbitkan/sembunyikan |
| Guru | `/admin/kelas` | pantauan kemajuan & kesalahan |
| Guru | `/admin/soal` | bank soal (warisan Try Out) |

## Siapa boleh apa

| Pengguna | Cara masuk | Yang terlihat |
|---|---|---|
| Murid | daftar di `/daftar` (nama, username, sandi) → langsung aktif; atau akun Exact Canvas (No. HP + sandi) | hanya paket yang kode ujiannya sudah ia masukkan di `/latihan` (dan paket itu sedang terbit) |
| Guru/admin | username di `ADMIN_USERNAMES` saat mendaftar, atau dinaikkan di `/admin/peserta`; masuk di `/admin/masuk` | semua paket |

Tiap paket punya **kode ujian** 6 huruf (kartu di `/admin/latihan`: **Salin kode** atau **Salin tautan** —
tautan `/latihan?kode=XXXXXX` langsung mengisi kotak kode). Menutup paket (tidak terbit) membuatnya
hilang dari murid dan kodenya tidak bisa dipakai. Tidak ada pembayaran, afiliasi, atau pesanan.

## Berkas penting

- `src/lib/practice/worksheet.ts` — jembatan ke Exact Worksheet (`/buat`, `/status`, `/api/soal`, `/api/render`, `/api/potret-html`, `/berkas`) + konversi butir ↔ `Question`.
- `src/lib/practice/canvas.ts` — jembatan ke Exact Canvas (`/api/kelas/masuk`, `/api/kelas/tanya`, header `x-exact-pin`).
- `src/lib/practice/paket.ts` — penyimpanan paket (`<data>/paket.json`) + keanggotaan lewat kode ujian (`gabungPaket`, `bolehBuka`).
- `src/lib/practice/latihan.ts` — attempt dari paket, ringkasan kemajuan untuk guru.
- `src/app/api/latihan/*`, `src/app/api/admin/latihan/*` — rute API.
- `pasang-app.sh` — build, salin ke `~/Library/Application Support/Exact Practice/app`, pasang LaunchAgent `com.exactcourse.practice`, dan membangun **menu bar "EP"** (`menubar/MenuBar.swift` → `~/Applications/Exact Practice Bar.app`, Login Item): status layanan, buka halaman guru, nyalakan/matikan/mulai ulang layanan, buka log.

Cara pasang di Mac lain: lihat [PASANG.md](PASANG.md).
