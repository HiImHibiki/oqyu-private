import { getLocale, intlTag, translatorFor } from "@/lib/i18n";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, PlayCircle, ShieldCheck, Trophy } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { loadAttempt, sectionsOf } from "@/lib/exams/attempt";
import { AppShell } from "@/components/ui/AppShell";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { gradeAnswer } from "@/lib/exams/grade";
import { getBlueprint } from "@/lib/exams/blueprints";
import { DomainBars } from "@/components/dashboard/DomainBars";
import { ReviewList } from "./ReviewList";
import type { ScoreReport } from "@/lib/exams/scoring";
import type { ExamCode, ProctorLog, ResponseValue } from "@/lib/types";

export const metadata = { title: "Hasil try out" };

export default async function HasilPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const locale = await getLocale();
  const tag = intlTag(locale);
  const t = translatorFor(locale);

  const res = await loadAttempt(attemptId);
  if ("error" in res) {
    if (res.error === "not_found") notFound();
    redirect("/masuk");
  }

  const { attempt } = res;
  if (attempt.status !== "submitted") redirect(`/ujian/${attemptId}`);

  // Hasil demo bisa dilihat tanpa akun — kalau tidak, siswa yang baru mencoba
  // demo akan terpental ke halaman masuk tepat setelah menyelesaikan tesnya.
  const user = await currentUser();
  const exam = attempt.exam as ExamCode;
  const score = attempt.score as ScoreReport;
  const integrity = attempt.integrity as ProctorLog | undefined;
  const bp = getBlueprint(exam);
  const sections = await sectionsOf(attempt);
  const responses = (attempt.responses ?? {}) as Record<string, ResponseValue>;

  // siapkan data review (aman: attempt sudah dikirim, kunci boleh dibuka)
  const review = sections.flatMap((s) =>
    s.questions.map((q, i) => {
      const raw = responses[q.id]?.raw ?? null;
      const mark = q.answer?.mode === "rubric" ? attempt.marks?.[q.id] : undefined;
      /* Soal esai: nilainya dari pengajar, bukan dari gradeAnswer yang untuk
       * mode rubrik selalu mengembalikan nol. */
      const g = mark
        ? { correct: mark.total >= (q.points ?? 1), credit: mark.total / (q.points || 1) }
        : gradeAnswer(q, raw);
      return {
        sectionName: s.name, index: i + 1, question: q, raw,
        correct: g.correct, credit: g.credit,
        ...(q.answer?.mode === "rubric" ? { mark: mark ?? null } : {}),
      };
    }),
  );

  const allDomains = score.sections.flatMap((s) => s.byDomain);
  const domainAgg = new Map<string, { c: number; t: number }>();
  for (const d of allDomains) {
    const cur = domainAgg.get(d.domain) ?? { c: 0, t: 0 };
    cur.c += d.correct; cur.t += d.total;
    domainAgg.set(d.domain, cur);
  }
  const domains = [...domainAgg]
    .map(([domain, v]) => ({ domain, pct: v.t ? Math.round((v.c / v.t) * 100) : 0, total: v.t }))
    .sort((a, b) => a.pct - b.pct);

  const body = (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {user ? (
        <Link href="/journey" className="mb-4 inline-flex items-center gap-1.5 text-sm muted hover:underline">
          <ArrowLeft size={14} /> {t("result.backToJourney")}
        </Link>
      ) : (
        <div className="card mb-5 flex flex-wrap items-center gap-4 p-4">
          <PlayCircle size={20} style={{ color: "var(--accent)" }} />
          <p className="flex-1 text-sm">{t("result.demoBanner")}</p>
          <Link href="/daftar" className="btn btn-primary">{t("result.demoCta")}</Link>
        </div>
      )}

      <div className="card mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-6 p-6"
          style={{ background: "linear-gradient(135deg, var(--accent-soft), transparent)" }}>
          <div>
            <span className="chip mb-2">{exam}{attempt.isDemo ? " · demo" : ""}</span>
            <h1 className="display text-2xl">{attempt.formTitle}</h1>
            <p className="mt-1 text-sm muted">
              {new Date(attempt.submittedAt ?? attempt.startedAt).toLocaleString(tag, { dateStyle: "full", timeStyle: "short" })}
            </p>
          </div>
          <div className="ml-auto text-right">
            <div className="display text-5xl leading-none">{score.total}</div>
            <div className="mt-1 text-xs muted">{t("result.outOf", { max: score.totalMax })}</div>
            {score.grade && <div className="mt-1 chip">{t("result.grade", { grade: score.grade })}</div>}
          </div>
        </div>

        {/* Soal esai dikeluarkan dari hitungan karena mesin tidak bisa
            menilainya. Itu keputusan yang benar, tetapi harus dikatakan:
            skor tanpa keterangan ini akan terbaca seolah mencakup seluruh
            paket. */}
        {(attempt.timeMultiplier ?? 1) !== 1 && (
          <p className="border-t px-5 py-3 text-xs muted" style={{ borderColor: "var(--border)" }}>
            {t("result.accommodation", { mult: String(attempt.timeMultiplier).replace(".", ",") })}
          </p>
        )}
        {score.pendingManual && (
          <p className="border-t px-5 py-3 text-xs muted" style={{ borderColor: "var(--border)" }}>
            {t("result.pendingEssay", { n: score.pendingManual.count })}
          </p>
        )}

        <div className="grid gap-px sm:grid-cols-3" style={{ background: "var(--border)" }}>
          <Cell label={t("result.percentile")} value={score.percentileHint !== undefined ? `~${score.percentileHint}` : "—"} />
          <Cell label={t("result.ability")} value={score.theta !== undefined ? score.theta.toFixed(2) : "—"} />
          <Cell label={t("result.integrity")} value={String(integrity?.integrityScore ?? 100)}
            icon={<ShieldCheck size={13} />} />
        </div>
      </div>

      <section className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">{t("result.bySection")}</h2>
          <ul className="space-y-3">
            {score.sections.map((s) => {
              const range = bp?.scoring.perSectionRange ?? [0, 100];
              const pct = ((s.scaled - range[0]) / (range[1] - range[0])) * 100;
              return (
                <li key={s.code}>
                  <div className="mb-1 flex items-baseline gap-2 text-sm">
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="font-semibold tabular-nums">{s.scaled}</span>
                    <span className="text-xs muted">{t("result.correct", { pct: Math.round(s.percent * 100) })}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--bg-sunken)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: "var(--accent)" }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="mb-1 font-semibold">{t("result.domainMap")}</h2>
          <p className="mb-4 text-xs muted">{t("result.domainSub")}</p>
          <DomainBars data={domains} />
        </div>
      </section>

      {integrity && integrity.events.length > 0 && (
        <section className="card mb-6 p-5">
          <h2 className="mb-3 font-semibold">{t("result.proctorLog")}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Mini label={t("result.tabSwitch")} value={integrity.tabBlurCount} />
            <Mini label={t("result.fsExit")} value={integrity.fullscreenExitCount} />
            <Mini label={t("result.copyAttempt")} value={integrity.copyAttempts} />
            <Mini label={t("result.pasteAttempt")} value={integrity.pasteAttempts} />
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Trophy size={16} className="muted" />
          <h2 className="font-semibold">{t("result.review", { n: review.length })}</h2>
        </div>
        <ReviewList items={JSON.parse(JSON.stringify(review))} />
      </section>
    </div>
  );

  return user
    ? <AppShell user={{ fullName: user.fullName, email: user.email }}>{body}</AppShell>
    : <><SiteHeader />{body}</>;
}

function Cell({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="px-6 py-4" style={{ background: "var(--bg-elev)" }}>
      <div className="flex items-center gap-1.5 text-[11px] muted">{icon} {label}</div>
      <div className="display mt-0.5 text-xl">{value}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-sunken)" }}>
      <div className="display text-lg">{value}</div>
      <div className="text-[11px] muted">{label}</div>
    </div>
  );
}
