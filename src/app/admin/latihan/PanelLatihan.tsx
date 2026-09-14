"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Printer, Sparkles, Trash2, Eye, EyeOff, KeyRound, ListChecks, Square, Copy, Link2, Check } from "lucide-react";
import type { Paket } from "@/lib/practice/paket";

type SoalRingkas = { id: string; stem: string; type: string; mapel: string; kelas: string; topik: string };

export function PanelLatihan({ awal }: { awal: Paket[] }) {
  const [paket, setPaket] = useState<Paket[]>(awal);
  const [tab, setTab] = useState<"gemini" | "bank">("gemini");

  /* ---- buat dengan Gemini ---- */
  const [f, setF] = useState({ judul: "", mapel: "", kelas: "", topik: "", jumlah: 10, durasiMenit: 30, instruksi: "" });
  const [kerja, setKerja] = useState<{ paketId: string; jid: string } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [galat, setGalat] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const muatPaket = async () => {
    const r = await fetch("/api/admin/latihan/paket"); const j = await r.json();
    if (j.paket) setPaket(j.paket);
  };

  useEffect(() => {
    if (!kerja) return;
    let hidup = true;
    const pantau = async () => {
      const r = await fetch(`/api/admin/latihan/buat?paketId=${kerja.paketId}`, { cache: "no-store" });
      const j = await r.json();
      if (!hidup) return;
      if (j.langkah) setLog(j.langkah);
      if (j.selesai) {
        setKerja(null);
        if (j.galat) setGalat(j.galat); else { setGalat(""); await muatPaket(); }
        return;
      }
      timer.current = setTimeout(pantau, 3000);
    };
    void pantau();
    return () => { hidup = false; if (timer.current) clearTimeout(timer.current); };
  }, [kerja]);

  const mulai = async () => {
    setGalat(""); setLog(["Mengirim ke Exact Worksheet…"]);
    const r = await fetch("/api/admin/latihan/buat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    const j = await r.json();
    if (j.jid) setKerja({ paketId: j.paketId, jid: j.jid }); else { setGalat(j.error || "Gagal"); setLog([]); }
  };
  const hentikan = async () => {
    if (!kerja) return;
    await fetch(`/api/admin/latihan/buat?jid=${kerja.jid}`, { method: "DELETE" });
  };

  /* ---- susun dari bank ---- */
  const [cari, setCari] = useState("");
  const [bank, setBank] = useState<SoalRingkas[]>([]);
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [judulBank, setJudulBank] = useState("");
  const [durasiBank, setDurasiBank] = useState(30);
  useEffect(() => {
    if (tab !== "bank") return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/admin/latihan/bank?q=${encodeURIComponent(cari)}`); const j = await r.json();
      setBank(j.soal ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [tab, cari]);
  const susun = async () => {
    const ids = [...pilih];
    const contoh = bank.find((s) => pilih.has(s.id));
    const r = await fetch("/api/admin/latihan/paket", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ judul: judulBank, questionIds: ids, durasiMenit: durasiBank, mapel: contoh?.mapel, kelas: contoh?.kelas, topik: contoh?.topik }),
    });
    const j = await r.json();
    if (j.paket) { setPilih(new Set()); setJudulBank(""); await muatPaket(); } else alert(j.error || "Gagal");
  };

  /* ---- daftar paket ---- */
  const ubah = async (id: string, perubahan: Partial<Paket>) => {
    await fetch("/api/admin/latihan/paket", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...perubahan }) });
    await muatPaket();
  };
  const hapus = async (p: Paket) => {
    if (!confirm(`Hapus paket "${p.judul}"? Soalnya tetap ada di bank.`)) return;
    await fetch(`/api/admin/latihan/paket?id=${p.id}`, { method: "DELETE" });
    await muatPaket();
  };

  const [disalin, setDisalin] = useState("");
  const salin = async (teks: string, tanda: string) => {
    try { await navigator.clipboard.writeText(teks); } catch { prompt("Salin:", teks); }
    setDisalin(tanda); setTimeout(() => setDisalin(""), 1500);
  };
  const situs = typeof window !== "undefined" ? window.location.origin : "";
  const input = "w-full rounded-lg border px-3 py-2 text-sm bg-transparent";
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="card p-5">
        <div className="mb-4 flex gap-2">
          <button className={`btn ${tab === "gemini" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("gemini")}><Sparkles size={16} /> Buat dengan Gemini</button>
          <button className={`btn ${tab === "bank" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("bank")}><ListChecks size={16} /> Susun dari bank</button>
        </div>

        {tab === "gemini" && (
          <div className="grid gap-3">
            <label className="text-sm">Topik / deskripsi soal *
              <textarea className={input} rows={3} value={f.topik} onChange={(e) => setF({ ...f, topik: e.target.value })}
                placeholder="mis. Persamaan linear satu variabel, soal cerita" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">Mata pelajaran<input className={input} value={f.mapel} onChange={(e) => setF({ ...f, mapel: e.target.value })} placeholder="Matematika" /></label>
              <label className="text-sm">Kelas<input className={input} value={f.kelas} onChange={(e) => setF({ ...f, kelas: e.target.value })} placeholder="8" /></label>
              <label className="text-sm">Jumlah soal<input className={input} type="number" min={1} max={40} value={f.jumlah} onChange={(e) => setF({ ...f, jumlah: Number(e.target.value) })} /></label>
              <label className="text-sm">Durasi online (menit)<input className={input} type="number" min={5} value={f.durasiMenit} onChange={(e) => setF({ ...f, durasiMenit: Number(e.target.value) })} /></label>
            </div>
            <label className="text-sm">Judul paket (opsional)<input className={input} value={f.judul} onChange={(e) => setF({ ...f, judul: e.target.value })} /></label>
            <label className="text-sm">Instruksi tambahan (opsional)<input className={input} value={f.instruksi} onChange={(e) => setF({ ...f, instruksi: e.target.value })} placeholder="mis. semua pilihan ganda, gunakan soal cerita" /></label>
            <p className="text-xs muted">Hanya soal pilihan ganda, benar/salah, dan isian singkat yang masuk ujian online (bisa dinilai otomatis). Esai tetap ikut di PDF.</p>
            <div className="flex items-center gap-2">
              <button className="btn btn-primary" disabled={!!kerja || !f.topik.trim()} onClick={mulai}>
                {kerja ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {kerja ? "Gemini sedang bekerja…" : "Buat soal"}
              </button>
              {kerja && <button className="btn btn-ghost" onClick={hentikan}><Square size={14} /> Hentikan</button>}
            </div>
            {galat && <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--danger-soft, #fee)", color: "var(--danger, #b00)" }}>{galat}</div>}
            {log.length > 0 && (
              <pre className="max-h-48 overflow-auto rounded-lg p-3 text-xs" style={{ background: "var(--surface-2, #f5f5f5)" }}>{log.join("\n")}</pre>
            )}
          </div>
        )}

        {tab === "bank" && (
          <div className="grid gap-3">
            <input className={input} placeholder="Cari soal (topik, mapel, kata di soal)…" value={cari} onChange={(e) => setCari(e.target.value)} />
            <div className="max-h-80 overflow-auto rounded-lg border" style={{ borderColor: "var(--line)" }}>
              {bank.length === 0 && <p className="p-3 text-sm muted">Tidak ada soal.</p>}
              {bank.map((s) => (
                <label key={s.id} className="flex cursor-pointer gap-2 border-b px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }}>
                  <input type="checkbox" checked={pilih.has(s.id)} onChange={(e) => { const n = new Set(pilih); if (e.target.checked) n.add(s.id); else n.delete(s.id); setPilih(n); }} />
                  <span>
                    <span className="line-clamp-2">{s.stem}</span>
                    <span className="text-xs muted">{[s.mapel, s.kelas && `Kelas ${s.kelas}`, s.topik, s.type].filter(Boolean).join(" · ")}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <input className={input} placeholder="Judul paket" value={judulBank} onChange={(e) => setJudulBank(e.target.value)} />
              <input className={input} type="number" min={5} value={durasiBank} onChange={(e) => setDurasiBank(Number(e.target.value))} title="Durasi (menit)" style={{ width: 90 }} />
            </div>
            <button className="btn btn-primary" disabled={pilih.size === 0} onClick={susun}><ListChecks size={16} /> Buat paket ({pilih.size} soal)</button>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="mb-3 font-semibold">Paket latihan ({paket.length})</h3>
        {paket.length === 0 && <p className="text-sm muted">Belum ada paket.</p>}
        <div className="grid gap-3">
          {paket.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--line)", opacity: p.terbit ? 1 : 0.6 }}>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.judul}</div>
                <div className="my-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md px-2 py-0.5 font-mono text-base font-semibold tracking-widest" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{p.kode}</span>
                  <button className="btn btn-ghost !px-2 !py-1 text-xs" title="Salin kode ujian" onClick={() => salin(p.kode, p.id + ":kode")}>
                    {disalin === p.id + ":kode" ? <Check size={13} /> : <Copy size={13} />} Salin kode
                  </button>
                  <button className="btn btn-ghost !px-2 !py-1 text-xs" title="Salin tautan langsung ke ujian ini" onClick={() => salin(`${situs}/latihan?q=${p.kode}`, p.id + ":tautan")}>
                    {disalin === p.id + ":tautan" ? <Check size={13} /> : <Link2 size={13} />} Salin tautan
                  </button>
                </div>
                <div className="text-xs muted">
                  {[p.mapel, p.kelas && `Kelas ${p.kelas}`, p.topik].filter(Boolean).join(" · ")} · {p.questionIds.length} soal · {p.durasiMenit} mnt · {p.sumber}
                  {p.dilewati ? ` · ${p.dilewati} esai hanya di PDF` : ""}
                  {!p.questionIds.length && p.jid ? " · sedang dibuat" : ""}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!p.questionIds.length && p.jid && !kerja && (
                  <button className="btn btn-ghost !px-2" title="Pantau lagi" onClick={() => setKerja({ paketId: p.id, jid: p.jid! })}><Loader2 size={15} /></button>
                )}
                <a className="btn btn-ghost !px-2" href={`/api/latihan/cetak?id=${p.id}`} target="_blank" rel="noreferrer" title="PDF soal"><Printer size={15} /></a>
                <a className="btn btn-ghost !px-2" href={`/api/latihan/cetak?id=${p.id}&kunci=1`} target="_blank" rel="noreferrer" title="PDF kunci & pembahasan"><KeyRound size={15} /></a>
                <button className="btn btn-ghost !px-2" title={p.terbit ? "Sembunyikan dari murid" : "Terbitkan ke murid"} onClick={() => ubah(p.id, { terbit: !p.terbit })}>
                  {p.terbit ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button className="btn btn-ghost !px-2" title="Hapus paket" onClick={() => hapus(p)}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
