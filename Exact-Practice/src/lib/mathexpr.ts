/* Evaluator ekspresi matematika kecil & aman (tanpa eval()).
 * Dipakai oleh: plot fungsi pada figur soal, dan kalkulator ilmiah bawaan.
 * Mendukung: + - * / ^ % ! ( ) , variabel, fungsi, konstanta, implicit multiply (2x, 3(x+1)). */
/* Galat evaluator membawa KODE, bukan kalimat.
 *
 * Pesannya ditampilkan langsung kepada peserta di dalam ruang ujian, dan
 * ruang ujian itu berbahasa Inggris, Indonesia, atau Mandarin tergantung
 * pesertanya. Kalimat berbahasa Indonesia yang ditanam di pustaka matematika
 * tidak dapat diterjemahkan oleh siapa pun di hilir — karena itu yang dilempar
 * adalah kode, dan penerjemahannya menjadi urusan komponen yang menampilkan.
 *
 * `message` tetap diisi bahasa Inggris sebagai jaring pengaman: ia yang muncul
 * di log dan di stack trace, tempat penerjemahan justru tidak diinginkan. */
export type MathErrorCode =
  | "unknownChar" | "incomplete" | "unclosedParen" | "unclosedFuncParen"
  | "unknownVariable" | "unexpectedToken" | "trailingTokens";

export class MathExprError extends Error {
  /* Ditulis sebagai field biasa, BUKAN parameter property (`readonly code`
   * di daftar argumen). Repo ini menjalankan TypeScript lewat
   * --experimental-strip-types, yang hanya membuang anotasi tipe; parameter
   * property menuntut pembangkitan kode dan karena itu ditolak Node dengan
   * ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX saat skrip uji memuat berkas ini. */
  code: MathErrorCode;
  detail?: string;

  constructor(code: MathErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "MathExprError";
    this.code = code;
    this.detail = detail;
  }
}


type Tok = { t: "num" | "id" | "op" | "lp" | "rp" | "comma"; v: string };

const FUNCS: Record<string, (...a: number[]) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  ln: Math.log, log: (x, b) => (b === undefined ? Math.log10(x) : Math.log(x) / Math.log(b)),
  log2: Math.log2, exp: Math.exp, sqrt: Math.sqrt, cbrt: Math.cbrt,
  abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  sign: Math.sign, min: Math.min, max: Math.max,
  nCr: (n, r) => fact(n) / (fact(r) * fact(n - r)),
  nPr: (n, r) => fact(n) / fact(n - r),
  root: (n, x) => Math.sign(x) * Math.pow(Math.abs(x), 1 / n),
};

const CONSTS: Record<string, number> = { pi: Math.PI, PI: Math.PI, e: Math.E, tau: Math.PI * 2, inf: Infinity };

function fact(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const s = src.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/π/g, "pi").replace(/√/g, "sqrt");
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      if (s[j] === "e" && /[0-9+-]/.test(s[j + 1] ?? "")) { j++; if (/[+-]/.test(s[j])) j++; while (j < s.length && /[0-9]/.test(s[j])) j++; }
      out.push({ t: "num", v: s.slice(i, j) }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      out.push({ t: "id", v: s.slice(i, j) }); i = j; continue;
    }
    if (c === "(") { out.push({ t: "lp", v: c }); i++; continue; }
    if (c === ")") { out.push({ t: "rp", v: c }); i++; continue; }
    if (c === ",") { out.push({ t: "comma", v: c }); i++; continue; }
    if ("+-*/^%!".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    throw new MathExprError("unknownChar", c);
  }
  return out;
}

export type Scope = Record<string, number>;

