import Link from "next/link";
import { Flame, PlayCircle, Target, TrendingUp } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getBlueprint } from "@/lib/exams/blueprints";
import { getLocale, intlTag, translatorFor } from "@/lib/i18n";
import { PageHead } from "@/components/ui/AppShell";
import { ScoreTrend } from "@/components/dashboard/ScoreTrend";
import { DomainBars } from "@/components/dashboard/DomainBars";
import type { ScoreReport } from "@/lib/exams/scoring";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = (await currentUser())!;
  const locale = await getLocale();
  const tag = intlTag(locale);
  const t = translatorFor(locale);
  const attempts = await getDb().attemptsOf(user.id);

  const done = attempts.filter((a) => a.status === "submitted" && a.score);
  const scores = done.map((a) => a.score as ScoreReport);

  const avgPct = scores.length
    ? Math.round((scores.reduce((s, r) => s + r.total / (r.totalMax || 1), 0) / scores.length) * 100)
    : 0;

  // agregat domain dari seluruh percobaan yang sudah dinilai
  const domainAgg = new Map<string, { c: number; t: number }>();
  for (const r of scores) {
    for (const s of r.sections) {
      for (const d of s.byDomain) {
        const cur = domainAgg.get(d.domain) ?? { c: 0, t: 0 };
        cur.c += d.correct; cur.t += d.total;
        domainAgg.set(d.domain, cur);
      }
    }
  }
  const domains = [...domainAgg]
    .map(([domain, v]) => ({ domain, pct: v.t ? Math.round((v.c / v.t) * 100) : 0, total: v.t }))
    .sort((a, b) => a.pct - b.pct);

  const trend = done
    .slice()
    .reverse()
    .map((a) => ({
      label: new Date(a.submittedAt ?? a.startedAt).toLocaleDateString(tag, { day: "2-digit", month: "short" }),
      exam: a.exam,
      value: Math.round(((a.score as ScoreReport).total / ((a.score as ScoreReport).totalMax || 1)) * 100),
      total: (a.score as ScoreReport).total,
    }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHead
        title={t("dash.greeting", { name: user.fullName.split(" ")[0] || t("exam.candidate") })}
        subtitle={t("dash.sub")}
        action={<Link href="/journey" className="btn btn-ghost">{t("dash.fullJourney")}</Link>}
      />

      <div className="mb-7 grid gap-4 sm:grid-cols-3">
        <Stat icon={<Target size={16} />} label={t("dash.avgAll")} value={`${avgPct}%`}
          sub={scores.length ? t("dash.fromTests", { n: scores.length }) : t("dash.noTests")} />
        <Stat icon={<TrendingUp size={16} />} label={t("dash.bestScore")}
          value={scores.length ? String(Math.max(...scores.map((s) => s.total))) : "—"}
          sub={scores.length ? bestExamName(done) : t("dash.noTests")} />
        <Stat icon={<Flame size={16} />} label={t("dash.completed")} value={String(done.length)}
          sub={t("dash.inProgress", { n: attempts.length - done.length })} />
      </div>

      <section className="mb-7">
        <div className="card flex flex-wrap items-center gap-4 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <PlayCircle size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Latihan gratis dari guru</h2>
            <p className="mt-0.5 text-sm muted">Paket latihan, bank soal per topik, dan riwayat nilaimu ada di menu Latihan.</p>
          </div>
          <Link href="/latihan" className="btn btn-primary">Buka Latihan</Link>
        </div>
      </section>

      {trend.length > 0 && (
        <section className="mb-7 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="card p-5">
            <h2 className="mb-1 font-semibold">{t("dash.scoreTrend")}</h2>
            <p className="mb-4 text-xs muted">{t("dash.scoreTrendSub")}</p>
            <ScoreTrend data={trend} />
          </div>
          <div className="card p-5">
            <h2 className="mb-1 font-semibold">{t("dash.needsWork")}</h2>
            <p className="mb-4 text-xs muted">{t("dash.needsWorkSub")}</p>
            <DomainBars data={domains.slice(0, 6)} />
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider muted">{t("dash.recent")}</h2>
        {attempts.length === 0 ? (
          <p className="text-sm muted">{t("dash.noHistory")}</p>
        ) : (
          <ul className="space-y-2">
            {attempts.slice(0, 5).map((a) => {
              const s = a.score as ScoreReport | undefined;
              return (
                <li key={a.id}>
                  <Link href={a.status === "submitted" ? `/hasil/${a.id}` : `/ujian/${a.id}`}
                    className="card flex items-center gap-4 px-4 py-3 transition hover:opacity-90">
                    <span className="chip">{a.exam}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.formTitle}</span>
                      <span className="block text-xs muted">
                        {new Date(a.startedAt).toLocaleString(tag, { dateStyle: "medium", timeStyle: "short" })}
                        {a.isDemo ? " · demo" : ""}
                      </span>
                    </span>
                    {s ? (
                      <span className="display text-lg">{s.total}<span className="text-xs muted">/{s.totalMax}</span></span>
                    ) : (
                      <span className="chip" style={{ color: "var(--warn)" }}>{t("dash.running")}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs muted">{icon} {label}</div>
      <div className="display text-2xl">{value}</div>
      <div className="mt-0.5 text-[11px] muted">{sub}</div>
    </div>
  );
}

function bestExamName(done: { exam: string; score?: unknown }[]) {
  let best = done[0];
  for (const a of done) {
    if (((a.score as ScoreReport)?.total ?? 0) > ((best.score as ScoreReport)?.total ?? 0)) best = a;
  }
  return getBlueprint(best.exam)?.name ?? best.exam;
}
