# FITUR.md — Inventaris Fitur (basis 24 Sep 2026)

Daftar ini dipakai untuk (1) memilih fitur yang dihapus, lalu (2) menjadi daftar uji QA.
Kode: **FW** = Exact Worksheet, **FC** = Exact Canvas, **FP** = Exact Practice.

Label:
- 🟢 **inti Exact Course** — dipakai alur utama guru/murid.
- 🟡 **pendukung** — berguna tapi bisa dilepas tanpa mematahkan alur utama.
- 🔴 **warisan** — bawaan Exact Try Out / fitur lama, kemungkinan tidak dipakai Exact Course.
- 🔗 = bergantung ke / dipakai oleh aplikasi lain (menghapusnya berdampak lintas aplikasi).

Status keputusan: kolom **Keputusan** diisi `pertahankan` / `hapus` / `ubah` setelah
dibahas dengan user.

---

## Exact Worksheet (Mac, :7790)

| Kode | Fitur | Di mana | Label | Keputusan |
|---|---|---|---|---|
| FW-01 | **Buat Soal**: topik / foto / PDF / papan klip → naskah soal via Gemini (Chrome) → PDF | tab Buat Soal, `/buat` | 🟢 | |
| FW-02 | Mesin **Claude CLI** sebagai alternatif Gemini | pilihan mesin, `claudecli.py` | 🟡 | |
| FW-03 | **Kunci Jawaban & Pembahasan** dari foto/PDF soal → lembar baca | tab Kunci Jawaban, `/jawab` | 🟢 | |
| FW-04 | **Rangkuman** materi → lembar rangkuman (inti, poin, rumus, contoh) | tab Rangkuman, `/rangkum` | 🟡 | |
| FW-05 | **Naskah Manual**: salin perintah → jalankan di AI mana pun → tempel → PDF (3 jenis) | tab Naskah Manual, `/manual`, `/api/perintah`, `/api/periksa` | 🟢 | |
| FW-06 | **Hasil & Cetak**: daftar PDF di Desktop, pratinjau, cetak ke printer Mac (bolak-balik, monokrom), unduh | tab Hasil, `/hasil`, `/cetak`, `/berkas`, `/thumb` | 🟢 | |
| FW-07 | **Bagikan PDF** ke WhatsApp (Web Share / unduh) | tombol di Hasil | 🟡 | |
| FW-08 | **Ke Practice**: terbitkan lembar jadi paket latihan online (multi-set, nomor set, teks bacaan) | tombol di baris tugas & Hasil, `/terbitkan` | 🟢 🔗FP-20 | |
| FW-09 | Kop lembar: kode depan judul (MATH, PHYS…), sekolah, lembaga, kolom, kerapatan, ukuran diagram | borang Buat Soal/Manual | 🟢 | |
| FW-10 | **Diagram & grafik** (tag `[[…]]`): fungsi, geometri, statistik, fisika, kimia/biologi gaya A-Level | `wsm/diagrams.js` | 🟢 🔗FP, FC (disalin) | |
| FW-11 | Teks bacaan (B. Indonesia/Inggris) di lembar | naskah `Bacaan` | 🟡 🔗FP-24 | |
| FW-12 | Antrean satu tugas + tombol Hentikan + tugas macet berhenti sendiri | semua tab, `/status`, `/batal` | 🟢 | |
| FW-13 | Lihat layar Gemini dari aplikasi | `/layar` | 🟡 | |
| FW-14 | Restart Chrome / Restart aplikasi (halaman + menu bar) | `/chrome/ulang`, `/aplikasi/ulang` | 🟡 | |
| FW-15 | **Menu bar "EW"**: status, restart, salin prompt AI | `menubar/` | 🟡 | |
| FW-16 | **Aplikasi Android**: Open with → kirim foto ke Mac (Tailscale), titip | `android/`, `/terima`, `/titipan`, `/apk` | 🟡 | |
| FW-17 | Akses dari HP/tablet lewat LAN/Tailscale (`--lan`) | `pasang-autostart.sh` | 🟡 | |
| FW-18 | Penjaga kesehatan (restart otomatis kalau tersangkut) + `/diag` | `penjaga.py` | 🟢 | |
| FW-19 | **Editor Worksheet Maker** langsung (tempel naskah, render manual) | `/wsm/` | 🟡 | |
| FW-20 | Jembatan untuk Practice: ambil butir soal, render PDF, potret HTML→PNG | `/api/soal`, `/api/render`, `/api/potret-html` | 🟢 🔗FP-21, FP-22, FP-31  | potret HTML tidak dipakai lagi (P-053) |
| FW-21 | **Arsip & bank soal lama**: cari arsip PDF, soal serupa, impor, susun tanpa AI, pilih otomatis | `/cari`, `/serupa`, `/impor`, `/susun`, `/otomatis`, `/lembar`; `bangun_indeks.py`… | 🔴 (tab sudah disembunyikan sejak 13 Sep) | |
| FW-22 | OCR foto soal (Vision macOS) | `ocr-mac/` | 🟢 (dipakai FW-01/03) | |

