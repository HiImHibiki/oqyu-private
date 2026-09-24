"use client";
import { useState } from "react";
import { X, Search } from "lucide-react";
import katex from "katex";
import { FORMULA_SHEETS, getSheet } from "@/lib/exams/formulas";
import { useI18n } from "@/components/ui/I18nProvider";

function Tex({ src }: { src: string }) {
  const html = katex.renderToString(src, { throwOnError: false, displayMode: false, strict: false });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Panel lembar rumus. `sheetId` = sheet default section; siswa tetap bisa
 *  membuka sheet lain (mis. rumus A Level saat mengerjakan CSCA sains). */
export function FormulaSheet({ sheetId, onClose }: { sheetId?: string; onClose: () => void }) {
  const { t } = useI18n();
  const [active, setActive] = useState(sheetId ?? Object.keys(FORMULA_SHEETS)[0]);
  const [q, setQ] = useState("");
  const sheet = getSheet(active);

  const groups = (sheet?.groups ?? [])
    .map((g) => ({ ...g, items: g.items.filter((it) => !q || (it.tex + (it.note ?? "")).toLowerCase().includes(q.toLowerCase())) }))
    .filter((g) => g.items.length);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-label="Lembar rumus">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.35)" }} onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l" style={{ background: "var(--bg-elev)" }}>
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold">{sheet?.title}</div>
            {sheet?.subtitle && <div className="text-xs muted">{sheet.subtitle}</div>}
          </div>
          <button className="btn btn-ghost ml-auto !px-2 !py-1" onClick={onClose} aria-label={t("common.close")}><X size={16} /></button>
        </header>

        <div className="flex flex-wrap gap-1.5 border-b px-4 py-2">
          {Object.values(FORMULA_SHEETS).map((s) => (
            <button key={s.id} onClick={() => setActive(s.id)}
              className="chip"
              style={active === s.id ? { background: "var(--accent)", color: "var(--accent-fg)", borderColor: "transparent" } : undefined}>
              {s.title.split("—")[0].trim()}
            </button>
          ))}
        </div>

        <div className="border-b px-4 py-2">
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: "var(--bg-sunken)" }}>
            <Search size={14} className="muted" />
            <input className="w-full bg-transparent text-sm outline-none" placeholder="Cari rumus..."
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {groups.map((g) => (
            <section key={g.title} className="mb-5">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider muted">{g.title}</h3>
              <ul className="space-y-2">
                {g.items.map((it, i) => (
                  <li key={i} className="rounded-lg px-3 py-2" style={{ background: "var(--bg-sunken)" }}>
                    <Tex src={it.tex} />
                    {it.note && <div className="mt-1 text-xs muted">{it.note}</div>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!groups.length && <p className="text-sm muted">Tidak ada rumus yang cocok.</p>}
        </div>
      </aside>
    </div>
  );
}
