import Link from "next/link";
import { BookOpen, Printer, Shuffle } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listPaket } from "@/lib/practice/paket";
import { kelompokBank } from "@/lib/practice/latihan";
import { PageHead, EmptyState } from "@/components/ui/AppShell";
import { MulaiLatihan } from "./MulaiLatihan";
import { aksesLatihan } from "@/lib/practice/akses";

export const metadata = { title: "Latihan" };
export const dynamic = "force-dynamic";

export default async function LatihanPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const cari = (q ?? "").trim().toLowerCase();
  const user = (await currentUser())!;
  const [paket, kelompok, attempts, akses] = await Promise.all([
    listPaket(), kelompokBank(), getDb().attemptsOf(user.id), aksesLatihan(user),
  ]);
  const boleh = akses.boleh;
  const semuaTerbit = paket.filter((p) => p.terbit && p.questionIds.length);
  /* Kode ujian yang cocok persis menang: guru membagikan kode, murid/pembeli
   * mengetiknya, dan hanya paket itu yang tampil. Selain itu pencarian bebas
   * di judul, mapel, kelas, dan topik. */
  const persis = cari ? semuaTerbit.filter((p) => p.kode.toLowerCase() === cari) : [];
  const terbit = !cari ? semuaTerbit : persis.length ? persis
    : semuaTerbit.filter((p) => [p.judul, p.mapel, p.kelas, p.topik, p.kode].join(" ").toLowerCase().includes(cari));
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

      {!akses.murid && (
        <div className="card mb-6 flex flex-wrap items-center gap-3 p-4 text-sm" style={{ borderColor: boleh ? undefined : "var(--warn)" }}>
          <div className="min-w-0 flex-1">
            {boleh
              ? <>Paket latihanmu aktif sampai <b>{akses.sampai ? new Date(akses.sampai).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "—"}</b>.</>
              : <><b>Paket latihanmu belum aktif atau sudah habis.</b> Pilih paket mulai Rp20.000/minggu untuk membuka semua latihan.</>}
          </div>
          <Link href="/beli" className={`btn ${boleh ? "btn-ghost" : "btn-primary"}`}>{boleh ? "Perpanjang" : "Beli paket"}</Link>
        </div>
      )}

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide muted">Paket dari guru</h2>
          <form className="ml-auto flex gap-2">
            <input name="q" defaultValue={q ?? ""} placeholder="Cari nama ujian atau kode ujian" className="input !w-auto !py-1.5 text-sm" />
            <button className="btn btn-ghost !px-3 !py-1.5 text-sm">Cari</button>
            {cari && <Link href="/latihan" className="btn btn-ghost !px-3 !py-1.5 text-sm">Semua</Link>}
          </form>
        </div>
        {terbit.length === 0 ? (
          <EmptyState icon={<BookOpen size={20} />} title={cari ? "Tidak ditemukan" : "Belum ada paket"} body={cari ? `Tidak ada ujian dengan nama/kode "${q}".` : "Guru belum menerbitkan paket latihan."} />
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
                    {boleh && <MulaiLatihan body={{ paketId: p.id }} label={selesai.length ? "Kerjakan lagi" : "Mulai"} />}
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
                  {boleh && <MulaiLatihan kecil body={{ mapel, jumlah: 10 }} label="10 soal acak" />}
                </div>
                <ul className="divide-y text-sm" style={{ borderColor: "var(--line)" }}>
                  {daftar.map((k) => (
                    <li key={`${k.kelas}|${k.topik}`} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        {k.topik}
                        <span className="muted"> · {k.kelas ? `Kelas ${k.kelas} · ` : ""}{k.jumlah} soal</span>
                      </span>
                      {boleh && <MulaiLatihan kecil body={{ mapel, kelas: k.kelas, topik: k.topik, jumlah: Math.min(10, k.jumlah) }} label="Latih" />}
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
