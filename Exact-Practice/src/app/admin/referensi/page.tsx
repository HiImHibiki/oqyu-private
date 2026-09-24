import { ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";
import { requireAdmin } from "@/lib/adminGuard";
import { EXAM_REFERENCE, SCORING_MODELS, CSCA_REQUIREMENTS } from "@/lib/exams/reference";
import { EXAM_LIST } from "@/lib/exams/blueprints";
import { FORMULA_SHEETS } from "@/lib/exams/formulas";
import { PageHead } from "@/components/ui/AppShell";

export const metadata = { title: "Referensi ujian" };

const CONF: Record<string, { label: string; color: string }> = {
  verified: { label: "terverifikasi dari dokumen resmi", color: "var(--ok)" },
  reported: { label: "dari sumber sekunder, cek ulang tiap tahun", color: "var(--warn)" },
  estimated: { label: "perkiraan, belum diverifikasi", color: "var(--danger)" },
};

export default async function ReferensiPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHead
        title="Referensi ujian"
        subtitle="Spesifikasi resmi, model skoring, dan taksonomi materi — beserta sumber dan tanggal verifikasinya."
      />

      <div className="card mb-7 flex gap-3 p-4" style={{ borderColor: "var(--warn)" }}>
        <TriangleAlert size={18} className="mt-0.5 shrink-0" style={{ color: "var(--warn)" }} />
        <div className="text-sm">
          <p className="font-semibold">Basis data ini berisi spesifikasi, bukan soal.</p>
          <p className="mt-1 muted">
            Soal SAT milik College Board, past paper A Level milik Cambridge, dan soal UTBK tidak
            pernah dipublikasikan. Menyalinnya ke bank soal komersial adalah pelanggaran hak cipta.
            Yang ada di sini adalah struktur, bobot, dan model skoring — dari sinilah prompt AI
            menghasilkan soal orisinal yang berperilaku seperti soal aslinya.
          </p>
        </div>
      </div>

      {EXAM_LIST.map((bp) => {
        const ref = EXAM_REFERENCE[bp.code];
        const scoring = SCORING_MODELS[bp.code];
        const conf = CONF[ref.confidence];
        const totalQ = bp.sections.reduce((a, s) => a + s.questionCount, 0);

        return (
          <section key={bp.code} className="mb-9">
            <div className="mb-3 flex flex-wrap items-baseline gap-3">
              <span className="chip">{bp.code}</span>
              <h2 className="display text-xl">{ref.officialName}</h2>
              <span className="chip" style={{ color: conf.color }}>
                <ShieldCheck size={11} /> {conf.label}
              </span>
              <span className="ml-auto text-xs muted">diverifikasi {ref.lastVerified}</span>
            </div>

            <div className="card mb-3 grid gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ background: "var(--border)" }}>
              <Fact label="Penyelenggara" value={ref.body} />
              <Fact label="Pelaksanaan" value={ref.delivery} />
              <Fact label="Skala skor" value={ref.scoreScale} />
              <Fact label="Masa berlaku" value={ref.scoreValidity} />
              <Fact label="Sesi per tahun" value={ref.sittingsPerYear} />
              <Fact label="Total soal blueprint" value={`${totalQ} soal · ${bp.sections.length} komponen`} />
              {ref.resultTiming && <Fact label="Hasil keluar" value={ref.resultTiming} />}
              {ref.feeNote && <Fact label="Biaya" value={ref.feeNote} />}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="card p-4">
                <h3 className="mb-2 text-sm font-semibold">Struktur komponen</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="muted">
                      <th className="pb-1.5 text-left font-medium">Komponen</th>
                      <th className="pb-1.5 text-right font-medium">Soal</th>
                      <th className="pb-1.5 text-right font-medium">Menit</th>
                      <th className="pb-1.5 text-center font-medium">Kalk.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bp.sections.map((s) => (
                      <tr key={s.code} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="py-1.5">
                          {s.name}
                          <div className="font-mono text-[10px] muted">{s.code}</div>
                          {s.typeMix && (
                            <div className="text-[10px] muted">
                              {s.typeMix.map((t) => `${t.count} ${t.type}`).join(" + ")}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {s.questionCount}{s.marks ? <div className="text-[10px] muted">{s.marks} mark</div> : null}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{Math.round(s.durationSec / 60)}</td>
                        <td className="py-1.5 text-center">{s.calculatorAllowed ? "ya" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card p-4">
                <h3 className="mb-1 text-sm font-semibold">Model skoring</h3>
                <p className="mb-2 text-xs muted">{scoring.method} · {scoring.scale}</p>
                <ul className="mb-3 space-y-1 text-xs">
                  {scoring.howItWorks.map((x, i) => <li key={i} className="flex gap-1.5"><span className="muted">·</span>{x}</li>)}
                </ul>
                <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--warn)" }}>Batas kepercayaan</h4>
                <ul className="space-y-1 text-xs muted">
                  {scoring.limitations.map((x, i) => <li key={i} className="flex gap-1.5"><span>·</span>{x}</li>)}
                </ul>
              </div>
            </div>

            <div className="card mt-3 p-4">
              <h3 className="mb-2 text-sm font-semibold">Catatan struktur</h3>
              <ul className="mb-3 space-y-1 text-xs">
                {ref.notes.map((n, i) => <li key={i} className="flex gap-1.5"><span className="muted">·</span>{n}</li>)}
              </ul>
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--warn)" }}>Wajib dicek ulang</h4>
              <ul className="mb-3 space-y-1 text-xs muted">
                {ref.recheck.map((n, i) => <li key={i} className="flex gap-1.5"><span>·</span>{n}</li>)}
              </ul>
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider muted">Sumber</h4>
              <ul className="space-y-1 text-xs">
                {ref.sources.map((src) => (
                  <li key={src.url}>
                    <a href={src.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                      {src.label} <ExternalLink size={10} />
                    </a>
                    <span className="ml-1.5 muted">· dicek {src.checked}</span>
                  </li>
                ))}
              </ul>
            </div>

            {bp.code === "CSCA" && (
              <div className="card mt-3 p-4">
                <h3 className="mb-1 text-sm font-semibold">Mata uji menurut rumpun program studi</h3>
                <p className="mb-3 text-xs muted">
                  Pola umum, bukan aturan resmi — setiap universitas menetapkan syaratnya sendiri.
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="muted">
                      <th className="pb-1.5 text-left font-medium">Rumpun</th>
                      <th className="pb-1.5 text-left font-medium">Berbahasa Mandarin</th>
                      <th className="pb-1.5 text-left font-medium">Berbahasa Inggris</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CSCA_REQUIREMENTS.map((r) => (
                      <tr key={r.category} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="py-1.5">
                          {r.category}
                          <div className="text-[10px] muted">{r.majors}</div>
                        </td>
                        <td className="py-1.5">{r.chineseTaught.join(" + ")}</td>
                        <td className="py-1.5">
                          {r.englishTaught.join(" + ")}
                          {r.note && <div className="text-[10px] muted">{r.note}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      <section>
        <h2 className="display mb-3 text-xl">Lembar rumus</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(FORMULA_SHEETS).map((sheet) => (
            <div key={sheet.id} className="card p-4">
              <h3 className="text-sm font-semibold">{sheet.title}</h3>
              {sheet.subtitle && <p className="mt-0.5 text-[11px] muted">{sheet.subtitle}</p>}
              <p className="mt-2 text-xs muted">
                {sheet.groups.length} kelompok · {sheet.groups.reduce((a, g) => a + g.items.length, 0)} rumus
              </p>
              <p className="mt-1 font-mono text-[10px] muted">{sheet.id}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs muted">
          Lembar rumus tampil di dalam ruang ujian pada subtes yang mengizinkannya. Rumus adalah
          fakta matematis dan bebas dipakai; yang tidak boleh disalin adalah teks soal dan tata
          letak lembar resmi.
        </p>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3" style={{ background: "var(--bg-elev)" }}>
      <div className="text-[10px] uppercase tracking-wider muted">{label}</div>
      <div className="mt-0.5 text-xs">{value}</div>
    </div>
  );
}
