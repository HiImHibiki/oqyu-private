import type { ExamBlueprint } from "@/lib/types";

/* =========================================================================
 * BLUEPRINT UJIAN
 * Angka durasi/jumlah soal di sini mengikuti spesifikasi resmi terbaru.
 * Ubah di satu tempat ini saja — dipakai oleh generator paket, timer ujian,
 * dan prompt AI (lihat /prompts, angkanya disalin dari sini).
 * ========================================================================= */

const M = 60;

export const SAT: ExamBlueprint = {
  code: "SAT",
  name: "Digital SAT",
  tagline: "Adaptif per modul, persis Bluebook",
  locales: ["en"],
  totalDurationSec: 134 * M,
  scoring: { kind: "sat_scaled", perSectionRange: [200, 800], totalRange: [400, 1600] },
  sections: [
    {
      code: "sat_rw_m1",
      name: "Reading and Writing — Module 1",
      durationSec: 32 * M,
      questionCount: 27,
      calculatorAllowed: false,
      adaptive: { module: 1 },
      allowedTypes: ["mcq_single"],
      domains: [
        { name: "Information and Ideas", weight: 0.26, skills: ["Central Ideas and Details", "Command of Evidence (Textual)", "Command of Evidence (Quantitative)", "Inferences"] },
        { name: "Craft and Structure", weight: 0.28, skills: ["Words in Context", "Text Structure and Purpose", "Cross-Text Connections"] },
        { name: "Expression of Ideas", weight: 0.2, skills: ["Rhetorical Synthesis", "Transitions"] },
        { name: "Standard English Conventions", weight: 0.26, skills: ["Boundaries", "Form, Structure, and Sense"] },
      ],
    },
    {
      code: "sat_rw_m2",
      name: "Reading and Writing — Module 2 (adaptive)",
      durationSec: 32 * M,
      questionCount: 27,
      calculatorAllowed: false,
      adaptive: { module: 2, routesFrom: "sat_rw_m1", threshold: 0.6 },
      breakAfterSec: 10 * M,
      allowedTypes: ["mcq_single"],
      domains: [
        { name: "Information and Ideas", weight: 0.26, skills: ["Central Ideas and Details", "Command of Evidence (Textual)", "Command of Evidence (Quantitative)", "Inferences"] },
        { name: "Craft and Structure", weight: 0.28, skills: ["Words in Context", "Text Structure and Purpose", "Cross-Text Connections"] },
        { name: "Expression of Ideas", weight: 0.2, skills: ["Rhetorical Synthesis", "Transitions"] },
        { name: "Standard English Conventions", weight: 0.26, skills: ["Boundaries", "Form, Structure, and Sense"] },
      ],
    },
    {
      code: "sat_math_m1",
      name: "Math — Module 1",
      durationSec: 35 * M,
      questionCount: 22,
      calculatorAllowed: true,
      formulaSheet: "sat_math",
      adaptive: { module: 1 },
      allowedTypes: ["mcq_single", "spr_numeric"],
      // soal 1-15 pilihan ganda, 16-22 isian - ditetapkan College Board
      typeMix: [
        { type: "mcq_single", count: 15, note: "soal 1-15" },
        { type: "spr_numeric", count: 7, note: "soal 16-22, student-produced response" },
      ],
      domains: [
        { name: "Algebra", weight: 0.35, skills: ["Linear equations in one variable", "Linear equations in two variables", "Linear functions", "Systems of two linear equations", "Linear inequalities"] },
        { name: "Advanced Math", weight: 0.35, skills: ["Equivalent expressions", "Nonlinear equations in one variable", "Nonlinear functions"] },
        { name: "Problem-Solving and Data Analysis", weight: 0.15, skills: ["Ratios, rates, proportional relationships, units", "Percentages", "One-variable data", "Two-variable data", "Probability", "Inference from sample statistics", "Evaluating statistical claims"] },
        { name: "Geometry and Trigonometry", weight: 0.15, skills: ["Area and volume", "Lines, angles, and triangles", "Right triangles and trigonometry", "Circles"] },
      ],
    },
    {
      code: "sat_math_m2",
      name: "Math — Module 2 (adaptive)",
      durationSec: 35 * M,
      questionCount: 22,
      calculatorAllowed: true,
      formulaSheet: "sat_math",
      adaptive: { module: 2, routesFrom: "sat_math_m1", threshold: 0.6 },
      allowedTypes: ["mcq_single", "spr_numeric"],
      typeMix: [
        { type: "mcq_single", count: 15, note: "soal 1-15" },
        { type: "spr_numeric", count: 7, note: "soal 16-22, student-produced response" },
      ],
      domains: [
        { name: "Algebra", weight: 0.35, skills: ["Linear equations in one variable", "Linear equations in two variables", "Linear functions", "Systems of two linear equations", "Linear inequalities"] },
        { name: "Advanced Math", weight: 0.35, skills: ["Equivalent expressions", "Nonlinear equations in one variable", "Nonlinear functions"] },
        { name: "Problem-Solving and Data Analysis", weight: 0.15, skills: ["Ratios, rates, proportional relationships, units", "Percentages", "One-variable data", "Two-variable data", "Probability", "Inference from sample statistics", "Evaluating statistical claims"] },
        { name: "Geometry and Trigonometry", weight: 0.15, skills: ["Area and volume", "Lines, angles, and triangles", "Right triangles and trigonometry", "Circles"] },
      ],
    },
  ],
};

