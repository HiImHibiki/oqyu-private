import Link from "next/link";
import { BookOpen, Printer, Shuffle } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listPaket } from "@/lib/practice/paket";
import { kelompokBank } from "@/lib/practice/latihan";
import { PageHead, EmptyState } from "@/components/ui/AppShell";
import { MulaiLatihan } from "./MulaiLatihan";

export const metadata = { title: "Latihan" };
export const dynamic = "force-dynamic";

export default async function LatihanPage() {
  const user = (await currentUser())!;
  const [paket, kelompok, attempts] = await Promise.all([
    listPaket(), kelompokBank(), getDb().attemptsOf(user.id),
  ]);
  const terbit = paket.filter((p) => p.terbit && p.questionIds.length);
  const riwayat = attempts.filter((a) => a.exam === "LATIHAN");
  const riwayatJudul = new Map<string, typeof riwayat>();
  for (const a of riwayat) riwayatJudul.set(a.formTitle, [...(riwayatJudul.get(a.formTitle) ?? []), a]);

  /* Kelompok bank: mapel → kelas → topik, supaya murid bisa memilih sendiri
   * latihan acak untuk topik yang ia rasa lemah. */
  const perMapel = new Map<string, typeof kelompok>();
  for (const k of kelompok) perMapel.set(k.mapel, [...(perMapel.get(k.mapel) ?? []), k]);

  return (
    <>
      <PageHead title="Latihan" subtitle="Paket dari guru, atau pilih topik sendiri dari bank soal." />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide muted">Paket dari guru</h2>
        {terbit.length === 0 ? (
          <EmptyState icon={<BookOpen size={20} />} title="Belum ada paket" body="Guru belum menerbitkan paket latihan." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {terbit.map((p) => {
              const r = (riwayatJudul.get(p.judul) ?? []);
              const selesai = r.filter((a) => a.status === "submitted");
              const jalan = r.find((a) => a.status === "in_progress");
              const terbaik = selesai.reduce<number | null>((m, a) => Math.max(m ?? 0, a.score?.total ?? 0), null);
              return (
                <div key={p.id} className="card flex flex-col gap-3 p-5">
                  <div>
                    <div className="font-semibold">{p.judul}</div>
                    <div className="text-xs muted">
                      {[p.mapel, p.kelas && `Kelas ${p.kelas}`, p.topik].filter(Boolean).join(" · ")}
                      {" · "}{p.questionIds.length} soal · {p.durasiMenit} menit
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {terbaik !== null && <span className="chip">Skor terbaik {terbaik}</span>}
                    {selesai.length > 0 && <span className="chip">{selesai.length}× selesai</span>}
                    {jalan && <Link href={`/ujian/${jalan.id}`} className="chip underline">Lanjutkan yang belum selesai</Link>}
                  </div>
                  <div className="mt-auto flex items-center gap-2">
                    <MulaiLatihan body={{ paketId: p.id }} label={selesai.length ? "Kerjakan lagi" : "Mulai"} />
                    <a className="btn btn-ghost !px-3" href={`/api/latihan/cetak?id=${p.id}`} target="_blank" rel="noreferrer" title="Cetak / unduh PDF">
                      <Printer size={16} /> PDF
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide muted">Bank soal — latihan acak</h2>
        {perMapel.size === 0 ? (
          <p className="text-sm muted">Bank soal masih kosong.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...perMapel].map(([mapel, daftar]) => (
              <div key={mapel} className="card p-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-semibold">{mapel}</div>
                  <MulaiLatihan kecil body={{ mapel, jumlah: 10 }} label="10 soal acak" />
                </div>
                <ul className="divide-y text-sm" style={{ borderColor: "var(--line)" }}>
                  {daftar.map((k) => (
                    <li key={`${k.kelas}|${k.topik}`} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        {k.topik}
                        <span className="muted"> · {k.kelas ? `Kelas ${k.kelas} · ` : ""}{k.jumlah} soal</span>
                      </span>
                      <MulaiLatihan kecil body={{ mapel, kelas: k.kelas, topik: k.topik, jumlah: Math.min(10, k.jumlah) }} label="Latih" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {riwayat.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide muted">Riwayat latihan</h2>
          <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
            {riwayat.slice().sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)).slice(0, 20).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">{a.formTitle}</div>
                  <div className="text-xs muted">{new Date(a.startedAt).toLocaleString("id-ID")}</div>
                </div>
                {a.status === "submitted"
                  ? <Link href={`/hasil/${a.id}`} className="chip underline">Skor {a.score?.total ?? "-"}</Link>
                  : a.status === "in_progress"
                    ? <Link href={`/ujian/${a.id}`} className="btn btn-ghost !px-3 !py-1.5 text-xs"><Shuffle size={14} /> Lanjutkan</Link>
                    : <span className="chip">{a.status}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
