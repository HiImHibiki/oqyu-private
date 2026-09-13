"use client";
import { useEffect, useRef, useState } from "react";
import { Delete, LineChart as LineIcon, Sigma, X } from "lucide-react";
import { evaluate, makeSolver, MathExprError, type MathErrorCode } from "@/lib/mathexpr";
import { useI18n } from "@/components/ui/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { FigureView } from "@/components/charts/Figure";
import type { FunctionPlot } from "@/lib/types";

/* Kalkulator ilmiah + grafik bawaan (pengganti Desmos di Bluebook).
 * Bisa di-drag, ingat posisi selama sesi, dan tidak pernah memanggil eval(). */

type Mode = "calc" | "graph";

/* Kode galat evaluator dipetakan menjadi kalimat DI SINI, di komponen yang
 * tahu bahasa pesertanya. Kode yang tidak dikenal jatuh ke pesan umum
 * alih-alih membocorkan nama kode ke layar ujian. */
const CALC_ERR: Record<MathErrorCode, MessageKey> = {
  unknownChar: "calc.errUnknownChar",
  incomplete: "calc.errIncomplete",
  unclosedParen: "calc.errUnclosedParen",
  unclosedFuncParen: "calc.errUnclosedFuncParen",
  unknownVariable: "calc.errUnknownVariable",
  unexpectedToken: "calc.errUnexpectedToken",
  trailingTokens: "calc.errTrailingTokens",
};

const PAD: { label: string; ins?: string; act?: string; wide?: boolean; tone?: "op" | "fn" | "num" | "eq" }[] = [
  { label: "2nd", act: "shift", tone: "fn" }, { label: "π", ins: "pi", tone: "fn" }, { label: "e", ins: "e", tone: "fn" },
  { label: "C", act: "clear", tone: "fn" }, { label: "⌫", act: "back", tone: "fn" },

  { label: "x²", ins: "^2", tone: "fn" }, { label: "xʸ", ins: "^", tone: "fn" }, { label: "√", ins: "sqrt(", tone: "fn" },
  { label: "(", ins: "(", tone: "fn" }, { label: ")", ins: ")", tone: "fn" },

  { label: "sin", ins: "sin(", tone: "fn" }, { label: "cos", ins: "cos(", tone: "fn" }, { label: "tan", ins: "tan(", tone: "fn" },
  { label: "÷", ins: "/", tone: "op" }, { label: "%", ins: "%", tone: "op" },

  { label: "ln", ins: "ln(", tone: "fn" }, { label: "log", ins: "log(", tone: "fn" }, { label: "n!", ins: "!", tone: "fn" },
  { label: "×", ins: "*", tone: "op" }, { label: "nCr", ins: "nCr(", tone: "fn" },

  { label: "7", ins: "7", tone: "num" }, { label: "8", ins: "8", tone: "num" }, { label: "9", ins: "9", tone: "num" },
  { label: "−", ins: "-", tone: "op" }, { label: "nPr", ins: "nPr(", tone: "fn" },

  { label: "4", ins: "4", tone: "num" }, { label: "5", ins: "5", tone: "num" }, { label: "6", ins: "6", tone: "num" },
  { label: "+", ins: "+", tone: "op" }, { label: "abs", ins: "abs(", tone: "fn" },

  { label: "1", ins: "1", tone: "num" }, { label: "2", ins: "2", tone: "num" }, { label: "3", ins: "3", tone: "num" },
  { label: "Ans", act: "ans", tone: "fn" }, { label: "=", act: "eq", tone: "eq" },

  { label: "0", ins: "0", tone: "num", wide: true }, { label: ".", ins: ".", tone: "num" }, { label: ",", ins: ",", tone: "num" },
  { label: "EXP", ins: "e", tone: "fn" },
];

const SECOND: Record<string, { label: string; ins: string }> = {
  sin: { label: "sin⁻¹", ins: "asin(" },
  cos: { label: "cos⁻¹", ins: "acos(" },
  tan: { label: "tan⁻¹", ins: "atan(" },
  "√": { label: "∛", ins: "cbrt(" },
  ln: { label: "eˣ", ins: "exp(" },
  log: { label: "log₂", ins: "log2(" },
  "x²": { label: "x³", ins: "^3" },
};

