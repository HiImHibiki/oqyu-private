#!/bin/bash
# Nyalakan / pantau semua server Exact di Mac ini.
#
#   ./run-server.sh              nyalakan semua yang belum jalan (Practice mode produksi), lalu status
#   ./run-server.sh dev          sama, tapi Practice mode dev (hot reload — JANGAN untuk murid sungguhan)
#   ./run-server.sh status       layanan apa yang nyala, port, PID, mode, alamat
#   ./run-server.sh stop         matikan semua
#   ./run-server.sh restart [dev]
#   ./run-server.sh logs <worksheet|practice|canvas|tunnel>
#
#   ./run-server.sh publik on        buka Practice + Canvas ke internet lewat Cloudflare Tunnel
#   ./run-server.sh publik off       tutup lagi (kembali hanya Wi-Fi/lokal)
#   ./run-server.sh publik status
#   ./run-server.sh publik setup <host-practice> <host-canvas>
#                                    sekali saja, kalau punya domain di Cloudflare (alamat tetap);
#                                    tanpa setup = alamat acak *.trycloudflare.com tiap kali on
#
# Server tetap jalan di laptop ini; Cloudflare hanya meneruskan. Worksheet TIDAK
# pernah dibuka ke internet (endpoint-nya tanpa login dan bisa mencetak ke printer).
#
# Practice default mode PRODUKSI (next build + next start): mode dev mengirim data
# internal (kunci jawaban, riwayat murid lain) ke browser — lihat Exact-Practice/AGENTS.md.
# Build ulang hanya kalau kode Practice lebih baru dari build terakhir.
set -u
AKAR="$(cd "$(dirname "$0")" && pwd)"
RUN="$AKAR/.run"; LOG="$RUN/logs"
mkdir -p "$LOG"
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
# node dari nvm (shell non-interaktif tidak memuat .zshrc)
if ! command -v node >/dev/null 2>&1 && [ -d "$HOME/.nvm/versions/node" ]; then
  NODE_BIN="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1)"
  [ -n "$NODE_BIN" ] && export PATH="$NODE_BIN:$PATH"
fi

WS="$AKAR/Exact-Worksheet"; PR="$AKAR/Exact-Practice"; CV="$AKAR/exact-canvas"
PORT_WS=7790; PORT_PR=8770; PORT_CV=4747; PORT_CV_DEV=1421

hijau() { printf '\033[32m%s\033[0m' "$1"; }
merah() { printf '\033[31m%s\033[0m' "$1"; }
kuning() { printf '\033[33m%s\033[0m' "$1"; }

# Jalankan di latar, lepas penuh dari terminal/pemanggil: stdin /dev/null, output ke
# log, SEMUA descriptor warisan ditutup, sesi sendiri. `nohup … &` saja tidak cukup —
# descriptor lain yang terwariskan membuat pipa pemanggil tak pernah selesai
# (./run-server.sh | tail menggantung) dan Ctrl+C di terminal ikut mematikan server.
lepas() { # <log> <perintah…>
  python3 - "$@" <<'PY'
import subprocess, sys
log = open(sys.argv[1], "ab")
subprocess.Popen(sys.argv[2:], stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
                 close_fds=True, start_new_session=True)
PY
}

pid_port() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1; }
tunggu_port() { # port detik
  local i=0; while [ $i -lt "$2" ]; do [ -n "$(pid_port "$1")" ] && return 0; sleep 1; i=$((i+1)); done; return 1
}
pid_canvas_app() { pgrep -f "exact-canvas/src-tauri/target/debug/exact-canvas|target/debug/exact-canvas" | head -1; }
ip_lan() { ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo ""; }

# ---------------------------------------------------------------- start
start_worksheet() {
  if [ -n "$(pid_port $PORT_WS)" ]; then echo "  Worksheet  sudah jalan"; return; fi
  [ -x "$WS/ocr-mac/visionocr" ] || { echo "  Worksheet  $(merah GAGAL): jalankan dulu $WS/pasang.sh"; return; }
  echo "  Worksheet  menyalakan…"
  : >"$LOG/worksheet.log"; (cd "$WS" && lepas "$LOG/worksheet.log" python3 cari.py)
  tunggu_port $PORT_WS 20 || echo "  Worksheet  $(merah 'tidak menyala') — ./run-server.sh logs worksheet"
}

