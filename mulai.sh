#!/bin/zsh
# Menyalakan server lalu membuka halaman Worksheet Maker.
cd "$(dirname "$0")"
[[ -x ocr-mac/visionocr ]] || { print -r -- "Alat OCR belum dikompilasi. Jalankan ./pasang.sh dulu."; exit 1; }

if curl -s -o /dev/null --max-time 2 http://localhost:7790/; then
  print -r -- "Server sudah jalan."
else
  nohup python3 cari.py >/tmp/exact-worksheet.log 2>&1 &
  for i in {1..20}; do
    sleep 0.5
    curl -s -o /dev/null --max-time 2 http://localhost:7790/ && break
  done
fi
open http://localhost:7790/
