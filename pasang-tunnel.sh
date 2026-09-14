#!/bin/zsh
# Pasang Cloudflare Tunnel untuk Exact Practice di Mac ini.
#   ./pasang-tunnel.sh practice-velisia.exactprintsolution.com [nama-tunnel]
# Prasyarat: `brew install cloudflared` dan `cloudflared tunnel login` (sekali,
# memilih zona domain di akun Cloudflare yang dipakai). Membuat tunnel bernama
# exact-practice, config ~/.cloudflared/exact-practice.yml, CNAME hostname →
# tunnel, dan LaunchAgent com.exactcourse.practice.tunnel yang selalu menyala.
set -e
HOST="$1"; [ -n "$HOST" ] || { echo "pakai: $0 <hostname>"; exit 1; }
command -v cloudflared >/dev/null || { echo "cloudflared belum ada: brew install cloudflared"; exit 1; }
ls ~/.cloudflared/cert.pem >/dev/null 2>&1 || { echo "belum login: jalankan 'cloudflared tunnel login' dulu"; exit 1; }
# Nama tunnel PER MAC: nama tunnel bersifat per akun Cloudflare, dan beberapa Mac
# memakai akun yang sama. Nama yang sama akan "menemukan" tunnel milik Mac lain
# yang kredensialnya tidak ada di sini. Boleh dipaksa lewat argumen ke-2.
NAMA="${2:-exact-practice-$(scutil --get LocalHostName 2>/dev/null | tr 'A-Z' 'a-z' | tr -c 'a-z0-9\n' '-')}"
YML="$HOME/.cloudflared/$NAMA.yml"; LABEL=com.exactcourse.practice.tunnel
if ! cloudflared tunnel list 2>/dev/null | grep -qE "[[:space:]]$NAMA[[:space:]]"; then cloudflared tunnel create "$NAMA"; fi
ID=$(cloudflared tunnel list 2>/dev/null | awk -v n="$NAMA" '$2==n{print $1}' | head -1)
[ -n "$ID" ] || { echo "tunnel $NAMA tidak ditemukan"; exit 1; }
cat > "$YML" <<Y
# Exact Practice — $HOST → port 8770 (dibuat pasang-tunnel.sh)
tunnel: $ID
credentials-file: $HOME/.cloudflared/$ID.json
ingress:
  - hostname: $HOST
    service: http://localhost:8770
  - service: http_status:404
Y
cloudflared --config "$YML" tunnel route dns --overwrite-dns "$NAMA" "$HOST"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
cat > "$PLIST" <<P
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$(command -v cloudflared)</string><string>--config</string><string>$YML</string>
    <string>tunnel</string><string>run</string>
  </array>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/exact-practice-tunnel.log</string>
  <key>StandardErrorPath</key><string>/tmp/exact-practice-tunnel.log</string>
</dict></plist>
P
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
# alamat publik dipakai Practice untuk tautan balik (afiliasi, Ke Practice)
if [ -f .env.local ]; then
  grep -q '^EXACT_PRACTICE_PUBLIC=' .env.local && sed -i '' "s|^EXACT_PRACTICE_PUBLIC=.*|EXACT_PRACTICE_PUBLIC=https://$HOST|" .env.local || echo "EXACT_PRACTICE_PUBLIC=https://$HOST" >> .env.local
  grep -q '^NEXT_PUBLIC_SITE_URL=' .env.local && sed -i '' "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=https://$HOST|" .env.local || echo "NEXT_PUBLIC_SITE_URL=https://$HOST" >> .env.local
  echo ".env.local: EXACT_PRACTICE_PUBLIC & NEXT_PUBLIC_SITE_URL → https://$HOST (jalankan ./pasang-app.sh lagi agar terpakai)"
fi
for i in $(seq 1 24); do sleep 5; K=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "https://$HOST/masuk"); [ "$K" = "200" ] && { echo "https://$HOST → 200"; exit 0; }; done
echo "belum menjawab 200 (DNS bisa butuh beberapa menit); cek /tmp/exact-practice-tunnel.log"
