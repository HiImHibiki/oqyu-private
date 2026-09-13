"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle } from "lucide-react";
import { EXAM_LIST } from "@/lib/exams/blueprints";
import type { ExamCode } from "@/lib/types";
import { useI18n } from "@/components/ui/I18nProvider";

export function DemoPicker() {
  const router = useRouter();
  const { t } = useI18n();
  const [exam, setExam] = useState<ExamCode>("SAT");
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const r = await fetch("/api/attempts", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ exam, isDemo: true }),
    });
    const j = await r.json();
    setBusy(false);
    if (j.attemptId) router.push(`/ujian/${j.attemptId}`);
  }

  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {EXAM_LIST.map((e) => (
          <button key={e.code} onClick={() => setExam(e.code)}
            className="card p-4 text-left"
            style={{ borderColor: exam === e.code ? "var(--accent)" : "var(--border)", background: exam === e.code ? "var(--accent-soft)" : "var(--bg-elev)" }}>
            <div className="mb-1 flex items-center gap-2">
              <span className="chip">{e.code}</span>
              <span className="text-sm font-semibold">{e.name}</span>
            </div>
            <p className="text-xs muted">{e.tagline}</p>
          </button>
        ))}
      </div>
      <button className="btn btn-primary !px-5 !py-3" onClick={start} disabled={busy}>
        {busy ? <Loader2 size={17} className="animate-spin" /> : <PlayCircle size={17} />}
        {t("demo.start")}
      </button>
    </>
  );
}
