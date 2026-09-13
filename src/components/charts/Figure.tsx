"use client";
import { useId, useMemo } from "react";
import { compile, makeSolver } from "@/lib/mathexpr";
import type {
  BarChart, BoxPlot, CircuitFigure, Figure, FunctionPlot, GeometryFigure,
  Histogram, ImageFigure, LineChart, NumberLine, PieChart, ScatterPlot, TableFigure,
} from "@/lib/types";

/* Palet seri — dipilih agar tetap terbaca di tema terang maupun gelap. */
const PALETTE = ["#3b7ddd", "#e0803e", "#2f9e73", "#b3559b", "#c4443c", "#7a68d4", "#2f8fa8", "#8a8f2f"];
const AXIS = "var(--fg-muted)";
const INK = "var(--fg)";
const GRID = "var(--border)";

export function FigureView({ figure, maxWidth = 560 }: { figure: Figure; maxWidth?: number }) {
  const body = renderFigure(figure, maxWidth);
  return (
    <figure className="my-4" role="img" aria-label={figure.alt}>
      <div className="overflow-x-auto">{body}</div>
      {figure.caption && (
        <figcaption className="mt-2 text-xs muted">{figure.caption}</figcaption>
      )}
    </figure>
  );
}

function renderFigure(f: Figure, maxWidth: number) {
  switch (f.kind) {
    case "function_plot": return <FunctionPlotView f={f} w={f.width ?? maxWidth} />;
    case "scatter": return <ScatterView f={f} w={f.width ?? maxWidth} />;
    case "bar_chart": return <BarView f={f} w={f.width ?? maxWidth} />;
    case "line_chart": return <LineView f={f} w={f.width ?? maxWidth} />;
    case "histogram": return <HistogramView f={f} w={f.width ?? maxWidth} />;
    case "pie_chart": return <PieView f={f} w={Math.min(f.width ?? maxWidth, 360)} />;
    case "box_plot": return <BoxView f={f} w={f.width ?? maxWidth} />;
    case "number_line": return <NumberLineView f={f} w={f.width ?? maxWidth} />;
    case "geometry": return <GeometryView f={f} w={f.width ?? maxWidth} />;
    case "table": return <TableView f={f} />;
    case "circuit": return <CircuitView f={f} w={f.width ?? maxWidth} />;
    case "image": return <ImageView f={f} w={f.width ?? maxWidth} />;
    default: return null;
  }
}

/* ------------------------------- helpers -------------------------------- */

const nice = (v: number) => (Math.abs(v) < 1e-9 ? "0" : String(Math.round(v * 1000) / 1000));

function axisTicks(min: number, max: number, target = 8) {
  const span = max - min;
  if (span <= 0) return [min];
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1e9) / 1e9);
  return out;
}

/* --------------------------- function plot ------------------------------ */

