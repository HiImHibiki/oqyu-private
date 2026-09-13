import type { Answer, Question } from "@/lib/types";

/* ---------------------------- Normalisasi input --------------------------- */

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";

export function normalizeText(s: string, opts?: { caseSensitive?: boolean; ignoreDiacritics?: boolean }) {
  let out = String(s ?? "").trim().replace(/\s+/g, " ");
  if (!opts?.caseSensitive) out = out.toLowerCase();
  if (opts?.ignoreDiacritics) out = out.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // samakan tanda kutip & dash tipografis
  out = out.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");
  return out;
}

/**
 * Parse jawaban numerik gaya SAT grid-in / isian UTBK.
 * Menerima: 3.5 | 7/2 | -3/4 | .25 | 1,5 (koma desimal ID) | 3 1/2 | 2e3 | 50%
 */
export function parseNumeric(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  let s = String(input ?? "").trim();
  if (!s) return null;
  s = s.replace(/\s/g, "").replace(/[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]/g, (c) => String(SUP.indexOf(c)));
  let percent = false;
  if (s.endsWith("%")) { percent = true; s = s.slice(0, -1); }
  // koma desimal Indonesia -> titik (hanya jika tidak ada titik sama sekali)
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  s = s.replace(/,/g, "");
  let v: number | null = null;
  const mixed = s.match(/^(-?\d+)_(\d+)\/(\d+)$/);
  const frac = s.match(/^(-?\d*\.?\d+)\/(-?\d*\.?\d+)$/);
  if (mixed) {
    const [, w, n, d] = mixed;
    const sign = Number(w) < 0 ? -1 : 1;
    v = Number(w) + sign * (Number(n) / Number(d));
  } else if (frac) {
    const d = Number(frac[2]);
    v = d === 0 ? null : Number(frac[1]) / d;
  } else if (/^-?\d*\.?\d+(e-?\d+)?$/i.test(s)) {
    v = Number(s);
  }
  if (v === null || !Number.isFinite(v)) return null;
  return percent ? v / 100 : v;
}

const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

/* ------------------------------ Penilaian --------------------------------- */

export interface GradeResult {
  correct: boolean;
  /** 0..1 — sebagian tipe soal memberi nilai parsial */
  credit: number;
  detail?: Record<string, boolean>;
}

export function gradeAnswer(q: Question, raw: unknown): GradeResult {
  const a: Answer = q.answer;
  const none: GradeResult = { correct: false, credit: 0 };
  if (raw === undefined || raw === null || raw === "") return none;

  switch (a.mode) {
    case "choice":
      return bool(String(raw) === a.value);

    case "choice_set": {
      const picked = new Set(Array.isArray(raw) ? raw.map(String) : []);
      const want = new Set(a.value);
      if (picked.size !== want.size) {
        // kredit parsial: (benar - salah) / total, minimum 0
        let hit = 0, miss = 0;
        picked.forEach((p) => (want.has(p) ? hit++ : miss++));
        return { correct: false, credit: Math.max(0, (hit - miss) / want.size) };
      }
      const all = [...want].every((w) => picked.has(w));
      return all ? { correct: true, credit: 1 } : { correct: false, credit: 0 };
    }

    case "numeric": {
      const v = parseNumeric(raw);
      if (v === null) return none;
      if (a.acceptedForms?.some((f) => normalizeText(String(raw)) === normalizeText(f))) return { correct: true, credit: 1 };
      const tol = a.tolerance ?? Math.max(1e-9, Math.abs(a.value) * 1e-9);
      return bool(near(v, a.value, tol));
    }

    case "numeric_range": {
      const v = parseNumeric(raw);
      if (v === null) return none;
      return bool(v >= a.min - 1e-9 && v <= a.max + 1e-9);
    }

    case "numeric_list": {
      const obj = (raw ?? {}) as Record<string, unknown>;
      const detail: Record<string, boolean> = {};
      let hit = 0;
      for (const item of a.values) {
        const v = parseNumeric(obj[item.key]);
        const ok = v !== null && near(v, item.value, item.tolerance ?? 1e-6);
        detail[item.key] = ok;
        if (ok) hit++;
      }
      return { correct: hit === a.values.length, credit: hit / a.values.length, detail };
    }

    case "text": {
      const got = normalizeText(String(raw), a);
      return bool(a.accepted.some((x) => normalizeText(x, a) === got));
    }

    case "boolean_list": {
      const arr = Array.isArray(raw) ? raw : [];
      const detail: Record<string, boolean> = {};
      let hit = 0;
      a.values.forEach((want, i) => {
        const ok = Boolean(arr[i]) === want;
        detail[String(i)] = ok;
        if (ok) hit++;
      });
      return { correct: hit === a.values.length, credit: hit / a.values.length, detail };
    }

    case "grid":
    case "pairs":
    case "dropdowns": {
      const obj = (raw ?? {}) as Record<string, string>;
      const keys = Object.keys(a.values);
      const detail: Record<string, boolean> = {};
      let hit = 0;
      for (const k of keys) {
        const ok = obj[k] === a.values[k];
        detail[k] = ok;
        if (ok) hit++;
      }
      return { correct: hit === keys.length, credit: hit / keys.length, detail };
    }

    case "sequence": {
      const arr = (Array.isArray(raw) ? raw : []).map(String);
      const hit = a.values.filter((v, i) => arr[i] === v).length;
      return { correct: hit === a.values.length, credit: hit / a.values.length };
    }

    case "plot": {
      const tol = a.tolerance ?? 0.001;
      const got = raw as { points?: [number, number][]; line?: { m: number; b: number } };
      if (a.expect.line && got?.line) {
        return bool(near(got.line.m, a.expect.line.m, tol) && near(got.line.b, a.expect.line.b, tol));
      }
      if (a.expect.points && got?.points) {
        if (got.points.length !== a.expect.points.length) return none;
        const ok = a.expect.points.every((p) => got.points!.some((g) => near(g[0], p[0], tol) && near(g[1], p[1], tol)));
        return bool(ok);
      }
      return none;
    }

    case "rubric":
      // dinilai terpisah (AI / manual). Di sini hanya ditandai butuh review.
      return { correct: false, credit: 0 };

    default:
      return none;
  }
}

