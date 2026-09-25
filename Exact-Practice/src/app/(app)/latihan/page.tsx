import Link from "next/link";
import { BookOpen, History, PlayCircle, Printer, RotateCcw } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { questionsByIds } from "@/lib/exams/bank";
import { paketUntuk } from "@/lib/practice/paket";
import { attemptSelesaiPaket, statusPaket, tutupYangKedaluwarsa } from "@/lib/practice/latihan";
import { PageHead, EmptyState } from "@/components/ui/AppShell";
import { MulaiLatihan } from "./MulaiLatihan";
import { GabungKode } from "./GabungKode";

export const metadata = { title: "Latihan" };
export const dynamic = "force-dynamic";

const tanggal = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function LatihanPage({ searchParams }: { searchParams: Promise<{ kode?: string; q?: string }> }) {
  const sp = await searchParams;
  const user = (await currentUser())!;
  const guru = user.role === "admin" || user.role === "reviewer";
  const db = getDb();
  let attempts = await db.attemptsOf(user.id);
  /* Waktu habis tapi tab sudah ditutup sebelum kirim otomatis: nilai sekarang,
   * supaya riwayat & tombol perbaikan langsung benar. */
  if (await tutupYangKedaluwarsa(attempts)) attempts = await db.attemptsOf(user.id);

  const paket = await paketUntuk(user);
  const bank = await questionsByIds(paket.flatMap((p) => p.questionIds));
  const daftar = await Promise.all(paket.map(async (p) => ({ p, st: await statusPaket(p, attempts, bank) })));

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHead title="Latihan" subtitle="Masukkan kode ujian dari guru untuk membuka paket soalnya." />

      <GabungKode awal={(sp.kode ?? sp.q ?? "").slice(0, 12)} />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide muted">{guru ? "Semua paket terbit (tampilan guru)" : "Paket saya"}</h2>
        {daftar.length === 0 ? (
          <EmptyState icon={<BookOpen size={20} />} title="Belum ada paket" body="Masukkan kode ujian dari guru di kotak di atas." />
        ) : (
          <div className="grid gap-4">
            {daftar.map(({ p, st }) => {
              const sudahKerja = attemptSelesaiPaket(attempts, p) !== null;
              const terakhir = st.selesai.at(-1);
              const riwayat = [...st.selesai, ...st.perbaikan].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
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

                  {st.selesai.length > 0 && (
                    <div className="rounded-lg px-3 py-2.5 text-sm" style={{ background: "var(--bg-sunken)" }}>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span>Nilai awal <b className="tabular-nums">{st.nilaiAwal}</b></span>
                        {st.nilaiAkhir !== st.nilaiAwal && <span>→ sekarang <b className="tabular-nums">{st.nilaiAkhir}</b></span>}
                        <span className="muted">· benar {st.benarGabungan} dari {st.total}</span>
                      </div>
                      {st.masihSalah.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs">
                          <span className="muted">Masih salah:</span>
                          {st.masihSalah.map((n) => <span key={n} className="chip" style={{ color: "var(--danger)" }}>{n}</span>)}
                        </div>
                      ) : <div className="mt-1 text-xs" style={{ color: "var(--accent)" }}>Semua nomor sudah benar.</div>}
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    {st.berjalan ? (
                      <Link href={`/ujian/${st.berjalan.id}`} className="btn btn-primary">
                        <PlayCircle size={16} /> {st.berjalan.formLayout[0]?.perbaikan ? "Lanjutkan perbaikan" : "Lanjutkan"}
                      </Link>
                    ) : st.selesai.length === 0 ? (
                      <MulaiLatihan body={{ paketId: p.id }} label="Mulai" />
                    ) : (
                      <>
                        {st.masihSalah.length > 0 && (
                          <MulaiLatihan body={{ paketId: p.id, perbaikan: true }} ikon="ulang"
                            label={`Kerjakan yang salah (${st.masihSalah.length})`} />
                        )}
                        <MulaiLatihan body={{ paketId: p.id }} label="Kerjakan ulang semua" gaya="ghost" />
                      </>
                    )}
                    {terakhir && <Link href={`/hasil/${terakhir.attemptId}`} className="btn btn-ghost">Lihat hasil</Link>}
                    <a className="btn btn-ghost !px-3" href={`/api/latihan/cetak?id=${p.id}`} target="_blank" rel="noreferrer"
                      title={sudahKerja ? "PDF: soal, jawabanmu, kunci & pembahasan" : "PDF lembar soal (kunci muncul setelah kamu mengerjakan)"}>
                      <Printer size={16} /> {sudahKerja ? "PDF + jawabanku" : "PDF"}
                    </a>
                  </div>

                  {riwayat.length > 0 && (
                    <details className="text-sm">
                      <summary className="flex cursor-pointer items-center gap-1.5 text-xs muted"><History size={13} /> Riwayat ({riwayat.length})</summary>
                      <ul className="mt-2 divide-y" style={{ borderColor: "var(--line)" }}>
                        {riwayat.map((r) => (
                          <li key={r.attemptId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                            <span className="text-xs muted tabular-nums">{tanggal(r.startedAt)}</span>
                            <span className="chip">{r.perbaikan ? <><RotateCcw size={11} /> Perbaikan</> : "Pengerjaan"}</span>
                            <span className="tabular-nums">benar {r.benar}/{r.total}</span>
                            {[...r.salah, ...r.kosong].length > 0 && (
                              <span className="text-xs muted">salah no. {[...r.salah, ...r.kosong].sort((a, b) => a - b).join(", ")}</span>
                            )}
                            <Link href={`/hasil/${r.attemptId}`} className="ml-auto text-xs underline">Lihat</Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
