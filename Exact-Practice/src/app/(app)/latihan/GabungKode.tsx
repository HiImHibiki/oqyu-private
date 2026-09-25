"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";

/** Murid memasukkan kode ujian dari guru → paketnya masuk "Paket saya".
 *  `awal`: kode dari tautan guru (/latihan?kode=XXXXXX), tinggal ditekan Buka. */
export function GabungKode({ awal = "" }: { awal?: string }) {
  const router = useRouter();
  const [kode, setKode] = useState(awal.toUpperCase());
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setPesan(null);
    const r = await fetch("/api/latihan/gabung", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kode }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setPesan({ ok: false, teks: j.error ?? "Kode tidak bisa dipakai" });
    setPesan({ ok: true, teks: j.baru ? `"${j.paket.judul}" ditambahkan ke Paket saya.` : `"${j.paket.judul}" sudah ada di Paket saya.` });
    setKode("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card mb-8 p-5">
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold"><KeyRound size={16} /> Masukkan kode ujian dari guru</label>
      <div className="flex gap-2">
        <input className="input font-mono uppercase tracking-widest" required maxLength={12} placeholder="mis. SNNZ9M"
          autoCapitalize="characters" autoComplete="off" spellCheck={false}
          value={kode} onChange={(e) => setKode(e.target.value.toUpperCase())} />
        <button className="btn btn-primary" disabled={busy || !kode.trim()}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : null} Buka
        </button>
      </div>
      {pesan && <p className="mt-2 text-xs" style={{ color: pesan.ok ? "var(--ok, var(--accent))" : "var(--danger)" }}>{pesan.teks}</p>}
    </form>
  );
}
