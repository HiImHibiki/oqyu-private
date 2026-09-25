/* =========================================================================
 * Exact Practice — Skema Data Inti
 * File ini adalah "kontrak" antara:
 *   (1) prompt AI penghasil soal  -> lihat /prompts
 *   (2) validator ingest          -> src/lib/exams/validate.ts
 *   (3) renderer soal di ujian    -> src/components/exam
 * Perubahan di sini WAJIB diikuti perubahan di /prompts/_schema/question.schema.json
 * ========================================================================= */

export type ExamCode = "SAT" | "CSCA" | "UTBK" | "ALEVEL" | "TKA_SMP" | "TKA_SMA" | "LATIHAN";
export type Difficulty = "E" | "M" | "H";
export type Locale = "en" | "id" | "zh";

/* ---------------------------------- Figur -------------------------------- */

export type Figure =
  | FunctionPlot
  | ScatterPlot
  | BarChart
  | LineChart
  | Histogram
  | PieChart
  | BoxPlot
  | NumberLine
  | GeometryFigure
  | TableFigure
  | CircuitFigure
  | ImageFigure;

export interface FigureBase {
  caption?: string;
  /** Deskripsi teks untuk screen reader — WAJIB diisi oleh AI (aksesibilitas + fallback). */
  alt: string;
  width?: number;
  height?: number;
}

export interface FunctionPlot extends FigureBase {
  kind: "function_plot";
  /** Ekspresi gaya JavaScript/ASCIIMath: "x^2 - 3*x + 2", "sin(x)", "abs(x-1)" */
  series: { expr: string; label?: string; color?: string; dashed?: boolean; domain?: [number, number] }[];
  window: { xmin: number; xmax: number; ymin: number; ymax: number };
  grid?: boolean;
  xLabel?: string;
  yLabel?: string;
  points?: { x: number; y: number; label?: string; open?: boolean }[];
  /** Garis vertikal/horizontal bantu (asimtot dsb.) */
  asymptotes?: { axis: "x" | "y"; at: number; dashed?: boolean }[];
}

export interface ScatterPlot extends FigureBase {
  kind: "scatter";
  points: { x: number; y: number; label?: string }[];
  window?: { xmin: number; xmax: number; ymin: number; ymax: number };
  trendline?: { expr: string; label?: string };
  xLabel?: string;
  yLabel?: string;
}

export interface BarChart extends FigureBase {
  kind: "bar_chart";
  categories: string[];
  series: { name: string; values: number[]; color?: string }[];
  stacked?: boolean;
  horizontal?: boolean;
  xLabel?: string;
  yLabel?: string;
}

export interface LineChart extends FigureBase {
  kind: "line_chart";
  categories: (string | number)[];
  series: { name: string; values: (number | null)[]; color?: string }[];
  xLabel?: string;
  yLabel?: string;
}

export interface Histogram extends FigureBase {
  kind: "histogram";
  bins: { from: number; to: number; count: number }[];
  xLabel?: string;
  yLabel?: string;
}

export interface PieChart extends FigureBase {
  kind: "pie_chart";
  slices: { label: string; value: number; color?: string }[];
  donut?: boolean;
}

export interface BoxPlot extends FigureBase {
  kind: "box_plot";
  groups: { label: string; min: number; q1: number; median: number; q3: number; max: number; outliers?: number[] }[];
  yLabel?: string;
}

export interface NumberLine extends FigureBase {
  kind: "number_line";
  min: number;
  max: number;
  step: number;
  marks?: { at: number; label?: string; filled?: boolean }[];
  intervals?: { from: number; to: number; closedLeft?: boolean; closedRight?: boolean; color?: string }[];
}

/** Geometri bebas: dipakai untuk bangun datar/ruang, diagram fisika, vektor, lingkaran satuan. */
export interface GeometryFigure extends FigureBase {
  kind: "geometry";
  viewBox: [number, number, number, number];
  elements: GeoElement[];
}
export type GeoElement =
  | { t: "polygon"; points: [number, number][]; fill?: string; stroke?: string; dashed?: boolean }
  | { t: "line"; from: [number, number]; to: [number, number]; stroke?: string; dashed?: boolean; arrow?: boolean }
  | { t: "circle"; c: [number, number]; r: number; fill?: string; stroke?: string; dashed?: boolean }
  | { t: "arc"; c: [number, number]; r: number; start: number; end: number; stroke?: string }
  | { t: "point"; at: [number, number]; label?: string; filled?: boolean }
  | { t: "label"; at: [number, number]; text: string; size?: number; anchor?: "start" | "middle" | "end" }
  | { t: "angle"; at: [number, number]; from: [number, number]; to: [number, number]; label?: string; right?: boolean }
  | { t: "tick"; on: [[number, number], [number, number]]; count?: number };

export interface TableFigure extends FigureBase {
  kind: "table";
  headers: string[];
  rows: (string | number)[][];
  /** Baris/kolom yang ditebalkan (mis. baris total) */
  emphasizeRows?: number[];
}