export function evaluate(src: string, scope: Scope = {}): number {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = () => toks[p++];

  // sisipkan perkalian implisit: 2x, 2(, )(, x(, )y
  const needsMul = (a: Tok, b: Tok) =>
    (a.t === "num" || a.t === "rp" || (a.t === "id" && !(b.t === "lp" && FUNCS[a.v]))) &&
    (b.t === "num" || b.t === "id" || b.t === "lp");

  const expanded: Tok[] = [];
  for (let k = 0; k < toks.length; k++) {
    expanded.push(toks[k]);
    if (k + 1 < toks.length && needsMul(toks[k], toks[k + 1])) expanded.push({ t: "op", v: "*" });
  }
  toks.length = 0; toks.push(...expanded);

  function primary(): number {
    const t = peek();
    if (!t) throw new MathExprError("incomplete");
    if (t.t === "op" && (t.v === "-" || t.v === "+")) { eat(); const v = unary(); return t.v === "-" ? -v : v; }
    if (t.t === "num") { eat(); return Number(t.v); }
    if (t.t === "lp") { eat(); const v = expr(); if (peek()?.t !== "rp") throw new MathExprError("unclosedParen"); eat(); return v; }
    if (t.t === "id") {
      eat();
      if (FUNCS[t.v] && peek()?.t === "lp") {
        eat();
        const args: number[] = [];
        if (peek()?.t !== "rp") {
          args.push(expr());
          while (peek()?.t === "comma") { eat(); args.push(expr()); }
        }
        if (peek()?.t !== "rp") throw new MathExprError("unclosedFuncParen");
        eat();
        return FUNCS[t.v](...args);
      }
      if (t.v in scope) return scope[t.v];
      if (t.v in CONSTS) return CONSTS[t.v];
      throw new MathExprError("unknownVariable", String(t.v));
    }
    throw new MathExprError("unexpectedToken", String(t.v));
  }

  function postfix(): number {
    let v = primary();
    while (peek()?.t === "op" && peek()!.v === "!") { eat(); v = fact(v); }
    return v;
  }

  function power(): number {
    const base = postfix();
    if (peek()?.t === "op" && peek()!.v === "^") { eat(); return Math.pow(base, unary()); }
    return base;
  }

  function unary(): number {
    const t = peek();
    if (t?.t === "op" && (t.v === "-" || t.v === "+")) { eat(); const v = unary(); return t.v === "-" ? -v : v; }
    return power();
  }

  function term(): number {
    let v = unary();
    while (peek()?.t === "op" && "*/%".includes(peek()!.v)) {
      const op = eat().v; const r = unary();
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  }

  function expr(): number {
    let v = term();
    while (peek()?.t === "op" && "+-".includes(peek()!.v)) {
      const op = eat().v; const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  const result = expr();
  if (p < toks.length) throw new MathExprError("trailingTokens");
  return result;
}

/** Kompilasi jadi fungsi f(x) untuk plotting. Mengembalikan NaN bila tak terdefinisi. */
export function compile(exprStr: string, varName = "x") {
  return (x: number) => {
    try {
      const v = evaluate(exprStr, { [varName]: x });
      return Number.isFinite(v) ? v : NaN;
    } catch {
      return NaN;
    }
  };
}

/* =========================================================================
 * Pemecah untuk plot: menerima BUKAN HANYA "y = f(x)".
 *
 * Yang didukung:
 *   x^2 - 3x + 2      ekspresi biasa
 *   y = 2x + 1        awalan y= dibuang
 *   3x + 2y = 19      persamaan linear terhadap y  -> diselesaikan analitik
 *   x = 3             persamaan linear terhadap x  -> garis tegak
 *   x^2 + y^2 = 25    implisit apa pun             -> marching squares
 *
 * Ini yang membuat kalkulator grafik berguna untuk soal sistem persamaan dan
 * irisan kerucut: siswa bisa menyalin persamaan dari soal apa adanya.
 * ========================================================================= */

export interface PlotWindow { xmin: number; xmax: number; ymin: number; ymax: number }

export interface PlotSolver {
  ok: boolean;
  error?: string;
  /** Kumpulan polyline dalam koordinat dunia. */
  branches: (win: PlotWindow, samples?: number) => [number, number][][];
}

const EMPTY: PlotSolver = { ok: true, branches: () => [] };

const stripLabel = (s: string) =>
  s.replace(/^\s*(y\s*\d*|f\s*\(\s*x\s*\))\s*=\s*/i, "").trim();

function safeEval(src: string, scope: Scope): number {
  try {
    const v = evaluate(src, scope);
    return Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}

export function makeSolver(input: string): PlotSolver {
  const raw = (input ?? "").trim();
  if (!raw) return EMPTY;

  const eq = raw.split("=");
  if (eq.length > 2) return { ok: false, error: "Terlalu banyak tanda sama dengan", branches: () => [] };

  /* ---------------------------------------------------- bentuk eksplisit */
  if (eq.length === 1 || /^\s*(y\s*\d*|f\s*\(\s*x\s*\))\s*=/i.test(raw)) {
    const body = stripLabel(raw);
    try {
      evaluate(body, { x: 1 });                       // uji sintaks sekali
    } catch (e) {
      return { ok: false, error: pesan(e), branches: () => [] };
    }
    const f = compile(body);
    return {
      ok: true,
      branches: (win, samples = 600) => splitPolyline(
        sampleX(win, samples).map((x) => [x, f(x)] as [number, number]),
        win,
      ),
    };
  }

  /* ---------------------------------------------------- bentuk implisit */
  const [lhs, rhs] = eq;
  const F = (x: number, y: number) => safeEval(lhs, { x, y }) - safeEval(rhs, { x, y });

  try {
    evaluate(lhs, { x: 1, y: 1 });
    evaluate(rhs, { x: 1, y: 1 });
  } catch (e) {
    return { ok: false, error: pesan(e), branches: () => [] };
  }

  const kind = classify(F);

  if (kind === "linear-y") {
    return {
      ok: true,
      branches: (win, samples = 600) => splitPolyline(
        sampleX(win, samples).map((x) => {
          const c = F(x, 0);
          const m = F(x, 1) - c;                       // koefisien y
          return [x, -c / m] as [number, number];
        }),
        win,
      ),
    };
  }

  if (kind === "linear-x") {
    // persamaan tidak memuat y: selesaikan untuk x, hasilnya garis tegak
    const c = F(0, 0);
    const m = F(1, 0) - c;
    const x0 = -c / m;
    return {
      ok: true,
      branches: (win) =>
        Number.isFinite(x0) && x0 >= win.xmin && x0 <= win.xmax
          ? [[[x0, win.ymin], [x0, win.ymax]]]
          : [],
    };
  }

  if (kind === "degenerate") {
    return { ok: false, error: "Persamaan tidak memuat x maupun y", branches: () => [] };
  }

  // implisit umum -> marching squares
  return { ok: true, branches: (win, samples = 220) => marchingSquares(F, win, Math.min(samples, 260)) };
}

/* ------------------------------------------------------------- pembantu */

function classify(F: (x: number, y: number) => number): "linear-y" | "linear-x" | "nonlinear" | "degenerate" {
  const probes = [-3.7, -1.1, 0.3, 2.9];
  let linearInY = true;
  let dependsOnY = false;

  for (const x of probes) {
    const a = F(x, 0), b = F(x, 1), c = F(x, 2);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) { linearInY = false; break; }
    const d1 = b - a, d2 = c - b;
    if (Math.abs(d1) > 1e-9) dependsOnY = true;
    // selisih pertama harus konstan kalau F linear terhadap y
    if (Math.abs(d2 - d1) > 1e-7 * Math.max(1, Math.abs(d1))) { linearInY = false; break; }
  }

  if (linearInY && dependsOnY) return "linear-y";
  if (!dependsOnY) {
    const a = F(0, 0), b = F(1, 0), c = F(2, 0);
    if (![a, b, c].every(Number.isFinite)) return "nonlinear";
    const d1 = b - a, d2 = c - b;
    if (Math.abs(d1) < 1e-12) return "degenerate";
    return Math.abs(d2 - d1) < 1e-7 * Math.max(1, Math.abs(d1)) ? "linear-x" : "nonlinear";
  }
  return "nonlinear";
}

function sampleX(win: PlotWindow, n: number) {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(win.xmin + ((win.xmax - win.xmin) * i) / n);
  return out;
}

/** Putus polyline di titik yang tak terdefinisi atau melompat jauh (asimtot). */
function splitPolyline(pts: [number, number][], win: PlotWindow): [number, number][][] {
  const span = win.ymax - win.ymin;
  const out: [number, number][][] = [];
  let cur: [number, number][] = [];
  let prev: number | null = null;

  for (const [x, y] of pts) {
    const usable = Number.isFinite(y) && y > win.ymin - span * 3 && y < win.ymax + span * 3;
    const jumped = prev !== null && Math.abs(y - prev) > span * 2;
    if (!usable || jumped) {
      if (cur.length > 1) out.push(cur);
      cur = [];
      prev = null;
      if (!usable) continue;
    }
    cur.push([x, y]);
    prev = y;
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

/** Marching squares sederhana untuk kurva implisit F(x, y) = 0. */
function marchingSquares(
  F: (x: number, y: number) => number,
  win: PlotWindow,
  n: number,
): [number, number][][] {
  const dx = (win.xmax - win.xmin) / n;
  const dy = (win.ymax - win.ymin) / n;

  const grid: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const col: number[] = [];
    for (let j = 0; j <= n; j++) col.push(F(win.xmin + i * dx, win.ymin + j * dy));
    grid.push(col);
  }

  const segs: [number, number][][] = [];
  const cross = (v1: number, v2: number) => v1 / (v1 - v2);   // 0..1 di sepanjang sisi

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x0 = win.xmin + i * dx, y0 = win.ymin + j * dy;
      const a = grid[i][j], b = grid[i + 1][j], c = grid[i + 1][j + 1], d = grid[i][j + 1];
      if (![a, b, c, d].every(Number.isFinite)) continue;

      const hits: [number, number][] = [];
      if ((a < 0) !== (b < 0)) hits.push([x0 + cross(a, b) * dx, y0]);
      if ((b < 0) !== (c < 0)) hits.push([x0 + dx, y0 + cross(b, c) * dy]);
      if ((d < 0) !== (c < 0)) hits.push([x0 + cross(d, c) * dx, y0 + dy]);
      if ((a < 0) !== (d < 0)) hits.push([x0, y0 + cross(a, d) * dy]);

      if (hits.length === 2) segs.push([hits[0], hits[1]]);
      else if (hits.length === 4) { segs.push([hits[0], hits[1]]); segs.push([hits[2], hits[3]]); }
    }
  }
  return segs;
}

const pesan = (e: unknown) => (e instanceof Error ? e.message : "Ekspresi tidak valid");
