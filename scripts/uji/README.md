# Skrip uji (jalankan saat aplikasi Mac menyala dengan berbagi aktif, PIN 1234)

Semua memakai Node ≥ 22 (WebSocket & fetch bawaan) dan server di `127.0.0.1:4747`.
Data uji dibuat dengan awalan `uji_` dan dibersihkan sendiri di akhir.

| Skrip | Isi |
|-------|-----|
| `uji-fungsi.mjs` | Regresi API, hub WebSocket, alur kelas (29 pemeriksaan). |
| `uji-kelas.mjs` | Alur murid: masuk → tanya berfoto → lampu fokus → dibahas → foto → selesai. |
| `uji-gambar.mjs` | Menggambar di editor web lewat DevTools; pengikut menerima goresan; tersimpan. Butuh Google Chrome. |
| `uji-murid-kanvas.mjs` | Kanvas khusus murid: foto → kanvas baru; PDF → kanvas yang sama, halaman berikutnya. Butuh Chrome. |
| `uji-akun.mjs` | Akun murid: daftar/masuk/sesi tanpa PIN, izin coret, goresan murid diteruskan & disimpan server, reset sandi. `ADMIN=<sandi admin>`. |
| `uji-hp-akun.mjs` | Halaman HP di Chrome headless: daftar dari formulir → menunggu persetujuan → diterima → Join → ganti ruangan → izin coret → menggambar → tersimpan → sign out. `ADMIN=<sandi admin>`. |
| `uji-beban.mjs` | 40 HP, 3 ruangan, 4 grup, semua mengantri; guru menulis 60 paket/dtk; laporan latensi & CPU/RSS proses. |

Contoh: `S=/tmp node scripts/uji/uji-fungsi.mjs`. Skrip berbasis Chrome memakai
port debug 9333 dan alamat LAN Mac (`192.168.51.61`) — sesuaikan bila IP berubah.