export const UTBK: ExamBlueprint = {
  code: "UTBK",
  name: "UTBK-SNBT",
  tagline: "7 subtes, 155 soal, 195 menit",
  locales: ["id"],
  totalDurationSec: 195 * M,
  scoring: { kind: "utbk_irt", perSectionRange: [0, 1000], totalRange: [0, 1000] },
  sections: [
    {
      code: "utbk_pu", name: "Penalaran Umum", nameId: "Penalaran Umum",
      durationSec: 30 * M, questionCount: 30, calculatorAllowed: false,
      allowedTypes: ["mcq_single", "true_false_multi", "table_grid"],
      domains: [
        { name: "Penalaran Induktif", weight: 0.34, skills: ["Pola bilangan & gambar", "Generalisasi", "Analogi", "Sebab-akibat"] },
        { name: "Penalaran Deduktif", weight: 0.33, skills: ["Silogisme", "Implikasi & kontraposisi", "Penarikan kesimpulan", "Argumen valid/tidak valid"] },
        { name: "Penalaran Kuantitatif", weight: 0.33, skills: ["Baca grafik & tabel", "Perbandingan kuantitas", "Estimasi", "Pola aritmetika"] },
      ],
    },
    {
      code: "utbk_ppu", name: "Pengetahuan dan Pemahaman Umum",
      durationSec: 15 * M, questionCount: 20, calculatorAllowed: false,
      allowedTypes: ["mcq_single", "true_false_multi"],
      domains: [
        { name: "Kemampuan Verbal", weight: 0.4, skills: ["Sinonim & antonim", "Makna kata dalam konteks", "Analogi kata", "Idiom"] },
        { name: "Pemahaman Wacana", weight: 0.35, skills: ["Ide pokok", "Simpulan", "Informasi tersurat/tersirat"] },
        { name: "Pengetahuan Kebahasaan", weight: 0.25, skills: ["Kalimat efektif", "Ejaan & PUEBI", "Kata baku"] },
      ],
    },
    {
      code: "utbk_pbm", name: "Kemampuan Memahami Bacaan dan Menulis",
      durationSec: 25 * M, questionCount: 20, calculatorAllowed: false,
      allowedTypes: ["mcq_single", "dropdown_inline"],
      domains: [
        { name: "Memahami Bacaan", weight: 0.5, skills: ["Gagasan utama paragraf", "Hubungan antarparagraf", "Simpulan bacaan", "Tujuan penulis"] },
        { name: "Kemampuan Menulis", weight: 0.5, skills: ["Penyuntingan kata", "Penyuntingan kalimat", "Konjungsi & transisi", "Struktur paragraf"] },
      ],
    },
    {
      code: "utbk_pk", name: "Pengetahuan Kuantitatif",
      durationSec: 20 * M, questionCount: 20, calculatorAllowed: false, formulaSheet: "utbk_math",
      allowedTypes: ["mcq_single", "spr_numeric", "true_false_multi"],
      domains: [
        { name: "Bilangan", weight: 0.2, skills: ["Operasi & sifat bilangan", "Perbandingan", "Persen", "Barisan"] },
        { name: "Aljabar & Fungsi", weight: 0.3, skills: ["Persamaan & pertidaksamaan", "Fungsi & grafik", "SPLDV", "Eksponen & logaritma"] },
        { name: "Geometri & Pengukuran", weight: 0.25, skills: ["Bangun datar", "Bangun ruang", "Trigonometri dasar", "Koordinat"] },
        { name: "Data & Ketidakpastian", weight: 0.25, skills: ["Statistika deskriptif", "Peluang", "Penyajian data"] },
      ],
    },
    {
      code: "utbk_lbi", name: "Literasi dalam Bahasa Indonesia",
      durationSec: 45 * M, questionCount: 30, calculatorAllowed: false,
      allowedTypes: ["mcq_single", "true_false_multi", "table_grid"],
      domains: [
        { name: "Teks Informasi", weight: 0.5, skills: ["Menemukan informasi", "Menginterpretasi & mengintegrasi", "Mengevaluasi & merefleksi"] },
        { name: "Teks Sastra", weight: 0.5, skills: ["Menemukan informasi", "Menginterpretasi & mengintegrasi", "Mengevaluasi & merefleksi"] },
      ],
    },
    {
      code: "utbk_lbe", name: "Literasi dalam Bahasa Inggris",
      durationSec: 20 * M, questionCount: 20, calculatorAllowed: false,
      allowedTypes: ["mcq_single", "true_false_multi"],
      domains: [
        { name: "Informational Text", weight: 0.6, skills: ["Locating information", "Interpreting & integrating", "Evaluating & reflecting"] },
        { name: "Literary Text", weight: 0.4, skills: ["Locating information", "Interpreting & integrating", "Evaluating & reflecting"] },
      ],
    },
    {
      code: "utbk_pm", name: "Penalaran Matematika",
      durationSec: 40 * M, questionCount: 20, calculatorAllowed: false, formulaSheet: "utbk_math",
      allowedTypes: ["mcq_single", "spr_numeric", "true_false_multi", "table_grid"],
      domains: [
        { name: "Bilangan", weight: 0.2, skills: ["Representasi bilangan", "Operasi kontekstual", "Rasio & proporsi"] },
        { name: "Aljabar", weight: 0.3, skills: ["Pemodelan persamaan", "Fungsi kontekstual", "Sistem persamaan"] },
        { name: "Geometri dan Pengukuran", weight: 0.25, skills: ["Bangun & volume kontekstual", "Skala & denah", "Trigonometri terapan"] },
        { name: "Data dan Ketidakpastian", weight: 0.25, skills: ["Analisis data nyata", "Peluang kontekstual", "Inferensi sederhana"] },
      ],
    },
  ],
};

