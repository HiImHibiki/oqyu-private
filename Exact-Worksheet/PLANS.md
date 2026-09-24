# PLANS.md — Keputusan Desain & Rencana Development

> Ringkasan alur, alasan di balik desain, jalan buntu yang sudah dicoba, dan backlog.
> Keputusan baru WAJIB dicatat di sini; eksekusinya di `TASKS.md`.
>
> D1–D9 **direkonstruksi dari README, PASANG.md, komentar kode, dan riwayat commit**
> (24 Sep 2026). Betulkan bila ada yang keliru dan tandai "(dikonfirmasi user, tanggal)".

## Gambaran alur besar

```
HP (Android / browser via Tailscale) ─┐
Papan klip / foto / PDF / topik ──────┼─► cari.py :7790 ─► antrean satu tugas (buat.py)
                                      │        │
                                      │        ├─ OCR Vision (foto)          ocr-mac/
                                      │        ├─ Gemini via Chrome kendali  otomasi.py + cdp.py
                                      │        │   atau Claude CLI            claudecli.py
                                      │        ├─ naskah → butir              naskah.py
                                      │        └─ render wsm di Chrome → PDF  wsm/ → ~/Desktop
                                      │
                          Hasil: pratinjau, cetak printer Mac, Bagikan (WA),
                                 Ke Practice ─► Exact Practice /api/latihan/terbit
```

## Keputusan desain (dengan alasan)

### D1. Gemini lewat Chrome, bukan API
Tanpa kunci API dan tanpa biaya per token — memakai langganan Gemini Rico. Harga: otomasi
browser rapuh (lihat Jalan buntu). Claude CLI ditambahkan sebagai mesin kedua karena tidak
punya lapisan browser sama sekali (stdin → stdout).

### D2. Python stdlib saja
Python bawaan macOS cukup; pemasangan di Mac baru tidak butuh pip/venv.

### D3. Mesin render ikut di dalam repo (`wsm/`)
Dulu memanggil aplikasi Worksheet Maker terpisah; sekarang disajikan server ini di `/wsm/`.
Tidak ada jalur luar yang dipaku, tidak ada server kedua.

### D4. Kode ↔ aplikasi ↔ data dipisah
`/Applications` tidak dilindungi TCC sehingga launchd selalu bisa membaca kode; data di
Application Support selamat melewati pemasangan ulang. (13 Sep 2026)

### D5. Penjaga kesehatan di samping KeepAlive
KeepAlive hanya melihat proses ADA; proses tersangkut pernah menahan port 7790 tanpa
menjawab. `penjaga.py` menguji lewat HTTP dan restart setelah dua kegagalan berturut.

### D6. Satu tugas sekali jalan (antrean)
Chrome kendali satu; dua tugas bersamaan saling menimpa tab. Antrean terlihat di halaman;
tugas macet berhenti sendiri dan ditandai gagal.

### D7. Tidak mengingat mapel/kelas/jenjang; kunci & pembahasan selalu menyala
Mengingatnya pernah membuat lembar berikutnya salah kop / tanpa kunci diam-diam.

### D8. Naskah Manual — tanpa AI di dalam aplikasi
Perintah dibangun pembangun yang sama dengan jalur Gemini, dijalankan di AI mana pun, lalu
ditempel. Satu pengurai untuk semua jalur → hitungan "Periksa naskah" jujur.

### D9. Terbit ke Practice = dorong butir yang sudah diurai
Practice tidak mengurai ulang naskah; Worksheet mengirim butir + nama PDF + meta set.
Lembar lama bisa diterbitkan dari tab Hasil karena naskahnya tersimpan di `naskah/`.

## Jalan buntu yang sudah dicoba — JANGAN diulang
(ringkasan; detail di README "Jalan buntu")
- AppleScript ke Chrome — tidak bisa menyalakan "Allow JavaScript from Apple Events".
- Normalisasi ukuran gambar untuk model penglihatan — tidak lebih cepat, keluaran berubah.
- Model bahasa lokal sebagai pengurai cadangan — mengarang "soal" dari blok rumus.
- Klik ke tab hidden — peristiwa `Input.*` tidak sampai, tanpa galat.
- Memotong ketikan panjang — justru penyebab Gemini menolak (14 Sep 2026).
- Kirim dengan Enter — tidak andal; kirim lewat klik tombol.
- Alur pemanasan dua giliran — diuji lebih lambat & lebih sering gagal; dimatikan bawaan.

## Backlog (rencana berikutnya)
- **B1. SyntaxWarning `buat.py:931`** — `'\.'` di dalam string Python berisi JS; jadikan raw
  string / gandakan backslash (Python 3.12+ akan menjadikannya galat).
- **B2. Satu perintah uji** (mis. `./uji.sh`: py_compile + node --check + wsm/test.js) agar
  QA seragam; kandidat CI.
- **B3. Auth untuk endpoint jembatan** — hanya diperlukan bila Practice pindah ke cloud dan
  memilih K2(a) (lihat `../Exact-Practice/PLANS.md`).
- **B4. URL Practice publik di `practice.json`** — bila Practice pindah ke cloud, terbit
  diarahkan ke domain publik (HTTPS) alih-alih `127.0.0.1:8770`.
- **B5. Unggah PDF ke penyimpanan cloud saat terbit** — bila K2(b) dipilih.