## Exact Canvas (Mac, :4747)

| Kode | Fitur | Di mana | Label | Keputusan |
|---|---|---|---|---|
| FC-01 | **Kanvas Wacom**: pena/pensil/kaligrafi/kuas/stabilo, penghapus, laso, teks, bentuk bisa disunting, 3 lapisan, undo/redo | aplikasi Mac | 🟢 | |
| FC-02 | Kanvas tak terbatas / kertas berhalaman (A4/A3/Letter), latar polos/titik/petak/garis | aplikasi Mac | 🟢 | |
| FC-03 | **Instrumen**: penggaris, busur derajat, jangka (skala cm nyata) | panel Instruments | 🟢 | |
| FC-04 | Grafik fungsi, grafik implisit, tabel | panel Insert | 🟡 | |
| FC-05 | Pengenalan bentuk (hold-to-shape, Auto shapes) | panel Stroke | 🟡 | |
| FC-06 | Tempel gambar, impor PDF (banyak sekaligus), impor Word/PowerPoint | aplikasi Mac | 🟢 | |
| FC-07 | Ekspor PNG/SVG/PDF, cetak | aplikasi Mac | 🟡 | |
| FC-08 | Banyak sketsa & jendela, 18 tema, pengaturan gulir/zoom | aplikasi Mac | 🟡 | |
| FC-09 | **Berbagi di jaringan**: server + PIN + QR | Settings → Share | 🟢 🔗FP | |
| FC-10 | **Layar TV** pengikut (`/tv`, mode fit, per ruangan) | `/tv` | 🟢 | |
| FC-11 | **Editor tablet** penuh via browser (`/admin`, sandi admin), sinkron dua arah dengan Mac | `/admin` | 🟢 | |
| FC-12 | **Akun murid** (No. HP + sandi, persetujuan guru, reset sandi) | `/api/akun/*`, panel Class | 🟢 🔗FP-02 | |
| FC-13 | **Kelas langsung**: 3 ruangan, murid ikut papan guru di HP | `/tv?murid=1` | 🟢 | |
| FC-14 | **Antrean tanya** (teks/foto, dibahas → kanvas "Tanya · Nama"), anti-spam, bisukan | panel Class, `/api/kelas/*` | 🟢 🔗FP-31  | tetap di Canvas; dari Practice dihapus (P-053) |
| FC-15 | **Izin coret** per murid di kanvasnya sendiri (pena, bentuk, penggaris, busur, jangka) | panel Class | 🟡 | |
| FC-16 | **Grup** murid (buatan guru & belajar mandiri), kanvas grup per hari | panel Class | 🟡 | |
| FC-17 | Mode menunggu HP, notifikasi "dibahas", lampu fokus, bunyi | HP murid | 🟡 | |
| FC-18 | Tombol 📝 **Practice** di HP murid (masuk Practice dengan sesi akun Canvas) | `src/tv/main.ts` | 🟢 🔗FP-03 | |
| FC-19 | Mode tertanam untuk **papan guru di Practice** + sesi atas nama Practice | `embed=1`, `/api/akun/sesi` | 🟡 🔗FP-32  | ubah → akun Canvas otomatis untuk murid Practice (C-049) |
| FC-20 | Akses internet lewat Cloudflare Tunnel (alamat publik, PIN 6–8 digit) | `scripts/cloudflare-setup.sh` | 🟢 | |
| FC-21 | Cadangan versi tiap sketsa (30 versi), vault bisa di iCloud | vault | 🟢 | |
| FC-22 | Rencana **Kelas & Tugas** (belum dibangun) | `docs/RENCANA-KELAS-TUGAS.md` | ⬜ rencana | |

## Exact Practice (Mac, :8770, publik)