/* CSCA - China Scholastic Competency Assessment.
 * Diselenggarakan China Scholarship Council; wajib untuk pendaftaran beasiswa
 * CSC mulai intake 2026. Angka di bawah terverifikasi dari instruksi resmi
 * universitas penyelenggara dan silabus resmi edisi 2025 - lihat
 * src/lib/exams/reference.ts untuk sumber dan tanggal verifikasinya.
 *
 * Lima mata uji, SELURUHNYA pilihan ganda, 100 poin per mata uji. Peserta
 * hanya mengambil mata uji yang diwajibkan program studinya, jadi "total"
 * di sini adalah RATA-RATA mata uji yang diambil, bukan jumlahnya. */
export const CSCA: ExamBlueprint = {
  code: "CSCA",
  name: "CSCA - China Scholastic Competency Assessment",
  tagline: "5 mata uji pilihan ganda - English / 中文",
  locales: ["en", "zh"],
  totalDurationSec: 0,                       // bergantung kombinasi mata uji
  scoring: { kind: "csca_scaled", perSectionRange: [0, 100], totalRange: [0, 100] },
  sections: [
    {
      code: "csca_math", name: "Mathematics 数学",
      durationSec: 60 * M, questionCount: 48, calculatorAllowed: false, formulaSheet: "csca_math",
      allowedTypes: ["mcq_single"],
      domains: [
        { name: "Sets & Inequalities 集合与不等式", weight: 0.15, skills: [
          "Set operations 集合运算", "Quadratic inequalities 一元二次不等式", "Rational inequalities 分式不等式",
        ] },
        { name: "Functions 函数", weight: 0.35, skills: [
          "Domain and range 定义域与值域", "Monotonicity 单调性", "Parity 奇偶性",
          "Power functions 幂函数", "Exponential functions 指数函数", "Logarithmic functions 对数函数",
          "Trigonometric functions 三角函数", "Arithmetic sequences 等差数列", "Geometric sequences 等比数列",
          "Basics of derivatives 导数基础", "Basics of calculus 微积分基础",
        ] },
        { name: "Geometry & Algebra 几何与代数", weight: 0.30, skills: [
          "Lines 直线", "Circles 圆", "Ellipses 椭圆", "Hyperbolas 双曲线", "Parabolas 抛物线",
          "Vectors 向量", "Complex numbers 复数", "Solid geometry with space coordinates 立体几何与空间坐标",
        ] },
        { name: "Probability & Statistics 概率统计", weight: 0.20, skills: [
          "Classical probability 古典概型", "Mean 平均数", "Variance 方差", "Normal distribution 正态分布",
        ] },
      ],
    },
    {
      code: "csca_physics", name: "Physics 物理",
      durationSec: 60 * M, questionCount: 48, calculatorAllowed: false, formulaSheet: "csca_physics",
      allowedTypes: ["mcq_single"],
      domains: [
        { name: "Mechanics 力学", weight: 0.35, skills: [
          "Velocity and acceleration 速度与加速度", "Newton's laws 牛顿定律",
          "Momentum and impulse 动量与冲量", "Work and energy 功与能",
          "Circular motion 圆周运动", "Simple harmonic motion 简谐运动",
        ] },
        { name: "Electromagnetism 电磁学", weight: 0.30, skills: [
          "Coulomb's law 库仑定律", "Ohm's law 欧姆定律", "Magnetic induction 磁感应",
          "Lorentz force 洛伦兹力", "Faraday's law 法拉第定律", "Lenz's law 楞次定律",
        ] },
        { name: "Thermodynamics 热学", weight: 0.15, skills: [
          "Molecular theory 分子动理论", "Ideal gas equation 理想气体状态方程",
          "First law of thermodynamics 热力学第一定律",
        ] },
        { name: "Optics 光学", weight: 0.10, skills: [
          "Reflection 反射", "Refraction 折射", "Interference 干涉", "Diffraction 衍射",
        ] },
        { name: "Modern Physics 近代物理", weight: 0.10, skills: [
          "Photoelectric effect 光电效应", "Atomic structure 原子结构", "Nuclear physics 原子核物理",
        ] },
      ],
    },
    {
      code: "csca_chemistry", name: "Chemistry 化学",
      durationSec: 60 * M, questionCount: 48, calculatorAllowed: false, formulaSheet: "csca_chemistry",
      allowedTypes: ["mcq_single"],
      domains: [
        { name: "Basic Concepts 基本概念", weight: 0.25, skills: [
          "State changes 状态变化", "Chemical equations 化学方程式",
          "Solution pH and concentration 溶液pH与浓度", "Ideal gas law 理想气体定律",
        ] },
        { name: "Properties & Reactions 性质与反应", weight: 0.30, skills: [
          "Acids, bases and salts 酸碱盐", "Metals 金属", "Hydrocarbons 烃",
          "Redox reactions 氧化还原反应", "Ion reactions 离子反应",
        ] },
        { name: "Theory 理论", weight: 0.30, skills: [
          "Periodic trends 元素周期律", "Chemical bonds 化学键", "Intermolecular forces 分子间作用力",
          "Reaction rates 反应速率", "Chemical equilibrium 化学平衡", "Electrochemistry 电化学",
        ] },
        { name: "Experiments 实验", weight: 0.15, skills: [
          "Lab safety 实验安全", "Gas identification 气体检验", "Purification methods 提纯方法",
        ] },
      ],
    },
    {
      code: "csca_chinese_stem", name: "STEM Chinese 理科中文",
      durationSec: 90 * M, questionCount: 80, calculatorAllowed: false,
      allowedTypes: ["mcq_single"],
      domains: [
        { name: "Academic Vocabulary 学术词汇", weight: 0.30, skills: [
          "Mathematical symbols 数学符号", "Physics terminology 物理术语", "Chemistry terminology 化学术语",
        ] },
        { name: "Scientific Reading 科技文阅读", weight: 0.45, skills: [
          "Lab operation texts 实验操作", "Data chart interpretation 图表解读", "Technical passage comprehension 科技文理解",
        ] },
        { name: "Language Use 语言运用", weight: 0.25, skills: [
          "Character recognition 汉字识别", "Vocabulary fill-in-the-blank 词语填空", "Paragraph completion 语段补全",
        ] },
      ],
    },
    {
      code: "csca_chinese_hum", name: "Humanities Chinese 文科中文",
      durationSec: 90 * M, questionCount: 80, calculatorAllowed: false,
      allowedTypes: ["mcq_single"],
      domains: [
        { name: "Academic Vocabulary 学术词汇", weight: 0.30, skills: [
          "Literary terminology 文学术语", "Philosophy terminology 哲学术语", "Legal terminology 法律术语",
        ] },
        { name: "Humanities Reading 文科文阅读", weight: 0.45, skills: [
          "History texts 历史", "Education texts 教育", "Politics texts 政治", "Literature passages 文学作品",
        ] },
        { name: "Language Use 语言运用", weight: 0.25, skills: [
          "Character recognition 汉字识别", "Vocabulary fill-in-the-blank 词语填空", "Paragraph completion 语段补全",
        ] },
      ],
    },
  ],
};

