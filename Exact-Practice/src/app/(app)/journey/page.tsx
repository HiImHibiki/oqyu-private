import { getLocale, intlTag, translatorFor } from "@/lib/i18n";
import Link from "next/link";
import { CheckCircle2, Circle, Clock3, ShieldAlert } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getBlueprint } from "@/lib/exams/blueprints";
import { EmptyState, PageHead } from "@/components/ui/AppShell";
import type { ScoreReport } from "@/lib/exams/scoring";
import type { ProctorLog } from "@/lib/types";

export const metadata = { title: "Journey" };

export default async function JourneyPage() {
  const user = (await currentUser())!;
  const locale = await getLocale();
  const tag = intlTag(locale);
  const t = translatorFor(locale);
  const attempts = await getDb().attemptsOf(user.id);
  const ents = await getDb().entitlements(user.id);

  const byExam = new Map<string, typeof attempts>();
  for (const a of attempts) byExam.set(a.exam, [...(byExam.get(a.exam) ?? []), a]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHead title={t("journey.title")} subtitle={t("journey.sub")} />

      {attempts.length === 0 ? (
        <EmptyState title={t("journey.emptyTitle")}
          body={t("journey.emptyBody")}
          action={<Link href="/dashboard" className="btn btn-primary mt-2">Mulai try out</Link>} />
      ) : (
        [...byExam].map(([exam, list]) => {
          const bp = getBlueprint(exam);
          const ent = ents.filter((e) => e.exam === exam);
          const quota = ent.reduce((a, e) => a + (e.attemptsTotal - e.attemptsUsed), 0);
          const done = list.filter((a) => a.status === "submitted" && a.score);
          const avg = done.length
            ? Math.round(done.reduce((s, a) => s + (a.score as ScoreReport).total, 0) / done.length)
            : null;

          return (
            <section key={exam} className="mb-9">
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div>
                  <span className="chip mb-1">{exam}</span>
                  <h2 className="display text-xl">{bp?.name ?? exam}</h2>
                </div>
                <div className="ml-auto flex gap-5 text-right text-sm">
                  <div>
                    <div className="display text-lg">{avg ?? "—"}</div>
                    <div className="text-[11px] muted">rata-rata</div>
                  </div>
                  <div>
                    <div className="display text-lg">{done.length}</div>
                    <div className="text-[11px] muted">selesai</div>
                  </div>
                  <div>
                    <div className="display text-lg">{quota}</div>
                    <div className="text-[11px] muted">kuota</div>
                  </div>
                </div>
              </div>

              <ol className="relative space-y-3 border-l pl-6" style={{ borderColor: "var(--border)" }}>
                {list.map((a) => {
                  const s = a.score as ScoreReport | undefined;
                  const integ = a.integrity as ProctorLog | undefined;
                  const flagged = (integ?.integrityScore ?? 100) < 80;
                  return (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[31px] top-4 flex h-5 w-5 items-center justify-center rounded-full"
                        style={{ background: "var(--bg)" }}>
                        {a.status === "submitted"
                          ? <CheckCircle2 size={18} style={{ color: "var(--ok)" }} />
                          : <Circle size={18} style={{ color: "var(--warn)" }} />}
                      </span>
                      <Link href={a.status === "submitted" ? `/hasil/${a.id}` : `/ujian/${a.id}`}
                        className="card flex flex-wrap items-center gap-4 px-4 py-3.5 transition hover:opacity-90">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{a.formTitle}</span>
                            {a.isDemo && <span className="chip">demo</span>}
                            {flagged && (
                              <span className="chip" style={{ color: "var(--warn)" }}>
                                <ShieldAlert size={11} /> integritas {integ?.integrityScore}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs muted">
                            <Clock3 size={11} />
                            {new Date(a.submittedAt ?? a.startedAt).toLocaleString(tag, { dateStyle: "full", timeStyle: "short" })}
                          </div>
                        </div>
                        {s ? (
                          <div className="text-right">
                            <div className="display text-xl">{s.total}<span className="text-xs muted">/{s.totalMax}</span></div>
                            {s.grade && <div className="text-xs muted">grade {s.grade}</div>}
                            {s.percentileHint !== undefined && <div className="text-[11px] muted">persentil ~{s.percentileHint}</div>}
                          </div>
                        ) : (
                          <span className="btn btn-ghost !py-1.5 !text-xs">Lanjutkan</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })
      )}
    </div>
  );
}
