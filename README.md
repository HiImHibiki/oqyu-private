# Exact Worksheet Automation

Satu instruksi jadi lembar kerja PDF: foto soal dibaca di Mac, dicarikan acuan
gaya dari arsip soal sendiri, dikirim ke Gemini lewat Chrome, lalu hasilnya
dirender oleh Exact Worksheet Maker jadi PDF siap cetak.

Tidak memakai API Gemini. Tidak ada kunci API yang perlu disimpan.

## Yang harus sudah ada di mesin tujuan

| Kebutuhan | Cara memastikan |
|---|---|
| macOS 13+ | Vision framework dipakai untuk OCR |
| Xcode Command Line Tools | `xcode-select --install` |
| Google Chrome | dipasang di `/Applications` |
| poppler | `brew install poppler` (memberi `pdftotext`, `pdftoppm`) |
| Node.js | `brew install node` |
| **Exact Worksheet Maker FIXED** | aplikasi perender lembar; lihat catatan di bawah |

Python 3.9+ bawaan macOS sudah cukup — tidak ada pustaka pihak ketiga.

### Exact Worksheet Maker

Perender lembarnya bukan bagian dari repo ini. Salin foldernya ke mesin tujuan,
lalu sesuaikan jalurnya di `wsmaker.py` (`APP`) bila letaknya berbeda.

Bawaannya:
`~/Documents/PROJECT EXACT GROUP/Exact Super App/Exact Worksheet Maker FIXED`

## Pemasangan

```sh
git clone <repo> ~/ExactSearch
cd ~/ExactSearch
./pasang.sh
```

`pasang.sh` memeriksa semua kebutuhan, mengompilasi alat OCR, lalu menyiapkan
basis data kosong bila belum ada.

## Menjalankan

```sh
./mulai.sh          # menyalakan server, membuka http://localhost:7790/buat
```

Pemakaian pertama akan membuka jendela Chrome terpisah berprofil khusus.
**Login Google sekali** di jendela itu; sesudah itu tidak perlu diulang.
Jangan menutup jendela tersebut selagi memakai aplikasinya.

## Alur kerja

1. Salin tangkapan layar soal, tekan **Ambil dari papan klip** (sampai 10 gambar)
2. Isi topik; medan lain mengingat isian terakhir
3. **Buat PDF** — hasilnya tersimpan di `~/Documents/Lembar Kerja/`

## Bank soal (opsional)

Arsip soal dipakai sebagai acuan gaya supaya keluaran Gemini mengikuti naskah
yang benar-benar dipakai di kelas. Tanpa arsip, aplikasinya tetap jalan — hanya
tanpa contoh gaya.

Membangun arsip dari folder PDF:

```sh
export EXACT_AKAR="$HOME/Documents/EXACT COURSE"
python3 bangun_indeks.py      # PDF -> teks -> indeks pencarian
python3 labeli.py             # label dari kepala dokumen + tandai duplikat
python3 klasifikasi.py        # lengkapi label yang kosong
python3 panen.py              # panen soal satuan
```

Untuk dokumen hasil pindaian (tanpa lapisan teks):

```sh
python3 ocr-mac/jalankan_ocr.py --pekerja 8    # OCR Vision, ~13 halaman/detik
python3 gabung_ocr.py                              # gabungkan ke indeks
```

## Isi repo

| Berkas | Kegunaan |
|---|---|
| `cari.py` | server web: pencarian arsip, `/buat`, `/impor`, `/serupa` |
| `buat.py` | halaman Worksheet Maker + alur latar belakang |
| `otomasi.py` | Gemini lewat Chrome + render lembar jadi PDF |
| `cdp.py` | klien Chrome DevTools Protocol (termasuk klien WebSocket) |
| `wsmaker.py` | jembatan ke Exact Worksheet Maker |
| `gemini_baca.py` | baca PDF Gemini: pangkat dipulihkan, kunci jawaban dipisah |
| `gemini_impor.py` | urai naskah Gemini jadi soal terstruktur |
| `serupa.py` | temu balik soal serupa dari arsip |
| `klip.py` | ambil gambar dari papan klip macOS |
| `setelan.py` | setelan yang diingat antar pemakaian |
| `ocr-mac/VisionOCR.swift` | OCR memakai framework Vision |
| `bangun_indeks.py` … `panen.py` | pembangun bank soal |

## Catatan penting bagi yang mengembangkan

**Gemini mengabaikan semua peristiwa buatan JavaScript.** Mengetik, menghapus,
dan mengklik HARUS lewat `Input.*` dari DevTools Protocol. JavaScript hanya boleh
dipakai untuk membaca. Mengosongkan kotak perintah dengan `innerHTML=''` membuat
tombol kirim mati permanen tanpa gejala yang jelas.

**Exact Worksheet Maker merender lewat tombol `#btnRender`.** Mengisi `rawInput`
saja menghasilkan PDF kosong.

**Periksa JavaScript halaman dengan `node --check` setelah menyuntingnya.** Satu
galat sintaks mematikan seluruh skrip, dan gejalanya hanya "tombol tidak jalan".

## Jalan buntu yang sudah dicoba — jangan diulang

**AppleScript ke Chrome.** Chrome 152 tidak bisa disuruh menyalakan
"Allow JavaScript from Apple Events" secara program; klik menunya diterima tapi
setelannya tidak berubah. Karena itu seluruh otomasi memakai DevTools Protocol.

**Normalisasi ukuran gambar untuk model penglihatan.** Diukur pada halaman yang
sama: 200dpi 14,4 dtk; sisi 1800px 14,7 dtk; sisi 2400px 17,8 dtk. Tidak ada
penghematan, dan keluarannya malah berubah.

**Model bahasa lokal sebagai pengurai cadangan.** Pada naskah yang terurai dua
soal bersih, model mengembalikan empat "soal" — satu di antaranya blok rumus.
Cadangan hanya dipanggil bila pengurai deterministik tidak menghasilkan apa pun.

**Tab yang tersembunyi tidak menerima peristiwa tetikus.** Peristiwa `Input.*`
dari DevTools tidak sampai ke tab ber-`visibilityState: hidden` — tab itu tetap
bisa dibaca dan diisi teksnya, tapi klik tombol kirim diam tanpa galat apa pun.
Selalu `Page.bringToFront` dan tunggu sampai `visible` sebelum mengklik.