export const ALEVEL: ExamBlueprint = {
  code: "ALEVEL",
  name: "Cambridge A Level",
  tagline: "Per-paper, mark scheme & grade boundary",
  locales: ["en"],
  totalDurationSec: 0,
  scoring: { kind: "alevel_grade", perSectionRange: [0, 100], totalRange: [0, 100] },
  sections: [
    {
      code: "al_math_p1", name: "9709 Paper 1 — Pure Mathematics 1",
      durationSec: 110 * M, questionCount: 11, marks: 75, calculatorAllowed: true, formulaSheet: "alevel_mf19",
      allowedTypes: ["spr_numeric", "numeric_multi", "essay_rubric", "short_text"],
      domains: [
        { name: "Quadratics", weight: 0.12, skills: ["Completing the square", "Discriminant", "Quadratic inequalities"] },
        { name: "Functions", weight: 0.15, skills: ["Domain & range", "Composite & inverse", "Transformations"] },
        { name: "Coordinate geometry", weight: 0.13, skills: ["Straight lines", "Circles", "Intersections"] },
        { name: "Circular measure", weight: 0.1, skills: ["Radians", "Arc length & sector area"] },
        { name: "Trigonometry", weight: 0.15, skills: ["Graphs", "Identities", "Equations"] },
        { name: "Series", weight: 0.12, skills: ["Binomial expansion", "AP", "GP"] },
        { name: "Differentiation", weight: 0.13, skills: ["Chain rule", "Stationary points", "Rates of change"] },
        { name: "Integration", weight: 0.1, skills: ["Definite integrals", "Area under curve", "Volume of revolution"] },
      ],
    },
    {
      // Terverifikasi dari silabus resmi 9702 untuk 2025-2027: 60 mark, 1 jam 15 menit,
      // 46% dari AS Level dan 23% dari A Level.
      code: "al_phys_p2", name: "9702 Paper 2 — AS Level Structured Questions",
      durationSec: 75 * M, questionCount: 8, marks: 60, calculatorAllowed: true, formulaSheet: "alevel_physics",
      allowedTypes: ["numeric_multi", "spr_numeric", "essay_rubric", "short_text"],
      domains: [
        { name: "Measurement", weight: 0.1, skills: ["SI units", "Uncertainties", "Scalars & vectors"] },
        { name: "Kinematics & Dynamics", weight: 0.25, skills: ["Motion graphs", "Newton's laws", "Momentum"] },
        { name: "Forces & Energy", weight: 0.2, skills: ["Moments", "Work-energy", "Density & pressure"] },
        { name: "Waves", weight: 0.2, skills: ["Progressive waves", "Superposition", "Diffraction"] },
        { name: "Electricity", weight: 0.25, skills: ["Current & p.d.", "Resistance", "D.C. circuits"] },
      ],
    },
    {
      code: "al_chem_p1", name: "9701 Paper 1 — Multiple Choice",
      durationSec: 75 * M, questionCount: 40, marks: 40, calculatorAllowed: true, formulaSheet: "alevel_chem",
      allowedTypes: ["mcq_single"],
      domains: [
        { name: "Physical Chemistry", weight: 0.4, skills: ["Atomic structure", "Moles & stoichiometry", "Energetics", "Equilibria", "Kinetics"] },
        { name: "Inorganic Chemistry", weight: 0.25, skills: ["Periodicity", "Group 2", "Group 17", "Nitrogen & sulfur"] },
        { name: "Organic Chemistry", weight: 0.35, skills: ["Hydrocarbons", "Halogenoalkanes", "Alcohols", "Carbonyls", "Analytical techniques"] },
      ],
    },
    {
      code: "al_econ_p2", name: "9708 Paper 2 — Data Response and Essays",
      durationSec: 90 * M, questionCount: 4, marks: 40, calculatorAllowed: false,
      allowedTypes: ["essay_rubric", "mcq_single"],
      domains: [
        { name: "Microeconomics", weight: 0.5, skills: ["Price mechanism", "Elasticity", "Market failure", "Firm behaviour"] },
        { name: "Macroeconomics", weight: 0.5, skills: ["AD/AS", "Policy", "Trade & exchange rates", "Growth & development"] },
      ],
    },
  ],
};


