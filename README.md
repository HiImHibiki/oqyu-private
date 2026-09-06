# Exact Canvas

Aplikasi macOS khusus kanvas sketsa untuk pen tablet (Wacom), dipisahkan dari
modul Canvas di Exact Dashboard Workspace. Seluruh fitur kanvas disalin utuh:

- Alat: pena, pensil, kaligrafi, kuas, stabilo, penghapus (sebagian / goresan),
  laso bebas, laso kotak, teks, dan bentuk geometri yang tetap bisa disunting
  (garis, panah, kotak, elips, lingkaran, segitiga, kubus, balok, sumbu, dsb).
- Tekanan pena, ujung belakang pena Wacom = penghapus, *steady hand*,
  *hold to shape* (tahan pena diam → coretan dikunci jadi bentuk rapi).
- Tiga lapisan (sembunyi / kunci / kosongkan), riwayat undo-redo, duplikasi ⌘D.
- Kanvas tak terbatas dengan peta mini, atau kertas berhalaman (A4/A3/Letter)
  dengan daftar halaman, sisip/hapus halaman, dan pratinjau tiap halaman.
- Latar polos / titik / petak / garis; ketebalan, kepekatan, pola garis per alat;
  bilah alat cepat yang bisa disusun ulang (⌘1–⌘9 mengikuti posisinya).
- Tempel gambar (⌘V / seret berkas), impor PDF per halaman, impor Word/PowerPoint
  (lewat LibreOffice bila terpasang, atau `textutil` bawaan macOS).
- Ekspor PNG, SVG, PDF (anggaran 10 MB) dan cetak lewat Preview (⌘P).
- Beberapa sketsa: buat (⌘N), ganti nama, gandakan, hapus dengan Undo.
- Beberapa jendela kanvas sekaligus (⌘⇧N), 18 tema, pengaturan kecepatan gulir/zoom.

Tambahan khusus untuk mengajar:

- **Kursor per alat**: ujung kursor adalah ikon alatnya; penghapus memperlihatkan
  bidang hapusnya.
- **Penggaris, busur derajat, jangka** (panel Instruments): digeser/diputar lewat
  pegangannya; goresan yang dimulai di tepi ukur, di busur, atau di ujung pensil
  jangka dikunci ke sana, dengan bacaan panjang (cm) atau sudut (°) langsung.
  1 cm penggaris = 1 cm pada cetakan A4.
- **Grafik fungsi** (panel Insert): beberapa fungsi sekaligus (`x^2-4`, `sin(x)`,
  `1/x`, `2x+1`), rentang sumbu, petak, ukuran; masuk sebagai gambar yang tetap
  bisa disunting (pilih dengan laso, ketuk lagi).
- **Tabel**: baris/kolom, baris kepala, sel boleh kosong untuk diisi tulisan tangan.
- **Pengenalan bentuk** lebih baik: panah satu tarikan, garis dikunci ke 0°/45°/90°,
  segitiga siku-siku dirapikan; opsi **Auto shapes** (panel Stroke) mengenali
  bentuk saat pena diangkat tanpa perlu menahan.

## Data

Sketsa disimpan sebagai berkas JSON di folder vault, bawaan `~/ExactCanvas`
(atau `ExactCanvas` di iCloud Drive kalau folder itu sudah ada dari Mac lain).
Database SQLite `exact-canvas.db` di dalamnya hanya menyimpan indeks judul dan
setelan. Folder bisa dipindah dari Settings (⌘,) → Vault.

## Menjalankan

```sh
npm install
npm run app          # tauri dev
npm run app:build    # .app + .dmg di src-tauri/target/release/bundle/
npm run icons        # bangun ulang ikon aplikasi
```

Butuh Node 20+, Rust stable, dan Xcode Command Line Tools.

## Memasang di Mac lain

Buka berkas `.dmg`, seret **Exact Canvas** ke Applications. Karena aplikasi tidak
ditandatangani Apple Developer ID, saat pertama dibuka macOS akan menolak; klik
kanan → **Open**, atau jalankan:

```sh
xattr -dr com.apple.quarantine "/Applications/Exact Canvas.app"
```