### Akun & akses
| Kode | Fitur | Di mana | Label | Keputusan |
|---|---|---|---|---|
| FP-01 | Daftar murid dengan **kode kelas** → menunggu disetujui guru | `/daftar`, `/menunggu`, `/admin/peserta` | 🟢 | ubah → daftar username+sandi, langsung aktif (P-044) |
| FP-02 | **Masuk pakai akun Exact Canvas** (No. HP + sandi) | `/masuk` | 🟢 🔗FC-12 | pertahankan sebagai jalur kedua |
| FP-03 | Masuk otomatis dari tombol Practice di Canvas (token sesi) | `/api/auth/canvas?sesi=` | 🟢 🔗FC-18 | |
| FP-04 | Masuk email + sandi, ganti sandi, keluar semua perangkat | `/masuk`, `/pengaturan` | 🟢 | ubah → username+sandi (P-044) |
| FP-05 | Admin/guru otomatis dari `ADMIN_EMAILS`, halaman masuk admin | `/admin/masuk` | 🟢 | |
| FP-06 | Masuk Google (Supabase) — hanya mode Supabase | `/auth/callback` | 🔴 | hapus (P-043) |

### Murid: latihan & ujian
| Kode | Fitur | Di mana | Label | Keputusan |
|---|---|---|---|---|
| FP-10 | Halaman **Latihan**: paket dari guru, cari dengan nama/kode ujian 6 huruf, riwayat | `/latihan` | 🟢 | ubah → masukkan kode ujian, Paket saya (P-045) |
| FP-11 | **Latihan acak dari bank** per mapel/kelas/topik | `/latihan` | 🟡 | hapus (P-045) |
| FP-12 | **Ruang ujian**: jam di server, autosave, daftar soal, tandai (flag), offline-aware | `/ujian/[id]` | 🟢 | ubah → berwaktu + kirim otomatis, perbaikan tanpa waktu (P-049/050) |
| FP-13 | Alat ujian: **kalkulator**, lembar rumus, stabilo teks, sembunyikan waktu | ruang ujian | 🟡 | |
| FP-14 | **Proctoring** (keluar tab, blur, fullscreen, salin) tercatat | ruang ujian | 🟡 | hapus untuk latihan (P-052) |
| FP-15 | **Hasil & pembahasan** per soal | `/hasil/[id]` | 🟢 | ubah → hasil latihan + tombol perbaikan (P-049) |
| FP-16 | **Cetak PDF** paket (soal / berkunci untuk guru / ikut jawaban murid) | `/api/latihan/cetak` | 🟡 🔗FW-20 | |
| FP-17 | Jenis soal: PG, benar/salah, isian (kunci LaTeX dipoloskan), teks bacaan, diagram | mesin ujian | 🟢 | |

### Guru
| Kode | Fitur | Di mana | Label | Keputusan |
|---|---|---|---|---|
| FP-20 | **Terima paket dari Worksheet** (tombol Ke Practice) | `/api/latihan/terbit` | 🟢 🔗FW-08 | |
| FP-21 | **Buat soal dari Practice** (memerintah Worksheet: topik → Gemini → paket) | `/admin/latihan`, `/api/admin/latihan/buat` | 🟡 🔗FW-20 | |
| FP-22 | **Tempel dari AI** (naskah dari AI mana pun → paket) | `/admin/latihan` | 🟡 | |
| FP-23 | Susun paket dari bank, terbit/sembunyikan, durasi, nomor set, salin kode/tautan | `/admin/latihan` | 🟢 | |
| FP-24 | Teks bacaan jadi stimulus panel kiri | ruang ujian | 🟡 🔗FW-11 | |
| FP-25 | **Pantau kelas**: per murid (paket, sampai nomor berapa, nomor salah), per paket (nomor paling sering salah) | `/admin/kelas` | 🟢 | ubah → progres langsung per paket (P-051) |
| FP-26 | Ringkasan admin | `/admin` | 🟡 | |
| FP-27 | Kelola peserta: setujui, peran, akomodasi waktu (1×/1,5×/2×) | `/admin/peserta` | 🟢 | ubah → tanpa persetujuan (P-044) |

### Integrasi Canvas di Practice
| Kode | Fitur | Di mana | Label | Keputusan |
|---|---|---|---|---|
| FP-31 | **Tanya guru**: soal yang dibuka (teks + gambar) masuk antrean Canvas | ruang ujian | 🟢 🔗FC-14, FW-20  | hapus (P-053) |
| FP-32 | **Papan guru** Canvas tertanam di halaman soal & hasil | ruang ujian, hasil | 🟡 🔗FC-19  | ubah → kanvas coret murid otomatis tersambung (P-053, C-049) |