/* =========================================================================
 * TKA — Tes Kemampuan Akademik (Kemendikdasmen)
 *
 * Susunan mata pelajaran di bawah ini MENGIKUTI KEPUTUSAN PEMILIK PRODUK,
 * bukan salinan resmi POS: TKA SMA disiapkan untuk tiga mapel wajib ditambah
 * paket saintek, dan TKA SMP untuk dua mapel wajib. Bila ketentuan resmi di
 * daerah berbeda, yang perlu diubah hanya daftar `sections` di sini —
 * validator, komposer form, dan skoring semuanya membaca dari blueprint.
 *
 * Skoring memakai `tka_scaled`: 0–100 per mata pelajaran, dan angka gabungan
 * adalah RATA-RATA mata pelajaran yang benar-benar dikerjakan. Menjumlahkan
 * akan menghukum peserta yang hanya mengambil mapel wajib. Alasannya sama
 * dengan CSCA, dan dipisahkan sebagai jenis tersendiri supaya kurva TKA bisa
 * disetel tanpa ikut menggeser CSCA.
 * ========================================================================= */

export const TKA_SMP: ExamBlueprint = {
  code: "TKA_SMP",
  name: "TKA SMP — Tes Kemampuan Akademik",
  tagline: "Bahasa Indonesia & Matematika, per mata pelajaran",
  locales: ["id"],
  totalDurationSec: 135 * M,
  scoring: { kind: "tka_scaled", perSectionRange: [0, 100], totalRange: [0, 100] },
  sections: [
    {
      code: "tka_smp_bind", name: "Bahasa Indonesia", nameId: "Bahasa Indonesia",
      durationSec: 60 * M, questionCount: 30, calculatorAllowed: false,
      allowedTypes: ["mcq_single", "true_false_multi"],
      domains: [
        { name: "Membaca Teks Informasi", weight: 0.4, skills: [
          "Menemukan informasi", "Menyimpulkan isi", "Menafsirkan makna", "Mengevaluasi argumen",
        ] },
        { name: "Membaca Teks Sastra", weight: 0.3, skills: [
          "Unsur intrinsik", "Makna tersirat", "Amanat & nilai", "Gaya bahasa",
        ] },
        { name: "Kebahasaan dan Menulis", weight: 0.3, skills: [
          "Kalimat efektif", "Ejaan & tanda baca", "Kata baku & makna kata", "Kepaduan paragraf",
        ] },
      ],
    },
    {
      code: "tka_smp_mtk", name: "Matematika", nameId: "Matematika",
      durationSec: 75 * M, questionCount: 25, calculatorAllowed: false,
      formulaSheet: "utbk_math",
      allowedTypes: ["mcq_single", "spr_numeric", "true_false_multi"],
      domains: [
        { name: "Bilangan", weight: 0.25, skills: [
          "Operasi bilangan bulat & pecahan", "Perbandingan & skala", "Persen", "Pola bilangan",
        ] },
        { name: "Aljabar", weight: 0.3, skills: [
          "Bentuk aljabar", "Persamaan & pertidaksamaan linear", "Relasi & fungsi", "SPLDV",
        ] },
        { name: "Geometri dan Pengukuran", weight: 0.25, skills: [
          "Bangun datar", "Bangun ruang", "Teorema Pythagoras", "Kesebangunan & kekongruenan",
        ] },
        { name: "Data dan Peluang", weight: 0.2, skills: [
          "Penyajian data", "Ukuran pemusatan", "Peluang sederhana",
        ] },
      ],
    },
  ],
};

