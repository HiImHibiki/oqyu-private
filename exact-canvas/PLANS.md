# PLANS.md — Keputusan Desain & Rencana Development

> Ringkasan alur, alasan desain, dan backlog. Keputusan baru WAJIB dicatat di sini;
> eksekusinya di `TASKS.md`. Rencana fitur besar yang rinci: `docs/RENCANA-KELAS-LANGSUNG.md`,
> `docs/RENCANA-KELAS-TUGAS.md`.
>
> D1–D7 **direkonstruksi dari README, docs/, komentar kode, dan riwayat commit**
> (24 Sep 2026). Betulkan bila keliru dan tandai "(dikonfirmasi user, tanggal)".

## Gambaran alur besar

```
Mac guru (Exact Canvas.app) ── server axum :4747 + WebSocket ──┬─ TV   /tv        (Wi-Fi)
   editor Wacom, vault, SQLite                                 ├─ Tablet /admin    (Wi-Fi)
                                                               ├─ HP murid /tv?murid=1
                                    Cloudflare Tunnel ─────────┘    (Wi-Fi atau internet)
                                                                     │ tombol 📝 Practice
Exact Practice (Mac yang sama) ── login akun Canvas, Tanya guru, papan guru ◄──┘
```

## Keputusan desain (dengan alasan)

### D1. Aplikasi desktop local-first, bukan web app
Kanvas Wacom butuh latensi & tekanan pena native; data sketsa milik guru di foldernya sendiri
(bisa di iCloud). Server berbagi menumpang di aplikasi — tidak ada server terpisah.

### D2. Sketsa = berkas JSON, SQLite hanya indeks & data kelas
Berkas mudah dicadangkan/dipindah; SQLite (WAL) untuk hal yang butuh kueri dan penulisan
bersamaan (antrean tanya dari 40 HP).

### D3. Murid pakai akun (No. HP + sandi), bukan PIN di alamat
Identitas = akun, bukan perangkat; ganti HP tetap orang yang sama; PIN tidak bocor lewat
tangkapan layar tautan. Persetujuan guru mencegah orang asing masuk kelas.

### D4. Tiga ruangan, guru berkeliling dengan tablet
Pengikut mengikuti editor terakhir yang aktif DI RUANGANNYA (docs/RENCANA-KELAS-LANGSUNG.md).

### D5. Anti-spam antrean tanya
Jeda & kuota per murid, satu antrean per murid, bisukan, batas per alamat, hitung mundur di HP.

### D6. Akses internet lewat Cloudflare Tunnel, PIN lebih panjang
Murid bisa ikut dari rumah; PIN 6–8 digit + pembatas percobaan per asal/perangkat.

### D7. Akun Canvas = identitas murid di Exact Practice
Practice tidak punya pendaftaran murid sendiri untuk murid bimbel: login pakai akun Canvas
atau token sesi dari tombol 📝 Practice. Sesi papan guru untuk Practice dicetak lewat
`/api/akun/sesi` yang hanya melayani loopback (Practice & Canvas di Mac yang sama).

## Backlog (rencana berikutnya)
- **B1. Kelas & Tugas** — `docs/RENCANA-KELAS-TUGAS.md` (kelas, pertemuan, tugas, pengumpulan).
  Status: rencana, belum dikerjakan (perlu dicek ulang dengan user apakah masih relevan).
- **B2. Endpoint sesi untuk Practice di cloud** — bila Practice pindah ke Cloudflare Workers
  (lihat `../Exact-Practice/PLANS.md` K3): `/api/akun/sesi` perlu jalur kedua yang dijaga
  kunci bersama panjang (seperti `EXACT_PRACTICE_KUNCI`), bukan loopback + PIN. Endpoint lain
  yang dipakai Practice sudah bisa lewat tunnel.
- **B3. CI build frontend** (`npm run build`) + `cargo check` di GitHub Actions (runner macOS).
- **B4. Tanda tangan / notarisasi aplikasi** — sekarang perlu `xattr` manual di Mac baru.
