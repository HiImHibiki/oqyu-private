# Memasang Exact Worksheet + Exact Canvas + Exact Practice di Mac baru

Panduan ini untuk **Claude Code yang menjalankan pemasangan** di Mac baru milik
Exact Course. Kerjakan berurutan; berhenti di verifikasi yang gagal.
Disusun 14 Sep 2026.

## Gambaran
Tiap Mac **berdiri sendiri**: Worksheet + Canvas + Practice lengkap, dengan
**domain Cloudflare-nya masing-masing** (Rico yang memberi tahu domainnya,
biasanya dua: satu untuk Canvas/meet, satu untuk Practice). Data (akun murid,
paket, pesanan, vault kanvas) milik Mac itu sendiri. Tidak ada yang berbagi
dengan Mac utama Rico kecuali kode di GitHub.

| Aplikasi | Port | Peran |
|---|---|---|
| Exact Worksheet | 7790 | buat soal/kunci/rangkuman via Gemini (Chrome kendali); dipakai dari HP lewat Tailscale |
| Exact Canvas | 4747 | kanvas kelas; TV/tablet lokal + murid dari internet lewat domain Canvas |
| Exact Practice | 8770 | latihan & ujian online murid; domain Practice |

## 0. Yang harus disiapkan Rico (Claude tidak bisa)
1. **Domain** untuk Mac ini: `CANVAS_HOST` (mis. `meet-velisia.exactprintsolution.com`) dan `PRACTICE_HOST` (mis. `practice-velisia.exactprintsolution.com`) — akan diberi tahu Rico.
2. Akun **Cloudflare** yang memegang zona domain itu (untuk `cloudflared tunnel login` di browser).
3. **Tailscale** masuk akun yang sama (`tailscale status` menampilkan Mac utama `100.83.25.73`).
4. `gh auth login` — akses repo privat `Exact-Digital/Exact-Worksheet`, `Exact-Digital/Exact-Practice`, `ricokurniawan18-ui/exact-canvas`.
5. **Login Google Gemini** sekali di Chrome kendali (langkah 2.3).
6. Membuka System Settings: **Full Disk Access** untuk `/usr/bin/python3`.
7. Email guru pemilik Mac ini (jadi admin Practice) dan **kode kelas** pilihan (mis. `VELISIA2026`).

## 1. Kebutuhan sistem
```bash
xcode-select --install
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node gh cloudflared
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && source "$HOME/.cargo/env"   # Canvas (Tauri)
gh auth login
cloudflared tunnel login          # buka browser, pilih zona domain
```
Google Chrome harus ada di `/Applications/Google Chrome.app`. Verifikasi: `node -v`, `python3 --version`, `rustc --version`, `gh auth status`, `ls ~/.cloudflared/cert.pem`.

## 2. Exact Worksheet
```bash
mkdir -p ~/Documents/"PROJECT EXACT GROUP" && cd ~/Documents/"PROJECT EXACT GROUP"
gh repo clone Exact-Digital/Exact-Worksheet "Exact Worksheet" && cd "Exact Worksheet"
```
2.1 Ikuti **`PASANG.md`** di repo itu apa adanya (pasang.sh → bangun-app.sh → pasang-autostart.sh --lan, Full Disk Access `/usr/bin/python3`, verifikasi "lembar terbaca"). Jangan jalankan server dari terminal.

2.2 Login Gemini sekali: dari folder repo `EXACT_TAMPIL=1 python3 -c "import cdp; cdp.nyalakan_ulang(True)"`, login di jendela yang muncul, tutup jendelanya.

2.3 Kunci untuk tombol **Ke Practice** (Practice lokal di Mac ini) — buat kunci acak dan simpan di dua tempat (langkah 4.2 memakai nilai yang sama):
```bash
KUNCI=$(python3 -c "import secrets;print(secrets.token_hex(16))"); echo "$KUNCI" > ~/.exact-practice-kunci
printf '{"url": "http://127.0.0.1:8770", "kunci": "%s"}\n' "$KUNCI" > ~/Library/Application\ Support/Exact\ Worksheet/practice.json
```
2.4 Uji: buat satu topik di `http://localhost:7790/buat` → PDF muncul di Desktop. Menu bar **EW** ada tombol Restart Chrome / Restart aplikasi.

2.5 HP/tablet (aplikasi Android Exact Worksheet): pilih Mac ini — preset **Velisia** `100.70.73.4` ada di aplikasi; Mac lain pilih "Mac lain" + `tailscale ip -4`.

