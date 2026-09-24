import type { Question } from "@/lib/types";

/* =========================================================================
 * BANK SOAL CONTOH
 * Dipakai untuk: (1) demo gratis 10 soal, (2) mode pratinjau tanpa database.
 * Semua soal di sini juga berfungsi sebagai CONTOH KELUARAN yang benar untuk
 * prompt AI di /prompts — kalau AI menghasilkan struktur seperti ini, ia lolos
 * validasi dan langsung bisa dirender.
 * ========================================================================= */

export const SEED_QUESTIONS: Question[] = [
  /* ------------------------------------------------------------------ SAT */
  {
    id: "sat-rw-001",
    exam: "SAT", section: "sat_rw_m1", domain: "Craft and Structure", skill: "Words in Context",
    difficulty: "M", irtB: 0.1, calculatorAllowed: false, locale: "en",
    stimulus: {
      type: "passage",
      content:
        "Marine biologist Ayesha Rahman has spent a decade studying the tube worms that cluster around hydrothermal vents. These animals live without sunlight, deriving energy instead from bacteria that metabolize hydrogen sulfide. Rahman notes that early researchers, working from the assumption that all food webs ultimately trace back to photosynthesis, were slow to accept the vents' chemosynthetic communities. What now seems obvious was, for years, ______ : the idea that an entire ecosystem could flourish in total darkness struck many biologists as fanciful.",
      source: "Adapted from a 2023 review article.",
    },
    stem: "Which choice completes the text with the most logical and precise word or phrase?",
    type: "mcq_single",
    choices: [
      { id: "A", text: "self-evident" },
      { id: "B", text: "contentious" },
      { id: "C", text: "immaterial" },
      { id: "D", text: "redundant" },
    ],
    answer: { mode: "choice", value: "B" },
    explanation:
      "The sentence contrasts what *now seems obvious* with how the idea was received earlier, and the colon explains that biologists found it *fanciful*. A word meaning 'disputed' is needed. **Contentious** fits. *Self-evident* repeats rather than contrasts; *immaterial* means irrelevant, which the passage never claims; *redundant* means unnecessarily repetitive.",
    distractorRationale: {
      A: "Memilih ini kalau pembaca melewatkan kata kontras 'now' dan menyamakan dua sisi kalimat.",
      C: "Tertukar antara 'ditolak' dan 'tidak relevan'.",
      D: "Kata yang terdengar akademis tapi tidak berhubungan dengan penerimaan gagasan.",
    },
    tags: ["words-in-context", "contrast"], estimatedTimeSec: 60, points: 1,
    meta: { generator: "seed", reviewed: true },
  },
  {
    id: "sat-rw-002",
    exam: "SAT", section: "sat_rw_m1", domain: "Information and Ideas", skill: "Command of Evidence (Quantitative)",
    difficulty: "H", irtB: 0.9, calculatorAllowed: false, locale: "en",
    stimulus: {
      type: "text",
      title: "Student notes",
      content:
        "A team surveyed four coastal sites for microplastic concentration in sediment.\n\nThe team hypothesized that concentration would rise with proximity to a river mouth. They want to cite data that supports the hypothesis.",
    },
    figure: {
      kind: "bar_chart",
      alt: "Bar chart of microplastic particles per kilogram of sediment at four sites: Site A 320, Site B 210, Site C 95, Site D 40, with distance from river mouth increasing from A to D.",
      caption: "Microplastic concentration by site (distance from river mouth increases A → D)",
      categories: ["Site A (0.5 km)", "Site B (2 km)", "Site C (6 km)", "Site D (14 km)"],
      series: [{ name: "particles / kg", values: [320, 210, 95, 40] }],
      yLabel: "particles per kg",
    },
    stem: "Which choice most effectively uses data from the graph to support the team's hypothesis?",
    type: "mcq_single",
    choices: [
      { id: "A", text: "Site A, nearest the river mouth, had 320 particles per kilogram, while Site D, the farthest, had only 40." },
      { id: "B", text: "Site B and Site C together accounted for fewer particles per kilogram than Site A alone." },
      { id: "C", text: "Every site surveyed contained measurable microplastic, ranging from 40 to 320 particles per kilogram." },
      { id: "D", text: "Site D, at 14 kilometers from the river mouth, had the lowest concentration of the four sites." },
    ],
    answer: { mode: "choice", value: "A" },
    explanation:
      "The hypothesis is about a *relationship* between distance and concentration, so the evidence must pair at least two sites at different distances. Only **A** contrasts the nearest and farthest sites. B is arithmetically true but says nothing about distance. C shows presence, not a trend. D gives one endpoint only.",
    tags: ["quantitative-evidence", "graph"], estimatedTimeSec: 90, points: 1,
    meta: { generator: "seed", reviewed: true },
  },
  {
    id: "sat-math-001",
    exam: "SAT", section: "sat_math_m1", domain: "Algebra", skill: "Systems of two linear equations",
    difficulty: "M", irtB: 0, calculatorAllowed: true, locale: "en",
    stem: "$$\\begin{aligned} 3x + 2y &= 19 \\\\ x - y &= 3 \\end{aligned}$$\n\nWhat is the value of $x + y$ for the solution to the given system of equations?",
    type: "mcq_single",
    choices: [
      { id: "A", text: "$4$" },
      { id: "B", text: "$5$" },
      { id: "C", text: "$7$" },
      { id: "D", text: "$8$" },
    ],
    answer: { mode: "choice", value: "C" },
    explanation:
      "From the second equation $x = y + 3$. Substituting: $3(y+3) + 2y = 19 \\Rightarrow 5y + 9 = 19 \\Rightarrow y = 2$, so $x = 5$. Therefore $x + y = 7$.",
    formulaRefs: ["utbk_math"],
    tags: ["linear-system"], estimatedTimeSec: 70, points: 1,
    meta: { generator: "seed", reviewed: true },
  },
  {
    id: "sat-math-002",
    exam: "SAT", section: "sat_math_m1", domain: "Advanced Math", skill: "Nonlinear functions",
    difficulty: "H", irtB: 1.1, calculatorAllowed: true, locale: "en",
    figure: {
      kind: "function_plot",
      alt: "A downward-opening parabola with vertex at (2, 9) crossing the x-axis at x = -1 and x = 5.",
      window: { xmin: -4, xmax: 8, ymin: -6, ymax: 11 },
      grid: true,
      series: [{ expr: "-(x-2)^2+9", label: "y = f(x)" }],
      points: [{ x: 2, y: 9, label: "(2, 9)" }],
    },
    stem: "The graph of the quadratic function $f$ is shown. If $f(x) = a(x - h)^2 + k$, what is the value of $a + h + k$?",
    type: "spr_numeric",
    answer: { mode: "numeric", value: 10, acceptedForms: ["10"] },
    explanation:
      "The vertex is $(2, 9)$, so $h = 2$ and $k = 9$. The parabola passes through $(5, 0)$: $0 = a(5-2)^2 + 9 = 9a + 9$, so $a = -1$. Then $a + h + k = -1 + 2 + 9 = 10$.",
    hints: ["Bentuk $a(x-h)^2+k$ langsung memberi titik puncak $(h,k)$.", "Pakai satu titik potong sumbu-$x$ untuk mencari $a$."],
    tags: ["quadratic", "vertex-form"], estimatedTimeSec: 110, points: 1,
    meta: { generator: "seed", reviewed: true },
  },
  {
    id: "sat-math-003",
    exam: "SAT", section: "sat_math_m1", domain: "Geometry and Trigonometry", skill: "Right triangles and trigonometry",
    difficulty: "M", irtB: 0.3, calculatorAllowed: true, locale: "en",
    figure: {
      kind: "geometry",
      alt: "Right triangle ABC with the right angle at B, AB = 8, BC = 15, and hypotenuse AC.",
      viewBox: [0, 0, 260, 180],
      elements: [
        { t: "polygon", points: [[30, 150], [30, 40], [230, 150]], stroke: "var(--fg)" },
        { t: "angle", at: [30, 150], from: [30, 40], to: [230, 150], right: true },
        { t: "label", at: [22, 36], text: "A", anchor: "end" },
        { t: "label", at: [22, 158], text: "B", anchor: "end" },
        { t: "label", at: [238, 158], text: "C", anchor: "start" },
        { t: "label", at: [14, 96], text: "8", anchor: "end" },
        { t: "label", at: [130, 168], text: "15", anchor: "middle" },
      ],
    },
    stem: "In right triangle $ABC$ above, $AB = 8$ and $BC = 15$. What is the value of $\\sin(\\angle ACB)$?",
    type: "mcq_single",
    choices: [
      { id: "A", text: "$\\dfrac{8}{15}$" },
      { id: "B", text: "$\\dfrac{8}{17}$" },
      { id: "C", text: "$\\dfrac{15}{17}$" },
      { id: "D", text: "$\\dfrac{17}{8}$" },
    ],
    answer: { mode: "choice", value: "B" },
    explanation:
      "$AC = \\sqrt{8^2 + 15^2} = 17$. For $\\angle ACB$, the opposite side is $AB = 8$ and the hypotenuse is $AC = 17$, so $\\sin = \\tfrac{8}{17}$.",
    formulaRefs: ["sat_math"],
    tags: ["pythagoras", "sohcahtoa"], estimatedTimeSec: 80, points: 1,
    meta: { generator: "seed", reviewed: true },
  },
  {
    id: "sat-math-004",
    exam: "SAT", section: "sat_math_m1", domain: "Problem-Solving and Data Analysis", skill: "Two-variable data",
    difficulty: "M", irtB: 0.2, calculatorAllowed: true, locale: "en",
    figure: {
      kind: "scatter",
      alt: "Scatterplot of study hours versus practice test score for 10 students with a line of best fit rising from about 900 at 0 hours to about 1300 at 20 hours.",
      points: [
        { x: 2, y: 950 }, { x: 4, y: 1010 }, { x: 5, y: 1040 }, { x: 7, y: 1080 }, { x: 9, y: 1130 },
        { x: 11, y: 1150 }, { x: 13, y: 1210 }, { x: 15, y: 1230 }, { x: 17, y: 1280 }, { x: 19, y: 1300 },
      ],
      window: { xmin: 0, xmax: 20, ymin: 900, ymax: 1350 },
      trendline: { expr: "20*x + 920", label: "line of best fit" },
      xLabel: "weekly study hours",
      yLabel: "practice score",
    },
    stem: "The line of best fit for the data shown is $y = 20x + 920$. Based on this model, what is the predicted increase in practice score for each additional weekly study hour?",
    type: "spr_numeric",
    answer: { mode: "numeric", value: 20 },
    explanation: "In $y = mx + b$ the slope $m$ is the predicted change in $y$ per unit change in $x$. Here $m = 20$ points per hour.",
    tags: ["line-of-best-fit", "slope"], estimatedTimeSec: 60, points: 1,
    meta: { generator: "seed", reviewed: true },
  },

  /* ----------------------------------------------------------------- UTBK */
  {
    id: "utbk-pu-001",
    exam: "UTBK", section: "utbk_pu", domain: "Penalaran Deduktif", skill: "Silogisme",
    difficulty: "M", irtB: 0.2, calculatorAllowed: false, locale: "id",
    stem:
      "Semua mahasiswa yang mengambil mata kuliah Statistika wajib mengikuti praktikum.\nSebagian mahasiswa yang mengikuti praktikum tidak memiliki laptop.\n\nSimpulan yang **pasti benar** adalah ...",
    type: "mcq_single",
    choices: [
      { id: "A", text: "Semua mahasiswa Statistika tidak memiliki laptop." },
      { id: "B", text: "Sebagian mahasiswa yang tidak memiliki laptop mengikuti praktikum." },
      { id: "C", text: "Semua peserta praktikum mengambil mata kuliah Statistika." },
      { id: "D", text: "Sebagian mahasiswa Statistika tidak memiliki laptop." },
      { id: "E", text: "Mahasiswa yang memiliki laptop tidak mengikuti praktikum." },
    ],
    answer: { mode: "choice", value: "B" },
    explanation:
      "Premis kedua menyatakan irisan antara *peserta praktikum* dan *tidak punya laptop* tidak kosong. Membalik pernyataan 'sebagian' selalu sah, jadi **B** pasti benar. **D** tidak pasti karena peserta praktikum belum tentu mahasiswa Statistika (arah implikasinya satu arah). **C** membalik implikasi universal. **A** dan **E** menggeneralisasi berlebihan.",
    distractorRationale: {
      D: "Jebakan paling umum: membalik arah implikasi 'Statistika → praktikum' menjadi 'praktikum → Statistika'.",
      C: "Konvers dari premis pertama, tidak sah.",
    },
    tags: ["silogisme", "kuantor"], estimatedTimeSec: 75, points: 1,
    meta: { generator: "seed", reviewed: true },
  },
  {
    id: "utbk-pu-002",
    exam: "UTBK", section: "utbk_pu", domain: "Penalaran Kuantitatif", skill: "Baca grafik & tabel",
    difficulty: "M", irtB: 0.4, calculatorAllowed: false, locale: "id",
    figure: {
      kind: "line_chart",
      alt: "Grafik garis jumlah pengunjung perpustakaan daerah tahun 2019 sampai 2024 untuk dua cabang: Cabang Utara naik dari 12 ke 31 ribu, Cabang Selatan naik dari 20 ke 26 ribu.",
      caption: "Pengunjung perpustakaan (ribu orang)",
      categories: [2019, 2020, 2021, 2022, 2023, 2024],
      series: [
        { name: "Cabang Utara", values: [12, 9, 15, 22, 27, 31] },
        { name: "Cabang Selatan", values: [20, 14, 18, 21, 24, 26] },
      ],
      yLabel: "ribu pengunjung",
    },
    stem: "Berdasarkan grafik, pernyataan berikut benar atau salah?",
    type: "true_false_multi",
    statements: [
      { id: "s1", text: "Selisih pengunjung kedua cabang paling kecil terjadi pada tahun 2022." },
      { id: "s2", text: "Cabang Utara pertama kali melampaui Cabang Selatan pada tahun 2023." },
      { id: "s3", text: "Kenaikan pengunjung Cabang Utara dari 2021 ke 2022 lebih besar daripada kenaikan Cabang Selatan pada periode yang sama." },
    ],
    answer: { mode: "boolean_list", values: [true, false, true] },
    explanation:
      "Selisih tiap tahun: 2019 = 8, 2020 = 5, 2021 = 3, 2022 = 1, 2023 = 3, 2024 = 5. Terkecil di 2022, jadi pernyataan 1 **benar**. Cabang Utara sudah melampaui Selatan pada 2022 (22 > 21), bukan 2023, jadi pernyataan 2 **salah**. Kenaikan 2021 \u2192 2022: Utara +7 (15 \u2192 22), Selatan +3 (18 \u2192 21), jadi pernyataan 3 **benar**.",
    tags: ["grafik", "trend"], estimatedTimeSec: 100, points: 1,
    meta: { generator: "seed", reviewed: false },
  },
  {
    id: "utbk-pbm-001",
    exam: "UTBK", section: "utbk_pbm", domain: "Kemampuan Menulis", skill: "Penyuntingan kata",
    difficulty: "E", irtB: -0.6, calculatorAllowed: false, locale: "id",
    stimulus: {
      type: "passage",
      content:
        "(1) Program konservasi mangrove di pesisir utara Jawa telah berjalan selama lima tahun. (2) Selama periode itu, luas tutupan mangrove bertambah sekitar 1.200 hektare. (3) Meskipun demikian, laju abrasi di beberapa titik masih tinggi karena penanaman belum menjangkau area yang paling terdampak.",
    },
    stem:
      "Kata yang tepat untuk mengisi bagian rumpang adalah: Penanaman mangrove terbukti {{b1}} laju abrasi, tetapi cakupannya {{b2}} merata di seluruh pesisir.",
    type: "dropdown_inline",
    blanks: [
      { id: "b1", options: [{ id: "1", text: "menekan" }, { id: "2", text: "menekankan" }, { id: "3", text: "tertekan" }] },
      { id: "b2", options: [{ id: "1", text: "sudah" }, { id: "2", text: "belum" }, { id: "3", text: "sedang" }] },
    ],
    answer: { mode: "dropdowns", values: { b1: "1", b2: "2" } },
    explanation:
      "*Menekan* berarti mengurangi; *menekankan* berarti memberi tekanan pada gagasan sehingga tidak cocok. Kalimat (3) menyatakan penanaman **belum** menjangkau area terdampak, jadi cakupannya belum merata.",
    tags: ["diksi", "konjungsi"], estimatedTimeSec: 70, points: 1,
    meta: { generator: "seed", reviewed: true },
  },
  {
    id: "utbk-pk-001",
    exam: "UTBK", section: "utbk_pk", domain: "Data & Ketidakpastian", skill: "Peluang",
    difficulty: "M", irtB: 0.3, calculatorAllowed: false, locale: "id",
    stem:
      "Sebuah kotak berisi 4 bola merah dan 6 bola putih. Dua bola diambil satu per satu **tanpa pengembalian**. Peluang terambil dua bola berwarna sama adalah ...",
    type: "mcq_single",
    choices: [
      { id: "A", text: "$\\dfrac{2}{9}$" },
      { id: "B", text: "$\\dfrac{1}{3}$" },
      { id: "C", text: "$\\dfrac{7}{15}$" },
      { id: "D", text: "$\\dfrac{8}{15}$" },
      { id: "E", text: "$\\dfrac{3}{5}$" },
    ],
    answer: { mode: "choice", value: "C" },
    explanation:
      "$P(\\text{MM}) = \\tfrac{4}{10}\\cdot\\tfrac{3}{9} = \\tfrac{12}{90}$ dan $P(\\text{PP}) = \\tfrac{6}{10}\\cdot\\tfrac{5}{9} = \\tfrac{30}{90}$. Totalnya $\\tfrac{42}{90} = \\tfrac{7}{15}$.",
    formulaRefs: ["utbk_math"],
    tags: ["peluang", "tanpa-pengembalian"], estimatedTimeSec: 90, points: 1,
    meta: { generator: "seed", reviewed: true },
  },
  {
    id: "utbk-pm-001",
    exam: "UTBK", section: "utbk_pm", domain: "Aljabar", skill: "Pemodelan persamaan",
    difficulty: "M", irtB: 0.25, calculatorAllowed: false, locale: "id",
    stimulus: {
      type: "text",
      title: "Tarif parkir",
      content:
        "Sebuah gedung menetapkan tarif parkir Rp5.000 untuk satu jam pertama dan Rp3.000 untuk setiap jam berikutnya (bagian jam dibulatkan ke atas). Tarif maksimum per hari adalah Rp35.000.",
    },
    stem: "Jika seorang pengemudi memarkir kendaraannya selama $t$ jam dengan $1 \\le t \\le 8$, berapa biaya parkir untuk $t = 6$ (dalam ribuan rupiah)?",
    type: "spr_numeric",
    answer: { mode: "numeric", value: 20 },
    explanation:
      "Biaya $= 5 + 3(t-1)$ ribu. Untuk $t = 6$: $5 + 3(5) = 20$ ribu, masih di bawah batas maksimum 35 ribu.",
    tags: ["fungsi-bertahap", "pemodelan"], estimatedTimeSec: 85, points: 1,
    meta: { generator: "seed", reviewed: true },
  },
  {
    id: "utbk-lbi-001",
    exam: "UTBK", section: "utbk_lbi", domain: "Teks Informasi", skill: "Mengevaluasi & merefleksi",
    difficulty: "H", irtB: 0.8, calculatorAllowed: false, locale: "id",
    stimulus: {
      type: "passage",
      title: "Kota spons",
      content:
        "Konsep *sponge city* menata kota agar mampu menyerap, menyimpan, dan melepaskan air hujan secara bertahap alih-alih membuangnya secepat mungkin lewat gorong-gorong. Taman hujan, perkerasan berpori, dan kolam retensi menggantikan sebagian beton kedap air.\n\nKota-kota yang menerapkannya melaporkan penurunan volume limpasan puncak hingga 40 persen. Namun, efektivitasnya bergantung pada intensitas hujan: pada curah hujan ekstrem yang melampaui kapasitas simpan tanah, sistem ini jenuh dan limpasan tetap terjadi. Kritik lain menyoroti biaya perawatan yang tinggi dan kebutuhan lahan yang sulit dipenuhi di kawasan padat.",
    },
    stem: "Manakah yang merupakan penilaian **paling tepat** terhadap argumen penulis?",
    type: "mcq_single",
    choices: [
      { id: "A", text: "Penulis menolak konsep kota spons karena biayanya mahal." },
      { id: "B", text: "Penulis menyajikan manfaat kota spons sekaligus mengakui batas penerapannya." },
      { id: "C", text: "Penulis menyimpulkan bahwa kota spons hanya cocok untuk kota kecil." },
      { id: "D", text: "Penulis membandingkan kota spons dengan sistem gorong-gorong konvensional secara kuantitatif." },
      { id: "E", text: "Penulis mengklaim kota spons dapat menghilangkan banjir sepenuhnya." },
    ],
    answer: { mode: "choice", value: "B" },
    explanation:
      "Paragraf kedua memuat data manfaat (penurunan limpasan 40%) lalu diikuti kata *Namun* dan *Kritik lain* yang memaparkan keterbatasan. Ini pola menyajikan-lalu-membatasi, bukan menolak (A/E) maupun menyimpulkan lingkup pemakaian (C).",
    tags: ["evaluasi-argumen"], estimatedTimeSec: 110, points: 1,
    meta: { generator: "seed", reviewed: true },
  },

  /* ----------------------------------------------------------------- CSCA */
  {
    id: "csca-math-001",
    exam: "CSCA", section: "csca_math", domain: "Geometry & Algebra 几何与代数", skill: "Ellipses 椭圆",
    difficulty: "H", irtB: 1.0, calculatorAllowed: false, locale: "en",
    i18n: {
      zh: {
        stem: "已知椭圆 $\\dfrac{x^{2}}{25}+\\dfrac{y^{2}}{9}=1$，则其离心率 $e$ 等于多少？",
        explanation: "由 $a^{2}=25,\\ b^{2}=9$ 得 $c^{2}=a^{2}-b^{2}=16$，故 $c=4$，$e=\\dfrac{c}{a}=\\dfrac{4}{5}$。",
        choices: [
          { id: "A", text: "$\\dfrac{3}{5}$" },
          { id: "B", text: "$\\dfrac{4}{5}$" },
          { id: "C", text: "$\\dfrac{9}{25}$" },
          { id: "D", text: "$\\dfrac{16}{25}$" },
          { id: "E", text: "$\\dfrac{5}{4}$" },
        ],
      },
    },
    stem: "For the ellipse $\\dfrac{x^{2}}{25}+\\dfrac{y^{2}}{9}=1$, what is the eccentricity $e$?",
    type: "mcq_single",
    choices: [
      { id: "A", text: "$\\dfrac{3}{5}$" },
      { id: "B", text: "$\\dfrac{4}{5}$" },
      { id: "C", text: "$\\dfrac{9}{25}$" },
      { id: "D", text: "$\\dfrac{16}{25}$" },
      { id: "E", text: "$\\dfrac{5}{4}$" },
    ],
    answer: { mode: "choice", value: "B" },
    explanation:
      "With $a^{2}=25$ and $b^{2}=9$, $c^{2}=a^{2}-b^{2}=16$ so $c=4$ and $e=\\dfrac{c}{a}=\\dfrac{4}{5}$. Choice A uses $b/a$; E inverts the ratio.",
    formulaRefs: ["csca_math"],
    tags: ["ellipse", "eccentricity"], estimatedTimeSec: 90, points: 1,
    meta: { generator: "seed", reviewed: true },
  },
  {
    id: "csca-chinese-001",
    exam: "CSCA", section: "csca_chinese_hum", domain: "Language Use 语言运用", skill: "Vocabulary fill-in-the-blank 词语填空",
    difficulty: "M", irtB: 0.1, calculatorAllowed: false, locale: "zh",
    i18n: {
      en: {
        stem: "Choose the option that correctly completes the sentence: 他 ______ 那本书放在桌子上了。",
        explanation: "The 把 construction moves the object before the verb and requires a resultative or locative complement — 放在桌子上 supplies it.",
      },
    },
    stem: "选择正确的选项完成句子：他 ______ 那本书放在桌子上了。",
    type: "mcq_single",
    choices: [
      { id: "A", text: "把" },
      { id: "B", text: "被" },
      { id: "C", text: "让" },
      { id: "D", text: "给" },
      { id: "E", text: "使" },
    ],
    answer: { mode: "choice", value: "A" },
    explanation:
      "「把」字句把宾语提到动词前，并要求动词后带补语（这里是「在桌子上」）。「被」用于被动，主语应是受事；「让／使」表致使；「给」在此结构中不成立。",
    tags: ["ba-construction", "hsk4"], estimatedTimeSec: 45, points: 1,
    meta: { generator: "seed", reviewed: true },
  },
  {
    id: "csca-physics-001",
    exam: "CSCA", section: "csca_physics", domain: "Electromagnetism 电磁学", skill: "Ohm's law 欧姆定律",
    difficulty: "M", irtB: 0.3, calculatorAllowed: false, locale: "en",
    i18n: {
      zh: {
        stem: "一个 $12\\ \\mathrm{V}$ 电源与一个 $4\\ \\Omega$ 电阻串联，再与 $6\\ \\Omega$ 和 $3\\ \\Omega$ 并联组合相接。电源提供的总电流是多少？",
        choices: [
          { id: "A", text: "$0.92\\ \\mathrm{A}$" },
          { id: "B", text: "$2.0\\ \\mathrm{A}$" },
          { id: "C", text: "$3.0\\ \\mathrm{A}$" },
          { id: "D", text: "$6.0\\ \\mathrm{A}$" },
        ],
        explanation:
          "并联部分：$\\dfrac{1}{R_p}=\\dfrac{1}{6}+\\dfrac{1}{3}=\\dfrac{1}{2}$，故 $R_p = 2\\ \\Omega$。总电阻 $R = 4 + 2 = 6\\ \\Omega$，因此 $I = V/R = 12/6 = 2\\ \\mathrm{A}$。",
      },
    },
    figure: {
      kind: "circuit",
      alt: "A circuit with a 12 volt battery connected to a 4 ohm resistor in series with a parallel pair of 6 ohm and 3 ohm resistors.",
      width: 380, height: 220,
      nodes: [
        { id: "a", at: [40, 40] }, { id: "b", at: [200, 40] }, { id: "c", at: [340, 40] },
        { id: "d", at: [340, 180] }, { id: "e", at: [40, 180] },
      ],
      components: [
        { c: "battery", from: "e", to: "a", label: "12 V" },
        { c: "resistor", from: "a", to: "b", label: "4 Ω" },
        { c: "resistor", from: "b", to: "c", label: "6 Ω ∥ 3 Ω" },
        { c: "wire", from: "c", to: "d" },
        { c: "wire", from: "d", to: "e" },
      ],
    },
    stem: "A $12\\ \\mathrm{V}$ battery is connected to a $4\\ \\Omega$ resistor in series with a parallel combination of $6\\ \\Omega$ and $3\\ \\Omega$. What is the total current drawn from the battery?",
    type: "mcq_single",
    choices: [
      { id: "A", text: "$0.92\\ \\mathrm{A}$" },
      { id: "B", text: "$2.0\\ \\mathrm{A}$" },
      { id: "C", text: "$3.0\\ \\mathrm{A}$" },
      { id: "D", text: "$6.0\\ \\mathrm{A}$" },
    ],
    answer: { mode: "choice", value: "B" },
    distractorRationale: {
      A: "Menjumlahkan resistor paralel seperti seri: $4+6+3=13\\ \\Omega$.",
      C: "Hanya memakai resistor seri $4\\ \\Omega$ dan mengabaikan bagian paralel.",
      D: "Menghitung $R_p = 2\\ \\Omega$ dengan benar lalu lupa menambahkan $4\\ \\Omega$.",
    },
    explanation:
      "Parallel pair: $\\dfrac{1}{R_p}=\\dfrac{1}{6}+\\dfrac{1}{3}=\\dfrac{1}{2}$, so $R_p = 2\\ \\Omega$. Total $R = 4 + 2 = 6\\ \\Omega$ and $I = V/R = 12/6 = 2\\ \\mathrm{A}$.",
    formulaRefs: ["csca_physics"],
    tags: ["dc-circuit", "series-parallel"], estimatedTimeSec: 100, points: 1,
    meta: { generator: "seed", reviewed: true },
  },
  /* --------------------------------------------------------------- ALEVEL */
  {
    id: "al-math-001",
    exam: "ALEVEL", section: "al_math_p1", domain: "Differentiation", skill: "Stationary points",
    difficulty: "M", irtB: 0.4, calculatorAllowed: true, locale: "en",
    stem:
      "A curve has equation $y = x^{3} - 6x^{2} + 9x + 2$.\n\n(a) Find the $x$-coordinates of the two stationary points.\n(b) State the $y$-coordinate of the local maximum.",
    type: "numeric_multi",
    numericBlanks: [
      { id: "x1", label: "(a) smaller x" },
      { id: "x2", label: "(a) larger x" },
      { id: "ymax", label: "(b) y at local maximum" },
    ],
    answer: { mode: "numeric_list", values: [{ key: "x1", value: 1 }, { key: "x2", value: 3 }, { key: "ymax", value: 6 }] },
    explanation:
      "$\\dfrac{dy}{dx} = 3x^{2} - 12x + 9 = 3(x-1)(x-3)$, so stationary points at $x = 1$ and $x = 3$. $\\dfrac{d^{2}y}{dx^{2}} = 6x - 12$ is negative at $x = 1$, so that is the maximum: $y = 1 - 6 + 9 + 2 = 6$.",
    formulaRefs: ["alevel_mf19"],
    tags: ["stationary-points", "second-derivative"], estimatedTimeSec: 210, points: 5,
    meta: { generator: "seed", reviewed: true },
  },
  {
    id: "al-chem-001",
    exam: "ALEVEL", section: "al_chem_p1", domain: "Physical Chemistry", skill: "Moles & stoichiometry",
    difficulty: "M", irtB: 0.2, calculatorAllowed: true, locale: "en",
    stem:
      "$25.0\\ \\mathrm{cm^{3}}$ of $0.100\\ \\mathrm{mol\\,dm^{-3}}$ NaOH is exactly neutralised by $20.0\\ \\mathrm{cm^{3}}$ of sulfuric acid.\n\n$$\\mathrm{2NaOH + H_2SO_4 \\rightarrow Na_2SO_4 + 2H_2O}$$\n\nWhat is the concentration of the sulfuric acid?",
    type: "mcq_single",
    choices: [
      { id: "A", text: "$0.0625\\ \\mathrm{mol\\,dm^{-3}}$" },
      { id: "B", text: "$0.125\\ \\mathrm{mol\\,dm^{-3}}$" },
      { id: "C", text: "$0.250\\ \\mathrm{mol\\,dm^{-3}}$" },
      { id: "D", text: "$0.500\\ \\mathrm{mol\\,dm^{-3}}$" },
    ],
    answer: { mode: "choice", value: "A" },
    explanation:
      "$n(\\mathrm{NaOH}) = 0.0250 \\times 0.100 = 2.50\\times10^{-3}\\ \\mathrm{mol}$. The ratio is 2 : 1, so $n(\\mathrm{H_2SO_4}) = 1.25\\times10^{-3}\\ \\mathrm{mol}$ in $0.0200\\ \\mathrm{dm^{3}}$, giving $0.0625\\ \\mathrm{mol\\,dm^{-3}}$. Choice B forgets the 2 : 1 ratio.",
    formulaRefs: ["alevel_chem"],
    tags: ["titration", "stoichiometry"], estimatedTimeSec: 90, points: 1,
    meta: { generator: "seed", reviewed: true },
  },
  {
    id: "al-phys-001",
    exam: "ALEVEL", section: "al_phys_p2", domain: "Kinematics & Dynamics", skill: "Motion graphs",
    difficulty: "M", irtB: 0.3, calculatorAllowed: true, locale: "en",
    figure: {
      kind: "line_chart",
      alt: "Velocity-time graph: velocity rises linearly from 0 to 20 m/s over 4 s, stays at 20 m/s until 10 s, then falls linearly to 0 at 14 s.",
      caption: "Velocity–time graph for a trolley",
      categories: [0, 2, 4, 6, 8, 10, 12, 14],
      series: [{ name: "v / m s⁻¹", values: [0, 10, 20, 20, 20, 20, 10, 0] }],
      xLabel: "t / s",
      yLabel: "v / m s⁻¹",
    },
    stem: "Using the velocity–time graph, calculate the total distance travelled by the trolley, in metres.",
    type: "spr_numeric",
    answer: { mode: "numeric", value: 200, unit: "m" },
    explanation:
      "Distance is the area under a velocity\u2013time graph. Acceleration phase ($0$ to $4\\ \\mathrm{s}$): $\\tfrac12(4)(20) = 40\\ \\mathrm{m}$. Constant phase ($4$ to $10\\ \\mathrm{s}$): $(6)(20) = 120\\ \\mathrm{m}$. Deceleration phase ($10$ to $14\\ \\mathrm{s}$): $\\tfrac12(4)(20) = 40\\ \\mathrm{m}$. Total $= 200\\ \\mathrm{m}$.",
    formulaRefs: ["alevel_physics"],
    tags: ["v-t-graph", "area-under-graph"], estimatedTimeSec: 120, points: 3,
    meta: { generator: "seed", reviewed: false },
  },
];

/* Soal demo gratis: 10 soal, dipilih agar semua tipe input terwakili. */
export function demoQuestions(exam: string): Question[] {
  const pool = SEED_QUESTIONS.filter((q) => q.exam === exam);
  const others = SEED_QUESTIONS.filter((q) => q.exam !== exam);
  return [...pool, ...others].slice(0, 10);
}

export const questionById = (id: string) => SEED_QUESTIONS.find((q) => q.id === id);
