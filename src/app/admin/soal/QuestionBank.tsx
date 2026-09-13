"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, FileJson, Loader2, Search, Upload } from "lucide-react";
import { ReviewPanel } from "./ReviewPanel";

interface Row {
  id: string; exam: string; section: string; domain: string; skill: string;
  difficulty: string; type: string; status: string; source?: string; stem: string;
  review?: { by: string; at: string; verdict: "correct" | "returned"; note?: string };
}
interface Summary { exam: string; approved: number; in_review: number; draft: number; retired: number; total: number; needed: number }
interface Finding { index: number; id: string; severity: string; message: string }

const STATUS_COLOR: Record<string, string> = {
  approved: "var(--ok)", in_review: "var(--warn)", draft: "var(--fg-muted)", retired: "var(--danger)",
};
const STATUS_LABEL: Record<string, string> = {
  approved: "approved", in_review: "in review", draft: "draft", retired: "retired",
};

export function QuestionBank({ summary, rows, total, filter, canApprove }: {
  summary: Summary[]; rows: Row[]; total: number;
  filter: { exam: string; status: string; q: string }; canApprove: boolean;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [needle, setNeedle] = useState(filter.q);
  const [showImport, setShowImport] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [json, setJson] = useState("");
  const [importStatus, setImportStatus] = useState(canApprove ? "approved" : "in_review");
  const [result, setResult] = useState<null | {
    imported: number; replaced: number; skipped: number; checked: number;
    blockers: number; majors: number; minors: number; findings: Finding[]; error?: string;
  }>(null);

  const toggle = (id: string) =>
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  function go(patch: Record<string, string>) {
    const p = new URLSearchParams({ ...filter, ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    router.push(`/admin/soal?${p.toString()}`);
  }

  async function setStatus(status: string) {
    if (!sel.size) return;
    setBusy(true);
    await fetch("/api/admin/questions/status", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [...sel], status }),
    });
    setSel(new Set());
    setBusy(false);
    router.refresh();
  }

  async function doImport() {
    setBusy(true); setResult(null);
    const r = await fetch("/api/admin/questions/import", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ json, status: importStatus }),
    });
    const j = await r.json();
    setBusy(false);
    setResult(r.ok ? j : { ...j, imported: 0, replaced: 0, skipped: 0, checked: 0, blockers: 0, majors: 0, minors: 0, findings: [] });
    if (r.ok && j.imported > 0) { setJson(""); router.refresh(); }
  }

  return (
    <>
      {/* ------------------------------------------------ ringkasan bank */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((s) => {
          const pct = s.needed ? Math.min(100, Math.round((s.approved / s.needed) * 100)) : 0;
          return (
            <button key={s.exam} onClick={() => go({ exam: s.exam })} className="card p-4 text-left">
              <div className="mb-1 flex items-center gap-2">
                <span className="chip">{s.exam}</span>
                <span className="ml-auto text-xs muted">{s.total} soal</span>
              </div>
              <div className="display text-xl">{s.approved}<span className="text-sm muted"> / {s.needed}</span></div>
              <div className="mb-2 text-[11px] muted">approved dari kebutuhan 1 paket penuh</div>
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--bg-sunken)" }}>
                <div className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: pct >= 100 ? "var(--ok)" : "var(--warn)" }} />
              </div>
              {s.in_review > 0 && (
                <div className="mt-1.5 text-[11px]" style={{ color: "var(--warn)" }}>{s.in_review} menunggu tinjauan</div>
              )}
            </button>
          );
        })}
      </div>

      {/* --------------------------------------------------------- impor */}
      <div className="card mb-5 p-5">
        <button className="flex w-full items-center gap-2 text-left" onClick={() => setShowImport((v) => !v)}>
          <FileJson size={17} style={{ color: "var(--accent)" }} />
          <span className="font-semibold">Impor soal dari JSON</span>
          <span className="ml-auto text-xs muted">{showImport ? "tutup" : "buka"}</span>
        </button>

        {showImport && (
          <div className="mt-4">
            <p className="mb-3 text-sm muted">
              Tempel keluaran AI di sini (array JSON). Soal yang punya temuan <strong>BLOCKER</strong> tidak
              akan diimpor — sisanya tetap masuk, jadi kamu bisa memperbaiki yang gagal saja.
            </p>
            <textarea
              className="input min-h-[180px] font-mono text-xs"
              placeholder='[{"id":"utbk-pk-0142","exam":"UTBK","section":"utbk_pk", ...}]'
              value={json}
              onChange={(e) => setJson(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-sm">Status setelah impor</label>
              <select className="input !w-auto !py-1.5 text-sm" value={importStatus}
                onChange={(e) => setImportStatus(e.target.value)}>
                <option value="draft">draft</option>
                <option value="in_review">in_review</option>
                {canApprove && <option value="approved">approved (langsung dipakai)</option>}
              </select>
              <button className="btn btn-primary ml-auto" disabled={busy || !json.trim()} onClick={doImport}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Impor
              </button>
            </div>

            {result && (
              <div className="mt-4 rounded-xl p-4" style={{ background: "var(--bg-sunken)" }}>
                {result.error ? (
                  <p className="flex items-start gap-2 text-sm" style={{ color: "var(--danger)" }}>
                    <AlertCircle size={15} className="mt-0.5 shrink-0" /> {result.error}
                  </p>
                ) : (
                  <>
                    <p className="text-sm">
                      <strong>{result.imported}</strong> soal masuk
                      {result.replaced > 0 && <> ({result.replaced} menimpa yang lama)</>}
                      {result.skipped > 0 && <>, <strong>{result.skipped}</strong> ditolak</>} dari {result.checked} yang diperiksa.
                    </p>
                    <p className="mt-1 text-xs muted">
                      BLOCKER {result.blockers} · MAJOR {result.majors} · minor {result.minors}
                    </p>
                  </>
                )}

                {Boolean(result.findings?.length) && (
                  <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-xs">
                    {result.findings.map((f, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="shrink-0 font-mono" style={{
                          color: f.severity === "BLOCKER" ? "var(--danger)"
                            : f.severity === "MAJOR" ? "var(--warn)" : "var(--fg-muted)",
                        }}>
                          {f.severity === "BLOCKER" ? "✗" : f.severity === "MAJOR" ? "!" : "·"}
                        </span>
                        <span className="shrink-0 font-mono muted">#{f.index} {f.id}</span>
                        <span>{f.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- filter */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--bg-sunken)" }}
          onSubmit={(e) => { e.preventDefault(); go({ q: needle }); }}>
          <Search size={15} className="muted" />
          <input className="w-full bg-transparent text-sm outline-none" placeholder="Cari id, stem, domain, skill…"
            value={needle} onChange={(e) => setNeedle(e.target.value)} />
        </form>
        <select className="input !w-auto !py-1.5 text-sm" value={filter.exam} onChange={(e) => go({ exam: e.target.value })}>
          <option value="">Semua ujian</option>
          {["SAT", "UTBK", "CSCA", "ALEVEL"].map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select className="input !w-auto !py-1.5 text-sm" value={filter.status} onChange={(e) => go({ status: e.target.value })}>
          <option value="">Semua status</option>
          {["draft", "in_review", "approved", "retired"].map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>

      {sel.size > 0 && (
        <div className="card mb-3 flex flex-wrap items-center gap-2 p-3">
          <span className="text-sm"><strong>{sel.size}</strong> soal dipilih</span>
          <div className="ml-auto flex gap-1.5">
            {canApprove && (
              <button className="btn btn-primary !py-1.5 !text-xs" disabled={busy} onClick={() => setStatus("approved")}>
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Setujui
              </button>
            )}
            <button className="btn btn-ghost !py-1.5 !text-xs" disabled={busy} onClick={() => setStatus("in_review")}>Tinjau ulang</button>
            <button className="btn btn-ghost !py-1.5 !text-xs" disabled={busy} onClick={() => setStatus("retired")}>Pensiunkan</button>
            <button className="btn btn-ghost !py-1.5 !text-xs" onClick={() => setSel(new Set())}>Batal</button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- tabel */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bg-sunken)" }}>
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" className="accent-[var(--accent)]"
                  checked={sel.size > 0 && sel.size === rows.length}
                  onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} />
              </th>
              <th className="px-3 py-2.5 text-left font-medium">Soal</th>
              <th className="px-3 py-2.5 text-left font-medium">Section</th>
              <th className="px-3 py-2.5 text-left font-medium">Tipe</th>
              <th className="px-3 py-2.5 text-left font-medium">Status</th>
              <th className="px-3 py-2.5 text-left font-medium">Tinjauan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2.5">
                  <input type="checkbox" className="accent-[var(--accent)]"
                    checked={sel.has(r.id)} onChange={() => toggle(r.id)} />
                </td>
                <td className="px-3 py-2.5">
                  <button className="w-full text-left" onClick={() => setReviewing(r.id)}>
                    <div className="font-mono text-xs muted">{r.id}</div>
                    <div className="max-w-lg truncate underline decoration-transparent hover:decoration-inherit">
                      {r.stem}
                    </div>
                    <div className="text-[11px] muted">{r.domain} · {r.skill}</div>
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <span className="chip">{r.exam}</span>
                  <div className="mt-0.5 font-mono text-[11px] muted">{r.section}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-xs">{r.type}</div>
                  <div className="text-[11px] muted">{{ E: "mudah", M: "sedang", H: "sulit" }[r.difficulty]}</div>
                </td>
                <td className="px-3 py-2.5">
                  <span className="chip" style={{ color: STATUS_COLOR[r.status] }}>{STATUS_LABEL[r.status] ?? r.status}</span>
                  {r.source && <div className="mt-0.5 text-[11px] muted">{r.source}</div>}
                </td>
                <td className="px-3 py-2.5">
                  {r.review ? (
                    <>
                      <span className="chip" style={{
                        color: r.review.verdict === "correct" ? "var(--ok)" : "var(--warn)",
                      }}>
                        {r.review.verdict === "correct" ? "kunci diperiksa" : "dikembalikan"}
                      </span>
                      <div className="mt-0.5 max-w-[14rem] truncate text-[11px] muted">{r.review.by}</div>
                    </>
                  ) : (
                    <button className="text-[11px] underline muted" onClick={() => setReviewing(r.id)}>
                      belum ditinjau
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-6 text-center text-sm muted">Tidak ada soal yang cocok.</p>}
      </div>

      {total > rows.length && (
        <p className="mt-3 text-xs muted">Menampilkan {rows.length} dari {total} soal. Persempit dengan filter di atas.</p>
      )}
      {!canApprove && (
        <p className="mt-3 text-xs muted">Peran <strong>reviewer</strong> bisa menandai untuk ditinjau dan memensiunkan, tetapi tidak bisa menyetujui.</p>
      )}

      {reviewing && (
        <ReviewPanel
          id={reviewing}
          canApprove={canApprove}
          onClose={() => setReviewing(null)}
          onDone={() => { setReviewing(null); router.refresh(); }}
        />
      )}
    </>
  );
}
