# CLAUDE.md — Exact Worksheet (pengembangan)

> Kalau kamu dipanggil sebagai **mesin pembuat naskah** (cwd = `claude-proyek/`,
> lewat `claudecli.py`), ABAIKAN file ini dan ikuti `claude-proyek/CLAUDE.md` saja.
> File ini untuk sesi yang MENGEMBANGKAN aplikasinya.

Sebelum mengerjakan apa pun, BACA tiga file ini (semuanya di root repo):

1. **AGENTS.md** — peta arsitektur (server Python, Chrome kendali, mesin render `wsm/`,
   OCR, menu bar, Android), pemisahan kode/aplikasi/data, jembatan ke Exact Practice,
   playbook per peran, perintah penting, dan INVARIAN.
2. **PLANS.md** — keputusan desain + alasannya, jalan buntu yang sudah dicoba, dan backlog.
3. **TASKS.md** — riwayat tugas bernomor (W-xxx). Setiap tugas selesai WAJIB dicatat;
   nomornya dipakai sebagai prefix commit git (`W-xxx: deskripsi`).

Bahasa komunikasi, UI, nama berkas/fungsi, dan komentar kode: **Bahasa Indonesia**.

Dokumen lain: `README.md` (untuk manusia — alur kerja & format naskah), `PASANG.md`
(runbook pasang di Mac, untuk dieksekusi Claude langkah demi langkah),
`PASANG-MAC-BARU.md` (Worksheet + Canvas + Practice sekaligus).

Repo saudara: `../Exact-Practice` (nomor tugas `P-xxx`), `../exact-canvas` (`C-xxx`).
