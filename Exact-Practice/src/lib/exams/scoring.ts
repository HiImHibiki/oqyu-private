import type { ExamCode, Question } from "@/lib/types";
import { getBlueprint } from "./blueprints";

export interface ItemOutcome {
  question: Question;
  credit: number;
  correct: boolean;
  /** true bila soal ini menunggu penilaian manusia dan belum dinilai.
   *  Item semacam ini dikeluarkan dari perhitungan — mesin tidak bisa
   *  menilainya, jadi menganggapnya salah menghukum peserta atas keterbatasan
   *  penilai, bukan atas pekerjaannya. Setelah dinilai, ia ikut dihitung
   *  seperti soal lain. */
  pendingManual?: boolean;
}

export interface SectionScore {
  code: string;
  name: string;
  raw: number;
  max: number;
  percent: number;
  scaled: number;
  byDomain: { domain: string; correct: number; total: number; percent: number }[];
}

export interface ScoreReport {
  exam: ExamCode;
  sections: SectionScore[];
  total: number;
  totalMax: number;
  grade?: string;
  /** estimasi kemampuan IRT, -3..3 */
  theta?: number;
  percentileHint?: number;
  /* Soal yang belum bisa dinilai mesin — esai bernilai rubrik.
   *
   * Soal-soal ini DIKELUARKAN dari perhitungan, tidak dianggap salah.
   * Sebelumnya ia tetap masuk penyebut sementara `gradeAnswer` selalu
   * mengembalikan credit 0, sehingga peserta A Level yang menjawab seluruh
   * soal dengan benar pun paling tinggi hanya memperoleh 73% — nilai B untuk
   * pekerjaan sempurna. Menghitung sesuatu yang tidak pernah bisa benar
   * sebagai jawaban salah bukan penilaian, melainkan kesalahan. */
  pendingManual?: { count: number; points: number };
}

/* ------------------------------ Utilitas IRT ------------------------------ */

