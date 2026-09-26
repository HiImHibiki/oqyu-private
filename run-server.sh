#!/bin/bash
# Nyalakan / pantau semua server Exact di Mac ini.
#
#   ./run-server.sh              nyalakan semua yang belum jalan (Practice mode produksi), lalu status
#   ./run-server.sh dev          sama, tapi Practice mode dev (hot reload — JANGAN untuk murid sungguhan)
#   ./run-server.sh status       layanan apa yang nyala, port, PID, mode, alamat
#   ./run-server.sh stop         matikan semua
#   ./run-server.sh restart [dev]
#   ./run-server.sh logs <worksheet|practice|canvas>
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
  (cd "$WS" && nohup python3 cari.py </dev/null >"$LOG/worksheet.log" 2>&1 &)
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
  if [ "$mode" = "dev" ]; then
    echo "  Practice   menyalakan (dev)…"
    (cd "$PR" && nohup npx next dev -p $PORT_PR </dev/null >"$LOG/practice.log" 2>&1 &)
  else
    if practice_perlu_build; then
      echo "  Practice   build produksi (±1 menit)…"
      (cd "$PR" && npx next build >"$LOG/practice-build.log" 2>&1) || { echo "  Practice   $(merah 'BUILD GAGAL') — lihat $LOG/practice-build.log"; return; }
    fi
    echo "  Practice   menyalakan (produksi)…"
    (cd "$PR" && nohup npx next start -p $PORT_PR </dev/null >"$LOG/practice.log" 2>&1 &)
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
  (cd "$CV" && VITE_PRACTICE_URL="$practice_url" nohup npm run app </dev/null >"$LOG/canvas.log" 2>&1 &)
  if tunggu_port $PORT_CV 240; then :; elif [ -n "$(pid_canvas_app)" ]; then
    echo "  Canvas     aplikasi terbuka; berbagi mati — nyalakan di Canvas: ⌘, → Share on this network"
  else echo "  Canvas     $(merah 'tidak menyala') — ./run-server.sh logs canvas"; fi
}

# ---------------------------------------------------------------- stop
stop_port() { local p; p="$(pid_port "$1")"; [ -n "$p" ] && kill "$p" 2>/dev/null; sleep 1; p="$(pid_port "$1")"; [ -n "$p" ] && kill -9 "$p" 2>/dev/null; true; }
stop_semua() {
  echo "Mematikan…"
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
  local tun; tun="$(pgrep -fl cloudflared 2>/dev/null | head -1)"
  [ -n "$tun" ] && printf "  %-11s %s  %-6s %-7s %-9s %s\n" "Tunnel" "$(hijau NYALA)" "-" "$(echo "$tun" | cut -d' ' -f1)" "cloudflare" "cloudflared"
  echo
  [ -n "$ip" ] && echo "  Dari HP/tablet di Wi-Fi yang sama: ganti localhost dengan $ip (Practice & Canvas)."
  [ "$(mode_practice)" = "dev" ] && echo "  $(kuning PERINGATAN): Practice mode dev — jangan dipakai murid sungguhan (./run-server.sh restart)."
  echo "  Log: $LOG   ·   ./run-server.sh logs <worksheet|practice|canvas>"
  echo
}

case "${1:-start}" in
  start|"") echo "Menyalakan server Exact…"; start_worksheet; start_practice produksi; start_canvas; status ;;
  dev)      echo "Menyalakan server Exact (Practice dev)…"; start_worksheet; start_practice dev; start_canvas; status ;;
  status)   status ;;
  stop)     stop_semua; status ;;
  restart)  stop_semua; sleep 2; m="produksi"; [ "${2:-}" = "dev" ] && m="dev"
            start_worksheet; start_practice "$m"; start_canvas; status ;;
  logs)     f="$LOG/${2:-}.log"; [ -f "$f" ] && tail -n 60 -f "$f" || echo "Pilih: worksheet | practice | canvas" ;;
  *)        sed -n '2,14p' "$0" ;;
esac
