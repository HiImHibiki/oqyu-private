"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, Check, ClipboardCopy, FileText, ImageIcon, Loader2,
  Paperclip, Sparkles, Trash2, Wand2, X,
} from "lucide-react";

export interface SectionOption {
  exam: string; code: string; name: string;
  domains: { name: string; skills: string[] }[];
}
export interface ProviderOption {
  id: string; name: string; envVar: string; configured: boolean;
  supportsPdf: boolean; docsUrl: string;
  models: { id: string; label: string; note?: string }[];
}

interface Attachment { mediaType: string; data: string; name: string; bytes: number }
interface Finding { index: number; id: string; severity: string; message: string }

const TINGKAT = [
  "E 25% / M 50% / H 25%",
  "E 50% / M 40% / H 10%  (bank pemula)",
  "M 35% / H 65%  (modul sulit)",
  "H 100%  (soal penantang)",
];

export function GeneratePanel({ sections, providers, canApprove }: {
  sections: SectionOption[]; providers: ProviderOption[]; canApprove: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const firstReady = providers.find((p) => p.configured) ?? providers[0];
  const [provider, setProvider] = useState(firstReady?.id ?? "anthropic");
  const [model, setModel] = useState(firstReady?.models[0]?.id ?? "claude-opus-5");

  const [section, setSection] = useState(sections[0]?.code ?? "");
  const [jumlah, setJumlah] = useState(8);
  const [domain, setDomain] = useState("");
  const [tingkat, setTingkat] = useState(TINGKAT[0]);
  const [varian, setVarian] = useState<"base" | "hard" | "easy">("base");
  const [topik, setTopik] = useState("");
  const [catatan, setCatatan] = useState("");

  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState<"copy" | "gen" | "import" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<null | {
    ok?: boolean; error?: string; raw?: string; model?: string;
    usage?: { input?: number; output?: number };
    questions?: unknown[]; accepted?: unknown[]; checked?: number;
    blockers?: number; majors?: number; minors?: number; findings?: Finding[];
  }>(null);

  const dropRef = useRef<HTMLDivElement>(null);
  const current = sections.find((s) => s.code === section);
  const prov = providers.find((p) => p.id === provider);
  const isSat = section.startsWith("sat_");

  const criteria = () => ({
    section, jumlah, domain: domain || undefined, tingkat,
    varian: isSat ? varian : undefined,
    topik: topik.trim() || undefined,
    catatan: catatan.trim() || undefined,
  });

  /* ------------------------------------------------------------ lampiran */

  const addFiles = useCallback(async (list: File[]) => {
    setErr(null);
    const next: Attachment[] = [];
    for (const f of list) {
      const isImg = f.type.startsWith("image/");
      const isPdf = f.type === "application/pdf";
      if (!isImg && !isPdf) { setErr(`"${f.name}" bukan gambar atau PDF`); continue; }
      if (f.size > 8 * 1024 * 1024) { setErr(`"${f.name}" lebih dari 8 MB`); continue; }
      const data = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] ?? "");
        r.onerror = () => rej(new Error("gagal membaca berkas"));
        r.readAsDataURL(f);
      });
      next.push({ mediaType: f.type, data, name: f.name || "tempelan.png", bytes: f.size });
    }
    if (next.length) setFiles((prev) => [...prev, ...next].slice(0, 8));
  }, []);

  // tempel screenshot langsung dari papan klip
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = [...(e.clipboardData?.items ?? [])];
      const imgs = items.filter((i) => i.kind === "file" && i.type.startsWith("image/"));
      if (!imgs.length) return;
      e.preventDefault();
      void addFiles(imgs.map((i) => i.getAsFile()).filter((f): f is File => Boolean(f)));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, addFiles]);

  /* -------------------------------------------------------------- aksi */

  async function copyPrompt() {
    setBusy("copy"); setErr(null);
    try {
      const r = await fetch("/api/admin/ai/prompt", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(criteria()),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Gagal menyusun prompt");

      const text =
        `===== SYSTEM PROMPT =====\n\n${j.system}\n\n` +
        `===== USER PROMPT =====\n\n${j.user}\n`;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyalin");
    } finally {
      setBusy(null);
    }
  }

  async function runGenerate() {
    setBusy("gen"); setErr(null); setResult(null);
    try {
      const r = await fetch("/api/admin/ai/generate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...criteria(), provider, model,
          attachments: files.map(({ mediaType, data, name }) => ({ mediaType, data, name })),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Gagal memanggil API AI");
      setResult(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memanggil API AI");
    } finally {
      setBusy(null);
    }
  }

  async function importAccepted(status: string) {
    if (!result?.accepted?.length) return;
    setBusy("import"); setErr(null);
    try {
      const r = await fetch("/api/admin/questions/import", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: JSON.stringify(result.accepted), status }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Gagal mengimpor");
      setResult(null);
      setFiles([]);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal mengimpor");
    } finally {
      setBusy(null);
    }
  }

  /* --------------------------------------------------------------- UI */

  return (
    <div className="card mb-5 p-5">
      <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
        <Sparkles size={17} style={{ color: "var(--accent)" }} />
        <span className="font-semibold">Buat soal dengan AI</span>
        <span className="ml-auto text-xs muted">{open ? "tutup" : "buka"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          {err && (
            <div className="flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm"
              style={{ background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }}>
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {err}
            </div>
          )}

          {/* ------------------------------------------------ 1. kriteria */}
          <section>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider muted">1 · Kriteria soal</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium">Subtes</span>
                <select className="input" value={section}
                  onChange={(e) => { setSection(e.target.value); setDomain(""); }}>
                  {["SAT", "UTBK", "CSCA", "ALEVEL"].map((ex) => (
                    <optgroup key={ex} label={ex}>
                      {sections.filter((s) => s.exam === ex).map((s) => (
                        <option key={s.code} value={s.code}>{s.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Jumlah soal</span>
                <input className="input" type="number" min={1} max={30} value={jumlah}
                  onChange={(e) => setJumlah(Number(e.target.value))} />
                <span className="mt-1 block text-[11px] muted">8–12 memberi mutu terbaik per panggilan.</span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Domain</span>
                <select className="input" value={domain} onChange={(e) => setDomain(e.target.value)}>
                  <option value="">Campuran sesuai porsi blueprint</option>
                  {(current?.domains ?? []).map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Komposisi kesulitan</span>
                <select className="input" value={tingkat} onChange={(e) => setTingkat(e.target.value)}>
                  {TINGKAT.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              {isSat && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Varian modul adaptif</span>
                  <select className="input" value={varian} onChange={(e) => setVarian(e.target.value as typeof varian)}>
                    <option value="base">base — modul 1</option>
                    <option value="hard">hard — modul 2 sulit</option>
                    <option value="easy">easy — modul 2 mudah</option>
                  </select>
                </label>
              )}

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium">Tema / konteks <span className="font-normal muted">(opsional)</span></span>
                <input className="input" value={topik} onChange={(e) => setTopik(e.target.value)}
                  placeholder="mis. energi terbarukan, koperasi sekolah, transportasi kota" />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium">Instruksi tambahan <span className="font-normal muted">(opsional)</span></span>
                <textarea className="input min-h-[80px] text-sm" value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="mis. Buat soal setara dengan materi di lampiran, tetapi angkanya harus berbeda." />
              </label>
            </div>
          </section>

          {/* ----------------------------------------------- 2. lampiran */}
          <section>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider muted">
              2 · Materi acuan <span className="font-normal normal-case tracking-normal">(opsional)</span>
            </h3>

            <div
              ref={dropRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); void addFiles([...e.dataTransfer.files]); }}
              className="rounded-xl border border-dashed p-5 text-center"
            >
              <Paperclip size={20} className="mx-auto mb-2 muted" />
              <p className="text-sm">
                Tempel screenshot dengan <kbd className="rounded px-1.5 py-0.5 text-xs" style={{ background: "var(--bg-sunken)" }}>Cmd/Ctrl + V</kbd>,
                seret berkas ke sini, atau
              </p>
              <label className="mt-2 inline-block">
                <span className="btn btn-ghost !py-1.5 !text-xs">Pilih berkas</span>
                <input type="file" className="hidden" multiple accept="image/*,application/pdf"
                  onChange={(e) => { void addFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
              </label>
              <p className="mt-2 text-[11px] muted">
                PNG/JPG atau PDF, maksimal 8 MB per berkas. Dipakai sebagai acuan materi —
                AI diminta membuat soal <em>setara</em>, bukan menyalinnya.
              </p>
            </div>

            {files.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm"
                    style={{ background: "var(--bg-sunken)" }}>
                    {f.mediaType === "application/pdf" ? <FileText size={15} /> : <ImageIcon size={15} />}
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs muted">{(f.bytes / 1024).toFixed(0)} KB</span>
                    <button className="rounded p-1 hover:bg-[var(--bg)]" aria-label="Hapus lampiran"
                      onClick={() => setFiles((p) => p.filter((_, k) => k !== i))}>
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* --------------------------------------------- 3. penyedia AI */}
          <section>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider muted">3 · Mesin AI</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {providers.map((p) => (
                <button key={p.id} onClick={() => { setProvider(p.id); setModel(p.models[0].id); }}
                  className="card p-3.5 text-left"
                  style={{
                    borderColor: provider === p.id ? "var(--accent)" : "var(--border)",
                    opacity: p.configured ? 1 : 0.6,
                  }}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-semibold">{p.name}</span>
                    {provider === p.id && <Check size={14} style={{ color: "var(--accent)" }} />}
                  </div>
                  {p.configured ? (
                    <span className="chip" style={{ color: "var(--ok)" }}>siap</span>
                  ) : (
                    <span className="chip" style={{ color: "var(--warn)" }}>kunci belum diisi</span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Model</span>
                <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
                  {(prov?.models ?? []).map((m) => (
                    <option key={m.id} value={m.id}>{m.label}{m.note ? ` — ${m.note}` : ""}</option>
                  ))}
                </select>
              </label>
              {!prov?.configured && (
                <div className="rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "var(--bg-sunken)" }}>
                  Isi <code>{prov?.envVar}</code> di <code>.env.local</code> lalu jalankan ulang server.
                  Ambil kuncinya di <a className="underline" href={prov?.docsUrl} target="_blank" rel="noreferrer">{prov?.docsUrl}</a>.
                  <br />Tanpa kunci pun, tombol <strong>Salin prompt</strong> tetap bisa dipakai.
                </div>
              )}
            </div>
          </section>

          {/* -------------------------------------------------- tombol */}
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <button className="btn btn-ghost" disabled={busy !== null} onClick={copyPrompt}>
              {busy === "copy" ? <Loader2 size={15} className="animate-spin" />
                : copied ? <Check size={15} /> : <ClipboardCopy size={15} />}
              {copied ? "Prompt tersalin" : "Salin prompt"}
            </button>
            <button className="btn btn-primary" disabled={busy !== null || !prov?.configured} onClick={runGenerate}>
              {busy === "gen" ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
              {busy === "gen" ? "Sedang menulis soal…" : `Buat ${jumlah} soal`}
            </button>
            <span className="text-xs muted">
              {copied
                ? "Tempel di Claude / ChatGPT / Gemini. Lampiran perlu dipasang manual di sana."
                : "Salin prompt untuk dikerjakan di aplikasi chat, atau langsung panggil API."}
            </span>
          </div>

          {/* --------------------------------------------------- hasil */}
          {result && (
            <div className="rounded-xl p-4" style={{ background: "var(--bg-sunken)" }}>
              {result.error ? (
                <>
                  <p className="flex items-start gap-2 text-sm" style={{ color: "var(--danger)" }}>
                    <AlertCircle size={15} className="mt-0.5 shrink-0" /> {result.error}
                  </p>
                  {result.raw && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs muted">Lihat keluaran mentah model</summary>
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[11px]">{result.raw}</pre>
                    </details>
                  )}
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm">
                      <strong>{result.accepted?.length ?? 0}</strong> dari {result.checked} soal lolos validasi
                      {(result.blockers ?? 0) > 0 && <> · {result.blockers} ditolak</>}
                    </p>
                    <span className="text-xs muted">
                      {result.model}
                      {result.usage?.output ? ` · ${result.usage.input ?? 0}→${result.usage.output} token` : ""}
                    </span>
                    <div className="ml-auto flex gap-1.5">
                      <button className="btn btn-ghost !py-1.5 !text-xs" onClick={() => setResult(null)}>
                        <Trash2 size={12} /> Buang
                      </button>
                      <button className="btn btn-ghost !py-1.5 !text-xs" disabled={busy !== null || !result.accepted?.length}
                        onClick={() => importAccepted("in_review")}>
                        Impor sebagai in_review
                      </button>
                      {canApprove && (
                        <button className="btn btn-primary !py-1.5 !text-xs" disabled={busy !== null || !result.accepted?.length}
                          onClick={() => importAccepted("approved")}>
                          {busy === "import" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          Impor &amp; setujui
                        </button>
                      )}
                    </div>
                  </div>

                  {Boolean(result.findings?.length) && (
                    <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-xs">
                      {result.findings!.map((f, i) => (
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

                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs muted">Lihat JSON hasil</summary>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[11px]">
                      {JSON.stringify(result.accepted, null, 2)}
                    </pre>
                  </details>

                  <p className="mt-3 text-[11px] muted">
                    Validator hanya memeriksa struktur. Sebelum menyetujui, jalankan
                    <code className="mx-1">prompts/_shared/review.md</code> dengan model kedua dan minta guru mapel memeriksa kuncinya.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
