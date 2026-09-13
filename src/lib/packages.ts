import type { ExamCode } from "@/lib/types";
import { formatMoney, type Currency } from "@/lib/geo";

/* Harga ditetapkan per mata uang, bukan dikonversi dari rupiah dengan kurs.
 * Peserta SAT di Nigeria dan peserta CSCA di Kazakhstan menghadapi pasar yang
 * berbeda dari peserta UTBK di Bandung, dan kurs harian bukan urusan mereka. */

export interface TryoutPackage {
  id: string;
  exam: ExamCode;
  name: string;
  blurb: string;
  attempts: number;
  /* Mata uji yang dicakup paket ini.
   *
   * Kosong berarti SELURUH mata uji ujiannya — itulah bentuk paket yang sudah
   * ada, dan menuliskan daftar lengkapnya di sini hanya akan menjadi salinan
   * blueprint yang bisa ketinggalan zaman.
   *
   * Diisi berarti kuotanya terikat pada mata uji itu saja. Kunci pemisahannya
   * ada di sini, bukan di tabel entitlement: baris entitlement sudah menyimpan
   * `packageId`, jadi cakupannya bisa dibaca ulang kapan saja tanpa kolom baru
   * dan tanpa migrasi — dan tidak ada kemungkinan dua sumber kebenaran yang
   * saling bertentangan. */
  sections?: string[];
  prices: Record<Currency, number>;
  strike?: Record<Currency, number>;
  popular?: boolean;
  /** paket khusus pasar Indonesia — disembunyikan dari pengunjung lain */
  indonesiaOnly?: boolean;
  features: string[];
}