export interface CircuitFigure extends FigureBase {
  kind: "circuit";
  /** Notasi ringkas: [{c:"battery", from:"A", to:"B", label:"12 V"}, ...] */
  nodes: { id: string; at: [number, number] }[];
  components: { c: "battery" | "resistor" | "capacitor" | "switch" | "lamp" | "ammeter" | "voltmeter" | "wire"; from: string; to: string; label?: string }[];
}

export interface ImageFigure extends FigureBase {
  kind: "image";
  src: string;
}

/* --------------------------------- Stimulus ------------------------------ */

export interface Stimulus {
  type: "passage" | "dual_passage" | "text" | "quote" | "notes" | "audio";
  title?: string;
  /** Markdown. Untuk dual_passage pisahkan dengan "\n---\n" */
  content: string;
  source?: string;
  wordCount?: number;
  /** Nomor baris ditampilkan tiap N baris (gaya SAT lama / A-Level). 0 = mati. */
  lineNumbering?: number;
}

/* --------------------------------- Jawaban ------------------------------- */

export type QuestionType =
  | "mcq_single"       // pilihan ganda 1 jawaban (SAT 4 opsi, UTBK/CSCA 5 opsi)
  | "mcq_multi"        // pilih beberapa (jumlah ditentukan)
  | "spr_numeric"      // Student-Produced Response / isian angka (SAT grid-in, UTBK isian)
  | "numeric_multi"    // beberapa kotak isian angka
  | "short_text"       // isian teks pendek (istilah, kata, karakter Han)
  | "true_false_multi" // daftar pernyataan Benar/Salah (khas UTBK & CSCA)
  | "table_grid"       // matriks centang (pernyataan x kategori)
  | "matching"         // menjodohkan kiri-kanan
  | "ordering"         // mengurutkan
  | "dropdown_inline"  // cloze dengan dropdown di dalam kalimat
  | "graph_plot"       // siswa memplot titik/garis pada bidang koordinat (gaya ALEKS)
  | "essay_rubric";    // uraian, dinilai rubrik / AI

export interface Choice {
  id: string;          // "A" | "B" | ... (SAT) atau "1".."5"
  text: string;        // markdown + LaTeX inline $...$
  figure?: Figure;     // opsi bisa berupa grafik
}

export type Answer =
  | { mode: "choice"; value: string }                                   // mcq_single
  | { mode: "choice_set"; value: string[]; selectCount: number }         // mcq_multi
  | { mode: "numeric"; value: number; tolerance?: number; acceptedForms?: string[]; unit?: string }
  | { mode: "numeric_range"; min: number; max: number; unit?: string }
  | { mode: "numeric_list"; values: { key: string; value: number; tolerance?: number }[] }
  | { mode: "text"; accepted: string[]; caseSensitive?: boolean; ignoreDiacritics?: boolean }
  | { mode: "boolean_list"; values: boolean[] }
  | { mode: "grid"; values: Record<string, string> }                     // rowId -> colId
  | { mode: "pairs"; values: Record<string, string> }                    // leftId -> rightId
  | { mode: "sequence"; values: string[] }
  | { mode: "dropdowns"; values: Record<string, string> }                // blankId -> choiceId
  | { mode: "plot"; expect: { points?: [number, number][]; line?: { m: number; b: number } }; tolerance?: number }
  | { mode: "rubric"; rubric: { criterion: string; points: number; descriptor: string }[]; exemplar: string };

/* --------------------------------- Soal ---------------------------------- */

export interface Question {
  id: string;
  exam: ExamCode;
  /** kode section, mis. "sat_math", "utbk_pu", "csca_math_zh", "alevel_p1" */
  section: string;
  /** domain konten resmi, mis. "Algebra", "Penalaran Kuantitatif" */
  domain: string;
  /** skill spesifik, mis. "Linear equations in one variable" */
  skill: string;
  difficulty: Difficulty;
  /** Estimasi IRT (b-parameter, -3..3). Diisi AI sebagai tebakan awal, dikalibrasi ulang dari data. */
  irtB?: number;
  calculatorAllowed: boolean;
  locale: Locale;
  /** Terjemahan penuh untuk ujian bilingual (CSCA: en + zh) */
  i18n?: Partial<Record<Locale, Pick<Question, "stem" | "explanation"> & { stimulus?: Stimulus; choices?: Choice[] }>>;

  stimulus?: Stimulus;
  figure?: Figure;
  stem: string;
  type: QuestionType;

  choices?: Choice[];
  /** untuk table_grid */
  gridRows?: { id: string; text: string }[];
  gridCols?: { id: string; text: string }[];
  /** untuk matching */
  left?: { id: string; text: string }[];
  right?: { id: string; text: string }[];
  /** untuk dropdown_inline: stem memakai token {{b1}}, {{b2}} */
  blanks?: { id: string; options: Choice[] }[];
  /** untuk numeric_multi: stem memakai token {{n1}} */
  numericBlanks?: { id: string; label?: string; unit?: string }[];
  /** untuk true_false_multi */
  statements?: { id: string; text: string }[];
  /** untuk graph_plot */
  plotConfig?: { window: FunctionPlot["window"]; mode: "points" | "line" | "both"; snap?: number };