practice_perlu_build() {
  [ -f "$PR/.next/BUILD_ID" ] || return 0
  # build dev tidak bisa dipakai next start
  [ -f "$PR/.next/prerender-manifest.json" ] || return 0
  [ -n "$(find "$PR/src" "$PR/package.json" "$PR/next.config.ts" "$PR/.env.local" -newer "$PR/.next/BUILD_ID" -type f 2>/dev/null | head -1)" ]
}

start_practice() {
  local mode="$1" pid; pid="$(pid_port $PORT_PR)"
  if [ -n "$pid" ]; then
    local jalan="produksi"; ps -o command= -p "$pid" | grep -q "next dev\|next-server.*dev" && jalan="dev"
    if [ "$(mode_practice)" != "$mode" ]; then
      echo "  Practice   jalan dalam mode $(mode_practice), diminta $mode — mematikan dulu"
      stop_port $PORT_PR
    else echo "  Practice   sudah jalan ($mode)"; return; fi
  fi
  [ -d "$PR/node_modules" ] || (cd "$PR" && echo "  Practice   npm ci…" && npm ci --no-audit --no-fund >"$LOG/practice-install.log" 2>&1)
  # Mode publik: alamat Cloudflare untuk Practice & Canvas (dibaca saat server
  # jalan, bukan saat build — ganti mode cukup restart, tanpa build ulang).
  [ -f "$RUN/publik.env" ] && { set -a; . "$RUN/publik.env"; set +a; }
  if [ "$mode" = "dev" ]; then
    echo "  Practice   menyalakan (dev)…"
    : >"$LOG/practice.log"; (cd "$PR" && lepas "$LOG/practice.log" npx next dev -p $PORT_PR)
  else
    if practice_perlu_build; then
      echo "  Practice   build produksi (±1 menit)…"
      (cd "$PR" && npx next build >"$LOG/practice-build.log" 2>&1) || { echo "  Practice   $(merah 'BUILD GAGAL') — lihat $LOG/practice-build.log"; return; }
    fi
    echo "  Practice   menyalakan (produksi)…"
    : >"$LOG/practice.log"; (cd "$PR" && lepas "$LOG/practice.log" npx next start -p $PORT_PR)
  fi
  tunggu_port $PORT_PR 90 || echo "  Practice   $(merah 'tidak menyala') — ./run-server.sh logs practice"
}

start_canvas() {
  if [ -n "$(pid_canvas_app)" ]; then echo "  Canvas     sudah jalan"; return; fi
  command -v cargo >/dev/null || { echo "  Canvas     $(merah GAGAL): Rust belum terpasang (rustup)"; return; }
  local practice_url
  practice_url="$(grep -E '^EXACT_PRACTICE_PUBLIC=' "$PR/.env.local" 2>/dev/null | cut -d= -f2-)"
  practice_url="${practice_url:-http://localhost:$PORT_PR}"
  [ -d "$CV/node_modules" ] || (cd "$CV" && npm ci --no-audit --no-fund >"$LOG/canvas-install.log" 2>&1)
  # Halaman TV/HP murid (/tv) disajikan dari dist/ saat tauri dev — build kalau belum/basi.
  if [ ! -f "$CV/dist/tv.html" ] || [ -n "$(find "$CV/src" "$CV/tv.html" "$CV/index.html" -newer "$CV/dist/tv.html" -type f 2>/dev/null | head -1)" ]; then
    echo "  Canvas     build halaman murid (dist)…"
    (cd "$CV" && VITE_PRACTICE_URL="$practice_url" npm run build >"$LOG/canvas-build.log" 2>&1) || echo "  Canvas     $(kuning 'build dist gagal') — /tv bisa 404"
  fi
  echo "  Canvas     membuka aplikasi (tauri dev, build Rust pertama bisa beberapa menit)…"
  : >"$LOG/canvas.log"; (cd "$CV" && export VITE_PRACTICE_URL="$practice_url" && lepas "$LOG/canvas.log" npm run app)
  if tunggu_port $PORT_CV 240; then :; elif [ -n "$(pid_canvas_app)" ]; then
    echo "  Canvas     aplikasi terbuka; berbagi mati — nyalakan di Canvas: ⌘, → Share on this network"
  else echo "  Canvas     $(merah 'tidak menyala') — ./run-server.sh logs canvas"; fi
}

