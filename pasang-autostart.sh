#!/bin/zsh
# Memasang server & menu bar agar hidup sendiri setiap Mac dinyalakan.
#   ./pasang-autostart.sh              -> hanya melayani Mac ini
#   ./pasang-autostart.sh --lan        -> bisa dibuka dari tablet/HP sejaringan
#   ./pasang-autostart.sh --lan 100.x  -> hanya lewat satu antarmuka (mis. Tailscale)
#   ./pasang-autostart.sh --copot      -> mencopot
set -e
cd "$(dirname "$0")"
AKAR="$(pwd)"
PLIST="$HOME/Library/LaunchAgents/com.exactcourse.worksheet.plist"

if [[ "${1:-}" == "--copot" ]]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  osascript -e 'tell application "System Events" to delete login item "Exact Worksheet Bar"' 2>/dev/null || true
  print -r -- "Autostart dicopot."
  exit 0
fi

LAN=""
if [[ "${1:-}" == "--lan" ]]; then LAN="${2:-1}"; fi

API="${EXACT_API:-http://100.91.114.104:11434/v1/chat/completions}"

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.exactcourse.worksheet</string>
  <key>ProgramArguments</key>
  <array><string>/usr/bin/python3</string><string>$AKAR/cari.py</string></array>
  <key>WorkingDirectory</key><string>$AKAR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>EXACT_API</key><string>$API</string>
$( [[ -n "$LAN" ]] && print -r -- "    <key>EXACT_LAN</key><string>$LAN</string>" )
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/exact-worksheet.log</string>
  <key>StandardErrorPath</key><string>/tmp/exact-worksheet.log</string>
</dict></plist>
PL

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
print -r -- "Server dipasang: hidup sendiri saat Mac menyala, dan dinyalakan lagi bila mati."
[[ -n "$LAN" ]] && print -r -- "  Akses jaringan: $LAN"

APP="$AKAR/menubar/dist/Exact Worksheet Bar.app"
if [[ -d "$APP" ]]; then
  osascript -e "tell application \"System Events\" to make login item at end with properties {path:\"$APP\", hidden:true}" >/dev/null 2>&1 || true
  print -r -- "Menu bar ditambahkan ke Login Items."
fi
