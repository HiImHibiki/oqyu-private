import { BLUEPRINTS } from "./blueprints.ts";
import { FORMULA_SHEETS } from "./formulas.ts";
import type { ExamBlueprint, Question } from "@/lib/types";

/* =========================================================================
 * Validator soal.
 *
 * Dipakai dua tempat, supaya aturannya tidak pernah bercabang:
 *   - CLI   : scripts/validate-questions.mjs
 *   - Panel : /admin/soal saat mengimpor JSON
 *
 * Yang diperiksa di sini adalah hal yang tidak bisa ditangkap JSON Schema:
 * kecocokan antar-field, referensi silang, dan kewajaran isi.
 * ========================================================================= */

export type Severity = "BLOCKER" | "MAJOR" | "MINOR";

export interface Finding {
  index: number;
  id: string;
  severity: Severity;
  message: string;
}

export interface ValidationReport {
  findings: Finding[];
  blockers: number;
  majors: number;
  minors: number;
  checked: number;
  /** soal yang tidak punya BLOCKER — aman diimpor */
  accepted: Question[];
}

const ANSWER_FOR_TYPE: Record<string, string[]> = {
  mcq_single: ["choice"],
  mcq_multi: ["choice_set"],
  spr_numeric: ["numeric", "numeric_range"],
  numeric_multi: ["numeric_list"],
  short_text: ["text"],
  true_false_multi: ["boolean_list"],
  table_grid: ["grid"],
  matching: ["pairs"],
  ordering: ["sequence"],
  dropdown_inline: ["dropdowns"],
  graph_plot: ["plot"],
  essay_rubric: ["rubric"],
};

const FIGURE_REQUIRED: Record<string, string[]> = {
  function_plot: ["series", "window"],
  scatter: ["points"],
  bar_chart: ["categories", "series"],
  line_chart: ["categories", "series"],
  histogram: ["bins"],
  pie_chart: ["slices"],
  box_plot: ["groups"],
  number_line: ["min", "max", "step"],
  geometry: ["viewBox", "elements"],
  table: ["headers", "rows"],
  circuit: ["nodes", "components"],
  image: ["src"],
};

/* Menyalakan BLOCKER hanya bila stem benar-benar MERUJUK sebuah gambar.
 * Pola sebelumnya cukup kata "gambar" saja, sehingga kata biasa seperti
 * "digambarkan" ikut tertangkap dan soal yang sah ditolak. */
const RE_MENTIONS_FIGURE =
  /\b(gambar|grafik|diagram|tabel|bagan)\s+(di\s+atas|di\s+bawah|berikut|tersebut|itu)\b|\b(graph|figure|diagram|chart|table)\s+(above|below|shown|opposite)\b/i;

/* Satu karakter Han membawa jauh lebih banyak makna daripada satu huruf
 * Latin, jadi ambang panjang yang dikalibrasi untuk bahasa Inggris menolak
 * pembahasan bahasa Mandarin yang sebenarnya sudah memadai. */
const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
function weightedLength(text: string): number {
  let n = 0;
  for (const ch of text) n += CJK.test(ch) ? 2 : 1;
  return n;
}

