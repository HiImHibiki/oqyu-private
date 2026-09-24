# Rencana: Kelas Langsung — nama, antrian tanya, foto soal, proctoring, 3 ruangan

Konteks: Mac di ruangan 1, guru berkeliling ke ruangan 2 dan 3 membawa tablet,
30–40 murid membuka halaman pengikut di HP masing-masing. Semua lewat server
yang sudah ada di aplikasi Mac (Wi-Fi lokal, nanti bisa lewat Cloudflare).

## 1. Peran & layar

| Siapa  | Perangkat | Halaman   | Yang bisa dilakukan |
|--------|-----------|-----------|---------------------|
| Murid  | HP        | `/tv` (+ bilah murid) | masuk nama & ruangan, mengikuti papan, angkat tangan, kirim pertanyaan (teks/foto), tanda "sudah paham" |
| Guru   | Mac       | aplikasi  | mengajar di ruangan 1, melihat antrian semua ruangan, menandai selesai |
| Guru   | Tablet    | `/` (editor) | pindah ruangan, buka pertanyaan → foto langsung jadi sketsa jawaban, coret, kirim balik |
| TV     | 3 unit    | `/tv?ruang=N` | layar besar tiap ruangan |

## 2. Ruangan

- Tiap pengikut (HP/TV) memilih ruangan saat masuk: `?ruang=1|2|3` di tautan
  TV, atau pilihan di layar masuk HP (diingat).
- Tiap editor punya ruangan aktif: Mac = ruangan 1 (bisa diubah), tablet
  punya sakelar ruangan di rel. Membuka pertanyaan dari ruangan 2 otomatis
  memindahkan tablet ke ruangan 2.
- Pengikut mengikuti editor yang terakhir aktif **di ruangannya**. Guru yang
  menulis di tablet di ruangan 2 tidak menggeser layar ruangan 1 dan 3.

## 3. Masuk dengan nama

- Layar pertama di HP: nama (wajib), ruangan, lalu "Masuk". Disimpan di HP,
  jadi sesi berikutnya tinggal konfirmasi.
- Server mencatat `students` (id perangkat, nama, ruangan, pertama & terakhir
  terlihat) — ini sekaligus daftar hadir per sesi.
- Di Settings Mac: daftar murid yang sedang tersambung per ruangan, dengan
  waktu masuk.

## 4. Antrian pertanyaan

Bilah kecil di bawah layar HP, tidak menutupi papan:
- ✋ **Angkat tangan** — satu ketukan, masuk antrian tanpa isi.
- ❓ **Tanya** — ketik teks pendek dan/atau **foto** (kamera HP, `capture`),
  foto dikecilkan di HP (maks 1600 px) sebelum diunggah.
- ✅ **Sudah paham** — menutup pertanyaannya sendiri.

Di Mac dan tablet: panel **Antrian** (tombol di rel, dengan angka merah).
Urut waktu, tiap baris: ruangan, nama, cuplikan teks/thumbnail foto, sudah
menunggu berapa menit. Bunyi halus + toast saat ada yang baru (bisa dimatikan).
Aksi per pertanyaan:
- **Buka** — membuat sketsa "Tanya · Nama · 14:05" berisi fotonya (atau
  menempelkannya ke sketsa yang sedang terbuka), status jadi *ditangani*,
  tablet pindah ke ruangan murid itu.
- **Jawab pribadi** — HP murid itu saja yang mengikuti sketsa jawaban ini;
  HP lain di ruangan tetap mengikuti papan utama. Selesai → HP murid kembali
  ke papan.
- **Selesai** — tutup; tersimpan di riwayat.

Data: `questions` (id, student_id, ruangan, teks, foto_path, sketch_id, status
menunggu/ditangani/selesai, created_at, handled_at). Foto di
`vault/tanya/<tanggal>/<id>.jpg`.

## 5. Proctoring (pengawasan) — apa yang jujur bisa dilakukan browser

Browser **tidak bisa mencegah** murid membuka aplikasi lain. Yang bisa:
- **Mendeteksi**: halaman disembunyikan (pindah aplikasi/tab), jendela
  kehilangan fokus, keluar dari layar penuh, HP dikunci. Tiap kejadian dikirim
  ke server dengan waktu.
- **Menampilkan**: di panel Antrian/Kehadiran, tiap murid punya lampu:
  hijau (di papan), kuning (keluar < 30 dtk), merah (keluar lama / berkali-
  kali), plus hitungan "keluar 3× · total 2 m 10 d".
- **Meminta layar penuh** saat masuk (Android mendukung; iPhone terbatas).
- **Kunci sungguhan** hanya lewat sistem HP: Android *Screen pinning* (Pin
  windows) atau Samsung Kiosk/Knox — bisa diminta ke murid, tidak bisa
  dipaksa dari web. Panel akan memberi tahu apakah HP dalam layar penuh.

Rekapnya per sesi bisa diekspor (CSV): nama, ruangan, jam masuk/keluar,
berapa kali meninggalkan halaman, pertanyaan yang diajukan.

## 6. Apakah ini "class management"?

Sebagian: **kehadiran otomatis**, **riwayat pertanyaan per murid** (dengan
foto dan sketsa jawabannya), **catatan fokus**. Yang belum: jadwal, tugas &
nilai (rencana terpisah di RENCANA-KELAS-TUGAS.md). Keduanya memakai tabel
`students` yang sama, jadi bisa disatukan nanti tanpa mengubah data.

## 7. Tahapan

1. **Ruangan & nama & angkat tangan** (1 hari): layar masuk HP, ruangan pada
   pengikut dan editor, aturan "ikuti editor di ruanganku", tabel students,
   panel Antrian dasar, bunyi/toast.
2. **Pertanyaan berfoto & jawab di tablet** (1 hari): unggah foto, Buka →
   sketsa jawaban, jawab pribadi, selesai, riwayat.
3. **Proctoring & rekap** (½ hari): sinyal visibilitas/fokus/layar penuh,
   lampu status, ekspor CSV sesi.
4. **Polesan** (½ hari): sakelar bunyi, batas ukuran foto, hapus foto lama
   otomatis setelah N hari, mode "tanya dimatikan" saat ulangan.

## 8. Yang perlu Anda putuskan

1. Nama murid bebas diketik, atau dipilih dari daftar yang Anda siapkan (lebih
   rapi untuk kehadiran, butuh input awal)?
2. Saat guru menjawab pertanyaan satu murid, murid lain di ruangan itu tetap
   melihat papan utama (usulan), atau ikut melihat jawabannya?
3. Foto pertanyaan disimpan berapa lama? Usulan: 30 hari lalu dihapus otomatis.
4. Proctoring cukup lampu status + rekap (usulan), atau perlu peringatan
   bunyi di Mac tiap kali ada yang keluar?