export const TKA_SMA: ExamBlueprint = {
  code: "TKA_SMA",
  name: "TKA SMA — Tes Kemampuan Akademik",
  tagline: "3 mapel wajib + paket saintek",
  locales: ["id"],
  totalDurationSec: 0,                       // bergantung kombinasi mapel
  scoring: { kind: "tka_scaled", perSectionRange: [0, 100], totalRange: [0, 100] },
  sections: [
    {
      code: "tka_sma_bind", name: "Bahasa Indonesia", nameId: "Bahasa Indonesia",
      durationSec: 60 * M, questionCount: 30, calculatorAllowed: false,
      allowedTypes: ["mcq_single", "true_false_multi"],
      domains: [
        { name: "Teks Informasi", weight: 0.4, skills: [
          "Menemukan informasi", "Menyimpulkan isi", "Menafsirkan makna", "Mengevaluasi argumen",
        ] },
        { name: "Teks Sastra", weight: 0.3, skills: [
          "Unsur intrinsik", "Makna tersirat", "Amanat & nilai", "Gaya bahasa",
        ] },
        { name: "Kebahasaan dan Menulis", weight: 0.3, skills: [
          "Kalimat efektif", "Ejaan & tanda baca", "Diksi & makna kata", "Struktur paragraf",
        ] },
      ],
    },
    {
      code: "tka_sma_mtk", name: "Matematika", nameId: "Matematika",
      durationSec: 90 * M, questionCount: 25, calculatorAllowed: false,
      formulaSheet: "utbk_math",
      allowedTypes: ["mcq_single", "spr_numeric", "true_false_multi"],
      domains: [
        { name: "Bilangan dan Aljabar", weight: 0.4, skills: [
          "Eksponen & logaritma", "Persamaan & pertidaksamaan", "Fungsi & grafik", "Barisan & deret",
        ] },
        { name: "Geometri dan Trigonometri", weight: 0.25, skills: [
          "Trigonometri", "Dimensi tiga", "Geometri analitik",
        ] },
        { name: "Kalkulus", weight: 0.15, skills: [
          "Limit", "Turunan", "Penerapan turunan",
        ] },
        { name: "Statistika dan Peluang", weight: 0.2, skills: [
          "Statistika deskriptif", "Kaidah pencacahan", "Peluang",
        ] },
      ],
    },
    {
      code: "tka_sma_bing", name: "Bahasa Inggris", nameId: "Bahasa Inggris",
      durationSec: 45 * M, questionCount: 25, calculatorAllowed: false,
      allowedTypes: ["mcq_single", "true_false_multi"],
      domains: [
        { name: "Reading Comprehension", weight: 0.5, skills: [
          "Main idea", "Detail & reference", "Inference", "Vocabulary in context",
        ] },
        { name: "Text Structure and Purpose", weight: 0.25, skills: [
          "Genre & purpose", "Rhetorical function", "Cohesion",
        ] },
        { name: "Language Use", weight: 0.25, skills: [
          "Tenses & agreement", "Word form", "Prepositions & connectors",
        ] },
      ],
    },
    {
      code: "tka_sma_fis", name: "Fisika", nameId: "Fisika",
      durationSec: 60 * M, questionCount: 20, calculatorAllowed: false,
      formulaSheet: "utbk_math",
      allowedTypes: ["mcq_single", "spr_numeric", "true_false_multi"],
      domains: [
        { name: "Mekanika", weight: 0.35, skills: [
          "Kinematika", "Dinamika & hukum Newton", "Usaha & energi", "Momentum & impuls",
        ] },
        { name: "Fluida, Suhu, dan Kalor", weight: 0.2, skills: [
          "Fluida statis", "Fluida dinamis", "Suhu & pemuaian", "Kalor & perpindahannya",
        ] },
        { name: "Gelombang dan Optik", weight: 0.2, skills: [
          "Getaran & gelombang", "Bunyi", "Optik geometri",
        ] },
        { name: "Listrik dan Magnet", weight: 0.25, skills: [
          "Listrik statis", "Rangkaian arus searah", "Kemagnetan & induksi",
        ] },
      ],
    },
    {
      code: "tka_sma_kim", name: "Kimia", nameId: "Kimia",
      durationSec: 60 * M, questionCount: 20, calculatorAllowed: false,
      allowedTypes: ["mcq_single", "spr_numeric", "true_false_multi"],
      domains: [
        { name: "Struktur Atom dan Ikatan", weight: 0.25, skills: [
          "Struktur atom", "Sistem periodik", "Ikatan kimia", "Bentuk molekul",
        ] },
        { name: "Stoikiometri dan Larutan", weight: 0.35, skills: [
          "Konsep mol & stoikiometri", "Konsentrasi larutan", "Asam basa & pH", "Titrasi",
        ] },
        { name: "Termokimia, Laju, dan Kesetimbangan", weight: 0.25, skills: [
          "Termokimia", "Laju reaksi", "Kesetimbangan kimia",
        ] },
        { name: "Kimia Organik dan Elektrokimia", weight: 0.15, skills: [
          "Hidrokarbon & gugus fungsi", "Redoks", "Sel elektrokimia",
        ] },
      ],
    },
    {
      code: "tka_sma_bio", name: "Biologi", nameId: "Biologi",
      durationSec: 60 * M, questionCount: 20, calculatorAllowed: false,
      allowedTypes: ["mcq_single", "true_false_multi"],
      domains: [
        { name: "Biologi Sel dan Metabolisme", weight: 0.3, skills: [
          "Struktur & fungsi sel", "Transpor membran", "Enzim", "Respirasi & fotosintesis",
        ] },
        { name: "Genetika dan Evolusi", weight: 0.3, skills: [
          "Materi genetik", "Sintesis protein", "Pewarisan sifat", "Mekanisme evolusi",
        ] },
        { name: "Sistem Organ dan Fisiologi", weight: 0.25, skills: [
          "Sistem pencernaan", "Sistem peredaran darah", "Sistem saraf & hormon", "Sistem imun",
        ] },
        { name: "Ekologi dan Keanekaragaman", weight: 0.15, skills: [
          "Ekosistem & aliran energi", "Keanekaragaman hayati", "Klasifikasi makhluk hidup",
        ] },
      ],
    },
  ],
};

