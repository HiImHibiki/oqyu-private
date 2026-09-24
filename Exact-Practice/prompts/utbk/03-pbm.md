# PROMPT — UTBK-SNBT: Kemampuan Memahami Bacaan dan Menulis (PBM)

*System prompt:* `prompts/_shared/system.md`. `locale: "id"`, `exam: "UTBK"`, `section: "utbk_pbm"`.

---

Buat **{{JUMLAH}} soal** PBM. Subtes ini 20 soal / 25 menit — rata-rata **75 detik per soal**.

## Bentuk khas PBM

PBM memakai **satu bacaan bernomor untuk beberapa soal**. Bacaan ditulis dengan kalimat bernomor
`(1)`, `(2)`, `(3)` … supaya soal bisa merujuk kalimat tertentu. Semua soal yang memakai bacaan yang
sama harus memuat `stimulus` yang **identik** (aplikasi akan menampilkannya di panel kiri).

Panjang bacaan: 4–6 paragraf, 250–400 kata, 15–25 kalimat bernomor.

## Domain, skill, dan porsi

| `domain` | `skill` | porsi |
|---|---|---|
| `Memahami Bacaan` | `Gagasan utama paragraf`, `Hubungan antarparagraf`, `Simpulan bacaan`, `Tujuan penulis` | 50% |
| `Kemampuan Menulis` | `Penyuntingan kata`, `Penyuntingan kalimat`, `Konjungsi & transisi`, `Struktur paragraf` | 50% |

## Tipe soal

- `mcq_single`, **5 opsi** `A`–`E`.
- `dropdown_inline` untuk soal penyuntingan yang memuat 2–3 rumpang dalam satu kalimat
  (token `{{b1}}`, `{{b2}}` di `stem`, opsi di `blanks`).
- `calculatorAllowed: false`.

## Pola pertanyaan yang harus ada

**Memahami Bacaan**
- `Gagasan utama paragraf ke-3 adalah ...`
- `Hubungan isi paragraf 2 dan paragraf 3 adalah ...` (opsi: sebab-akibat, pertentangan,
  perincian, pembanding, penegasan)
- `Tujuan penulis menulis teks tersebut adalah ...`
- `Simpulan yang tepat berdasarkan teks tersebut adalah ...`
- `Kelemahan isi teks tersebut adalah ...` (khas UTBK — biasanya generalisasi tanpa data pendukung)

**Kemampuan Menulis**
- `Kata bentukan yang tidak tepat terdapat pada kalimat nomor ...`
- `Kalimat yang tidak efektif adalah kalimat nomor ...`
- `Konjungsi yang tepat untuk mengisi bagian rumpang pada kalimat (7) adalah ...`
- `Kalimat (12) sebaiknya diperbaiki menjadi ...`
- `Kalimat manakah yang seharusnya dihilangkan agar paragraf menjadi padu?`

## Aturan mutu khusus PBM

1. Cacat kebahasaan yang diuji harus **benar-benar ada** di bacaan dan hanya satu per soal. Kalau
   ingin menguji tiga kalimat cacat, buat tiga soal berbeda.
2. Untuk soal konjungsi, opsi harus mewakili hubungan berbeda: pertentangan (`namun`, `padahal`),
   sebab (`karena`, `sebab`), akibat (`sehingga`, `akibatnya`), penambahan (`selain itu`), penegasan
   (`bahkan`). Jangan ada dua opsi dengan hubungan yang sama.
3. Bacaan harus mengandung *satu* kelemahan argumentatif yang bisa ditunjuk, agar soal "kelemahan
   teks" punya kunci yang tidak bisa dibantah.
4. `explanation` menyebut nomor kalimat yang jadi bukti.

## Contoh potongan bacaan bernomor

```
(1) Program konservasi mangrove di pesisir utara Jawa telah berjalan selama lima tahun.
(2) Selama periode itu, luas tutupan mangrove bertambah sekitar 1.200 hektare.
(3) Meskipun demikian, laju abrasi di beberapa titik masih tinggi karena penanaman belum
menjangkau area yang paling terdampak. (4) ...
```

---

**Parameter**: `{{JUMLAH}}`, `{{TEMA_BACAAN}}` — tema bacaan (lingkungan, sains, sosial, budaya, ekonomi), `{{TINGKAT}}`.
