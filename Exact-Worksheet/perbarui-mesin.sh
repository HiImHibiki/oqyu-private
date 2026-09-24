#!/bin/zsh
# Menyegarkan salinan mesin Exact Worksheet Maker di dalam repo ini.
# Jalankan setiap kali aplikasi aslinya diperbarui.
set -e
cd "$(dirname "$0")"
ASAL="${1:-$HOME/Documents/PROJECT EXACT GROUP/Exact Super App/Exact Worksheet Maker FIXED}"
[[ -f "$ASAL/index.html" ]] || { print -r -- "Tidak ketemu: $ASAL"; exit 1; }
rsync -a --delete \
  --exclude 'menubar' --exclude 'dist*' --exclude 'build' --exclude '*.log' \
  --exclude '.DS_Store' --exclude 'node_modules' --exclude '.server.pid' \
  --exclude '*.command' --exclude '*.app' \
  "$ASAL/" wsm/
print -r -- "Mesin diperbarui dari: $ASAL"
du -sh wsm
