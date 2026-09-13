# Memasang Exact Worksheet di Mac baru

Panduan ini untuk **Claude Code yang menjalankan pemasangan**, bukan untuk dibaca
sambil lalu. Kerjakan berurutan dan **berhenti di setiap verifikasi yang gagal** —
jangan lanjut sambil berharap teratasi sendiri. Sebagian besar kegagalan di sini
tidak memberi pesan galat; gejalanya muncul belakangan sebagai hal yang tampak
tidak berhubungan.

Tujuannya satu server Python di port 7790 yang mengendalikan Chrome tanpa jendela
untuk bicara ke Gemini, lalu merender PDF lewat mesin Exact Worksheet Maker yang
ikut di dalam repo.

---

## 0. Sebelum mulai — yang harus disiapkan pemakai

Minta Rico menyediakan ini lebih dulu; tiga-tiganya tidak bisa kamu kerjakan sendiri:

1. **Akun Google yang sudah berlangganan Gemini** — nanti login sekali secara manual
2. **Akses ke repo privat** `Exact-Digital/Exact-Worksheet`
3. **Kesediaan membuka System Settings** untuk memberi izin Full Disk Access (langkah 6)

---

## 1. Kebutuhan sistem

```bash
xcode-select --install                 # swiftc, untuk alat OCR
brew install poppler node              # pdftotext, pdftoppm, pdfinfo, node
```

Google Chrome harus ada di `/Applications/Google Chrome.app`. Pasang dari
google.com/chrome kalau belum.

**Verifikasi:**

```bash
xcrun --find swiftc && command -v pdftotext pdftoppm pdfinfo node python3 \
  && test -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  && echo "semua kebutuhan ada"
```

---

## 2. Ambil repo

```bash
gh repo clone Exact-Digital/Exact-Worksheet "$HOME/Documents/PROJECT EXACT GROUP/Exact Worksheet"
```

Boleh diletakkan di folder mana pun — sejak semua jalur diturunkan dari lokasi
berkasnya sendiri, tidak ada yang perlu disunting. Yang **tidak** ikut di repo dan
memang begitu seharusnya: `exact.db`, `chrome-otomatis/`, `setelan.json`,
`naskah/`, dan APK Android.

---

## 3. Pasang

```bash
cd "<folder proyek>"
./pasang.sh
```

Skrip ini memeriksa kebutuhan, mengompilasi `ocr-mac/visionocr` dengan swiftc, dan
membuat `exact.db` kosong kalau belum ada.

**Verifikasi:**

```bash
test -x ocr-mac/visionocr && echo "alat OCR siap"
```

---

## 4. Login Gemini — sekali, manual

Chrome kendali biasanya berjalan tanpa jendela. Untuk login, munculkan sekali.

`nyalakan()` tidak berbuat apa-apa kalau Chrome kendali SUDAH hidup — jadi kalau
sudah pernah jalan tanpa jendela, ia akan tetap tanpa jendela dan langkah ini
seolah tidak berpengaruh. Tutup dulu:

```bash
python3 -c "import cdp; print('ditutup:', cdp.matikan())"
EXACT_TAMPIL=1 python3 -c "import cdp; cdp.nyalakan(); print(cdp.buka_tab('https://gemini.google.com/app'))"
```

Jendela Chrome berprofil khusus akan terbuka. **Minta Rico login Google di situ.**
Profilnya tersimpan di `chrome-otomatis/` dan bertahan setelahnya.

**Verifikasi:**

```bash
python3 -c "
import time, otomasi
s = otomasi._sesi(otomasi.URL_GEMINI, 'gemini.google.com/app')
for _ in range(20):
    k = s.evaluasi(otomasi.JS_SUDAH_MASUK)
    if k in ('MASUK','BELUM'): break
    time.sleep(1.5)
print('status login:', k)"
```

Harus `MASUK`. Kalau `BELUM`, loginnya belum selesai — ulangi, jangan lanjut.

---

## 5. Nyalakan sebagai layanan

```bash
./pasang-autostart.sh --lan          # --lan supaya bisa dibuka dari tablet/HP
```

Ini memasang dua hal: **server** (hidup tiap login, hidup lagi kalau mati) dan
**penjaga** (memeriksa tiap 2 menit, menyalakan ulang kalau tidak menyahut dua
kali berturut-turut).

Penjaganya perlu karena `KeepAlive` milik launchd hanya melihat apakah prosesnya
ADA — ia tidak bisa membedakan proses sehat dari proses tersangkut. Yang kedua
pernah terjadi: PID tercatat hidup, port 7790 tidak dijawab siapa pun, dan karena
prosesnya "ada" ia tak pernah dinyalakan ulang.

**Verifikasi:**

```bash
./mulai-ulang.sh
launchctl list | grep worksheet
```

`mulai-ulang.sh` harus mencetak `Layanan jalan. Lembar terbaca: N`, dan
`launchctl list` harus menampilkan **dua** baris: `com.exactcourse.worksheet` dan
`com.exactcourse.worksheet.penjaga`.