export function Calculator({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const errText = (e: unknown) =>
    e instanceof MathExprError
      ? t(CALC_ERR[e.code] ?? "calc.errGeneric", { d: e.detail ?? "" })
      : t("calc.errGeneric");

  const [mode, setMode] = useState<Mode>("calc");
  const [expr, setExpr] = useState("");
  const [ans, setAns] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [history, setHistory] = useState<{ e: string; v: string }[]>([]);
  const [deg, setDeg] = useState(false);
  const [shift, setShift] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 84 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const [graphExprs, setGraphExprs] = useState<string[]>(["x^2 - 3*x + 2", ""]);
  /* Disimpan sebagai TEKS, bukan angka.
   * Kalau disimpan sebagai angka, mengetik "-" menghasilkan Number("-") = NaN
   * dan nilainya langsung jatuh ke 0 — tanda minus jadi mustahil diketik. */
  const [winText, setWinText] = useState({ xmin: "-10", xmax: "10", ymin: "-10", ymax: "10" });

  const num = (v: string, fallback: number) => {
    const n = Number(v.replace(",", ".").replace(/\u2212/g, "-"));
    return Number.isFinite(n) ? n : fallback;
  };
  const rawWin = {
    xmin: num(winText.xmin, -10), xmax: num(winText.xmax, 10),
    ymin: num(winText.ymin, -10), ymax: num(winText.ymax, 10),
  };
  // jendela yang benar-benar dipakai menggambar: selalu punya lebar
  const win = {
    xmin: rawWin.xmin, xmax: rawWin.xmax > rawWin.xmin ? rawWin.xmax : rawWin.xmin + 1,
    ymin: rawWin.ymin, ymax: rawWin.ymax > rawWin.ymin ? rawWin.ymax : rawWin.ymin + 1,
  };
  const winInvalid = rawWin.xmax <= rawWin.xmin || rawWin.ymax <= rawWin.ymin;

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!drag.current) return;
      setPos({ x: Math.max(0, e.clientX - drag.current.dx), y: Math.max(0, e.clientY - drag.current.dy) });
    };
    const up = () => (drag.current = null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  function compute() {
    if (!expr.trim()) return;
    try {
      // mode derajat: bungkus argumen trigonometri
      const src = deg
        ? expr.replace(/\b(sin|cos|tan)\(/g, "$1((pi/180)*")
              .replace(/\b(asin|acos|atan)\(/g, "(180/pi)*$1(")
        : expr;
      const v = evaluate(src, ans !== null ? { Ans: ans, ans } : {});
      const out = Number.isInteger(v) ? String(v) : String(Math.round(v * 1e10) / 1e10);
      setAns(v);
      setErr(null);
      setHistory((h) => [{ e: expr, v: out }, ...h].slice(0, 40));
      setExpr(out);
    } catch (e) {
      setErr(errText(e));
    }
  }

  function press(k: (typeof PAD)[number]) {
    const sec = shift ? SECOND[k.label] : undefined;
    if (sec) { setExpr((s) => s + sec.ins); setShift(false); return; }
    if (k.ins !== undefined) return setExpr((s) => s + k.ins);
    switch (k.act) {
      case "clear": setExpr(""); setErr(null); break;
      case "back": setExpr((s) => s.slice(0, -1)); break;
      case "eq": compute(); break;
      case "ans": setExpr((s) => s + "Ans"); break;
      case "shift": setShift((v) => !v); break;
    }
  }

  const active = graphExprs.map((e, i) => ({ expr: e, idx: i })).filter((e) => e.expr.trim());
  const errors = graphExprs.map((e) => (e.trim() ? makeSolver(e).error ?? null : null));

  const figure: FunctionPlot = {
    kind: "function_plot",
    alt: "Grafik fungsi",
    window: win,
    grid: true,
    width: 320,
    height: 280,
    series: active.map((e) => ({ expr: e.expr, label: `y${e.idx + 1}` })),
  };

  return (
    <div
      className="card fixed z-[60] w-[340px] select-none"
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label="Kalkulator ilmiah"
    >
      <div
        className="flex cursor-move items-center gap-2 border-b px-3 py-2"
        onMouseDown={(e) => (drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y })}
      >
        <span className="text-sm font-semibold">Kalkulator</span>
        <div className="ml-auto flex items-center gap-1">
          <button className={tab(mode === "calc")} onClick={() => setMode("calc")} title="Ilmiah"><Sigma size={14} /></button>
          <button className={tab(mode === "graph")} onClick={() => setMode("graph")} title="Grafik"><LineIcon size={14} /></button>
          <button className="btn btn-ghost !px-2 !py-1" onClick={onClose} aria-label={t("calc.close")}><X size={14} /></button>
        </div>
      </div>

      {mode === "calc" ? (
        <div className="p-3">
          <div className="mb-2 rounded-lg px-3 py-2" style={{ background: "var(--bg-sunken)" }}>
            <input
              className="w-full bg-transparent text-right font-mono text-lg outline-none"
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); compute(); } }}
              placeholder="0"
              aria-label="Ekspresi"
            />
            <div className="mt-1 h-4 text-right text-xs">
              {err ? <span style={{ color: "var(--danger)" }}>{err}</span> : ans !== null && <span className="muted">Ans = {ans}</span>}
            </div>
          </div>

          <div className="mb-2 flex items-center gap-2 text-xs">
            <button className="chip" onClick={() => setDeg((d) => !d)}>{deg ? "DEG" : "RAD"}</button>
            <button className={`chip ${shift ? "!bg-[var(--accent)] !text-[var(--accent-fg)]" : ""}`} onClick={() => setShift((v) => !v)}>2nd</button>
            <button className="chip ml-auto" onClick={() => setHistory([])}><Delete size={11} /> Riwayat</button>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {PAD.map((k, i) => {
              const sec = shift ? SECOND[k.label] : undefined;
              return (
                <button
                  key={i}
                  onClick={() => press(k)}
                  className={`rounded-lg py-2 text-sm font-medium transition ${k.wide ? "col-span-1" : ""}`}
                  style={{
                    background:
                      k.tone === "eq" ? "var(--accent)" :
                      k.tone === "op" ? "var(--accent-soft)" :
                      k.tone === "num" ? "var(--bg-sunken)" : "transparent",
                    color: k.tone === "eq" ? "var(--accent-fg)" : "var(--fg)",
                    border: k.tone === "fn" ? "1px solid var(--border)" : "1px solid transparent",
                  }}
                >
                  {sec?.label ?? k.label}
                </button>
              );
            })}
          </div>

          {history.length > 0 && (
            <div className="mt-3 max-h-28 overflow-y-auto rounded-lg border p-2 text-xs">
              {history.map((h, i) => (
                <button key={i} className="flex w-full justify-between gap-2 py-0.5 text-left hover:opacity-70"
                  onClick={() => setExpr(h.e)}>
                  <span className="truncate muted">{h.e}</span>
                  <span className="font-mono">{h.v}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-3">
          {graphExprs.map((g, i) => (
            <div key={i} className="mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 text-xs muted">{i + 1}</span>
                <input
                  className="input !py-1 font-mono text-sm"
                  style={errors[i] ? { borderColor: "var(--danger)" } : undefined}
                  value={g}
                  onChange={(e) => setGraphExprs((a) => a.map((v, k) => (k === i ? e.target.value : v)))}
                  placeholder="2x+1  ·  3x+2y=19  ·  x^2+y^2=25"
                  aria-invalid={Boolean(errors[i])}
                />
              </div>
              {errors[i] && (
                <p className="ml-8 mt-0.5 text-[10px]" style={{ color: "var(--danger)" }}>{errors[i]}</p>
              )}
            </div>
          ))}
          <button className="mb-2 text-xs underline muted" onClick={() => setGraphExprs((a) => [...a, ""])}>
            + tambah persamaan
          </button>
          <FigureView figure={figure} maxWidth={310} />
          <div className="mt-1 grid grid-cols-4 gap-1 text-[11px]">
            {(["xmin", "xmax", "ymin", "ymax"] as const).map((k) => (
              <label key={k} className="flex flex-col gap-0.5">
                <span className="muted">{k}</span>
                <input
                  className="input !px-1.5 !py-1 text-center text-xs"
                  inputMode="text"
                  value={winText[k]}
                  onChange={(e) => setWinText((w) => ({ ...w, [k]: e.target.value }))}
                  onBlur={(e) => { if (!e.target.value.trim()) setWinText((w) => ({ ...w, [k]: String(win[k]) })); }}
                />
              </label>
            ))}
          </div>

          <div className="mt-1.5 flex items-center gap-2 text-[10px]">
            {winInvalid ? (
              <span style={{ color: "var(--danger)" }}>maks harus lebih besar dari min</span>
            ) : (
              <span className="muted">Boleh bilangan negatif, mis. −10</span>
            )}
            <button
              className="ml-auto underline muted"
              onClick={() => setWinText({ xmin: "-10", xmax: "10", ymin: "-10", ymax: "10" })}
            >
              atur ulang
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const tab = (active: boolean) =>
  `rounded-md px-2 py-1 text-xs ${active ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--bg-sunken)]"}`;
