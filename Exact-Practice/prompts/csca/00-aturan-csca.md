# CSCA — aturan wajib (baca sebelum semua prompt CSCA)

**CSCA = China Scholastic Competency Assessment**, diselenggarakan **China Scholarship Council (CSC)**.
Wajib untuk pendaftaran beasiswa CSC mulai intake 2026, dan diperkirakan wajib bagi seluruh pelamar
S1 di Tiongkok pada 2028.

## Struktur resmi

| Mata uji | Waktu | Soal | Bahasa | Diwajibkan untuk |
|---|---|---|---|---|
| Mathematics 数学 | 60 menit | 48 | English **atau** 中文 | **semua pelamar** |
| Physics 物理 | 60 menit | 48 | English **atau** 中文 | Teknik, Ilmu Komputer, Sains Fisik |
| Chemistry 化学 | 60 menit | 48 | English **atau** 中文 | Kedokteran (MBBS), Teknik Kimia, Ilmu Hayati |
| Humanities Chinese 文科中文 | 90 menit | 80 | **中文 saja** | Program berbahasa Mandarin: humaniora, seni, hukum, ilmu sosial |
| STEM Chinese 理科中文 | 90 menit | 80 | **中文 saja** | Program berbahasa Mandarin: STEM, teknik, kedokteran |

## Lima aturan yang tidak boleh dilanggar

1. **SEMUA soal pilihan ganda.** Tidak ada isian, tidak ada uraian, tidak ada menjodohkan.
   `type` selalu `"mcq_single"`.
2. **Empat opsi**, ber-id `"A"`, `"B"`, `"C"`, `"D"` — mengikuti konvensi ujian Tiongkok.
3. **Tanpa kalkulator.** `calculatorAllowed: false` untuk setiap soal, termasuk Fisika dan Kimia.
   Rancang angkanya dulu supaya bisa dihitung di kepala, baru bungkus dengan konteks.
4. **Setiap mata uji bernilai 100 poin**, seluruh soal berbobot sama, dan **tidak ada penalti
   jawaban salah**. Karena itu setiap opsi harus benar-benar menggoda — menebak selalu dilakukan
   peserta.
5. **Waktu sangat ketat.** Matematika/Fisika/Kimia rata-rata **75 detik per soal**; Chinese
   rata-rata **68 detik per soal**. Soal yang butuh lebih dari 120 detik tidak realistis.

## Bilingual: hanya untuk Math, Physics, Chemistry

Ketiganya harus punya versi **English** dan **中文** yang setara.

```jsonc
{
  "locale": "en",
  "stem": "For the ellipse ... what is the eccentricity $e$?",
  "choices": [{"id":"A","text":"$\\dfrac{3}{5}$"}, ...],
  "explanation": "With $a^2=25$ ...",
  "i18n": {
    "zh": {
      "stem": "已知椭圆 ... 则其离心率 $e$ 等于多少？",
      "choices": [{"id":"A","text":"$\\dfrac{3}{5}$"}, ...],
      "explanation": "由 $a^{2}=25$ ..."
    }
  }
}
```

**Humanities Chinese dan STEM Chinese TIDAK diterjemahkan** — materi ujinya adalah bahasa Mandarin
itu sendiri. Isi `locale: "zh"` dan taruh hanya terjemahan *instruksi* + pembahasan di `i18n.en`.

## Aturan penerjemahan (Math / Physics / Chemistry)

1. Versi setara, bukan terjemahan harfiah. Tingkat kesulitannya harus sama persis.
2. **`id` opsi identik dan urutannya tidak berubah.** Satu kunci berlaku untuk kedua bahasa.
3. Notasi matematika, simbol kimia, dan satuan **tidak diterjemahkan** — LaTeX-nya sama persis.
4. Gunakan **karakter sederhana (简体字)** dan tanda baca lebar Tiongkok (`，。？：；`).
5. Istilah teknis memakai padanan baku Tiongkok: 函数, 导数, 离心率, 化学平衡, 动量, 等差数列,
   电磁感应, 氧化还原反应.
6. `alt` pada `figure` wajib ada dalam bahasa Inggris.

## Perbedaan penting dari ujian lain

- **Bukan HSK.** Professional Chinese menguji bahasa **akademik**, bukan percakapan sehari-hari.
- **Bukan SAT.** Tidak ada bacaan panjang di Matematika, tidak ada modul adaptif.
- **Mirip gaokao dalam gaya**: menuntut penguasaan konsep dasar yang dalam, kecepatan mengingat, dan
  ketelitian di bawah tekanan waktu — bukan penalaran bertele-tele.

> **Sumber & verifikasi.** Struktur di atas dicocokkan dengan instruksi resmi universitas
> penyelenggara dan silabus resmi CSCA edisi 2025 pada 28 Agustus 2026. CSCA baru berjalan sejak
> Desember 2025 dan spesifikasinya masih bisa berubah — cek `csca.cn` sebelum tiap musim, lalu
> perbarui `src/lib/exams/blueprints.ts` dan `src/lib/exams/reference.ts`.