Uji penjaganya sekalian — bekukan servernya, lalu jalankan penjaga dua kali:

```bash
PID=$(pgrep -f "[c]ari.py" | head -1); kill -STOP $PID
python3 penjaga.py          # "tidak menyahut — menunggu pemeriksaan berikutnya"
python3 penjaga.py          # "tidak menyahut dua kali — dinyalakan ulang" lalu "pulih"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:7790/status   # harus 200
```

---

## 6. Izin Desktop — langkah yang paling sering terlewat

Keluaran PDF ditulis ke Desktop, dan Desktop dilindungi TCC macOS. Layanan yang
dijalankan launchd **tidak otomatis punya izin itu**.

Gejalanya menyesatkan: halaman Hasil berkata *"Belum ada lembar"* seolah foldernya
kosong, padahal berisi ratusan PDF. Python menelan `PermissionError` dan
mengembalikan daftar kosong, jadi folder yang ditolak dan folder yang benar-benar
kosong terlihat sama persis.

**Periksa dulu:**

```bash
curl -s http://127.0.0.1:7790/diag | python3 -m json.tool
```

Kalau `daftar_pdf` bernilai 0 padahal Desktop berisi PDF, atau `contoh` memuat
`Operation not permitted`, minta Rico melakukan ini:

> System Settings → Privacy & Security → **Full Disk Access** → tombol **+** →
> tekan **Cmd+Shift+G** → ketik `/usr/bin/python3` → pilih → pastikan sakelarnya
> menyala.

Lalu `./mulai-ulang.sh` lagi.

---

## 7. Alamat untuk tablet dan HP

```bash
tailscale ip -4 2>/dev/null || /Applications/Tailscale.app/Contents/MacOS/Tailscale ip -4
```

Perintah `tailscale` sering tidak ada di PATH kalau dipasang lewat App Store —
jalur cadangan di atas menanganinya.

Catat alamatnya dan minta Rico mengisinya di aplikasi Android **Exact Worksheet**
(ada dua Mac, jadi pastikan yang benar). Halamannya dibuka di
`http://<alamat>:7790`.

---

## 8. Uji seluruh rantai

Jangan lapor selesai sebelum ini lulus:

```bash
R=$(curl -s -m 30 -F "topik=Teorema Pythagoras" -F "mapel=Matematika" \
      -F "jenjang=Kelas 8" -F "jumlah=3" -F "kolom=1" -F "mesin=gemini" \
      http://127.0.0.1:7790/buat)
J=$(echo "$R" | python3 -c "import json,sys; print(json.load(sys.stdin)['jid'])")
for i in $(seq 1 50); do
  sleep 6
  S=$(curl -s -m 10 "http://127.0.0.1:7790/status?jid=$J")
  echo "$S" | grep -q '"selesai": true' && break
done
python3 -c "
import json,sys; d=json.loads(sys.argv[1])
print('HASIL:', ('GAGAL ' + d['galat']) if d.get('galat') else 'BERHASIL')" "$S"
```

Butuh 40–160 detik. Harus `BERHASIL`, dan sebuah PDF muncul di Desktop.

---

## Jebakan yang sudah pernah memakan waktu

**Jangan menyalakan ulang dengan `pkill`.** Pakai `./mulai-ulang.sh`. macOS memberi
izin Desktop berdasarkan proses yang bertanggung jawab: layanan launchd punya izin
itu, python yang dijalankan tangan tidak. Kalau layanan dimatikan dengan pkill dan
ada python lain merebut port 7790 lebih dulu, penjaga "satu proses saja" membuat
layanan resmi justru menyerah — dan yang melayani adalah proses tanpa izin.

**Jangan jalankan `perbarui-mesin.sh` tanpa memeriksa dulu.** Ada dua patch lokal
di `wsm/diagrams.js` yang akan tertimpa: arti ganda parameter `lebar` (membuat
balok tercetak selebar 12 piksel), dan koma di dalam rumus yang memecah kolom
tabel. Keduanya bertanda `PATCH EXACTSEARCH` di dalam berkasnya.

**Gemini kadang menolak** dengan kalimat seperti *"saya hanya model bahasa"*. Itu
sudah ditangani: tiga percobaan dengan bingkai berbeda, satu kalimat pelurus di
utas yang sama, dan penutupan Chrome pada kegagalan kedua. Kegagalannya tercatat di
`/tmp/exact-worksheet.log` dengan awalan `[gemini]` — periksa di situ kalau
frekuensinya terasa tinggi.

**`exact.db` tidak ikut di repo.** Fitur bank soal dan penyusunan tanpa AI butuh
itu. Untuk pemakaian sehari-hari (buat soal, kunci jawaban, rangkuman) tidak
diperlukan — `pasang.sh` membuat basis data kosong yang sudah cukup.

**Mesin Claude perlu Claude Code terpasang.** Kalau tidak ada, pemilih mesin di
halaman akan menolak dengan pesan yang jelas. Bawaannya Gemini, jadi ini tidak
menghalangi pemasangan.
