# Memasang Exact Worksheet + Exact Canvas (+ sambungan ke Exact Practice) di Mac baru

Panduan ini untuk **Claude Code yang menjalankan pemasangan** di Mac baru milik
Rico (guru Exact Course). Kerjakan berurutan; berhenti di verifikasi yang gagal.
Tanggal disusun: 14 Sep 2026.

## Gambaran: apa jalan di mana

| Aplikasi | Mac utama (Rico, Tailscale `100.83.25.73`) | Mac baru |
|---|---|---|
| **Exact Worksheet** (buat soal via Gemini, port 7790) | jalan | **pasang** — tiap Mac punya Chrome kendali + login Gemini sendiri |
| **Exact Canvas** (kanvas kelas, port 4747) | jalan + tunnel `meet2.exactprintsolution.com` | **pasang** untuk kelas lokal (TV/tablet se-Wi-Fi). **Tanpa tunnel** |
| **Exact Practice** (latihan online, port 8770) | jalan + tunnel `practice2.exactprintsolution.com`, semua data murid/paket ada di sini | **jangan dipasang** — Worksheet di Mac baru cukup *diarahkan* ke Practice di Mac utama lewat Tailscale |

Alasannya: Practice menyimpan akun murid, paket, dan pesanan di satu tempat;
kalau dipasang di dua Mac datanya terbelah. Tunnel Cloudflare juga tidak boleh
dijalankan ganda untuk hostname yang sama.

## 0. Yang harus disiapkan Rico (tidak bisa dikerjakan Claude)
1. Mac baru sudah masuk **Tailscale** dengan akun yang sama (cek: `tailscale status` menampilkan `100.83.25.73`).
2. **Akses repo privat** di GitHub: `Exact-Digital/Exact-Worksheet`, `Exact-Digital/Exact-Practice` (hanya untuk membaca panduan), `ricokurniawan18-ui/exact-canvas` → `gh auth login` di Mac baru.
3. **Akun Google Gemini** — login sekali di Chrome kendali (langkah 2.4).
4. Membuka System Settings untuk **Full Disk Access** ke `/usr/bin/python3` dan **Screen Recording** bila diminta.
5. Nilai **kunci Practice** dari Mac utama: di Mac utama jalankan
   `cat ~/Library/Application\ Support/Exact\ Worksheet/practice.json` — salin nilai `"kunci"` (jangan ditaruh di git/chat publik).

## 1. Kebutuhan sistem (Mac baru)
```bash
xcode-select --install                      # Command Line Tools (python3, git, swiftc)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node gh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y   # untuk Exact Canvas (Tauri)
source "$HOME/.cargo/env"
```
- **Google Chrome** harus ada di `/Applications/Google Chrome.app` (Worksheet mengendalikannya).
- Tailscale dari App Store, masuk akun yang sama.
- `gh auth login` → pilih GitHub.com, HTTPS, login lewat browser.

Verifikasi: `node -v`, `python3 --version`, `rustc --version`, `gh auth status`, `ls /Applications | grep Chrome`.

## 2. Exact Worksheet
```bash
mkdir -p ~/Documents/"PROJECT EXACT GROUP" && cd ~/Documents/"PROJECT EXACT GROUP"
gh repo clone Exact-Digital/Exact-Worksheet "Exact Worksheet" && cd "Exact Worksheet"
```
2.1 **Ikuti `PASANG.md` di repo itu apa adanya** (pasang.sh → bangun-app.sh → pasang-autostart.sh --lan, Full Disk Access untuk `/usr/bin/python3`, uji rantai). Jangan lewati verifikasi "lembar terbaca".

2.2 Sambungkan tombol **Ke Practice** ke Practice di Mac utama (bukan lokal):
```bash
cat > ~/Library/Application\ Support/Exact\ Worksheet/practice.json <<'J'
{"url": "http://100.83.25.73:8770", "kunci": "ISI_DENGAN_KUNCI_DARI_MAC_UTAMA"}
J
```
Uji: `curl -s -X POST -d 'f=NAMA-PDF-YANG-ADA.pdf' http://127.0.0.1:7790/terbitkan` → `"ok": true`.
(Practice di Mac utama merender ulang PDF-nya sendiri kalau berkasnya tidak ada di sana — normal.)

2.3 Menu bar **EW** dipasang otomatis oleh `pasang-autostart.sh`. Tombol **Restart Chrome** dan **Restart aplikasi** ada di halaman dan di menu EW.

2.4 Login Gemini di Chrome kendali (sekali): `EXACT_TAMPIL=1 python3 -c "import cdp; cdp.nyalakan_ulang(True)"` dari folder repo, login di jendela yang muncul, tutup. Verifikasi: kirim satu topik lewat halaman `http://localhost:7790/buat` → PDF muncul di Desktop.

2.5 HP/tablet: di aplikasi Android Exact Worksheet pilih Mac ini. Preset yang ada: **Rico** `100.83.25.73`, **Velisia** `100.70.73.4`; untuk Mac lain pilih "Mac lain" dan isi IP Tailscale-nya (`tailscale ip -4`).

## 3. Exact Canvas
```bash
cd ~/Documents/"PROJECT EXACT GROUP"
gh repo clone ricokurniawan18-ui/exact-canvas "exact canvas" && cd "exact canvas"
npm install
npm run app:build                 # ±2 menit; hasil: src-tauri/target/release/bundle/macos/Exact Canvas.app
ditto "src-tauri/target/release/bundle/macos/Exact Canvas.app" "/Applications/Exact Canvas.app"
open -a "Exact Canvas"
```
- Di aplikasi: Settings (⌘,) → **Share on this network** → catat PIN 4 digit dan sandi admin.
- Vault data: `~/ExactCanvas`. **Jangan** jalankan `scripts/cloudflare-setup.sh` di Mac baru (meet2 hanya di Mac utama).
- Tombol **📝 Practice** di halaman murid mengarah ke `practice2.exactprintsolution.com` (Mac utama) — akun murid Canvas di Mac baru **bukan** akun yang dikenal Practice (Practice menanyakan Canvas Mac utama). Kalau murid di Mac baru perlu Practice, daftarkan mereka lewat kode kelas Practice (`/daftar`) atau di Canvas Mac utama.
- Verifikasi: `curl -s -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:4747/tv?murid=1"` → 200.
- Catatan pemasangan: salin ke /Applications memakai `ditto` dari terminal biasa (bukan sandbox), lalu quit & buka ulang.

## 4. Jangan dilakukan di Mac baru
- Jangan pasang/jalankan Exact Practice (`pasang-app.sh` di repo Practice) — data akan terbelah.
- Jangan jalankan `cloudflared` untuk `practice2` / `meet2`.
- Jangan jalankan server Worksheet dari terminal (`python3 cari.py`) — hanya lewat launchd (lihat PASANG.md, soal izin Desktop).

## 5. Daftar periksa akhir
```bash
curl -s -o /dev/null -w 'worksheet %{http_code}\n' http://127.0.0.1:7790/status
curl -s -o /dev/null -w 'canvas    %{http_code}\n' "http://127.0.0.1:4747/tv?murid=1"
curl -s -o /dev/null -w 'practice (utama, via tailscale) %{http_code}\n' http://100.83.25.73:8770/masuk
launchctl list | grep exactcourse           # com.exactcourse.worksheet + .penjaga
pgrep -x ExactWorksheetBar >/dev/null && echo "menu bar EW jalan"
```
Terakhir: buat satu soal dari HP → PDF di Desktop → tekan **Ke Practice** → paket muncul di `practice2.exactprintsolution.com/admin/latihan`.