/* =========================================================================
 * LATIHAN — paket latihan bimbel (Exact Practice)
 *
 * Bukan ujian resmi: soalnya dibuat guru lewat Exact Worksheet atau disusun
 * dari bank, satu section, durasi ditetapkan per paket saat attempt dibuat
 * (formLayout dibekukan seperti try out lain). Skalanya tka_scaled supaya
 * nilainya 0–100 dan dibaca murid sebagai persentase benar.
 * ========================================================================= */
export const LATIHAN: ExamBlueprint = {
  code: "LATIHAN",
  name: "Latihan",
  tagline: "Paket latihan dari guru — bisa dicetak, bisa dikerjakan online",
  locales: ["id", "en"],
  totalDurationSec: 30 * M,
  scoring: { kind: "tka_scaled", perSectionRange: [0, 100], totalRange: [0, 100] },
  sections: [
    {
      code: "latihan", name: "Latihan", nameId: "Latihan",
      durationSec: 30 * M, questionCount: 10, calculatorAllowed: true,
      allowedTypes: ["mcq_single", "spr_numeric", "short_text"],
      domains: [{ name: "Umum", weight: 1, skills: ["Latihan"] }],
    },
  ],
};

export const BLUEPRINTS = { SAT, UTBK, CSCA, ALEVEL, TKA_SMP, TKA_SMA, LATIHAN } as const;
export const EXAM_LIST = [SAT, UTBK, CSCA, ALEVEL, TKA_SMP, TKA_SMA];

export function getBlueprint(code: string): ExamBlueprint | undefined {
  return (BLUEPRINTS as Record<string, ExamBlueprint>)[code];
}
export function getSection(examCode: string, sectionCode: string) {
  return getBlueprint(examCode)?.sections.find((s) => s.code === sectionCode);
}