const bool = (ok: boolean): GradeResult => ({ correct: ok, credit: ok ? 1 : 0 });

/** Jawaban benar dalam bentuk teks yang enak dibaca di halaman review. */
export function answerLabel(q: Question): string {
  const a = q.answer;
  switch (a.mode) {
    case "choice": return `${a.value}. ${q.choices?.find((c) => c.id === a.value)?.text ?? ""}`;
    case "choice_set": return a.value.join(", ");
    case "numeric": return `${a.value}${a.unit ? " " + a.unit : ""}`;
    case "numeric_range": return `${a.min} – ${a.max}${a.unit ? " " + a.unit : ""}`;
    case "numeric_list": return a.values.map((v) => `${v.key} = ${v.value}`).join("; ");
    case "text": return a.accepted[0];
    case "boolean_list": return a.values.map((v, i) => `${i + 1}. ${v ? "Benar" : "Salah"}`).join(" · ");
    case "grid":
    case "pairs":
    case "dropdowns": return Object.entries(a.values).map(([k, v]) => `${k}→${v}`).join(", ");
    case "sequence": return a.values.join(" → ");
    case "plot": return a.expect.line ? `y = ${a.expect.line.m}x + ${a.expect.line.b}` : (a.expect.points ?? []).map((p) => `(${p[0]}, ${p[1]})`).join(", ");
    case "rubric": return "Dinilai dengan rubrik";
  }
}


/* ------------------------------------------------------ penilaian rubrik */

/** Menjepit poin yang diberikan penilai ke rentang yang sah, lalu
 *  menjumlahkannya ulang.
 *
 *  Total TIDAK PERNAH diambil dari yang dikirim browser. Kalau boleh, satu
 *  permintaan yang disusun tangan bisa memberi nilai berapa pun tanpa terlihat
 *  janggal di layar penilai — dan nilai esai adalah satu-satunya bagian skor
 *  yang tidak bisa diperiksa ulang oleh mesin. */
export function clampRubricAwards(
  rubric: { criterion: string; points: number }[],
  awarded: unknown,
): { awarded: number[]; total: number } {
  const masuk = Array.isArray(awarded) ? awarded : [];
  const bersih = rubric.map((c, i) => {
    const v = Number(masuk[i]);
    if (!Number.isFinite(v)) return 0;
    // setengah poin diizinkan; itu lazim dalam penilaian uraian
    return Math.max(0, Math.min(c.points, Math.round(v * 2) / 2));
  });
  return { awarded: bersih, total: bersih.reduce((a, b) => a + b, 0) };
}