# ---------------------------------------------------------------- publik (Cloudflare Tunnel)
KONF="$RUN/publik.conf"   # ada = mode domain sendiri (named tunnel); tidak ada = trycloudflare

restart_practice() { stop_port $PORT_PR; sleep 1; start_practice produksi; }

publik_setup() {
  local hp="${1:-}" hc="${2:-}"
  [ -n "$hp" ] && [ -n "$hc" ] || { echo "Pemakaian: ./run-server.sh publik setup <host-practice> <host-canvas>"; echo "  mis. ./run-server.sh publik setup latihan.domainku.com kanvas.domainku.com"; return 1; }
  command -v cloudflared >/dev/null || { echo "cloudflared belum ada: brew install cloudflared"; return 1; }
  if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
    echo "Login Cloudflare di browser (pilih zona domain yang dipakai)…"
    cloudflared tunnel login || return 1
  fi
  local nama; nama="exact-$(scutil --get LocalHostName 2>/dev/null | tr 'A-Z' 'a-z' | tr -cd 'a-z0-9-')"
  cloudflared tunnel list 2>/dev/null | awk '{print $2}' | grep -qx "$nama" || cloudflared tunnel create "$nama" || return 1
  local id; id="$(cloudflared tunnel list 2>/dev/null | awk -v n="$nama" '$2==n{print $1}' | head -1)"
  [ -n "$id" ] || { echo "Tunnel $nama tidak ditemukan"; return 1; }
  local yml="$HOME/.cloudflared/$nama.yml"
  cat > "$yml" <<YML
# Exact (dibuat run-server.sh) — Practice & Canvas saja; Worksheet sengaja tidak dibuka.
tunnel: $id
credentials-file: $HOME/.cloudflared/$id.json
ingress:
  - hostname: $hp
    service: http://localhost:$PORT_PR
  - hostname: $hc
    service: http://localhost:$PORT_CV
  - service: http_status:404
YML
  cloudflared tunnel route dns --overwrite-dns "$nama" "$hp" && cloudflared tunnel route dns --overwrite-dns "$nama" "$hc" || return 1
  printf 'NAMA=%s\nCONFIG=%s\nPRACTICE_HOST=%s\nCANVAS_HOST=%s\n' "$nama" "$yml" "$hp" "$hc" > "$KONF"
  echo "Siap. Nyalakan dengan: ./run-server.sh publik on"
}

pid_tunnel() { pgrep -f "cloudflared.*(exact-|localhost:$PORT_PR|localhost:$PORT_CV)" 2>/dev/null; }

url_quick() { # file log → alamat trycloudflare
  grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$1" 2>/dev/null | head -1
}

