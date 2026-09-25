import Link from "next/link";
import { AlertTriangle, Receipt, ShieldAlert, Users } from "lucide-react";
import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { PageHead } from "@/components/ui/AppShell";
import type { ProctorLog } from "@/lib/types";
import type { ScoreReport } from "@/lib/exams/scoring";

export const metadata = { title: "Ringkasan admin" };

export default async function AdminHome() {
  await requireAdmin();
  const db = getDb();
  const [o, attempts] = await Promise.all([
    db.adminOverview(),
    db.recentAttempts(8),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHead title="Ringkasan" subtitle="Kondisi platform hari ini." />

      <div className="mb-7 grid gap-4 sm:grid-cols-2">
        <Stat icon={<Users size={15} />} label="Peserta terdaftar" value={String(o.users)} />
        <Stat icon={<Receipt size={15} />} label="Latihan dikerjakan" value={String(o.submitted)}
          sub={`${o.demoAttempts} demo · ${o.attempts} total`} />
      </div>

      {o.flaggedAttempts > 0 && (
        <div className="mb-7 grid gap-3 sm:grid-cols-2">
          {o.flaggedAttempts > 0 && (
            <Alert
              icon={<ShieldAlert size={16} />}
              tone="var(--danger)"
              title={`${o.flaggedAttempts} attempt berskor integritas rendah`}
              body="Skor di bawah 60 tidak masuk papan peringkat dan perlu ditinjau manusia."
              href="/admin/peserta"
              cta="Lihat peserta"
            />
          )}
        </div>
      )}

      <div className="grid gap-4">
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Attempt terbaru</h2>
          {!attempts.length ? <p className="text-sm muted">Belum ada attempt.</p> : (
            <ul className="divide-y text-sm" style={{ borderColor: "var(--border)" }}>
              {attempts.map((a) => {
                const score = a.score as ScoreReport | null;
                const integ = (a.integrity as ProctorLog | undefined)?.integrityScore ?? 100;
                return (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <span className="chip">{a.exam}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {a.fullName ?? (a.isDemo ? "Tamu demo" : "—")}
                    </span>
                    {integ < 60 && (
                      <AlertTriangle size={13} style={{ color: "var(--danger)" }} aria-label="integritas rendah" />
                    )}
                    <span className="tabular-nums">{score ? `${score.total}` : "—"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs muted">{icon} {label}</div>
      <div className="display text-xl">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] muted">{sub}</div>}
    </div>
  );
}

function Alert({ icon, tone, title, body, href, cta }: {
  icon: React.ReactNode; tone: string; title: string; body: string; href: string; cta: string;
}) {
  return (
    <div className="card p-4" style={{ borderColor: tone }}>
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold" style={{ color: tone }}>
        {icon} {title}
      </div>
      <p className="mb-2 text-xs muted">{body}</p>
      <Link href={href} className="text-xs underline">{cta} →</Link>
    </div>
  );
}
