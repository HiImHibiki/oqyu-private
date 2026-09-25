import Link from "next/link";
import { BookOpen, Printer, Shuffle } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { paketUntuk } from "@/lib/practice/paket";
import { attemptSelesaiPaket } from "@/lib/practice/latihan";
import { PageHead, EmptyState } from "@/components/ui/AppShell";
import { MulaiLatihan } from "./MulaiLatihan";
import { GabungKode } from "./GabungKode";

export const metadata = { title: "Latihan" };
export const dynamic = "force-dynamic";

export default async function LatihanPage({ searchParams }: { searchParams: Promise<{ kode?: string; q?: string }> }) {
  const sp = await searchParams;
  const user = (await currentUser())!;
  const [terbit, attempts] = await Promise.all([paketUntuk(user), getDb().attemptsOf(user.id)]);
  const guru = user.role === "admin" || user.role === "reviewer";
  const riwayat = attempts.filter((a) => a.exam === "LATIHAN");
  const riwayatJudul = new Map<string, typeof riwayat>();
  for (const a of riwayat) riwayatJudul.set(a.formTitle, [...(riwayatJudul.get(a.formTitle) ?? []), a]);

  return (
    <>
      <PageHead title="Latihan" subtitle="Masukkan kode ujian dari guru untuk membuka paket soalnya." />

      <GabungKode awal={(sp.kode ?? sp.q ?? "").slice(0, 12)} />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide muted">{guru ? "Semua paket terbit (tampilan guru)" : "Paket saya"}</h2>
        {terbit.length === 0 ? (
          <EmptyState icon={<BookOpen size={20} />} title="Belum ada paket" body="Masukkan kode ujian dari guru di kotak di atas." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {terbit.map((p) => {
              const r = (riwayatJudul.get(p.judul) ?? []);
              const selesai = r.filter((a) => a.status === "submitted");
              const jalan = r.find((a) => a.status === "in_progress");
              const terbaik = selesai.reduce<number | null>((m, a) => Math.max(m ?? 0, a.score?.total ?? 0), null);
              /* Dicocokkan lewat id soal, bukan judul seperti chip skor di
               * atas — ini harus sama persis dengan yang dipakai rute cetak,
               * supaya label tombol tidak menjanjikan isi yang berbeda. */
              const sudahKerja = attemptSelesaiPaket(riwayat, p) !== null;
              return (
                <div key={p.id} className="card flex flex-col gap-3 p-5">
                  <div>
                    <div className="font-semibold">{p.judul}</div>
                    <div className="text-xs muted">Kode ujian <b className="font-mono tracking-wider">{p.kode}</b></div>
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
                    <a className="btn btn-ghost !px-3" href={`/api/latihan/cetak?id=${p.id}`} target="_blank" rel="noreferrer"
                      title={sudahKerja ? "PDF: soal, jawabanmu, kunci & pembahasan" : "PDF lembar soal (kunci muncul setelah kamu mengerjakan)"}>
                      <Printer size={16} /> {sudahKerja ? "PDF + jawabanku" : "PDF"}
                    </a>
                  </div>
                </div>
              );
            })}
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
