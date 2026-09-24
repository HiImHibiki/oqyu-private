#!/bin/zsh
# Memasang server & menu bar agar hidup sendiri setiap Mac dinyalakan.
#   ./pasang-autostart.sh              -> hanya melayani Mac ini
#   ./pasang-autostart.sh --lan        -> bisa dibuka dari tablet/HP sejaringan
#   ./pasang-autostart.sh --lan 100.x  -> hanya lewat satu antarmuka (mis. Tailscale)
#   ./pasang-autostart.sh --copot      -> mencopot
set -e
cd "$(dirname "$0")"
SUMBER="$(pwd)"

# Layanan menunjuk ke APLIKASI di /Applications, bukan ke folder sumber ini.
# /Applications tidak dilindungi TCC, jadi launchd selalu boleh membacanya —
# dan folder sumbernya jadi bebas dipindah tanpa mematikan layanan.
APP="/Applications/Exact Worksheet.app"
if [[ -d "$APP" ]]; then
  AKAR="$APP/Contents/Resources"
else
  print -r -- "Aplikasi belum dibangun. Jalankan ./bangun-app.sh dulu."
  print -r -- "(sementara memakai folder sumber)"
  AKAR="$SUMBER"
fi
PLIST="$HOME/Library/LaunchAgents/com.exactcourse.worksheet.plist"

PLIST_JAGA="$HOME/Library/LaunchAgents/com.exactcourse.worksheet.penjaga.plist"

if [[ "${1:-}" == "--copot" ]]; then
  launchctl unload "$PLIST_JAGA" 2>/dev/null || true
  rm -f "$PLIST_JAGA"
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
    <!-- launchd memberi PATH minimal tanpa Homebrew. Tanpa baris ini, node,
         pdftotext, dan pdftoppm tidak ketemu dan alurnya gagal di tengah. -->
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>EXACT_API</key><string>$API</string>
$( [[ -n "$LAN" ]] && print -r -- "    <key>EXACT_LAN</key><string>$LAN</string>" )
  </dict>
  <!-- WAJIB Interactive. Sebagai tugas latar (bawaan launchd), Chrome kendali
       yang lahir dari layanan ini menerima pesan TEKS tapi mengabaikan klik
       kirim untuk pesan BERLAMPIRAN FOTO - tanpa galat apa pun: tombolnya
       hidup, unggahannya sukses (200), kliknya mendarat tepat, dan tidak
       terjadi apa-apa. Dibisek lewat agen launchd uji: Interactive sendirian
       membuatnya terkirim dalam 1 detik; variabel lingkungan tidak berpengaruh.
       Dugaan mekanismenya: penjadwalan tugas latar (App Nap/QoS) membuat alur
       kirim berlampiran yang menunggu penyelesaian unggah secara asinkron tak
       pernah tuntas, sedangkan kirim teks yang sinkron lolos. -->
  <key>ProcessType</key><string>Interactive</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/exact-worksheet.log</string>
  <key>StandardErrorPath</key><string>/tmp/exact-worksheet.log</string>
</dict></plist>
PL

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
print -r -- "Server dipasang: hidup sendiri saat Mac menyala, dan dinyalakan lagi bila mati."

# Penjaga kesehatan. KeepAlive milik launchd hanya melihat apakah prosesnya ADA;
# ia tidak bisa membedakan proses sehat dari proses tersangkut — dan yang kedua
# itu pernah terjadi: PID tercatat hidup, port 7790 tidak dijawab siapa pun, dan
# karena prosesnya "ada" ia tak pernah dinyalakan ulang.
#
# Dijalankan /usr/bin/python3, BUKAN zsh: kalau proyeknya diletakkan di
# ~/Documents atau ~/Desktop, /bin/zsh tidak diizinkan membaca berkas di situ
# (gejalanya "can't open input file") sedangkan python3 sudah diberi izin.
cat > "$PLIST_JAGA" <<PJ
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.exactcourse.worksheet.penjaga</string>
  <key>ProgramArguments</key>
  <array><string>/usr/bin/python3</string><string>$AKAR/penjaga.py</string></array>
  <key>WorkingDirectory</key><string>$AKAR</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>StartInterval</key><integer>120</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>/tmp/exact-penjaga.log</string>
  <key>StandardErrorPath</key><string>/tmp/exact-penjaga.log</string>
</dict></plist>
PJ

launchctl unload "$PLIST_JAGA" 2>/dev/null || true
launchctl load "$PLIST_JAGA"
print -r -- "Penjaga dipasang: memeriksa tiap 2 menit, menyalakan ulang bila tidak menyahut dua kali."
[[ -n "$LAN" ]] && print -r -- "  Akses jaringan: $LAN"

APP="$AKAR/menubar/dist/Exact Worksheet Bar.app"
if [[ -d "$APP" ]]; then
  osascript -e "tell application \"System Events\" to make login item at end with properties {path:\"$APP\", hidden:true}" >/dev/null 2>&1 || true
  print -r -- "Menu bar ditambahkan ke Login Items."
fi
