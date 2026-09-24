# PROMPT — UTBK-SNBT: Penalaran Umum (PU)

*System prompt:* `prompts/_shared/system.md`. Bahasa soal: **Indonesia**. `locale: "id"`, `exam: "UTBK"`, `section: "utbk_pu"`.

---

Buat **{{JUMLAH}} soal** Penalaran Umum. Subtes ini 30 soal / 30 menit — artinya rata-rata **60 detik
per soal**. Soal yang butuh lebih dari 90 detik terlalu berat untuk subtes ini.

## Domain, skill, dan porsi

| `domain` | `skill` | porsi |
|---|---|---|
| `Penalaran Induktif` | `Pola bilangan & gambar`, `Generalisasi`, `Analogi`, `Sebab-akibat` | 1/3 |
| `Penalaran Deduktif` | `Silogisme`, `Implikasi & kontraposisi`, `Penarikan kesimpulan`, `Argumen valid/tidak valid` | 1/3 |
| `Penalaran Kuantitatif` | `Baca grafik & tabel`, `Perbandingan kuantitas`, `Estimasi`, `Pola aritmetika` | 1/3 |

## Tipe soal

- `mcq_single` dengan **5 opsi** ber-id `A`–`E` (UTBK memakai 5 opsi, bukan 4).
- `true_false_multi` — 3–4 pernyataan, khas untuk soal berbasis grafik/paragraf.
- `table_grid` — matriks pernyataan × kategori (mis. "Kesimpulan pasti benar / mungkin benar / pasti salah").
- `calculatorAllowed: false` **selalu**. Karena itu semua hitungan harus bisa dikerjakan di kepala
  atau dengan coret-coretan singkat.

## Pola soal yang harus ada

**Penalaran Deduktif**
- Silogisme dua premis dengan kuantor `semua` / `sebagian` / `tidak ada`. Jebakan wajib: satu opsi
  membalik arah implikasi (konvers), satu opsi menggeneralisasi `sebagian` menjadi `semua`.
- Implikasi berantai: "Jika A maka B. Jika B maka C. Tidak C." → simpulan kontraposisi.
- Pernyataan berkuantor ganda dengan simpulan yang *mungkin* benar tapi tidak *pasti* benar.

**Penalaran Induktif**
- Barisan bilangan dengan pola dua tingkat (selisih dari selisih), atau pola berselang-seling.
- Analogi hubungan: `A : B = C : ...` di mana hubungannya fungsional, bukan asosiatif bebas.
- Penilaian argumen: manakah yang **memperlemah** / **memperkuat** kesimpulan penulis.

**Penalaran Kuantitatif**
- Paragraf berisi data + `figure` (`bar_chart`, `line_chart`, atau `table`), lalu pertanyaan
  perbandingan, selisih, atau tren. Nilai-nilai dipilih agar bisa dihitung tanpa kalkulator.
- Perbandingan dua kuantitas: manakah yang lebih besar, atau apakah informasinya cukup.

## Aturan mutu khusus PU

1. **Semua data numerik pada grafik harus bulat dan mudah**, mis. kelipatan 5 atau 10.
2. Pada `true_false_multi`, jangan membuat semua pernyataan bernilai sama (jangan `[true,true,true]`).
3. Pada soal silogisme, `explanation` **wajib** menyebut nama sesat pikirnya (konvers, invers,
   generalisasi tergesa) bukan sekadar mengulang jawabannya.
4. Konteks memakai latar Indonesia yang wajar: koperasi sekolah, transportasi umum, produksi padi,
   kunjungan perpustakaan — tanpa nama lembaga nyata yang datanya dikarang.

## Contoh keluaran yang benar

```json
[{
  "id": "utbk-pu-ded-0311",
  "exam": "UTBK", "section": "utbk_pu",
  "domain": "Penalaran Deduktif", "skill": "Silogisme",
  "difficulty": "M", "irtB": 0.2, "calculatorAllowed": false, "locale": "id",
  "stem": "Semua mahasiswa yang mengambil mata kuliah Statistika wajib mengikuti praktikum.\nSebagian mahasiswa yang mengikuti praktikum tidak memiliki laptop.\n\nSimpulan yang **pasti benar** adalah ...",
  "type": "mcq_single",
  "choices": [
    {"id":"A","text":"Semua mahasiswa Statistika tidak memiliki laptop."},
    {"id":"B","text":"Sebagian mahasiswa yang tidak memiliki laptop mengikuti praktikum."},
    {"id":"C","text":"Semua peserta praktikum mengambil mata kuliah Statistika."},
    {"id":"D","text":"Sebagian mahasiswa Statistika tidak memiliki laptop."},
    {"id":"E","text":"Mahasiswa yang memiliki laptop tidak mengikuti praktikum."}
  ],
  "answer": {"mode":"choice","value":"B"},
  "explanation": "Premis kedua menyatakan irisan antara *peserta praktikum* dan *tidak punya laptop* tidak kosong. Pernyataan berkuantor `sebagian` boleh dibalik, sehingga **B** pasti benar. **D** tidak pasti karena peserta praktikum belum tentu mahasiswa Statistika — implikasinya hanya satu arah. **C** adalah konvers dari premis pertama, yang tidak sah. **A** dan **E** generalisasi tergesa.",
  "distractorRationale": {
    "D": "Jebakan utama: membalik arah implikasi 'Statistika → praktikum' menjadi 'praktikum → Statistika'.",
    "C": "Konvers dari premis universal.",
    "A": "Menaikkan kuantor 'sebagian' menjadi 'semua'."
  },
  "tags": ["silogisme","kuantor"],
  "estimatedTimeSec": 70, "points": 1,
  "meta": {"generator":"ai","model":"claude-opus-5","reviewed":false,"version":1}
}]
```

---

**Parameter**: `{{JUMLAH}}`, `{{DOMAIN}}` *(opsional)*, `{{TINGKAT}}` — komposisi kesulitan, default `E 25% / M 50% / H 25%`.
