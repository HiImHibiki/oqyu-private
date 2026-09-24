"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Undo2, X } from "lucide-react";
import { RichText } from "@/components/exam/RichText";
import { FigureView } from "@/components/charts/Figure";
import type { Question } from "@/lib/types";

interface Review { by: string; at: string; verdict: "correct" | "returned"; note?: string }
type Full = Question & { status: string; review?: Review };

/* Panel tinjauan soal.
 *
 * Tanpa panel ini seorang guru tidak bisa meninjau apa pun: tabel bank hanya
 * mengirim potongan stem ke browser, sehingga kunci jawaban dan pembahasan
 * tidak pernah terlihat. Di sinilah keduanya ditampilkan — kunci ditandai
 * terang, pembahasan dan alasan tiap pengecoh dibuka, dan untuk CSCA kedua
 * bahasa disandingkan agar terjemahannya ikut terperiksa. */
export function ReviewPanel({
  id, canApprove, onClose, onDone,
}: {
  id: string; canApprove: boolean; onClose: () => void; onDone: () => void;
}) {
  const [q, setQ] = useState<Full | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    let live = true;
    setQ(null); setErr(null); setReturning(false); setNote("");
    fetch(`/api/admin/questions/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => { if (live) j.question ? setQ(j.question) : setErr(j.error ?? "Gagal memuat"); })
      .catch(() => live && setErr("Gagal memuat soal"));
    return () => { live = false; };
  }, [id]);

  async function submit(verdict: "correct" | "returned") {
    setBusy(true); setErr(null);
    const r = await fetch("/api/admin/questions/status", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ids: [id],
        status: verdict === "correct" ? "approved" : "in_review",
        verdict,
        note,
      }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Gagal menyimpan");
    onDone();
  }

  const key = q && q.answer.mode === "choice" ? q.answer.value : null;
  const zh = q?.i18n?.zh;
  const en = q?.i18n?.en;

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto p-6"
        style={{ background: "var(--bg-elev)" }} onClick={(e) => e.stopPropagation()}>

        <div className="mb-4 flex items-center gap-3">
          <h2 className="font-semibold">Tinjau soal</h2>
          <span className="chip font-mono text-[11px]">{id}</span>
          <button className="btn btn-ghost ml-auto !p-2" onClick={onClose} aria-label="Tutup">
            <X size={16} />
          </button>
        </div>

        {err && (
          <p className="mb-3 rounded-lg px-3 py-2 text-sm"
            style={{ background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }}>
            {err}
          </p>
        )}

        {!q && !err && <p className="text-sm muted"><Loader2 size={14} className="inline animate-spin" /> Memuat…</p>}

        {q && (
          <>
            <div className="mb-4 flex flex-wrap gap-1.5 text-[11px]">
              <span className="chip">{q.exam}</span>
              <span className="chip font-mono">{q.section}</span>
              <span className="chip">{q.domain}</span>
              <span className="chip">{q.skill}</span>
              <span className="chip">{{ E: "mudah", M: "sedang", H: "sulit" }[q.difficulty]}</span>
              <span className="chip">{q.type}</span>
            </div>

            {q.review && (
              <div className="card mb-4 p-3 text-xs"
                style={{ borderColor: q.review.verdict === "correct" ? "var(--ok)" : "var(--warn)" }}>
                <strong>{q.review.verdict === "correct" ? "Sudah ditinjau" : "Dikembalikan"}</strong>
                {" · "}{q.review.by} · {new Date(q.review.at).toLocaleString("id-ID")}
                {q.review.note && <p className="mt-1 muted">{q.review.note}</p>}
              </div>
            )}

            {q.stimulus?.content && (
              <div className="card mb-3 p-4 text-sm leading-relaxed">
                <RichText>{q.stimulus.content}</RichText>
                {q.stimulus.source && <p className="mt-2 text-[11px] muted">{q.stimulus.source}</p>}
              </div>
            )}
            {q.figure && <div className="mb-3"><FigureView figure={q.figure} /></div>}

            <div className="mb-4 text-[1.02rem] leading-relaxed"><RichText>{q.stem}</RichText></div>

            {/* -------------------------------------------------- pilihan */}
            {q.choices?.length ? (
              <ul className="mb-4 space-y-2">
                {q.choices.map((c) => {
                  const right = c.id === key;
                  return (
                    <li key={c.id} className="flex gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm"
                      style={{
                        borderColor: right ? "var(--ok)" : "var(--border)",
                        background: right ? "color-mix(in srgb, var(--ok) 10%, transparent)" : undefined,
                      }}>
                      <span className="font-mono font-semibold" style={{ color: right ? "var(--ok)" : undefined }}>
                        {c.id}
                      </span>
                      <div className="min-w-0 flex-1">
                        <RichText>{c.text}</RichText>
                        {zh?.choices?.find((x) => x.id === c.id) && (
                          <div className="mt-1 border-t pt-1 text-[13px] muted" style={{ borderColor: "var(--border)" }}>
                            <RichText>{zh.choices.find((x) => x.id === c.id)!.text}</RichText>
                          </div>
                        )}
                        {!right && q.distractorRationale?.[c.id] && (
                          <p className="mt-1 text-[12px] muted">{q.distractorRationale[c.id]}</p>
                        )}
                      </div>
                      {right && <Check size={16} style={{ color: "var(--ok)" }} />}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="card mb-4 p-3 text-sm">
                <div className="mb-1 text-[11px] uppercase tracking-wider muted">Kunci</div>
                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs">
                  {JSON.stringify(q.answer, null, 2)}
                </pre>
              </div>
            )}

            <div className="card mb-4 p-4">
              <div className="mb-1.5 text-[11px] uppercase tracking-wider muted">Pembahasan</div>
              <div className="text-sm leading-relaxed"><RichText>{q.explanation}</RichText></div>
            </div>

            {(zh?.explanation || en?.explanation) && (
              <div className="card mb-4 p-4">
                <div className="mb-1.5 text-[11px] uppercase tracking-wider muted">
                  Versi {zh ? "中文" : "English"} — periksa terjemahannya juga
                </div>
                {(zh ?? en)!.stem && (
                  <div className="mb-2 text-sm"><RichText>{(zh ?? en)!.stem!}</RichText></div>
                )}
                <div className="text-sm leading-relaxed muted">
                  <RichText>{(zh ?? en)!.explanation!}</RichText>
                </div>
              </div>
            )}

            {/* -------------------------------------------------- putusan */}
            <div className="card sticky bottom-0 p-4" style={{ background: "var(--bg-elev)" }}>
              <p className="mb-3 flex items-start gap-2 text-xs muted">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: "var(--warn)" }} />
                Validator hanya memeriksa struktur. Yang perlu kamu periksa di sini: kunci
                benar secara faktual, pengecoh salah semuanya, dan pembahasan sungguh menjelaskan
                mengapa.
              </p>

              {!returning ? (
                <div className="flex flex-wrap gap-2">
                  {canApprove && (
                    <button className="btn btn-primary !text-sm" disabled={busy} onClick={() => submit("correct")}>
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Kunci benar — setujui
                    </button>
                  )}
                  <button className="btn btn-ghost !text-sm" disabled={busy} onClick={() => setReturning(true)}>
                    <Undo2 size={14} /> Ada yang keliru — kembalikan
                  </button>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium">Apa yang keliru?</label>
                  <textarea className="input min-h-[80px] text-sm" value={note} autoFocus
                    placeholder="Contoh: kunci seharusnya C — pada langkah kedua 48 dibagi 6, bukan dikali."
                    onChange={(e) => setNote(e.target.value)} />
                  <div className="mt-2 flex gap-2">
                    <button className="btn btn-ghost !py-1.5 !text-xs" onClick={() => setReturning(false)}>Batal</button>
                    <button className="btn btn-danger !py-1.5 !text-xs"
                      disabled={busy || note.trim().length < 5} onClick={() => submit("returned")}>
                      {busy ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />} Kembalikan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
