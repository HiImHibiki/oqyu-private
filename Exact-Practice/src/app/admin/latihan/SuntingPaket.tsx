"use client";
import { useEffect, useState } from "react";
import { Loader2, RefreshCw, UserMinus, X } from "lucide-react";
import type { Paket } from "@/lib/practice/paket";

interface Peserta { id: string; nama: string; username: string }

/** Panel "Ubah paket": judul, mapel, kelas, topik, durasi, nomor set, status
 *  terbit, murid yang bergabung (bisa dikeluarkan), dan ganti kode ujian. */
export function SuntingPaket({ paket, onTutup, onSimpan }: { paket: Paket; onTutup: () => void; onSimpan: () => Promise<void> }) {
  const judulDasar = paket.judul.replace(/ — Set \d+$/, "");
  const [f, setF] = useState({
    judul: judulDasar, mapel: paket.mapel ?? "", kelas: paket.kelas ?? "", topik: paket.topik ?? "",
    durasiMenit: paket.durasiMenit, set: paket.set ? String(paket.set) : "", terbit: paket.terbit,
  });
  const [peserta, setPeserta] = useState<Peserta[] | null>(null);
  const [kode, setKode] = useState(paket.kode);
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const muatPeserta = async () => {
    const r = await fetch(`/api/admin/latihan/paket?id=${paket.id}`);
    const j = await r.json().catch(() => ({}));
    setPeserta(j.peserta ?? []);
    if (j.paket?.kode) setKode(j.paket.kode);
  };
  useEffect(() => { void muatPeserta(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [paket.id]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onTutup(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onTutup]);

  const patch = async (isi: Record<string, unknown>) => {
    const r = await fetch("/api/admin/latihan/paket", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: paket.id, ...isi }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Gagal menyimpan");
    return r.json();
  };

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setGalat(null);
    const set = /^\d+$/.test(f.set.trim()) && Number(f.set) > 0 ? Number(f.set) : null;
    const dasar = f.judul.trim() || judulDasar;
    try {
      await patch({
        judul: set ? `${dasar} — Set ${set}` : dasar, set,
        mapel: f.mapel, kelas: f.kelas, topik: f.topik,
        durasiMenit: Number(f.durasiMenit), terbit: f.terbit,
      });
      await onSimpan();
      onTutup();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function keluarkan(p: Peserta) {
    if (!confirm(`Keluarkan ${p.nama} dari paket ini? Riwayat pengerjaannya tetap tersimpan; ia perlu memasukkan kode lagi untuk membukanya.`)) return;
    await patch({ hapusPeserta: p.id });
    await muatPeserta(); await onSimpan();
  }

  async function kodeBaru() {
    if (!confirm("Ganti kode ujian? Kode lama tidak bisa dipakai lagi. Murid yang sudah bergabung tetap bisa membuka paket ini.")) return;
    const j = await patch({ kodeBaru: true });
    setKode(j.paket?.kode ?? kode);
    await onSimpan();
  }

  const input = "input mt-1";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.45)" }} onClick={onTutup}>
      <form onSubmit={simpan} onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-lg p-5" style={{ background: "var(--bg-elev)" }}>
        <div className="mb-4 flex items-center gap-2">
          <h3 className="font-semibold">Ubah paket</h3>
          <button type="button" className="btn btn-ghost ml-auto !px-2" onClick={onTutup} aria-label="Tutup"><X size={16} /></button>
        </div>

        <div className="grid gap-3">
          <label className="text-sm">Judul paket
            <input className={input} value={f.judul} onChange={(e) => setF({ ...f, judul: e.target.value })} required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Mata pelajaran<input className={input} value={f.mapel} onChange={(e) => setF({ ...f, mapel: e.target.value })} /></label>
            <label className="text-sm">Kelas<input className={input} value={f.kelas} onChange={(e) => setF({ ...f, kelas: e.target.value })} /></label>
          </div>
          <label className="text-sm">Topik<input className={input} value={f.topik} onChange={(e) => setF({ ...f, topik: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Durasi (menit)
              <input className={input} type="number" min={5} max={600} value={f.durasiMenit}
                onChange={(e) => setF({ ...f, durasiMenit: Number(e.target.value) })} required />
            </label>
            <label className="text-sm">Set ke- <span className="muted">(opsional)</span>
              <input className={input} inputMode="numeric" value={f.set} placeholder="—" onChange={(e) => setF({ ...f, set: e.target.value })} />
            </label>
          </div>
          <p className="text-xs muted">Durasi baru berlaku untuk pengerjaan berikutnya; yang sedang berjalan tetap memakai waktunya semula.</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.terbit} onChange={(e) => setF({ ...f, terbit: e.target.checked })} />
            Terbit — murid bisa melihat & mengerjakan (tidak dicentang = disembunyikan, kode tidak bisa dipakai)
          </label>

          <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="mb-2 flex items-center gap-2 text-sm">
              <span>Kode ujian</span>
              <span className="rounded-md px-2 py-0.5 font-mono font-semibold tracking-widest" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{kode}</span>
              <button type="button" className="btn btn-ghost ml-auto !px-2 !py-1 text-xs" onClick={kodeBaru}><RefreshCw size={13} /> Ganti kode</button>
            </div>
            <div className="text-sm">Murid bergabung {peserta ? `(${peserta.length})` : ""}</div>
            {peserta === null ? <p className="mt-1 text-xs muted"><Loader2 size={12} className="inline animate-spin" /> memuat…</p>
              : peserta.length === 0 ? <p className="mt-1 text-xs muted">Belum ada murid yang memasukkan kode ini.</p>
              : (
                <ul className="mt-1 divide-y text-sm" style={{ borderColor: "var(--border)" }}>
                  {peserta.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate">{m.nama} <span className="text-xs muted">{m.username}</span></span>
                      <button type="button" className="btn btn-ghost !px-2 !py-1 text-xs" title="Keluarkan dari paket" onClick={() => keluarkan(m)}><UserMinus size={13} /> Keluarkan</button>
                    </li>
                  ))}
                </ul>
              )}
          </div>

          {galat && <p className="text-sm" style={{ color: "var(--danger)" }}>{galat}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={onTutup}>Batal</button>
            <button className="btn btn-primary" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />} Simpan</button>
          </div>
        </div>
      </form>
    </div>
  );
}