  answer: Answer;
  explanation: string;
  /** Petunjuk bertingkat, dipakai di mode Latihan (bukan mode Ujian). */
  hints?: string[];
  /** Distraktor analysis: kenapa siswa memilih opsi salah tertentu. key = choice id */
  distractorRationale?: Record<string, string>;
  /** Rumus dari formula sheet yang relevan (id dari src/lib/exams/formulas.ts) */
  formulaRefs?: string[];
  tags: string[];
  estimatedTimeSec: number;
  points: number;
  /** Metadata provenance untuk audit soal AI */
  meta?: { generator?: string; model?: string; reviewed?: boolean; reviewer?: string; version?: number };
}

/* ------------------------- Struktur Paket & Ujian ------------------------ */

export interface SectionBlueprint {
  code: string;
  name: string;
  nameId?: string;
  durationSec: number;
  questionCount: number;
  calculatorAllowed: boolean;
  formulaSheet?: string;             // id sheet di formulas.ts
  /** Adaptif per-modul (SAT): modul 2 dipilih dari performa modul 1 */
  adaptive?: { module: 1 | 2; routesFrom?: string; threshold?: number };
  breakAfterSec?: number;
  domains: { name: string; weight: number; skills: string[] }[];
  allowedTypes: QuestionType[];
  /** komposisi tipe soal yang ditetapkan ujian, mis. SAT Math: 15 PG + 7 isian */
  typeMix?: { type: QuestionType; count: number; note?: string }[];
  /** total mark paper (dipakai A Level, bukan jumlah soal) */
  marks?: number;
}

export interface ExamBlueprint {
  code: ExamCode;
  name: string;
  tagline: string;
  locales: Locale[];
  totalDurationSec: number;
  sections: SectionBlueprint[];
  scoring: {
    kind: "sat_scaled" | "utbk_irt" | "csca_scaled" | "alevel_grade" | "tka_scaled";
    perSectionRange?: [number, number];
    totalRange?: [number, number];
  };
}

/* --------------------------- Attempt & Response -------------------------- */

export interface ResponseValue {
  questionId: string;
  raw: unknown;                 // bentuk mentah sesuai tipe soal
  flagged: boolean;
  crossedOut?: string[];        // choice id yang dicoret siswa
  timeSpentSec: number;
  visited: boolean;
}

export interface AttemptState {
  attemptId: string;
  packageId: string;
  examCode: ExamCode;
  sectionIndex: number;
  questionIndex: number;
  startedAt: string;
  sectionDeadline: string;
  responses: Record<string, ResponseValue>;
  status: "in_progress" | "submitted" | "expired" | "voided";
  proctor: ProctorLog;
}

export interface ProctorLog {
  tabBlurCount: number;
  fullscreenExitCount: number;
  copyAttempts: number;
  pasteAttempts: number;
  rightClicks: number;
  devtoolsSuspected: number;
  events: { t: string; type: string; detail?: string }[];
  /** 0-100, makin tinggi makin mencurigakan */
  integrityScore: number;
}

/* ------------------------- Susunan paket (form) -------------------------- */

/** Rancangan paket yang DISIMPAN bersama attempt.
 *
 *  Penting: penilaian dan halaman hasil membangun ulang paket dari sini,
 *  bukan dengan menjalankan ulang pemilihan soal. Tanpa ini, mengimpor atau
 *  memensiunkan soal di tengah jalan akan mengubah paket yang sedang
 *  dikerjakan seseorang — dan nilainya jadi salah. */
export interface FormSectionLayout {
  code: string;
  /** Untuk modul adaptif SAT: dua varian disusun sekaligus saat attempt dibuat,
   *  lalu salah satunya dipilih server setelah modul 1 selesai. Keduanya
   *  dibekukan bersama attempt, jadi routing tidak pernah mengambil ulang dari
   *  bank yang sudah berubah. */
  variant?: "easier" | "harder";
  name: string;
  durationSec: number;
  calculatorAllowed: boolean;
  formulaSheet?: string;
  breakAfterSec?: number;
  questionIds: string[];
  /** Latihan Exact Practice: paket asal attempt ini (untuk riwayat & perbaikan). */
  paketId?: string;
  /** Attempt perbaikan: hanya nomor yang masih salah, dikerjakan ulang. */
  perbaikan?: boolean;
  /** Tanpa batas waktu (perbaikan): jam tidak ditampilkan, tidak ada kirim otomatis. */
  tanpaWaktu?: boolean;
  /** Nomor soal di paket asal (perbaikan memuat sebagian soal saja). */
  nomorAsli?: number[];
}
