/* Exact Worksheet Maker — Diagram Engine
 * Pure vanilla JS, no external libraries. Renders math diagrams (function
 * graphs, geometry, number lines, Venn diagrams, statistics charts, factor
 * trees) as inline SVG strings, driven by a compact tag syntax embedded in
 * the raw worksheet text: [[type: key=value; key2=value2]].
 */

// ---------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------

function escText(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function numOrDefault(v, def) {
  const n = parseFloat(v);
  return isFinite(n) ? n : def;
}

function niceStep(range) {
  const raw = range / 8;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const norm = raw / mag;
  let step;
  if (norm < 1.5) step = 1;
  else if (norm < 3.5) step = 2;
  else if (norm < 7.5) step = 5;
  else step = 10;
  return step * mag || 1;
}

const MATH_FUNCS = [
  'asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'sqrt', 'abs',
  'log10', 'log', 'exp', 'floor', 'ceil', 'round', 'min', 'max', 'pow',
];

// JS's native "**" rejects a unary minus directly before it (e.g. "-(x-1)**2"
// throws a SyntaxError — "Unary operator used immediately before exponentiation
// expression"), which silently broke any "^" expression shaped like -(...)^n.
// Converting "A^B" to a POW(A,B) call instead sidesteps the whole grammar
// restriction: a function call is never ambiguous with a leading unary minus,
// and -POW(x,2) correctly means -(x^2) — the standard math reading of -x^2.
function convertCaretToPow(expr) {
  let s = expr;
  const leftAtomRe = /((?:[A-Za-z_][A-Za-z0-9_.]*)?\([^()]*\)|[A-Za-z0-9_.]+)$/;
  const rightAtomRe = /^(-?(?:[A-Za-z_][A-Za-z0-9_.]*)?\([^()]*\)|-?[A-Za-z0-9_.]+)/;
  for (let guard = 0; guard < 30; guard++) {
    const idx = s.indexOf('^');
    if (idx === -1) break;
    const leftPart = s.slice(0, idx);
    const rightPart = s.slice(idx + 1);
    const leftMatch = leftPart.match(leftAtomRe);
    const rightMatch = rightPart.match(rightAtomRe);
    if (!leftMatch || !rightMatch) break;
    const left = leftMatch[0];
    const right = rightMatch[0];
    const before = leftPart.slice(0, leftPart.length - left.length);
    const after = rightPart.slice(right.length);
    s = before + 'POW(' + left + ',' + right + ')' + after;
  }
  return s;
}

// Math notation allows "9x", "2(x-1)", "(x+1)(x-2)" — juxtaposition means
// multiplication. JS has no such rule (a bare "9x-16" is either a syntax
// error or silently wrong), so a expr written the natural math way
// compiles to a function that always returns NaN and draws nothing, with
// no visible error anywhere. Inserting the "*" back in for the
// unambiguous cases (digit-then-letter, digit/paren-then-paren,
// paren-then-letter/digit/paren) fixes this before it ever reaches JS.
// Deliberately NOT handling letter-immediately-before-"(" — that's exactly
// the shape of a function call ("sin(", "sqrt(") and inserting "*" there
// would break it.
function insertImplicitMultiplication(expr) {
  let s = expr;
  // (?<!log1) guards the "0(" inside "log10(" — the one function name with
  // a digit right before its call paren, which otherwise looks exactly
  // like "9(x+1)" (an implied multiply) and would get split in two.
  s = s.replace(/(?<!log1)(\d)(\s*)([A-Za-z(])/g, (m, d, sp, next) => `${d}${sp}*${sp}${next}`);
  s = s.replace(/(\))(\s*)([0-9A-Za-z(])/g, (m, paren, sp, next) => `${paren}${sp}*${sp}${next}`);
  return s;
}

function compileExpr(exprStr) {
  let s = String(exprStr || 'x').trim();
  s = insertImplicitMultiplication(s);
  MATH_FUNCS.forEach((fn) => {
    s = s.replace(new RegExp('\\b' + fn + '\\(', 'g'), 'Math.' + fn + '(');
  });
  s = s.replace(/\bpi\b/g, 'Math.PI');
  s = s.replace(/\be\b/g, 'Math.E');
  s = convertCaretToPow(s);
  let fn;
  try {
    // eslint-disable-next-line no-new-func
    fn = new Function('x', 'POW', '"use strict"; return (' + s + ');');
  } catch (err) {
    return () => NaN;
  }
  return (x) => {
    try {
      const v = fn(x, Math.pow);
      return typeof v === 'number' && isFinite(v) ? v : NaN;
    } catch {
      return NaN;
    }
  };
}

// ---------------------------------------------------------------------
// 1. Grafik Fungsi
// ---------------------------------------------------------------------

function formatTick(v) {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? '0' : String(r);
}

// "f1:2,5" (optionally several, separated by "|") -> { f1: [2, 5] }.
// Shared by "arsir" (shade under a curve between two x values) and
// "domain" (only plot a curve between them).
function parseCurveRange(raw) {
  const out = {};
  String(raw || '').split('|').map((s) => s.trim()).filter(Boolean).forEach((chunk) => {
    const idx = chunk.indexOf(':');
    if (idx === -1) return;
    const key = chunk.slice(0, idx).trim();
    const nums = chunk.slice(idx + 1).split(',').map((n) => parseFloat(n.trim()));
    if (key && isFinite(nums[0]) && isFinite(nums[1])) out[key] = [nums[0], nums[1]];
  });
  return out;
}

// "f1:3" -> { f1: 3 } — the x value a tangent line is drawn at.
function parseCurvePoint(raw) {
  const out = {};
  String(raw || '').split('|').map((s) => s.trim()).filter(Boolean).forEach((chunk) => {
    const idx = chunk.indexOf(':');
    if (idx === -1) return;
    const key = chunk.slice(0, idx).trim();
    const v = parseFloat(chunk.slice(idx + 1));
    if (key && isFinite(v)) out[key] = v;
  });
  return out;
}

// "x=2, y=0" -> [{ axis: 'x', value: 2 }, ...]
function parseAsymptotes(raw) {
  return String(raw || '').split(',').map((s) => s.trim()).filter(Boolean).map((chunk) => {
    const m = chunk.match(/^([xy])\s*=\s*(-?[\d.]+)$/i);
    return m ? { axis: m[1].toLowerCase(), value: parseFloat(m[2]) } : null;
  }).filter(Boolean);
}

function renderFunctionGraphSVG(cfg) {
  const width = 400, chartH = 300, pad = 36;
  const FN_KEYS = ['f1', 'f2', 'f3', 'f4', 'f5'];
  const activeFns = FN_KEYS.map((key, i) => ({ key, i, expr: cfg[key] })).filter((f) => f.expr);
  // A legend strip only earns its keep once there's more than one curve —
  // with just f1, "which dash is which" has nothing to disambiguate.
  const legendH = activeFns.length > 1 ? 18 * activeFns.length + 14 : 0;
  const height = chartH + legendH;
  const xmin = numOrDefault(cfg.xmin, -10), xmax = numOrDefault(cfg.xmax, 10);
  const ymin = numOrDefault(cfg.ymin, -10), ymax = numOrDefault(cfg.ymax, 10);
  const sx = (width - 2 * pad) / (xmax - xmin || 1);
  const sy = (chartH - 2 * pad) / (ymax - ymin || 1);
  const toPx = (x, y) => [pad + (x - xmin) * sx, chartH - pad - (y - ymin) * sy];

  // Axis captions ("Waktu (s)") are drawn in a margin added OUTSIDE the
  // existing plot box, and the whole original drawing is shifted right by
  // the left margin — that way none of the geometry below has to change.
  const extraLeft = cfg.sumbuy ? 16 : 0;
  const extraBottom = cfg.sumbux ? 18 : 0;
  const totalW = width + extraLeft;
  const totalH = height + extraBottom;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${totalW - 1}" height="${totalH - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  if (cfg.sumbux) {
    svg += `<text x="${(totalW / 2).toFixed(1)}" y="${(totalH - 5).toFixed(1)}" text-anchor="middle" font-size="11" fill="#000000">${escText(cfg.sumbux)}</text>`;
  }
  if (cfg.sumbuy) {
    const cy = chartH / 2;
    svg += `<text x="11" y="${cy.toFixed(1)}" text-anchor="middle" font-size="11" fill="#000000" transform="rotate(-90 11 ${cy.toFixed(1)})">${escText(cfg.sumbuy)}</text>`;
  }
  svg += `<g transform="translate(${extraLeft},0)">`;

  const xAxisY = (ymin <= 0 && ymax >= 0) ? toPx(0, 0)[1] : chartH - pad;
  const yAxisX = (xmin <= 0 && xmax >= 0) ? toPx(0, 0)[0] : pad;

  const xStep = niceStep(xmax - xmin), yStep = niceStep(ymax - ymin);
  for (let gx = Math.ceil(xmin / xStep) * xStep; gx <= xmax; gx += xStep) {
    const [px] = toPx(gx, 0);
    svg += `<line x1="${px.toFixed(1)}" y1="${pad}" x2="${px.toFixed(1)}" y2="${chartH - pad}" stroke="#eef0f3" stroke-width="1"/>`;
    if (Math.abs(gx) > 1e-9) {
      svg += `<text x="${px.toFixed(1)}" y="${(xAxisY + 13).toFixed(1)}" font-size="9.5" text-anchor="middle" fill="#64748b">${formatTick(gx)}</text>`;
    }
  }
  for (let gy = Math.ceil(ymin / yStep) * yStep; gy <= ymax; gy += yStep) {
    const [, py] = toPx(0, gy);
    svg += `<line x1="${pad}" y1="${py.toFixed(1)}" x2="${width - pad}" y2="${py.toFixed(1)}" stroke="#eef0f3" stroke-width="1"/>`;
    if (Math.abs(gy) > 1e-9) {
      svg += `<text x="${(yAxisX - 5).toFixed(1)}" y="${(py + 3).toFixed(1)}" font-size="9.5" text-anchor="end" fill="#64748b">${formatTick(gy)}</text>`;
    }
  }
  if (xmin <= 0 && xmax >= 0) {
    const [px0] = toPx(0, 0);
    svg += `<line x1="${px0.toFixed(1)}" y1="${pad}" x2="${px0.toFixed(1)}" y2="${chartH - pad}" stroke="#94a3b8" stroke-width="1.4"/>`;
  }
  if (ymin <= 0 && ymax >= 0) {
    const [, py0] = toPx(0, 0);
    svg += `<line x1="${pad}" y1="${py0.toFixed(1)}" x2="${width - pad}" y2="${py0.toFixed(1)}" stroke="#94a3b8" stroke-width="1.4"/>`;
  }
  if (xmin <= 0 && xmax >= 0 && ymin <= 0 && ymax >= 0) {
    const [ox, oy] = toPx(0, 0);
    svg += `<text x="${(ox - 5).toFixed(1)}" y="${(oy + 13).toFixed(1)}" font-size="9.5" text-anchor="end" fill="#64748b">0</text>`;
  }

  // All curves are plotted in black (print-friendly, no ink-heavy color
  // fills) — with multiple functions on one graph, dash patterns take over
  // the job color used to do for telling them apart. Up to 5 functions
  // (f1..f5) fit on one Cartesian plane; a legend (below) spells out which
  // dash pattern is which expression once there's more than one curve,
  // since dash patterns alone stop being readable past two or three.
  const dashPatterns = ['none', '6,4', '2,3', '8,3,2,3', '3,3'];
  const domains = parseCurveRange(cfg.domain);
  const shades = parseCurveRange(cfg.arsir);
  const tangents = parseCurvePoint(cfg.singgung);

  // Shaded region under a curve ("luas di bawah kurva") is drawn BEFORE the
  // curves, so the curve outline stays crisp on top of the fill. A flat
  // translucent grey rather than a hatch pattern: <pattern> needs a
  // document-unique id, and a page carries many diagrams at once.
  Object.keys(shades).forEach((key) => {
    const spec = activeFns.find((f) => f.key === key);
    if (!spec) return;
    const fn = compileExpr(spec.expr);
    const [lo, hi] = shades[key];
    const from = Math.max(xmin, Math.min(lo, hi));
    const to = Math.min(xmax, Math.max(lo, hi));
    if (!(to > from)) return;
    const steps = 120;
    let d = 'M' + toPx(from, 0).map((n) => n.toFixed(1)).join(' ') + ' ';
    for (let k = 0; k <= steps; k++) {
      const x = from + (to - from) * k / steps;
      const y = Math.max(ymin, Math.min(ymax, fn(x)));
      if (!isFinite(y)) continue;
      d += 'L' + toPx(x, y).map((n) => n.toFixed(1)).join(' ') + ' ';
    }
    d += 'L' + toPx(to, 0).map((n) => n.toFixed(1)).join(' ') + ' Z';
    svg += `<path d="${d}" fill="#000000" fill-opacity="0.12" stroke="none"/>`;
  });

  parseAsymptotes(cfg.asimtot).forEach((a) => {
    if (a.axis === 'x') {
      if (a.value < xmin || a.value > xmax) return;
      const [px] = toPx(a.value, 0);
      svg += `<line x1="${px.toFixed(1)}" y1="${pad}" x2="${px.toFixed(1)}" y2="${chartH - pad}" stroke="#000000" stroke-width="1.2" stroke-dasharray="4,4"/>`;
      svg += `<text x="${(px + 4).toFixed(1)}" y="${(pad + 10).toFixed(1)}" font-size="9.5" fill="#000000">x=${formatTick(a.value)}</text>`;
    } else {
      if (a.value < ymin || a.value > ymax) return;
      const [, py] = toPx(0, a.value);
      svg += `<line x1="${pad}" y1="${py.toFixed(1)}" x2="${width - pad}" y2="${py.toFixed(1)}" stroke="#000000" stroke-width="1.2" stroke-dasharray="4,4"/>`;
      svg += `<text x="${(width - pad - 4).toFixed(1)}" y="${(py - 4).toFixed(1)}" font-size="9.5" text-anchor="end" fill="#000000">y=${formatTick(a.value)}</text>`;
    }
  });

  activeFns.forEach(({ key, expr, i }) => {
    const fn = compileExpr(expr);
    // A restricted domain plots the curve only where the question defines
    // it, instead of running edge to edge of the axes.
    const dom = domains[key];
    const plotFrom = dom ? Math.max(xmin, Math.min(dom[0], dom[1])) : xmin;
    const plotTo = dom ? Math.min(xmax, Math.max(dom[0], dom[1])) : xmax;
    let d = '', have = false, prevPy = null;
    const steps = 240;
    for (let s = 0; s <= steps; s++) {
      const x = plotFrom + (plotTo - plotFrom) * s / steps;
      const y = fn(x);
      if (!isFinite(y) || y < ymin - (ymax - ymin) * 2 || y > ymax + (ymax - ymin) * 2) {
        have = false;
        continue;
      }
      const [px, py] = toPx(x, y);
      if (have && prevPy !== null && Math.abs(py - prevPy) > chartH * 0.85) have = false;
      d += (have ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1) + ' ';
      have = true;
      prevPy = py;
    }
    svg += `<path d="${d}" fill="none" stroke="#000000" stroke-width="2" stroke-dasharray="${dashPatterns[i]}"/>`;
  });

  (cfg.titik || []).forEach((p) => {
    const [px, py] = toPx(p.x, p.y);
    svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3" fill="#000000"/>`;
    if (p.label) {
      svg += `<text x="${(px + 5).toFixed(1)}" y="${(py - 5).toFixed(1)}" font-size="11" fill="#000000">${escText(p.label)}</text>`;
    }
  });

  // Tangent line with the gradient triangle a mark scheme expects to see:
  // a horizontal run and a vertical rise, both labelled, so the student
  // reads the gradient off the drawing rather than being told it.
  Object.keys(tangents).forEach((key) => {
    const spec = activeFns.find((f) => f.key === key);
    if (!spec) return;
    const fn = compileExpr(spec.expr);
    const x0 = tangents[key];
    const y0 = fn(x0);
    if (!isFinite(y0)) return;
    const h = (xmax - xmin) / 1000;
    const slope = (fn(x0 + h) - fn(x0 - h)) / (2 * h);
    if (!isFinite(slope)) return;
    const half = (xmax - xmin) * 0.28;
    const x1 = x0 - half, x2 = x0 + half;
    const p1 = toPx(x1, y0 + slope * (x1 - x0));
    const p2 = toPx(x2, y0 + slope * (x2 - x0));
    svg += `<line x1="${p1[0].toFixed(1)}" y1="${p1[1].toFixed(1)}" x2="${p2[0].toFixed(1)}" y2="${p2[1].toFixed(1)}" stroke="#000000" stroke-width="1.3" stroke-dasharray="7,3"/>`;
    const [cx, cy] = toPx(x0, y0);
    svg += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3" fill="#000000"/>`;

    const runX = x0 + half * 0.6;
    const runEndY = y0 + slope * (runX - x0);
    const a = toPx(x0, y0), b = toPx(runX, y0), c = toPx(runX, runEndY);
    svg += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#000000" stroke-width="1" stroke-dasharray="2,2"/>`;
    svg += `<line x1="${b[0].toFixed(1)}" y1="${b[1].toFixed(1)}" x2="${c[0].toFixed(1)}" y2="${c[1].toFixed(1)}" stroke="#000000" stroke-width="1" stroke-dasharray="2,2"/>`;
    svg += annotText((a[0] + b[0]) / 2, a[1] + 12, formatTick(runX - x0));
    svg += annotText(b[0] + 16, (b[1] + c[1]) / 2, formatTick(runEndY - y0));
  });

  if (legendH) {
    svg += `<line x1="0.5" y1="${chartH}" x2="${width - 0.5}" y2="${chartH}" stroke="#eef0f3" stroke-width="1"/>`;
    activeFns.forEach(({ expr, i }, row) => {
      const ly = chartH + 18 + row * 18;
      svg += `<line x1="16" y1="${ly - 4}" x2="46" y2="${ly - 4}" stroke="#000000" stroke-width="2" stroke-dasharray="${dashPatterns[i]}"/>`;
      svg += `<text x="54" y="${ly}" font-size="11" fill="#000000">${escText('f' + (i + 1))} = ${escText(expr)}</text>`;
    });
  }

  svg += '</g></svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 1b. Program Linear (daerah himpunan penyelesaian)
// ---------------------------------------------------------------------

// "2x+y<=10" -> {a:2, b:1, op:'<=', c:10}. Deliberately simple (only
// handles a linear combination of bare x/y terms on the left, a number on
// the right) since that's the only shape a linear-programming constraint
// ever takes in a worksheet.
function parseLinearIneq(raw) {
  const str = String(raw || '').trim();
  const opMatch = str.match(/(<=|>=|<|>|=)/);
  if (!opMatch) return null;
  const op = opMatch[0];
  const idx = str.indexOf(op);
  const lhs = str.slice(0, idx);
  const rhsNum = parseFloat(str.slice(idx + op.length));
  let a = 0, b = 0;
  const termRe = /([+-]?\s*\d*\.?\d*)\s*([xy])/g;
  let m;
  while ((m = termRe.exec(lhs))) {
    const coefStr = m[1].replace(/\s+/g, '');
    let coef;
    if (coefStr === '' || coefStr === '+') coef = 1;
    else if (coefStr === '-') coef = -1;
    else coef = parseFloat(coefStr);
    if (!isFinite(coef)) coef = 1;
    if (m[2] === 'x') a += coef; else b += coef;
  }
  return { a, b, op, c: isFinite(rhsNum) ? rhsNum : 0, raw: str };
}

// Flips ">="/">" to "<=" (negating all three coefficients) so every
// constraint can be tested the same way: feasible <=> a*x + b*y <= c.
function normalizeIneq(ineq) {
  if (ineq.op === '>=' || ineq.op === '>') return { a: -ineq.a, b: -ineq.b, c: -ineq.c, strict: ineq.op === '>' };
  return { a: ineq.a, b: ineq.b, c: ineq.c, strict: ineq.op === '<' };
}

// Clips the infinite line a*x+b*y=c to the plotted [xmin,xmax]x[ymin,ymax]
// box by intersecting it with all four edges and keeping the two points
// that actually land on the box — the general way to draw "the part of
// this line that's on screen" without knowing its slope in advance.
function clipLineToRect(a, b, c, xmin, xmax, ymin, ymax) {
  const eps = 1e-6;
  const pts = [];
  if (Math.abs(b) > 1e-9) {
    let y = (c - a * xmin) / b;
    if (y >= ymin - eps && y <= ymax + eps) pts.push({ x: xmin, y });
    y = (c - a * xmax) / b;
    if (y >= ymin - eps && y <= ymax + eps) pts.push({ x: xmax, y });
  }
  if (Math.abs(a) > 1e-9) {
    let x = (c - b * ymin) / a;
    if (x >= xmin - eps && x <= xmax + eps) pts.push({ x, y: ymin });
    x = (c - b * ymax) / a;
    if (x >= xmin - eps && x <= xmax + eps) pts.push({ x, y: ymax });
  }
  const uniq = [];
  pts.forEach((p) => { if (!uniq.some((q) => Math.abs(q.x - p.x) < 1e-4 && Math.abs(q.y - p.y) < 1e-4)) uniq.push(p); });
  if (uniq.length < 2) return null;
  let best = null, bestD = -1;
  for (let i = 0; i < uniq.length; i++) {
    for (let j = i + 1; j < uniq.length; j++) {
      const d = Math.hypot(uniq[i].x - uniq[j].x, uniq[i].y - uniq[j].y);
      if (d > bestD) { bestD = d; best = [uniq[i], uniq[j]]; }
    }
  }
  return best;
}

function renderLinearProgramSVG(cfg) {
  const rawList = String(cfg.pertidaksamaan || '').split(',').map((s) => s.trim()).filter(Boolean);
  let ineqs = rawList.map(parseLinearIneq).filter(Boolean);
  if (!ineqs.length) ineqs = [parseLinearIneq('x>=0'), parseLinearIneq('y>=0')];
  const norm = ineqs.map(normalizeIneq);

  const width = 400, chartH = 320, pad = 40;
  // LP problems live in the first quadrant by convention, so default the
  // window there instead of the ±10 a generic function graph would use.
  const xmin = numOrDefault(cfg.xmin, 0), xmax = numOrDefault(cfg.xmax, 10);
  const ymin = numOrDefault(cfg.ymin, 0), ymax = numOrDefault(cfg.ymax, 10);
  const sx = (width - 2 * pad) / (xmax - xmin || 1);
  const sy = (chartH - 2 * pad) / (ymax - ymin || 1);
  const toPx = (x, y) => [pad + (x - xmin) * sx, chartH - pad - (y - ymin) * sy];
  const legendH = 16 * rawList.length + 14;
  const height = chartH + legendH;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  const xStep = niceStep(xmax - xmin), yStep = niceStep(ymax - ymin);
  for (let gx = Math.ceil(xmin / xStep) * xStep; gx <= xmax; gx += xStep) {
    const [px] = toPx(gx, 0);
    svg += `<line x1="${px.toFixed(1)}" y1="${pad}" x2="${px.toFixed(1)}" y2="${chartH - pad}" stroke="#eef0f3" stroke-width="1"/>`;
    svg += `<text x="${px.toFixed(1)}" y="${(chartH - pad + 13).toFixed(1)}" font-size="9.5" text-anchor="middle" fill="#64748b">${formatTick(gx)}</text>`;
  }
  for (let gy = Math.ceil(ymin / yStep) * yStep; gy <= ymax; gy += yStep) {
    const [, py] = toPx(0, gy);
    svg += `<line x1="${pad}" y1="${py.toFixed(1)}" x2="${width - pad}" y2="${py.toFixed(1)}" stroke="#eef0f3" stroke-width="1"/>`;
    svg += `<text x="${(pad - 5).toFixed(1)}" y="${(py + 3).toFixed(1)}" font-size="9.5" text-anchor="end" fill="#64748b">${formatTick(gy)}</text>`;
  }
  svg += `<line x1="${pad}" y1="${(chartH - pad).toFixed(1)}" x2="${width - pad}" y2="${(chartH - pad).toFixed(1)}" stroke="#94a3b8" stroke-width="1.4"/>`;
  svg += `<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${(chartH - pad).toFixed(1)}" stroke="#94a3b8" stroke-width="1.4"/>`;

  // Feasible-region vertices: every pair of boundary lines is intersected,
  // and a candidate is kept only if it satisfies every other constraint —
  // the standard way to recover a convex polygon's corners from its
  // defining half-planes without any general polygon-clipping library.
  const feasiblePts = [];
  for (let i = 0; i < norm.length; i++) {
    for (let j = i + 1; j < norm.length; j++) {
      const det = norm[i].a * norm[j].b - norm[j].a * norm[i].b;
      if (Math.abs(det) < 1e-9) continue;
      const x = (norm[i].c * norm[j].b - norm[j].c * norm[i].b) / det;
      const y = (norm[i].a * norm[j].c - norm[j].a * norm[i].c) / det;
      if (x < xmin - 1e-6 || x > xmax + 1e-6 || y < ymin - 1e-6 || y > ymax + 1e-6) continue;
      if (norm.every((k) => k.a * x + k.b * y <= k.c + 1e-6)) feasiblePts.push({ x, y });
    }
  }
  const vertices = [];
  feasiblePts.forEach((p) => {
    if (!vertices.some((q) => Math.abs(q.x - p.x) < 1e-3 && Math.abs(q.y - p.y) < 1e-3)) vertices.push(p);
  });
  if (vertices.length >= 3) {
    const cx0 = vertices.reduce((s, p) => s + p.x, 0) / vertices.length;
    const cy0 = vertices.reduce((s, p) => s + p.y, 0) / vertices.length;
    vertices.sort((p, q) => Math.atan2(p.y - cy0, p.x - cx0) - Math.atan2(q.y - cy0, q.x - cx0));
    const patternId = 'lpHatch' + Math.abs((xmax - xmin) * 977 + (ymax - ymin) * 331 + vertices.length).toString(36);
    svg += `<defs><pattern id="${patternId}" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="7" stroke="#334155" stroke-width="1.4"/></pattern></defs>`;
    const pts = vertices.map((p) => toPx(p.x, p.y).map((v) => v.toFixed(1)).join(',')).join(' ');
    svg += `<polygon points="${pts}" fill="url(#${patternId})" fill-opacity="0.6" stroke="none"/>`;
  }

  norm.forEach((c, i) => {
    const seg = clipLineToRect(c.a, c.b, c.c, xmin, xmax, ymin, ymax);
    if (!seg) return;
    const [p1, p2] = seg;
    const [px1, py1] = toPx(p1.x, p1.y);
    const [px2, py2] = toPx(p2.x, p2.y);
    const dashAttr = c.strict ? ' stroke-dasharray="5,4"' : '';
    svg += `<line x1="${px1.toFixed(1)}" y1="${py1.toFixed(1)}" x2="${px2.toFixed(1)}" y2="${py2.toFixed(1)}" stroke="#000000" stroke-width="1.6"${dashAttr}/>`;
    const labelY = Math.min(Math.max(py2, pad + 12), chartH - pad - 4);
    svg += `<text x="${(px2 - 4).toFixed(1)}" y="${labelY.toFixed(1)}" font-size="10" text-anchor="end" fill="#000000">(${i + 1})</text>`;
  });

  if (vertices.length && cfg.titikpojok !== 'tidak') {
    vertices.forEach((p) => {
      const [px, py] = toPx(p.x, p.y);
      svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3" fill="#000000"/>`;
      svg += `<text x="${(px + 6).toFixed(1)}" y="${(py - 6).toFixed(1)}" font-size="10" fill="#000000">(${formatTick(p.x)}, ${formatTick(p.y)})</text>`;
    });
  }

  rawList.forEach((r, i) => {
    svg += `<text x="14" y="${(chartH + 18 + i * 16).toFixed(1)}" font-size="10.5" fill="#000000">(${i + 1}) ${escText(r)}</text>`;
  });

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 2. Bangun Geometri
// ---------------------------------------------------------------------

const GEOMETRY_PRESETS = {
  'segitiga-sembarang': {
    build: (p) => {
      const a = numOrDefault(p.a, 5), b = numOrDefault(p.b, 6), c = numOrDefault(p.c, 7);
      const x = (c * c - b * b + a * a) / (2 * a || 1);
      const y2 = c * c - x * x;
      const y = y2 > 0 ? Math.sqrt(y2) : 0.001;
      return {
        points: [{ name: 'A', x, y }, { name: 'B', x: 0, y: 0 }, { name: 'C', x: a, y: 0 }],
        segments: [
          { from: 'B', to: 'C', label: `a = ${a}` },
          { from: 'C', to: 'A', label: `b = ${b}` },
          { from: 'A', to: 'B', label: `c = ${c}` },
        ],
      };
    },
  },
  'segitiga-siku': {
    build: (p) => {
      const alas = numOrDefault(p.alas, 6), tinggi = numOrDefault(p.tinggi, 4);
      return {
        points: [{ name: 'A', x: 0, y: 0 }, { name: 'B', x: alas, y: 0 }, { name: 'C', x: 0, y: tinggi }],
        segments: [
          { from: 'A', to: 'B', label: `${alas}` },
          { from: 'A', to: 'C', label: `${tinggi}` },
          { from: 'B', to: 'C', label: '' },
        ],
      };
    },
  },
  persegi: {
    build: (p) => {
      const s = numOrDefault(p.sisi, 5);
      return {
        points: [{ name: 'A', x: 0, y: 0 }, { name: 'B', x: s, y: 0 }, { name: 'C', x: s, y: s }, { name: 'D', x: 0, y: s }],
        segments: [
          { from: 'A', to: 'B', label: `${s}` }, { from: 'B', to: 'C', label: `${s}` },
          { from: 'C', to: 'D', label: `${s}` }, { from: 'D', to: 'A', label: `${s}` },
        ],
      };
    },
  },
  'persegi-panjang': {
    build: (p) => {
      const pj = numOrDefault(p.panjang, 8), lb = numOrDefault(p.lebar, 5);
      return {
        points: [{ name: 'A', x: 0, y: 0 }, { name: 'B', x: pj, y: 0 }, { name: 'C', x: pj, y: lb }, { name: 'D', x: 0, y: lb }],
        segments: [
          { from: 'A', to: 'B', label: `${pj}` }, { from: 'B', to: 'C', label: `${lb}` },
          { from: 'C', to: 'D', label: `${pj}` }, { from: 'D', to: 'A', label: `${lb}` },
        ],
      };
    },
  },
  trapesium: {
    build: (p) => {
      const atas = numOrDefault(p.atas, 4), bawah = numOrDefault(p.bawah, 8), tinggi = numOrDefault(p.tinggi, 5);
      const offset = (bawah - atas) / 2;
      return {
        points: [
          { name: 'A', x: 0, y: 0 }, { name: 'B', x: bawah, y: 0 },
          { name: 'C', x: bawah - offset, y: tinggi }, { name: 'D', x: offset, y: tinggi },
        ],
        segments: [
          { from: 'A', to: 'B', label: `${bawah}` }, { from: 'B', to: 'C', label: '' },
          { from: 'C', to: 'D', label: `${atas}` }, { from: 'D', to: 'A', label: '' },
        ],
      };
    },
  },
  lingkaran: {
    build: (p) => {
      const r = numOrDefault(p.jari, 4);
      return { points: [{ name: 'O', x: 0, y: 0 }], circles: [{ center: 'O', radius: r, label: `r = ${r}` }] };
    },
  },
  'setengah-lingkaran': {
    // No true arc primitive in this points/segments/circles model, so the
    // curve is approximated with a fan of straight segments — invisible at
    // worksheet print sizes, and it lets a semicircle be just another
    // "polygons" loop, combinable with any other preset via "gabungan".
    build: (p) => {
      const r = numOrDefault(p.jari, 4);
      const steps = 20;
      const points = [
        { name: 'A', x: -r, y: 0 },
        { name: 'B', x: r, y: 0 },
      ];
      const arcNames = [];
      for (let i = 1; i < steps; i++) {
        const t = Math.PI * (1 - i / steps);
        const name = 'arc' + i;
        points.push({ name, x: r * Math.cos(t), y: r * Math.sin(t), hidden: true });
        arcNames.push(name);
      }
      return {
        points,
        polygons: [['A', 'B', ...arcNames]],
        segments: [{ from: 'A', to: 'B', label: `d = ${2 * r}` }],
      };
    },
  },
};

// Combines several GEOMETRY_PRESETS shapes, each placed at its own (x,y)
// offset, into one shape with multiple independent polygon loops — used by
// bentuk=gabungan for composite figures like a rectangle topped with a
// semicircle. Sub-shape syntax: "nama:key=val,key=val|nama2:key=val,...".
function buildGabungan(bagianRaw) {
  const parts = String(bagianRaw || '').split('|').map((s) => s.trim()).filter(Boolean);
  const points = [], polygons = [], segments = [], circles = [];
  parts.forEach((partStr, idx) => {
    const colonIdx = partStr.indexOf(':');
    const shapeName = (colonIdx > -1 ? partStr.slice(0, colonIdx) : partStr).trim();
    const paramsRaw = colonIdx > -1 ? partStr.slice(colonIdx + 1) : '';
    const params = {};
    paramsRaw.split(',').forEach((kv) => {
      const eq = kv.indexOf('=');
      if (eq > -1) params[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim();
    });
    const preset = GEOMETRY_PRESETS[shapeName];
    if (!preset) return;
    const shape = preset.build(params);
    const ox = numOrDefault(params.x, 0), oy = numOrDefault(params.y, 0);
    const prefix = 'p' + idx + '_';
    const nameMap = {};
    (shape.points || []).forEach((pt) => {
      const newName = prefix + pt.name;
      nameMap[pt.name] = newName;
      // Vertex letters (A, B, C...) are per sub-shape and collide/confuse
      // once several parts share one figure, so composite points never draw
      // their own dot+label — only the segment dimension labels (already
      // preserved below) carry meaning on a combined figure.
      points.push({ name: newName, x: pt.x + ox, y: pt.y + oy, hidden: true });
    });
    (shape.polygons || (shape.points.length >= 3 ? [shape.points.map((pt) => pt.name)] : [])).forEach((loop) => {
      polygons.push(loop.map((n) => nameMap[n]));
    });
    (shape.segments || []).forEach((seg) => {
      segments.push({ from: nameMap[seg.from], to: nameMap[seg.to], label: seg.label });
    });
    (shape.circles || []).forEach((c) => {
      circles.push({ center: nameMap[c.center], radius: c.radius, label: c.label });
    });
  });
  return { points, polygons, segments, circles };
}

function renderGeometrySVG(cfg) {
  const shape = cfg.bentuk === 'gabungan'
    ? buildGabungan(cfg.bagian)
    : (GEOMETRY_PRESETS[cfg.bentuk] || GEOMETRY_PRESETS['segitiga-sembarang']).build(cfg);
  const width = 360, height = 280, pad = 40;
  const xs = shape.points.map((p) => p.x), ys = shape.points.map((p) => p.y);
  (shape.circles || []).forEach((c) => {
    const center = shape.points.find((p) => p.name === c.center);
    xs.push(center.x - c.radius, center.x + c.radius);
    ys.push(center.y - c.radius, center.y + c.radius);
  });
  const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0), maxY = Math.max(...ys, 1);
  const spanX = Math.max(maxX - minX, 1), spanY = Math.max(maxY - minY, 1);
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const toPx = (x, y) => [pad + (x - minX) * scale, height - pad - (y - minY) * scale];

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  const pxMap = {};
  shape.points.forEach((p) => { pxMap[p.name] = toPx(p.x, p.y); });

  const polygons = shape.polygons || (shape.points.length >= 3 ? [shape.points.map((p) => p.name)] : []);
  polygons.forEach((loop) => {
    const pts = loop.map((name) => pxMap[name].map((n) => n.toFixed(1)).join(',')).join(' ');
    svg += `<polygon points="${pts}" fill="none" stroke="#000000" stroke-width="2"/>`;
  });
  (shape.circles || []).forEach((c) => {
    const center = pxMap[c.center];
    svg += `<circle cx="${center[0].toFixed(1)}" cy="${center[1].toFixed(1)}" r="${(c.radius * scale).toFixed(1)}" fill="none" stroke="#000000" stroke-width="2"/>`;
    if (c.label) svg += `<text x="${(center[0] + 8).toFixed(1)}" y="${(center[1] - 8).toFixed(1)}" font-size="12" fill="#000000">${escText(c.label)}</text>`;
  });
  (shape.segments || []).forEach((seg) => {
    if (!seg.label) return;
    const p1 = pxMap[seg.from], p2 = pxMap[seg.to];
    const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
    const dx = p2[1] - p1[1], dy = p1[0] - p2[0];
    const len = Math.hypot(dx, dy) || 1;
    const ox = mx + (dx / len) * 14, oy = my + (dy / len) * 14;
    svg += `<text x="${ox.toFixed(1)}" y="${oy.toFixed(1)}" font-size="12" text-anchor="middle" fill="#000000">${escText(seg.label)}</text>`;
  });
  shape.points.forEach((p) => {
    if (p.hidden) return;
    const [px, py] = pxMap[p.name];
    svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.4" fill="#000000"/>`;
    svg += `<text x="${(px - 10).toFixed(1)}" y="${(py - 8).toFixed(1)}" font-size="12" font-weight="700" fill="#000000">${escText(p.name)}</text>`;
  });

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 2b. Piktogram
// ---------------------------------------------------------------------

function iconStar(cx, cy, s) {
  const outer = s / 2, inner = outer * 0.382;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
  }
  return `<polygon points="${pts.join(' ')}" fill="none" stroke="#000000" stroke-width="1.3"/>`;
}
function iconCircle(cx, cy, s) {
  return `<circle cx="${cx}" cy="${cy}" r="${(s / 2).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.3"/>`;
}
function iconSquare(cx, cy, s) {
  const h = s / 2;
  return `<rect x="${(cx - h).toFixed(1)}" y="${(cy - h).toFixed(1)}" width="${s}" height="${s}" fill="none" stroke="#000000" stroke-width="1.3"/>`;
}
function iconTriangle(cx, cy, s) {
  const h = s / 2;
  return `<polygon points="${cx},${(cy - h).toFixed(1)} ${(cx - h).toFixed(1)},${(cy + h).toFixed(1)} ${(cx + h).toFixed(1)},${(cy + h).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.3"/>`;
}
function iconHeart(cx, cy, s) {
  const w = s, h = s, x0 = cx - w / 2, y0 = cy - h / 2;
  const d = `M${cx},${(y0 + h * 0.3).toFixed(1)} C${cx},${y0.toFixed(1)} ${x0.toFixed(1)},${y0.toFixed(1)} ${x0.toFixed(1)},${(y0 + h * 0.3).toFixed(1)} C${x0.toFixed(1)},${(y0 + h * 0.6).toFixed(1)} ${cx},${(y0 + h * 0.8).toFixed(1)} ${cx},${(y0 + h).toFixed(1)} C${cx},${(y0 + h * 0.8).toFixed(1)} ${(x0 + w).toFixed(1)},${(y0 + h * 0.6).toFixed(1)} ${(x0 + w).toFixed(1)},${(y0 + h * 0.3).toFixed(1)} C${(x0 + w).toFixed(1)},${y0.toFixed(1)} ${cx},${y0.toFixed(1)} ${cx},${(y0 + h * 0.3).toFixed(1)} Z`;
  return `<path d="${d}" fill="none" stroke="#000000" stroke-width="1.3"/>`;
}
function iconApple(cx, cy, s) {
  const r = s * 0.42, bodyCy = cy + s * 0.08;
  let svg = `<circle cx="${cx.toFixed(1)}" cy="${bodyCy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.3"/>`;
  svg += `<line x1="${cx.toFixed(1)}" y1="${(bodyCy - r).toFixed(1)}" x2="${(cx + s * 0.05).toFixed(1)}" y2="${(bodyCy - r - s * 0.22).toFixed(1)}" stroke="#000000" stroke-width="1.3"/>`;
  svg += `<ellipse cx="${(cx + s * 0.18).toFixed(1)}" cy="${(bodyCy - r - s * 0.14).toFixed(1)}" rx="${(s * 0.12).toFixed(1)}" ry="${(s * 0.06).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.1" transform="rotate(-30 ${(cx + s * 0.18).toFixed(1)} ${(bodyCy - r - s * 0.14).toFixed(1)})"/>`;
  return svg;
}
function iconPerson(cx, cy, s) {
  const headR = s * 0.14, headCy = cy - s * 0.32, shoulderY = headCy + headR + 2, hipY = cy + s * 0.15;
  let svg = `<circle cx="${cx.toFixed(1)}" cy="${headCy.toFixed(1)}" r="${headR.toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.3"/>`;
  svg += `<line x1="${cx.toFixed(1)}" y1="${shoulderY.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${hipY.toFixed(1)}" stroke="#000000" stroke-width="1.3"/>`;
  svg += `<line x1="${cx.toFixed(1)}" y1="${(shoulderY + 3).toFixed(1)}" x2="${(cx - s * 0.22).toFixed(1)}" y2="${(shoulderY + s * 0.18).toFixed(1)}" stroke="#000000" stroke-width="1.3"/>`;
  svg += `<line x1="${cx.toFixed(1)}" y1="${(shoulderY + 3).toFixed(1)}" x2="${(cx + s * 0.22).toFixed(1)}" y2="${(shoulderY + s * 0.18).toFixed(1)}" stroke="#000000" stroke-width="1.3"/>`;
  svg += `<line x1="${cx.toFixed(1)}" y1="${hipY.toFixed(1)}" x2="${(cx - s * 0.18).toFixed(1)}" y2="${(cy + s * 0.42).toFixed(1)}" stroke="#000000" stroke-width="1.3"/>`;
  svg += `<line x1="${cx.toFixed(1)}" y1="${hipY.toFixed(1)}" x2="${(cx + s * 0.18).toFixed(1)}" y2="${(cy + s * 0.42).toFixed(1)}" stroke="#000000" stroke-width="1.3"/>`;
  return svg;
}
function iconBook(cx, cy, s) {
  const w = s * 0.8, h = s * 0.6, x0 = cx - w / 2, y0 = cy - h / 2;
  let svg = `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.3"/>`;
  svg += `<line x1="${cx.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${(y0 + h).toFixed(1)}" stroke="#000000" stroke-width="1.1"/>`;
  return svg;
}

const ICON_DRAWERS = {
  bintang: iconStar, lingkaran: iconCircle, kotak: iconSquare, segitiga: iconTriangle,
  hati: iconHeart, apel: iconApple, buah: iconApple, orang: iconPerson, buku: iconBook,
};

let pictogramClipCounter = 0;

function renderPictogramSVG(cfg) {
  const drawer = ICON_DRAWERS[cfg.simbol] || ICON_DRAWERS.bintang;
  const skala = numOrDefault(cfg.skala, 1) || 1;
  const labels = String(cfg.label || '').split(',').map((s) => s.trim()).filter(Boolean);
  const data = String(cfg.data || '').split(',').map((s) => parseFloat(s.trim()) || 0);
  const satuan = cfg.satuan || '';

  const rowH = 32, iconSize = 18, iconGap = 6, labelW = 92, pad = 14;
  const maxIcons = Math.max(...data.map((v) => Math.ceil(v / skala)), 1);
  const width = Math.min(560, labelW + pad * 2 + maxIcons * (iconSize + iconGap) + 50);
  const height = pad * 2 + labels.length * rowH + 28;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  labels.forEach((lb, i) => {
    const v = data[i] || 0;
    const y = pad + i * rowH + rowH / 2;
    svg += `<text x="${pad}" y="${(y + 4).toFixed(1)}" font-size="10.5" fill="#000000">${escText(lb)}</text>`;
    const full = Math.floor(v / skala + 1e-9);
    const remainder = v / skala - full;
    let x = pad + labelW;
    for (let k = 0; k < full; k++) {
      svg += drawer(x + iconSize / 2, y, iconSize);
      x += iconSize + iconGap;
    }
    if (remainder >= 0.5 - 1e-9 && remainder > 0.01) {
      const clipId = 'pic' + pictogramClipCounter++;
      svg += `<clipPath id="${clipId}"><rect x="${x.toFixed(1)}" y="${(y - iconSize / 2).toFixed(1)}" width="${(iconSize / 2).toFixed(1)}" height="${iconSize}"/></clipPath>`;
      svg += `<g clip-path="url(#${clipId})">${drawer(x + iconSize / 2, y, iconSize)}</g>`;
      x += iconSize + iconGap;
    }
    svg += `<text x="${(x + 4).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="10" fill="#333333">(${v})</text>`;
  });

  const legendY = pad + labels.length * rowH + 16;
  svg += drawer(pad + 8, legendY, 15);
  svg += `<text x="${pad + 22}" y="${(legendY + 4).toFixed(1)}" font-size="9.5" fill="#000000">= ${skala}${satuan ? ' ' + escText(satuan) : ''}</text>`;

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 2c. Bangun Ruang (3D, proyeksi oblique/kavalier)
// ---------------------------------------------------------------------

const OBLIQUE_ANGLE = Math.PI / 6;
const OBLIQUE_SCALE = 0.5;
function obliquePt(x, y, depth) {
  return [x + depth * OBLIQUE_SCALE * Math.cos(OBLIQUE_ANGLE), y - depth * OBLIQUE_SCALE * Math.sin(OBLIQUE_ANGLE)];
}

const SOLID_PRESETS = {
  kubus: (p) => {
    const s = numOrDefault(p.sisi, 5);
    const F = { BL: [0, 0], BR: [s, 0], TR: [s, s], TL: [0, s] };
    const B = { BL: obliquePt(0, 0, s), BR: obliquePt(s, 0, s), TR: obliquePt(s, s, s), TL: obliquePt(0, s, s) };
    return {
      edges: [
        { a: F.BL, b: F.BR }, { a: F.BR, b: F.TR }, { a: F.TR, b: F.TL }, { a: F.TL, b: F.BL },
        { a: B.BL, b: B.BR, dashed: true }, { a: B.BR, b: B.TR, dashed: true }, { a: B.TR, b: B.TL, dashed: true }, { a: B.TL, b: B.BL, dashed: true },
        { a: F.BL, b: B.BL, dashed: true }, { a: F.BR, b: B.BR }, { a: F.TR, b: B.TR }, { a: F.TL, b: B.TL },
      ],
      labels: [{ pos: [(F.BL[0] + F.BR[0]) / 2, F.BL[1]], text: `s = ${s}`, dy: 16 }],
    };
  },
  balok: (p) => {
    const pj = numOrDefault(p.panjang, 8), lb = numOrDefault(p.lebar, 5), t = numOrDefault(p.tinggi, 4);
    const F = { BL: [0, 0], BR: [pj, 0], TR: [pj, t], TL: [0, t] };
    const B = { BL: obliquePt(0, 0, lb), BR: obliquePt(pj, 0, lb), TR: obliquePt(pj, t, lb), TL: obliquePt(0, t, lb) };
    return {
      edges: [
        { a: F.BL, b: F.BR }, { a: F.BR, b: F.TR }, { a: F.TR, b: F.TL }, { a: F.TL, b: F.BL },
        { a: B.BL, b: B.BR, dashed: true }, { a: B.BR, b: B.TR, dashed: true }, { a: B.TR, b: B.TL, dashed: true }, { a: B.TL, b: B.BL, dashed: true },
        { a: F.BL, b: B.BL, dashed: true }, { a: F.BR, b: B.BR }, { a: F.TR, b: B.TR }, { a: F.TL, b: B.TL },
      ],
      labels: [
        { pos: [(F.BL[0] + F.BR[0]) / 2, F.BL[1]], text: `p = ${pj}`, dy: 16 },
        { pos: [F.BR[0], (F.BR[1] + F.TR[1]) / 2], text: `t = ${t}`, dx: 16 },
        { pos: [(F.BR[0] + B.BR[0]) / 2, (F.BR[1] + B.BR[1]) / 2], text: `l = ${lb}`, dy: -10 },
      ],
    };
  },
  tabung: (p) => {
    const r = numOrDefault(p.jari, 4), t = numOrDefault(p.tinggi, 8), ry = r * 0.35;
    return {
      ellipses: [{ cx: r, cy: t, rx: r, ry }, { cx: r, cy: 0, rx: r, ry, dashed: true }],
      edges: [{ a: [0, 0], b: [0, t] }, { a: [2 * r, 0], b: [2 * r, t] }],
      labels: [{ pos: [2 * r, t / 2], text: `t = ${t}`, dx: 16 }, { pos: [r, 0], text: `r = ${r}`, dy: 16 }],
    };
  },
  kerucut: (p) => {
    const r = numOrDefault(p.jari, 4), t = numOrDefault(p.tinggi, 8), ry = r * 0.35;
    return {
      ellipses: [{ cx: r, cy: 0, rx: r, ry, dashed: true }],
      edges: [{ a: [r, t], b: [0, 0] }, { a: [r, t], b: [2 * r, 0] }],
      labels: [{ pos: [r, t / 2], text: `t = ${t}`, dx: -16 }, { pos: [r, 0], text: `r = ${r}`, dy: 16 }],
    };
  },
  bola: (p) => {
    const r = numOrDefault(p.jari, 4);
    return {
      ellipses: [{ cx: 0, cy: 0, rx: r, ry: r }, { cx: 0, cy: 0, rx: r, ry: r * 0.32, dashed: true }],
      edges: [],
      labels: [{ pos: [0, r], text: `r = ${r}`, dy: -12 }],
    };
  },
  'limas-segiempat': (p) => {
    const s = numOrDefault(p.alas, 6), t = numOrDefault(p.tinggi, 8);
    const depth = s * 0.6;
    const frontL = [0, 0], frontR = [s, 0];
    const backL = obliquePt(0, 0, depth), backR = obliquePt(s, 0, depth);
    const baseCenter = [(frontL[0] + frontR[0] + backL[0] + backR[0]) / 4, (frontL[1] + frontR[1] + backL[1] + backR[1]) / 4];
    const apex = [baseCenter[0], baseCenter[1] + t];
    return {
      edges: [
        { a: frontL, b: frontR }, { a: frontR, b: backR }, { a: backR, b: backL, dashed: true }, { a: backL, b: frontL, dashed: true },
        { a: frontL, b: apex }, { a: frontR, b: apex }, { a: backR, b: apex }, { a: backL, b: apex, dashed: true },
      ],
      labels: [
        { pos: [(frontL[0] + frontR[0]) / 2, frontL[1]], text: `s = ${s}`, dy: 16 },
        { pos: [apex[0], apex[1]], text: `t = ${t}`, dx: 16, dy: -6 },
      ],
    };
  },
  'prisma-segitiga': (p) => {
    const alas = numOrDefault(p.alas, 6), tinggi = numOrDefault(p.tinggi, 5), panjang = numOrDefault(p.panjang, 8);
    const F = { A: [0, 0], B: [alas, 0], C: [alas / 2, tinggi] };
    const Bk = { A: obliquePt(0, 0, panjang), B: obliquePt(alas, 0, panjang), C: obliquePt(alas / 2, tinggi, panjang) };
    return {
      edges: [
        { a: F.A, b: F.B }, { a: F.B, b: F.C }, { a: F.C, b: F.A },
        { a: Bk.A, b: Bk.B, dashed: true }, { a: Bk.B, b: Bk.C, dashed: true }, { a: Bk.C, b: Bk.A, dashed: true },
        { a: F.A, b: Bk.A, dashed: true }, { a: F.B, b: Bk.B }, { a: F.C, b: Bk.C },
      ],
      labels: [
        { pos: [(F.A[0] + F.B[0]) / 2, F.A[1]], text: `alas = ${alas}`, dy: 16 },
        { pos: [F.B[0], (F.B[1] + F.C[1]) / 2], text: `t = ${tinggi}`, dx: 14 },
        { pos: [(F.B[0] + Bk.B[0]) / 2, (F.B[1] + Bk.B[1]) / 2], text: `p = ${panjang}`, dy: -10 },
      ],
    };
  },
};

// PATCH EXACTSEARCH (hilang bila wsm/ disinkronkan ulang lewat perbarui-mesin.sh):
// Kolom tabel dipisah koma, tapi koma juga sah muncul DI DALAM rumus — misalnya
// "header=$x$,$y$,$(x\text{, }y)$" yang seharusnya 3 kolom. Memecah mentah
// membuatnya jadi 4 kolom dengan potongan LaTeX terbelah, dan yang tercetak
// adalah "$(x\text{" lalu "}y)$" di kolom berbeda. Jadi koma di antara sepasang
// tanda dolar tidak dihitung sebagai pemisah.
function pisahKolom(teks) {
  const keluar = [];
  let kini = '', dalamRumus = false;
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (c === '$' && teks[i - 1] !== '\\') dalamRumus = !dalamRumus;
    if (c === ',' && !dalamRumus) { keluar.push(kini); kini = ''; continue; }
    kini += c;
  }
  keluar.push(kini);
  return keluar.map((x) => x.trim()).filter(Boolean);
}

function renderSolidSVG(cfg) {
  const preset = SOLID_PRESETS[cfg.bentuk] || SOLID_PRESETS.kubus;
  const shape = preset(cfg);
  const edges = shape.edges || [];
  const ellipses = shape.ellipses || [];
  const labels = shape.labels || [];
  const width = 360, height = 280, pad = 46;

  const xs = [], ys = [];
  edges.forEach((e) => { xs.push(e.a[0], e.b[0]); ys.push(e.a[1], e.b[1]); });
  ellipses.forEach((el) => { xs.push(el.cx - el.rx, el.cx + el.rx); ys.push(el.cy - el.ry, el.cy + el.ry); });
  const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0), maxY = Math.max(...ys, 1);
  const spanX = Math.max(maxX - minX, 1), spanY = Math.max(maxY - minY, 1);
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const toPx = (x, y) => [pad + (x - minX) * scale, height - pad - (y - minY) * scale];

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  ellipses.forEach((el) => {
    const [cx, cy] = toPx(el.cx, el.cy);
    svg += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(el.rx * scale).toFixed(1)}" ry="${(el.ry * scale).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.6"${el.dashed ? ' stroke-dasharray="4,3"' : ''}/>`;
  });
  edges.forEach((e) => {
    const [x1, y1] = toPx(e.a[0], e.a[1]), [x2, y2] = toPx(e.b[0], e.b[1]);
    svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#000000" stroke-width="1.6"${e.dashed ? ' stroke-dasharray="4,3"' : ''}/>`;
  });
  labels.forEach((l) => {
    const [x, y] = toPx(l.pos[0], l.pos[1]);
    svg += `<text x="${(x + (l.dx || 0)).toFixed(1)}" y="${(y + (l.dy || 0) + 4).toFixed(1)}" font-size="12" text-anchor="middle" fill="#000000">${escText(l.text)}</text>`;
  });

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 2d. Diagram Sudut (polygon dengan busur sudut, garis sejajar + transversal)
// ---------------------------------------------------------------------

function parseLabelMap(raw) {
  const map = {};
  String(raw || '').split(',').forEach((pair) => {
    const idx = pair.indexOf(':');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) map[k] = v;
  });
  return map;
}

function renderPolygonAngleSVG(cfg) {
  const n = Math.max(3, Math.round(numOrDefault(cfg.sisi, 4)));
  const labelMap = parseLabelMap(cfg.label);
  const width = 360, height = 300, pad = 50, R = 100;
  const letters = 'ABCDEFGHIJ';
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    pts.push({ name: letters[i] || 'P' + i, x: R * Math.cos(a), y: R * Math.sin(a) });
  }

  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1), spanY = Math.max(maxY - minY, 1);
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const toPx = (x, y) => [pad + (x - minX) * scale, height - pad - (y - minY) * scale];

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  const pxPts = pts.map((p) => ({ name: p.name, px: toPx(p.x, p.y) }));
  const poly = pxPts.map((p) => p.px.map((v) => v.toFixed(1)).join(',')).join(' ');
  svg += `<polygon points="${poly}" fill="none" stroke="#000000" stroke-width="2"/>`;

  const arcR = 20;
  pxPts.forEach((p, i) => {
    const prev = pxPts[(i - 1 + n) % n].px, next = pxPts[(i + 1) % n].px;
    const v1 = [prev[0] - p.px[0], prev[1] - p.px[1]];
    const v2 = [next[0] - p.px[0], next[1] - p.px[1]];
    const a1 = Math.atan2(v1[1], v1[0]);
    let delta = Math.atan2(v2[1], v2[0]) - a1;
    while (delta <= -Math.PI) delta += 2 * Math.PI;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    const a2 = a1 + delta;
    const large = Math.abs(delta) > Math.PI ? 1 : 0;
    const sweep = delta > 0 ? 1 : 0;
    const x1 = p.px[0] + arcR * Math.cos(a1), y1 = p.px[1] + arcR * Math.sin(a1);
    const x2 = p.px[0] + arcR * Math.cos(a2), y2 = p.px[1] + arcR * Math.sin(a2);
    svg += `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${arcR},${arcR} 0 ${large} ${sweep} ${x2.toFixed(1)},${y2.toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.2"/>`;

    const val = labelMap[p.name];
    if (val) {
      const midA = a1 + delta / 2;
      const lx = p.px[0] + (arcR + 14) * Math.cos(midA), ly = p.px[1] + (arcR + 14) * Math.sin(midA);
      svg += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" font-size="11" text-anchor="middle" fill="#000000">${escText(val)}°</text>`;
    }
  });

  const cx = pxPts.reduce((s, p) => s + p.px[0], 0) / n, cy = pxPts.reduce((s, p) => s + p.px[1], 0) / n;
  pxPts.forEach((p) => {
    const dx = p.px[0] - cx, dy = p.px[1] - cy, len = Math.hypot(dx, dy) || 1;
    const lx = p.px[0] + (dx / len) * 16, ly = p.px[1] + (dy / len) * 16;
    svg += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" font-size="12" font-weight="700" text-anchor="middle" fill="#000000">${escText(p.name)}</text>`;
  });

  svg += '</svg>';
  return svg;
}

function renderParallelLinesSVG(cfg) {
  const width = 380, height = 260;
  const y1 = 90, y2 = 180, x0 = 40, x1 = 340;
  const midX1 = 150, midX2 = 230;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  svg += `<line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="#000000" stroke-width="1.6"/>`;
  svg += `<line x1="${x0}" y1="${y2}" x2="${x1}" y2="${y2}" stroke="#000000" stroke-width="1.6"/>`;
  [y1, y2].forEach((y) => {
    svg += `<line x1="${x1 - 40}" y1="${y - 5}" x2="${x1 - 30}" y2="${y}" stroke="#000000" stroke-width="1.4"/>`;
    svg += `<line x1="${x1 - 40}" y1="${y + 5}" x2="${x1 - 30}" y2="${y}" stroke="#000000" stroke-width="1.4"/>`;
  });

  const dx = midX2 - midX1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, ext = 40;
  const tx1 = midX1 - ux * ext, ty1 = y1 - uy * ext, tx2 = midX2 + ux * ext, ty2 = y2 + uy * ext;
  svg += `<line x1="${tx1.toFixed(1)}" y1="${ty1.toFixed(1)}" x2="${tx2.toFixed(1)}" y2="${ty2.toFixed(1)}" stroke="#000000" stroke-width="1.6"/>`;

  const labelMap = parseLabelMap(cfg.label);
  const off = 20;
  const positions = {
    1: [midX1 - off, y1 - off], 2: [midX1 + off, y1 - off],
    3: [midX1 + off, y1 + off], 4: [midX1 - off, y1 + off],
    5: [midX2 - off, y2 - off], 6: [midX2 + off, y2 - off],
    7: [midX2 + off, y2 + off], 8: [midX2 - off, y2 + off],
  };
  Object.keys(positions).forEach((k) => {
    const val = labelMap[k];
    const text = val ? `${val}°` : k;
    const [px, py] = positions[k];
    svg += `<text x="${px}" y="${py + 4}" font-size="11" text-anchor="middle" fill="#000000">${escText(text)}</text>`;
  });

  svg += '</svg>';
  return svg;
}

function renderAngleSVG(cfg) {
  return cfg.mode === 'sejajar' ? renderParallelLinesSVG(cfg) : renderPolygonAngleSVG(cfg);
}

// ---------------------------------------------------------------------
// 3. Garis Bilangan
// ---------------------------------------------------------------------

function renderNumberLineSVG(cfg) {
  const width = 400, height = 110, pad = 30;
  const min = numOrDefault(cfg.min, -10), max = numOrDefault(cfg.max, 10);
  const step = numOrDefault(cfg.step, 1) || 1;
  const sx = (width - 2 * pad) / (max - min || 1);
  const toPx = (v) => pad + (v - min) * sx;
  const y = 55;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<line x1="${pad - 8}" y1="${y}" x2="${width - pad + 8}" y2="${y}" stroke="#1e293b" stroke-width="1.6"/>`;
  svg += `<polygon points="${width - pad + 8},${y} ${width - pad},${y - 4} ${width - pad},${y + 4}" fill="#1e293b"/>`;
  svg += `<polygon points="${pad - 8},${y} ${pad},${y - 4} ${pad},${y + 4}" fill="#1e293b"/>`;

  for (let v = min; v <= max + 1e-9; v += step) {
    const rv = Math.round(v * 1000) / 1000;
    const px = toPx(rv);
    svg += `<line x1="${px.toFixed(1)}" y1="${y - 6}" x2="${px.toFixed(1)}" y2="${y + 6}" stroke="#1e293b" stroke-width="1.2"/>`;
    svg += `<text x="${px.toFixed(1)}" y="${y + 22}" font-size="11" text-anchor="middle" fill="#1e293b">${rv}</text>`;
  }
  (cfg.titik || []).forEach((p) => {
    const px = toPx(p.value);
    svg += `<circle cx="${px.toFixed(1)}" cy="${y}" r="4" fill="#000000"/>`;
    svg += `<text x="${px.toFixed(1)}" y="${y - 14}" font-size="12" text-anchor="middle" font-weight="700" fill="#000000">${escText(p.label || '')}</text>`;
  });

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 4. Diagram Venn
// ---------------------------------------------------------------------

function circleSvgTag(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#000000" stroke-width="2"/>`;
}
function textSvgTag(x, y, val, bold, anchor) {
  if (val === undefined || val === null || val === '') return '';
  return `<text x="${x}" y="${y}" font-size="${bold ? 13 : 12}" font-weight="${bold ? 700 : 400}" text-anchor="${anchor || 'middle'}" fill="#000000">${escText(val)}</text>`;
}

// A proper Venn diagram is drawn inside its universal set — the rectangle
// with "S" (or a custom name via cfg.s) in the corner isn't optional
// decoration, it's what makes the "only A"/"only B" regions read as
// complements within a bounded universe rather than floating shapes. Drawn
// unconditionally now (previously only when cfg.s was set), inset well
// clear of the circles and their top labels so nothing collides.
function renderVennSVG(cfg) {
  const hasC = !!(cfg.c && String(cfg.c).trim());
  const width = 400, height = hasC ? 330 : 260;
  const insetPad = 14;
  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  svg += `<rect x="${insetPad}" y="${insetPad}" width="${width - insetPad * 2}" height="${height - insetPad * 2}" fill="none" stroke="#334155" stroke-width="1.2"/>`;
  svg += textSvgTag(insetPad + 12, insetPad + 18, cfg.s || 'S', true, 'start');

  if (!hasC) {
    const r = 92, cxA = width / 2 - 58, cyA = height / 2 + 10, cxB = width / 2 + 58, cyB = height / 2 + 10;
    svg += circleSvgTag(cxA, cyA, r);
    svg += circleSvgTag(cxB, cyB, r);
    svg += textSvgTag(cxA - 50, cyA - r + 14, cfg.a, true);
    svg += textSvgTag(cxB + 50, cyB - r + 14, cfg.b, true);
    svg += textSvgTag(cxA - 38, cyA, cfg.onlyA);
    svg += textSvgTag(cxB + 38, cyB, cfg.onlyB);
    svg += textSvgTag(width / 2, cyA, cfg.ab);
  } else {
    const r = 84;
    const cxA = width / 2 - 42, cyA = height / 2 - 34;
    const cxB = width / 2 + 42, cyB = height / 2 - 34;
    const cxC = width / 2, cyC = height / 2 + 62;
    svg += circleSvgTag(cxA, cyA, r);
    svg += circleSvgTag(cxB, cyB, r);
    svg += circleSvgTag(cxC, cyC, r);
    svg += textSvgTag(cxA - 64, cyA - r + 16, cfg.a, true);
    svg += textSvgTag(cxB + 64, cyB - r + 16, cfg.b, true);
    svg += textSvgTag(cxC, cyC + r + 18, cfg.c, true);
    svg += textSvgTag(cxA - 36, cyA - 24, cfg.onlyA);
    svg += textSvgTag(cxB + 36, cyB - 24, cfg.onlyB);
    svg += textSvgTag(cxC, cyC + 32, cfg.onlyC);
    svg += textSvgTag(width / 2, cyA + 8, cfg.ab);
    svg += textSvgTag(cxA + 16, cyC - 14, cfg.ac);
    svg += textSvgTag(cxB - 16, cyC - 14, cfg.bc);
    svg += textSvgTag(width / 2, cyA + 48, cfg.abc);
  }
  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 5. Diagram Statistik
// ---------------------------------------------------------------------

function renderStatSVG(cfg) {
  const type = cfg.tipe || 'batang';
  const labels = String(cfg.label || '').split(',').map((s) => s.trim()).filter(Boolean);
  const data = String(cfg.data || '').split(',').map((s) => parseFloat(s.trim()) || 0);
  const width = 400, height = 280, pad = 36;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  if (type === 'lingkaran') {
    // No fill (print-friendly): each slice is an outlined wedge, numbered
    // at its midpoint; the legend on the right maps numbers back to labels.
    const total = data.reduce((a, b) => a + b, 0) || 1;
    const cx = width / 2 - 40, cy = height / 2, r = 90;
    let angle = -Math.PI / 2;
    data.forEach((v, i) => {
      const frac = v / total;
      const a2 = angle + frac * Math.PI * 2;
      const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      const large = frac > 0.5 ? 1 : 0;
      svg += `<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="none" stroke="#000000" stroke-width="1.5"/>`;
      const midAngle = (angle + a2) / 2;
      const lx = cx + (r * 0.65) * Math.cos(midAngle), ly = cy + (r * 0.65) * Math.sin(midAngle);
      svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="11" text-anchor="middle" fill="#000000">${i + 1}</text>`;
      angle = a2;
    });
    labels.forEach((lb, i) => {
      const pct = Math.round(((data[i] || 0) / total) * 1000) / 10;
      svg += `<text x="${width - 90}" y="${29 + i * 18}" font-size="10.5" fill="#000000">${i + 1}. ${escText(lb)} (${pct}%)</text>`;
    });
  } else if (type === 'garis') {
    const maxV = Math.max(...data, 1);
    const stepX = (width - 2 * pad) / Math.max(labels.length - 1, 1);
    const toY = (v) => height - pad - (v / maxV) * (height - 2 * pad);
    svg += `<line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#94a3b8" stroke-width="1.2"/>`;
    svg += `<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#94a3b8" stroke-width="1.2"/>`;
    let d = '';
    data.forEach((v, i) => {
      const x = pad + i * stepX, y = toY(v);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    });
    svg += `<path d="${d}" fill="none" stroke="#000000" stroke-width="2"/>`;
    data.forEach((v, i) => {
      const x = pad + i * stepX, y = toY(v);
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#ffffff" stroke="#000000" stroke-width="1.5"/>`;
      svg += `<text x="${x.toFixed(1)}" y="${height - pad + 16}" font-size="10" text-anchor="middle" fill="#000000">${escText(labels[i] || '')}</text>`;
    });
  } else {
    const maxV = Math.max(...data, 1);
    const n = data.length || 1;
    const gap = (width - 2 * pad) / n;
    const bw = gap * 0.6;
    svg += `<line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#94a3b8" stroke-width="1.2"/>`;
    data.forEach((v, i) => {
      const h = (v / maxV) * (height - 2 * pad);
      const x = pad + i * gap + (gap - bw) / 2;
      const y = height - pad - h;
      svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.5"/>`;
      svg += `<text x="${(x + bw / 2).toFixed(1)}" y="${height - pad + 16}" font-size="10" text-anchor="middle" fill="#000000">${escText(labels[i] || '')}</text>`;
      svg += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" font-size="10" text-anchor="middle" fill="#000000">${v}</text>`;
    });
  }

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 6. Pohon Faktor
// ---------------------------------------------------------------------

function isPrimeNum(n) {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}
function smallestFactorNum(n) {
  for (let i = 2; i <= n; i++) if (n % i === 0) return i;
  return n;
}
function buildFactorTreeNode(n) {
  if (isPrimeNum(n)) return { value: n, isPrime: true, children: [] };
  const f = smallestFactorNum(n), rest = n / f;
  return { value: n, isPrime: false, children: [buildFactorTreeNode(f), buildFactorTreeNode(rest)] };
}
function layoutFactorTreeNode(node) {
  let counter = 0;
  function assign(n, depth) {
    n.y = depth;
    if (n.children.length === 0) {
      n.x = counter++;
      return;
    }
    n.children.forEach((c) => assign(c, depth + 1));
    const xs = n.children.map((c) => c.x);
    n.x = (Math.min(...xs) + Math.max(...xs)) / 2;
  }
  assign(node, 0);
  return node;
}

function renderFactorTreeSVG(cfg) {
  const num = Math.max(2, Math.round(numOrDefault(cfg.n, 60)));
  // Blank by default — a worksheet factor tree is meant for the student to
  // fill in themselves; only the starting number is given. Set jawaban=ya
  // to reveal the full worked tree instead (e.g. for a teacher's key).
  const showAnswer = /^(ya|iya|true|1|lengkap)$/i.test(String(cfg.jawaban || ''));
  const root = layoutFactorTreeNode(buildFactorTreeNode(num));
  const nodes = [], edges = [];
  (function walk(n, parent) {
    nodes.push(n);
    if (parent) edges.push([parent, n]);
    n.children.forEach((c) => walk(c, n));
  })(root, null);

  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), maxY = Math.max(...ys);
  const width = 380, pad = 40, stepY = 60;
  const spanX = Math.max(maxX - minX, 1);
  const stepX = Math.max((width - 2 * pad) / spanX, 55);
  const height = pad * 2 + maxY * stepY + 20;
  const px = (x) => pad + (x - minX) * stepX;
  const py = (y) => pad + y * stepY;
  const R = 17;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  edges.forEach(([a, b]) => {
    // Stop each line at the circle's edge (not its center) so it doesn't
    // visibly cut across the — now unfilled — circle outline.
    const ax = px(a.x), ay = py(a.y), bx = px(b.x), by = py(b.y);
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const x1 = ax + ux * R, y1 = ay + uy * R;
    const x2 = bx - ux * R, y2 = by - uy * R;
    svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#000000" stroke-width="1.4"/>`;
  });
  nodes.forEach((n) => {
    const isRoot = n === root;
    const reveal = isRoot || showAnswer;
    // Prime vs. composite is only told apart (bold text, thicker ring) once
    // revealed — showing it on a still-blank node would give the answer away.
    const bold = reveal && n.isPrime;
    svg += `<circle cx="${px(n.x).toFixed(1)}" cy="${py(n.y).toFixed(1)}" r="${R}" fill="none" stroke="#000000" stroke-width="${bold ? 2 : 1.2}"/>`;
    if (reveal) {
      svg += `<text x="${px(n.x).toFixed(1)}" y="${(py(n.y) + 4).toFixed(1)}" text-anchor="middle" font-size="12.5" font-weight="${bold ? 700 : 400}" fill="#000000">${n.value}</text>`;
    }
  });
  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 6a2. Pembagian Bersusun (long division)
// ---------------------------------------------------------------------

// Runs the schoolbook long-division algorithm digit by digit and records
// one "step" per dividend digit once the running remainder first reaches
// the divisor — exactly the digits a student would write by hand. Each
// step's remainder already has the next digit folded in (workVal), which
// doubles as the next step's row, matching how it's actually written on
// paper (remainder and brought-down digit share one line).
function computeLongDivision(dividend, divisor) {
  const digits = String(dividend).split('').map(Number);
  const n = digits.length;
  const quotientDigits = new Array(n).fill(null);
  const steps = [];
  let carry = 0, started = false;
  for (let i = 0; i < n; i++) {
    carry = carry * 10 + digits[i];
    if (!started && carry < divisor) continue;
    started = true;
    const q = Math.floor(carry / divisor);
    const product = q * divisor;
    const remainder = carry - product;
    quotientDigits[i] = q;
    steps.push({ col: i, workVal: carry, product, remainder });
    carry = remainder;
  }
  if (!started) {
    // Divisor bigger than the whole dividend (e.g. 3 ÷ 4): quotient is 0,
    // remainder is the dividend itself — still one step, so rendering
    // doesn't need a separate no-steps code path.
    quotientDigits[n - 1] = 0;
    steps.push({ col: n - 1, workVal: carry, product: 0, remainder: carry });
  }
  return { digits, quotientDigits, steps };
}

function renderLongDivisionSVG(cfg) {
  const dividend = Math.max(1, Math.round(Math.abs(numOrDefault(cfg.dividen, 968))));
  const divisor = Math.max(1, Math.round(Math.abs(numOrDefault(cfg.pembagi, 4))));
  // Blank by default, like pohonfaktor — the worked steps are the answer
  // the student fills in; set jawaban=lengkap for a teacher's key.
  const showAnswer = /^(ya|iya|true|1|lengkap)$/i.test(String(cfg.jawaban || ''));

  const { digits, quotientDigits, steps } = computeLongDivision(dividend, divisor);
  const n = digits.length;

  const charW = 20, rh = 30;
  const padTop = 26, padLeft = 22;
  const divisorStr = String(divisor);
  const originX = padLeft + divisorStr.length * 11 + 20;
  const colX = (i) => originX + i * charW;
  const quotY = padTop + 4;
  const lineY = padTop + 18;
  const dividendY = lineY + rh - 8;
  const width = colX(n) + 24;

  const rows = [];
  let yCursor = dividendY;
  steps.forEach((st, k) => {
    yCursor += rh;
    const productRowY = yCursor;
    const ruleY = productRowY + 8;
    yCursor = ruleY + rh;
    const remainderRowY = yCursor;
    const remainderVal = (k + 1 < steps.length) ? steps[k + 1].workVal : st.remainder;
    rows.push({ col: st.col, product: st.product, productRowY, ruleY, remainderVal, remainderRowY });
  });
  const height = yCursor + 22;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  svg += `<text x="${padLeft}" y="${dividendY.toFixed(1)}" font-family="monospace" font-size="16" fill="#000000">${escText(divisorStr)}</text>`;
  const bracketX = originX - 10;
  svg += `<line x1="${bracketX.toFixed(1)}" y1="${lineY.toFixed(1)}" x2="${bracketX.toFixed(1)}" y2="${(dividendY + 6).toFixed(1)}" stroke="#000000" stroke-width="1.8"/>`;
  svg += `<line x1="${bracketX.toFixed(1)}" y1="${lineY.toFixed(1)}" x2="${(colX(n) + 4).toFixed(1)}" y2="${lineY.toFixed(1)}" stroke="#000000" stroke-width="1.8"/>`;

  digits.forEach((d, i) => {
    svg += `<text x="${(colX(i) + charW / 2).toFixed(1)}" y="${dividendY.toFixed(1)}" font-family="monospace" font-size="16" text-anchor="middle" fill="#000000">${d}</text>`;
  });

  quotientDigits.forEach((q, i) => {
    if (q === null) return;
    if (showAnswer) {
      svg += `<text x="${(colX(i) + charW / 2).toFixed(1)}" y="${quotY.toFixed(1)}" font-family="monospace" font-size="16" text-anchor="middle" fill="#000000">${q}</text>`;
    } else {
      svg += `<rect x="${(colX(i) + 2).toFixed(1)}" y="${(quotY - 13).toFixed(1)}" width="${charW - 4}" height="16" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2"/>`;
    }
  });

  rows.forEach((row) => {
    const endX = colX(row.col) + charW;
    const digitCount = Math.max(String(row.product).length, String(row.remainderVal).length);
    const boxW = digitCount * 13 + 4;
    svg += `<text x="${(endX - boxW - 6).toFixed(1)}" y="${row.productRowY.toFixed(1)}" font-family="monospace" font-size="15" fill="#000000">-</text>`;
    if (showAnswer) {
      svg += `<text x="${endX.toFixed(1)}" y="${row.productRowY.toFixed(1)}" font-family="monospace" font-size="15" text-anchor="end" fill="#000000">${row.product}</text>`;
    } else {
      svg += `<rect x="${(endX - boxW).toFixed(1)}" y="${(row.productRowY - 13).toFixed(1)}" width="${boxW.toFixed(1)}" height="16" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2"/>`;
    }
    svg += `<line x1="${(endX - boxW).toFixed(1)}" y1="${row.ruleY.toFixed(1)}" x2="${endX.toFixed(1)}" y2="${row.ruleY.toFixed(1)}" stroke="#000000" stroke-width="1.2"/>`;
    if (showAnswer) {
      svg += `<text x="${endX.toFixed(1)}" y="${row.remainderRowY.toFixed(1)}" font-family="monospace" font-size="15" text-anchor="end" fill="#000000">${row.remainderVal}</text>`;
    } else {
      svg += `<rect x="${(endX - boxW).toFixed(1)}" y="${(row.remainderRowY - 13).toFixed(1)}" width="${boxW.toFixed(1)}" height="16" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2"/>`;
    }
  });

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 6b. Shared arrow helper (fisika, rantai makanan)
// ---------------------------------------------------------------------

function arrowSVG(x1, y1, x2, y2, opts) {
  opts = opts || {};
  const color = opts.color || '#000000';
  const headLen = opts.headLen || 8;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const perpx = -uy, perpy = ux;
  const bx = x2 - ux * headLen, by = y2 - uy * headLen;
  const p1x = bx + perpx * headLen * 0.5, p1y = by + perpy * headLen * 0.5;
  const p2x = bx - perpx * headLen * 0.5, p2y = by - perpy * headLen * 0.5;
  const dashAttr = opts.dash ? ` stroke-dasharray="${opts.dash}"` : '';
  let s = `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${color}" stroke-width="${opts.strokeWidth || 1.8}"${dashAttr}/>`;
  s += `<polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${p1x.toFixed(1)},${p1y.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)}" fill="${color}"/>`;
  return s;
}

// Draws 1/2/3 parallel lines (single/double/triple bond) between two
// points, shrunk in from each end so they stop short of the atom label
// rather than running under it.
function bondLinesSVG(x1, y1, x2, y2, order, clearance) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const r = clearance == null ? 13 : clearance;
  const sx1 = x1 + ux * r, sy1 = y1 + uy * r, sx2 = x2 - ux * r, sy2 = y2 - uy * r;
  const offsets = order === 3 ? [-5, 0, 5] : order === 2 ? [-3, 3] : [0];
  let s = '';
  offsets.forEach((off) => {
    s += `<line x1="${(sx1 + nx * off).toFixed(1)}" y1="${(sy1 + ny * off).toFixed(1)}" x2="${(sx2 + nx * off).toFixed(1)}" y2="${(sy2 + ny * off).toFixed(1)}" stroke="#000000" stroke-width="1.6"/>`;
  });
  return s;
}

// ---------------------------------------------------------------------
// 6c. Struktur Lewis (ikatan kimia)
// ---------------------------------------------------------------------

const LEWIS_PRESETS = {
  h2o: {
    atoms: [
      { id: 'O', symbol: 'O', x: 0, y: 0, lone: 2 },
      { id: 'H1', symbol: 'H', x: -1.3, y: -0.9, lone: 0 },
      { id: 'H2', symbol: 'H', x: 1.3, y: -0.9, lone: 0 },
    ],
    bonds: [{ a: 'O', b: 'H1', order: 1 }, { a: 'O', b: 'H2', order: 1 }],
  },
  co2: {
    atoms: [
      { id: 'C', symbol: 'C', x: 0, y: 0, lone: 0 },
      { id: 'O1', symbol: 'O', x: -1.7, y: 0, lone: 2 },
      { id: 'O2', symbol: 'O', x: 1.7, y: 0, lone: 2 },
    ],
    bonds: [{ a: 'C', b: 'O1', order: 2 }, { a: 'C', b: 'O2', order: 2 }],
  },
  nh3: {
    atoms: [
      { id: 'N', symbol: 'N', x: 0, y: 0.3, lone: 1 },
      { id: 'H1', symbol: 'H', x: -1.3, y: -0.7, lone: 0 },
      { id: 'H2', symbol: 'H', x: 0, y: -1.4, lone: 0 },
      { id: 'H3', symbol: 'H', x: 1.3, y: -0.7, lone: 0 },
    ],
    bonds: [{ a: 'N', b: 'H1', order: 1 }, { a: 'N', b: 'H2', order: 1 }, { a: 'N', b: 'H3', order: 1 }],
  },
  ch4: {
    atoms: [
      { id: 'C', symbol: 'C', x: 0, y: 0, lone: 0 },
      { id: 'H1', symbol: 'H', x: 0, y: 1.5, lone: 0 },
      { id: 'H2', symbol: 'H', x: 1.4, y: -0.6, lone: 0 },
      { id: 'H3', symbol: 'H', x: -1.4, y: -0.6, lone: 0 },
      { id: 'H4', symbol: 'H', x: 0, y: -1.5, lone: 0 },
    ],
    bonds: [
      { a: 'C', b: 'H1', order: 1 }, { a: 'C', b: 'H2', order: 1 },
      { a: 'C', b: 'H3', order: 1 }, { a: 'C', b: 'H4', order: 1 },
    ],
  },
  o2: {
    atoms: [{ id: 'O1', symbol: 'O', x: -0.9, y: 0, lone: 2 }, { id: 'O2', symbol: 'O', x: 0.9, y: 0, lone: 2 }],
    bonds: [{ a: 'O1', b: 'O2', order: 2 }],
  },
  n2: {
    atoms: [{ id: 'N1', symbol: 'N', x: -0.9, y: 0, lone: 1 }, { id: 'N2', symbol: 'N', x: 0.9, y: 0, lone: 1 }],
    bonds: [{ a: 'N1', b: 'N2', order: 3 }],
  },
  hcl: {
    atoms: [{ id: 'H', symbol: 'H', x: -0.9, y: 0, lone: 0 }, { id: 'Cl', symbol: 'Cl', x: 0.9, y: 0, lone: 3 }],
    bonds: [{ a: 'H', b: 'Cl', order: 1 }],
  },
  co: {
    atoms: [{ id: 'C', symbol: 'C', x: -0.9, y: 0, lone: 1 }, { id: 'O', symbol: 'O', x: 0.9, y: 0, lone: 1 }],
    bonds: [{ a: 'C', b: 'O', order: 3 }],
  },
  ccl4: {
    atoms: [
      { id: 'C', symbol: 'C', x: 0, y: 0, lone: 0 },
      { id: 'Cl1', symbol: 'Cl', x: 0, y: 1.6, lone: 3 },
      { id: 'Cl2', symbol: 'Cl', x: 1.5, y: -0.7, lone: 3 },
      { id: 'Cl3', symbol: 'Cl', x: -1.5, y: -0.7, lone: 3 },
      { id: 'Cl4', symbol: 'Cl', x: 0, y: -1.6, lone: 3 },
    ],
    bonds: [
      { a: 'C', b: 'Cl1', order: 1 }, { a: 'C', b: 'Cl2', order: 1 },
      { a: 'C', b: 'Cl3', order: 1 }, { a: 'C', b: 'Cl4', order: 1 },
    ],
  },
  c2h4: {
    atoms: [
      { id: 'C1', symbol: 'C', x: -0.8, y: 0, lone: 0 },
      { id: 'C2', symbol: 'C', x: 0.8, y: 0, lone: 0 },
      { id: 'H1', symbol: 'H', x: -1.6, y: 0.9, lone: 0 },
      { id: 'H2', symbol: 'H', x: -1.6, y: -0.9, lone: 0 },
      { id: 'H3', symbol: 'H', x: 1.6, y: 0.9, lone: 0 },
      { id: 'H4', symbol: 'H', x: 1.6, y: -0.9, lone: 0 },
    ],
    bonds: [
      { a: 'C1', b: 'C2', order: 2 }, { a: 'C1', b: 'H1', order: 1 }, { a: 'C1', b: 'H2', order: 1 },
      { a: 'C2', b: 'H3', order: 1 }, { a: 'C2', b: 'H4', order: 1 },
    ],
  },
  ch2o: {
    atoms: [
      { id: 'C', symbol: 'C', x: 0, y: 0, lone: 0 },
      { id: 'O', symbol: 'O', x: 0, y: 1.5, lone: 2 },
      { id: 'H1', symbol: 'H', x: -1.3, y: -0.7, lone: 0 },
      { id: 'H2', symbol: 'H', x: 1.3, y: -0.7, lone: 0 },
    ],
    bonds: [{ a: 'C', b: 'O', order: 2 }, { a: 'C', b: 'H1', order: 1 }, { a: 'C', b: 'H2', order: 1 }],
  },
  nacl: {
    ionic: true,
    atoms: [
      { id: 'Na', symbol: 'Na', x: -1.4, y: 0, lone: 0, charge: '+' },
      { id: 'Cl', symbol: 'Cl', x: 1.4, y: 0, lone: 4, charge: String.fromCharCode(8722), bracket: true },
    ],
    bonds: [],
  },
  mgo: {
    ionic: true,
    atoms: [
      { id: 'Mg', symbol: 'Mg', x: -1.4, y: 0, lone: 0, charge: '2+' },
      { id: 'O', symbol: 'O', x: 1.4, y: 0, lone: 4, charge: '2' + String.fromCharCode(8722), bracket: true },
    ],
    bonds: [],
  },
};

function renderLewisSVG(cfg) {
  const preset = LEWIS_PRESETS[String(cfg.molekul || 'h2o').toLowerCase()] || LEWIS_PRESETS.h2o;
  const width = 340, height = 260, scale = 55;
  const cx = width / 2, cy = height / 2;
  const toPx = (x, y) => [cx + x * scale, cy - y * scale];
  const atomMap = {};
  preset.atoms.forEach((a) => { atomMap[a.id] = a; });

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  (preset.bonds || []).forEach((bond) => {
    const a = atomMap[bond.a], b = atomMap[bond.b];
    const [ax, ay] = toPx(a.x, a.y), [bx, by] = toPx(b.x, b.y);
    svg += bondLinesSVG(ax, ay, bx, by, bond.order || 1);
  });

  const bondedAngle = (a) => (preset.bonds || [])
    .filter((bd) => bd.a === a.id || bd.b === a.id)
    .map((bd) => {
      const other = atomMap[bd.a === a.id ? bd.b : bd.a];
      return Math.atan2(-(other.y - a.y), other.x - a.x);
    });
  const CANDIDATE_ANGLES = [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, (3 * Math.PI) / 4, -Math.PI / 4, (-3 * Math.PI) / 4];
  const angleDist = (a1, a2) => {
    const d = Math.abs(a1 - a2) % (2 * Math.PI);
    return Math.min(d, 2 * Math.PI - d);
  };

  preset.atoms.forEach((a) => {
    const [px, py] = toPx(a.x, a.y);
    if (a.bracket) {
      svg += `<text x="${(px - 20).toFixed(1)}" y="${(py + 7).toFixed(1)}" font-size="22" fill="#000000">[</text>`;
      svg += `<text x="${(px + 20).toFixed(1)}" y="${(py + 7).toFixed(1)}" font-size="22" fill="#000000">]</text>`;
    }
    svg += `<text x="${px.toFixed(1)}" y="${(py + 5).toFixed(1)}" text-anchor="middle" font-size="16" font-weight="700" fill="#000000">${escText(a.symbol)}</text>`;
    if (a.charge) {
      svg += `<text x="${(px + 13).toFixed(1)}" y="${(py - 9).toFixed(1)}" font-size="11" fill="#000000">${escText(a.charge)}</text>`;
    }
    const occupied = bondedAngle(a);
    const scored = CANDIDATE_ANGLES.map((ang) => ({
      ang, score: occupied.length ? Math.min(...occupied.map((o) => angleDist(ang, o))) : 1,
    }));
    scored.sort((p, q) => q.score - p.score);
    scored.slice(0, a.lone || 0).forEach(({ ang }) => {
      const ldx = Math.cos(ang), ldy = -Math.sin(ang);
      const lx = px + ldx * 18, ly = py + ldy * 18;
      const pdx = -ldy, pdy = ldx;
      svg += `<circle cx="${(lx + pdx * 3).toFixed(1)}" cy="${(ly + pdy * 3).toFixed(1)}" r="1.7" fill="#000000"/>`;
      svg += `<circle cx="${(lx - pdx * 3).toFixed(1)}" cy="${(ly - pdy * 3).toFixed(1)}" r="1.7" fill="#000000"/>`;
    });
  });

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 6d. Rangkaian Hidrokarbon
// ---------------------------------------------------------------------

// "2:2,4:3" -> [{pos:2,val:'2'},{pos:4,val:'3'}]
function parsePosValCommaList(raw) {
  if (!raw) return [];
  return String(raw).split(',').map((s) => s.trim()).filter(Boolean).map((part) => {
    const idx = part.indexOf(':');
    return { pos: parseInt(idx > -1 ? part.slice(0, idx) : part, 10), val: idx > -1 ? part.slice(idx + 1).trim() : '' };
  });
}

function renderHydrocarbonSVG(cfg) {
  const n = Math.max(1, Math.min(12, Math.round(numOrDefault(cfg.rantai, 4))));
  const bondOrder = {};
  parsePosValCommaList(cfg.ikatan).forEach(({ pos, val }) => {
    bondOrder[pos] = Math.max(1, Math.min(3, parseInt(val, 10) || 1));
  });
  const branchesByPos = {};
  parsePosValCommaList(cfg.cabang).forEach(({ pos, val }) => {
    if (!branchesByPos[pos]) branchesByPos[pos] = [];
    if (val) branchesByPos[pos].push(val);
  });

  const stepX = 48, zig = 26;
  const carbon = [];
  for (let i = 1; i <= n; i++) carbon[i] = { x: (i - 1) * stepX, y: (i - 1) % 2 === 0 ? 0 : -zig };

  const used = new Array(n + 1).fill(0);
  for (let i = 1; i < n; i++) {
    const order = bondOrder[i] || 1;
    used[i] += order;
    used[i + 1] += order;
  }
  Object.keys(branchesByPos).forEach((posStr) => {
    used[parseInt(posStr, 10)] += branchesByPos[posStr].length;
  });

  const width = Math.max(300, carbon[n].x - carbon[1].x + 160);
  const height = 220, padX = 60, baseY = 130;
  const toPx = (i) => [padX + carbon[i].x, baseY + carbon[i].y];

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  for (let i = 1; i < n; i++) {
    const [x1, y1] = toPx(i), [x2, y2] = toPx(i + 1);
    svg += bondLinesSVG(x1, y1, x2, y2, bondOrder[i] || 1, 11);
  }

  const CANDIDATE_ANGLES = [Math.PI / 2, -Math.PI / 2, Math.PI / 4, (3 * Math.PI) / 4, -Math.PI / 4, (-3 * Math.PI) / 4, 0, Math.PI];
  const angleDist = (a1, a2) => {
    const d = Math.abs(a1 - a2) % (2 * Math.PI);
    return Math.min(d, 2 * Math.PI - d);
  };

  for (let i = 1; i <= n; i++) {
    const [px, py] = toPx(i);
    const occupied = [];
    if (i > 1) { const [ox, oy] = toPx(i - 1); occupied.push(Math.atan2(-(oy - py), ox - px)); }
    if (i < n) { const [ox, oy] = toPx(i + 1); occupied.push(Math.atan2(-(oy - py), ox - px)); }

    (branchesByPos[i] || []).forEach((label, bi) => {
      const scored = CANDIDATE_ANGLES.map((ang) => ({
        ang, score: occupied.length ? Math.min(...occupied.map((o) => angleDist(ang, o))) : 1,
      }));
      scored.sort((p, q) => q.score - p.score);
      const ang = scored[0].ang;
      occupied.push(ang);
      const bx = px + Math.cos(ang) * 34, by = py - Math.sin(ang) * 34;
      svg += bondLinesSVG(px, py, bx, by, 1, 10);
      const lx = px + Math.cos(ang) * 44, ly = py - Math.sin(ang) * 44;
      svg += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle" font-size="11" fill="#000000">${escText(label)}</text>`;
    });

    const hCount = Math.max(0, 4 - used[i]);
    for (let h = 0; h < hCount; h++) {
      const scored = CANDIDATE_ANGLES.map((ang) => ({
        ang, score: occupied.length ? Math.min(...occupied.map((o) => angleDist(ang, o))) : 1,
      }));
      scored.sort((p, q) => q.score - p.score);
      const ang = scored[0].ang;
      occupied.push(ang);
      const bx = px + Math.cos(ang) * 22, by = py - Math.sin(ang) * 22;
      svg += bondLinesSVG(px, py, bx, by, 1, 10);
      const lx = px + Math.cos(ang) * 30, ly = py - Math.sin(ang) * 30;
      svg += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="#000000">H</text>`;
    }

    svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="9" fill="#ffffff" stroke="none"/>`;
    svg += `<text x="${px.toFixed(1)}" y="${(py + 4).toFixed(1)}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#000000">C</text>`;
  }

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 6e. Dinamika Partikel / Hukum Newton (diagram gaya)
// ---------------------------------------------------------------------

// "W:20:270|N:20:90" -> [{label:'W',magnitude:20,angle:270}, ...]
function parseForceList(raw) {
  if (!raw) return [];
  return String(raw).split('|').map((s) => s.trim()).filter(Boolean).map((part) => {
    const bits = part.split(':').map((s) => s.trim());
    return { label: bits[0] || '', magnitude: parseFloat(bits[1]), angle: parseFloat(bits[2]) || 0 };
  });
}

function renderForceDiagramSVG(cfg) {
  const width = 340, height = 300;
  const cx = width / 2, cy = height / 2;
  const boxSize = 64;
  const objek = cfg.objek || 'Benda';
  const forces = parseForceList(cfg.gaya);
  // sudutBidang: tilts the surface line for an inclined-plane (bidang
  // miring) setup — a very common Newton's-law worksheet shape that a
  // flat horizontal surface can't represent. The object box itself stays
  // upright (a free-body diagram isolates the object; force angles are
  // still given in the same absolute 0-360 frame as always), so this only
  // changes what the ground line looks like.
  const inclineDeg = numOrDefault(cfg.sudutBidang, 0);

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  if (cfg.permukaan !== 'tanpa') {
    const rad = (inclineDeg * Math.PI) / 180;
    const halfLen = width / 2 - 20;
    const gy = cy + boxSize / 2 + 24;
    const x1 = cx - halfLen, x2 = cx + halfLen;
    const y1 = gy + Math.tan(rad) * halfLen, y2 = gy - Math.tan(rad) * halfLen;
    svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#94a3b8" stroke-width="1.4"/>`;
    if (inclineDeg) {
      svg += `<path d="M${(x1 + 30).toFixed(1)},${y1.toFixed(1)} A30,30 0 0 1 ${(x1 + 30 * Math.cos(rad)).toFixed(1)},${(y1 - 30 * Math.sin(rad)).toFixed(1)}" fill="none" stroke="#94a3b8" stroke-width="1"/>`;
      svg += `<text x="${(x1 + 38).toFixed(1)}" y="${(y1 - 6).toFixed(1)}" font-size="10.5" fill="#000000">${inclineDeg}°</text>`;
    }
  }

  svg += `<rect x="${(cx - boxSize / 2).toFixed(1)}" y="${(cy - boxSize / 2).toFixed(1)}" width="${boxSize}" height="${boxSize}" fill="none" stroke="#000000" stroke-width="2"/>`;
  svg += `<text x="${cx.toFixed(1)}" y="${(cy + 5).toFixed(1)}" text-anchor="middle" font-size="12.5" font-weight="700" fill="#000000">${escText(objek)}</text>`;

  forces.forEach((f) => {
    const rad = (f.angle * Math.PI) / 180;
    const len = 55 + Math.min(35, Math.abs(f.magnitude) || 15);
    const startR = boxSize / 2 + 3;
    const x1 = cx + Math.cos(rad) * startR, y1 = cy - Math.sin(rad) * startR;
    const x2 = cx + Math.cos(rad) * (startR + len), y2 = cy - Math.sin(rad) * (startR + len);
    svg += arrowSVG(x1, y1, x2, y2);
    const lx = cx + Math.cos(rad) * (startR + len + 16), ly = cy - Math.sin(rad) * (startR + len + 16);
    const anchor = Math.cos(rad) > 0.3 ? 'start' : Math.cos(rad) < -0.3 ? 'end' : 'middle';
    const magTxt = isFinite(f.magnitude) ? ` = ${f.magnitude} N` : '';
    svg += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${anchor}" font-size="12" fill="#000000">${escText(f.label)}${magTxt}</text>`;
  });

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 6e2. Rangkaian Listrik (seri / paralel / campuran)
// ---------------------------------------------------------------------

// "R1:10" -> {name:'R1', value:10}
// Every component symbol a school-level circuit question needs. The key is
// what the author writes after the colon; ALIASES map the English spellings
// onto the same symbol so either language works.
const CIRCUIT_KINDS = {
  resistor: 'resistor', hambatan: 'resistor',
  lampu: 'lampu', lamp: 'lampu', bohlam: 'lampu',
  saklar: 'saklar', switch: 'saklar', 'saklar-buka': 'saklar',
  'saklar-tutup': 'saklarTutup', 'switch-closed': 'saklarTutup',
  amperemeter: 'amperemeter', ammeter: 'amperemeter', ampermeter: 'amperemeter',
  voltmeter: 'voltmeter',
  geser: 'geser', rheostat: 'geser', 'hambatan-geser': 'geser', variabel: 'geser',
  termistor: 'termistor', thermistor: 'termistor',
  ldr: 'ldr',
  dioda: 'dioda', diode: 'dioda', led: 'led',
  kapasitor: 'kapasitor', capacitor: 'kapasitor',
  motor: 'motor',
  sekring: 'sekring', fuse: 'sekring'
};

// "R1:10" (a resistor of 10 Ω, the original and still the default form),
// "S1:saklar" (a symbol with no value), or "R1:geser:20" (both).
function parseCircuitComponent(str) {
  const parts = String(str).split(':').map((s) => s.trim());
  const name = parts[0] || 'R';
  let kind = 'resistor';
  let valueRaw = parts[1];
  if (parts[1] && CIRCUIT_KINDS[parts[1].toLowerCase()]) {
    kind = CIRCUIT_KINDS[parts[1].toLowerCase()];
    valueRaw = parts[2];
  }
  const v = parseFloat(valueRaw);
  return { name, kind, value: isFinite(v) ? v : NaN };
}

// General "susunan" DSL: series blocks joined by "+", with a parenthesised
// "(A|B|C)" group standing for those components wired in parallel with
// each other — e.g. "R1:10+(R2:20|R3:30)+R4:15" is R1 in series with a
// two-branch parallel group, in series with R4. Splitting on "+" has to
// respect paren depth so it doesn't cut a parallel group in half.
function parseCircuitSusunan(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];
  const tokens = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === '+' && depth === 0) { tokens.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) tokens.push(cur);
  return tokens.map((t) => {
    t = t.trim();
    if (t.startsWith('(') && t.endsWith(')')) {
      return { type: 'parallel', comps: t.slice(1, -1).split('|').map(parseCircuitComponent) };
    }
    return { type: 'series', comp: parseCircuitComponent(t) };
  });
}

// IEC-style resistor (a plain rectangle, not a zigzag) matching what
// Indonesian textbooks use, with short lead wires on each side so it drops
// cleanly into any horizontal wire span.
// Unit shown beside a component's value, by symbol. Anything not listed
// carries no value at all (a switch has no ohms).
const CIRCUIT_UNITS = { resistor: ' Ω', geser: ' Ω', termistor: ' Ω', ldr: ' Ω', kapasitor: ' μF', lampu: ' W' };

function circuitLabel(comp) {
  const unit = CIRCUIT_UNITS[comp.kind];
  return comp.name + (unit && isFinite(comp.value) ? ' = ' + comp.value + unit : '');
}

// Draws one component in the slot between x1 and x2 at height y: leads in
// from both sides, symbol centred, label above.
function componentSVG(x1, y, x2, comp) {
  const kind = comp.kind || 'resistor';
  if (kind === 'resistor') return resistorSVG(x1, y, x2, circuitLabel(comp));

  const cx = (x1 + x2) / 2;
  const label = circuitLabel(comp);
  const S = (a, b, c, d, w) => `<line x1="${a.toFixed(1)}" y1="${b.toFixed(1)}" x2="${c.toFixed(1)}" y2="${d.toFixed(1)}" stroke="#000000" stroke-width="${w || 1.6}"/>`;
  let bodyHalf = 12;
  let out = '';
  let labelY = y - 18;

  if (kind === 'lampu' || kind === 'amperemeter' || kind === 'voltmeter' || kind === 'motor') {
    const r = 11;
    bodyHalf = r;
    out += `<circle cx="${cx.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#ffffff" stroke="#000000" stroke-width="1.6"/>`;
    if (kind === 'lampu') {
      const k = r * 0.7;
      out += S(cx - k, y - k, cx + k, y + k);
      out += S(cx - k, y + k, cx + k, y - k);
    } else {
      const letter = kind === 'amperemeter' ? 'A' : kind === 'voltmeter' ? 'V' : 'M';
      out += `<text x="${cx.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="#000000">${letter}</text>`;
    }
    labelY = y - r - 6;
  } else if (kind === 'saklar' || kind === 'saklarTutup') {
    bodyHalf = 13;
    const a = cx - bodyHalf, b = cx + bodyHalf;
    out += `<circle cx="${a.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="#000000"/>`;
    out += `<circle cx="${b.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="#000000"/>`;
    // An open switch is drawn with its blade lifted — the only thing that
    // distinguishes "the circuit is broken" from "the circuit is complete".
    out += kind === 'saklarTutup' ? S(a, y, b, y) : S(a, y, b - 3, y - 11);
    labelY = y - 20;
  } else if (kind === 'kapasitor') {
    bodyHalf = 5;
    out += S(cx - bodyHalf, y - 10, cx - bodyHalf, y + 10);
    out += S(cx + bodyHalf, y - 10, cx + bodyHalf, y + 10);
    labelY = y - 16;
  } else if (kind === 'dioda' || kind === 'led') {
    bodyHalf = 9;
    out += `<polygon points="${(cx - bodyHalf).toFixed(1)},${(y - 8).toFixed(1)} ${(cx - bodyHalf).toFixed(1)},${(y + 8).toFixed(1)} ${(cx + bodyHalf).toFixed(1)},${y.toFixed(1)}" fill="#ffffff" stroke="#000000" stroke-width="1.6"/>`;
    out += S(cx + bodyHalf, y - 8, cx + bodyHalf, y + 8);
    if (kind === 'led') {
      out += arrowSVG(cx + 2, y - 12, cx + 12, y - 20);
      out += arrowSVG(cx - 4, y - 12, cx + 6, y - 20);
      labelY = y - 26;
    } else {
      labelY = y - 15;
    }
  } else if (kind === 'sekring') {
    const w = 30, h = 12;
    bodyHalf = w / 2;
    out += `<rect x="${(cx - w / 2).toFixed(1)}" y="${(y - h / 2).toFixed(1)}" width="${w}" height="${h}" fill="#ffffff" stroke="#000000" stroke-width="1.6"/>`;
    out += S(cx - w / 2, y, cx + w / 2, y, 1.2);
    labelY = y - h / 2 - 5;
  } else {
    // geser / termistor / ldr all start from the resistor box and add
    // their own distinguishing mark on top.
    const w = 34, h = 14;
    bodyHalf = w / 2;
    out += `<rect x="${(cx - w / 2).toFixed(1)}" y="${(y - h / 2).toFixed(1)}" width="${w}" height="${h}" fill="#ffffff" stroke="#000000" stroke-width="1.6"/>`;
    if (kind === 'geser') {
      out += arrowSVG(cx - w / 2 - 5, y + 13, cx + w / 2 + 3, y - 13);
      labelY = y - h / 2 - 14;
    } else if (kind === 'termistor') {
      out += S(cx - w / 2 - 4, y + 12, cx + 4, y + 12, 1.4);
      out += S(cx + 4, y + 12, cx + w / 2 + 4, y - 12, 1.4);
      labelY = y - h / 2 - 5;
    } else if (kind === 'ldr') {
      out += `<circle cx="${cx.toFixed(1)}" cy="${y.toFixed(1)}" r="17" fill="none" stroke="#000000" stroke-width="1.3"/>`;
      bodyHalf = 17;
      out += arrowSVG(cx - 26, y - 26, cx - 14, y - 14);
      out += arrowSVG(cx - 16, y - 30, cx - 4, y - 18);
      labelY = y - 34;
    }
  }

  let svg = S(x1, y, cx - bodyHalf, y) + out + S(cx + bodyHalf, y, x2, y);
  if (label) {
    svg += `<text x="${cx.toFixed(1)}" y="${labelY.toFixed(1)}" font-size="10.5" text-anchor="middle" fill="#000000">${escText(label)}</text>`;
  }
  return svg;
}

function resistorSVG(x1, y, x2, label) {
  const w = 34, h = 14;
  const bx = (x1 + x2) / 2 - w / 2;
  let s = `<line x1="${x1.toFixed(1)}" y1="${y.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#000000" stroke-width="1.6"/>`;
  s += `<rect x="${bx.toFixed(1)}" y="${(y - h / 2).toFixed(1)}" width="${w}" height="${h}" fill="#ffffff" stroke="#000000" stroke-width="1.6"/>`;
  s += `<line x1="${(bx + w).toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#000000" stroke-width="1.6"/>`;
  if (label) s += `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${(y - h / 2 - 5).toFixed(1)}" font-size="10.5" text-anchor="middle" fill="#000000">${escText(label)}</text>`;
  return s;
}

function renderCircuitSVG(cfg) {
  const tipe = cfg.tipe || 'seri';
  const comps = String(cfg.komponen || '').split(',').map((s) => s.trim()).filter(Boolean).map(parseCircuitComponent);
  let blocks;
  if (cfg.susunan) blocks = parseCircuitSusunan(cfg.susunan);
  else if (tipe === 'paralel') blocks = comps.length ? [{ type: 'parallel', comps }] : [];
  else blocks = comps.map((c) => ({ type: 'series', comp: c }));
  if (!blocks.length) blocks = [{ type: 'series', comp: { name: 'R1', value: 10 } }];

  const branchGap = 30, blockWidth = 90;
  const maxBranches = Math.max(1, ...blocks.map((b) => (b.type === 'parallel' ? b.comps.length : 1)));

  const leftX = 55;
  const rightX = leftX + blocks.length * blockWidth;
  const width = rightX + 35;
  const topY = 50;
  const bottomY = topY + (maxBranches - 1) * branchGap + 55;
  const height = bottomY + 35;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  const bcy = (topY + bottomY) / 2;
  svg += `<line x1="${leftX}" y1="${topY}" x2="${leftX}" y2="${(bcy - 10).toFixed(1)}" stroke="#000000" stroke-width="1.6"/>`;
  svg += `<line x1="${(leftX - 9).toFixed(1)}" y1="${(bcy - 10).toFixed(1)}" x2="${(leftX + 9).toFixed(1)}" y2="${(bcy - 10).toFixed(1)}" stroke="#000000" stroke-width="1.6"/>`;
  svg += `<line x1="${(leftX - 5).toFixed(1)}" y1="${(bcy - 2).toFixed(1)}" x2="${(leftX + 5).toFixed(1)}" y2="${(bcy - 2).toFixed(1)}" stroke="#000000" stroke-width="4"/>`;
  svg += `<line x1="${leftX}" y1="${(bcy + 2).toFixed(1)}" x2="${leftX}" y2="${bottomY}" stroke="#000000" stroke-width="1.6"/>`;
  const sumber = numOrDefault(cfg.sumber, null);
  if (sumber !== null) {
    svg += `<text x="${(leftX - 14).toFixed(1)}" y="${(bcy + 4).toFixed(1)}" font-size="11" text-anchor="end" fill="#000000">${sumber} V</text>`;
  }

  svg += `<line x1="${leftX}" y1="${bottomY.toFixed(1)}" x2="${rightX}" y2="${bottomY.toFixed(1)}" stroke="#000000" stroke-width="1.6"/>`;
  svg += `<line x1="${rightX}" y1="${topY}" x2="${rightX}" y2="${bottomY.toFixed(1)}" stroke="#000000" stroke-width="1.6"/>`;

  blocks.forEach((block, i) => {
    const bx0 = leftX + i * blockWidth, bx1 = bx0 + blockWidth;
    if (block.type === 'series') {
      svg += componentSVG(bx0, topY, bx1, block.comp);
    } else {
      const n = block.comps.length;
      const lastY = topY + (n - 1) * branchGap;
      if (n > 1) {
        svg += `<line x1="${bx0.toFixed(1)}" y1="${topY}" x2="${bx0.toFixed(1)}" y2="${lastY.toFixed(1)}" stroke="#000000" stroke-width="1.6"/>`;
        svg += `<line x1="${bx1.toFixed(1)}" y1="${topY}" x2="${bx1.toFixed(1)}" y2="${lastY.toFixed(1)}" stroke="#000000" stroke-width="1.6"/>`;
      }
      block.comps.forEach((c, j) => {
        const y = topY + j * branchGap;
        svg += componentSVG(bx0, y, bx1, c);
      });
    }
    if (i > 0) svg += `<circle cx="${bx0.toFixed(1)}" cy="${topY}" r="1.8" fill="#000000"/>`;
  });

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 6f. Rantai Makanan (biologi)
// ---------------------------------------------------------------------

function renderFoodChainSVG(cfg) {
  const organisms = String(cfg.organisme || '').split(',').map((s) => s.trim()).filter(Boolean);
  const n = Math.max(1, organisms.length);
  const boxW = 92, boxH = 42, gap = 36;
  const width = Math.max(320, n * boxW + (n - 1) * gap + 40);
  const height = 130;
  const y = height / 2 - boxH / 2;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  organisms.forEach((name, i) => {
    const x = 20 + i * (boxW + gap);
    svg += `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" fill="none" stroke="#000000" stroke-width="1.6"/>`;
    svg += `<text x="${(x + boxW / 2).toFixed(1)}" y="${(y + boxH / 2 + 4).toFixed(1)}" text-anchor="middle" font-size="11" fill="#000000">${escText(name)}</text>`;
    if (i < n - 1) svg += arrowSVG(x + boxW, y + boxH / 2, x + boxW + gap, y + boxH / 2);
  });

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 6g. Bentuk Molekul / Domain Elektron (VSEPR) — kimia
// ---------------------------------------------------------------------

// angleDeg measured the usual math way (0 = right, 90 = up) so preset data
// below reads naturally; the y-flip that turns "up" into a smaller SVG y
// happens once, here.
function vseprPolar(cx, cy, angleDeg, r) {
  const rad = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
}

function wedgeBondSVG(cx, cy, ex, ey, halfWidth) {
  const dx = ex - cx, dy = ey - cy, len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;
  const w = halfWidth == null ? 6 : halfWidth;
  const p2x = ex + px * w, p2y = ey + py * w;
  const p3x = ex - px * w, p3y = ey - py * w;
  return `<polygon points="${cx.toFixed(1)},${cy.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)} ${p3x.toFixed(1)},${p3y.toFixed(1)}" fill="#000000"/>`;
}

// Each preset is one AXmEn electron-domain arrangement: "bonds" are the m
// bonded-atom (X) directions actually drawn (solid = in the page plane,
// wedge = toward the viewer, dash = away from the viewer — the standard
// textbook convention for showing a 3D shape in 2D), "lp" are the n lone
// electron-pair directions (drawn as a small two-dot cloud, same convention
// Lewis structures already use elsewhere in this file). Angles/lengths were
// chosen to make each shape visually recognizable, not to be crystallographic
// projections.
const VSEPR_PRESETS = {
  ax2: {
    nama: 'Linear', sudut: '180°',
    bonds: [{ ang: 0, style: 'solid' }, { ang: 180, style: 'solid' }], lp: [],
  },
  ax2e1: {
    nama: 'Bentuk V (Bengkok)', sudut: '≈120°',
    bonds: [{ ang: 210, style: 'solid' }, { ang: 330, style: 'solid' }], lp: [{ ang: 90 }],
  },
  ax2e2: {
    nama: 'Bentuk V (Bengkok)', sudut: '≈104,5°',
    bonds: [{ ang: 218, style: 'solid' }, { ang: 322, style: 'solid' }], lp: [{ ang: 60 }, { ang: 120 }],
  },
  ax3: {
    nama: 'Segitiga Datar (Trigonal Planar)', sudut: '120°',
    bonds: [{ ang: 90, style: 'solid' }, { ang: 210, style: 'solid' }, { ang: 330, style: 'solid' }], lp: [],
  },
  ax3e1: {
    nama: 'Piramida Trigonal', sudut: '≈107°',
    bonds: [{ ang: 210, style: 'solid' }, { ang: 330, style: 'solid' }, { ang: 270, style: 'wedge' }], lp: [{ ang: 90 }],
  },
  ax3e2: {
    nama: 'Bentuk T', sudut: '≈90°',
    bonds: [{ ang: 90, style: 'solid' }, { ang: 270, style: 'solid' }, { ang: 0, style: 'wedge' }],
    lp: [{ ang: 150 }, { ang: 210 }],
  },
  ax4: {
    nama: 'Tetrahedral', sudut: '109,5°',
    bonds: [
      { ang: 125, style: 'solid' }, { ang: 55, style: 'solid' },
      { ang: 275, style: 'wedge' }, { ang: 205, style: 'dash' },
    ],
    lp: [],
  },
  ax4e1: {
    nama: 'Jungkat-jungkit (See-saw)', sudut: '≈89° / ≈117°',
    bonds: [
      { ang: 90, style: 'dash' }, { ang: 270, style: 'wedge' },
      { ang: 0, style: 'solid' }, { ang: 200, style: 'solid' },
    ],
    lp: [{ ang: 140 }],
  },
  ax4e2: {
    nama: 'Segiempat Datar (Square Planar)', sudut: '90°',
    bonds: [
      { ang: 0, style: 'solid' }, { ang: 90, style: 'solid' },
      { ang: 180, style: 'solid' }, { ang: 270, style: 'solid' },
    ],
    lp: [{ ang: 45, r: 24 }, { ang: 225, r: 24 }],
  },
  ax5: {
    nama: 'Bipiramida Trigonal', sudut: '90° / 120°',
    bonds: [
      { ang: 90, style: 'dash' }, { ang: 270, style: 'wedge' },
      { ang: 0, style: 'solid' }, { ang: 210, style: 'solid' }, { ang: 330, style: 'solid' },
    ],
    lp: [],
  },
  ax5e1: {
    nama: 'Piramida Segiempat', sudut: '≈90°',
    bonds: [
      { ang: 45, style: 'solid' }, { ang: 135, style: 'solid' },
      { ang: 225, style: 'solid' }, { ang: 315, style: 'solid' },
      { ang: 90, style: 'wedge', len: 65 },
    ],
    lp: [{ ang: 270 }],
  },
  ax6: {
    nama: 'Oktahedral', sudut: '90°',
    bonds: [
      { ang: 0, style: 'solid' }, { ang: 90, style: 'solid' },
      { ang: 180, style: 'solid' }, { ang: 270, style: 'solid' },
      { ang: 45, style: 'wedge', len: 62 }, { ang: 225, style: 'dash', len: 62 },
    ],
    lp: [],
  },
};

function renderMoleculeShapeSVG(cfg) {
  const key = String(cfg.tipe || 'ax4').toLowerCase();
  const preset = VSEPR_PRESETS[key] || VSEPR_PRESETS.ax4;
  const pusatLabel = cfg.pusat || 'A';
  const ikatanLabel = cfg.ikatan || 'X';
  const width = 300;
  // A preset can have a bond/lone-pair pointing straight up (ang 90) whose
  // atom circle would otherwise collide with the molecule-name caption —
  // grow the canvas and push the whole diagram down by the same amount when
  // that caption is present, which keeps the (already-tuned) gap to the
  // bottom caption unchanged instead of tuning every preset's geometry.
  const height = cfg.nama ? 300 : 260;
  const cx = width / 2, cy = cfg.nama ? 138 : 118;
  const BOND_LEN = 82;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  if (cfg.nama) {
    svg += `<text x="${(width / 2).toFixed(1)}" y="20" text-anchor="middle" font-size="12" font-weight="700" fill="#000000">${escText(cfg.nama)}</text>`;
  }

  preset.bonds.forEach((b) => {
    const len = b.len || BOND_LEN;
    const [ex, ey] = vseprPolar(cx, cy, b.ang, len);
    if (b.style === 'wedge') {
      svg += wedgeBondSVG(cx, cy, ex, ey, 6);
    } else if (b.style === 'dash') {
      svg += `<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#000000" stroke-width="1.8" stroke-dasharray="4,3"/>`;
    } else {
      svg += `<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#000000" stroke-width="1.8"/>`;
    }
    const [lx, ly] = vseprPolar(cx, cy, b.ang, len + 14);
    svg += `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="11" fill="#ffffff" stroke="#000000" stroke-width="1.2"/>`;
    svg += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#000000">${escText(ikatanLabel)}</text>`;
  });

  (preset.lp || []).forEach((lpItem) => {
    const [px, py] = vseprPolar(cx, cy, lpItem.ang, lpItem.r || 38);
    const rad = (lpItem.ang * Math.PI) / 180;
    const perpx = -Math.sin(rad), perpy = -Math.cos(rad);
    svg += `<circle cx="${(px + perpx * 3.5).toFixed(1)}" cy="${(py + perpy * 3.5).toFixed(1)}" r="1.8" fill="#000000"/>`;
    svg += `<circle cx="${(px - perpx * 3.5).toFixed(1)}" cy="${(py - perpy * 3.5).toFixed(1)}" r="1.8" fill="#000000"/>`;
  });

  svg += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="13" fill="#ffffff" stroke="#000000" stroke-width="1.4"/>`;
  svg += `<text x="${cx.toFixed(1)}" y="${(cy + 5).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="700" fill="#000000">${escText(pusatLabel)}</text>`;

  const captionY = height - 34;
  svg += `<text x="${(width / 2).toFixed(1)}" y="${captionY}" text-anchor="middle" font-size="12" font-weight="700" fill="#000000">${escText(preset.nama)} (${escText(key.toUpperCase())})</text>`;
  svg += `<text x="${(width / 2).toFixed(1)}" y="${captionY + 16}" text-anchor="middle" font-size="11" fill="#444444">Sudut ikatan: ${escText(preset.sudut)}</text>`;

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 6g2. Diagram Tingkat Energi (kimia — termokimia/entalpi, konfigurasi
// elektron, dsb: any "level ke level" energy comparison)
// ---------------------------------------------------------------------

// "Reaktan:0,Produk:-50" -> [{name:'Reaktan',value:0}, {name:'Produk',value:-50}]
function parseEnergyLevelList(raw) {
  return String(raw || '').split(',').map((s) => s.trim()).filter(Boolean).map((pair) => {
    const [name, val] = pair.split(':').map((x) => (x || '').trim());
    return { name: name || '', value: parseFloat(val) };
  });
}

function renderEnergyLevelSVG(cfg) {
  let levels = parseEnergyLevelList(cfg.level);
  if (!levels.length) levels = [{ name: 'Reaktan', value: 0 }, { name: 'Produk', value: -50 }];
  const satuan = cfg.satuan || '';

  const width = 360, padTop = 30, padBottom = 46, padX = 50, chartH = 190;
  const height = padTop + chartH + padBottom;
  const vals = levels.map((l) => (isFinite(l.value) ? l.value : 0));
  const vmin = Math.min(...vals), vmax = Math.max(...vals);
  const vrange = (vmax - vmin) || 1;
  // Levels with equal or near-equal values would otherwise collapse onto
  // the same line — pad the range a bit so every shelf stays visible even
  // when all the given values are identical.
  const toY = (v) => padTop + chartH - ((v - vmin) / (vrange || 1)) * (chartH - 20) - 10;

  const shelfW = 76;
  const n = levels.length;
  const gap = n > 1 ? (width - 2 * padX - shelfW) / (n - 1) : 0;
  const xs = levels.map((_, i) => padX + i * gap);

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  levels.forEach((lv, i) => {
    const x0 = xs[i], x1 = x0 + shelfW, y = toY(vals[i]);
    svg += `<line x1="${x0.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#000000" stroke-width="2.2"/>`;
    svg += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${(y - 8).toFixed(1)}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#000000">${escText(lv.name)}</text>`;
    const valTxt = isFinite(lv.value) ? lv.value + (satuan ? ' ' + satuan : '') : '';
    svg += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${(y + 16).toFixed(1)}" text-anchor="middle" font-size="10" fill="#475569">${escText(valTxt)}</text>`;
  });

  const wantTransisi = String(cfg.transisi || '').trim().toLowerCase();
  if (wantTransisi !== 'tidak' && wantTransisi !== 'no' && wantTransisi !== 'none') {
    for (let i = 0; i < n - 1; i++) {
      const x0 = xs[i] + shelfW, y0 = toY(vals[i]);
      const x1 = xs[i + 1], y1 = toY(vals[i + 1]);
      svg += arrowSVG(x0, y0, x1, y1, { dash: '4,3', strokeWidth: 1.4 });
      const diff = vals[i + 1] - vals[i];
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const diffTxt = (diff >= 0 ? '+' : '') + (Math.round(diff * 100) / 100) + (satuan ? ' ' + satuan : '');
      svg += `<text x="${mx.toFixed(1)}" y="${(my - 6).toFixed(1)}" text-anchor="middle" font-size="10" fill="#000000">Δ = ${escText(diffTxt)}</text>`;
    }
  }

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 6h. Sel Hewan / Sel Tumbuhan — biologi
// ---------------------------------------------------------------------

function cellPartLabel(x, y, text, anchor) {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor || 'start'}" font-size="10.5" fill="#000000">${escText(text)}</text>`;
}

function cellLeader(x1, y1, x2, y2) {
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#666666" stroke-width="0.9"/>`;
}

function renderCellSVG(cfg) {
  const tipe = String(cfg.tipe || 'hewan').toLowerCase() === 'tumbuhan' ? 'tumbuhan' : 'hewan';
  const showLabel = String(cfg.label || 'ya').toLowerCase() !== 'tidak';
  const width = 420, height = 320;
  const cx = width / 2, cy = height / 2 + 5;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  svg += `<text x="${(width / 2).toFixed(1)}" y="20" text-anchor="middle" font-size="12" font-weight="700" fill="#000000">${tipe === 'tumbuhan' ? 'Sel Tumbuhan' : 'Sel Hewan'}</text>`;

  const parts = [];

  if (tipe === 'tumbuhan') {
    // Dinding sel (cell wall) — outer, rigid, drawn as a rounded rect since
    // a real plant cell's wall gives it straighter edges than an animal
    // cell's membrane.
    svg += `<rect x="${cx - 165}" y="${cy - 118}" width="330" height="236" rx="18" fill="none" stroke="#000000" stroke-width="2.6"/>`;
    // Membran sel (cell membrane) — just inside the wall.
    svg += `<rect x="${cx - 155}" y="${cy - 108}" width="310" height="216" rx="14" fill="#f0fdf4" stroke="#000000" stroke-width="1.2"/>`;
    // Vakuola (vacuole) — dominates a mature plant cell.
    svg += `<ellipse cx="${cx + 15}" cy="${cy + 5}" rx="105" ry="78" fill="#dbeafe" stroke="#000000" stroke-width="1.3"/>`;
    parts.push({ x: cx + 15, y: cy + 5, label: 'Vakuola', lx: cx + 100, ly: cy + 90, anchor: 'start' });
    // Kloroplas (chloroplast) — a few, near the wall.
    [[-125, -70], [-135, 30], [-95, 85]].forEach(([dx, dy], i) => {
      svg += `<ellipse cx="${cx + dx}" cy="${cy + dy}" rx="16" ry="9" fill="#86efac" stroke="#000000" stroke-width="1"/>`;
      if (i === 0) parts.push({ x: cx + dx, y: cy + dy, label: 'Kloroplas', lx: cx - 160, ly: cy - 88, anchor: 'start' });
    });
    // Nukleus, pushed to a corner since the vacuole takes the center.
    svg += `<circle cx="${cx - 90}" cy="${cy - 60}" r="34" fill="#e0e7ff" stroke="#000000" stroke-width="1.3"/>`;
    svg += `<circle cx="${cx - 90}" cy="${cy - 60}" r="9" fill="#6366f1"/>`;
    parts.push({ x: cx - 90, y: cy - 60, label: 'Inti Sel (Nukleus)', lx: cx - 160, ly: cy - 128, anchor: 'start' });
    // Mitokondria.
    svg += `<ellipse cx="${cx - 60}" cy="${cy + 95}" rx="18" ry="10" fill="#fed7aa" stroke="#000000" stroke-width="1" transform="rotate(20 ${cx - 60} ${cy + 95})"/>`;
    parts.push({ x: cx - 60, y: cy + 95, label: 'Mitokondria', lx: cx - 160, ly: cy + 128, anchor: 'start' });
    parts.push({ x: cx - 155, y: cy - 108, label: 'Membran Sel', lx: cx + 30, ly: cy - 128, anchor: 'start' });
    parts.push({ x: cx - 165, y: cy - 118, label: 'Dinding Sel', lx: cx + 100, ly: cy - 143, anchor: 'start' });
  } else {
    // Membran sel (cell membrane) — soft, irregular outline typical of an
    // animal cell (no rigid wall).
    svg += `<ellipse cx="${cx}" cy="${cy}" rx="160" ry="120" fill="#fff7ed" stroke="#000000" stroke-width="2.2"/>`;
    parts.push({ x: cx, y: cy - 120, label: 'Membran Sel', lx: cx + 5, ly: cy - 132, anchor: 'start' });
    // Nukleus + anak inti (nucleolus).
    svg += `<circle cx="${cx - 40}" cy="${cy - 15}" r="42" fill="#e0e7ff" stroke="#000000" stroke-width="1.3"/>`;
    svg += `<circle cx="${cx - 40}" cy="${cy - 15}" r="10" fill="#6366f1"/>`;
    parts.push({ x: cx - 40, y: cy - 15, label: 'Inti Sel (Nukleus)', lx: cx - 150, ly: cy - 95, anchor: 'start' });
    parts.push({ x: cx - 40, y: cy - 15, label: 'Anak Inti (Nukleolus)', lx: cx - 150, ly: cy - 78, anchor: 'start' });
    // Retikulum endoplasma — a short squiggle beside the nucleus.
    svg += `<path d="M ${cx + 6} ${cy - 45} q 12 -14 24 0 t 24 0 t 24 0" fill="none" stroke="#000000" stroke-width="1.3"/>`;
    parts.push({ x: cx + 42, y: cy - 45, label: 'Retikulum Endoplasma', lx: cx + 60, ly: cy - 95, anchor: 'start' });
    // Mitokondria, x2.
    svg += `<ellipse cx="${cx + 70}" cy="${cy + 40}" rx="22" ry="12" fill="#fed7aa" stroke="#000000" stroke-width="1" transform="rotate(-25 ${cx + 70} ${cy + 40})"/>`;
    svg += `<ellipse cx="${cx + 55}" cy="${cy - 55}" rx="20" ry="11" fill="#fed7aa" stroke="#000000" stroke-width="1" transform="rotate(30 ${cx + 55} ${cy - 55})"/>`;
    parts.push({ x: cx + 70, y: cy + 40, label: 'Mitokondria', lx: cx + 90, ly: cy + 95, anchor: 'start' });
    // Ribosom — scattered dots.
    [[-90, 55], [-60, 70], [-100, 20], [30, 75]].forEach(([dx, dy]) => {
      svg += `<circle cx="${cx + dx}" cy="${cy + dy}" r="2.4" fill="#000000"/>`;
    });
    parts.push({ x: cx - 90, y: cy + 55, label: 'Ribosom', lx: cx - 150, ly: cy + 95, anchor: 'start' });
    // Vakuola — small in an animal cell.
    svg += `<circle cx="${cx + 20}" cy="${cy + 75}" r="14" fill="#bfdbfe" stroke="#000000" stroke-width="1"/>`;
    parts.push({ x: cx + 20, y: cy + 75, label: 'Vakuola', lx: cx + 5, ly: cy + 115, anchor: 'start' });
  }

  if (showLabel) {
    parts.forEach((p) => {
      svg += cellLeader(p.x, p.y, p.lx, p.ly);
      svg += cellPartLabel(p.lx + 3, p.ly + 3, p.label, p.anchor);
    });
  }

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 9. Transformasi Geometri (translasi/refleksi/rotasi/dilatasi)
// ---------------------------------------------------------------------

// "A:1:1,B:4:1,C:1:5" -> [{name:'A',x:1,y:1}, ...]
function parseVertexList(raw) {
  return String(raw || '').split(',').map((s) => s.trim()).filter(Boolean).map((tok) => {
    const bits = tok.split(':').map((s) => s.trim());
    return { name: bits[0] || '', x: parseFloat(bits[1]) || 0, y: parseFloat(bits[2]) || 0 };
  });
}

function applyGeoTransform(points, cfg) {
  const jenis = String(cfg.jenis || 'translasi').toLowerCase();
  if (jenis === 'refleksi') {
    const garis = String(cfg.garis || 'y-axis').toLowerCase();
    return points.map((p) => {
      let nx = p.x, ny = p.y;
      if (garis === 'x-axis' || garis === 'sumbu-x') ny = -p.y;
      else if (garis === 'y-axis' || garis === 'sumbu-y') nx = -p.x;
      else if (garis === 'y=x') { nx = p.y; ny = p.x; }
      else if (garis === 'y=-x') { nx = -p.y; ny = -p.x; }
      else if (garis.startsWith('x=')) nx = 2 * parseFloat(garis.slice(2)) - p.x;
      else if (garis.startsWith('y=')) ny = 2 * parseFloat(garis.slice(2)) - p.y;
      return { name: p.name + "'", x: nx, y: ny };
    });
  }
  if (jenis === 'rotasi') {
    const [px, py] = String(cfg.pusat || '0,0').split(',').map(Number);
    let sudut = numOrDefault(cfg.sudut, 90);
    if (String(cfg.arah || '').toLowerCase().startsWith('searah')) sudut = -sudut;
    const rad = (sudut * Math.PI) / 180;
    return points.map((p) => {
      const dx = p.x - px, dy = p.y - py;
      return { name: p.name + "'", x: px + dx * Math.cos(rad) - dy * Math.sin(rad), y: py + dx * Math.sin(rad) + dy * Math.cos(rad) };
    });
  }
  if (jenis === 'dilatasi') {
    const [px, py] = String(cfg.pusat || '0,0').split(',').map(Number);
    const k = numOrDefault(cfg.faktor, 2);
    return points.map((p) => ({ name: p.name + "'", x: px + (p.x - px) * k, y: py + (p.y - py) * k }));
  }
  // translasi (default)
  const [dx, dy] = String(cfg.vektor || '2,2').split(',').map(Number);
  return points.map((p) => ({ name: p.name + "'", x: p.x + dx, y: p.y + dy }));
}

function renderTransformSVG(cfg) {
  const orig = parseVertexList(cfg.titik);
  const points = orig.length ? orig : [{ name: 'A', x: 1, y: 1 }, { name: 'B', x: 4, y: 1 }, { name: 'C', x: 1, y: 5 }];
  const image = applyGeoTransform(points, cfg);
  const allPts = points.concat(image);
  const xs = allPts.map((p) => p.x), ys = allPts.map((p) => p.y);
  const xmin = numOrDefault(cfg.xmin, Math.min(0, ...xs) - 2), xmax = numOrDefault(cfg.xmax, Math.max(0, ...xs) + 2);
  const ymin = numOrDefault(cfg.ymin, Math.min(0, ...ys) - 2), ymax = numOrDefault(cfg.ymax, Math.max(0, ...ys) + 2);
  const width = 340, height = 300, pad = 32;
  const sx = (width - 2 * pad) / ((xmax - xmin) || 1), sy = (height - 2 * pad) / ((ymax - ymin) || 1);
  const toPx = (x, y) => [pad + (x - xmin) * sx, height - pad - (y - ymin) * sy];

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  const xStep = niceStep(xmax - xmin), yStep = niceStep(ymax - ymin);
  for (let gx = Math.ceil(xmin / xStep) * xStep; gx <= xmax; gx += xStep) {
    const [px] = toPx(gx, 0);
    svg += `<line x1="${px.toFixed(1)}" y1="${pad}" x2="${px.toFixed(1)}" y2="${height - pad}" stroke="#eef0f3" stroke-width="1"/>`;
  }
  for (let gy = Math.ceil(ymin / yStep) * yStep; gy <= ymax; gy += yStep) {
    const [, py] = toPx(0, gy);
    svg += `<line x1="${pad}" y1="${py.toFixed(1)}" x2="${width - pad}" y2="${py.toFixed(1)}" stroke="#eef0f3" stroke-width="1"/>`;
  }
  if (xmin <= 0 && xmax >= 0) { const [px0] = toPx(0, 0); svg += `<line x1="${px0.toFixed(1)}" y1="${pad}" x2="${px0.toFixed(1)}" y2="${height - pad}" stroke="#94a3b8" stroke-width="1.4"/>`; }
  if (ymin <= 0 && ymax >= 0) { const [, py0] = toPx(0, 0); svg += `<line x1="${pad}" y1="${py0.toFixed(1)}" x2="${width - pad}" y2="${py0.toFixed(1)}" stroke="#94a3b8" stroke-width="1.4"/>`; }

  function drawPoly(pts, dash) {
    const d = pts.map((p, i) => { const [px, py] = toPx(p.x, p.y); return (i === 0 ? 'M' : 'L') + px.toFixed(1) + ' ' + py.toFixed(1); }).join(' ') + ' Z';
    svg += `<path d="${d}" fill="none" stroke="#000000" stroke-width="1.8"${dash ? ' stroke-dasharray="' + dash + '"' : ''}/>`;
    pts.forEach((p) => {
      const [px, py] = toPx(p.x, p.y);
      svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.4" fill="#000000"/>`;
      svg += `<text x="${(px + 5).toFixed(1)}" y="${(py - 5).toFixed(1)}" font-size="11" font-weight="700" fill="#000000">${escText(p.name)}</text>`;
    });
  }
  drawPoly(points, null);
  drawPoly(image, '5,3');

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 10. Diagram Pohon Peluang (probability tree)
// ---------------------------------------------------------------------

// "Merah:2/5,Biru:3/5" -> [{label:'Merah', fracTxt:'2/5', p:0.4}, ...]
function parseProbBranches(raw) {
  return String(raw || '').split(',').map((s) => s.trim()).filter(Boolean).map((tok) => {
    const bits = tok.split(':');
    const label = (bits[0] || '').trim();
    const fracTxt = (bits[1] || '').trim();
    let p = NaN;
    if (fracTxt.includes('/')) {
      const [n, d] = fracTxt.split('/').map(Number);
      p = d ? n / d : NaN;
    } else {
      p = parseFloat(fracTxt);
    }
    return { label, fracTxt, p: isFinite(p) ? p : 0 };
  });
}

function renderProbTreeSVG(cfg) {
  const L1raw = parseProbBranches(cfg.level1);
  const L2raw = parseProbBranches(cfg.level2);
  const L3raw = cfg.level3 ? parseProbBranches(cfg.level3) : null;
  const L1 = L1raw.length ? L1raw : [{ label: 'A', fracTxt: '1/2', p: 0.5 }, { label: 'B', fracTxt: '1/2', p: 0.5 }];
  const L2 = L2raw.length ? L2raw : L1;

  const depth = L3raw ? 3 : 2;
  const stepX = 130, rootX = 20;
  const width = rootX + depth * stepX + 100;
  const rowH = 26;
  const leavesPerL1 = L2.length * (L3raw ? L3raw.length : 1);
  const height = Math.max(200, L1.length * leavesPerL1 * rowH + 30);

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  const rootY = height / 2;
  svg += `<circle cx="${rootX}" cy="${rootY.toFixed(1)}" r="2.5" fill="#000000"/>`;

  let cursor = 10;
  L1.forEach((b1) => {
    const rows = leavesPerL1;
    const y1 = cursor + (rows * rowH) / 2;
    cursor += rows * rowH;
    const x1 = rootX + stepX;
    svg += `<line x1="${rootX}" y1="${rootY.toFixed(1)}" x2="${x1}" y2="${y1.toFixed(1)}" stroke="#000000" stroke-width="1.4"/>`;
    svg += `<text x="${((rootX + x1) / 2).toFixed(1)}" y="${((rootY + y1) / 2 - 6).toFixed(1)}" font-size="10.5" text-anchor="middle" fill="#000000">${escText(b1.fracTxt)}</text>`;
    svg += `<circle cx="${x1}" cy="${y1.toFixed(1)}" r="2.5" fill="#000000"/>`;
    svg += `<text x="${(x1 + 6).toFixed(1)}" y="${(y1 - 6).toFixed(1)}" font-size="11" fill="#000000">${escText(b1.label)}</text>`;

    let subCursor = y1 - (leavesPerL1 * rowH) / 2;
    L2.forEach((b2) => {
      const rows2 = L3raw ? L3raw.length : 1;
      const y2 = subCursor + (rows2 * rowH) / 2;
      subCursor += rows2 * rowH;
      const x2 = x1 + stepX;
      svg += `<line x1="${x1}" y1="${y1.toFixed(1)}" x2="${x2}" y2="${y2.toFixed(1)}" stroke="#000000" stroke-width="1.4"/>`;
      svg += `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${((y1 + y2) / 2 - 6).toFixed(1)}" font-size="10.5" text-anchor="middle" fill="#000000">${escText(b2.fracTxt)}</text>`;

      if (L3raw) {
        svg += `<circle cx="${x2}" cy="${y2.toFixed(1)}" r="2.5" fill="#000000"/>`;
        svg += `<text x="${(x2 + 6).toFixed(1)}" y="${(y2 - 6).toFixed(1)}" font-size="11" fill="#000000">${escText(b2.label)}</text>`;
        let subCursor3 = y2 - (L3raw.length * rowH) / 2;
        L3raw.forEach((b3) => {
          const y3 = subCursor3 + rowH / 2;
          subCursor3 += rowH;
          const x3 = x2 + stepX;
          svg += `<line x1="${x2}" y1="${y2.toFixed(1)}" x2="${x3}" y2="${y3.toFixed(1)}" stroke="#000000" stroke-width="1.4"/>`;
          svg += `<text x="${((x2 + x3) / 2).toFixed(1)}" y="${((y2 + y3) / 2 - 6).toFixed(1)}" font-size="10.5" text-anchor="middle" fill="#000000">${escText(b3.fracTxt)}</text>`;
          svg += `<text x="${(x3 + 5).toFixed(1)}" y="${(y3 + 4).toFixed(1)}" font-size="11" fill="#000000">${escText(b3.label)}</text>`;
          const totalP = b1.p * b2.p * b3.p;
          svg += `<text x="${(x3 + 55).toFixed(1)}" y="${(y3 + 4).toFixed(1)}" font-size="10" fill="#475569">P=${Math.round(totalP * 1000) / 1000}</text>`;
        });
      } else {
        svg += `<text x="${(x2 + 5).toFixed(1)}" y="${(y2 + 4).toFixed(1)}" font-size="11" fill="#000000">${escText(b2.label)}</text>`;
        const totalP = b1.p * b2.p;
        svg += `<text x="${(x2 + 55).toFixed(1)}" y="${(y2 + 4).toFixed(1)}" font-size="10" fill="#475569">P=${Math.round(totalP * 1000) / 1000}</text>`;
      }
    });
  });

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 11. Diagram Vektor & Bearing (arah mata angin)
// ---------------------------------------------------------------------

// "OA:4,2|OB:-2,3" -> [{name:'OA', dx:4, dy:2}, ...]
function parseVectorList(raw) {
  return String(raw || '').split('|').map((s) => s.trim()).filter(Boolean).map((tok) => {
    const [name, comp] = tok.split(':');
    const [dx, dy] = String(comp || '0,0').split(',').map(Number);
    return { name: (name || 'v').trim(), dx: dx || 0, dy: dy || 0 };
  });
}

function renderVectorSVG(cfg) {
  const vecs = parseVectorList(cfg.v);
  const list = vecs.length ? vecs : [{ name: 'a', dx: 4, dy: 2 }, { name: 'b', dx: -2, dy: 3 }];
  const showResultant = cfg.resultan !== 'tidak';

  const points = [{ x: 0, y: 0 }];
  let cx = 0, cy = 0;
  const segs = [];
  list.forEach((v) => {
    segs.push({ x1: cx, y1: cy, x2: cx + v.dx, y2: cy + v.dy, name: v.name });
    cx += v.dx; cy += v.dy;
    points.push({ x: cx, y: cy });
  });
  if (showResultant) segs.push({ x1: 0, y1: 0, x2: cx, y2: cy, name: 'R', resultant: true });

  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const xmin = Math.min(0, ...xs) - 1, xmax = Math.max(0, ...xs) + 1;
  const ymin = Math.min(0, ...ys) - 1, ymax = Math.max(0, ...ys) + 1;
  const width = 340, height = 300, pad = 32;
  const sx = (width - 2 * pad) / ((xmax - xmin) || 1), sy = (height - 2 * pad) / ((ymax - ymin) || 1);
  const toPx = (x, y) => [pad + (x - xmin) * sx, height - pad - (y - ymin) * sy];

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  const xStep = niceStep(xmax - xmin), yStep = niceStep(ymax - ymin);
  for (let gx = Math.ceil(xmin / xStep) * xStep; gx <= xmax; gx += xStep) { const [px] = toPx(gx, 0); svg += `<line x1="${px.toFixed(1)}" y1="${pad}" x2="${px.toFixed(1)}" y2="${height - pad}" stroke="#eef0f3" stroke-width="1"/>`; }
  for (let gy = Math.ceil(ymin / yStep) * yStep; gy <= ymax; gy += yStep) { const [, py] = toPx(0, gy); svg += `<line x1="${pad}" y1="${py.toFixed(1)}" x2="${width - pad}" y2="${py.toFixed(1)}" stroke="#eef0f3" stroke-width="1"/>`; }
  const [ox, oy] = toPx(0, 0);
  svg += `<line x1="${pad}" y1="${oy.toFixed(1)}" x2="${width - pad}" y2="${oy.toFixed(1)}" stroke="#94a3b8" stroke-width="1.2"/>`;
  svg += `<line x1="${ox.toFixed(1)}" y1="${pad}" x2="${ox.toFixed(1)}" y2="${height - pad}" stroke="#94a3b8" stroke-width="1.2"/>`;

  segs.forEach((s) => {
    const [px1, py1] = toPx(s.x1, s.y1), [px2, py2] = toPx(s.x2, s.y2);
    svg += arrowSVG(px1, py1, px2, py2, { color: s.resultant ? '#b91c1c' : '#000000', dash: s.resultant ? '5,4' : null, strokeWidth: 2 });
    const mx = (px1 + px2) / 2, my = (py1 + py2) / 2;
    svg += `<text x="${(mx + 6).toFixed(1)}" y="${(my - 6).toFixed(1)}" font-size="11" font-weight="700" fill="${s.resultant ? '#b91c1c' : '#000000'}">${escText(s.name)}</text>`;
  });

  svg += '</svg>';
  return svg;
}

function renderBearingSVG(cfg) {
  const legs = String(cfg.jalur || '').split('|').map((s) => s.trim()).filter(Boolean).map((tok) => {
    const bits = tok.split(':');
    return { label: (bits[0] || '').trim(), sudut: numOrDefault(bits[1], 0), jarak: numOrDefault(bits[2], 5) };
  });
  const list = legs.length ? legs : [{ label: 'B', sudut: 65, jarak: 8 }];

  let x = 0, y = 0;
  const pts = [{ x, y, label: cfg.titikAwal || 'A' }];
  list.forEach((leg) => {
    const rad = (leg.sudut * Math.PI) / 180;
    x += Math.sin(rad) * leg.jarak;
    y += Math.cos(rad) * leg.jarak;
    pts.push({ x, y, label: leg.label });
  });

  const width = 340, height = 320;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const xmin = Math.min(...xs) - 3, xmax = Math.max(...xs) + 3;
  const ymin = Math.min(...ys) - 3, ymax = Math.max(...ys) + 3;
  const pad = 44;
  const scale = Math.min((width - 2 * pad) / ((xmax - xmin) || 1), (height - 2 * pad) / ((ymax - ymin) || 1));
  const midX = (xmin + xmax) / 2, midY = (ymin + ymax) / 2;
  const toPx = (px, py) => [width / 2 + (px - midX) * scale, height / 2 - (py - midY) * scale];

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  pts.slice(0, -1).forEach((p) => {
    const [ppx, ppy] = toPx(p.x, p.y);
    svg += `<line x1="${ppx.toFixed(1)}" y1="${ppy.toFixed(1)}" x2="${ppx.toFixed(1)}" y2="${(ppy - 34).toFixed(1)}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="3,3"/>`;
    svg += `<text x="${ppx.toFixed(1)}" y="${(ppy - 38).toFixed(1)}" font-size="10" text-anchor="middle" fill="#64748b">U</text>`;
  });
  for (let i = 0; i < list.length; i++) {
    const [px1, py1] = toPx(pts[i].x, pts[i].y);
    const [px2, py2] = toPx(pts[i + 1].x, pts[i + 1].y);
    svg += arrowSVG(px1, py1, px2, py2, { strokeWidth: 2 });
    const rad = (list[i].sudut * Math.PI) / 180;
    const large = list[i].sudut > 180 ? 1 : 0;
    svg += `<path d="M${px1.toFixed(1)},${(py1 - 22).toFixed(1)} A22,22 0 ${large} 1 ${(px1 + 22 * Math.sin(rad)).toFixed(1)},${(py1 - 22 * Math.cos(rad)).toFixed(1)}" fill="none" stroke="#b91c1c" stroke-width="1"/>`;
    const labelSide = list[i].sudut > 90 && list[i].sudut < 270 ? -16 : 16;
    svg += `<text x="${(px1 + labelSide).toFixed(1)}" y="${(py1 - 12).toFixed(1)}" font-size="9.5" fill="#b91c1c">${String(Math.round(list[i].sudut)).padStart(3, '0')}°</text>`;
    const mx = (px1 + px2) / 2, my = (py1 + py2) / 2;
    svg += `<text x="${(mx + 6).toFixed(1)}" y="${(my - 4).toFixed(1)}" font-size="10" fill="#000000">${list[i].jarak} km</text>`;
  }
  pts.forEach((p) => {
    const [ppx, ppy] = toPx(p.x, p.y);
    svg += `<circle cx="${ppx.toFixed(1)}" cy="${ppy.toFixed(1)}" r="2.5" fill="#000000"/>`;
    svg += `<text x="${(ppx + 6).toFixed(1)}" y="${(ppy + 14).toFixed(1)}" font-size="11" font-weight="700" fill="#000000">${escText(p.label)}</text>`;
  });

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 12. Ogive (kurva frekuensi kumulatif) & Boxplot
// ---------------------------------------------------------------------

function computeOgivePoints(cfg) {
  if (cfg.data) {
    const nums = String(cfg.data).split(',').map((s) => parseFloat(s.trim())).filter(isFinite).sort((a, b) => a - b);
    const pts = [{ x: nums[0], y: 0 }];
    nums.forEach((v, i) => pts.push({ x: v, y: i + 1 }));
    return { pts, n: nums.length };
  }
  const batas = String(cfg.batas || '').split(',').map(Number);
  const kumulatif = String(cfg.kumulatif || '').split(',').map(Number);
  const firstStep = (batas[1] - batas[0]) || 10;
  const pts = [{ x: (batas[0] !== undefined ? batas[0] - firstStep : 0), y: 0 }];
  batas.forEach((b, i) => pts.push({ x: b, y: kumulatif[i] || 0 }));
  return { pts, n: kumulatif[kumulatif.length - 1] || 0 };
}

function renderOgiveSVG(cfg) {
  const { pts, n } = computeOgivePoints(cfg);
  const width = 380, height = 300, pad = 42;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = 0, ymax = Math.max(...ys, 1);
  const sx = (width - 2 * pad) / ((xmax - xmin) || 1), sy = (height - 2 * pad) / ((ymax - ymin) || 1);
  const toPx = (x, y) => [pad + (x - xmin) * sx, height - pad - (y - ymin) * sy];

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  svg += `<line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#94a3b8" stroke-width="1.2"/>`;
  svg += `<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#94a3b8" stroke-width="1.2"/>`;

  let d = '';
  pts.forEach((p, i) => { const [px, py] = toPx(p.x, p.y); d += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ' ' + py.toFixed(1) + ' '; });
  svg += `<path d="${d}" fill="none" stroke="#000000" stroke-width="2"/>`;
  pts.forEach((p) => { const [px, py] = toPx(p.x, p.y); svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.5" fill="#000000"/>`; });

  function interpX(targetY) {
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].y >= targetY) {
        const p0 = pts[i - 1], p1 = pts[i];
        if (p1.y === p0.y) return p1.x;
        const t = (targetY - p0.y) / (p1.y - p0.y);
        return p0.x + t * (p1.x - p0.x);
      }
    }
    return pts[pts.length - 1].x;
  }
  ['Q1', 'Q2', 'Q3'].forEach((label, i) => {
    const targetY = (n * (i + 1)) / 4;
    const qx = interpX(targetY);
    const [px, py] = toPx(qx, targetY);
    svg += `<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${px.toFixed(1)}" y2="${height - pad}" stroke="#b91c1c" stroke-width="1" stroke-dasharray="3,3"/>`;
    svg += `<line x1="${pad}" y1="${py.toFixed(1)}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#b91c1c" stroke-width="1" stroke-dasharray="3,3"/>`;
    svg += `<text x="${px.toFixed(1)}" y="${(height - pad + 14).toFixed(1)}" font-size="9.5" text-anchor="middle" fill="#b91c1c">${label}=${formatTick(qx)}</text>`;
  });

  svg += `<text x="${(pad - 6).toFixed(1)}" y="${(pad + 4).toFixed(1)}" font-size="9.5" text-anchor="end" fill="#64748b">${n}</text>`;
  svg += `<text x="${(pad - 6).toFixed(1)}" y="${(height - pad + 4).toFixed(1)}" font-size="9.5" text-anchor="end" fill="#64748b">0</text>`;

  svg += '</svg>';
  return svg;
}

function computeFiveNumberSummary(cfg) {
  if (cfg.data) {
    const nums = String(cfg.data).split(',').map((s) => parseFloat(s.trim())).filter(isFinite).sort((a, b) => a - b);
    const q = (p) => { const idx = (nums.length - 1) * p; const lo = Math.floor(idx), hi = Math.ceil(idx); return nums[lo] + (nums[hi] - nums[lo]) * (idx - lo); };
    return { min: nums[0], q1: q(0.25), median: q(0.5), q3: q(0.75), max: nums[nums.length - 1] };
  }
  return {
    min: numOrDefault(cfg.min, 5), q1: numOrDefault(cfg.q1, 12), median: numOrDefault(cfg.median, 18),
    q3: numOrDefault(cfg.q3, 25), max: numOrDefault(cfg.max, 35),
  };
}

function renderBoxplotSVG(cfg) {
  const s = computeFiveNumberSummary(cfg);
  const width = 380, height = 140, pad = 40;
  const vmin = numOrDefault(cfg.xmin, s.min - (s.max - s.min) * 0.1);
  const vmax = numOrDefault(cfg.xmax, s.max + (s.max - s.min) * 0.1);
  const sx = (width - 2 * pad) / ((vmax - vmin) || 1);
  const toX = (v) => pad + (v - vmin) * sx;
  const midY = 70, boxH = 34;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  svg += `<line x1="${pad}" y1="${height - 24}" x2="${width - pad}" y2="${height - 24}" stroke="#94a3b8" stroke-width="1.2"/>`;
  [s.min, s.max].forEach((v) => { svg += `<text x="${toX(v).toFixed(1)}" y="${height - 8}" font-size="9.5" text-anchor="middle" fill="#64748b">${formatTick(v)}</text>`; });

  svg += `<line x1="${toX(s.min).toFixed(1)}" y1="${midY.toFixed(1)}" x2="${toX(s.q1).toFixed(1)}" y2="${midY.toFixed(1)}" stroke="#000000" stroke-width="1.6"/>`;
  svg += `<line x1="${toX(s.q3).toFixed(1)}" y1="${midY.toFixed(1)}" x2="${toX(s.max).toFixed(1)}" y2="${midY.toFixed(1)}" stroke="#000000" stroke-width="1.6"/>`;
  [s.min, s.max].forEach((v) => { svg += `<line x1="${toX(v).toFixed(1)}" y1="${(midY - boxH / 4).toFixed(1)}" x2="${toX(v).toFixed(1)}" y2="${(midY + boxH / 4).toFixed(1)}" stroke="#000000" stroke-width="1.6"/>`; });
  svg += `<rect x="${toX(s.q1).toFixed(1)}" y="${(midY - boxH / 2).toFixed(1)}" width="${(toX(s.q3) - toX(s.q1)).toFixed(1)}" height="${boxH}" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>`;
  svg += `<line x1="${toX(s.median).toFixed(1)}" y1="${(midY - boxH / 2).toFixed(1)}" x2="${toX(s.median).toFixed(1)}" y2="${(midY + boxH / 2).toFixed(1)}" stroke="#000000" stroke-width="2.2"/>`;

  [['Min', s.min], ['Q1', s.q1], ['Median', s.median], ['Q3', s.q3], ['Max', s.max]].forEach(([label, v]) => {
    svg += `<text x="${toX(v).toFixed(1)}" y="${(midY - boxH / 2 - 8).toFixed(1)}" font-size="9" text-anchor="middle" fill="#000000">${label}</text>`;
  });

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 13. Diagram Sinar (ray diagram — lensa cembung/cekung)
// ---------------------------------------------------------------------

function renderRaySVG(cfg) {
  const alat = String(cfg.alat || 'cembung').toLowerCase();
  const isConverging = alat === 'cembung' || alat === 'converging';
  const f = Math.max(0.5, numOrDefault(cfg.f, 3));
  const doV = Math.max(0.5, numOrDefault(cfg.objek_jarak, 6));
  const hoV = numOrDefault(cfg.objek_tinggi, 2);
  const fSigned = isConverging ? f : -f;
  const di = 1 / (1 / fSigned - 1 / doV);
  const m = -di / doV;
  const hi = m * hoV;

  const scale = 22;
  const width = 380, height = 260, axisY = height / 2, lensX = width / 2;
  const toPx = (x, y) => [lensX + x * scale, axisY - y * scale];

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  svg += `<line x1="10" y1="${axisY}" x2="${width - 10}" y2="${axisY}" stroke="#94a3b8" stroke-width="1"/>`;

  const lensH = 80;
  svg += `<line x1="${lensX}" y1="${(axisY - lensH / 2).toFixed(1)}" x2="${lensX}" y2="${(axisY + lensH / 2).toFixed(1)}" stroke="#000000" stroke-width="2"/>`;
  if (isConverging) {
    svg += `<polygon points="${lensX - 6},${(axisY - lensH / 2 + 8).toFixed(1)} ${lensX + 6},${(axisY - lensH / 2 + 8).toFixed(1)} ${lensX},${(axisY - lensH / 2).toFixed(1)}" fill="#000000"/>`;
    svg += `<polygon points="${lensX - 6},${(axisY + lensH / 2 - 8).toFixed(1)} ${lensX + 6},${(axisY + lensH / 2 - 8).toFixed(1)} ${lensX},${(axisY + lensH / 2).toFixed(1)}" fill="#000000"/>`;
  } else {
    svg += `<polygon points="${lensX - 6},${(axisY - lensH / 2).toFixed(1)} ${lensX + 6},${(axisY - lensH / 2).toFixed(1)} ${lensX},${(axisY - lensH / 2 + 8).toFixed(1)}" fill="#000000"/>`;
    svg += `<polygon points="${lensX - 6},${(axisY + lensH / 2).toFixed(1)} ${lensX + 6},${(axisY + lensH / 2).toFixed(1)} ${lensX},${(axisY + lensH / 2 - 8).toFixed(1)}" fill="#000000"/>`;
  }
  [-f, f].forEach((fx) => {
    const [px, py] = toPx(fx, 0);
    svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2" fill="#000000"/>`;
    svg += `<text x="${px.toFixed(1)}" y="${(py + 14).toFixed(1)}" font-size="9.5" text-anchor="middle" fill="#000000">F</text>`;
  });

  const [oxBase, oyBase] = toPx(-doV, 0);
  const [oxTip, oyTip] = toPx(-doV, hoV);
  svg += arrowSVG(oxBase, oyBase, oxTip, oyTip, { color: '#1d4ed8', strokeWidth: 2 });

  if (isFinite(di)) {
    const [ixBase, iyBase] = toPx(di, 0);
    const [ixTip, iyTip] = toPx(di, hi);
    svg += arrowSVG(ixBase, iyBase, ixTip, iyTip, { color: '#b91c1c', strokeWidth: 2, dash: di < 0 ? '5,4' : null });
    // ray through the lens centre (undeviated) and the ray parallel to the
    // axis that refracts through the far focal point — the two principal
    // rays needed to locate the image geometrically.
    svg += `<line x1="${oxTip.toFixed(1)}" y1="${oyTip.toFixed(1)}" x2="${ixTip.toFixed(1)}" y2="${iyTip.toFixed(1)}" stroke="#16a34a" stroke-width="1" stroke-dasharray="2,2"/>`;
    svg += `<line x1="${oxTip.toFixed(1)}" y1="${oyTip.toFixed(1)}" x2="${lensX.toFixed(1)}" y2="${oyTip.toFixed(1)}" stroke="#16a34a" stroke-width="1" stroke-dasharray="2,2"/>`;
    svg += `<line x1="${lensX.toFixed(1)}" y1="${oyTip.toFixed(1)}" x2="${ixTip.toFixed(1)}" y2="${iyTip.toFixed(1)}" stroke="#16a34a" stroke-width="1" stroke-dasharray="2,2"/>`;
  }

  svg += `<text x="10" y="${height - 8}" font-size="10" fill="#000000">f=${f}, s_o=${doV}, s_i=${isFinite(di) ? Math.round(di * 100) / 100 : '-'}, M=${isFinite(m) ? Math.round(m * 100) / 100 : '-'}</text>`;

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 14. Grafik Gerak (kinematika: jarak-waktu / kecepatan-waktu)
// ---------------------------------------------------------------------

function parsePiecewisePoints(raw) {
  return String(raw || '').split(',').map((s) => s.trim()).filter(Boolean).map((tok) => {
    const [x, y] = tok.split(':').map(Number);
    return { x, y };
  });
}

function renderKinematicsSVG(cfg) {
  const tipe = String(cfg.tipe || 'kecepatan-waktu').toLowerCase();
  const parsed = parsePiecewisePoints(cfg.titik);
  const list = parsed.length ? parsed : [{ x: 0, y: 0 }, { x: 2, y: 10 }, { x: 5, y: 10 }, { x: 8, y: 0 }];
  const width = 380, height = 280, pad = 42;
  const xs = list.map((p) => p.x), ys = list.map((p) => p.y);
  const xmin = 0, xmax = Math.max(...xs);
  const ymin = Math.min(0, ...ys), ymax = Math.max(...ys);
  const sx = (width - 2 * pad) / ((xmax - xmin) || 1), sy = (height - 2 * pad) / ((ymax - ymin) || 1);
  const toPx = (x, y) => [pad + (x - xmin) * sx, height - pad - (y - ymin) * sy];

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  svg += `<line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#94a3b8" stroke-width="1.2"/>`;
  svg += `<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#94a3b8" stroke-width="1.2"/>`;

  const yLabel = cfg.sumbuy || (tipe.startsWith('jarak') ? 'jarak (m)' : tipe.startsWith('percepat') ? 'percepatan (m/s²)' : 'kecepatan (m/s)');
  svg += `<text x="${pad}" y="16" font-size="10" fill="#475569">${escText(yLabel)}</text>`;
  svg += `<text x="${width - pad}" y="${height - pad + 30}" font-size="10" text-anchor="end" fill="#475569">${escText(cfg.sumbux || 'waktu (s)')}</text>`;

  // Every vertex gets its value on BOTH axes, joined to the axes by dashed
  // guide lines — a v-t graph is read by taking values off the y-axis
  // (the gradient alone tells nothing about the actual speed), so a student
  // must be able to see "10" on the axis, not just "m=5" on the segment.
  // Labels closer than a text height to one already drawn are skipped so
  // neighbouring values never print on top of each other.
  const yDrawn = [];
  const uniqY = [...new Set(list.map((p) => p.y))].sort((a, b) => b - a);
  uniqY.forEach((y) => {
    const [, py] = toPx(0, y);
    if (yDrawn.some((q) => Math.abs(q - py) < 10)) return;
    yDrawn.push(py);
    svg += `<line x1="${pad - 4}" y1="${py.toFixed(1)}" x2="${pad}" y2="${py.toFixed(1)}" stroke="#94a3b8" stroke-width="1.2"/>`;
    svg += `<text x="${pad - 6}" y="${(py + 3).toFixed(1)}" font-size="9" text-anchor="end" fill="#64748b">${formatTick(y)}</text>`;
  });
  if (cfg.bantu !== 'tidak') {
    const [, y0px] = toPx(0, 0);
    list.forEach((p) => {
      if (p.y === 0 && ymin === 0) return;
      const [px, py] = toPx(p.x, p.y);
      svg += `<line x1="${pad}" y1="${py.toFixed(1)}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="3,3"/>`;
      svg += `<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${px.toFixed(1)}" y2="${y0px.toFixed(1)}" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="3,3"/>`;
    });
  }

  if (cfg.arsir !== 'tidak') {
    const [zx0] = toPx(list[0].x, 0);
    let d = `M${zx0.toFixed(1)},${toPx(list[0].x, 0)[1].toFixed(1)} `;
    list.forEach((p) => { const [px, py] = toPx(p.x, p.y); d += `L${px.toFixed(1)},${py.toFixed(1)} `; });
    const last = list[list.length - 1];
    const [lx] = toPx(last.x, 0);
    d += `L${lx.toFixed(1)},${toPx(last.x, 0)[1].toFixed(1)} Z`;
    svg += `<path d="${d}" fill="#cbd5e1" fill-opacity="0.5" stroke="none"/>`;
  }

  let d = '';
  list.forEach((p, i) => { const [px, py] = toPx(p.x, p.y); d += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ' ' + py.toFixed(1) + ' '; });
  svg += `<path d="${d}" fill="none" stroke="#000000" stroke-width="2.2"/>`;
  list.forEach((p) => {
    const [px, py] = toPx(p.x, p.y);
    svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.6" fill="#000000"/>`;
    svg += `<text x="${px.toFixed(1)}" y="${(height - pad + 13).toFixed(1)}" font-size="9" text-anchor="middle" fill="#64748b">${formatTick(p.x)}</text>`;
  });

  if (cfg.gradien !== 'tidak') {
    for (let i = 1; i < list.length; i++) {
      const p0 = list[i - 1], p1 = list[i];
      if (p1.x === p0.x) continue;
      const grad = (p1.y - p0.y) / (p1.x - p0.x);
      const [px, py] = toPx((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
      // Push the label off the segment along its normal (upward side), so
      // it sits beside a steep line instead of being crossed out by it.
      const [ax, ay] = toPx(p0.x, p0.y), [bx, by] = toPx(p1.x, p1.y);
      const len = Math.hypot(bx - ax, by - ay) || 1;
      let nx = -(by - ay) / len, ny = (bx - ax) / len;
      if (ny > 0) { nx = -nx; ny = -ny; }
      // Anchor the text on the side facing the line, so a wide label on a
      // steep segment grows away from it rather than back across it.
      const anchor = nx > 0.3 ? 'start' : nx < -0.3 ? 'end' : 'middle';
      svg += `<text x="${(px + nx * 8).toFixed(1)}" y="${(py + ny * 8 + 3).toFixed(1)}" font-size="9.5" text-anchor="${anchor}" fill="#b91c1c">m=${Math.round(grad * 100) / 100}</text>`;
    }
  }

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 15. Diagram Gelombang (transversal / longitudinal)
// ---------------------------------------------------------------------

function renderWaveSVG(cfg) {
  const jenis = String(cfg.jenis || 'transversal').toLowerCase();
  const amp = numOrDefault(cfg.amplitudo, 20);
  const wavelength = Math.max(10, numOrDefault(cfg.panjanggelombang, 60));
  const jumlah = Math.max(1, Math.round(numOrDefault(cfg.jumlah, 2)));
  const width = Math.max(300, wavelength * jumlah + 80);
  const height = 160, midY = height / 2, startX = 40;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  svg += `<line x1="${startX - 10}" y1="${midY}" x2="${startX + wavelength * jumlah + 10}" y2="${midY}" stroke="#94a3b8" stroke-width="1"/>`;

  if (jenis === 'transversal') {
    let d = '';
    const steps = 200 * jumlah;
    for (let s = 0; s <= steps; s++) {
      const x = startX + (wavelength * jumlah * s) / steps;
      const y = midY - amp * Math.sin((2 * Math.PI * (x - startX)) / wavelength);
      d += (s === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    svg += `<path d="${d}" fill="none" stroke="#000000" stroke-width="2"/>`;
    const ax = startX + wavelength * 0.25;
    svg += `<line x1="${ax}" y1="${midY}" x2="${ax}" y2="${(midY - amp).toFixed(1)}" stroke="#b91c1c" stroke-width="1" stroke-dasharray="3,3"/>`;
    svg += `<text x="${ax + 4}" y="${(midY - amp / 2).toFixed(1)}" font-size="9.5" fill="#b91c1c">A</text>`;
    const wy = midY + amp + 20;
    svg += `<line x1="${startX}" y1="${wy}" x2="${startX + wavelength}" y2="${wy}" stroke="#1d4ed8" stroke-width="1"/>`;
    svg += `<line x1="${startX}" y1="${wy - 4}" x2="${startX}" y2="${wy + 4}" stroke="#1d4ed8" stroke-width="1"/>`;
    svg += `<line x1="${startX + wavelength}" y1="${wy - 4}" x2="${startX + wavelength}" y2="${wy + 4}" stroke="#1d4ed8" stroke-width="1"/>`;
    svg += `<text x="${startX + wavelength / 2}" y="${wy + 14}" font-size="9.5" text-anchor="middle" fill="#1d4ed8">λ</text>`;
  } else {
    // Longitudinal: evenly spaced marker lines get a sinusoidal x-offset,
    // which naturally bunches them into compressions and spreads them into
    // rarefactions — the standard way this is drawn without animation.
    const n = 40 * jumlah;
    const spacing = (wavelength * jumlah) / n;
    for (let i = 0; i <= n; i++) {
      const baseX = startX + i * spacing;
      const x = baseX + amp * 0.4 * Math.sin((2 * Math.PI * (baseX - startX)) / wavelength);
      svg += `<line x1="${x.toFixed(1)}" y1="${midY - 28}" x2="${x.toFixed(1)}" y2="${midY + 28}" stroke="#000000" stroke-width="1.3"/>`;
    }
    svg += `<text x="${startX}" y="${midY + 48}" font-size="9.5" fill="#64748b">rapatan</text>`;
    svg += `<text x="${(startX + wavelength / 2).toFixed(1)}" y="${midY + 48}" font-size="9.5" fill="#64748b">renggangan</text>`;
  }

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 16. Medan Listrik / Medan Magnet
// ---------------------------------------------------------------------

function renderFieldSVG(cfg) {
  const jenis = String(cfg.jenis || 'positif').toLowerCase();
  const width = 300, height = 300, cx = width / 2, cy = height / 2;
  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  if (jenis === 'positif' || jenis === 'negatif') {
    const outward = jenis === 'positif';
    const n = 8, r0 = 18, r1 = 120;
    for (let i = 0; i < n; i++) {
      const ang = (2 * Math.PI * i) / n;
      const x0 = cx + r0 * Math.cos(ang), y0 = cy + r0 * Math.sin(ang);
      const x1 = cx + r1 * Math.cos(ang), y1 = cy + r1 * Math.sin(ang);
      svg += outward ? arrowSVG(x0, y0, x1, y1, { strokeWidth: 1.4 }) : arrowSVG(x1, y1, x0, y0, { strokeWidth: 1.4 });
    }
    svg += `<circle cx="${cx}" cy="${cy}" r="${r0}" fill="${outward ? '#fee2e2' : '#dbeafe'}" stroke="#000000" stroke-width="1.6"/>`;
    svg += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="16" font-weight="700" fill="#000000">${outward ? '+' : '-'}</text>`;
  } else if (jenis === 'kawat') {
    const arah = String(cfg.arus || 'keluar').toLowerCase();
    svg += `<circle cx="${cx}" cy="${cy}" r="8" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>`;
    if (arah === 'keluar') svg += `<circle cx="${cx}" cy="${cy}" r="2.4" fill="#000000"/>`;
    else svg += `<line x1="${cx - 5}" y1="${cy - 5}" x2="${cx + 5}" y2="${cy + 5}" stroke="#000000" stroke-width="1.6"/><line x1="${cx - 5}" y1="${cy + 5}" x2="${cx + 5}" y2="${cy - 5}" stroke="#000000" stroke-width="1.6"/>`;
    [40, 70, 100, 130].forEach((r, i) => {
      svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#000000" stroke-width="1.2"/>`;
      const ang = -Math.PI / 2 + (i % 2 ? 0.3 : 0);
      const tangentAng = ang + (arah === 'keluar' ? Math.PI / 2 : -Math.PI / 2);
      const tx = cx + r * Math.cos(ang), ty = cy + r * Math.sin(ang);
      const tx2 = tx + 14 * Math.cos(tangentAng), ty2 = ty + 14 * Math.sin(tangentAng);
      svg += arrowSVG(tx, ty, tx2, ty2, { strokeWidth: 1.3, headLen: 6 });
    });
  } else if (jenis === 'solenoida') {
    const coilW = 180, coilH = 90, turns = 6, x0 = cx - coilW / 2;
    for (let i = 0; i <= turns; i++) {
      const x = x0 + i * (coilW / turns);
      svg += `<ellipse cx="${x.toFixed(1)}" cy="${cy}" rx="8" ry="${coilH / 2}" fill="none" stroke="#000000" stroke-width="1.6"/>`;
    }
    for (let k = -2; k <= 2; k++) {
      const y = cy + k * 14;
      svg += arrowSVG(x0 - 4, y, x0 + coilW + 4, y, { strokeWidth: 1.2, headLen: 6 });
    }
    svg += `<text x="${cx}" y="${cy + coilH / 2 + 24}" text-anchor="middle" font-size="10" fill="#000000">solenoida</text>`;
  }

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 17. Diagram Kulit Elektron (model Bohr — kimia)
// ---------------------------------------------------------------------

function computeShellFilling(z) {
  const capacities = [2, 8, 8, 18, 32];
  let remaining = z;
  const shells = [];
  for (let i = 0; i < capacities.length && remaining > 0; i++) {
    const take = Math.min(remaining, capacities[i]);
    shells.push(take);
    remaining -= take;
  }
  return shells;
}

function renderElectronShellSVG(cfg) {
  const z = Math.max(1, Math.round(numOrDefault(cfg.nomor, 11)));
  const unsur = cfg.unsur || '';
  const shells = cfg.kulit ? String(cfg.kulit).split(',').map(Number) : computeShellFilling(z);

  const width = 300, height = 300, cx = width / 2, cy = width / 2 - 6;
  const r0 = 16, step = 32;
  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="12" fill="#fef3c7" stroke="#000000" stroke-width="1.6"/>`;
  svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#000000">${escText(unsur || '+' + z)}</text>`;

  shells.forEach((count, i) => {
    const r = r0 + (i + 1) * step;
    if (r > Math.min(width, height) / 2 - 14) return;
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#94a3b8" stroke-width="1.2"/>`;
    for (let e = 0; e < count; e++) {
      const ang = (2 * Math.PI * e) / count - Math.PI / 2;
      const ex = cx + r * Math.cos(ang), ey = cy + r * Math.sin(ang);
      svg += `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="3.2" fill="#000000"/>`;
    }
  });

  svg += `<text x="${cx}" y="${height - 16}" text-anchor="middle" font-size="11" fill="#000000">${escText(unsur)}${unsur ? ' ' : ''}(Z=${z}): ${shells.join(', ')}</text>`;

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 18. Kurva Titrasi (pH vs volume titran — kimia)
// ---------------------------------------------------------------------

function renderTitrationSVG(cfg) {
  const jenis = String(cfg.jenis || 'kuat-kuat').toLowerCase();
  const vAwal = numOrDefault(cfg.volume_awal, 25);
  const vEq = vAwal;
  const vMax = vEq * 2;
  const width = 380, height = 280, pad = 42;
  const toPx = (v, ph) => [pad + (v / vMax) * (width - 2 * pad), height - pad - (ph / 14) * (height - 2 * pad)];

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  svg += `<line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#94a3b8" stroke-width="1.2"/>`;
  svg += `<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#94a3b8" stroke-width="1.2"/>`;
  svg += `<text x="${pad}" y="16" font-size="10" fill="#475569">pH</text>`;
  svg += `<text x="${width - pad}" y="${height - pad + 30}" font-size="10" text-anchor="end" fill="#475569">Volume titran (mL)</text>`;

  let phStart, phEnd, steepness;
  if (jenis === 'lemah-kuat') { phStart = 3; phEnd = 12; steepness = 6; }
  else if (jenis === 'kuat-lemah') { phStart = 1; phEnd = 11; steepness = 6; }
  else if (jenis === 'lemah-lemah') { phStart = 3; phEnd = 10; steepness = 4; }
  else { phStart = 1; phEnd = 13; steepness = 8; } // kuat-kuat (default)

  let d = '';
  const steps = 100;
  for (let s = 0; s <= steps; s++) {
    const v = (vMax * s) / steps;
    const ph = phStart + (phEnd - phStart) / (1 + Math.exp((-steepness * 4 * (v - vEq)) / vMax));
    const [px, py] = toPx(v, ph);
    d += (s === 0 ? 'M' : 'L') + px.toFixed(1) + ' ' + py.toFixed(1) + ' ';
  }
  svg += `<path d="${d}" fill="none" stroke="#000000" stroke-width="2"/>`;

  const [eqx] = toPx(vEq, 0);
  svg += `<line x1="${eqx.toFixed(1)}" y1="${pad}" x2="${eqx.toFixed(1)}" y2="${(height - pad).toFixed(1)}" stroke="#b91c1c" stroke-width="1" stroke-dasharray="3,3"/>`;
  svg += `<text x="${(eqx + 4).toFixed(1)}" y="${pad + 12}" font-size="9.5" fill="#b91c1c">Titik ekuivalen</text>`;

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 19. Kurva Katalis (perbandingan Ea dengan/tanpa katalis — kimia)
// ---------------------------------------------------------------------

function renderCatalystSVG(cfg) {
  const eReaktan = numOrDefault(cfg.reaktan, 0);
  const eProduk = numOrDefault(cfg.produk, -40);
  const eaTanpa = numOrDefault(cfg.ea_tanpa, 80);
  const eaDengan = numOrDefault(cfg.ea_dengan, 40);
  const satuan = cfg.satuan || 'kJ/mol';

  const width = 380, height = 260, padTop = 24, padBottom = 44, padX = 50;
  const chartH = height - padTop - padBottom;
  const vmin = Math.min(eReaktan, eProduk);
  const vmax = Math.max(eReaktan + eaTanpa, eReaktan + eaDengan);
  const toY = (v) => padTop + chartH - ((v - vmin) / ((vmax - vmin) || 1)) * chartH;
  const x0 = padX, x1 = width - padX, xm = (x0 + x1) / 2;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  function hump(peakE, color, dash) {
    const yStart = toY(eReaktan), yPeak = toY(eReaktan + peakE), yEnd = toY(eProduk);
    svg += `<path d="M${x0},${yStart.toFixed(1)} Q${xm},${yPeak.toFixed(1)} ${x1},${yEnd.toFixed(1)}" fill="none" stroke="${color}" stroke-width="2"${dash ? ' stroke-dasharray="' + dash + '"' : ''}/>`;
    return yPeak;
  }
  const yPeakTanpa = hump(eaTanpa, '#b91c1c', '5,3');
  const yPeakDengan = hump(eaDengan, '#16a34a', null);

  svg += `<line x1="${x0 - 10}" y1="${toY(eReaktan).toFixed(1)}" x2="${x0 + 14}" y2="${toY(eReaktan).toFixed(1)}" stroke="#000000" stroke-width="2.2"/>`;
  svg += `<line x1="${x1 - 14}" y1="${toY(eProduk).toFixed(1)}" x2="${x1 + 10}" y2="${toY(eProduk).toFixed(1)}" stroke="#000000" stroke-width="2.2"/>`;
  svg += `<text x="${x0}" y="${(toY(eReaktan) + 16).toFixed(1)}" font-size="10.5" fill="#000000">Reaktan</text>`;
  svg += `<text x="${(x1 - 40).toFixed(1)}" y="${(toY(eProduk) + 16).toFixed(1)}" font-size="10.5" fill="#000000">Produk</text>`;
  svg += `<text x="${xm.toFixed(1)}" y="${(yPeakTanpa - 6).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="#b91c1c">Ea tanpa katalis = ${eaTanpa} ${escText(satuan)}</text>`;
  svg += `<text x="${xm.toFixed(1)}" y="${(yPeakDengan - 6).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="#16a34a">Ea dengan katalis = ${eaDengan} ${escText(satuan)}</text>`;

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 20. Struktur Kristal / Kisi (ionik & kovalen raksasa — kimia)
// ---------------------------------------------------------------------

function renderLatticeSVG(cfg) {
  const jenis = String(cfg.jenis || 'ionik').toLowerCase();
  const width = 320, height = 280;
  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  if (jenis === 'ionik') {
    const n = 4, cell = 48, x0 = 60, y0 = 50;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const x = x0 + col * cell, y = y0 + row * cell;
        const isPos = (row + col) % 2 === 0;
        svg += `<circle cx="${x}" cy="${y}" r="${isPos ? 9 : 13}" fill="${isPos ? '#dbeafe' : '#fee2e2'}" stroke="#000000" stroke-width="1.2"/>`;
      }
    }
    svg += `<text x="20" y="${height - 40}" font-size="10" fill="#000000">● ion positif</text>`;
    svg += `<text x="20" y="${height - 24}" font-size="10" fill="#000000">◯ ion negatif</text>`;
    svg += `<text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#000000">${escText(cfg.formula || 'Kisi Ionik')}</text>`;
  } else {
    const bentuk = String(cfg.bentuk || 'intan').toLowerCase();
    if (bentuk === 'grafit' || bentuk === 'graphite') {
      const rows = 3, cols = 5, x0 = 50, y0 = 60, dx = 34, dy = 30;
      for (let layer = 0; layer < 2; layer++) {
        const ly = y0 + layer * 90;
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const cxp = x0 + col * dx + (row % 2 ? dx / 2 : 0), cyp = ly + row * dy;
            svg += `<circle cx="${cxp.toFixed(1)}" cy="${cyp.toFixed(1)}" r="3" fill="#000000"/>`;
          }
        }
      }
      svg += `<text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#000000">Grafit (lapisan heksagonal)</text>`;
    } else {
      const cx = width / 2, cy = height / 2 - 10;
      const positions = [[0, -60], [52, -20], [-52, -20], [32, 55], [-32, 55]];
      positions.forEach(([dx, dy]) => {
        svg += `<line x1="${cx}" y1="${cy}" x2="${(cx + dx).toFixed(1)}" y2="${(cy + dy).toFixed(1)}" stroke="#000000" stroke-width="1.4"/>`;
        svg += `<circle cx="${(cx + dx).toFixed(1)}" cy="${(cy + dy).toFixed(1)}" r="6" fill="#e2e8f0" stroke="#000000" stroke-width="1.2"/>`;
      });
      svg += `<circle cx="${cx}" cy="${cy}" r="7" fill="#e2e8f0" stroke="#000000" stroke-width="1.4"/>`;
      svg += `<text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#000000">Intan (struktur tetrahedral)</text>`;
    }
  }

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 21. Piramida Ekologi (biologi)
// ---------------------------------------------------------------------

function renderEcoPyramidSVG(cfg) {
  const levels = parseEnergyLevelList(cfg.tingkat);
  const list = levels.length ? levels : [{ name: 'Produsen', value: 500 }, { name: 'Konsumen I', value: 50 }, { name: 'Konsumen II', value: 5 }, { name: 'Konsumen III', value: 1 }];
  const tipe = cfg.tipe || 'jumlah';

  const width = 340, rowH = 44, padTop = 20, padBottom = 26;
  const height = padTop + padBottom + list.length * rowH;
  const maxW = width - 60;
  const maxVal = Math.max(...list.map((l) => l.value || 1), 1);
  const logMax = Math.log10(maxVal + 1) || 1;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;

  list.forEach((lv, i) => {
    const w = Math.max(30, (Math.log10((lv.value || 0) + 1) / logMax) * maxW);
    const y = height - padBottom - (i + 1) * rowH;
    const x = (width - w) / 2;
    svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${rowH - 4}" fill="#ecfccb" stroke="#000000" stroke-width="1.4"/>`;
    svg += `<text x="${(width / 2).toFixed(1)}" y="${(y + rowH / 2).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="#000000">${escText(lv.name)} (${lv.value})</text>`;
  });

  svg += `<text x="${(width / 2).toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="9.5" fill="#64748b">Piramida ${escText(tipe)}</text>`;

  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 7. Tabel Data
// ---------------------------------------------------------------------

// Rows use "|" between rows and "," between cells (not SVG — plain HTML
// <table>, since a data/frequency table is text, not a coordinate drawing).
function renderTableHTML(cfg) {
  const headers = pisahKolom(String(cfg.header || ''));
  const rows = String(cfg.baris || '')
    .split('|')
    .map((r) => r.split(',').map((c) => c.trim()))
    .filter((r) => !(r.length === 1 && r[0] === ''));

  let html = '';
  if (cfg.judul) html += `<div class="ws-table-title">${escText(cfg.judul)}</div>`;
  html += '<table class="ws-table">';
  if (headers.length) {
    html += '<thead><tr>' + headers.map((h) => `<th>${escText(h)}</th>`).join('') + '</tr></thead>';
  }
  html += '<tbody>';
  rows.forEach((r) => {
    html += '<tr>' + r.map((c) => `<td>${escText(c)}</td>`).join('') + '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

// ---------------------------------------------------------------------
// 6y. Biologi lanjutan — Punnett, kunci determinasi, jaring makanan
// ---------------------------------------------------------------------

// Splits a genotype into its gene pairs: "AaBb" -> [['A','a'], ['B','b']].
// Alleles of one gene are always the same letter in different cases, which
// is what lets a plain string be read without any extra separator.
function splitGenotype(raw) {
  const letters = String(raw || '').replace(/[^A-Za-z]/g, '').split('');
  const genes = [];
  for (let i = 0; i < letters.length; i += 2) {
    if (letters[i + 1] == null) break;
    genes.push([letters[i], letters[i + 1]]);
  }
  return genes;
}

// Every gamete a parent can make: one allele from each gene, in all
// combinations (2^n for n genes).
function gametesOf(genes) {
  let out = [''];
  genes.forEach(([a, b]) => {
    const next = [];
    out.forEach((prefix) => {
      next.push(prefix + a);
      if (b !== a) next.push(prefix + b);
      else next.push(prefix + b);
    });
    out = next;
  });
  // Identical gametes still occupy their own row/column: a 2x2 grid for
  // "AA x Aa" is what makes the 1:1 ratio visible.
  return out;
}

// Offspring genotype, written the conventional way — dominant (capital)
// allele first within each gene pair.
function combineGametes(g1, g2) {
  let out = '';
  for (let i = 0; i < g1.length; i++) {
    const pair = [g1[i], g2[i]].sort((a, b) => {
      if (a.toLowerCase() !== b.toLowerCase()) return 0;
      return a === a.toUpperCase() ? -1 : 1;
    });
    out += pair.join('');
  }
  return out;
}

function phenotypeOf(genotype) {
  // "Dominant if at least one capital allele in the pair" — the phenotype
  // rule a school-level cross assumes.
  let out = '';
  for (let i = 0; i < genotype.length; i += 2) {
    const a = genotype[i], b = genotype[i + 1];
    const dom = a === a.toUpperCase() || b === b.toUpperCase();
    out += dom ? a.toUpperCase() + '_' : a.toLowerCase() + b.toLowerCase();
  }
  return out;
}

function ratioString(counts) {
  const keys = Object.keys(counts).sort();
  const values = keys.map((k) => counts[k]);
  // Reduce by the greatest common divisor so "4:8:4" reads as "1:2:1".
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const g = values.reduce((acc, v) => gcd(acc, v), 0) || 1;
  return keys.map((k, i) => k + ' ' + (values[i] / g)).join(' : ');
}

function renderPunnettSVG(cfg) {
  const genes1 = splitGenotype(cfg.induk1 || 'Aa');
  const genes2 = splitGenotype(cfg.induk2 || 'Aa');
  if (!genes1.length || !genes2.length) throw new Error('punnett perlu induk1= dan induk2= (mis. Aa)');
  if (genes1.length !== genes2.length) throw new Error('punnett: kedua induk harus punya jumlah gen yang sama');
  const cols = gametesOf(genes1);
  const rows = gametesOf(genes2);

  const cell = Math.max(34, Math.min(58, 220 / Math.max(cols.length, rows.length)));
  const head = cell;
  const pad = 14;
  const gridW = head + cols.length * cell;
  const gridH = head + rows.length * cell;
  const showRatio = String(cfg.rasio || 'ya').toLowerCase() !== 'tidak';
  const ratioH = showRatio ? 42 : 8;
  const W = Math.max(260, gridW + pad * 2);
  const H = gridH + pad * 2 + ratioH;
  const blank = String(cfg.jawaban || 'lengkap').toLowerCase() === 'kosong';

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  const ox = (W - gridW) / 2, oy = pad;

  const genoCounts = {}, phenoCounts = {};
  cols.forEach((cg, i) => {
    svg += `<text x="${(ox + head + i * cell + cell / 2).toFixed(1)}" y="${(oy + head / 2 + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#000000">${escText(cg)}</text>`;
  });
  rows.forEach((rg, j) => {
    svg += `<text x="${(ox + head / 2).toFixed(1)}" y="${(oy + head + j * cell + cell / 2 + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#000000">${escText(rg)}</text>`;
    cols.forEach((cg, i) => {
      const x = ox + head + i * cell, y = oy + head + j * cell;
      svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.3"/>`;
      const geno = combineGametes(cg, rg);
      genoCounts[geno] = (genoCounts[geno] || 0) + 1;
      const pheno = phenotypeOf(geno);
      phenoCounts[pheno] = (phenoCounts[pheno] || 0) + 1;
      if (!blank) {
        svg += `<text x="${(x + cell / 2).toFixed(1)}" y="${(y + cell / 2 + 4).toFixed(1)}" text-anchor="middle" font-size="11.5" fill="#000000">${escText(geno)}</text>`;
      }
    });
  });
  svg += `<line x1="${ox.toFixed(1)}" y1="${(oy + head).toFixed(1)}" x2="${(ox + gridW).toFixed(1)}" y2="${(oy + head).toFixed(1)}" stroke="#000000" stroke-width="1.5"/>`;
  svg += `<line x1="${(ox + head).toFixed(1)}" y1="${oy.toFixed(1)}" x2="${(ox + head).toFixed(1)}" y2="${(oy + gridH).toFixed(1)}" stroke="#000000" stroke-width="1.5"/>`;

  if (showRatio && !blank) {
    svg += `<text x="${(W / 2).toFixed(1)}" y="${(oy + gridH + 18).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="#000000">Genotipe — ${escText(ratioString(genoCounts))}</text>`;
    svg += `<text x="${(W / 2).toFixed(1)}" y="${(oy + gridH + 33).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="#000000">Fenotipe — ${escText(ratioString(phenoCounts))}</text>`;
  }
  svg += '</svg>';
  return svg;
}

// Dichotomous key: each step offers two mutually exclusive statements, and
// each statement either names an organism or sends the reader on to
// another step. "1a:Berdaun jarum:Pinus | 1b:Berdaun lebar:2 | ..."
function renderDichotomousKeySVG(cfg) {
  const steps = String(cfg.langkah || '').split('|').map((s) => s.trim()).filter(Boolean).map((chunk) => {
    const parts = chunk.split(':').map((x) => x.trim());
    return { label: parts[0] || '', text: parts[1] || '', result: parts[2] || '' };
  });
  if (!steps.length) throw new Error('kuncideterminasi perlu langkah= (mis. 1a:Berdaun jarum:Pinus)');

  const rowH = 22, padL = 16, padT = 22, resultX = 260;
  const W = 420;
  const H = padT + steps.length * rowH + 16;
  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  if (cfg.judul) {
    svg += `<text x="${(W / 2).toFixed(1)}" y="15" text-anchor="middle" font-size="12" font-weight="700" fill="#000000">${escText(cfg.judul)}</text>`;
  }
  steps.forEach((step, i) => {
    const y = padT + i * rowH + 12;
    // A new numbered step is separated from the previous pair by a rule,
    // so the two branches of one step read as belonging together.
    const num = (step.label.match(/^\d+/) || [''])[0];
    const prevNum = i ? (steps[i - 1].label.match(/^\d+/) || [''])[0] : num;
    if (i && num !== prevNum) {
      svg += `<line x1="${padL}" y1="${(y - 15).toFixed(1)}" x2="${(W - padL).toFixed(1)}" y2="${(y - 15).toFixed(1)}" stroke="#e5e9ef" stroke-width="1"/>`;
    }
    svg += `<text x="${padL}" y="${y.toFixed(1)}" font-size="11" font-weight="700" fill="#000000">${escText(step.label)}</text>`;
    svg += `<text x="${(padL + 30).toFixed(1)}" y="${y.toFixed(1)}" font-size="11" fill="#000000">${escText(step.text)}</text>`;
    if (step.result) {
      const goesToStep = /^\d+$/.test(step.result);
      svg += `<text x="${(W - padL).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="end" font-size="11" font-style="${goesToStep ? 'normal' : 'italic'}" fill="#000000">${escText(goesToStep ? 'lanjut ke ' + step.result : step.result)}</text>`;
      svg += `<line x1="${(padL + 34 + step.text.length * 5.4).toFixed(1)}" y1="${(y - 3).toFixed(1)}" x2="${(W - padL - Math.max(40, step.result.length * 5.6)).toFixed(1)}" y2="${(y - 3).toFixed(1)}" stroke="#cbd5e1" stroke-width="0.8" stroke-dasharray="2,3"/>`;
    }
  });
  svg += '</svg>';
  return svg;
}

// Food WEB (as opposed to the existing linear food chain): a set of
// "eaten>eater" links, laid out in trophic levels worked out from how far
// each organism sits from a producer.
function renderFoodWebSVG(cfg) {
  const links = String(cfg.hubungan || '').split(',').map((s) => s.trim()).filter(Boolean).map((chunk) => {
    const [from, to] = chunk.split('>').map((x) => (x || '').trim());
    return from && to ? { from, to } : null;
  }).filter(Boolean);
  if (!links.length) throw new Error('jaringmakanan perlu hubungan= (mis. Rumput>Belalang, Belalang>Katak)');

  const names = [];
  links.forEach((l) => {
    if (names.indexOf(l.from) === -1) names.push(l.from);
    if (names.indexOf(l.to) === -1) names.push(l.to);
  });
  // Trophic level = longest chain of "is eaten by" steps reaching this
  // organism. Iterating to a fixed point handles links given in any order;
  // the pass cap also stops a cyclic web from looping forever.
  const level = {};
  names.forEach((n) => { level[n] = 0; });
  for (let pass = 0; pass < names.length + 1; pass++) {
    let changed = false;
    links.forEach((l) => {
      if (level[l.to] < level[l.from] + 1) { level[l.to] = level[l.from] + 1; changed = true; }
    });
    if (!changed) break;
  }
  const maxLevel = Math.max.apply(null, names.map((n) => level[n]));
  const byLevel = [];
  for (let i = 0; i <= maxLevel; i++) byLevel.push(names.filter((n) => level[n] === i));

  const boxW = 86, boxH = 34, gapY = 62, padX = 18, padY = 18;
  const widest = Math.max.apply(null, byLevel.map((row) => row.length));
  const W = Math.max(320, padX * 2 + widest * (boxW + 18) - 18);
  const H = padY * 2 + (maxLevel + 1) * boxH + maxLevel * (gapY - boxH);

  const pos = {};
  byLevel.forEach((row, i) => {
    // Producers at the bottom, top predators at the top — the way an
    // ecology diagram is always drawn.
    const y = H - padY - boxH - i * gapY;
    const rowW = row.length * boxW + (row.length - 1) * 18;
    const x0 = (W - rowW) / 2;
    row.forEach((n, k) => { pos[n] = { x: x0 + k * (boxW + 18), y }; });
  });

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  links.forEach((l) => {
    const a = pos[l.from], b = pos[l.to];
    if (!a || !b) return;
    // Arrows point from the eaten to the eater — the direction energy
    // flows, which is exactly what these questions test.
    svg += arrowSVG(a.x + boxW / 2, a.y, b.x + boxW / 2, b.y + boxH);
  });
  names.forEach((n) => {
    const p = pos[n];
    svg += `<rect x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" width="${boxW}" height="${boxH}" fill="#ffffff" stroke="#000000" stroke-width="1.5"/>`;
    svg += `<text x="${(p.x + boxW / 2).toFixed(1)}" y="${(p.y + boxH / 2 + 4).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="#000000">${escText(n)}</text>`;
  });
  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 6z. Geometri lanjutan — teorema lingkaran, jaring-jaring, pandangan
// ---------------------------------------------------------------------

// Point on a circle at a bearing measured in ordinary maths degrees
// (0 = east, counter-clockwise). SVG's y axis points down, so the sine is
// negated — every circle-theorem diagram below is placed through here.
function circlePoint(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

// Small arc marking the angle at vertex V between rays VA and VB, with an
// optional label just outside it — the notation a geometry question is
// answered in.
function angleArcSVG(vx, vy, ax, ay, bx, by, r, text) {
  const a1 = Math.atan2(ay - vy, ax - vx);
  const a2 = Math.atan2(by - vy, bx - vx);
  let diff = a2 - a1;
  while (diff <= -Math.PI) diff += 2 * Math.PI;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  const sweep = diff > 0 ? 1 : 0;
  const p1 = [vx + r * Math.cos(a1), vy + r * Math.sin(a1)];
  const p2 = [vx + r * Math.cos(a2), vy + r * Math.sin(a2)];
  let s = `<path d="M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} A${r} ${r} 0 0 ${sweep} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.2"/>`;
  if (text) {
    const mid = a1 + diff / 2;
    const lx = vx + (r + 13) * Math.cos(mid);
    const ly = vy + (r + 13) * Math.sin(mid);
    s += annotText(lx, ly + 3.5, text);
  }
  return s;
}

// Right-angle square at vertex V, drawn towards A and B.
function rightAngleSVG(vx, vy, ax, ay, bx, by, size) {
  const n = (px, py) => {
    const d = Math.hypot(px - vx, py - vy) || 1;
    return [(px - vx) / d, (py - vy) / d];
  };
  const [ux, uy] = n(ax, ay);
  const [wx, wy] = n(bx, by);
  const k = size || 9;
  return `<path d="M${(vx + ux * k).toFixed(1)} ${(vy + uy * k).toFixed(1)} L${(vx + ux * k + wx * k).toFixed(1)} ${(vy + uy * k + wy * k).toFixed(1)} L${(vx + wx * k).toFixed(1)} ${(vy + wy * k).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.2"/>`;
}

function ptLabel(x, y, cx, cy, name) {
  // Pushed radially outward from the circle's centre so a vertex label
  // never sits on top of the shape it belongs to.
  const d = Math.hypot(x - cx, y - cy) || 1;
  return annotText(x + ((x - cx) / d) * 12, y + ((y - cy) / d) * 12 + 3.5, name);
}

const CIRCLE_THEOREMS = {
  'sudut-pusat': function (cx, cy, r, ang) {
    const a = ang || 110;
    const A = circlePoint(cx, cy, r, 200), B = circlePoint(cx, cy, r, 340);
    const P = circlePoint(cx, cy, r, 90);
    let s = `<line x1="${cx}" y1="${cy}" x2="${A[0].toFixed(1)}" y2="${A[1].toFixed(1)}" stroke="#000000" stroke-width="1.5"/>`;
    s += `<line x1="${cx}" y1="${cy}" x2="${B[0].toFixed(1)}" y2="${B[1].toFixed(1)}" stroke="#000000" stroke-width="1.5"/>`;
    s += `<line x1="${P[0].toFixed(1)}" y1="${P[1].toFixed(1)}" x2="${A[0].toFixed(1)}" y2="${A[1].toFixed(1)}" stroke="#000000" stroke-width="1.5"/>`;
    s += `<line x1="${P[0].toFixed(1)}" y1="${P[1].toFixed(1)}" x2="${B[0].toFixed(1)}" y2="${B[1].toFixed(1)}" stroke="#000000" stroke-width="1.5"/>`;
    s += angleArcSVG(cx, cy, A[0], A[1], B[0], B[1], 24, a + '°');
    s += angleArcSVG(P[0], P[1], A[0], A[1], B[0], B[1], 20, 'x');
    s += `<circle cx="${cx}" cy="${cy}" r="2.4" fill="#000000"/>` + annotText(cx + 10, cy + 14, 'O');
    s += ptLabel(A[0], A[1], cx, cy, 'A') + ptLabel(B[0], B[1], cx, cy, 'B') + ptLabel(P[0], P[1], cx, cy, 'P');
    return s;
  },
  'sudut-keliling': function (cx, cy, r) {
    const A = circlePoint(cx, cy, r, 205), B = circlePoint(cx, cy, r, 335);
    const P = circlePoint(cx, cy, r, 75), Q = circlePoint(cx, cy, r, 120);
    let s = '';
    [P, Q].forEach((V, i) => {
      s += `<line x1="${V[0].toFixed(1)}" y1="${V[1].toFixed(1)}" x2="${A[0].toFixed(1)}" y2="${A[1].toFixed(1)}" stroke="#000000" stroke-width="1.5"/>`;
      s += `<line x1="${V[0].toFixed(1)}" y1="${V[1].toFixed(1)}" x2="${B[0].toFixed(1)}" y2="${B[1].toFixed(1)}" stroke="#000000" stroke-width="1.5"/>`;
      s += angleArcSVG(V[0], V[1], A[0], A[1], B[0], B[1], 18, i ? 'y' : 'x');
    });
    s += ptLabel(A[0], A[1], cx, cy, 'A') + ptLabel(B[0], B[1], cx, cy, 'B');
    s += ptLabel(P[0], P[1], cx, cy, 'P') + ptLabel(Q[0], Q[1], cx, cy, 'Q');
    return s;
  },
  'semilingkaran': function (cx, cy, r) {
    const A = circlePoint(cx, cy, r, 180), B = circlePoint(cx, cy, r, 0);
    const P = circlePoint(cx, cy, r, 65);
    let s = `<line x1="${A[0].toFixed(1)}" y1="${A[1].toFixed(1)}" x2="${B[0].toFixed(1)}" y2="${B[1].toFixed(1)}" stroke="#000000" stroke-width="1.5"/>`;
    s += `<line x1="${P[0].toFixed(1)}" y1="${P[1].toFixed(1)}" x2="${A[0].toFixed(1)}" y2="${A[1].toFixed(1)}" stroke="#000000" stroke-width="1.5"/>`;
    s += `<line x1="${P[0].toFixed(1)}" y1="${P[1].toFixed(1)}" x2="${B[0].toFixed(1)}" y2="${B[1].toFixed(1)}" stroke="#000000" stroke-width="1.5"/>`;
    s += rightAngleSVG(P[0], P[1], A[0], A[1], B[0], B[1], 10);
    s += `<circle cx="${cx}" cy="${cy}" r="2.4" fill="#000000"/>` + annotText(cx, cy + 16, 'O');
    s += ptLabel(A[0], A[1], cx, cy, 'A') + ptLabel(B[0], B[1], cx, cy, 'B') + ptLabel(P[0], P[1], cx, cy, 'P');
    return s;
  },
  'segiempat-talibusur': function (cx, cy, r) {
    const pts = [140, 40, 315, 220].map((d) => circlePoint(cx, cy, r, d));
    let s = `<polygon points="${pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="none" stroke="#000000" stroke-width="1.5"/>`;
    s += angleArcSVG(pts[0][0], pts[0][1], pts[3][0], pts[3][1], pts[1][0], pts[1][1], 18, 'a');
    s += angleArcSVG(pts[2][0], pts[2][1], pts[1][0], pts[1][1], pts[3][0], pts[3][1], 18, 'c');
    'ABCD'.split('').forEach((n, i) => { s += ptLabel(pts[i][0], pts[i][1], cx, cy, n); });
    return s;
  },
  'tangen-jari': function (cx, cy, r) {
    const T = circlePoint(cx, cy, r, 55);
    const dx = Math.cos((55 * Math.PI) / 180), dy = -Math.sin((55 * Math.PI) / 180);
    // Tangent runs perpendicular to OT, so its direction is OT turned 90°.
    const tx = -dy, ty = dx;
    const P1 = [T[0] - tx * 62, T[1] - ty * 62], P2 = [T[0] + tx * 62, T[1] + ty * 62];
    let s = `<line x1="${cx}" y1="${cy}" x2="${T[0].toFixed(1)}" y2="${T[1].toFixed(1)}" stroke="#000000" stroke-width="1.5"/>`;
    s += `<line x1="${P1[0].toFixed(1)}" y1="${P1[1].toFixed(1)}" x2="${P2[0].toFixed(1)}" y2="${P2[1].toFixed(1)}" stroke="#000000" stroke-width="1.5"/>`;
    s += rightAngleSVG(T[0], T[1], cx, cy, P2[0], P2[1], 10);
    s += `<circle cx="${cx}" cy="${cy}" r="2.4" fill="#000000"/>` + annotText(cx - 12, cy + 4, 'O');
    s += ptLabel(T[0], T[1], cx, cy, 'T');
    s += annotText(P2[0], P2[1] + 12, 'garis singgung');
    return s;
  },
  'dua-tangen': function (cx, cy, r) {
    const P = [cx + r * 2.1, cy];
    const d = Math.hypot(P[0] - cx, P[1] - cy);
    const alpha = Math.acos(r / d);
    const base = Math.atan2(cy - P[1], cx - P[0]);
    const T1 = [cx + r * Math.cos(base + Math.PI - alpha), cy + r * Math.sin(base + Math.PI - alpha)];
    const T2 = [cx + r * Math.cos(base + Math.PI + alpha), cy + r * Math.sin(base + Math.PI + alpha)];
    let s = '';
    [T1, T2].forEach((T) => {
      s += `<line x1="${P[0].toFixed(1)}" y1="${P[1].toFixed(1)}" x2="${T[0].toFixed(1)}" y2="${T[1].toFixed(1)}" stroke="#000000" stroke-width="1.5"/>`;
      s += `<line x1="${cx}" y1="${cy}" x2="${T[0].toFixed(1)}" y2="${T[1].toFixed(1)}" stroke="#000000" stroke-width="1.2" stroke-dasharray="4,3"/>`;
      s += rightAngleSVG(T[0], T[1], cx, cy, P[0], P[1], 9);
    });
    s += `<circle cx="${cx}" cy="${cy}" r="2.4" fill="#000000"/>` + annotText(cx - 12, cy + 4, 'O');
    s += ptLabel(T1[0], T1[1], cx, cy, 'A') + ptLabel(T2[0], T2[1], cx, cy, 'B');
    s += annotText(P[0] + 14, P[1] + 4, 'P');
    return s;
  }
};

function renderCircleTheoremSVG(cfg) {
  const key = String(cfg.jenis || 'sudut-pusat').toLowerCase().trim();
  const build = CIRCLE_THEOREMS[key];
  if (!build) throw new Error('jenis teorema lingkaran tidak dikenal: "' + key + '"');
  const W = 320, H = 300, r = 96;
  const cx = key === 'dua-tangen' ? 128 : W / 2;
  const cy = H / 2;
  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#000000" stroke-width="1.6"/>`;
  svg += build(cx, cy, r, numOrDefault(cfg.sudut, null));
  svg += '</svg>';
  return svg;
}

// --- Jaring-jaring (nets of solids) ------------------------------------
const SOLID_NETS = {
  kubus: function (u) {
    const cells = [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]];
    return { cols: 4, rows: 3, rects: cells.map(([c, r]) => [c * u, r * u, u, u]), extra: '' };
  },
  balok: function (u) {
    // p x l x t drawn as a cross: the classic "which net folds into this
    // cuboid" figure, with each face proportioned differently.
    const p = u * 1.6, l = u, t = u * 0.7;
    const rects = [
      [t, 0, p, t], [0, t, t, l], [t, t, p, l], [t + p, t, t, l],
      [t + p + t, t, p, l], [t, t + l, p, t]
    ];
    return { cols: (t + p + t + p) / u, rows: (t + l + t) / u, rects, extra: '' };
  },
  'prisma-segitiga': function (u) {
    const w = u * 1.4, h = u * 1.2, tri = u * 1.2;
    const rects = [[tri, 0, w, h], [tri, h, w, h], [tri, 2 * h, w, h]];
    const extra = `<polygon points="${tri},0 ${tri},${h} 0,${(h / 2).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.5"/>`
      + `<polygon points="${tri + w},0 ${tri + w},${h} ${(tri + w + tri).toFixed(1)},${(h / 2).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.5"/>`;
    return { cols: (tri * 2 + w) / u, rows: (3 * h) / u, rects, extra };
  },
  'limas-segiempat': function (u) {
    const a = u * 1.3, h = u * 1.1;
    const x0 = h, y0 = h;
    const rects = [[x0, y0, a, a]];
    const extra = [
      `<polygon points="${x0},${y0} ${x0 + a},${y0} ${(x0 + a / 2).toFixed(1)},${(y0 - h).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.5"/>`,
      `<polygon points="${x0},${y0 + a} ${x0 + a},${y0 + a} ${(x0 + a / 2).toFixed(1)},${(y0 + a + h).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.5"/>`,
      `<polygon points="${x0},${y0} ${x0},${y0 + a} ${(x0 - h).toFixed(1)},${(y0 + a / 2).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.5"/>`,
      `<polygon points="${x0 + a},${y0} ${x0 + a},${y0 + a} ${(x0 + a + h).toFixed(1)},${(y0 + a / 2).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.5"/>`
    ].join('');
    return { cols: (a + 2 * h) / u, rows: (a + 2 * h) / u, rects, extra };
  },
  tabung: function (u) {
    const w = u * 3, h = u * 1.4, r = u * 0.48;
    const rects = [[r * 2, r * 2, w, h]];
    const extra = `<circle cx="${(r * 2 + w / 2).toFixed(1)}" cy="${r}" r="${r}" fill="none" stroke="#000000" stroke-width="1.5"/>`
      + `<circle cx="${(r * 2 + w / 2).toFixed(1)}" cy="${(r * 2 + h + r).toFixed(1)}" r="${r}" fill="none" stroke="#000000" stroke-width="1.5"/>`;
    return { cols: (r * 4 + w) / u, rows: (r * 4 + h) / u, rects, extra };
  },
  kerucut: function (u) {
    const R = u * 1.5, r = u * 0.6;
    const cx = R + r * 2, cy = R + 6;
    // 240° sector: the lateral surface of a cone whose base radius is two
    // thirds of its slant height.
    const p1 = [cx + R * Math.cos(-Math.PI / 1.5), cy + R * Math.sin(-Math.PI / 1.5)];
    const p2 = [cx + R * Math.cos(Math.PI / 1.5), cy + R * Math.sin(Math.PI / 1.5)];
    const extra = `<path d="M${cx} ${cy} L${p1[0].toFixed(1)} ${p1[1].toFixed(1)} A${R} ${R} 0 1 1 ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} Z" fill="none" stroke="#000000" stroke-width="1.5"/>`
      + `<circle cx="${cx}" cy="${(cy + R + r + 8).toFixed(1)}" r="${r}" fill="none" stroke="#000000" stroke-width="1.5"/>`;
    return { cols: (R * 2 + r * 4) / u, rows: (R + R + r * 2 + 20) / u, rects: [], extra };
  }
};

function renderNetSVG(cfg) {
  const key = String(cfg.bentuk || 'kubus').toLowerCase().trim();
  const build = SOLID_NETS[key];
  if (!build) throw new Error('bentuk jaring-jaring tidak dikenal: "' + key + '"');
  const u = 52;
  const net = build(u);
  const pad = 18;
  const W = Math.round(net.cols * u) + pad * 2;
  const H = Math.round(net.rows * u) + pad * 2;
  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  svg += `<g transform="translate(${pad},${pad})">`;
  net.rects.forEach(([x, y, w, h]) => {
    svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.5"/>`;
  });
  svg += net.extra;
  svg += '</g></svg>';
  return svg;
}

// --- Pandangan (plan and elevations) -----------------------------------
// Front / side / plan views of a solid, the "gambar tampak" question. Each
// view is a simple outline, drawn in its own labelled box.
const SOLID_VIEWS = {
  kubus: { depan: 'persegi', samping: 'persegi', atas: 'persegi' },
  balok: { depan: 'lebar', samping: 'sempit', atas: 'lebar' },
  tabung: { depan: 'lebar', samping: 'lebar', atas: 'lingkaran' },
  kerucut: { depan: 'segitiga', samping: 'segitiga', atas: 'lingkaran-titik' },
  'limas-segiempat': { depan: 'segitiga', samping: 'segitiga', atas: 'persegi-diagonal' },
  'prisma-segitiga': { depan: 'segitiga', samping: 'lebar', atas: 'persegi' },
  bola: { depan: 'lingkaran', samping: 'lingkaran', atas: 'lingkaran' }
};

function viewShapeSVG(shape, x, y, w, h) {
  const mid = x + w / 2;
  switch (shape) {
    case 'persegi':
      return `<rect x="${(mid - h / 2).toFixed(1)}" y="${y}" width="${h}" height="${h}" fill="none" stroke="#000000" stroke-width="1.6"/>`;
    case 'lebar':
      return `<rect x="${x}" y="${(y + h * 0.15).toFixed(1)}" width="${w}" height="${(h * 0.7).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.6"/>`;
    case 'sempit':
      return `<rect x="${(mid - w * 0.22).toFixed(1)}" y="${(y + h * 0.15).toFixed(1)}" width="${(w * 0.44).toFixed(1)}" height="${(h * 0.7).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.6"/>`;
    case 'segitiga':
      return `<polygon points="${x},${y + h} ${(x + w).toFixed(1)},${y + h} ${mid.toFixed(1)},${y}" fill="none" stroke="#000000" stroke-width="1.6"/>`;
    case 'lingkaran':
      return `<circle cx="${mid.toFixed(1)}" cy="${(y + h / 2).toFixed(1)}" r="${(h / 2).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.6"/>`;
    case 'lingkaran-titik':
      return `<circle cx="${mid.toFixed(1)}" cy="${(y + h / 2).toFixed(1)}" r="${(h / 2).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.6"/>`
        + `<circle cx="${mid.toFixed(1)}" cy="${(y + h / 2).toFixed(1)}" r="2.2" fill="#000000"/>`;
    case 'persegi-diagonal':
      return `<rect x="${(mid - h / 2).toFixed(1)}" y="${y}" width="${h}" height="${h}" fill="none" stroke="#000000" stroke-width="1.6"/>`
        + `<line x1="${(mid - h / 2).toFixed(1)}" y1="${y}" x2="${(mid + h / 2).toFixed(1)}" y2="${y + h}" stroke="#000000" stroke-width="1.1"/>`
        + `<line x1="${(mid + h / 2).toFixed(1)}" y1="${y}" x2="${(mid - h / 2).toFixed(1)}" y2="${y + h}" stroke="#000000" stroke-width="1.1"/>`;
    default:
      return '';
  }
}

function renderViewsSVG(cfg) {
  const key = String(cfg.bentuk || 'kubus').toLowerCase().trim();
  const views = SOLID_VIEWS[key];
  if (!views) throw new Error('bentuk pandangan tidak dikenal: "' + key + '"');
  const boxW = 116, boxH = 106, gap = 14, pad = 16, capH = 20;
  const W = pad * 2 + boxW * 3 + gap * 2;
  const H = pad * 2 + boxH + capH;
  const blank = String(cfg.jawaban || 'lengkap').toLowerCase() === 'kosong';
  const order = [['depan', 'Tampak Depan'], ['samping', 'Tampak Samping'], ['atas', 'Tampak Atas']];

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  order.forEach(([slot, caption], i) => {
    const x = pad + i * (boxW + gap);
    svg += `<rect x="${x}" y="${pad}" width="${boxW}" height="${boxH}" fill="none" stroke="#b8c0cc" stroke-width="1" stroke-dasharray="4,3"/>`;
    // "jawaban=kosong" leaves the three boxes empty for the student to draw
    // the views into — the form the question is usually asked in.
    if (!blank) {
      svg += viewShapeSVG(views[slot], x + 18, pad + 16, boxW - 36, boxH - 32);
    }
    svg += `<text x="${(x + boxW / 2).toFixed(1)}" y="${(pad + boxH + 15).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="#000000">${caption}</text>`;
  });
  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 7. Alat Laboratorium (kimia/fisika)
// ---------------------------------------------------------------------
// Apparatus diagrams — the thing every IGCSE/A-Level practical question is
// built around, and the one subject area this file had nothing at all for.
// Drawn as plain outlines with leader-line labels, because that is how an
// exam paper draws them: the student has to be able to name the parts.

// Leader line from a label to the thing it names, with a dot at the target.
function labelLead(x1, y1, x2, y2, text, anchorPos) {
  let s = `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#64748b" stroke-width="0.9"/>`;
  s += `<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="1.6" fill="#64748b"/>`;
  s += `<text x="${x1.toFixed(1)}" y="${(y1 + 3).toFixed(1)}" font-size="9.5" text-anchor="${anchorPos || 'end'}" fill="#000000">${escText(text)}</text>`;
  return s;
}

function bunsenSVG(cx, baseY) {
  let s = '';
  s += `<line x1="${(cx - 22).toFixed(1)}" y1="${baseY}" x2="${(cx + 22).toFixed(1)}" y2="${baseY}" stroke="#000000" stroke-width="1.6"/>`;
  s += `<path d="M${(cx - 18).toFixed(1)} ${baseY} L${(cx - 5).toFixed(1)} ${(baseY - 26).toFixed(1)} L${(cx + 5).toFixed(1)} ${(baseY - 26).toFixed(1)} L${(cx + 18).toFixed(1)} ${baseY} Z" fill="none" stroke="#000000" stroke-width="1.4"/>`;
  s += `<rect x="${(cx - 5).toFixed(1)}" y="${(baseY - 50).toFixed(1)}" width="10" height="24" fill="none" stroke="#000000" stroke-width="1.4"/>`;
  // Flame
  s += `<path d="M${(cx - 6).toFixed(1)} ${(baseY - 50).toFixed(1)} Q${cx.toFixed(1)} ${(baseY - 72).toFixed(1)} ${(cx + 6).toFixed(1)} ${(baseY - 50).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.2"/>`;
  return s;
}

function conicalFlaskSVG(cx, baseY, w, h, liquidFrac) {
  const halfTop = 7, halfBase = w / 2;
  let s = `<path d="M${(cx - halfTop).toFixed(1)} ${(baseY - h).toFixed(1)} L${(cx - halfTop).toFixed(1)} ${(baseY - h + 14).toFixed(1)} L${(cx - halfBase).toFixed(1)} ${baseY} L${(cx + halfBase).toFixed(1)} ${baseY} L${(cx + halfTop).toFixed(1)} ${(baseY - h + 14).toFixed(1)} L${(cx + halfTop).toFixed(1)} ${(baseY - h).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.6"/>`;
  if (liquidFrac > 0) {
    const ly = baseY - (h - 14) * liquidFrac;
    const halfAtY = halfBase - (halfBase - halfTop) * ((baseY - ly) / (h - 14));
    s += `<path d="M${(cx - halfAtY).toFixed(1)} ${ly.toFixed(1)} L${(cx - halfBase).toFixed(1)} ${baseY} L${(cx + halfBase).toFixed(1)} ${baseY} L${(cx + halfAtY).toFixed(1)} ${ly.toFixed(1)} Z" fill="#000000" fill-opacity="0.10" stroke="#000000" stroke-width="1"/>`;
  }
  return s;
}

function beakerSVG(x, baseY, w, h, liquidFrac) {
  let s = `<path d="M${x.toFixed(1)} ${(baseY - h).toFixed(1)} L${x.toFixed(1)} ${baseY} L${(x + w).toFixed(1)} ${baseY} L${(x + w).toFixed(1)} ${(baseY - h).toFixed(1)}" fill="none" stroke="#000000" stroke-width="1.6"/>`;
  if (liquidFrac > 0) {
    const ly = baseY - h * liquidFrac;
    s += `<rect x="${(x + 1).toFixed(1)}" y="${ly.toFixed(1)}" width="${(w - 2).toFixed(1)}" height="${(baseY - ly - 1).toFixed(1)}" fill="#000000" fill-opacity="0.10" stroke="none"/>`;
    s += `<line x1="${x.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${(x + w).toFixed(1)}" y2="${ly.toFixed(1)}" stroke="#000000" stroke-width="1"/>`;
  }
  return s;
}

const LAB_APPARATUS = {
  destilasi: function () {
    const W = 420, H = 300;
    let s = '';
    // Round-bottom flask over a Bunsen burner
    s += `<circle cx="80" cy="196" r="30" fill="none" stroke="#000000" stroke-width="1.6"/>`;
    s += `<path d="M74 168 L74 128 M86 168 L86 128" fill="none" stroke="#000000" stroke-width="1.6"/>`;
    s += `<path d="M52 200 A30 30 0 0 0 108 200" fill="#000000" fill-opacity="0.10" stroke="none"/>`;
    s += bunsenSVG(80, 288);
    // Thermometer in the neck
    s += `<line x1="80" y1="124" x2="80" y2="176" stroke="#000000" stroke-width="1.2"/>`;
    s += `<circle cx="80" cy="178" r="3" fill="#000000"/>`;
    // Liebig condenser, sloping down to the right
    s += `<path d="M88 132 L232 176" stroke="#000000" stroke-width="1.6" fill="none"/>`;
    s += `<path d="M84 146 L228 190" stroke="#000000" stroke-width="1.6" fill="none"/>`;
    s += `<path d="M104 120 L248 164 L244 196 L100 152 Z" fill="none" stroke="#000000" stroke-width="1.6"/>`;
    s += `<line x1="120" y1="128" x2="112" y2="106" stroke="#000000" stroke-width="1.4"/>`;
    s += `<line x1="236" y1="186" x2="244" y2="208" stroke="#000000" stroke-width="1.4"/>`;
    // Receiver
    s += conicalFlaskSVG(292, 268, 54, 70, 0.25);
    s += `<line x1="248" y1="180" x2="292" y2="200" stroke="#000000" stroke-width="1.6"/>`;
    s += labelLead(70, 96, 80, 130, 'Termometer');
    s += labelLead(196, 84, 176, 140, 'Kondensor Liebig');
    s += labelLead(340, 118, 300, 200, 'Distilat', 'start');
    s += labelLead(30, 250, 62, 210, 'Labu didih', 'start');
    s += labelLead(120, 240, 106, 118, 'Air keluar', 'start');
    s += labelLead(268, 232, 246, 206, 'Air masuk', 'start');
    return { W, H, s };
  },
  titrasi: function () {
    const W = 300, H = 320;
    let s = '';
    // Burette with a tap and graduations
    s += `<rect x="132" y="24" width="22" height="170" fill="none" stroke="#000000" stroke-width="1.6"/>`;
    for (let i = 1; i <= 8; i++) {
      const y = 34 + i * 18;
      s += `<line x1="132" y1="${y}" x2="${i % 2 ? 141 : 146}" y2="${y}" stroke="#000000" stroke-width="0.9"/>`;
    }
    s += `<rect x="136" y="30" width="14" height="70" fill="#000000" fill-opacity="0.10" stroke="none"/>`;
    s += `<path d="M132 194 L143 210 L154 194 Z" fill="none" stroke="#000000" stroke-width="1.6"/>`;
    s += `<circle cx="143" cy="200" r="5" fill="#ffffff" stroke="#000000" stroke-width="1.4"/>`;
    s += `<line x1="143" y1="210" x2="143" y2="226" stroke="#000000" stroke-width="1.6"/>`;
    s += `<circle cx="143" cy="234" r="2.4" fill="#000000"/>`;
    // Clamp and stand
    s += `<line x1="60" y1="24" x2="60" y2="300" stroke="#000000" stroke-width="2"/>`;
    s += `<rect x="34" y="300" width="120" height="8" fill="none" stroke="#000000" stroke-width="1.6"/>`;
    s += `<line x1="60" y1="110" x2="132" y2="110" stroke="#000000" stroke-width="2"/>`;
    // Conical flask on a white tile
    s += conicalFlaskSVG(143, 292, 76, 74, 0.35);
    s += `<rect x="96" y="292" width="94" height="8" fill="none" stroke="#000000" stroke-width="1.4"/>`;
    s += labelLead(250, 60, 156, 90, 'Buret berisi titran', 'start');
    s += labelLead(250, 200, 152, 200, 'Kran', 'start');
    s += labelLead(258, 258, 176, 268, 'Labu erlenmeyer', 'start');
    s += labelLead(258, 302, 192, 296, 'Ubin putih', 'start');
    return { W, H, s };
  },
  elektrolisis: function () {
    const W = 360, H = 280;
    let s = '';
    s += beakerSVG(90, 240, 180, 120, 0.8);
    // Electrodes dipping into the electrolyte
    s += `<rect x="130" y="96" width="12" height="120" fill="#ffffff" stroke="#000000" stroke-width="1.6"/>`;
    s += `<rect x="218" y="96" width="12" height="120" fill="#ffffff" stroke="#000000" stroke-width="1.6"/>`;
    // Bubbles at each electrode
    [0, 1, 2].forEach((k) => {
      s += `<circle cx="${124 - k * 0}" cy="${170 - k * 22}" r="3" fill="none" stroke="#000000" stroke-width="1"/>`;
      s += `<circle cx="${236}" cy="${162 - k * 22}" r="3" fill="none" stroke="#000000" stroke-width="1"/>`;
    });
    // Cell and leads
    s += `<line x1="136" y1="96" x2="136" y2="46" stroke="#000000" stroke-width="1.6"/>`;
    s += `<line x1="224" y1="96" x2="224" y2="46" stroke="#000000" stroke-width="1.6"/>`;
    s += `<line x1="136" y1="46" x2="166" y2="46" stroke="#000000" stroke-width="1.6"/>`;
    s += `<line x1="194" y1="46" x2="224" y2="46" stroke="#000000" stroke-width="1.6"/>`;
    s += `<line x1="166" y1="34" x2="166" y2="58" stroke="#000000" stroke-width="1.6"/>`;
    s += `<line x1="174" y1="40" x2="174" y2="52" stroke="#000000" stroke-width="3"/>`;
    s += `<line x1="184" y1="34" x2="184" y2="58" stroke="#000000" stroke-width="1.6"/>`;
    s += `<line x1="194" y1="40" x2="194" y2="52" stroke="#000000" stroke-width="3"/>`;
    s += `<text x="156" y="28" text-anchor="middle" font-size="11" fill="#000000">+</text>`;
    s += `<text x="204" y="28" text-anchor="middle" font-size="11" fill="#000000">−</text>`;
    s += labelLead(60, 110, 130, 120, 'Anoda (+)', 'start');
    s += labelLead(320, 110, 230, 120, 'Katoda (−)');
    s += labelLead(320, 200, 250, 200, 'Larutan elektrolit');
    return { W, H, s };
  },
  tabunggas: function () {
    const W = 420, H = 240;
    let s = '';
    s += conicalFlaskSVG(84, 200, 76, 86, 0.4);
    s += `<ellipse cx="84" cy="114" rx="9" ry="6" fill="none" stroke="#000000" stroke-width="1.4"/>`;
    s += `<path d="M84 108 L84 84 L200 84" fill="none" stroke="#000000" stroke-width="1.6"/>`;
    // Gas syringe with a graduated barrel and plunger
    s += `<rect x="200" y="66" width="150" height="36" fill="none" stroke="#000000" stroke-width="1.6"/>`;
    for (let i = 1; i < 6; i++) {
      s += `<line x1="${200 + i * 25}" y1="66" x2="${200 + i * 25}" y2="74" stroke="#000000" stroke-width="0.9"/>`;
    }
    s += `<line x1="272" y1="66" x2="272" y2="102" stroke="#000000" stroke-width="1.8"/>`;
    s += `<line x1="272" y1="84" x2="378" y2="84" stroke="#000000" stroke-width="1.6"/>`;
    s += `<line x1="378" y1="72" x2="378" y2="96" stroke="#000000" stroke-width="1.8"/>`;
    s += `<rect x="200" y="67" width="71" height="34" fill="#000000" fill-opacity="0.08" stroke="none"/>`;
    s += labelLead(40, 60, 76, 130, 'Labu reaksi', 'start');
    s += labelLead(150, 44, 150, 84, 'Tabung penyalur', 'start');
    s += labelLead(300, 140, 260, 102, 'Tabung suntik gas', 'start');
    s += labelLead(60, 224, 74, 186, 'Campuran reaksi', 'start');
    return { W, H, s };
  },
  penyaringan: function () {
    const W = 300, H = 300;
    let s = '';
    // Funnel with folded filter paper
    s += `<path d="M74 44 L216 44 L152 132 L138 132 Z" fill="none" stroke="#000000" stroke-width="1.6"/>`;
    s += `<path d="M86 52 L204 52 L150 128 L140 128 Z" fill="none" stroke="#000000" stroke-width="1.1" stroke-dasharray="4,3"/>`;
    s += `<line x1="138" y1="132" x2="138" y2="168" stroke="#000000" stroke-width="1.6"/>`;
    s += `<line x1="152" y1="132" x2="152" y2="168" stroke="#000000" stroke-width="1.6"/>`;
    s += `<path d="M92 60 L198 60 L150 122 L140 122 Z" fill="#000000" fill-opacity="0.10" stroke="none"/>`;
    // Receiving conical flask
    s += conicalFlaskSVG(145, 276, 92, 116, 0.22);
    s += `<circle cx="145" cy="190" r="2.4" fill="#000000"/>`;
    s += labelLead(272, 40, 200, 48, 'Corong');
    s += labelLead(272, 78, 186, 66, 'Kertas saring');
    s += labelLead(272, 118, 168, 92, 'Residu');
    s += labelLead(272, 250, 176, 262, 'Filtrat');
    return { W, H, s };
  },
  pemanasan: function () {
    const W = 320, H = 300;
    let s = '';
    // Tripod and gauze
    s += `<line x1="70" y1="176" x2="250" y2="176" stroke="#000000" stroke-width="1.6"/>`;
    s += `<line x1="84" y1="176" x2="70" y2="264" stroke="#000000" stroke-width="1.6"/>`;
    s += `<line x1="236" y1="176" x2="250" y2="264" stroke="#000000" stroke-width="1.6"/>`;
    s += `<line x1="160" y1="176" x2="160" y2="264" stroke="#000000" stroke-width="1.2" stroke-dasharray="4,3"/>`;
    s += `<rect x="92" y="168" width="136" height="8" fill="none" stroke="#000000" stroke-width="1.3"/>`;
    s += beakerSVG(108, 168, 104, 82, 0.6);
    s += bunsenSVG(160, 288);
    s += labelLead(292, 96, 212, 116, 'Gelas kimia');
    s += labelLead(292, 172, 232, 172, 'Kasa asbes');
    s += labelLead(60, 200, 84, 200, 'Kaki tiga', 'start');
    s += labelLead(292, 248, 178, 252, 'Pembakar Bunsen');
    return { W, H, s };
  }
};

const LAB_ALIASES = {
  destilasi: 'destilasi', distilasi: 'destilasi', distillation: 'destilasi',
  titrasi: 'titrasi', titration: 'titrasi',
  elektrolisis: 'elektrolisis', electrolysis: 'elektrolisis', selelektrolisis: 'elektrolisis',
  tabunggas: 'tabunggas', gassyringe: 'tabunggas', suntikgas: 'tabunggas',
  penyaringan: 'penyaringan', filtrasi: 'penyaringan', filtration: 'penyaringan',
  pemanasan: 'pemanasan', heating: 'pemanasan', kakitiga: 'pemanasan'
};

function renderLabApparatusSVG(cfg) {
  const key = LAB_ALIASES[String(cfg.jenis || 'destilasi').toLowerCase().replace(/[\s_-]/g, '')];
  const build = key && LAB_APPARATUS[key];
  if (!build) {
    throw new Error('jenis alat lab tidak dikenal: "' + String(cfg.jenis || '') + '"');
  }
  const { W, H, s } = build();
  // "label=tidak" strips the leader-line captions, turning any apparatus
  // diagram into a blank one for the student to name themselves — the
  // standard "label the parts of the apparatus" question.
  const body = String(cfg.label || 'ya').toLowerCase() === 'tidak'
    ? s.replace(/<text[\s\S]*?<\/text>/g, '')
    : s;
  const titleH = cfg.judul ? 20 : 0;
  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${W} ${H + titleH}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${W - 1}" height="${H + titleH - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  if (cfg.judul) {
    svg += `<text x="${(W / 2).toFixed(1)}" y="15" text-anchor="middle" font-size="12" font-weight="700" fill="#000000">${escText(cfg.judul)}</text>`;
  }
  svg += `<g transform="translate(0,${titleH})">${body}</g></svg>`;
  return svg;
}

// ---------------------------------------------------------------------
// 7a. Statistika lanjutan — pencar, histogram, batang-daun
// ---------------------------------------------------------------------

function parseNumberList(raw) {
  return String(raw || '').split(',').map((s) => parseFloat(s.trim())).filter((n) => isFinite(n));
}

// Least-squares line through the points. Returned as the gradient and
// intercept a student is asked to read off the drawn line, plus r so the
// author can quote the correlation in the question if they want it.
function leastSquaresFit(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]; sy += ys[i];
    sxy += xs[i] * ys[i];
    sxx += xs[i] * xs[i];
    syy += ys[i] * ys[i];
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const m = (n * sxy - sx * sy) / denom;
  const c = (sy - m * sx) / n;
  const rDen = Math.sqrt(denom * (n * syy - sy * sy));
  const r = Math.abs(rDen) < 1e-12 ? 0 : (n * sxy - sx * sy) / rDen;
  return { m, c, r, meanX: sx / n, meanY: sy / n };
}

function renderScatterSVG(cfg) {
  const xs = parseNumberList(cfg.x);
  const ys = parseNumberList(cfg.y);
  if (!xs.length || !ys.length) throw new Error('pencar perlu x= dan y= berisi angka');
  const n = Math.min(xs.length, ys.length);
  // Error bars: one value applies to every point, a list applies per point.
  const errs = parseNumberList(cfg.galat);

  const width = 420, height = 320, padL = 52, padR = 18, padT = 22, padB = 46;
  const dataXmin = Math.min.apply(null, xs), dataXmax = Math.max.apply(null, xs);
  const dataYmin = Math.min.apply(null, ys), dataYmax = Math.max.apply(null, ys);
  const maxErr = errs.length ? Math.max.apply(null, errs) : 0;
  // Pad the axes out to a round step past the data so no point sits on the
  // frame, which is where a plotted cross becomes unreadable.
  const xStep = niceStep(dataXmax - dataXmin || 1);
  const yStep = niceStep((dataYmax + maxErr) - (dataYmin - maxErr) || 1);
  const xmin = numOrDefault(cfg.xmin, Math.floor(dataXmin / xStep) * xStep);
  const xmax = numOrDefault(cfg.xmax, Math.ceil(dataXmax / xStep) * xStep);
  const ymin = numOrDefault(cfg.ymin, Math.floor((dataYmin - maxErr) / yStep) * yStep);
  const ymax = numOrDefault(cfg.ymax, Math.ceil((dataYmax + maxErr) / yStep) * yStep);
  const plotW = width - padL - padR, plotH = height - padT - padB;
  const toPx = (x, y) => [
    padL + ((x - xmin) / ((xmax - xmin) || 1)) * plotW,
    padT + plotH - ((y - ymin) / ((ymax - ymin) || 1)) * plotH
  ];

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  if (cfg.judul) {
    svg += `<text x="${(width / 2).toFixed(1)}" y="15" text-anchor="middle" font-size="12" font-weight="700" fill="#000000">${escText(cfg.judul)}</text>`;
  }

  for (let gx = Math.ceil(xmin / xStep) * xStep; gx <= xmax + 1e-9; gx += xStep) {
    const [px] = toPx(gx, ymin);
    svg += `<line x1="${px.toFixed(1)}" y1="${padT}" x2="${px.toFixed(1)}" y2="${padT + plotH}" stroke="#eef0f3" stroke-width="1"/>`;
    svg += `<text x="${px.toFixed(1)}" y="${(padT + plotH + 14).toFixed(1)}" font-size="9.5" text-anchor="middle" fill="#334155">${formatTick(gx)}</text>`;
  }
  for (let gy = Math.ceil(ymin / yStep) * yStep; gy <= ymax + 1e-9; gy += yStep) {
    const [, py] = toPx(xmin, gy);
    svg += `<line x1="${padL}" y1="${py.toFixed(1)}" x2="${padL + plotW}" y2="${py.toFixed(1)}" stroke="#eef0f3" stroke-width="1"/>`;
    svg += `<text x="${(padL - 6).toFixed(1)}" y="${(py + 3.5).toFixed(1)}" font-size="9.5" text-anchor="end" fill="#334155">${formatTick(gy)}</text>`;
  }
  svg += `<rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="none" stroke="#000000" stroke-width="1.3"/>`;

  if (cfg.sumbux) {
    svg += `<text x="${(padL + plotW / 2).toFixed(1)}" y="${(height - 8).toFixed(1)}" text-anchor="middle" font-size="11" fill="#000000">${escText(cfg.sumbux)}</text>`;
  }
  if (cfg.sumbuy) {
    const cy = padT + plotH / 2;
    svg += `<text x="13" y="${cy.toFixed(1)}" text-anchor="middle" font-size="11" fill="#000000" transform="rotate(-90 13 ${cy.toFixed(1)})">${escText(cfg.sumbuy)}</text>`;
  }

  const fit = leastSquaresFit(xs.slice(0, n), ys.slice(0, n));
  // Drawn before the points so the crosses stay legible where the line
  // passes through them.
  if (fit && String(cfg.garis || 'ya').toLowerCase() !== 'tidak') {
    const a = toPx(xmin, fit.m * xmin + fit.c);
    const b = toPx(xmax, fit.m * xmax + fit.c);
    svg += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#000000" stroke-width="1.4"/>`;
    // The mean point every "line of best fit must pass through" mark
    // scheme checks for.
    if (String(cfg.rerata || '').toLowerCase() === 'ya') {
      const mp = toPx(fit.meanX, fit.meanY);
      svg += `<circle cx="${mp[0].toFixed(1)}" cy="${mp[1].toFixed(1)}" r="4" fill="none" stroke="#000000" stroke-width="1.4"/>`;
      svg += `<circle cx="${mp[0].toFixed(1)}" cy="${mp[1].toFixed(1)}" r="1.5" fill="#000000"/>`;
    }
  }

  for (let i = 0; i < n; i++) {
    const [px, py] = toPx(xs[i], ys[i]);
    if (errs.length) {
      const e = errs.length === 1 ? errs[0] : (errs[i] || 0);
      if (e) {
        const top = toPx(xs[i], ys[i] + e)[1];
        const bot = toPx(xs[i], ys[i] - e)[1];
        svg += `<line x1="${px.toFixed(1)}" y1="${top.toFixed(1)}" x2="${px.toFixed(1)}" y2="${bot.toFixed(1)}" stroke="#000000" stroke-width="1"/>`;
        svg += `<line x1="${(px - 4).toFixed(1)}" y1="${top.toFixed(1)}" x2="${(px + 4).toFixed(1)}" y2="${top.toFixed(1)}" stroke="#000000" stroke-width="1"/>`;
        svg += `<line x1="${(px - 4).toFixed(1)}" y1="${bot.toFixed(1)}" x2="${(px + 4).toFixed(1)}" y2="${bot.toFixed(1)}" stroke="#000000" stroke-width="1"/>`;
      }
    }
    svg += `<line x1="${(px - 4).toFixed(1)}" y1="${(py - 4).toFixed(1)}" x2="${(px + 4).toFixed(1)}" y2="${(py + 4).toFixed(1)}" stroke="#000000" stroke-width="1.4"/>`;
    svg += `<line x1="${(px - 4).toFixed(1)}" y1="${(py + 4).toFixed(1)}" x2="${(px + 4).toFixed(1)}" y2="${(py - 4).toFixed(1)}" stroke="#000000" stroke-width="1.4"/>`;
  }

  svg += '</svg>';
  return svg;
}

// Histogram with UNEQUAL class widths — the version that actually appears
// on an international paper, where the y axis is frequency DENSITY and it
// is the bar's area, not its height, that represents the frequency.
function renderHistogramSVG(cfg) {
  const bounds = parseNumberList(cfg.batas);
  const freqs = parseNumberList(cfg.frekuensi);
  if (bounds.length < 2 || freqs.length !== bounds.length - 1) {
    throw new Error('histogram perlu batas= (n+1 angka) dan frekuensi= (n angka)');
  }
  const classes = freqs.map((f, i) => {
    const w = bounds[i + 1] - bounds[i];
    return { lo: bounds[i], hi: bounds[i + 1], freq: f, width: w, density: w > 0 ? f / w : 0 };
  });

  const width = 420, height = 320, padL = 52, padR = 18, padT = 22, padB = 46;
  const plotW = width - padL - padR, plotH = height - padT - padB;
  const xmin = bounds[0], xmax = bounds[bounds.length - 1];
  const maxDensity = Math.max.apply(null, classes.map((c) => c.density)) || 1;
  const yStep = niceStep(maxDensity);
  const ymax = Math.ceil(maxDensity / yStep) * yStep;
  const toX = (x) => padL + ((x - xmin) / ((xmax - xmin) || 1)) * plotW;
  const toY = (d) => padT + plotH - (d / (ymax || 1)) * plotH;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  if (cfg.judul) {
    svg += `<text x="${(width / 2).toFixed(1)}" y="15" text-anchor="middle" font-size="12" font-weight="700" fill="#000000">${escText(cfg.judul)}</text>`;
  }
  for (let gy = 0; gy <= ymax + 1e-9; gy += yStep) {
    const py = toY(gy);
    svg += `<line x1="${padL}" y1="${py.toFixed(1)}" x2="${padL + plotW}" y2="${py.toFixed(1)}" stroke="#eef0f3" stroke-width="1"/>`;
    svg += `<text x="${(padL - 6).toFixed(1)}" y="${(py + 3.5).toFixed(1)}" font-size="9.5" text-anchor="end" fill="#334155">${formatTick(gy)}</text>`;
  }
  classes.forEach((c) => {
    const x1 = toX(c.lo), x2 = toX(c.hi), y = toY(c.density);
    svg += `<rect x="${x1.toFixed(1)}" y="${y.toFixed(1)}" width="${(x2 - x1).toFixed(1)}" height="${(padT + plotH - y).toFixed(1)}" fill="#ffffff" stroke="#000000" stroke-width="1.3"/>`;
  });
  bounds.forEach((b) => {
    const px = toX(b);
    svg += `<text x="${px.toFixed(1)}" y="${(padT + plotH + 14).toFixed(1)}" font-size="9.5" text-anchor="middle" fill="#334155">${formatTick(b)}</text>`;
  });
  svg += `<line x1="${padL}" y1="${(padT + plotH).toFixed(1)}" x2="${(padL + plotW).toFixed(1)}" y2="${(padT + plotH).toFixed(1)}" stroke="#000000" stroke-width="1.4"/>`;
  svg += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${(padT + plotH).toFixed(1)}" stroke="#000000" stroke-width="1.4"/>`;

  svg += `<text x="${(padL + plotW / 2).toFixed(1)}" y="${(height - 8).toFixed(1)}" text-anchor="middle" font-size="11" fill="#000000">${escText(cfg.sumbux || 'Kelas')}</text>`;
  const cy = padT + plotH / 2;
  svg += `<text x="13" y="${cy.toFixed(1)}" text-anchor="middle" font-size="11" fill="#000000" transform="rotate(-90 13 ${cy.toFixed(1)})">${escText(cfg.sumbuy || 'Densitas frekuensi')}</text>`;
  svg += '</svg>';
  return svg;
}

// Stem-and-leaf. The stem is the value divided by "satuan" (default 10),
// so the same renderer handles 12|3 tens-and-units and 1.2|3 decimals.
function renderStemLeafSVG(cfg) {
  const data = parseNumberList(cfg.data).sort((a, b) => a - b);
  if (!data.length) throw new Error('batangdaun perlu data= berisi angka');
  const unit = Math.abs(numOrDefault(cfg.satuan, 10)) || 10;
  const rows = [];
  data.forEach((v) => {
    const stem = Math.floor(v / unit);
    const leaf = Math.round(Math.abs(v - stem * unit) / (unit / 10));
    let row = rows.find((r) => r.stem === stem);
    if (!row) { row = { stem, leaves: [] }; rows.push(row); }
    row.leaves.push(leaf);
  });
  rows.sort((a, b) => a.stem - b.stem);
  // Empty stems between occupied ones must still be shown, or the display
  // misrepresents the shape of the distribution.
  const filled = [];
  for (let st = rows[0].stem; st <= rows[rows.length - 1].stem; st++) {
    const found = rows.find((r) => r.stem === st);
    filled.push(found || { stem: st, leaves: [] });
  }

  const rowH = 16, padT = 26, padL = 18, stemW = 34;
  const maxLeaves = Math.max.apply(null, filled.map((r) => r.leaves.length));
  const width = Math.max(220, padL + stemW + 14 + maxLeaves * 12 + 20);
  const height = padT + filled.length * rowH + 34;

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  svg += `<text x="${(padL + stemW - 6).toFixed(1)}" y="18" text-anchor="end" font-size="10" font-weight="700" fill="#000000">Batang</text>`;
  svg += `<text x="${(padL + stemW + 12).toFixed(1)}" y="18" font-size="10" font-weight="700" fill="#000000">Daun</text>`;
  const lineX = padL + stemW + 4;
  svg += `<line x1="${lineX}" y1="22" x2="${lineX}" y2="${(padT + filled.length * rowH).toFixed(1)}" stroke="#000000" stroke-width="1.2"/>`;
  filled.forEach((r, i) => {
    const y = padT + i * rowH + 11;
    svg += `<text x="${(padL + stemW - 6).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="end" font-size="11" fill="#000000">${r.stem}</text>`;
    r.leaves.forEach((leaf, k) => {
      svg += `<text x="${(lineX + 10 + k * 12).toFixed(1)}" y="${y.toFixed(1)}" font-size="11" fill="#000000">${leaf}</text>`;
    });
  });
  const keyStem = filled[0].stem;
  const keyLeaf = filled[0].leaves.length ? filled[0].leaves[0] : 0;
  svg += `<text x="${padL}" y="${(height - 10).toFixed(1)}" font-size="9.5" fill="#334155">Kunci: ${keyStem} | ${keyLeaf} = ${escText(formatTick(keyStem * unit + keyLeaf * (unit / 10)))}</text>`;
  svg += '</svg>';
  return svg;
}

// ---------------------------------------------------------------------
// 7b. Gambar impor, figur berpanel, anotasi, dan ruang jawab
// ---------------------------------------------------------------------

// --- Imported pictures -----------------------------------------------
// Uploaded pictures are kept OUTSIDE the naskah (see the image store in
// app.js) and referred to by a short id, because a base64 blob pasted
// inline would drop tens of thousands of unreadable characters right in
// the middle of the questions. diagrams.js has no storage of its own, so
// the lookup is handed in from the app; under Node (tests) no resolver is
// registered and the tag renders a visible placeholder instead.
let imageResolver = null;

function setImageResolver(fn) {
  imageResolver = typeof fn === 'function' ? fn : null;
}

function renderImageHTML(params) {
  const id = String(params.id || '').trim();
  const rec = id && imageResolver ? imageResolver(id) : null;
  if (!rec || !rec.dataUrl) {
    return `<span style="color:#b91c1c;font-size:11px;">[gambar "${escText(id || '?')}" tidak ada di penyimpanan]</span>`;
  }
  // Only ever emit a data: image URL. The store is written by this app's
  // own file picker, but the id comes from the naskah — which is pasted
  // text — so the value it resolves to is checked before it becomes a src.
  // A base64 data URL contains no quotes; anything that does was not
  // produced by this app's own encoder and has no business in a src.
  if (!/^data:image\//.test(rec.dataUrl) || /["'<>]/.test(rec.dataUrl)) {
    return `<span style="color:#b91c1c;font-size:11px;">[gambar "${escText(id)}" bukan berkas gambar yang sah]</span>`;
  }
  // escText covers &, < and > — enough for text nodes, but an attribute
  // value also has to survive a quote in the author's own alt text, which
  // would otherwise close the attribute and let the rest of the naskah be
  // read as markup.
  const alt = escText(params.alt || rec.name || 'Gambar soal').replace(/"/g, '&quot;');
  return `<img class="ws-image" src="${rec.dataUrl}" alt="${alt}">`;
}

// --- Annotation overlay ----------------------------------------------
// Works on top of ANY svg diagram. Coordinates are a percentage of the
// figure box (0-100, origin top-left), never the diagram's own data units:
// every renderer has its own internal coordinate system, and a percentage
// is the one frame of reference that means the same thing on all of them.
// With the builder's live preview they're quick to place by eye.
const ANNOTATION_KEYS = ['teks', 'panah', 'ukuran'];

function hasAnnotations(params) {
  return ANNOTATION_KEYS.some((k) => params[k]);
}

// "30,20:Sisi miring | 60,50:Sudut siku" -> [{ x, y, text }, ...]
function parseAnnotPoints(raw) {
  return String(raw || '').split('|').map((s) => s.trim()).filter(Boolean).map((chunk) => {
    const idx = chunk.indexOf(':');
    const coords = (idx > -1 ? chunk.slice(0, idx) : chunk).split(',');
    return {
      x: numOrDefault(coords[0], 50),
      y: numOrDefault(coords[1], 50),
      text: idx > -1 ? chunk.slice(idx + 1).trim() : ''
    };
  });
}

// "10,80>60,80:8 cm" -> [{ x1, y1, x2, y2, text }, ...]
function parseAnnotSegments(raw) {
  return String(raw || '').split('|').map((s) => s.trim()).filter(Boolean).map((chunk) => {
    const idx = chunk.indexOf(':');
    const geom = idx > -1 ? chunk.slice(0, idx) : chunk;
    const [from, to] = geom.split('>');
    const a = String(from || '').split(',');
    const b = String(to || '').split(',');
    return {
      x1: numOrDefault(a[0], 0), y1: numOrDefault(a[1], 0),
      x2: numOrDefault(b[0], 100), y2: numOrDefault(b[1], 0),
      text: idx > -1 ? chunk.slice(idx + 1).trim() : ''
    };
  });
}

// Arrowheads are drawn as a plain polygon rather than an SVG <marker>: a
// page carries many diagrams at once, and marker refs need document-unique
// ids that would have to be threaded through every renderer to stay unique.
function arrowHeadPolygon(x1, y1, x2, y2, size) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const back = ang + Math.PI;
  const p1x = x2 + size * Math.cos(back - 0.4), p1y = y2 + size * Math.sin(back - 0.4);
  const p2x = x2 + size * Math.cos(back + 0.4), p2y = y2 + size * Math.sin(back + 0.4);
  return `<polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${p1x.toFixed(1)},${p1y.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)}" fill="#000000"/>`;
}

// A white stroke painted UNDER the glyphs (paint-order) keeps annotation
// text readable where it lands on top of grid lines or a drawn shape.
function annotText(x, y, text, anchor) {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="11" fill="#000000"`
    + ` stroke="#ffffff" stroke-width="3" paint-order="stroke"`
    + ` text-anchor="${anchor || 'middle'}">${escText(text)}</text>`;
}

function applyAnnotations(svg, params) {
  const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!vb) return svg;
  const W = parseFloat(vb[1]), H = parseFloat(vb[2]);
  const toX = (pct) => (pct / 100) * W;
  const toY = (pct) => (pct / 100) * H;
  let extra = '';

  parseAnnotPoints(params.teks).forEach((a) => {
    if (a.text) extra += annotText(toX(a.x), toY(a.y), a.text);
  });

  parseAnnotSegments(params.panah).forEach((a) => {
    const x1 = toX(a.x1), y1 = toY(a.y1), x2 = toX(a.x2), y2 = toY(a.y2);
    extra += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#000000" stroke-width="1.6"/>`;
    extra += arrowHeadPolygon(x1, y1, x2, y2, 8);
    // The label sits at the arrow's TAIL, so it never covers whatever the
    // arrow is pointing at.
    if (a.text) extra += annotText(x1, y1 - 6, a.text);
  });

  parseAnnotSegments(params.ukuran).forEach((a) => {
    const x1 = toX(a.x1), y1 = toY(a.y1), x2 = toX(a.x2), y2 = toY(a.y2);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    // End ticks run perpendicular to the measured line, the way a
    // dimension line is drawn on an engineering/geometry figure.
    const tx = 5 * Math.cos(ang + Math.PI / 2), ty = 5 * Math.sin(ang + Math.PI / 2);
    extra += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#000000" stroke-width="1.2"/>`;
    [[x1, y1], [x2, y2]].forEach(([cx, cy]) => {
      extra += `<line x1="${(cx - tx).toFixed(1)}" y1="${(cy - ty).toFixed(1)}" x2="${(cx + tx).toFixed(1)}" y2="${(cy + ty).toFixed(1)}" stroke="#000000" stroke-width="1.2"/>`;
    });
    if (a.text) extra += annotText((x1 + x2) / 2, (y1 + y2) / 2 - 5, a.text);
  });

  return extra ? svg.replace(/<\/svg>\s*$/, extra + '</svg>') : svg;
}

// --- Figur: numbered, captioned, multi-panel figures -------------------
// "Fig. 2.1 shows..." is how an international paper refers to its own
// artwork, and a single figure routinely holds two or three panels labelled
// (a)/(b)/(c). This wraps any number of ordinary diagram tags into one
// captioned figure, so a question can point at it by number.
let figureCounter = 0;

// Numbering is per printed sheet, not per browser session — renderNow()
// calls this before substituting the tags of each sheet, so Paket B's
// figures are "Gambar 1, 2, 3" again rather than continuing from Paket A.
function resetFigureCounter() {
  figureCounter = 0;
}

const FIGURE_PANEL_LABELS = 'abcdefgh';

function renderFigureHTML(headRaw, panelsRaw, depth) {
  const head = parseTagParams(headRaw);
  const panels = String(panelsRaw || '').split('//').map((s) => s.trim()).filter(Boolean);
  if (!panels.length) {
    return '<span style="color:#b91c1c;font-size:11px;">[figur: tidak ada panel setelah "panel="]</span>';
  }
  figureCounter++;
  const nomor = String(head.nomor != null && String(head.nomor).trim() ? head.nomor : figureCounter).trim();
  const multi = panels.length > 1;
  const body = panels.map((panel, i) => {
    const label = multi ? `<div class="ws-figure-panel-label">(${FIGURE_PANEL_LABELS[i] || i + 1})</div>` : '';
    return `<div class="ws-figure-panel">${renderDiagramTag(panel, depth + 1)}${label}</div>`;
  }).join('');
  const judul = head.judul ? ' — ' + escText(head.judul) : '';
  return `<figure class="ws-figure">`
    + `<div class="ws-figure-panels">${body}</div>`
    + `<figcaption class="ws-figure-caption">Gambar ${escText(nomor)}${judul}</figcaption>`
    + `</figure>`;
}

// --- Ruang jawab: blank graph paper, blank tables, ruled lines ---------
// Everything else in this file draws the ANSWER. These three draw the
// space a student writes the answer INTO — plotting a line of best fit,
// filling in a results table, writing out a derivation — which is where a
// large share of the marks live on an international paper.

// Pre-plotted points for graph paper: "1:3, 2:7, 4:12" (optionally
// "4:12:P" to label one).
function parseXYList(raw) {
  return String(raw || '').split(',').map((s) => s.trim()).filter(Boolean).map((chunk) => {
    const parts = chunk.split(':').map((x) => x.trim());
    return { x: numOrDefault(parts[0], 0), y: numOrDefault(parts[1], 0), label: parts[2] || '' };
  });
}

function renderGraphPaperSVG(cfg) {
  const width = 420, pad = 46;
  const xmin = numOrDefault(cfg.xmin, 0), xmax = numOrDefault(cfg.xmax, 10);
  const ymin = numOrDefault(cfg.ymin, 0), ymax = numOrDefault(cfg.ymax, 10);
  const spanX = (xmax - xmin) || 1, spanY = (ymax - ymin) || 1;
  const majorX = Math.abs(numOrDefault(cfg.kotak, niceStep(spanX))) || 1;
  // With no explicit y-square given, the y axis picks its OWN nice step
  // rather than reusing the x one — a 0..10 by 0..200 grid ruled in steps
  // of 1 on both axes would be 200 squares tall and unusable. Reusing the
  // x step is only the right default when the author asked for a specific
  // square size (cfg.kotak), where they clearly want true squares.
  const majorY = Math.abs(numOrDefault(cfg.kotaky, cfg.kotak != null ? majorX : niceStep(spanY))) || 1;
  // Minor squares per major square — 5 is the standard 2 mm/1 cm ruling of
  // real graph paper, and it's what a "read off the graph" question assumes.
  const minorDiv = Math.max(1, Math.min(10, Math.round(numOrDefault(cfg.subkotak, 5))));
  // Keep the drawing area's aspect close to the data's own so a square in
  // data units still looks square on paper.
  const plotW = width - 2 * pad;
  const plotH = Math.max(180, Math.min(420, Math.round(plotW * (spanY / majorY) / (spanX / majorX))));
  const titleH = cfg.judul ? 20 : 0;
  const height = plotH + 2 * pad + titleH;
  const top = pad + titleH;
  const toPx = (x, y) => [pad + ((x - xmin) / spanX) * plotW, top + plotH - ((y - ymin) / spanY) * plotH];

  let svg = `<svg class="ws-diagram-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ffffff" stroke="#d8dce1"/>`;
  if (cfg.judul) {
    svg += `<text x="${(width / 2).toFixed(1)}" y="18" text-anchor="middle" font-size="12" font-weight="700" fill="#000000">${escText(cfg.judul)}</text>`;
  }

  // Minor ruling first, major ruling over it, so the heavier lines win
  // wherever the two coincide.
  const minorStepX = majorX / minorDiv, minorStepY = majorY / minorDiv;
  const startX = Math.ceil(xmin / minorStepX) * minorStepX;
  for (let gx = startX; gx <= xmax + 1e-9; gx += minorStepX) {
    const [px] = toPx(gx, ymin);
    svg += `<line x1="${px.toFixed(1)}" y1="${top}" x2="${px.toFixed(1)}" y2="${top + plotH}" stroke="#e5e9ef" stroke-width="0.5"/>`;
  }
  const startY = Math.ceil(ymin / minorStepY) * minorStepY;
  for (let gy = startY; gy <= ymax + 1e-9; gy += minorStepY) {
    const [, py] = toPx(xmin, gy);
    svg += `<line x1="${pad}" y1="${py.toFixed(1)}" x2="${(width - pad).toFixed(1)}" y2="${py.toFixed(1)}" stroke="#e5e9ef" stroke-width="0.5"/>`;
  }
  for (let gx = Math.ceil(xmin / majorX) * majorX; gx <= xmax + 1e-9; gx += majorX) {
    const [px] = toPx(gx, ymin);
    svg += `<line x1="${px.toFixed(1)}" y1="${top}" x2="${px.toFixed(1)}" y2="${top + plotH}" stroke="#b8c0cc" stroke-width="0.9"/>`;
    svg += `<text x="${px.toFixed(1)}" y="${(top + plotH + 14).toFixed(1)}" font-size="9.5" text-anchor="middle" fill="#334155">${formatTick(gx)}</text>`;
  }
  for (let gy = Math.ceil(ymin / majorY) * majorY; gy <= ymax + 1e-9; gy += majorY) {
    const [, py] = toPx(xmin, gy);
    svg += `<line x1="${pad}" y1="${py.toFixed(1)}" x2="${(width - pad).toFixed(1)}" y2="${py.toFixed(1)}" stroke="#b8c0cc" stroke-width="0.9"/>`;
    svg += `<text x="${(pad - 6).toFixed(1)}" y="${(py + 3.5).toFixed(1)}" font-size="9.5" text-anchor="end" fill="#334155">${formatTick(gy)}</text>`;
  }

  // Axes drawn last and heaviest — this is the frame a student measures from.
  svg += `<rect x="${pad}" y="${top}" width="${plotW}" height="${plotH}" fill="none" stroke="#000000" stroke-width="1.4"/>`;

  // "Besaran / satuan" axis captions are worth marks in their own right on
  // a practical paper, so they get real space rather than being optional
  // decoration squeezed into the margin.
  if (cfg.sumbux) {
    svg += `<text x="${(width / 2).toFixed(1)}" y="${(height - 10).toFixed(1)}" text-anchor="middle" font-size="11" fill="#000000">${escText(cfg.sumbux)}</text>`;
  }
  if (cfg.sumbuy) {
    const cy = top + plotH / 2;
    svg += `<text x="14" y="${cy.toFixed(1)}" text-anchor="middle" font-size="11" fill="#000000" transform="rotate(-90 14 ${cy.toFixed(1)})">${escText(cfg.sumbuy)}</text>`;
  }

  parseXYList(cfg.titik).forEach((p) => {
    const [px, py] = toPx(p.x, p.y);
    // A cross, not a dot: that's the plotting convention every exam board
    // marks against, and it stays readable on top of the ruling.
    svg += `<line x1="${(px - 4).toFixed(1)}" y1="${(py - 4).toFixed(1)}" x2="${(px + 4).toFixed(1)}" y2="${(py + 4).toFixed(1)}" stroke="#000000" stroke-width="1.4"/>`;
    svg += `<line x1="${(px - 4).toFixed(1)}" y1="${(py + 4).toFixed(1)}" x2="${(px + 4).toFixed(1)}" y2="${(py - 4).toFixed(1)}" stroke="#000000" stroke-width="1.4"/>`;
    if (p.label) svg += annotText(px + 12, py - 6, p.label);
  });

  svg += '</svg>';
  return svg;
}

function renderBlankTableHTML(cfg) {
  const headers = pisahKolom(String(cfg.header || ''));
  const rowCount = Math.max(1, Math.min(30, Math.round(numOrDefault(cfg.baris, 5))));
  const cols = Math.max(1, headers.length || Math.round(numOrDefault(cfg.kolom, 2)));
  const rowH = Math.max(10, Math.min(40, numOrDefault(cfg.tinggi, 20)));
  let html = '';
  if (cfg.judul) html += `<div class="ws-table-title">${escText(cfg.judul)}</div>`;
  html += '<table class="ws-table ws-table-blank">';
  if (headers.length) {
    html += '<thead><tr>' + headers.map((h) => `<th>${escText(h)}</th>`).join('') + '</tr></thead>';
  }
  html += '<tbody>';
  for (let r = 0; r < rowCount; r++) {
    html += `<tr style="height:${rowH}pt">` + new Array(cols).fill('<td></td>').join('') + '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function renderAnswerLinesHTML(cfg) {
  const count = Math.max(1, Math.min(40, Math.round(numOrDefault(cfg.baris, 4))));
  const gap = Math.max(10, Math.min(40, numOrDefault(cfg.spasi, 18)));
  let html = '<div class="ws-answer-lines">';
  if (cfg.judul) html += `<div class="ws-answer-lines-title">${escText(cfg.judul)}</div>`;
  for (let i = 0; i < count; i++) {
    html += `<div class="ws-answer-line" style="height:${gap}pt"></div>`;
  }
  html += '</div>';
  return html;
}

// ---------------------------------------------------------------------
// 8. Tag syntax: [[type: key=value; key2=value2]]
// ---------------------------------------------------------------------

const DIAGRAM_TYPE_ALIASES = {
  grafik: 'grafik', fungsi: 'grafik',
  programlinear: 'programlinear', linearprogram: 'programlinear',
  bangun: 'bangun', geometri: 'bangun',
  garisbilangan: 'garisbilangan',
  venn: 'venn',
  statistik: 'statistik', stat: 'statistik',
  pohonfaktor: 'pohonfaktor', faktor: 'pohonfaktor',
  pembagian: 'pembagian', pembagianbersusun: 'pembagian', bersusun: 'pembagian',
  tabel: 'tabel', table: 'tabel',
  piktogram: 'piktogram', piktograf: 'piktogram',
  bangunruang: 'bangunruang', ruang: 'bangunruang',
  sudut: 'sudut', angle: 'sudut',
  lewis: 'lewis', strukturlewis: 'lewis',
  hidrokarbon: 'hidrokarbon', rantaikarbon: 'hidrokarbon',
  gaya: 'gaya', dinamika: 'gaya', newton: 'gaya',
  rangkaian: 'rangkaian', rangkaianlistrik: 'rangkaian', circuit: 'rangkaian',
  rantaimakanan: 'rantaimakanan', foodchain: 'rantaimakanan',
  bentukmolekul: 'bentukmolekul', vsepr: 'bentukmolekul', molekul: 'bentukmolekul',
  tingkatenergi: 'tingkatenergi', energilevel: 'tingkatenergi', diagramenergi: 'tingkatenergi',
  sel: 'sel', selhewan: 'sel', seltumbuhan: 'sel',
  transformasi: 'transformasi', transformation: 'transformasi',
  pohonpeluang: 'pohonpeluang', treediagram: 'pohonpeluang', peluang: 'pohonpeluang',
  vektor: 'vektor', vector: 'vektor',
  bearing: 'bearing', arahmataangin: 'bearing',
  ogive: 'ogive', frekuensikumulatif: 'ogive',
  boxplot: 'boxplot', kotakgaris: 'boxplot',
  sinar: 'sinar', raydiagram: 'sinar', lensa: 'sinar',
  gerak: 'gerak', gerakgrafik: 'gerak', kinematika: 'gerak',
  gelombang: 'gelombang', wave: 'gelombang',
  medan: 'medan', medanlistrik: 'medan', medanmagnet: 'medan', fieldline: 'medan',
  kulitelektron: 'kulitelektron', bohr: 'kulitelektron', konfigurasielektron: 'kulitelektron',
  titrasi: 'titrasi', titration: 'titrasi',
  katalis: 'katalis', catalyst: 'katalis',
  kisi: 'kisi', kristal: 'kisi', lattice: 'kisi',
  piramida: 'piramida', piramidaekologi: 'piramida', ecopyramid: 'piramida',
  punnett: 'punnett', kotakpunnett: 'punnett', persilangan: 'punnett',
  kuncideterminasi: 'kuncideterminasi', kuncidikotomi: 'kuncideterminasi', dichotomouskey: 'kuncideterminasi',
  jaringmakanan: 'jaringmakanan', foodweb: 'jaringmakanan', jaringjaringmakanan: 'jaringmakanan',
  lingkaranteorema: 'lingkaranteorema', teoremalingkaran: 'lingkaranteorema', circletheorem: 'lingkaranteorema',
  jaring: 'jaring', jaringjaring: 'jaring', net: 'jaring',
  pandangan: 'pandangan', tampak: 'pandangan', proyeksi: 'pandangan',
  alatlab: 'alatlab', labware: 'alatlab', peralatan: 'alatlab', percobaan: 'alatlab',
  pencar: 'pencar', scatter: 'pencar', diagrampencar: 'pencar',
  histogram: 'histogram', densitasfrekuensi: 'histogram',
  batangdaun: 'batangdaun', stemleaf: 'batangdaun', batangdan_daun: 'batangdaun',
  gambar: 'gambar', foto: 'gambar', image: 'gambar',
  figur: 'figur', figure: 'figur', panel: 'figur',
  kertasgrafik: 'kertasgrafik', graphpaper: 'kertasgrafik', gridkosong: 'kertasgrafik',
  tabelkosong: 'tabelkosong', blanktable: 'tabelkosong',
  garisjawab: 'garisjawab', answerlines: 'garisjawab', barisjawab: 'garisjawab',
};

function parseTagParams(raw) {
  const params = {};
  String(raw || '').split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) params[key] = val;
  });
  return params;
}

function parseTitikList(raw) {
  if (!raw) return [];
  return String(raw).split(',').map((s) => s.trim()).filter(Boolean).map((pair) => {
    const [v, label] = pair.split(':').map((x) => (x || '').trim());
    return { value: parseFloat(v) || 0, label: label || '' };
  });
}

function renderDiagramTag(rawTagContent, depth) {
  depth = depth || 0;
  const colonIdx = rawTagContent.indexOf(':');
  const typeRaw = (colonIdx > -1 ? rawTagContent.slice(0, colonIdx) : rawTagContent).trim().toLowerCase();
  const paramsRaw = colonIdx > -1 ? rawTagContent.slice(colonIdx + 1) : '';
  const type = DIAGRAM_TYPE_ALIASES[typeRaw];
  if (!type) return `<span style="color:#b91c1c;font-size:11px;">[diagram tidak dikenali: "${escText(typeRaw)}"]</span>`;

  // "figur" is handled before the generic "key=value;" parse, because its
  // "panel=" value holds whole diagram tags of its own — semicolons and
  // all — which parseTagParams would otherwise chop into nonsense at the
  // first ";". Everything after "panel=" is therefore taken verbatim, which
  // is why panel must be the LAST parameter of a figur tag.
  if (type === 'figur') {
    if (depth > 0) {
      return '<span style="color:#b91c1c;font-size:11px;">[figur tidak boleh ditaruh di dalam figur lain]</span>';
    }
    const m = paramsRaw.match(/(?:^|;)\s*panel\s*=/);
    if (!m) {
      return '<span style="color:#b91c1c;font-size:11px;">[figur: parameter "panel=" wajib ada, dan harus jadi parameter terakhir]</span>';
    }
    const cut = paramsRaw.indexOf(m[0]);
    return renderFigureHTML(paramsRaw.slice(0, cut), paramsRaw.slice(cut + m[0].length), depth);
  }

  const params = parseTagParams(paramsRaw);
  // "lebar" (width, in pt) is accepted on every diagram/table type to make
  // it bigger/smaller on the page; height follows automatically (SVGs keep
  // their own aspect ratio via viewBox; a table just wraps at that width).
  //
  // PATCH EXACTSEARCH (hilang bila wsm/ disinkronkan ulang lewat
  // perbarui-mesin.sh): dua jenis memakai "lebar" sebagai UKURAN BENDA, bukan
  // ukuran tampilan — balok (bangunruang) dan persegipanjang (bangun). Untuk
  // "[[bangunruang: bentuk=balok; panjang=12; lebar=9; tinggi=8]]" lebar 9 itu
  // 9 cm, tapi dibaca sebagai 9pt sehingga gambarnya tercetak 12 piksel: nyaris
  // tak terlihat, dan tidak ada pesan galat apa pun. Untuk kedua jenis itu
  // lebar tampilan harus ditulis "lebargambar".
  const LEBAR_ADALAH_UKURAN = { bangunruang: 1, ruang: 1, bangun: 1 };
  const lebarTampilan = params.lebargambar
    || (LEBAR_ADALAH_UKURAN[type] ? null : params.lebar);
  const widthPt = lebarTampilan ? numOrDefault(lebarTampilan, 260) : null;
  const widthStyle = widthPt ? ` style="max-width:${widthPt}pt"` : '';

  // HTML-rendered types (tables, imported pictures, ruled answer space) —
  // everything below this block builds an <svg> instead.
  const HTML_RENDERERS = {
    tabel: renderTableHTML,
    tabelkosong: renderBlankTableHTML,
    garisjawab: renderAnswerLinesHTML
  };
  if (HTML_RENDERERS[type]) {
    try {
      return `<div class="ws-table-wrap"${widthStyle}>${HTML_RENDERERS[type](params)}</div>`;
    } catch (err) {
      return `<span style="color:#b91c1c;font-size:11px;">[diagram error: ${escText(err.message)}]</span>`;
    }
  }

  if (type === 'gambar') {
    try {
      return `<div class="ws-diagram"${widthStyle}>${renderImageHTML(params)}</div>`;
    } catch (err) {
      return `<span style="color:#b91c1c;font-size:11px;">[gambar error: ${escText(err.message)}]</span>`;
    }
  }

  let svg = '';
  try {
    if (type === 'grafik') svg = renderFunctionGraphSVG(params);
    else if (type === 'programlinear') svg = renderLinearProgramSVG(params);
    else if (type === 'bangun') svg = renderGeometrySVG(params);
    else if (type === 'garisbilangan') { params.titik = parseTitikList(params.titik); svg = renderNumberLineSVG(params); }
    else if (type === 'venn') svg = renderVennSVG(params);
    else if (type === 'statistik') svg = renderStatSVG(params);
    else if (type === 'pohonfaktor') svg = renderFactorTreeSVG(params);
    else if (type === 'pembagian') svg = renderLongDivisionSVG(params);
    else if (type === 'piktogram') svg = renderPictogramSVG(params);
    else if (type === 'bangunruang') svg = renderSolidSVG(params);
    else if (type === 'sudut') svg = renderAngleSVG(params);
    else if (type === 'lewis') svg = renderLewisSVG(params);
    else if (type === 'hidrokarbon') svg = renderHydrocarbonSVG(params);
    else if (type === 'gaya') svg = renderForceDiagramSVG(params);
    else if (type === 'rangkaian') svg = renderCircuitSVG(params);
    else if (type === 'rantaimakanan') svg = renderFoodChainSVG(params);
    else if (type === 'bentukmolekul') svg = renderMoleculeShapeSVG(params);
    else if (type === 'tingkatenergi') svg = renderEnergyLevelSVG(params);
    else if (type === 'sel') svg = renderCellSVG(params);
    else if (type === 'transformasi') svg = renderTransformSVG(params);
    else if (type === 'pohonpeluang') svg = renderProbTreeSVG(params);
    else if (type === 'vektor') svg = renderVectorSVG(params);
    else if (type === 'bearing') svg = renderBearingSVG(params);
    else if (type === 'ogive') svg = renderOgiveSVG(params);
    else if (type === 'boxplot') svg = renderBoxplotSVG(params);
    else if (type === 'sinar') svg = renderRaySVG(params);
    else if (type === 'gerak') svg = renderKinematicsSVG(params);
    else if (type === 'gelombang') svg = renderWaveSVG(params);
    else if (type === 'medan') svg = renderFieldSVG(params);
    else if (type === 'kulitelektron') svg = renderElectronShellSVG(params);
    else if (type === 'titrasi') svg = renderTitrationSVG(params);
    else if (type === 'katalis') svg = renderCatalystSVG(params);
    else if (type === 'kisi') svg = renderLatticeSVG(params);
    else if (type === 'piramida') svg = renderEcoPyramidSVG(params);
    else if (type === 'kertasgrafik') svg = renderGraphPaperSVG(params);
    else if (type === 'alatlab') svg = renderLabApparatusSVG(params);
    else if (type === 'punnett') svg = renderPunnettSVG(params);
    else if (type === 'kuncideterminasi') svg = renderDichotomousKeySVG(params);
    else if (type === 'jaringmakanan') svg = renderFoodWebSVG(params);
    else if (type === 'lingkaranteorema') svg = renderCircleTheoremSVG(params);
    else if (type === 'jaring') svg = renderNetSVG(params);
    else if (type === 'pandangan') svg = renderViewsSVG(params);
    else if (type === 'pencar') svg = renderScatterSVG(params);
    else if (type === 'histogram') svg = renderHistogramSVG(params);
    else if (type === 'batangdaun') svg = renderStemLeafSVG(params);
    // Labels, arrows and dimension lines the author placed by hand, drawn
    // over whichever diagram was just built (see applyAnnotations).
    if (svg && hasAnnotations(params)) svg = applyAnnotations(svg, params);
  } catch (err) {
    return `<span style="color:#b91c1c;font-size:11px;">[diagram error: ${escText(err.message)}]</span>`;
  }
  // An inline style beats style.css's own max-width rule regardless of
  // specificity, so this is the one place that needs to touch the <svg> tag.
  if (widthPt) {
    svg = svg.replace('class="ws-diagram-svg"', `class="ws-diagram-svg" style="max-width:${widthPt}pt"`);
  }
  return `<div class="ws-diagram">${svg}</div>`;
}

const DIAGRAM_TOKEN_OPEN = 'DG';
const DIAGRAM_TOKEN_CLOSE = '';

function extractDiagramTags(text) {
  const tags = [];
  const replaced = String(text || '').replace(/\[\[([\s\S]*?)\]\]/g, (match, inner) => {
    const idx = tags.length;
    tags.push(inner.trim());
    return DIAGRAM_TOKEN_OPEN + idx + DIAGRAM_TOKEN_CLOSE;
  });
  return { text: replaced, tags };
}

function substituteDiagramTokens(html, tags) {
  const re = new RegExp(DIAGRAM_TOKEN_OPEN + '(\\d+)' + DIAGRAM_TOKEN_CLOSE, 'g');
  return html.replace(re, (m, i) => renderDiagramTag(tags[Number(i)] || ''));
}

// Export for Node-based testing (no-op in browser).
if (typeof module !== 'undefined') {
  module.exports = {
    compileExpr, renderFunctionGraphSVG, renderGeometrySVG, renderNumberLineSVG,
    renderVennSVG, renderStatSVG, renderFactorTreeSVG, renderTableHTML,
    renderPictogramSVG, renderSolidSVG, renderAngleSVG, renderLewisSVG,
    renderHydrocarbonSVG, renderForceDiagramSVG, renderFoodChainSVG, renderDiagramTag,
    renderMoleculeShapeSVG, renderCellSVG,
    renderGraphPaperSVG, renderBlankTableHTML, renderAnswerLinesHTML,
    renderScatterSVG, renderHistogramSVG, renderStemLeafSVG, leastSquaresFit,
    componentSVG, parseCircuitComponent, CIRCUIT_KINDS,
    renderLabApparatusSVG, LAB_APPARATUS,
    renderCircleTheoremSVG, renderNetSVG, renderViewsSVG, CIRCLE_THEOREMS, SOLID_NETS, SOLID_VIEWS,
    renderPunnettSVG, renderDichotomousKeySVG, renderFoodWebSVG, splitGenotype, gametesOf, combineGametes, phenotypeOf,
    renderFigureHTML, renderImageHTML, setImageResolver, resetFigureCounter, applyAnnotations,
    extractDiagramTags, substituteDiagramTokens, GEOMETRY_PRESETS, SOLID_PRESETS, LEWIS_PRESETS, VSEPR_PRESETS,
  };
}