/** Estimasi theta 1-PL (Rasch) dengan Newton-Raphson, b diambil dari irtB / difficulty. */
export function estimateTheta(items: ItemOutcome[]): number {
  const bOf = (q: Question) => q.irtB ?? ({ E: -1, M: 0, H: 1 }[q.difficulty]);
  let theta = 0;
  for (let it = 0; it < 40; it++) {
    let num = 0, den = 0;
    for (const o of items) {
      const p = 1 / (1 + Math.exp(-(theta - bOf(o.question))));
      num += o.credit - p;
      den += p * (1 - p);
    }
    if (den < 1e-9) break;
    const step = num / den;
    theta += Math.max(-1, Math.min(1, step));
    if (Math.abs(step) < 1e-4) break;
  }
  return Math.max(-3.5, Math.min(3.5, theta));
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round5 = (v: number) => Math.round(v / 10) * 10;

/* --------------------------- Kurva skala per ujian ------------------------ */

/* SAT: persen benar -> 200..800.
 *
 * Plafon modul mudah dinyatakan sebagai ANGKA, bukan sebagai rumus kedua.
 * Versi sebelumnya memakai `min(base, 200 + 450·p^0,86 + 130)`, yang menurut
 * komentarnya membatasi di sekitar 650 — padahal pada p = 0,9 ia menghasilkan
 * 740, dan pada p = 0,7 tidak membatasi sama sekali. Plafon yang tidak
 * membatasi apa pun lebih buruk daripada tidak ada plafon: ia membuat kami
 * mengira sudah meniru perilaku Bluebook padahal belum.
 *
 * Angka 600 adalah PERKIRAAN. College Board tidak mempublikasikan tabel
 * konversi per formulir, dan batas sesungguhnya berbeda tiap sesi. Yang bisa
 * kami pertanggungjawabkan hanya arahnya: peserta yang dirutekan ke modul
 * mudah tidak dapat mencapai puncak skala. Lihat SCORING_MODELS.SAT di
 * reference.ts untuk keterbatasan yang didokumentasikan. */
export const SAT_EASIER_MODULE_CEILING = 600;

function satScaled(percent: number, hardModule: boolean): number {
  const p = clamp(percent, 0, 1);
  const base = 200 + 600 * Math.pow(p, 0.86);
  if (hardModule) return clamp(round5(base), 200, 800);

  /* Modul mudah: skala yang sama diperas ke 200..600, sehingga peserta tetap
   * dibedakan satu sama lain di dalam modulnya, tetapi tidak pernah menembus
   * plafon yang hanya terbuka lewat modul sulit. */
  const squeezed = 200 + (SAT_EASIER_MODULE_CEILING - 200) * Math.pow(p, 0.86);
  return clamp(round5(squeezed), 200, SAT_EASIER_MODULE_CEILING);
}

/** UTBK: theta -> 0..1000, rata-rata nasional ditaruh di ~500 dengan SD ~110. */
function utbkScaled(theta: number): number {
  return clamp(Math.round(500 + 110 * theta), 100, 1000);
}

/** CSCA: raw% -> 0..100 per mata uji.
 *  Seluruh soal pilihan ganda dan berbobot sama, tanpa penalti jawaban salah. */
function cscaScaled(percent: number): number {
  return clamp(Math.round(100 * Math.pow(clamp(percent, 0, 1), 0.94)), 0, 100);
}

/** TKA: raw% -> 0..100 per mata pelajaran.
 *
 *  Kurvanya sedikit lebih landai daripada CSCA (pangkat 0,92 vs 0,94) karena
 *  TKA di aplikasi ini adalah ujian latihan sekolah, bukan seleksi: menaikkan
 *  sedikit bagian bawah membuat laporan lebih berguna bagi siswa yang masih
 *  jauh dari target, tanpa mengubah urutan siapa pun.
 *
 *  Dipisahkan dari cscaScaled meski rumusnya mirip, supaya kurva salah satunya
 *  bisa disetel tanpa diam-diam menggeser yang lain. */
function tkaScaled(percent: number): number {
  return clamp(Math.round(100 * Math.pow(clamp(percent, 0, 1), 0.92)), 0, 100);
}

/** A Level: persen mark -> grade. Boundary umum Cambridge (dapat di-override per sesi). */
export const ALEVEL_BOUNDARIES: { grade: string; min: number }[] = [
  { grade: "A*", min: 90 }, { grade: "A", min: 80 }, { grade: "B", min: 70 },
  { grade: "C", min: 60 }, { grade: "D", min: 50 }, { grade: "E", min: 40 }, { grade: "U", min: 0 },
];
export function alevelGrade(percent: number) {
  const p = percent * 100;
  return (ALEVEL_BOUNDARIES.find((b) => p >= b.min) ?? ALEVEL_BOUNDARIES.at(-1)!).grade;
}

/* ------------------------------- Skoring utama ---------------------------- */

export function scoreAttempt(
  examCode: ExamCode,
  bySection: Record<string, ItemOutcome[]>,
  /* Varian modul adaptif yang benar-benar dikerjakan peserta.
   *
   * Sebelumnya «modul sulit» ditebak dari «apakah section ini memuat setidaknya
   * satu soal sulit» — yang hampir selalu benar, sehingga plafon modul mudah
   * tidak pernah berlaku. Dan skor totalnya bahkan memanggil satScaled(x, true)
   * secara harfiah. Sekarang keputusan routing yang sesungguhnya dipakai. */
  routing: Record<string, "easier" | "harder"> = {},
): ScoreReport {
  const bp = getBlueprint(examCode);
  const sections: SectionScore[] = [];
  let pendingCount = 0, pendingPoints = 0;

  for (const [code, items] of Object.entries(bySection)) {
    const meta = bp?.sections.find((s) => s.code === code);

    /* Soal bernilai rubrik dikeluarkan dari penyebut: mesin tidak bisa
     * menilainya, jadi menganggapnya salah akan menghukum peserta atas
     * keterbatasan penilai, bukan atas pekerjaannya. */
    const auto = items.filter((o) => !o.pendingManual);
    const manual = items.filter((o) => o.pendingManual);
    pendingCount += manual.length;
    pendingPoints += manual.reduce((a, o) => a + o.question.points, 0);

    const max = auto.reduce((a, o) => a + o.question.points, 0) || auto.length;
    const raw = auto.reduce((a, o) => a + o.credit * o.question.points, 0);
    const percent = max ? raw / max : 0;

    const domainMap = new Map<string, { c: number; t: number }>();
    for (const o of auto) {
      const d = domainMap.get(o.question.domain) ?? { c: 0, t: 0 };
      d.c += o.credit; d.t += 1;
      domainMap.set(o.question.domain, d);
    }

    let scaled = Math.round(percent * 100);
    if (bp?.scoring.kind === "sat_scaled") {
      /* Section non-adaptif (modul 1) selalu memakai kurva penuh; hanya modul
       * 2 yang plafonnya bergantung pada varian yang dirutekan. Bila routing
       * tidak tersedia — misalnya bank belum cukup untuk dua varian — modul
       * dianggap sulit, sehingga peserta tidak pernah dirugikan oleh
       * keterbatasan bank soal kami. */
      const variant = routing[code];
      scaled = satScaled(percent, variant !== "easier");
    } else if (bp?.scoring.kind === "utbk_irt") {
      scaled = utbkScaled(estimateTheta(items));
    } else if (bp?.scoring.kind === "csca_scaled") {
      scaled = cscaScaled(percent);
    } else if (bp?.scoring.kind === "tka_scaled") {
      scaled = tkaScaled(percent);
    }

    sections.push({
      code,
      name: meta?.name ?? code,
      raw: Math.round(raw * 100) / 100,
      max,
      percent,
      scaled,
      byDomain: [...domainMap].map(([domain, v]) => ({
        domain, correct: Math.round(v.c * 100) / 100, total: v.t, percent: v.t ? v.c / v.t : 0,
      })).sort((a, b) => a.percent - b.percent),
    });
  }

  const allItems = Object.values(bySection).flat().filter((o) => !o.pendingManual);
  const theta = allItems.length ? estimateTheta(allItems) : undefined;
  const overallPercent = allItems.length
    ? allItems.reduce((a, o) => a + o.credit * o.question.points, 0) / allItems.reduce((a, o) => a + o.question.points, 0)
    : 0;

  let total = 0, totalMax = 0, grade: string | undefined;
  switch (bp?.scoring.kind) {
    case "sat_scaled": {
      // gabungkan modul: RW = m1+m2, Math = m1+m2 -> 2 skor 200-800
      const rw = merge(sections, ["sat_rw_m1", "sat_rw_m2"]);
      const ma = merge(sections, ["sat_math_m1", "sat_math_m2"]);
      total = satScaled(rw, routing["sat_rw_m2"] !== "easier")
        + satScaled(ma, routing["sat_math_m2"] !== "easier");
      totalMax = 1600;
      break;
    }
    case "utbk_irt":
      total = utbkScaled(theta ?? 0);
      totalMax = 1000;
      break;
    case "csca_scaled": {
      // Peserta hanya mengambil mata uji yang diwajibkan program studinya,
      // jadi angka gabungannya adalah RATA-RATA, bukan jumlah - menjumlahkan
      // akan menghukum pelamar program berbahasa Inggris yang mata ujinya
      // memang lebih sedikit.
      total = sections.length ? Math.round(sections.reduce((a, s) => a + s.scaled, 0) / sections.length) : 0;
      totalMax = 100;
      break;
    }
    case "tka_scaled": {
      /* Sama seperti CSCA: peserta hanya mengerjakan mata pelajaran wajib
       * ditambah pilihannya, jadi angka gabungannya RATA-RATA. Menjumlahkan
       * akan membuat peserta yang mengambil tiga mapel selalu kalah dari yang
       * mengambil lima, betapapun baik pekerjaannya. */
      total = sections.length ? Math.round(sections.reduce((a, s) => a + s.scaled, 0) / sections.length) : 0;
      totalMax = 100;
      break;
    }
    case "alevel_grade":
      total = Math.round(overallPercent * 100);
      totalMax = 100;
      grade = alevelGrade(overallPercent);
      break;
    default:
      total = Math.round(overallPercent * 100);
      totalMax = 100;
  }

  return {
    exam: examCode,
    sections,
    total,
    totalMax,
    grade,
    theta,
    percentileHint: theta !== undefined ? Math.round(100 * normCdf(theta)) : undefined,
    ...(pendingCount ? { pendingManual: { count: pendingCount, points: pendingPoints } } : {}),
  };
}

function merge(sections: SectionScore[], codes: string[]) {
  const chosen = sections.filter((s) => codes.includes(s.code));
  if (!chosen.length) return 0;
  const raw = chosen.reduce((a, s) => a + s.raw, 0);
  const max = chosen.reduce((a, s) => a + s.max, 0);
  return max ? raw / max : 0;
}

function normCdf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Routing modul adaptif SAT: >= threshold benar -> modul 2 sulit. */
export function routeAdaptive(correctRatio: number, threshold = 0.6): "hard" | "easy" {
  return correctRatio >= threshold ? "hard" : "easy";
}
