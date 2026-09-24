#!/bin/zsh
# Membangun "Exact Worksheet.app" lalu memasangnya ke /Applications.
#
# Kenapa dipisah dari folder sumber:
#   - /Applications tidak dilindungi TCC, sedangkan ~/Documents dan ~/Desktop
#     iya. Sumber yang tinggal di folder terlindungi membuat launchd sesekali
#     kehilangan izin membaca kodenya sendiri, dengan gejala yang menyesatkan.
#   - Folder sumber jadi bebas dipindah, diubah, atau dihapus tanpa mematikan
#     aplikasi yang sedang dipakai mengajar.
#   - Data (exact.db, profil Chrome, setelan, naskah) TIDAK ikut ke dalam bundel
#     — semuanya di ~/Library/Application Support/Exact Worksheet, jadi selamat
#     melewati pemasangan ulang.
set -e
cd "$(dirname "$0")"
SUMBER="$(pwd)"
APP="/Applications/Exact Worksheet.app"
ISI="$APP/Contents"

print -r -- "=== Memeriksa yang dibutuhkan ==="
[[ -f wsm/index.html ]]      || { print -r -- "wsm/ belum ada"; exit 1; }
[[ -x ocr-mac/visionocr ]]   || { print -r -- "ocr-mac/visionocr belum dikompilasi — jalankan ./pasang.sh"; exit 1; }
print -r -- "  lengkap"

print -r -- "
=== Menyalin ke bundel ==="
rm -rf "$APP"
mkdir -p "$ISI/MacOS" "$ISI/Resources"

# Hanya yang dipakai saat berjalan. Skrip pembangun, tolok ukur, dan berkas
# pengembangan sengaja tidak ikut supaya bundelnya tetap ramping.
for f in *.py; do cp "$f" "$ISI/Resources/"; done
cp mulai-ulang.sh "$ISI/Resources/" && chmod +x "$ISI/Resources/mulai-ulang.sh"   # dipakai tombol Restart aplikasi
cp -R wsm statik ocr-mac claude-proyek "$ISI/Resources/" 2>/dev/null || true
rm -rf "$ISI/Resources/ocr-mac/"*.swift
print -r -- "  berkas Python : $(ls "$ISI/Resources"/*.py | wc -l | tr -d ' ')"
print -r -- "  ukuran bundel : $(du -sh "$APP" | cut -f1)"

cat > "$ISI/MacOS/Exact Worksheet" <<'LAUNCH'
#!/bin/zsh
# Homebrew tidak ada di PATH bawaan yang diberikan launchd maupun Finder.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "$(dirname "$0")/../Resources"
exec /usr/bin/python3 cari.py "$@"
LAUNCH
chmod +x "$ISI/MacOS/Exact Worksheet"

cat > "$ISI/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Exact Worksheet</string>
  <key>CFBundleDisplayName</key><string>Exact Worksheet</string>
  <key>CFBundleIdentifier</key><string>com.exactcourse.worksheet</string>
  <key>CFBundleExecutable</key><string>Exact Worksheet</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>LSUIElement</key><true/>
</dict></plist>
PLIST

[[ -f statik/logo.png ]] && cp statik/logo.png "$ISI/Resources/AppIcon.png"

print -r -- "
=== Selesai ==="
print -r -- "Terpasang: $APP"
print -r -- "Sumber   : $SUMBER  (terpisah, boleh dipindah)"
print -r -- "Data     : ~/Library/Application Support/Exact Worksheet  (tidak ikut di bundel)"
print -r -- ""
print -r -- "Berikutnya:  ./pasang-autostart.sh --lan"
