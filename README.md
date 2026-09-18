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
| — | mesin perender lembar sudah ikut di dalam repo (`wsm/`) |

Python 3.9+ bawaan macOS sudah cukup — tidak ada pustaka pihak ketiga.

### Mesin Worksheet Maker

Perender lembarnya **ikut di dalam repo** (folder `wsm/`, 2,6 MB) dan disajikan
oleh server aplikasi ini sendiri di `/wsm/`. Tidak ada jalur luar yang dipaku dan
tidak ada server kedua.

Bila aplikasi Exact Worksheet Maker aslinya diperbarui, segarkan salinannya:

```sh
./perbarui-mesin.sh                       # dari lokasi bawaan
./perbarui-mesin.sh "/jalur/ke/aplikasi"  # dari lokasi lain
```

## Pemasangan

```sh
git clone <repo> ~/Documents/PROJECT EXACT GROUP/Exact Worksheet
cd ~/Documents/PROJECT EXACT GROUP/Exact Worksheet
./pasang.sh
```

`pasang.sh` memeriksa semua kebutuhan, mengompilasi alat OCR, lalu menyiapkan
basis data kosong bila belum ada.

## Menjalankan

```sh
./mulai.sh          # menyalakan server, membuka http://localhost:7790/
```

Chrome kendali berjalan **tanpa jendela**, jadi tidak merebut layar — Anda bisa
mengerjakan hal lain selagi lembar dibuat.

Sekali saja di awal, jendelanya perlu dimunculkan untuk login Google:

```sh
EXACT_TAMPIL=1 ./mulai.sh     # jendela muncul; login sekali
```

Sesudah itu jalankan biasa (`./mulai.sh`) dan jendelanya tidak muncul lagi.

## Alur kerja

1. Salin tangkapan layar soal, tekan **Ambil dari papan klip** (sampai 10 gambar)
2. Isi topik; medan lain mengingat isian terakhir
3. **Buat PDF** — hasilnya tersimpan di `~/Documents/Lembar Kerja/`

## Tab "Naskah Manual" — tanpa AI di dalam aplikasi

Untuk naskah yang ditulis sendiri, atau yang dikarang AI mana pun di luar
aplikasi (Gemini, ChatGPT, Claude, AI lokal). Ada tiga jenis naskah, dipilih di
paling atas:

| Jenis | Jalurnya sama dengan tab | Hasil |
|---|---|---|
| Soal latihan | Buat Soal | lembar kerja, bank soal, PDF, terbit ke Exact Practice |
| Kunci jawaban & pembahasan | Kunci Jawaban | lembar baca satu kolom: soal + kunci + pembahasan |
| Rangkuman / catatan materi | Rangkuman | lembar rangkuman: inti, poin, rumus, contoh, ingat |

1. **Salin perintah** — perintahnya dibangun oleh pembangun yang sama dengan
   jalur Gemini (`prompt-builder.js` untuk soal, `jawab.py` untuk pembahasan,
   `rangkum.py` untuk rangkuman), jadi tidak pernah beda format. Untuk
   pembahasan, tempel naskah soalnya di kotak bawah supaya ikut di perintah;
   untuk rangkuman, tempel materinya atau cukup tulis topiknya
2. Jalankan perintah itu di AI mana pun, salin jawabannya
3. Tempel di langkah 2; **Periksa naskah** menghitung berapa soal / bagian yang
   terbaca sebelum apa pun dirender (perenderan ikut antrean dan memakai
   Chrome). Pengurainya sama dengan jalur Gemini, jadi hitungannya jujur
4. **Buat PDF** — untuk soal, centang *sekalian terbitkan ke Exact Practice*
   bila paket latihan onlinenya mau langsung jadi

Format soal sama persis dengan yang dipakai Gemini: kode bagian di dalam kurung
sesudah titik dua (`Bagian Pilihan Ganda: (PG)`), bobot `[2]` di akhir kalimat
soal, dan kunci ditulis `PG1-A, PG2-B` dengan tanda hubung — bukan titik.
Pembahasan: tiap soal diawali baris `SOAL 1`, lalu `JAWAB:` dan `BAHAS:`.
Rangkuman: `JUDUL:`, `INTI:`, lalu tiap sub-bab `BAGIAN:` berisi `POIN:`,
`RUMUS:`, `CONTOH:`, `INGAT:`. Contoh lengkapnya ada di placeholder kotak
naskah. Pagar ``` dan pembatas `\( \)` yang sering ikut dari ChatGPT/Claude
dirapikan otomatis.

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

**Tab tersembunyi tidak menerima peristiwa tetikus** — inilah sebab kegagalan
"Perintah tidak terkirim" yang muncul acak pada mode berjendela. Mode tanpa
jendela justru bebas dari masalah ini karena halamannya selalu berstatus
`visible`.

## Membuka dari tablet atau HP

Bawaannya server hanya melayani Mac itu sendiri. Untuk membukanya dari perangkat
lain di jaringan yang sama:

```sh
EXACT_LAN=1 ./mulai.sh              # semua antarmuka
EXACT_LAN=100.83.25.73 ./mulai.sh   # satu antarmuka saja, mis. Tailscale
```

Alamatnya akan dicetak saat server menyala.

**Pertimbangkan dulu:** dengan `EXACT_LAN=1`, siapa pun di Wi-Fi yang sama bisa
membuka aplikasinya, melihat lembar yang sudah dibuat, dan **mencetak ke printer
Anda**. Tidak ada kata sandi. Mengikat ke alamat Tailscale saja lebih aman karena
hanya perangkat di tailnet Anda yang bisa menjangkaunya.
