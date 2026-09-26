import Link from "next/link";
import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { questionsByIds } from "@/lib/exams/bank";
import { remainingSec } from "@/lib/exams/attempt";
import { listPaket } from "@/lib/practice/paket";
import { milikPaket, ringkasAttempt, statusPaket, tutupYangKedaluwarsa, type RingkasAttempt, type StatusPaket } from "@/lib/practice/latihan";
import { PageHead } from "@/components/ui/AppShell";
import { SegarkanOtomatis } from "./SegarkanOtomatis";
import { posisiDari } from "@/lib/practice/posisi";

export const metadata = { title: "Pantau kelas" };
export const dynamic = "force-dynamic";

const jam = (iso: string) => new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const menit = (d: number) => `${Math.floor(d / 60)}:${String(d % 60).padStart(2, "0")}`;
const Nomor = ({ n, warna }: { n: number[]; warna: string }) =>
  n.length === 0 ? <span className="muted">—</span>
    : <>{n.map((x) => <span key={x} className="chip mr-1" style={{ color: warna }}>{x}</span>)}</>;

/** Guru melihat, per murid dan per paket: yang sedang dikerjakan (sudah
 *  dijawab berapa, benar/salah berapa — langsung, tiap autosave 15 detik),
 *  nilai awal → nilai setelah perbaikan, dan nomor yang masih salah. Murid
 *  sendiri tidak melihat benar/salah sebelum mengirim. */
