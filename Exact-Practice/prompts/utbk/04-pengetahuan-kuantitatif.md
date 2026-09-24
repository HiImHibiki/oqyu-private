# PROMPT — UTBK-SNBT: Pengetahuan Kuantitatif (PK)

*System prompt:* `prompts/_shared/system.md`. `locale: "id"`, `exam: "UTBK"`, `section: "utbk_pk"`.

---

Buat **{{JUMLAH}} soal** PK. Subtes ini 20 soal / 20 menit — rata-rata **60 detik per soal**, dan
**tanpa kalkulator**. Setiap soal harus bisa diselesaikan dengan manipulasi aljabar cerdas, bukan
perhitungan panjang.

## Domain, skill, dan porsi

| `domain` | `skill` | porsi |
|---|---|---|
| `Bilangan` | `Operasi & sifat bilangan`, `Perbandingan`, `Persen`, `Barisan` | 20% |
| `Aljabar & Fungsi` | `Persamaan & pertidaksamaan`, `Fungsi & grafik`, `SPLDV`, `Eksponen & logaritma` | 30% |
| `Geometri & Pengukuran` | `Bangun datar`, `Bangun ruang`, `Trigonometri dasar`, `Koordinat` | 25% |
| `Data & Ketidakpastian` | `Statistika deskriptif`, `Peluang`, `Penyajian data` | 25% |

## Tipe soal

- `mcq_single`, **5 opsi** `A`–`E`.
- `spr_numeric` untuk isian angka.
- `true_false_multi` untuk soal "manakah pernyataan berikut yang benar".
- **Bentuk khas PK — perbandingan kuantitas.** Berikan dua kuantitas P dan Q, lalu opsi tetap:
  `A. P > Q` · `B. P < Q` · `C. P = Q` · `D. Informasi tidak cukup` · `E. Hubungan tidak dapat ditentukan`.
  Gunakan bentuk ini untuk sekitar 20% soal.
- `calculatorAllowed: false`, `formulaRefs: ["utbk_math"]` bila relevan.

## Aturan mutu khusus PK

1. **Semua bilangan harus ramah**: akar sempurna, pecahan yang menyederhana, persen kelipatan 5.
2. Untuk soal peluang, gunakan angka kecil (kotak berisi ≤ 12 objek) agar bisa dihitung di kepala.
3. Untuk statistika, sediakan data ≤ 9 nilai kalau menanyakan median/modus/simpangan.
4. Untuk geometri, sertakan `figure` bertipe `geometry` bila bangunnya tidak baku; kalau bangunnya
   baku (persegi panjang, lingkaran), cukup deskripsi teks.
5. Pada bentuk perbandingan kuantitas, pastikan opsi `D` benar-benar mungkin menjadi kunci di
   sebagian soal — kalau tidak pernah benar, siswa akan belajar mengabaikannya.
6. `explanation` menunjukkan **jalan pintasnya**, bukan cara panjang. Contoh: "Alih-alih menghitung
   kedua sisi, bandingkan lewat selisihnya."

## Contoh keluaran yang benar

```json
[{
  "id": "utbk-pk-peluang-0142",
  "exam": "UTBK", "section": "utbk_pk",
  "domain": "Data & Ketidakpastian", "skill": "Peluang",
  "difficulty": "M", "irtB": 0.3, "calculatorAllowed": false, "locale": "id",
  "stem": "Sebuah kotak berisi 4 bola merah dan 6 bola putih. Dua bola diambil satu per satu **tanpa pengembalian**. Peluang terambil dua bola berwarna sama adalah ...",
  "type": "mcq_single",
  "choices": [
    {"id":"A","text":"$\\dfrac{2}{9}$"},
    {"id":"B","text":"$\\dfrac{1}{3}$"},
    {"id":"C","text":"$\\dfrac{7}{15}$"},
    {"id":"D","text":"$\\dfrac{8}{15}$"},
    {"id":"E","text":"$\\dfrac{3}{5}$"}
  ],
  "answer": {"mode":"choice","value":"C"},
  "explanation": "$P(\\text{MM}) = \\tfrac{4}{10}\\cdot\\tfrac{3}{9} = \\tfrac{12}{90}$ dan $P(\\text{PP}) = \\tfrac{6}{10}\\cdot\\tfrac{5}{9} = \\tfrac{30}{90}$. Jumlahnya $\\tfrac{42}{90} = \\tfrac{7}{15}$.",
  "distractorRationale": {
    "D": "Muncul kalau pengambilan dianggap **dengan** pengembalian.",
    "B": "Hanya menghitung peluang dua bola putih."
  },
  "formulaRefs": ["utbk_math"],
  "tags": ["peluang","tanpa-pengembalian"],
  "estimatedTimeSec": 75, "points": 1,
  "meta": {"generator":"ai","model":"claude-opus-5","reviewed":false,"version":1}
}]
```

---

**Parameter**: `{{JUMLAH}}`, `{{DOMAIN}}` *(opsional)*, `{{TINGKAT}}`.