publik_on() {
  command -v cloudflared >/dev/null || { echo "cloudflared belum ada: brew install cloudflared"; return 1; }
  [ -n "$(pid_port $PORT_PR)" ] || start_practice produksi
  if [ "$(mode_practice)" = "dev" ]; then
    echo "$(merah DITOLAK): Practice sedang mode dev (membocorkan kunci jawaban ke browser)."
    echo "Jalankan ./run-server.sh restart dulu (mode produksi), lalu publik on."; return 1
  fi
  [ -n "$(pid_port $PORT_CV)" ] || echo "  $(kuning Catatan): berbagi Canvas mati — kanvas coret murid tidak akan tampil (⌘, → Share on this network)."
  if [ -n "$(pid_tunnel)" ]; then echo "Tunnel sudah jalan."; publik_status; return 0; fi
  local up uc
  if [ -f "$KONF" ]; then
    . "$KONF"
    echo "Menyalakan tunnel $NAMA…"
    : >"$LOG/tunnel.log"; lepas "$LOG/tunnel.log" cloudflared --no-autoupdate --config "$CONFIG" tunnel run "$NAMA"
    up="https://$PRACTICE_HOST"; uc="https://$CANVAS_HOST"
    sleep 5
  else
    echo "Menyalakan tunnel cepat (alamat acak trycloudflare.com)…"
    : >"$LOG/tunnel-practice.log"; : >"$LOG/tunnel-canvas.log"
    lepas "$LOG/tunnel-practice.log" cloudflared --no-autoupdate tunnel --url "http://localhost:$PORT_PR"
    lepas "$LOG/tunnel-canvas.log" cloudflared --no-autoupdate tunnel --url "http://localhost:$PORT_CV"
    local i=0
    while [ $i -lt 40 ]; do
      up="$(url_quick "$LOG/tunnel-practice.log")"; uc="$(url_quick "$LOG/tunnel-canvas.log")"
      [ -n "$up" ] && [ -n "$uc" ] && break; sleep 1; i=$((i+1))
    done
    cat "$LOG/tunnel-practice.log" "$LOG/tunnel-canvas.log" > "$LOG/tunnel.log"
    [ -n "$up" ] && [ -n "$uc" ] || { echo "$(merah 'Tunnel gagal') — lihat $LOG/tunnel.log"; publik_off diam; return 1; }
  fi
  printf 'EXACT_PRACTICE_PUBLIC=%s\nEXACT_CANVAS_PUBLIC=%s\n' "$up" "$uc" > "$RUN/publik.env"
  echo "Memuat ulang Practice dengan alamat publik…"; restart_practice
  publik_status
}

publik_off() {
  pkill -f "cloudflared.*(tunnel run exact-|tunnel --url http://localhost:($PORT_PR|$PORT_CV))" 2>/dev/null
  local ada=0; [ -f "$RUN/publik.env" ] && ada=1
  rm -f "$RUN/publik.env"
  [ "${1:-}" = "diam" ] && return 0
  echo "Tunnel ditutup — tidak bisa diakses dari internet lagi."
  if [ $ada = 1 ] && [ -n "$(pid_port $PORT_PR)" ]; then echo "Memuat ulang Practice ke alamat lokal…"; restart_practice; fi
}

publik_status() {
  if [ -n "$(pid_tunnel)" ] && [ -f "$RUN/publik.env" ]; then
    . "$RUN/publik.env"
    echo
    echo "  $(hijau 'PUBLIK NYALA') $( [ -f "$KONF" ] && echo '(domain sendiri)' || echo '(alamat acak — berganti tiap publik on)')"
    echo "  Murid & guru : $EXACT_PRACTICE_PUBLIC"
    echo "  Guru (admin) : $EXACT_PRACTICE_PUBLIC/admin/masuk"
    echo "  Canvas murid : $EXACT_CANVAS_PUBLIC/tv?murid=1"
    echo "  Worksheet    : tidak dibuka (hanya di laptop ini)"
    echo "  Tutup        : ./run-server.sh publik off"
  else
    echo "  Publik: $(merah MATI) — hanya localhost / Wi-Fi yang sama. Buka: ./run-server.sh publik on"
  fi
}

# ---------------------------------------------------------------- stop
stop_port() { local p; p="$(pid_port "$1")"; [ -n "$p" ] && kill "$p" 2>/dev/null; sleep 1; p="$(pid_port "$1")"; [ -n "$p" ] && kill -9 "$p" 2>/dev/null; true; }
stop_semua() {
  echo "Mematikan…"
  publik_off diam
  stop_port $PORT_WS && echo "  Worksheet  mati"
  pkill -f "next (dev|start) -p $PORT_PR" 2>/dev/null; stop_port $PORT_PR && echo "  Practice   mati"
  pkill -f "exact-canvas.*tauri dev" 2>/dev/null; pkill -f "target/debug/exact-canvas" 2>/dev/null
  pkill -f "exact-canvas/node_modules/.bin/vite" 2>/dev/null; stop_port $PORT_CV_DEV; echo "  Canvas     mati"
}

