# PROMPT — Digital SAT: Math

*System prompt:* `prompts/_shared/system.md`. Bahasa soal: **English**. `locale: "en"`.

---

Buat **{{JUMLAH}} soal** untuk section `{{SECTION}}` (`sat_math_m1` atau `sat_math_m2`).

## Bentuk baku Digital SAT Math

- ~75% `mcq_single` (**4 opsi**, id `A`–`D`) dan ~25% `spr_numeric` (student-produced response).
- `calculatorAllowed: true` untuk semua soal Math (Bluebook menyediakan Desmos sepanjang section).
- `formulaRefs: ["sat_math"]` bila soal memakai rumus yang ada di reference sheet.
- `estimatedTimeSec` 60–150 (rata-rata ujian 95 detik/soal).
- Urutan: kesulitan menaik di dalam modul.

## Aturan `spr_numeric` (grid-in) — penting

Jawaban SAT grid-in **tidak boleh** berupa bilangan campuran, dan hanya menerima nilai yang muat di
5 karakter. Karena itu:

- Kunci harus bilangan bulat, desimal terbatas, atau pecahan biasa. Contoh valid: `7`, `-3`, `0.75`, `3/4`.
- Kalau kunci pecahan, isi `acceptedForms` dengan seluruh bentuk yang sah: `["3/4","0.75",".75"]`.
- Kalau kunci desimal berulang, izinkan pemotongan/pembulatan lewat `tolerance`. Contoh untuk 2/3:
  `{"mode":"numeric","value":0.6667,"tolerance":0.0005,"acceptedForms":["2/3",".6666",".6667","0.667"]}`.
- **Jangan** membuat soal grid-in yang jawabannya negatif dan pecahan sekaligus.
- Soal dengan jawaban tak hingga banyak ("berapa pun nilai yang memenuhi") harus memakai
  `numeric_range`.

## Domain dan skill (pakai persis)

| `domain` | `skill` | porsi |
|---|---|---|
| `Algebra` | `Linear equations in one variable`, `Linear equations in two variables`, `Linear functions`, `Systems of two linear equations`, `Linear inequalities` | 35% |
| `Advanced Math` | `Equivalent expressions`, `Nonlinear equations in one variable`, `Nonlinear functions` | 35% |
| `Problem-Solving and Data Analysis` | `Ratios, rates, proportional relationships, units`, `Percentages`, `One-variable data`, `Two-variable data`, `Probability`, `Inference from sample statistics`, `Evaluating statistical claims` | 15% |
| `Geometry and Trigonometry` | `Area and volume`, `Lines, angles, and triangles`, `Right triangles and trigonometry`, `Circles` | 15% |

## Kapan memakai `figure`

- `Two-variable data` → `scatter` dengan `trendline`, atau `line_chart`.
- `One-variable data` → `histogram`, `box_plot`, atau `table` frekuensi.
- `Nonlinear functions` → `function_plot` dengan `points` menandai titik puncak/potong.
- `Lines, angles, and triangles`, `Circles`, `Area and volume` → `geometry`.
- `Probability` → `table` dua arah (frequency table) — ini pola paling sering di SAT.
- Soal aljabar murni umumnya **tanpa** gambar.

## Pola soal khas yang wajib muncul

1. **Sistem persamaan tanpa solusi / tak hingga solusi** — menanyakan nilai konstanta.
2. **Bentuk vertex / faktor** kuadrat — menanyakan koordinat titik puncak atau jumlah akar.
3. **Pertumbuhan eksponensial** dalam konteks (populasi, penyusutan nilai) dengan bentuk $a(b)^{t/k}$.
4. **Tabel dua arah** dengan pertanyaan peluang bersyarat.
5. **Konversi satuan berlapis** (mis. mL/menit → L/jam).
6. **Lingkaran** dalam bentuk umum $x^2+y^2+Dx+Ey+F=0$ → pusat/jari-jari.
7. **Trigonometri sudut komplementer**: $\sin(x°)=\cos(90°-x°)$.
8. **Persentase perubahan berturut-turut** (naik 20% lalu turun 20%).

## Kalibrasi kesulitan modul

Sama seperti R&W: `{{VARIAN}}` `base` / `hard` / `easy`, dengan target `irtB` yang sama.

## Contoh keluaran yang benar

```json
[{
  "id": "sat-math-adv-0117",
  "exam": "SAT", "section": "sat_math_m1",
  "domain": "Advanced Math", "skill": "Nonlinear functions",
  "difficulty": "H", "irtB": 1.1, "calculatorAllowed": true, "locale": "en",
  "figure": {
    "kind": "function_plot",
    "alt": "A downward-opening parabola with vertex at (2, 9) that crosses the x-axis at x = -1 and x = 5.",
    "window": {"xmin":-4,"xmax":8,"ymin":-6,"ymax":11},
    "grid": true,
    "series": [{"expr":"-(x-2)^2+9","label":"y = f(x)"}],
    "points": [{"x":2,"y":9,"label":"(2, 9)"}]
  },
  "stem": "The graph of the quadratic function $f$ is shown. If $f(x) = a(x - h)^2 + k$, what is the value of $a + h + k$?",
  "type": "spr_numeric",
  "answer": {"mode":"numeric","value":10,"acceptedForms":["10"]},
  "explanation": "The vertex is $(2, 9)$, so $h = 2$ and $k = 9$. The graph passes through $(5, 0)$, so $0 = a(5-2)^2 + 9 = 9a + 9$ and $a = -1$. Therefore $a + h + k = -1 + 2 + 9 = 10$.",
  "hints": ["Vertex form gives $h$ and $k$ straight from the vertex.","Use one x-intercept to solve for $a$."],
  "formulaRefs": ["sat_math"],
  "tags": ["quadratic","vertex-form"],
  "estimatedTimeSec": 110, "points": 1,
  "meta": {"generator":"ai","model":"claude-opus-5","reviewed":false,"version":1}
}]
```

---

**Parameter**: `{{JUMLAH}}`, `{{SECTION}}`, `{{VARIAN}}`, `{{DOMAIN}}` *(opsional)*.
