import Link from "next/link";
import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { questionsByIds } from "@/lib/exams/bank";
import { ringkasAttempt, type RingkasAttempt } from "@/lib/practice/latihan";
import { PageHead } from "@/components/ui/AppShell";

export const metadata = { title: "Pantau kelas" };
export const dynamic = "force-dynamic";

/** Guru melihat, per murid, latihan mana yang sedang/sudah dikerjakan, sampai
 *  nomor berapa, dan nomor mana saja yang salah — dan per paket, nomor mana
 *  yang paling banyak salah di kelas. */
export default async function PantauKelasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const db = getDb();
  const murid = await db.listUsers(q, 200);
  const semua = await Promise.all(murid.map(async (m) => ({ m, attempts: (await db.attemptsOf(m.id)).filter((a) => a.exam === "LATIHAN") })));
  const ids = new Set(semua.flatMap((x) => x.attempts.flatMap((a) => a.formLayout.flatMap((s) => s.questionIds))));
  const bank = await questionsByIds([...ids]);

  const baris: { nama: string; email: string; id: string; daftar: RingkasAttempt[] }[] = [];
  const perPaket = new Map<string, { peserta: number; salah: Map<number, number>; total: number }>();
  for (const { m, attempts } of semua) {
    if (!attempts.length) continue;
    const daftar = (await Promise.all(attempts.map((a) => ringkasAttempt(a, bank))))
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    baris.push({ nama: m.fullName, email: m.email, id: m.id, daftar });
    for (const r of daftar) {
      const p = perPaket.get(r.judul) ?? { peserta: 0, salah: new Map(), total: r.total };
      p.peserta++;
      for (const n of r.salah) p.salah.set(n, (p.salah.get(n) ?? 0) + 1);
      perPaket.set(r.judul, p);
    }
  }
  const ringkasPaket = [...perPaket].map(([judul, p]) => ({
    judul, peserta: p.peserta, total: p.total,
    terbanyak: [...p.salah].sort((a, b) => b[1] - a[1]).slice(0, 8),
  }));

  return (
    <>
      <PageHead title="Pantau kelas" subtitle="Kemajuan dan kesalahan murid di paket latihan." />

      {ringkasPaket.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide muted">Nomor yang paling sering salah</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {ringkasPaket.map((p) => (
              <div key={p.judul} className="card p-4 text-sm">
                <div className="font-medium">{p.judul}</div>
                <div className="text-xs muted">{p.peserta} pengerjaan · {p.total} soal</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.terbanyak.length === 0 && <span className="text-xs muted">Belum ada yang salah.</span>}
                  {p.terbanyak.map(([n, c]) => (
                    <span key={n} className="chip" title={`${c} murid salah di nomor ${n}`}>No. {n} <b>×{c}</b></span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <form className="mb-3 flex gap-2">
          <input name="q" defaultValue={q ?? ""} placeholder="Cari nama / email murid" className="rounded-lg border px-3 py-2 text-sm bg-transparent" />
          <button className="btn btn-ghost">Cari</button>
        </form>
        {baris.length === 0 && <p className="text-sm muted">Belum ada murid yang mengerjakan latihan.</p>}
        <div className="grid gap-3">
          {baris.map((b) => (
            <div key={b.id} className="card p-4">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <div className="font-semibold">{b.nama}</div>
                <div className="text-xs muted">{b.email}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs muted">
                    <tr><th className="py-1 pr-3">Paket</th><th className="py-1 pr-3">Status</th><th className="py-1 pr-3">Sampai</th><th className="py-1 pr-3">Benar</th><th className="py-1 pr-3">Salah di nomor</th><th className="py-1">Skor</th></tr>
                  </thead>
                  <tbody>
                    {b.daftar.map((r) => (
                      <tr key={r.attemptId} className="border-t" style={{ borderColor: "var(--line)" }}>
                        <td className="py-1.5 pr-3">
                          {r.judul}
                          <div className="text-[11px] muted">{new Date(r.startedAt).toLocaleString("id-ID")}</div>
                        </td>
                        <td className="py-1.5 pr-3">
                          {r.status === "in_progress" ? <span className="chip" style={{ color: "var(--warn)" }}>sedang mengerjakan</span>
                            : r.status === "submitted" ? <span className="chip">selesai</span> : <span className="chip">{r.status}</span>}
                        </td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">{r.dijawab}/{r.total} <span className="muted">(no. {r.terakhir})</span></td>
                        <td className="py-1.5 pr-3">{r.benar}</td>
                        <td className="py-1.5 pr-3">
                          {r.salah.length === 0 ? <span className="muted">—</span>
                            : r.salah.map((n) => <span key={n} className="chip mr-1" style={{ color: "var(--danger, #b00)" }}>{n}</span>)}
                        </td>
                        <td className="py-1.5">
                          {r.status === "submitted"
                            ? <Link className="underline" href={`/hasil/${r.attemptId}`}>{r.skor ?? "-"}</Link>
                            : <span className="muted">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