const UNICODE_MATH = /[²³¹⁰⁴-⁹√≤≥≠±∞∑∫π×÷θαβγΔ]/;
const KNOWN_FUNCS = /(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|ln|log2|log|exp|sqrt|cbrt|abs|floor|ceil|round|sign|min|max|root|nCr|nPr)\(/;

export function validateQuestions(list: unknown[], opts: { strict?: boolean } = {}): ValidationReport {
  const findings: Finding[] = [];
  const accepted: Question[] = [];
  const seen = new Set<string>();

  list.forEach((raw, i) => {
    const q = raw as Question;
    const id = q?.id ?? "(tanpa id)";
    const local: Finding[] = [];
    const add = (severity: Severity, message: string) =>
      local.push({ index: i + 1, id, severity, message });

    /* --------------------------------------------------------- identitas */
    if (!q?.id || !/^[a-z0-9-]{6,60}$/.test(q.id)) {
      add("BLOCKER", "id kosong atau formatnya salah (huruf kecil, angka, tanda hubung, 6-60 karakter)");
    } else if (seen.has(q.id)) {
      add("BLOCKER", "id duplikat di dalam berkas ini");
    } else {
      seen.add(q.id);
    }

    const bp = (BLUEPRINTS as Record<string, ExamBlueprint>)[q?.exam];
    if (!bp) {
      add("BLOCKER", `exam "${q?.exam}" tidak dikenal (SAT / UTBK / CSCA / ALEVEL)`);
      findings.push(...local);
      return;
    }

    const sec = bp.sections.find((s) => s.code === q.section);
    if (!sec) {
      add("BLOCKER", `section "${q.section}" tidak ada di blueprint ${q.exam}`);
    } else {
      const dom = sec.domains.find((d) => d.name === q.domain);
      if (!dom) add("MAJOR", `domain "${q.domain}" tidak ada di section ${q.section}`);
      else if (!dom.skills.includes(q.skill)) add("MAJOR", `skill "${q.skill}" tidak ada di domain "${q.domain}"`);
      if (sec.allowedTypes?.length && !sec.allowedTypes.includes(q.type)) {
        add("MAJOR", `type "${q.type}" tidak diizinkan di ${q.section} (boleh: ${sec.allowedTypes.join(", ")})`);
      }
      if (q.calculatorAllowed && !sec.calculatorAllowed) {
        add("BLOCKER", `calculatorAllowed true padahal section ${q.section} melarang kalkulator`);
      }
    }

    if (!["E", "M", "H"].includes(q.difficulty)) add("BLOCKER", "difficulty harus E, M, atau H");
    if (q.irtB !== undefined && (q.irtB < -3 || q.irtB > 3)) add("MINOR", "irtB di luar rentang -3..3");
    if (!q.tags?.length) add("MINOR", "tags kosong");
    if (!q.estimatedTimeSec || q.estimatedTimeSec < 20 || q.estimatedTimeSec > 1800) {
      add("MINOR", "estimatedTimeSec tidak masuk akal (20-1800 detik)");
    }
    if (!q.points || q.points <= 0) add("MINOR", "points harus lebih dari 0");
    if (!q.explanation || weightedLength(q.explanation) < 40) {
      add("MAJOR", "explanation terlalu pendek untuk dianggap pembahasan");
    }

    /* ------------------------------------------------------ answer vs type */
    const want = ANSWER_FOR_TYPE[q.type];
    if (!want) add("BLOCKER", `type "${q.type}" tidak dikenal`);
    else if (!q.answer?.mode) add("BLOCKER", "answer.mode kosong");
    else if (!want.includes(q.answer.mode)) {
      add("BLOCKER", `answer.mode "${q.answer.mode}" tidak cocok dengan type "${q.type}" (harus ${want.join(" / ")})`);
    }

    /* -------------------------------------------------- konsistensi pilihan */
    const ids = (q.choices ?? []).map((c) => c.id);
    if (["mcq_single", "mcq_multi", "ordering"].includes(q.type)) {
      if (ids.length < 2) add("BLOCKER", "choices kurang dari 2");
      if (new Set(ids).size !== ids.length) add("BLOCKER", "id opsi duplikat");
    }
    const a = q.answer;
    if (a?.mode === "choice" && !ids.includes(a.value)) add("BLOCKER", `kunci "${a.value}" tidak ada di daftar opsi`);
    if (a?.mode === "choice_set") {
      for (const v of a.value ?? []) if (!ids.includes(v)) add("BLOCKER", `kunci "${v}" tidak ada di daftar opsi`);
      if (a.value?.length !== a.selectCount) add("BLOCKER", "selectCount tidak sama dengan jumlah kunci");
    }
    if (a?.mode === "sequence" && new Set(a.values ?? []).size !== ids.length) {
      add("BLOCKER", "sequence tidak memuat semua opsi tepat satu kali");
    }
    if (a?.mode === "boolean_list") {
      if ((q.statements ?? []).length !== (a.values ?? []).length) {
        add("BLOCKER", "jumlah statements tidak sama dengan jumlah nilai benar/salah");
      } else if (new Set(a.values).size === 1 && a.values.length > 2) {
        add("MINOR", "semua pernyataan bernilai sama - terlalu mudah ditebak");
      }
    }
    if (a?.mode === "pairs") {
      const L = new Set((q.left ?? []).map((x) => x.id));
      const R = new Set((q.right ?? []).map((x) => x.id));
      for (const [k, v] of Object.entries(a.values ?? {})) {
        if (!L.has(k)) add("BLOCKER", `pairs merujuk left "${k}" yang tidak ada`);
        if (!R.has(v)) add("BLOCKER", `pairs merujuk right "${v}" yang tidak ada`);
      }
      if (Object.keys(a.values ?? {}).length !== L.size) add("BLOCKER", "tidak semua item kiri dipasangkan");
    }
    if (a?.mode === "grid") {
      const R = new Set((q.gridRows ?? []).map((x) => x.id));
      const C = new Set((q.gridCols ?? []).map((x) => x.id));
      for (const [k, v] of Object.entries(a.values ?? {})) {
        if (!R.has(k)) add("BLOCKER", `grid merujuk baris "${k}" yang tidak ada`);
        if (!C.has(v)) add("BLOCKER", `grid merujuk kolom "${v}" yang tidak ada`);
      }
    }

    /* -------------------------------------------------------- token cloze */
    const tokens = [...String(q.stem ?? "").matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    if (q.type === "dropdown_inline") {
      const declared = (q.blanks ?? []).map((b) => b.id);
      for (const t of tokens) if (!declared.includes(t)) add("BLOCKER", `token {{${t}}} tidak punya entri di blanks`);
      for (const d of declared) if (!tokens.includes(d)) add("BLOCKER", `blank "${d}" tidak muncul sebagai token di stem`);
      if (a?.mode === "dropdowns") {
        for (const [k, v] of Object.entries(a.values ?? {})) {
          const b = (q.blanks ?? []).find((x) => x.id === k);
          if (!b) add("BLOCKER", `kunci dropdown merujuk blank "${k}" yang tidak ada`);
          else if (!b.options.some((o) => o.id === v)) add("BLOCKER", `kunci "${v}" tidak ada di opsi blank "${k}"`);
        }
      }
    }
    if (q.type === "numeric_multi") {
      const declared = (q.numericBlanks ?? []).map((b) => b.id);
      if (!declared.length) add("BLOCKER", "numeric_multi tanpa numericBlanks");
      if (a?.mode === "numeric_list") {
        for (const item of a.values ?? []) {
          if (!declared.includes(item.key)) add("BLOCKER", `numeric_list merujuk key "${item.key}" yang tidak ada di numericBlanks`);
        }
        if ((a.values ?? []).length !== declared.length) {
          add("MAJOR", "jumlah kunci numerik tidak sama dengan jumlah kotak isian");
        }
      }
    }

    /* ------------------------------------------------------------- LaTeX */
    const texts = [
      q.stem, q.explanation,
      ...(q.choices ?? []).map((c) => c.text),
      ...(q.statements ?? []).map((x) => x.text),
    ].filter(Boolean) as string[];

    for (const t of texts) {
      const noDisplay = t.replace(/\$\$[\s\S]*?\$\$/g, "");
      if (((noDisplay.match(/(?<!\\)\$/g) ?? []).length) % 2 !== 0) {
        add("BLOCKER", "jumlah tanda $ ganjil - LaTeX tidak seimbang");
      }
      const outside = t.replace(/\$\$[\s\S]*?\$\$/g, "").replace(/\$[^$]*\$/g, "");
      if (UNICODE_MATH.test(outside)) {
        add("MINOR", "ada simbol matematika Unicode di luar LaTeX (tulis sebagai $...$)");
      }
    }

    /* ------------------------------------------------------------ figure */
    if (q.figure) {
      const f = q.figure as unknown as { kind: string; alt?: string; series?: { expr: string }[] } & Record<string, unknown>;
      const req = FIGURE_REQUIRED[f.kind];
      if (!req) add("BLOCKER", `figure.kind "${f.kind}" tidak dikenal`);
      else for (const k of req) if (f[k] === undefined) add("BLOCKER", `figure ${f.kind} kekurangan field "${k}"`);
      if (!f.alt || f.alt.length < 15) add("BLOCKER", "figure.alt kosong atau terlalu pendek (aksesibilitas)");
      if (f.kind === "image") add("BLOCKER", "figure kind 'image' tidak boleh dihasilkan AI");
      if (f.kind === "function_plot") {
        for (const ser of f.series ?? []) {
          if (/[a-zA-Z]\(/.test(ser.expr) && !KNOWN_FUNCS.test(ser.expr)) {
            add("MAJOR", `ekspresi "${ser.expr}" memakai fungsi yang tidak didukung evaluator`);
          }
        }
      }
    } else if (RE_MENTIONS_FIGURE.test(q.stem ?? "")) {
      add("BLOCKER", "stem menyebut gambar/grafik tetapi tidak ada figure");
    }

    for (const r of q.formulaRefs ?? []) {
      if (!FORMULA_SHEETS[r]) add("MINOR", `formulaRefs "${r}" tidak ada di daftar lembar rumus`);
    }

    /* -------------------------------------------------------- bilingual */
    if (q.exam === "CSCA") {
      const other = q.locale === "zh" ? "en" : "zh";
      const tr = q.i18n?.[other];
      if (!tr) add("BLOCKER", `CSCA wajib bilingual - i18n.${other} tidak ada`);
      else {
        if (!tr.stem) add("BLOCKER", `i18n.${other}.stem kosong`);
        if (!tr.explanation) add("MAJOR", `i18n.${other}.explanation kosong`);
        if (q.choices && tr.choices) {
          const x = q.choices.map((c) => c.id).join(",");
          const y = tr.choices.map((c) => c.id).join(",");
          if (x !== y) add("BLOCKER", `urutan/id opsi versi ${other} berbeda dari versi utama`);
        }
      }
    }

    /* ------------------------------------------------------- distraktor */
    if (opts.strict && q.type === "mcq_single" && a?.mode === "choice") {
      const rat = Object.keys(q.distractorRationale ?? {});
      for (const w of ids.filter((x) => x !== a.value)) {
        if (!rat.includes(w)) add("MINOR", `distractorRationale untuk opsi ${w} belum diisi`);
      }
    }

    findings.push(...local);
    if (!local.some((f) => f.severity === "BLOCKER")) accepted.push(q);
  });

  return {
    findings,
    blockers: findings.filter((f) => f.severity === "BLOCKER").length,
    majors: findings.filter((f) => f.severity === "MAJOR").length,
    minors: findings.filter((f) => f.severity === "MINOR").length,
    checked: list.length,
    accepted,
  };
}