export const PACKAGES: TryoutPackage[] = [
  {
    id: "sat-starter", exam: "SAT", name: "SAT Starter", blurb: "2 full-length adaptive tests",
    attempts: 2,
    prices: { USD: 19, EUR: 18, CNY: 139, IDR: 249_000 },
    strike: { USD: 29, EUR: 27, CNY: 209, IDR: 349_000 },
    features: [
      "2 full-length Digital SAT tests (module-adaptive)",
      "Score 400–1600 with domain breakdown",
      "Worked explanation for every question",
      "Desmos-style calculator and reference sheet",
    ],
  },
  {
    id: "sat-intensive", exam: "SAT", name: "SAT Intensive", blurb: "6 full-length tests plus drills",
    attempts: 6,
    prices: { USD: 45, EUR: 42, CNY: 329, IDR: 599_000 },
    strike: { USD: 69, EUR: 64, CNY: 499, IDR: 899_000 },
    popular: true,
    features: [
      "6 full-length Digital SAT tests",
      "Unlimited skill-level drills",
      "Automatic weakness analysis",
      "Score prediction and target tracker",
      "Global leaderboard",
    ],
  },
  {
    id: "utbk-starter", exam: "UTBK", name: "UTBK Starter", blurb: "3 paket 155 soal",
    attempts: 3,
    prices: { IDR: 149_000, USD: 12, EUR: 11, CNY: 89 },
    strike: { IDR: 199_000, USD: 16, EUR: 15, CNY: 119 },
    indonesiaOnly: true,
    features: [
      "3 try out UTBK-SNBT lengkap (7 subtes)",
      "Skor IRT 0–1000",
      "Pembahasan tiap soal",
      "Rekap per subtes",
    ],
  },
  {
    id: "utbk-pro", exam: "UTBK", name: "UTBK Pro", blurb: "10 paket + peluang kampus",
    attempts: 10,
    prices: { IDR: 349_000, USD: 25, EUR: 23, CNY: 179 },
    strike: { IDR: 549_000, USD: 39, EUR: 36, CNY: 279 },
    popular: true,
    indonesiaOnly: true,
    features: [
      "10 try out UTBK-SNBT lengkap",
      "Skor IRT + estimasi passing grade",
      "Simulasi peluang PTN & prodi",
      "Ranking nasional per subtes",
      "Bank soal drill",
    ],
  },
  {
    id: "csca-standard", exam: "CSCA", name: "CSCA Standard", blurb: "All five subjects · English / 中文",
    attempts: 4,
    prices: { USD: 35, EUR: 32, CNY: 249, IDR: 449_000 },
    strike: { USD: 49, EUR: 45, CNY: 349, IDR: 649_000 },
    popular: true,
    features: [
      "4 full CSCA sittings across all five subjects",
      "Sit all five at once, or pick only the subjects you need",
      "Every question available in English and 中文",
      "100 points per subject with per-subject report",
      "Mathematics, Physics and Chemistry formula sheets",
      "Professional Chinese: academic register, not HSK",
    ],
  },

  /* Paket satu mata uji.
   *
   * Pelamar CSCA jarang menghadapi kelima mata uji: program teknik meminta
   * Matematika dan Fisika, program farmasi meminta Kimia, dan yang sudah
   * lulus HSK tidak perlu mata uji bahasa sama sekali. Menjual satu paket
   * berisi lima mata uji kepada mereka berarti menagih empat mata uji yang
   * tidak akan pernah dibuka.
   *
   * Harganya dihitung per mata uji, bukan seperlima dari paket lengkap:
   * paket lengkap tetap harus lebih murah per mata uji, kalau tidak tidak ada
   * alasan membelinya. */
  {
    id: "csca-math", exam: "CSCA", name: "CSCA Mathematics", blurb: "数学 saja · 48 soal per set",
    attempts: 4, sections: ["csca_math"],
    prices: { USD: 12, EUR: 11, CNY: 89, IDR: 159_000 },
    strike: { USD: 18, EUR: 17, CNY: 129, IDR: 229_000 },
    features: [
      "4 sittings of Mathematics 数学 only, 48 questions each",
      "60 minutes per sitting, score 0–100 at the end of the set",
      "Sets, functions, geometry, probability and statistics",
      "Formula sheet built in",
      "Every question in English and 中文",
    ],
  },
  {
    id: "csca-physics", exam: "CSCA", name: "CSCA Physics", blurb: "物理 saja · 48 soal per set",
    attempts: 4, sections: ["csca_physics"],
    prices: { USD: 12, EUR: 11, CNY: 89, IDR: 159_000 },
    strike: { USD: 18, EUR: 17, CNY: 129, IDR: 229_000 },
    features: [
      "4 sittings of Physics 物理 only, 48 questions each",
      "60 minutes per sitting, score 0–100 at the end of the set",
      "Mechanics, electromagnetism, thermodynamics, optics, modern physics",
      "Formula sheet built in",
      "Every question in English and 中文",
    ],
  },
  {
    id: "csca-chemistry", exam: "CSCA", name: "CSCA Chemistry", blurb: "化学 saja · 48 soal per set",
    attempts: 4, sections: ["csca_chemistry"],
    prices: { USD: 12, EUR: 11, CNY: 89, IDR: 159_000 },
    strike: { USD: 18, EUR: 17, CNY: 129, IDR: 229_000 },
    features: [
      "4 sittings of Chemistry 化学 only, 48 questions each",
      "60 minutes per sitting, score 0–100 at the end of the set",
      "Concepts, properties and reactions, theory, laboratory work",
      "Formula sheet built in",
      "Every question in English and 中文",
    ],
  },
  {
    id: "csca-chinese-stem", exam: "CSCA", name: "CSCA STEM Chinese", blurb: "理科中文 saja · 80 soal per set",
    attempts: 4, sections: ["csca_chinese_stem"],
    prices: { USD: 15, EUR: 14, CNY: 109, IDR: 199_000 },
    strike: { USD: 22, EUR: 20, CNY: 159, IDR: 289_000 },
    features: [
      "4 sittings of STEM Chinese 理科中文 only, 80 questions each",
      "90 minutes per sitting, score 0–100 at the end of the set",
      "Academic vocabulary, scientific reading, language use",
      "Academic register, not HSK",
    ],
  },
  {
    id: "csca-chinese-hum", exam: "CSCA", name: "CSCA Humanities Chinese", blurb: "文科中文 saja · 80 soal per set",
    attempts: 4, sections: ["csca_chinese_hum"],
    prices: { USD: 15, EUR: 14, CNY: 109, IDR: 199_000 },
    strike: { USD: 22, EUR: 20, CNY: 159, IDR: 289_000 },
    features: [
      "4 sittings of Humanities Chinese 文科中文 only, 80 questions each",
      "90 minutes per sitting, score 0–100 at the end of the set",
      "History, education, politics and literature passages",
      "Academic register, not HSK",
    ],
  },
  {
    id: "alevel-subject", exam: "ALEVEL", name: "A Level per Subject", blurb: "Paper-based, mark scheme",
    attempts: 4,
    prices: { USD: 25, EUR: 23, CNY: 179, IDR: 299_000 },
    features: [
      "4 full papers per subject",
      "Cambridge-style mark scheme with M/A/B codes",
      "Grade boundaries A*–E",
      "Formula list and data booklet built in",
    ],
  },
  {
    id: "tka-smp", exam: "TKA_SMP", name: "TKA SMP", blurb: "Bahasa Indonesia & Matematika",
    attempts: 4,
    prices: { IDR: 79_000, USD: 6, EUR: 6, CNY: 45 },
    strike: { IDR: 129_000, USD: 9, EUR: 9, CNY: 69 },
    indonesiaOnly: true,
    features: [
      "4 try out TKA SMP lengkap",
      "Skor 0-100 per mata pelajaran",
      "Pembahasan tiap soal",
      "Rekap per materi, bukan sekadar nilai akhir",
    ],
  },
  {
    id: "tka-sma", exam: "TKA_SMA", name: "TKA SMA Saintek", blurb: "3 mapel wajib + Fisika, Kimia, Biologi",
    attempts: 4,
    prices: { IDR: 149_000, USD: 11, EUR: 10, CNY: 79 },
    strike: { IDR: 229_000, USD: 16, EUR: 15, CNY: 119 },
    indonesiaOnly: true,
    features: [
      "4 try out TKA SMA lengkap",
      "Bahasa Indonesia, Matematika, Bahasa Inggris, Fisika, Kimia, Biologi",
      "Skor 0-100 per mata pelajaran; gabungan dihitung rata-rata",
      "Pembahasan tiap soal dan rekap per materi",
    ],
  },
];

export const packageById = (id: string) => PACKAGES.find((p) => p.id === id);
export const packagesByExam = (exam: ExamCode) => PACKAGES.filter((p) => p.exam === exam);

/** Paket yang ditampilkan untuk satu mata uang. Paket khusus Indonesia
 *  disembunyikan dari pengunjung lain supaya daftar harga tidak membingungkan. */
export const visiblePackages = (currency: Currency) =>
  PACKAGES.filter((p) => !p.indonesiaOnly || currency === "IDR");

export const priceOf = (p: TryoutPackage, currency: Currency) => p.prices[currency];
export const strikeOf = (p: TryoutPackage, currency: Currency) => p.strike?.[currency];

export const money = (amount: number, currency: Currency, intlTag = "en-US") =>
  formatMoney(amount, currency, intlTag);

/** Format rupiah ringkas, masih dipakai panel admin yang berbahasa Indonesia. */
export const rupiah = (n?: number | null) => "Rp" + (n ?? 0).toLocaleString("id-ID");

export const DEMO_QUESTION_COUNT = 10;
