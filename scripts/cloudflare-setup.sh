#!/bin/bash
# Pasang Cloudflare Tunnel untuk Exact Canvas di Mac ini.
#
#   ./scripts/cloudflare-setup.sh kanvas.domain-anda.com
#
# Membuat tunnel bernama exact-canvas-<nama mac>, mengarahkan subdomain ke
# tunnel itu, dan memasang layanan pengguna yang menjalankannya tiap login.
# Domainnya harus sudah dikelola Cloudflare (nameserver Cloudflare).
set -euo pipefail

HOST="${1:-}"
if [ -z "$HOST" ]; then
  echo "Pakai: $0 <subdomain.domain.com>"; exit 1
fi
PORT="${PORT:-4747}"
NAMA="exact-canvas-$(scutil --get ComputerName 2>/dev/null | tr -cd '[:alnum:]' | tr '[:upper:]' '[:lower:]' | cut -c1-24)"
CF_DIR="$HOME/.cloudflared"
CFG="$CF_DIR/exact-canvas.yml"
LABEL="com.exactcanvas.tunnel"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

echo "== 1/5 cloudflared"
if ! command -v cloudflared >/dev/null; then
  if command -v brew >/dev/null; then brew install cloudflared; else
    echo "Homebrew belum ada. Pasang dulu: https://brew.sh — lalu jalankan lagi."; exit 1; fi
fi
CFD="$(command -v cloudflared)"

echo "== 2/5 login Cloudflare (browser terbuka bila belum pernah)"
[ -f "$CF_DIR/cert.pem" ] || "$CFD" tunnel login

echo "== 3/5 tunnel $NAMA"
if ! "$CFD" tunnel list 2>/dev/null | awk '{print $2}' | grep -qx "$NAMA"; then
  "$CFD" tunnel create "$NAMA"
fi
ID="$("$CFD" tunnel list 2>/dev/null | awk -v n="$NAMA" '$2==n{print $1}')"
[ -n "$ID" ] || { echo "Tunnel tidak ditemukan."; exit 1; }

cat > "$CFG" <<YML
# Exact Canvas — kelas langsung lewat Cloudflare Tunnel (dibuat $(date +%F)).
tunnel: $ID
credentials-file: $CF_DIR/$ID.json
ingress:
  - hostname: $HOST
    service: http://localhost:$PORT
    originRequest:
      connectTimeout: 30s
  - service: http_status:404
YML

echo "== 4/5 DNS $HOST → tunnel"
"$CFD" --config "$CFG" tunnel route dns --overwrite-dns "$NAMA" "$HOST"

echo "== 5/5 layanan pengguna"
mkdir -p "$HOME/Library/Logs"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$CFD</string><string>--config</string><string>$CFG</string>
    <string>tunnel</string><string>run</string><string>$NAMA</string>
  </array>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/exact-canvas-tunnel.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/exact-canvas-tunnel.log</string>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo
echo "Selesai. Alamat publik: https://$HOST"
echo "Di Exact Canvas: Settings → Share on this network → isi Public address dengan https://$HOST,"
echo "nyalakan berbagi, dan pakai PIN 6–8 digit."
