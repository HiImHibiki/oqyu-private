"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Ban, Check } from "lucide-react";
import type { Question } from "@/lib/types";
import { FigureView } from "@/components/charts/Figure";
import { RichInline, RichText } from "./RichText";
import { parseNumeric } from "@/lib/exams/grade";
import { useI18n } from "@/components/ui/I18nProvider";

export interface QuestionViewProps {
  question: Question;
  value: unknown;
  onChange: (v: unknown) => void;
  crossedOut?: string[];
  onCrossOut?: (id: string) => void;
  /** review: tampilkan kunci + pembahasan, input dikunci */
  review?: boolean;
  correctIds?: string[];
  locale?: string;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuestionView(p: QuestionViewProps) {
  const q = localized(p.question, p.locale);
  return (
    <div className="stem">
      {q.figure && <FigureView figure={q.figure} />}
      <RichText className="mb-4">{q.stem}</RichText>
      <Body {...p} question={q} />
    </div>
  );
}

/** Ambil versi terjemahan bila tersedia (CSCA: en / zh). */
function localized(q: Question, locale?: string): Question {
  if (!locale || locale === q.locale) return q;
  const tr = q.i18n?.[locale as keyof typeof q.i18n];
  if (!tr) return q;
  return { ...q, stem: tr.stem ?? q.stem, explanation: tr.explanation ?? q.explanation, stimulus: tr.stimulus ?? q.stimulus, choices: tr.choices ?? q.choices };
}

function Body({ question: q, value, onChange, crossedOut = [], onCrossOut, review, correctIds = [] }: QuestionViewProps) {
  const { t } = useI18n();
  switch (q.type) {
    /* ------------------------------------------------ pilihan ganda */
    case "mcq_single":
      return (
        /* Pilihan jawaban adalah <button>, bukan <input type="radio">, karena
         * tampilannya menuntut tata letak yang tidak bisa dicapai kontrol
         * bawaan. Konsekuensinya harus ditanggung: tanpa peran dan status
         * ARIA, pilihan yang sedang terpilih HANYA disampaikan lewat warna —
         * pembaca layar mengumumkannya sebagai tombol biasa, dan peserta
         * tunanetra tidak dapat mengetahui jawaban mana yang sudah ia pilih.
         * Di ujian berbatas waktu yang menyediakan akomodasi 1,5× dan 2×,
         * itu bukan kekurangan kecil. */
        <ul className="space-y-2" role="radiogroup" aria-label={t("q.choices")}>
          {(q.choices ?? []).map((c, i) => {
            const selected = value === c.id;
            const crossed = crossedOut.includes(c.id);
            const isKey = review && correctIds.includes(c.id);
            const isWrong = review && selected && !isKey;
            return (
              <li key={c.id} className="flex items-start gap-2">
                <button
                  role="radio"
                  aria-checked={selected}
                  disabled={review}
                  onClick={() => onChange(selected ? null : c.id)}
                  className={`flex flex-1 items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition ${crossed ? "crossed" : ""}`}
                  style={{
                    borderColor: isKey ? "var(--ok)" : isWrong ? "var(--danger)" : selected ? "var(--accent)" : "var(--border)",
                    background: isKey ? "color-mix(in srgb, var(--ok) 10%, transparent)"
                      : isWrong ? "color-mix(in srgb, var(--danger) 10%, transparent)"
                      : selected ? "var(--accent-soft)" : "var(--bg-elev)",
                    boxShadow: selected && !review ? "inset 0 0 0 1px var(--accent)" : undefined,
                  }}
                >
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
                    style={{
                      borderColor: selected || isKey ? "transparent" : "var(--border-strong)",
                      background: isKey ? "var(--ok)" : selected ? "var(--accent)" : "transparent",
                      color: isKey || selected ? "var(--accent-fg)" : "var(--fg-muted)",
                    }}
                  >
                    {c.id || LETTERS[i]}
                  </span>
                  <span className="flex-1">
                    <RichInline>{c.text}</RichInline>
                    {c.figure && <FigureView figure={c.figure} maxWidth={260} />}
                  </span>
                </button>
                {!review && onCrossOut && (
                  <button
                    onClick={() => onCrossOut(c.id)}
                    title={t("q.crossOut")}
                    aria-label={`${t("q.crossOut")} ${c.id}`}
                    className="mt-2 rounded-md p-1.5 hover:bg-[var(--bg-sunken)]"
                    style={{ color: crossed ? "var(--danger)" : "var(--fg-muted)" }}
                  >
                    <Ban size={15} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      );

    case "mcq_multi": {
      const picked: string[] = Array.isArray(value) ? value : [];
      const need = q.answer.mode === "choice_set" ? q.answer.selectCount : 2;
      return (
        <>
          <p className="mb-2 text-xs muted">{t("q.selectN", { n: need })}</p>
          <ul className="space-y-2" role="group" aria-label={t("q.choices")}>
            {(q.choices ?? []).map((c) => {
              const on = picked.includes(c.id);
              const isKey = review && correctIds.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    role="checkbox"
                    aria-checked={on}
                    disabled={review}
                    onClick={() => onChange(on ? picked.filter((x) => x !== c.id) : [...picked, c.id])}
                    className="flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left"
                    style={{
                      borderColor: isKey ? "var(--ok)" : on ? "var(--accent)" : "var(--border)",
                      background: on ? "var(--accent-soft)" : "var(--bg-elev)",
                    }}
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border"
                      style={{ background: on ? "var(--accent)" : "transparent", borderColor: on ? "transparent" : "var(--border-strong)", color: "var(--accent-fg)" }}>
                      {on && <Check size={13} />}
                    </span>
                    <RichInline className="flex-1">{c.text}</RichInline>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      );
    }

    /* -------------------------------------------------- isian angka */
    case "spr_numeric": {
      const parsed = parseNumeric(value as string);
      return (
        <div className="max-w-xs">
          <input
            disabled={review}
            className="input font-mono text-lg"
            inputMode="text"
            placeholder={t("q.typeAnswer")}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            aria-label={t("q.answerLabel")}
          />
          <div className="mt-1.5 text-xs muted">
            {value ? (parsed === null ? t("q.numericUnread") : t("q.numericRead", { value: String(parsed) })) : t("q.numericHint")}
          </div>
        </div>
      );
    }

    case "numeric_multi": {
      const vals = (value ?? {}) as Record<string, string>;
      return (
        <div className="space-y-2">
          {(q.numericBlanks ?? []).map((b) => (
            <label key={b.id} className="flex items-center gap-3">
              <span className="w-40 text-sm muted">{b.label ?? b.id}</span>
              <input
                disabled={review}
                className="input max-w-[180px] font-mono"
                value={vals[b.id] ?? ""}
                onChange={(e) => onChange({ ...vals, [b.id]: e.target.value })}
              />
              {b.unit && <span className="text-sm muted">{b.unit}</span>}
            </label>
          ))}
        </div>
      );
    }

    case "short_text":
      return (
        <input
          disabled={review}
          className="input max-w-md"
          placeholder={t("q.typeAnswer")}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    /* ------------------------------------------- pernyataan B / S */
    case "true_false_multi": {
      const arr = (Array.isArray(value) ? value : []) as (boolean | null)[];
      const key = q.answer.mode === "boolean_list" ? q.answer.values : [];
      return (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {(q.statements ?? []).map((s, i) => (
            <li key={s.id} className="flex items-start gap-3 py-2.5">
              <span className="flex-1"><RichInline>{s.text}</RichInline></span>
              <div className="flex shrink-0 gap-1">
                {[true, false].map((b) => {
                  const on = arr[i] === b;
                  const isKey = review && key[i] === b;
                  return (
                    <button
                      key={String(b)}
                      disabled={review}
                      onClick={() => { const next = [...arr]; next[i] = on ? null : b; onChange(next); }}
                      className="rounded-lg border px-3 py-1 text-xs font-medium"
                      style={{
                        background: isKey ? "var(--ok)" : on ? "var(--accent)" : "transparent",
                        color: isKey || on ? "var(--accent-fg)" : "var(--fg)",
                        borderColor: isKey || on ? "transparent" : "var(--border-strong)",
                      }}
                    >
                      {b ? t("common.true") : t("common.false")}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      );
    }

    /* ------------------------------------------------ matriks centang */
    case "table_grid": {
      const vals = (value ?? {}) as Record<string, string>;
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border px-3 py-2 text-left" style={{ background: "var(--bg-sunken)" }} />
                {(q.gridCols ?? []).map((c) => (
                  <th key={c.id} className="border px-3 py-2 text-center font-medium" style={{ background: "var(--bg-sunken)" }}>{c.text}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(q.gridRows ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="border px-3 py-2"><RichInline>{r.text}</RichInline></td>
                  {(q.gridCols ?? []).map((c) => (
                    <td key={c.id} className="border px-3 py-2 text-center">
                      <input
                        type="radio"
                        disabled={review}
                        name={`grid-${q.id}-${r.id}`}
                        checked={vals[r.id] === c.id}
                        onChange={() => onChange({ ...vals, [r.id]: c.id })}
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    /* -------------------------------------------------- menjodohkan */
    case "matching": {
      const vals = (value ?? {}) as Record<string, string>;
      return (
        <ul className="space-y-2">
          {(q.left ?? []).map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-2.5">
              <span className="flex-1 min-w-[180px]"><RichInline>{l.text}</RichInline></span>
              <select
                disabled={review}
                className="input max-w-[260px]"
                value={vals[l.id] ?? ""}
                onChange={(e) => onChange({ ...vals, [l.id]: e.target.value })}
              >
                <option value="">{t("common.selectPlaceholder")}</option>
                {(q.right ?? []).map((r) => <option key={r.id} value={r.id}>{r.text}</option>)}
              </select>
            </li>
          ))}
        </ul>
      );
    }

    /* ---------------------------------------------------- mengurutkan */
    case "ordering": {
      const order: string[] = Array.isArray(value) && value.length ? (value as string[]) : (q.choices ?? []).map((c) => c.id);
      const move = (i: number, d: -1 | 1) => {
        const next = [...order];
        const j = i + d;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        onChange(next);
      };
      return (
        <ol className="space-y-2">
          {order.map((id, i) => {
            const c = (q.choices ?? []).find((x) => x.id === id);
            return (
              <li key={id} className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5">
                <span className="w-6 text-center text-sm font-semibold muted">{i + 1}</span>
                <span className="flex-1"><RichInline>{c?.text ?? id}</RichInline></span>
                {!review && (
                  <span className="flex gap-1">
                    <button className="rounded-md p-1 hover:bg-[var(--bg-sunken)]" onClick={() => move(i, -1)} aria-label={t("q.moveUp")}><ArrowUp size={15} /></button>
                    <button className="rounded-md p-1 hover:bg-[var(--bg-sunken)]" onClick={() => move(i, 1)} aria-label={t("q.moveDown")}><ArrowDown size={15} /></button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      );
    }

    /* -------------------------------------------- cloze dropdown */
    case "dropdown_inline": {
      const vals = (value ?? {}) as Record<string, string>;
      const parts = splitTokens(q.stem);
      return (
        <p className="leading-9">
          {parts.map((part, i) =>
            part.token ? (
              <select
                key={i}
                disabled={review}
                className="input mx-1 !inline-block !w-auto !py-1"
                value={vals[part.token] ?? ""}
                onChange={(e) => onChange({ ...vals, [part.token!]: e.target.value })}
              >
                <option value="">{t("common.selectPlaceholder")}</option>
                {(q.blanks?.find((b) => b.id === part.token)?.options ?? []).map((o) => (
                  <option key={o.id} value={o.id}>{o.text}</option>
                ))}
              </select>
            ) : (
              <RichInline key={i}>{part.text}</RichInline>
            ),
          )}
        </p>
      );
    }

    /* ------------------------------------------------- plot koordinat */
    case "graph_plot":
      return <PlotInput q={q} value={value} onChange={onChange} review={review} />;

    case "essay_rubric":
      return (
        <textarea
          disabled={review}
          className="input min-h-[220px] font-serif leading-7"
          placeholder={t("q.essayPlaceholder")}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    default:
      return null;
  }
}

/* Pisah stem berdasarkan token {{b1}} / {{n1}} */
function splitTokens(stem: string) {
  const out: { text: string; token?: string }[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(stem))) {
    if (m.index > last) out.push({ text: stem.slice(last, m.index) });
    out.push({ text: "", token: m[1] });
    last = m.index + m[0].length;
  }
  if (last < stem.length) out.push({ text: stem.slice(last) });
  return out;
}

/* ------------------------- input plot koordinat -------------------------- */

function PlotInput({ q, value, onChange, review }: { q: Question; value: unknown; onChange: (v: unknown) => void; review?: boolean }) {
  const { t } = useI18n();
  const cfg = q.plotConfig ?? { window: { xmin: -10, xmax: 10, ymin: -10, ymax: 10 }, mode: "points" as const, snap: 1 };
  const W = 420, H = 380, pad = 28;
  const { xmin, xmax, ymin, ymax } = cfg.window;
  const sx = (x: number) => pad + ((x - xmin) / (xmax - xmin)) * (W - pad * 2);
  const sy = (y: number) => pad + (1 - (y - ymin) / (ymax - ymin)) * (H - pad * 2);
  const ix = (px: number) => xmin + ((px - pad) / (W - pad * 2)) * (xmax - xmin);
  const iy = (py: number) => ymin + (1 - (py - pad) / (H - pad * 2)) * (ymax - ymin);
  const snap = cfg.snap ?? 1;
  const pts: [number, number][] = ((value as { points?: [number, number][] })?.points ?? []);

  const [hover, setHover] = useState<[number, number] | null>(null);

  const gridX = useMemo(() => range(xmin, xmax, snap), [xmin, xmax, snap]);
  const gridY = useMemo(() => range(ymin, ymax, snap), [ymin, ymax, snap]);

  function click(e: React.MouseEvent<SVGSVGElement>) {
    if (review) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(ix(((e.clientX - r.left) / r.width) * W) / snap) * snap;
    const y = Math.round(iy(((e.clientY - r.top) / r.height) * H) / snap) * snap;
    const exists = pts.findIndex((p) => p[0] === x && p[1] === y);
    const next = exists >= 0 ? pts.filter((_, i) => i !== exists) : [...pts, [x, y] as [number, number]];
    onChange({ points: next, ...(cfg.mode !== "points" && next.length === 2 ? { line: lineThrough(next[0], next[1]) } : {}) });
  }

  return (
    <div>
      <svg
        width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        className="max-w-full cursor-crosshair rounded-xl border"
        style={{ background: "var(--bg-elev)" }}
        onClick={click}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover([
            Math.round(ix(((e.clientX - r.left) / r.width) * W) / snap) * snap,
            Math.round(iy(((e.clientY - r.top) / r.height) * H) / snap) * snap,
          ]);
        }}
        onMouseLeave={() => setHover(null)}
      >
        <g stroke="var(--border)">
          {gridX.map((x) => <line key={"x" + x} x1={sx(x)} y1={pad} x2={sx(x)} y2={H - pad} />)}
          {gridY.map((y) => <line key={"y" + y} x1={pad} y1={sy(y)} x2={W - pad} y2={sy(y)} />)}
        </g>
        <g stroke="var(--fg)" strokeWidth={1.5}>
          <line x1={pad} y1={sy(0)} x2={W - pad} y2={sy(0)} />
          <line x1={sx(0)} y1={pad} x2={sx(0)} y2={H - pad} />
        </g>
        <g fill="var(--fg-muted)" fontSize={9} textAnchor="middle">
          {gridX.filter((x) => x % (snap * 2) === 0 && x !== 0).map((x) => <text key={x} x={sx(x)} y={sy(0) + 12}>{x}</text>)}
          {gridY.filter((y) => y % (snap * 2) === 0 && y !== 0).map((y) => <text key={y} x={sx(0) - 8} y={sy(y) + 3}>{y}</text>)}
        </g>
        {pts.length === 2 && cfg.mode !== "points" && (
          <line x1={sx(pts[0][0])} y1={sy(pts[0][1])} x2={sx(pts[1][0])} y2={sy(pts[1][1])}
            stroke="var(--accent)" strokeWidth={2.4} />
        )}
        {pts.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={5.5} fill="var(--accent)" />)}
        {hover && !review && (
          <>
            <circle cx={sx(hover[0])} cy={sy(hover[1])} r={4} fill="none" stroke="var(--accent)" strokeDasharray="3 2" />
            <text x={sx(hover[0]) + 9} y={sy(hover[1]) - 9} fontSize={11} fill="var(--fg-muted)">({hover[0]}, {hover[1]})</text>
          </>
        )}
      </svg>
      <div className="mt-2 flex items-center gap-3 text-xs muted">
        <span>{t("q.plotHint")}</span>
        {!review && pts.length > 0 && (
          <button className="underline" onClick={() => onChange({ points: [] })}>{t("q.plotClear")}</button>
        )}
      </div>
    </div>
  );
}

function range(a: number, b: number, step: number) {
  const out: number[] = [];
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}
function lineThrough(p: [number, number], q: [number, number]) {
  const m = (q[1] - p[1]) / (q[0] - p[0] || 1e-9);
  return { m, b: p[1] - m * p[0] };
}
