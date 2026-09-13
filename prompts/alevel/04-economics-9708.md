# PROMPT — Cambridge A Level: 9708 Economics (Data Response & Essay)

*System prompt:* `prompts/_shared/system.md`. `exam: "ALEVEL"`, `section: "al_econ_p2"`, `locale: "en"`.

---

Buat **{{JUMLAH}} soal** bergaya Paper 2. Paper aslinya 90 menit: satu **data response** (20 marks)
dan satu **esai** dari beberapa pilihan (20 marks).

`calculatorAllowed: false`. Semua soal bertipe `essay_rubric`, kecuali bagian pembuka data response
yang boleh `spr_numeric` atau `mcq_single`.

## Struktur Data Response

`stimulus.type: "text"` berisi sumber: 2–3 paragraf berita ekonomi fiktif namun realistis, plus
`figure` (`table` atau `line_chart`) berisi data. Lalu bagian bertingkat:

| bagian | marks | kata perintah | yang dinilai |
|---|---|---|---|
| (a) | 2 | `Define …` / `Calculate …` | pengetahuan |
| (b) | 4 | `Explain why …` | pemahaman + penerapan |
| (c) | 6 | `Analyse the effect of …` | analisis berantai |
| (d) | 8 | `Discuss whether …` | evaluasi berargumen |

Buat satu objek soal per bagian, atau satu objek dengan `numericBlanks` untuk (a) dan
`essay_rubric` untuk sisanya — konsisten dalam satu paket.

## Assessment objectives Cambridge (dipakai sebagai kriteria rubrik)

- **AO1 Knowledge & understanding** — definisi dan konsep yang tepat
- **AO2 Application** — konsep dikaitkan dengan konteks di sumber
- **AO3 Analysis** — rantai sebab-akibat yang lengkap, biasanya dengan diagram
- **AO4 Evaluation** — menimbang, memberi syarat, dan menyimpulkan dengan alasan

Rubrik untuk bagian 8-mark harus memuat keempatnya, dengan bobot terbesar pada AO4.

## Topik dan skill

| `domain` | `skill` |
|---|---|
| `Microeconomics` | `Price mechanism`, `Elasticity`, `Market failure`, `Firm behaviour` |
| `Macroeconomics` | `AD/AS`, `Policy`, `Trade & exchange rates`, `Growth & development` |

## Diagram

Ekonomi butuh diagram, dan diagram itu bagian dari nilainya. Gunakan `figure` bertipe
`function_plot` untuk kurva permintaan–penawaran dan AD–AS:

```jsonc
{"kind":"function_plot","alt":"Demand curve D sloping down and supply curve S sloping up, intersecting at equilibrium price P1 and quantity Q1.",
 "window":{"xmin":0,"xmax":10,"ymin":0,"ymax":10},"grid":false,
 "series":[{"expr":"10-x","label":"D"},{"expr":"2+0.8*x","label":"S"}],
 "points":[{"x":4.44,"y":5.56,"label":"E"}],
 "xLabel":"Quantity","yLabel":"Price"}
```

Untuk kurva yang harus digambar siswa, tulis di rubrik apa yang dinilai: sumbu berlabel, kurva
berlabel, titik keseimbangan awal dan akhir, arah pergeseran.

## Kalimat perintah dan artinya

- `Define` — definisi tepat, 2 marks
- `Calculate` — tunjukkan langkah; satuan wajib
- `Explain why` — sebab, bukan sekadar deskripsi
- `Analyse` — rantai penalaran minimal tiga tautan, diagram membantu
- `Discuss` / `Assess` / `To what extent` — dua sisi + penilaian berdasar bukti, wajib ada simpulan

## Aturan mutu khusus

1. Data pada sumber harus **konsisten secara internal** — angka di teks sama dengan angka di tabel.
2. Negara dan perusahaan dalam sumber harus **fiktif** ("the coastal economy of Valdara").
   Jangan mengarang data untuk negara nyata.
3. `exemplar` harus berupa jawaban lengkap setara nilai penuh, panjang 180–320 kata untuk bagian
   8-mark, dan **memuat evaluasi bersyarat** ("this depends on …", "in the short run … whereas in
   the long run …").
4. `explanation` menjelaskan **cara memperoleh mark**, bukan hanya isi jawabannya.

---

**Parameter**: `{{JUMLAH}}`, `{{TOPIK}}`, `{{JENIS}}` — `data-response` atau `essay`.
