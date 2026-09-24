"use client";
import { useEffect, useState } from "react";
import { Crown, Loader2, Medal } from "lucide-react";
import { EXAM_LIST } from "@/lib/exams/blueprints";
import type { ExamCode } from "@/lib/types";
import { useI18n } from "@/components/ui/I18nProvider";

interface Row {
  rank: number; userId: string; displayName: string; school?: string;
  attempts: number; avgTotal: number; bestTotal: number;
}

export function Board({ meId }: { meId: string }) {
  const { t } = useI18n();
  const [exam, setExam] = useState<ExamCode>("SAT");
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    setRows(null);
    fetch(`/api/leaderboard?exam=${exam}`).then((r) => r.json()).then((j) => setRows(j.rows ?? []));
  }, [exam]);

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        {EXAM_LIST.map((e) => (
          <button key={e.code} onClick={() => setExam(e.code)} className="chip"
            style={exam === e.code ? { background: "var(--accent)", color: "var(--accent-fg)", borderColor: "transparent" } : undefined}>
            {e.code}
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="flex items-center gap-2 p-8 text-sm muted"><Loader2 size={16} className="animate-spin" /> {t("lb.loading")}</div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="mb-1 font-semibold">{t("lb.emptyTitle", { exam })}</p>
          <p className="text-sm muted">{t("lb.emptyBody")}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-sunken)" }}>
                <th className="px-4 py-2.5 text-left font-medium">#</th>
                <th className="px-4 py-2.5 text-left font-medium">{t("lb.participant")}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t("lb.tests")}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t("lb.avg")}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t("lb.best")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const me = r.userId === meId;
                return (
                  <tr key={r.userId} className="border-t"
                    style={{ background: me ? "var(--accent-soft)" : undefined, fontWeight: me ? 600 : 400 }}>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5">
                        {r.rank === 1 ? <Crown size={14} style={{ color: "var(--warn)" }} /> :
                         r.rank <= 3 ? <Medal size={14} className="muted" /> : null}
                        {r.rank}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.displayName}{me && <span className="ml-1.5 chip">{t("lb.you")}</span>}
                      {r.school && <div className="text-[11px] font-normal muted">{r.school}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.attempts}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.avgTotal}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.bestTotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs muted">{t("lb.privacy")}</p>
    </>
  );
}