### Penjualan ke umum
| Kode | Fitur | Di mana | Label | Keputusan |
|---|---|---|---|---|
| FP-40 | **Beli paket berjangka** (1 mgg Rp20rb / 1 bln Rp60rb / 3 bln Rp150rb) tanpa akun: transfer + konfirmasi WA | `/beli` | 🟡 | hapus (P-043) |
| FP-41 | Admin **Tandai lunas** → akun + sandi sementara, tombol "Kirim akun via WA" | `/admin/pesanan` | 🟡 | hapus (P-043) |
| FP-42 | **Afiliasi** murid (kode, tautan `/r/KODE`, komisi 15%, pencairan manual) | `/afiliasi`, `/admin/afiliasi` | 🟡 | hapus (P-043) |
| FP-43 | Kupon diskon | `/api/coupons/validate` | 🔴 | hapus (P-043) |
| FP-44 | Refund | `/admin/pesanan` | 🔴 | hapus (P-043) |
| FP-45 | Pembayaran **Stripe & Midtrans** (checkout, webhook) | `/api/checkout/*`, `/api/webhooks/*` | 🔴 (alur umum pakai transfer manual) | hapus (P-043) |

### Warisan Exact Try Out
| Kode | Fitur | Di mana | Label | Keputusan |
|---|---|---|---|---|
| FP-50 | Ujian **SAT / UTBK / CSCA / A Level** (blueprint, skoring IRT, modul adaptif SAT) + bank ±2.000 soal | `question-bank/`, `src/lib/exams/` | 🔴 | |
| FP-51 | **Dashboard** skor & tren, mulai try out | `/dashboard` | 🔴 | |
| FP-52 | **Journey** | `/journey` | 🔴 | |
| FP-53 | **Leaderboard** | `/leaderboard` | 🔴 | |
| FP-54 | **Demo** ujian | `/demo` | 🔴 | |
| FP-55 | Bank soal Try Out + **tinjauan** soal + pembuat soal AI (Claude/Gemini/OpenAI API) | `/admin/soal`, `/admin/tinjauan`, `/api/admin/ai/*`, `prompts/` | 🔴 | |
| FP-56 | Penilaian **esai** dengan rubrik | `/admin/esai` | 🔴 | |
| FP-57 | Referensi (lembar rumus/ujian) | `/admin/referensi` | 🔴 | |
| FP-58 | Tema (9) & bahasa (ID/EN/…) | `/pengaturan` | 🟡 | |
| FP-59 | Hak data pribadi: ekspor JSON & hapus akun; halaman Ketentuan & Privasi | `/pengaturan`, `/ketentuan`, `/privasi` | 🟡 | |
| FP-60 | Mode Supabase (driver Postgres, 15 migrasi) | `src/lib/db/supabase.ts`, `supabase/` | 🔴 (produksi pakai mode berkas) | |

### Operasional
| Kode | Fitur | Di mana | Label | Keputusan |
|---|---|---|---|---|
| FP-70 | Layanan LaunchAgent + **menu bar "EP"** | `pasang-app.sh`, `menubar/` | 🟢 | |
| FP-71 | Cloudflare Tunnel per Mac | `pasang-tunnel.sh` | 🟢 | |

---

## Alur lintas aplikasi (akan diuji QA ujung-ke-ujung)

| Kode | Alur | Melibatkan |
|---|---|---|
| X-1 | Guru buat soal di Worksheet → **Ke Practice** → paket muncul dengan kode → murid mengerjakan → nilai & pembahasan benar | FW-01/05, FW-08, FP-20, FP-10/12/15 |
| X-2 | Lembar multi-set → satu paket per set, kode berbeda; terbit ulang memperbarui paket yang sama | FW-08, FP-20 |
| X-3 | Murid daftar akun di Canvas → disetujui → **masuk Practice** pakai No. HP + sandi, dan lewat tombol 📝 Practice | FC-12, FC-18, FP-02/03 |
| X-4 | Murid di ruang ujian **Tanya guru** → pertanyaan (teks + gambar soal) muncul di antrean Canvas → dibahas | FP-31, FW-20, FC-14 |
| X-5 | **Papan guru** Canvas tampil di halaman soal/hasil Practice | FP-32, FC-19 |
| X-6 | Guru **cetak PDF** paket dari Practice (soal / kunci / dengan jawaban murid) | FP-16, FW-20 |
| X-7 | Guru **buat soal dari panel Practice** (memerintah Worksheet) | FP-21, FW-20 |
| X-8 | Diagram `[[…]]` tampil sama di PDF Worksheet, ruang ujian Practice, dan kartu tanya Canvas | FW-10 |
