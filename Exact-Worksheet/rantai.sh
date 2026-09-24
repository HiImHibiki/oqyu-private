#!/bin/zsh
# Menunggu OCR selesai, lalu menjalankan sisa alur berurutan.
cd "$(dirname "$0")"
echo "=== menunggu OCR selesai ==="
while pgrep -f jalankan_ocr.py >/dev/null; do sleep 30; done
echo "OCR selesai pada $(date '+%H:%M:%S')"

echo "\n=== 1/4 gabungkan hasil OCR ke indeks ==="
python3 gabung_ocr.py || exit 1

echo "\n=== 2/4 labeli dokumen yang kini punya teks ==="
python3 labeli.py || exit 1

echo "\n=== 3/4 klasifikasi mapel/jenjang ==="
python3 klasifikasi.py || exit 1

echo "\n=== 4/4 panen soal ulang (dengan perbaikan N-kolom) ==="
python3 panen.py || exit 1

echo "\n=== RANTAI SELESAI $(date '+%H:%M:%S') ==="
