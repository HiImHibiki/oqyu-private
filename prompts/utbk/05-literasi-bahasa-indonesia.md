# PROMPT — UTBK-SNBT: Literasi dalam Bahasa Indonesia

*System prompt:* `prompts/_shared/system.md`. `locale: "id"`, `exam: "UTBK"`, `section: "utbk_lbi"`.

---

Buat **{{JUMLAH}} soal** Literasi Bahasa Indonesia. Subtes ini 30 soal / 45 menit — rata-rata
**90 detik per soal**. Berbeda dari PBM, subtes ini **tidak menguji kaidah kebahasaan**; ia menguji
kemampuan bernalar dengan teks.

## Bentuk khas

Satu teks untuk 3–5 soal. Panjang 350–600 kata. Dua jenis teks dengan porsi seimbang:

- **Teks informasi** — artikel populer sains, laporan, opini berargumen, infografik + narasi.
  Sertakan `figure` (tabel atau grafik) pada sebagian teks informasi, karena literasi UTBK
  sering menggabungkan teks dan data.
- **Teks sastra** — cerpen, penggalan novel, atau puisi **asli** (tulis sendiri, jangan mengutip
  karya nyata). Fokus pada watak tokoh, konflik, latar, sudut pandang, amanat, majas.

## Domain, skill, dan porsi

| `domain` | `skill` | porsi |
|---|---|---|
| `Teks Informasi` | `Menemukan informasi`, `Menginterpretasi & mengintegrasi`, `Mengevaluasi & merefleksi` | 50% |
| `Teks Sastra` | `Menemukan informasi`, `Menginterpretasi & mengintegrasi`, `Mengevaluasi & merefleksi` | 50% |

Ketiga skill itu adalah tingkatan kognitif literasi (mengacu kerangka PISA):

1. `Menemukan informasi` — mencari dan memilih informasi yang tersurat. **Maks. 25% soal.**
2. `Menginterpretasi & mengintegrasi` — menyimpulkan, menghubungkan antarbagian, memahami makna
   implisit. **Sekitar 45% soal.**
3. `Mengevaluasi & merefleksi` — menilai kualitas argumen, mendeteksi bias, menghubungkan dengan
   pengetahuan luar, menilai relevansi bukti. **Sekitar 30% soal.**

## Tipe soal

- `mcq_single`, **5 opsi** `A`–`E`.
- `true_false_multi` — 3–4 pernyataan berdasarkan teks.
- `table_grid` — mis. baris = pernyataan, kolom = `Didukung teks` / `Bertentangan dengan teks` /
  `Tidak dibahas`.
- `calculatorAllowed: false`.

## Pola pertanyaan level 3 (yang paling menentukan skor)

- `Manakah penilaian yang paling tepat terhadap argumen penulis?`
- `Informasi manakah yang paling melemahkan simpulan pada paragraf terakhir?`
- `Asumsi yang mendasari pernyataan penulis pada paragraf 2 adalah ...`
- `Apabila data pada tabel benar, pernyataan penulis pada kalimat ... menjadi ...`
- `Sikap penulis terhadap kebijakan yang dibahas dapat digambarkan sebagai ...`

## Aturan mutu khusus

1. Teks harus memuat **struktur argumen yang bisa dinilai**: klaim, bukti, dan satu keterbatasan.
   Tanpa itu, soal level 3 tidak punya pijakan.
2. Untuk teks sastra, watak tokoh harus tergambar dari **tindakan dan dialog**, bukan dari
   penjelasan langsung penulis — supaya soal penafsiran punya bukti.
3. Distraktor tipikal yang wajib dipakai: pernyataan yang **benar menurut pengetahuan umum tetapi
   tidak ada di teks**, dan pernyataan yang **ada di teks tetapi tidak menjawab pertanyaan**.
4. Untuk `table_grid`, sediakan minimal satu baris yang jawabannya `Tidak dibahas`.

---

**Parameter**: `{{JUMLAH}}`, `{{JENIS_TEKS}}` (`informasi` / `sastra`), `{{TEMA}}`, `{{TINGKAT}}`.
