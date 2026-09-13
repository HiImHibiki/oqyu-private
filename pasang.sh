#!/bin/zsh
# Menyiapkan Exact Worksheet Automation di Mac baru.
set -e
cd "$(dirname "$0")"
AKAR="$(pwd)"
kurang=0

cek() {
  if eval "$2" >/dev/null 2>&1; then
    print -r -- "  ada      $1"
  else
    print -r -- "  KURANG   $1  -> $3"
    kurang=1
  fi
}

print -r -- "=== Memeriksa kebutuhan ==="
cek "Xcode Command Line Tools" "xcrun --find swiftc" "xcode-select --install"
cek "Google Chrome" "test -x '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'" "pasang dari google.com/chrome"
cek "pdftotext (poppler)" "command -v pdftotext" "brew install poppler"
cek "pdftoppm (poppler)" "command -v pdftoppm" "brew install poppler"
cek "Node.js" "command -v node" "brew install node"
cek "Python 3" "command -v python3" "sudah bawaan macOS"

WSM="$HOME/Documents/PROJECT EXACT GROUP/Exact Super App/Exact Worksheet Maker FIXED"
if [[ -f "$WSM/index.html" ]]; then
  print -r -- "  ada      Exact Worksheet Maker"
else
  print -r -- "  KURANG   Exact Worksheet Maker -> salin foldernya, lalu sesuaikan APP di wsmaker.py"
  print -r -- "           dicari di: $WSM"
  kurang=1
fi

(( kurang )) && { print -r -- "
Lengkapi dulu yang kurang di atas, lalu jalankan ulang."; exit 1; }

print -r -- "
=== Mengompilasi alat OCR ==="
swiftc -O ocr-mac/VisionOCR.swift -o ocr-mac/visionocr
print -r -- "  ocr-mac/visionocr siap ($(du -h ocr-mac/visionocr | cut -f1))"

print -r -- "
=== Menyiapkan basis data ==="
if [[ -f exact.db ]]; then
  print -r -- "  exact.db sudah ada, dibiarkan"
else
  python3 - <<'PY'
import sqlite3
db = sqlite3.connect('exact.db')
db.executescript("""
  PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS dokumen(id INTEGER PRIMARY KEY, rel TEXT UNIQUE, nama TEXT,
    folder TEXT, jenjang TEXT, mapel TEXT, jenis TEXT, tahun INT, ukuran INT,
    n_hal INT, n_hal_teks INT, kelas INT, sekolah TEXT, sidik TEXT, dup_dari INT, asal_label TEXT);
  CREATE VIRTUAL TABLE IF NOT EXISTS halaman USING fts5(teks, dok_id UNINDEXED,
    no_hal UNINDEXED, tokenize='unicode61 remove_diacritics 2');
  CREATE TABLE IF NOT EXISTS soal(id INTEGER PRIMARY KEY, dok_id INT, no_hal INT,
    no_soal INT, batang TEXT, opsi TEXT, n_opsi INT, sidik TEXT, mutu INT, dup INT DEFAULT 0);
  CREATE VIRTUAL TABLE IF NOT EXISTS soal_fts USING fts5(batang, opsi, soal_id UNINDEXED,
    tokenize='unicode61 remove_diacritics 2');
""")
db.commit(); db.close()
print('  exact.db kosong dibuat (bank soal bisa dibangun kemudian)')
PY
fi

mkdir -p "$HOME/Documents/Lembar Kerja"
chmod +x mulai.sh 2>/dev/null || true

print -r -- "
=== Selesai ==="
print -r -- "Jalankan:  ./mulai.sh"
print -r -- "Pemakaian pertama akan membuka Chrome berprofil khusus — login Google sekali di situ."