# ---------------------------------------------------------------- status
mode_practice() {
  local p; p="$(pid_port $PORT_PR)"; [ -z "$p" ] && { echo "-"; return; }
  local cmd; cmd="$(ps -o command= -p "$p") $(ps -o command= -p "$(ps -o ppid= -p "$p" | tr -d ' ')" 2>/dev/null)"
  if echo "$cmd" | grep -q "next dev\|dev -p"; then echo "dev"
  elif echo "$cmd" | grep -q "next start\|start -p"; then echo "produksi"
  elif [ -f "$PR/.next/prerender-manifest.json" ] && [ ! -d "$PR/.next/server/app-paths-manifest.json" ]; then echo "produksi"
  else echo "?"; fi
}

baris() { # nama port pid mode alamat
  if [ -n "$3" ]; then
    printf "  %-11s %s  %-6s %-7s %-9s %s\n" "$1" "$(hijau NYALA)" "$2" "$3" "$4" "$5"
  else
    printf "  %-11s %s   %-6s %-7s %-9s %s\n" "$1" "$(merah MATI)" "$2" "-" "-" ""
  fi
}

status() {
  local ip; ip="$(ip_lan)"
  echo
  printf "  %-11s %-5s  %-6s %-7s %-9s %s\n" "LAYANAN" "STATUS" "PORT" "PID" "MODE" "ALAMAT"
  local p
  p="$(pid_port $PORT_WS)"; baris "Worksheet" $PORT_WS "$p" "python" "http://localhost:$PORT_WS"
  p="$(pid_port $PORT_PR)"; baris "Practice" $PORT_PR "$p" "$(mode_practice)" "http://localhost:$PORT_PR  ·  guru: /admin/masuk"
  p="$(pid_port $PORT_CV)"
  if [ -n "$p" ]; then baris "Canvas" $PORT_CV "$p" "berbagi" "http://localhost:$PORT_CV/tv?murid=1  ·  tablet: /admin"
  elif [ -n "$(pid_canvas_app)" ]; then printf "  %-11s %s  %-6s %-7s %-9s %s\n" "Canvas" "$(kuning APLIKASI)" "-" "$(pid_canvas_app)" "tanpa" "berbagi mati: ⌘, → Share on this network"
  else baris "Canvas" $PORT_CV "" "" ""; fi
  p="$(pid_port $PORT_CV_DEV)"; [ -n "$p" ] && printf "  %-11s %s  %-6s %-7s %-9s %s\n" "Canvas-UI" "$(hijau NYALA)" $PORT_CV_DEV "$p" "vite" "(internal aplikasi Canvas)"
  echo
  [ -n "$ip" ] && echo "  Dari HP/tablet di Wi-Fi yang sama: ganti localhost dengan $ip (Practice & Canvas)."
  [ "$(mode_practice)" = "dev" ] && echo "  $(kuning PERINGATAN): Practice mode dev — jangan dipakai murid sungguhan (./run-server.sh restart)."
  publik_status
  echo "  Log: $LOG   ·   ./run-server.sh logs <worksheet|practice|canvas|tunnel>"
  echo
}

case "${1:-start}" in
  start|"") echo "Menyalakan server Exact…"; start_worksheet; start_practice produksi; start_canvas; status ;;
  dev)      echo "Menyalakan server Exact (Practice dev)…"; start_worksheet; start_practice dev; start_canvas; status ;;
  status)   status ;;
  stop)     stop_semua; status ;;
  restart)  stop_semua; sleep 2; m="produksi"; [ "${2:-}" = "dev" ] && m="dev"
            start_worksheet; start_practice "$m"; start_canvas; status ;;
  publik|tunnel)
            case "${2:-status}" in
              on) publik_on ;; off) publik_off ;; setup) publik_setup "${3:-}" "${4:-}" ;; *) publik_status ;;
            esac ;;
  logs)     f="$LOG/${2:-}.log"; [ -f "$f" ] && tail -n 60 -f "$f" || echo "Pilih: worksheet | practice | canvas" ;;
  *)        sed -n '2,14p' "$0" ;;
esac