export default async function PantauKelasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const db = getDb();
  const [murid, semuaPaket] = await Promise.all([db.listUsers(q, 200), listPaket()]);
  const bank = await questionsByIds(semuaPaket.flatMap((p) => p.questionIds));

  type Live = { r: RingkasAttempt; sisa: number | null; nomor: number | null; attemptId: string };
  const baris: { nama: string; username: string; id: string; paket: { judul: string; kode: string; st: StatusPaket; live: Live | null }[] }[] = [];
  const perPaket = new Map<string, { judul: string; peserta: number; salah: Map<number, number>; total: number }>();

  for (const m of murid) {
    let attempts = (await db.attemptsOf(m.id)).filter((a) => a.exam === "LATIHAN");
    if (!attempts.length) continue;
    if (await tutupYangKedaluwarsa(attempts)) attempts = (await db.attemptsOf(m.id)).filter((a) => a.exam === "LATIHAN");
    const daftar = [];
    for (const p of semuaPaket) {
      if (!attempts.some((a) => milikPaket(a, p))) continue;
      const st = await statusPaket(p, attempts, bank);
      const nomor = new Map(p.questionIds.map((id, i) => [id, i + 1]));
      let live: Live | null = null;
      if (st.berjalan) {
        const tenggat = st.berjalan.sectionDeadlines?.latihan;
        const pos = posisiDari(st.berjalan.id);
        live = {
          r: await ringkasAttempt(st.berjalan, bank, nomor), attemptId: st.berjalan.id,
          sisa: !st.berjalan.formLayout[0]?.tanpaWaktu && tenggat ? remainingSec(tenggat) : null,
          nomor: pos ? nomor.get(pos.questionId) ?? null : null,
        };
      }
      daftar.push({ judul: p.judul, kode: p.kode, st, live });
      if (st.selesai.length) {
        const agg = perPaket.get(p.id) ?? { judul: p.judul, peserta: 0, salah: new Map(), total: st.total };
        agg.peserta++;
        for (const n of [...st.selesai[0].salah, ...st.selesai[0].kosong]) agg.salah.set(n, (agg.salah.get(n) ?? 0) + 1);
        perPaket.set(p.id, agg);
      }
    }
    if (daftar.length) baris.push({ nama: m.fullName, username: m.email, id: m.id, paket: daftar });
  }
  const ringkasPaket = [...perPaket.values()].map((p) => ({
    ...p, terbanyak: [...p.salah].sort((a, b) => b[1] - a[1]).slice(0, 8),
  }));

  /* Yang sedang mengerjakan di atas. */
  baris.sort((x, y) => Number(y.paket.some((p) => p.live)) - Number(x.paket.some((p) => p.live)));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead title="Pantau kelas" subtitle="Murid yang sedang mengerjakan tampil di atas — diperbarui otomatis. Kanvas coret murid dibuka di aplikasi Exact Canvas." />
      <SegarkanOtomatis detik={5} />

      <section className="mb-8">
        <form className="mb-3 flex gap-2">
          <input name="q" defaultValue={q ?? ""} placeholder="Cari nama / username murid" className="input !w-auto" />
          <button className="btn btn-ghost">Cari</button>
        </form>
        {baris.length === 0 && <p className="text-sm muted">Belum ada murid yang mengerjakan latihan.</p>}
        <div className="grid gap-4">
          {baris.map((b) => (
            <div key={b.id} className="card p-4">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <div className="font-semibold">{b.nama}</div>
                <div className="text-xs muted">{b.username}</div>
              </div>
              <div className="grid gap-3">
                {b.paket.map(({ judul, kode, st, live }) => (
                  <div key={kode} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                    <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-medium">{judul}</span>
                      <span className="font-mono text-xs muted">{kode}</span>
                      {st.selesai.length > 0 && (
                        <span className="ml-auto text-sm">
                          Nilai awal <b>{st.nilaiAwal}</b>
                          {st.nilaiAkhir !== st.nilaiAwal && <> → sekarang <b>{st.nilaiAkhir}</b></>}
                        </span>
                      )}
                    </div>

                    {live && (
                      <div className="mb-2 rounded-md p-3 text-sm" style={{ background: "color-mix(in srgb, var(--warn) 10%, transparent)" }}>
                        <div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="chip" style={{ color: "var(--warn)" }}>{live.r.perbaikan ? "sedang perbaikan" : "sedang mengerjakan"}</span>
                            {live.nomor && <span>Di nomor <b>{live.nomor}</b></span>}
                            {live.sisa !== null && <span className="muted">sisa {menit(live.sisa)}</span>}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                            <span>Dijawab <b>{live.r.dijawab}/{live.r.total}</b></span>
                            <span>Benar <b style={{ color: "var(--accent)" }}>{live.r.benar}</b></span>
                            <span>Salah <b style={{ color: "var(--danger)" }}>{live.r.salah.length}</b></span>
                          </div>
                          {live.r.salah.length > 0 && <div className="mt-1 text-xs">Salah di nomor <Nomor n={live.r.salah} warna="var(--danger)" /></div>}
                          <Link href={`/admin/kelas/${live.attemptId}`} className="btn btn-primary mt-3 !py-1.5 text-sm">Lihat soal & jawaban</Link>
                        </div>
                      </div>
                    )}

                    {st.selesai.length > 0 && (
                      <div className="text-xs">
                        {st.masihSalah.length > 0
                          ? <>Masih salah: <Nomor n={st.masihSalah} warna="var(--danger)" /></>
                          : <span style={{ color: "var(--accent)" }}>Semua nomor sudah benar.</span>}
                      </div>
                    )}

                    {[...st.selesai, ...st.perbaikan].length > 0 && (
                      <details className="mt-2 text-sm">
                        <summary className="cursor-pointer text-xs muted">Riwayat ({st.selesai.length + st.perbaikan.length})</summary>
                        <table className="mt-1 w-full text-sm">
                          <tbody>
                            {[...st.selesai, ...st.perbaikan].sort((x, y) => (x.startedAt < y.startedAt ? 1 : -1)).map((r) => (
                              <tr key={r.attemptId} className="border-t" style={{ borderColor: "var(--border)" }}>
                                <td className="py-1 pr-3 text-xs muted whitespace-nowrap">{jam(r.startedAt)}</td>
                                <td className="py-1 pr-3"><span className="chip">{r.perbaikan ? "Perbaikan" : "Pengerjaan"}</span></td>
                                <td className="py-1 pr-3 whitespace-nowrap">benar {r.benar}/{r.total}</td>
                                <td className="py-1 pr-3 text-xs">
                                  <Nomor n={r.salah} warna="var(--danger)" />
                                  {r.kosong.length > 0 && <span className="muted"> kosong: {r.kosong.join(", ")}</span>}
                                </td>
                                <td className="py-1 text-right"><Link className="text-xs underline" href={`/hasil/${r.attemptId}`}>Lihat</Link></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {ringkasPaket.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide muted">Nomor yang paling sering salah (pengerjaan pertama)</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {ringkasPaket.map((p) => (
              <div key={p.judul} className="card p-4 text-sm">
                <div className="font-medium">{p.judul}</div>
                <div className="text-xs muted">{p.peserta} murid · {p.total} soal</div>
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
    </div>
  );
}