function FunctionPlotView({ f, w }: { f: FunctionPlot; w: number }) {
  const H = f.height ?? Math.round(w * 0.78);
  const pad = { l: 40, r: 16, t: 16, b: 34 };
  const { xmin, xmax, ymin, ymax } = f.window;
  const sx = (x: number) => pad.l + ((x - xmin) / (xmax - xmin)) * (w - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - ymin) / (ymax - ymin)) * (H - pad.t - pad.b);

  // Setiap seri boleh berupa ekspresi biasa, "y = ...", atau persamaan penuh
  // seperti "3x + 2y = 19" dan "x^2 + y^2 = 25".
  const paths = useMemo(
    () =>
      f.series.map((s) => {
        const solver = makeSolver(s.expr);
        if (!solver.ok) return "";
        const [a, b] = s.domain ?? [xmin, xmax];
        const branches = solver.branches({ xmin: a, xmax: b, ymin, ymax });
        return branches
          .map((line) =>
            line
              .map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(2)},${sy(y).toFixed(2)}`)
              .join(""),
          )
          .join(" ");
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f],
  );

  const xt = axisTicks(xmin, xmax);
  const yt = axisTicks(ymin, ymax);

  return (
    <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="max-w-full">
      {f.grid !== false && (
        <g stroke={GRID} strokeWidth={1}>
          {xt.map((t) => <line key={"gx" + t} x1={sx(t)} y1={pad.t} x2={sx(t)} y2={H - pad.b} />)}
          {yt.map((t) => <line key={"gy" + t} x1={pad.l} y1={sy(t)} x2={w - pad.r} y2={sy(t)} />)}
        </g>
      )}
      {/* sumbu */}
      <g stroke={AXIS} strokeWidth={1.6}>
        {ymin <= 0 && ymax >= 0 && <line x1={pad.l} y1={sy(0)} x2={w - pad.r} y2={sy(0)} />}
        {xmin <= 0 && xmax >= 0 && <line x1={sx(0)} y1={pad.t} x2={sx(0)} y2={H - pad.b} />}
      </g>
      <g fill={AXIS} fontSize={10} textAnchor="middle">
        {xt.filter((t) => Math.abs(t) > 1e-9).map((t) => (
          <text key={"tx" + t} x={sx(t)} y={Math.min(H - pad.b + 13, sy(0) + 13)}>{nice(t)}</text>
        ))}
      </g>
      <g fill={AXIS} fontSize={10} textAnchor="end">
        {yt.filter((t) => Math.abs(t) > 1e-9).map((t) => (
          <text key={"ty" + t} x={Math.max(pad.l - 6, sx(0) - 6)} y={sy(t) + 3.5}>{nice(t)}</text>
        ))}
      </g>
      {f.asymptotes?.map((a, i) => (
        <line
          key={"as" + i}
          x1={a.axis === "x" ? sx(a.at) : pad.l} y1={a.axis === "x" ? pad.t : sy(a.at)}
          x2={a.axis === "x" ? sx(a.at) : w - pad.r} y2={a.axis === "x" ? H - pad.b : sy(a.at)}
          stroke={AXIS} strokeDasharray="5 4" strokeWidth={1.2}
        />
      ))}
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={f.series[i].color ?? PALETTE[i % PALETTE.length]}
          strokeWidth={2.2} strokeDasharray={f.series[i].dashed ? "6 4" : undefined} strokeLinecap="round" />
      ))}
      {f.points?.map((p, i) => (
        <g key={"p" + i}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r={4.5} fill={p.open ? "var(--bg-elev)" : INK} stroke={INK} strokeWidth={1.8} />
          {p.label && <text x={sx(p.x) + 8} y={sy(p.y) - 8} fontSize={11} fill={INK}>{p.label}</text>}
        </g>
      ))}
      {f.xLabel && <text x={(w + pad.l) / 2} y={H - 4} fontSize={11} fill={AXIS} textAnchor="middle">{f.xLabel}</text>}
      {f.yLabel && <text transform={`rotate(-90 12 ${H / 2})`} x={12} y={H / 2} fontSize={11} fill={AXIS} textAnchor="middle">{f.yLabel}</text>}
      {f.series.length > 1 && (
        <g>
          {f.series.map((s, i) => s.label && (
            <g key={"l" + i} transform={`translate(${w - pad.r - 110},${pad.t + 4 + i * 16})`}>
              <line x1={0} y1={0} x2={18} y2={0} stroke={s.color ?? PALETTE[i % PALETTE.length]} strokeWidth={2.4} />
              <text x={24} y={3.5} fontSize={11} fill={INK}>{s.label}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

/* ------------------------------- scatter -------------------------------- */

function ScatterView({ f, w }: { f: ScatterPlot; w: number }) {
  const H = f.height ?? Math.round(w * 0.72);
  const pad = { l: 44, r: 16, t: 16, b: 38 };
  const xs = f.points.map((p) => p.x), ys = f.points.map((p) => p.y);
  const win = f.window ?? {
    xmin: Math.min(...xs, 0), xmax: Math.max(...xs) * 1.08,
    ymin: Math.min(...ys, 0), ymax: Math.max(...ys) * 1.08,
  };
  const sx = (x: number) => pad.l + ((x - win.xmin) / (win.xmax - win.xmin)) * (w - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - win.ymin) / (win.ymax - win.ymin)) * (H - pad.t - pad.b);
  const xt = axisTicks(win.xmin, win.xmax, 7), yt = axisTicks(win.ymin, win.ymax, 6);
  const trend = f.trendline ? compile(f.trendline.expr) : null;

  return (
    <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="max-w-full">
      <g stroke={GRID}>
        {yt.map((t) => <line key={t} x1={pad.l} y1={sy(t)} x2={w - pad.r} y2={sy(t)} />)}
      </g>
      <line x1={pad.l} y1={H - pad.b} x2={w - pad.r} y2={H - pad.b} stroke={AXIS} strokeWidth={1.4} />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke={AXIS} strokeWidth={1.4} />
      <g fill={AXIS} fontSize={10}>
        {xt.map((t) => <text key={t} x={sx(t)} y={H - pad.b + 14} textAnchor="middle">{nice(t)}</text>)}
        {yt.map((t) => <text key={t} x={pad.l - 6} y={sy(t) + 3.5} textAnchor="end">{nice(t)}</text>)}
      </g>
      {trend && (
        <path
          d={Array.from({ length: 100 }, (_, i) => {
            const x = win.xmin + ((win.xmax - win.xmin) * i) / 99;
            return `${i ? "L" : "M"}${sx(x).toFixed(2)},${sy(trend(x)).toFixed(2)}`;
          }).join("")}
          fill="none" stroke={PALETTE[1]} strokeWidth={2} strokeDasharray="6 4"
        />
      )}
      {f.points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={4} fill={PALETTE[0]} fillOpacity={0.85} />
      ))}
      {f.xLabel && <text x={(w + pad.l) / 2} y={H - 4} fontSize={11} fill={AXIS} textAnchor="middle">{f.xLabel}</text>}
      {f.yLabel && <text transform={`rotate(-90 12 ${H / 2})`} x={12} y={H / 2} fontSize={11} fill={AXIS} textAnchor="middle">{f.yLabel}</text>}
    </svg>
  );
}

/* --------------------------------- bar ---------------------------------- */

function BarView({ f, w }: { f: BarChart; w: number }) {
  const H = f.height ?? Math.round(w * 0.66);
  const pad = { l: 46, r: 16, t: 18, b: 46 };
  const maxV = f.stacked
    ? Math.max(...f.categories.map((_, i) => f.series.reduce((a, s) => a + (s.values[i] ?? 0), 0)))
    : Math.max(...f.series.flatMap((s) => s.values));
  const top = maxV * 1.12 || 1;
  const iw = (w - pad.l - pad.r) / f.categories.length;
  const bw = f.stacked ? iw * 0.55 : (iw * 0.7) / f.series.length;
  const sy = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const yt = axisTicks(0, top, 5);

  return (
    <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="max-w-full">
      <g stroke={GRID}>{yt.map((t) => <line key={t} x1={pad.l} y1={sy(t)} x2={w - pad.r} y2={sy(t)} />)}</g>
      <g fill={AXIS} fontSize={10} textAnchor="end">
        {yt.map((t) => <text key={t} x={pad.l - 6} y={sy(t) + 3.5}>{nice(t)}</text>)}
      </g>
      {f.categories.map((c, ci) => {
        let acc = 0;
        return (
          <g key={c}>
            {f.series.map((s, si) => {
              const v = s.values[ci] ?? 0;
              const x = f.stacked
                ? pad.l + ci * iw + (iw - bw) / 2
                : pad.l + ci * iw + iw * 0.15 + si * bw;
              const y = f.stacked ? sy(acc + v) : sy(v);
              const h = Math.max(0, (H - pad.t - pad.b) * (v / top));
              if (f.stacked) acc += v;
              return <rect key={si} x={x} y={y} width={bw - 2} height={h} rx={3}
                fill={s.color ?? PALETTE[si % PALETTE.length]} />;
            })}
            <text x={pad.l + ci * iw + iw / 2} y={H - pad.b + 15} fontSize={10} fill={AXIS} textAnchor="middle">{c}</text>
          </g>
        );
      })}
      <line x1={pad.l} y1={H - pad.b} x2={w - pad.r} y2={H - pad.b} stroke={AXIS} strokeWidth={1.4} />
      {f.series.length > 1 && (
        <g transform={`translate(${pad.l},${H - 12})`}>
          {f.series.map((s, i) => (
            <g key={s.name} transform={`translate(${i * 110},0)`}>
              <rect width={11} height={11} y={-9} rx={2} fill={s.color ?? PALETTE[i % PALETTE.length]} />
              <text x={16} fontSize={10.5} fill={INK}>{s.name}</text>
            </g>
          ))}
        </g>
      )}
      {f.yLabel && <text transform={`rotate(-90 12 ${H / 2})`} x={12} y={H / 2} fontSize={11} fill={AXIS} textAnchor="middle">{f.yLabel}</text>}
    </svg>
  );
}

/* -------------------------------- line ---------------------------------- */

function LineView({ f, w }: { f: LineChart; w: number }) {
  const H = f.height ?? Math.round(w * 0.62);
  const pad = { l: 46, r: 16, t: 18, b: 44 };
  const all = f.series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const lo = Math.min(...all, 0), hi = Math.max(...all) * 1.1 || 1;
  const sx = (i: number) => pad.l + (i / Math.max(1, f.categories.length - 1)) * (w - pad.l - pad.r);
  const sy = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const yt = axisTicks(lo, hi, 5);

  return (
    <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="max-w-full">
      <g stroke={GRID}>{yt.map((t) => <line key={t} x1={pad.l} y1={sy(t)} x2={w - pad.r} y2={sy(t)} />)}</g>
      <g fill={AXIS} fontSize={10}>
        {yt.map((t) => <text key={t} x={pad.l - 6} y={sy(t) + 3.5} textAnchor="end">{nice(t)}</text>)}
        {f.categories.map((c, i) => <text key={i} x={sx(i)} y={H - pad.b + 15} textAnchor="middle">{c}</text>)}
      </g>
      {f.series.map((s, si) => (
        <g key={s.name}>
          <path
            d={s.values.map((v, i) => (v === null ? "" : `${i === 0 || s.values[i - 1] === null ? "M" : "L"}${sx(i)},${sy(v)}`)).join("")}
            fill="none" stroke={s.color ?? PALETTE[si % PALETTE.length]} strokeWidth={2.3} strokeLinejoin="round" />
          {s.values.map((v, i) => v === null ? null : (
            <circle key={i} cx={sx(i)} cy={sy(v)} r={3.4} fill={s.color ?? PALETTE[si % PALETTE.length]} />
          ))}
        </g>
      ))}
      <line x1={pad.l} y1={H - pad.b} x2={w - pad.r} y2={H - pad.b} stroke={AXIS} strokeWidth={1.4} />
      {f.series.length > 1 && (
        <g transform={`translate(${pad.l},${H - 10})`}>
          {f.series.map((s, i) => (
            <g key={s.name} transform={`translate(${i * 110},0)`}>
              <line x1={0} x2={16} y1={-4} y2={-4} stroke={s.color ?? PALETTE[i % PALETTE.length]} strokeWidth={2.4} />
              <text x={22} fontSize={10.5} fill={INK}>{s.name}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

/* ------------------------------ histogram -------------------------------- */

function HistogramView({ f, w }: { f: Histogram; w: number }) {
  const H = f.height ?? Math.round(w * 0.62);
  const pad = { l: 44, r: 16, t: 18, b: 40 };
  const lo = Math.min(...f.bins.map((b) => b.from)), hi = Math.max(...f.bins.map((b) => b.to));
  const top = Math.max(...f.bins.map((b) => b.count)) * 1.12 || 1;
  const sx = (x: number) => pad.l + ((x - lo) / (hi - lo)) * (w - pad.l - pad.r);
  const sy = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const yt = axisTicks(0, top, 5);
  return (
    <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="max-w-full">
      <g stroke={GRID}>{yt.map((t) => <line key={t} x1={pad.l} y1={sy(t)} x2={w - pad.r} y2={sy(t)} />)}</g>
      {f.bins.map((b, i) => (
        <rect key={i} x={sx(b.from)} y={sy(b.count)} width={Math.max(1, sx(b.to) - sx(b.from) - 1)}
          height={(H - pad.t - pad.b) * (b.count / top)} fill={PALETTE[0]} fillOpacity={0.85} stroke="var(--bg-elev)" />
      ))}
      <g fill={AXIS} fontSize={10}>
        {yt.map((t) => <text key={t} x={pad.l - 6} y={sy(t) + 3.5} textAnchor="end">{nice(t)}</text>)}
        {f.bins.map((b, i) => <text key={i} x={sx(b.from)} y={H - pad.b + 14} textAnchor="middle">{nice(b.from)}</text>)}
        <text x={sx(hi)} y={H - pad.b + 14} textAnchor="middle">{nice(hi)}</text>
      </g>
      <line x1={pad.l} y1={H - pad.b} x2={w - pad.r} y2={H - pad.b} stroke={AXIS} strokeWidth={1.4} />
    </svg>
  );
}

/* --------------------------------- pie ---------------------------------- */

function PieView({ f, w }: { f: PieChart; w: number }) {
  const H = f.height ?? w * 0.72;
  const cx = H / 2 + 8, cy = H / 2, r = H / 2 - 12, ri = f.donut ? r * 0.55 : 0;
  const total = f.slices.reduce((a, s) => a + s.value, 0) || 1;
  let ang = -Math.PI / 2;
  return (
    <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="max-w-full">
      {f.slices.map((s, i) => {
        const a0 = ang, a1 = ang + (s.value / total) * Math.PI * 2;
        ang = a1;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const p = (rr: number, a: number) => `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
        const d = ri
          ? `M${p(r, a0)}A${r},${r} 0 ${large} 1 ${p(r, a1)}L${p(ri, a1)}A${ri},${ri} 0 ${large} 0 ${p(ri, a0)}Z`
          : `M${cx},${cy}L${p(r, a0)}A${r},${r} 0 ${large} 1 ${p(r, a1)}Z`;
        return <path key={i} d={d} fill={s.color ?? PALETTE[i % PALETTE.length]} stroke="var(--bg-elev)" strokeWidth={1.5} />;
      })}
      <g transform={`translate(${H + 20},20)`}>
        {f.slices.map((s, i) => (
          <g key={i} transform={`translate(0,${i * 20})`}>
            <rect width={11} height={11} rx={2} fill={s.color ?? PALETTE[i % PALETTE.length]} />
            <text x={17} y={10} fontSize={11} fill={INK}>{s.label} — {Math.round((s.value / total) * 100)}%</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ------------------------------- box plot -------------------------------- */

function BoxView({ f, w }: { f: BoxPlot; w: number }) {
  const H = f.height ?? 260;
  const pad = { l: 46, r: 16, t: 18, b: 34 };
  const vals = f.groups.flatMap((g) => [g.min, g.max, ...(g.outliers ?? [])]);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const sy = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
  const iw = (w - pad.l - pad.r) / f.groups.length;
  const yt = axisTicks(lo, hi, 6);
  return (
    <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="max-w-full">
      <g stroke={GRID}>{yt.map((t) => <line key={t} x1={pad.l} y1={sy(t)} x2={w - pad.r} y2={sy(t)} />)}</g>
      <g fill={AXIS} fontSize={10} textAnchor="end">
        {yt.map((t) => <text key={t} x={pad.l - 6} y={sy(t) + 3.5}>{nice(t)}</text>)}
      </g>
      {f.groups.map((g, i) => {
        const cx = pad.l + i * iw + iw / 2, bw = Math.min(52, iw * 0.5);
        return (
          <g key={g.label} stroke={INK} fill="none" strokeWidth={1.5}>
            <line x1={cx} y1={sy(g.min)} x2={cx} y2={sy(g.q1)} />
            <line x1={cx} y1={sy(g.q3)} x2={cx} y2={sy(g.max)} />
            <line x1={cx - bw / 3} y1={sy(g.min)} x2={cx + bw / 3} y2={sy(g.min)} />
            <line x1={cx - bw / 3} y1={sy(g.max)} x2={cx + bw / 3} y2={sy(g.max)} />
            <rect x={cx - bw / 2} y={sy(g.q3)} width={bw} height={Math.abs(sy(g.q1) - sy(g.q3))} fill={PALETTE[0]} fillOpacity={0.28} />
            <line x1={cx - bw / 2} y1={sy(g.median)} x2={cx + bw / 2} y2={sy(g.median)} strokeWidth={2.2} />
            {(g.outliers ?? []).map((o, k) => <circle key={k} cx={cx} cy={sy(o)} r={3} fill={INK} />)}
            <text x={cx} y={H - pad.b + 16} fontSize={10.5} fill={AXIS} textAnchor="middle" stroke="none">{g.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ----------------------------- number line ------------------------------- */

function NumberLineView({ f, w }: { f: NumberLine; w: number }) {
  const H = 84;
  const pad = 28;
  const sx = (v: number) => pad + ((v - f.min) / (f.max - f.min)) * (w - pad * 2);
  const ticks: number[] = [];
  for (let v = f.min; v <= f.max + 1e-9; v += f.step) ticks.push(Math.round(v * 1e9) / 1e9);
  return (
    <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="max-w-full">
      <defs>
        <marker id="nl-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill={INK} />
        </marker>
      </defs>
      <line x1={pad - 12} y1={44} x2={w - pad + 12} y2={44} stroke={INK} strokeWidth={1.6}
        markerEnd="url(#nl-arrow)" markerStart="url(#nl-arrow)" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={sx(t)} y1={38} x2={sx(t)} y2={50} stroke={INK} strokeWidth={1.4} />
          <text x={sx(t)} y={66} fontSize={11} fill={AXIS} textAnchor="middle">{nice(t)}</text>
        </g>
      ))}
      {f.intervals?.map((iv, i) => (
        <g key={i}>
          <line x1={sx(iv.from)} y1={44} x2={sx(iv.to)} y2={44} stroke={iv.color ?? PALETTE[0]} strokeWidth={5} strokeLinecap="butt" opacity={0.85} />
          <circle cx={sx(iv.from)} cy={44} r={5} fill={iv.closedLeft ? (iv.color ?? PALETTE[0]) : "var(--bg-elev)"} stroke={iv.color ?? PALETTE[0]} strokeWidth={2} />
          <circle cx={sx(iv.to)} cy={44} r={5} fill={iv.closedRight ? (iv.color ?? PALETTE[0]) : "var(--bg-elev)"} stroke={iv.color ?? PALETTE[0]} strokeWidth={2} />
        </g>
      ))}
      {f.marks?.map((m, i) => (
        <g key={i}>
          <circle cx={sx(m.at)} cy={44} r={5.5} fill={m.filled === false ? "var(--bg-elev)" : INK} stroke={INK} strokeWidth={2} />
          {m.label && <text x={sx(m.at)} y={26} fontSize={11} fill={INK} textAnchor="middle">{m.label}</text>}
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------- geometry -------------------------------- */

function GeometryView({ f, w }: { f: GeometryFigure; w: number }) {
  const [vx, vy, vw, vh] = f.viewBox;
  const H = f.height ?? Math.round((w * vh) / vw);
  const uid = useId().replace(/:/g, "");
  return (
    <svg width={w} height={H} viewBox={`${vx} ${vy} ${vw} ${vh}`} className="max-w-full">
      <defs>
        <marker id={`ar-${uid}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 z" fill={INK} />
        </marker>
      </defs>
      {f.elements.map((el, i) => {
        switch (el.t) {
          case "polygon":
            return <polygon key={i} points={el.points.map((p) => p.join(",")).join(" ")}
              fill={el.fill ?? "none"} fillOpacity={el.fill ? 0.16 : 0}
              stroke={el.stroke ?? INK} strokeWidth={1.6} strokeDasharray={el.dashed ? "5 4" : undefined} />;
          case "line":
            return <line key={i} x1={el.from[0]} y1={el.from[1]} x2={el.to[0]} y2={el.to[1]}
              stroke={el.stroke ?? INK} strokeWidth={1.6} strokeDasharray={el.dashed ? "5 4" : undefined}
              markerEnd={el.arrow ? `url(#ar-${uid})` : undefined} />;
          case "circle":
            return <circle key={i} cx={el.c[0]} cy={el.c[1]} r={el.r} fill={el.fill ?? "none"}
              fillOpacity={el.fill ? 0.16 : 0} stroke={el.stroke ?? INK} strokeWidth={1.6}
              strokeDasharray={el.dashed ? "5 4" : undefined} />;
          case "arc": {
            const p = (a: number) => `${el.c[0] + el.r * Math.cos(a)},${el.c[1] + el.r * Math.sin(a)}`;
            const large = Math.abs(el.end - el.start) > Math.PI ? 1 : 0;
            return <path key={i} d={`M${p(el.start)}A${el.r},${el.r} 0 ${large} 1 ${p(el.end)}`}
              fill="none" stroke={el.stroke ?? INK} strokeWidth={1.6} />;
          }
          case "point":
            return <g key={i}>
              <circle cx={el.at[0]} cy={el.at[1]} r={3.4} fill={el.filled === false ? "var(--bg-elev)" : INK} stroke={INK} strokeWidth={1.5} />
              {el.label && <text x={el.at[0] + 6} y={el.at[1] - 6} fontSize={12} fill={INK}>{el.label}</text>}
            </g>;
          case "label":
            return <text key={i} x={el.at[0]} y={el.at[1]} fontSize={el.size ?? 12} fill={INK}
              textAnchor={el.anchor ?? "middle"}>{el.text}</text>;
          case "angle": {
            const r = 16;
            const a1 = Math.atan2(el.from[1] - el.at[1], el.from[0] - el.at[0]);
            const a2 = Math.atan2(el.to[1] - el.at[1], el.to[0] - el.at[0]);
            if (el.right) {
              const ux = Math.cos(a1) * 12, uy = Math.sin(a1) * 12;
              const vx2 = Math.cos(a2) * 12, vy2 = Math.sin(a2) * 12;
              return <path key={i} d={`M${el.at[0] + ux},${el.at[1] + uy}L${el.at[0] + ux + vx2},${el.at[1] + uy + vy2}L${el.at[0] + vx2},${el.at[1] + vy2}`}
                fill="none" stroke={INK} strokeWidth={1.3} />;
            }
            const p = (a: number) => `${el.at[0] + r * Math.cos(a)},${el.at[1] + r * Math.sin(a)}`;
            return <g key={i}>
              <path d={`M${p(a1)}A${r},${r} 0 0 ${a2 > a1 ? 1 : 0} ${p(a2)}`} fill="none" stroke={INK} strokeWidth={1.3} />
              {el.label && <text x={el.at[0] + (r + 12) * Math.cos((a1 + a2) / 2)} y={el.at[1] + (r + 12) * Math.sin((a1 + a2) / 2) + 4}
                fontSize={11} fill={INK} textAnchor="middle">{el.label}</text>}
            </g>;
          }
          case "tick": {
            const [[x1, y1], [x2, y2]] = el.on;
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
            const ang = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
            const n = el.count ?? 1;
            return <g key={i} stroke={INK} strokeWidth={1.5}>
              {Array.from({ length: n }, (_, k) => {
                const off = (k - (n - 1) / 2) * 4;
                const ox = Math.cos(ang - Math.PI / 2) * off, oy = Math.sin(ang - Math.PI / 2) * off;
                return <line key={k}
                  x1={mx + ox + Math.cos(ang) * 5} y1={my + oy + Math.sin(ang) * 5}
                  x2={mx + ox - Math.cos(ang) * 5} y2={my + oy - Math.sin(ang) * 5} />;
              })}
            </g>;
          }
          default: return null;
        }
      })}
    </svg>
  );
}

/* -------------------------------- table ---------------------------------- */

function TableView({ f }: { f: TableFigure }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {f.headers.map((h, i) => (
              <th key={i} className="border px-3 py-2 text-left font-semibold"
                style={{ background: "var(--bg-sunken)", borderColor: "var(--border-strong)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {f.rows.map((r, ri) => (
            <tr key={ri} style={{ fontWeight: f.emphasizeRows?.includes(ri) ? 600 : 400 }}>
              {r.map((c, ci) => (
                <td key={ci} className="border px-3 py-1.5" style={{ borderColor: "var(--border)" }}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------- circuit --------------------------------- */

function CircuitView({ f, w }: { f: CircuitFigure; w: number }) {
  const H = f.height ?? Math.round(w * 0.6);
  const pos = Object.fromEntries(f.nodes.map((n) => [n.id, n.at]));
  return (
    <svg width={w} height={H} viewBox={`0 0 ${f.width ?? 400} ${f.height ?? 240}`} className="max-w-full">
      {f.components.map((c, i) => {
        const a = pos[c.from], b = pos[c.to];
        if (!a || !b) return null;
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
        return (
          <g key={i} stroke={INK} strokeWidth={1.8} fill="none">
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
            <g transform={`translate(${mx},${my}) rotate(${ang})`}>
              <rect x={-14} y={-9} width={28} height={18} fill="var(--bg-elev)" stroke="none" />
              {c.c === "resistor" && <path d="M-12,0 l3,-6 l4,12 l4,-12 l4,12 l3,-6 h2" />}
              {c.c === "battery" && <g><line x1={-5} y1={-9} x2={-5} y2={9} /><line x1={4} y1={-5} x2={4} y2={5} strokeWidth={3} /></g>}
              {c.c === "capacitor" && <g><line x1={-3} y1={-9} x2={-3} y2={9} /><line x1={3} y1={-9} x2={3} y2={9} /></g>}
              {c.c === "lamp" && <g><circle cx={0} cy={0} r={8} /><line x1={-5.6} y1={-5.6} x2={5.6} y2={5.6} /><line x1={-5.6} y1={5.6} x2={5.6} y2={-5.6} /></g>}
              {c.c === "switch" && <g><circle cx={-8} cy={0} r={2} fill={INK} /><circle cx={8} cy={0} r={2} fill={INK} /><line x1={-8} y1={0} x2={6} y2={-8} /></g>}
              {(c.c === "ammeter" || c.c === "voltmeter") && <g><circle cx={0} cy={0} r={9} /><text x={0} y={4} fontSize={10} stroke="none" fill={INK} textAnchor="middle">{c.c === "ammeter" ? "A" : "V"}</text></g>}
              {c.label && <text x={0} y={-15} fontSize={10.5} stroke="none" fill={INK} textAnchor="middle" transform={`rotate(${-ang})`}>{c.label}</text>}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

function ImageView({ f, w }: { f: ImageFigure; w: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={f.src} alt={f.alt} width={w} className="max-w-full rounded-lg hairline" />;
}