## 3. Exact Canvas
```bash
cd ~/Documents/"PROJECT EXACT GROUP"
gh repo clone ricokurniawan18-ui/exact-canvas "exact canvas" && cd "exact canvas"
npm install
VITE_PRACTICE_URL="https://PRACTICE_HOST" npm run app:build     # tombol 📝 Practice di HP murid mengarah ke Practice Mac ini
ditto "src-tauri/target/release/bundle/macos/Exact Canvas.app" "/Applications/Exact Canvas.app"
open -a "Exact Canvas"
```
- Settings (⌘,) → **Share on this network** → catat **PIN 4 digit** (berbagi_pin) dan sandi admin. PIN itu dipakai Practice (langkah 4.2).
- Tunnel Canvas: `./scripts/cloudflare-setup.sh CANVAS_HOST` (mengikuti README repo). Verifikasi: `curl -s -o /dev/null -w '%{http_code}\n' "https://CANVAS_HOST/tv?murid=1"` → 200.
- Salin ke /Applications memakai `ditto` dari terminal biasa (bukan sandbox); vault data di `~/ExactCanvas`.

## 4. Exact Practice
```bash
cd ~/Documents/"PROJECT EXACT GROUP"
gh repo clone Exact-Digital/Exact-Practice "Exact Practice" && cd "Exact Practice"
npm install && cp .env.contoh .env.local
```
4.2 Isi `.env.local`:
```
ADMIN_EMAILS=<email guru pemilik Mac ini>
EXACT_KODE_KELAS=<kode kelas pilihan>
EXACT_WORKSHEET_URL=http://127.0.0.1:7790
EXACT_CANVAS_URL=http://127.0.0.1:4747
EXACT_CANVAS_PUBLIC=https://CANVAS_HOST
EXACT_CANVAS_PIN=<PIN 4 digit dari Canvas, langkah 3>
EXACT_PRACTICE_KUNCI=<isi ~/.exact-practice-kunci dari langkah 2.3>
EXACT_PRACTICE_PUBLIC=https://PRACTICE_HOST
NEXT_PUBLIC_SITE_URL=https://PRACTICE_HOST
NEXT_PUBLIC_ADMIN_WHATSAPP=<nomor WA guru, mis. 628xxxx>   # opsional, untuk pembeli umum
```
4.3 Pasang layanan + menu bar **EP**, lalu tunnel:
```bash
./pasang-app.sh                    # build, salin ke Application Support, LaunchAgent com.exactcourse.practice, menu bar EP
./pasang-tunnel.sh PRACTICE_HOST   # tunnel exact-practice + CNAME + LaunchAgent; lalu:
./pasang-app.sh --tanpa-build      # muat ulang .env.local yang diubah pasang-tunnel.sh
```
4.4 Guru mendaftar di `https://PRACTICE_HOST/daftar` (email di ADMIN_EMAILS + kode kelas) → otomatis admin. Verifikasi `https://PRACTICE_HOST/admin/latihan` → 200.

## 5. Daftar periksa akhir
```bash
curl -s -o /dev/null -w 'worksheet %{http_code}\n' http://127.0.0.1:7790/status
curl -s -o /dev/null -w 'canvas    %{http_code}\n' "https://CANVAS_HOST/tv?murid=1"
curl -s -o /dev/null -w 'practice  %{http_code}\n' "https://PRACTICE_HOST/masuk"
launchctl list | grep -E "exactcourse|exactcanvas"     # worksheet, worksheet.penjaga, practice, practice.tunnel, tunnel canvas
pgrep -x ExactWorksheetBar >/dev/null && echo "EW jalan"; pgrep -x ExactPracticeBar >/dev/null && echo "EP jalan"
```
Ujung ke ujung: buat soal dari HP → PDF di Desktop → **Ke Practice** → paket muncul di `https://PRACTICE_HOST/admin/latihan` dengan kode ujian → murid masuk lewat akun Canvas (No. HP + sandi) → tombol 📝 Practice di HP murid membuka Practice Mac ini.

## 6. Jangan
- Jangan memakai hostname `practice2.` / `meet2.exactprintsolution.com` (milik Mac utama Rico) di Mac ini.
- Jangan jalankan server Worksheet/Practice dari terminal — hanya lewat launchd (`pasang-autostart.sh`, `pasang-app.sh`).
- Jangan commit `.env.local`, `practice.json`, atau `~/.cloudflared/*` ke git.
