# Memasang Exact Practice di Mac lain

Prasyarat: Node ≥ 20 (`brew install node`), Exact Worksheet sudah terpasang dan jalan
di port 7790 (lihat PASANG.md di repo Exact-Worksheet), Exact Canvas jalan di port 4747
(hanya perlu kalau fitur Tanya guru dipakai).

```bash
cd ~/Documents/"PROJECT EXACT GROUP"
git clone git@github.com:Exact-Digital/Exact-Practice.git "Exact Practice"
cd "Exact Practice"
npm install
cp .env.contoh .env.local          # isi ADMIN_USERNAMES, EXACT_CANVAS_PIN, EXACT_PRACTICE_KUNCI
# EXACT_PRACTICE_KUNCI: sembarang string acak; tulis nilai yang sama ke
# ~/Library/Application Support/Exact Worksheet/setelan.json → "practice_kunci"
# (dan "practice_url": "http://127.0.0.1:8770") supaya tombol Ke Practice di Worksheet bekerja.
./pasang-app.sh                    # build + salin + LaunchAgent com.exactcourse.practice (port 8770)
```

Cek: `curl -I http://127.0.0.1:8770/masuk` → 200. Log di `~/Library/Logs/exact-practice.log`.

## Setelah mengubah kode

```bash
git pull && ./pasang-app.sh
```

## Data

`~/Library/Application Support/Exact Practice/data/` — `db.json` (akun, attempt),
`question-bank.json` (bank soal), `paket.json` (paket latihan). Cadangkan folder ini.

## Tunnel (hanya di Mac utama)

Tunnel Cloudflare `exact-practice` (`~/.cloudflared/exact-practice.yml`, LaunchAgent
`com.exactcourse.practice.tunnel`) mengarahkan `practice2.exactprintsolution.com` →
`localhost:8770`. Jangan jalankan tunnel yang sama di dua Mac sekaligus.

## Akun guru pertama

Daftar di `/daftar` dengan username yang ada di `ADMIN_USERNAMES`, lalu buka
`/admin/latihan`. Atau: `node scripts/make-admin.mjs username-guru` (mode berkas: perlu
`EXACT_DATA_DIR` diarahkan ke folder data di atas).
