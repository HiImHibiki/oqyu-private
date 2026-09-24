# PROMPT — Cambridge A Level: 9709 Pure Mathematics 1

*System prompt:* `prompts/_shared/system.md`. `exam: "ALEVEL"`, `section: "al_math_p1"`, `locale: "en"`.

---

Buat **{{JUMLAH}} soal** bergaya Paper 1 (Pure Mathematics 1). Paper aslinya 75 marks / 110 menit,
sekitar 10–11 soal — jadi rata-rata **1,5 menit per mark**.

## Yang membedakan A Level dari SAT/UTBK

A Level bukan pilihan ganda. Soalnya **berstruktur**: satu batang soal dengan bagian (a), (b), (c)
yang saling membangun, dan **nilainya per langkah** (method marks + accuracy marks). Karena itu:

- Gunakan `numeric_multi` untuk soal berbagian dengan jawaban numerik — satu `numericBlanks` per
  bagian, `label` berisi `"(a) ..."`, `"(b) ..."`.
- Gunakan `essay_rubric` untuk bagian "show that", "prove that", atau "explain why", dengan
  `answer.rubric` yang meniru mark scheme Cambridge.
- Gunakan `spr_numeric` untuk soal satu bagian.
- `points` = jumlah marks bagian itu (mis. 5 untuk soal 5-mark), bukan 1.
- `calculatorAllowed: true`, `formulaRefs: ["alevel_mf19"]`.

## Menulis rubrik bergaya mark scheme

```jsonc
"answer": {
  "mode": "rubric",
  "rubric": [
    {"criterion": "M1", "points": 1, "descriptor": "Differentiates to obtain $\\frac{dy}{dx}=3x^2-12x+9$"},
    {"criterion": "M1", "points": 1, "descriptor": "Sets derivative to zero and factorises"},
    {"criterion": "A1", "points": 1, "descriptor": "Obtains $x = 1$ and $x = 3$ (both required)"},
    {"criterion": "M1", "points": 1, "descriptor": "Uses second derivative or sign test to identify the maximum"},
    {"criterion": "A1", "points": 1, "descriptor": "States the maximum point is $(1, 6)$"}
  ],
  "exemplar": "…jawaban lengkap yang akan mendapat nilai penuh…"
}
```

Konvensi kode: `M` = method mark, `A` = accuracy mark, `B` = independent mark, `ft` = follow-through.

## Topik, skill, dan porsi

| `domain` | `skill` | porsi |
|---|---|---|
| `Quadratics` | `Completing the square`, `Discriminant`, `Quadratic inequalities` | 12% |
| `Functions` | `Domain & range`, `Composite & inverse`, `Transformations` | 15% |
| `Coordinate geometry` | `Straight lines`, `Circles`, `Intersections` | 13% |
| `Circular measure` | `Radians`, `Arc length & sector area` | 10% |
| `Trigonometry` | `Graphs`, `Identities`, `Equations` | 15% |
| `Series` | `Binomial expansion`, `AP`, `GP` | 12% |
| `Differentiation` | `Chain rule`, `Stationary points`, `Rates of change` | 13% |
| `Integration` | `Definite integrals`, `Area under curve`, `Volume of revolution` | 10% |

## Kalimat perintah baku Cambridge (pakai apa adanya)

`Find …` · `Show that …` · `Hence, or otherwise, …` · `Express … in the form …` ·
`Determine the set of values of $k$ for which …` · `Sketch the graph of …` ·
`Solve the equation … for $0° \le x \le 360°$` · `Find the exact value of …`

Perhatikan: **"Hence"** berarti bagian berikutnya wajib memakai hasil bagian sebelumnya — pastikan
strukturnya memang begitu.

## Aturan mutu khusus A Level

1. Bagian (a) harus dapat dikerjakan sendiri; bagian (b) boleh bergantung pada (a). Bila (b)
   bergantung, sebut di rubrik bahwa nilai *follow-through* berlaku.
2. `Show that` selalu memberi hasil akhirnya di soal — supaya siswa yang gagal tetap bisa mengerjakan
   bagian berikutnya.
3. Nilai eksak diminta secara eksplisit bila jawabannya melibatkan $\pi$, akar, atau logaritma
   (`Find the exact value of ...`).
4. Batas sudut selalu dinyatakan, dan satuannya (derajat atau radian) konsisten dengan topiknya —
   Circular measure selalu radian.
5. `estimatedTimeSec` = `points` × 90 detik.

---

**Parameter**: `{{JUMLAH}}`, `{{TOPIK}}` *(opsional)*, `{{TOTAL_MARKS}}` — target total marks paket.
