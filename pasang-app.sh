#!/bin/zsh
# Pasang/perbarui Exact Practice sebagai layanan yang selalu menyala.
#
# Sumber tetap di folder proyek; yang dijalankan adalah SALINAN di
# ~/Library/Application Support/Exact Practice/app — launchd tidak bisa
# membaca ~/Documents (dilindungi TCC), dan data (db.json, bank soal, paket)
# disimpan terpisah di .../Exact Practice/data supaya tidak ikut terhapus
# saat aplikasi diperbarui.
#
#   ./pasang-app.sh          # build + salin + (re)start layanan
#   ./pasang-app.sh --tanpa-build
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
APP="$HOME/Library/Application Support/Exact Practice"
LABEL=com.exactcourse.practice
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NODE="$(command -v node)"
PORT=8770

[ -f "$SRC/.env.local" ] || { echo "Tidak ada .env.local di $SRC — salin dari .env.contoh dulu."; exit 1; }
if [ "$1" != "--tanpa-build" ]; then
  (cd "$SRC" && npm run build)
fi

mkdir -p "$APP/app" "$APP/data" "$HOME/Library/Logs"
rsync -a --delete \
  --exclude .git --exclude .data --exclude '*.tsbuildinfo' --exclude .DS_Store \
  --exclude '.next/cache' \
  "$SRC/" "$APP/app/"

cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$NODE</string>
    <string>$APP/app/node_modules/next/dist/bin/next</string>
    <string>start</string><string>-p</string><string>$PORT</string>
  </array>
  <key>WorkingDirectory</key><string>$APP/app</string>
  <key>EnvironmentVariables</key><dict>
    <key>NODE_ENV</key><string>production</string>
    <key>EXACT_DATA_DIR</key><string>$APP/data</string>
    <key>PATH</key><string>$(dirname "$NODE"):/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key><string>$HOME</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/exact-practice.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/exact-practice.log</string>
</dict></plist>
PL

# bootout berjalan asinkron: kalau bootstrap dipanggil sebelum label benar-benar
# hilang, launchd menjawab "Input/output error" (5). Tunggu sampai lepas.
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
for i in $(seq 1 20); do
  launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || break
  sleep 0.5
done
launchctl bootstrap "gui/$(id -u)" "$PLIST" || launchctl kickstart -k "gui/$(id -u)/$LABEL"
for i in $(seq 1 30); do
  sleep 1
  if curl -s -o /dev/null -m 3 "http://127.0.0.1:$PORT/masuk"; then
    echo "Exact Practice jalan di http://127.0.0.1:$PORT  (log: ~/Library/Logs/exact-practice.log)"; exit 0
  fi
done
echo "Layanan belum menjawab — lihat ~/Library/Logs/exact-practice.log"; tail -20 "$HOME/Library/Logs/exact-practice.log"; exit 1
