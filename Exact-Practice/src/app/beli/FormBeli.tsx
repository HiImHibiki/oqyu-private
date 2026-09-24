"use client";
import { useState } from "react";
import { Building2, Check, Loader2, MessageCircle } from "lucide-react";

type Paket = { id: string; name: string; blurb: string; hari: number; harga: number; coret: number | null; popular: boolean; features: string[] };
type Hasil = { orderId: string; ref: string; nominal: string; paket: string; hari?: number; wa: string | null; bank: { nama: string; rekening: string; atasNama: string } | null };

const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");

export function FormBeli({ paket, refAwal, paketAwal, awal }: {
  paket: Paket[]; refAwal: string; paketAwal: string; awal: { nama: string; email: string; hp: string } | null;
}) {
  const [f, setF] = useState({ nama: awal?.nama ?? "", email: awal?.email ?? "", hp: awal?.hp ?? "", kode: refAwal, paket: paket.find((p) => p.id === paketAwal)?.id ?? (paket.find((p) => p.popular) ?? paket[0])?.id ?? "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await fetch("/api/beli", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Gagal membuat pesanan");
    setHasil(j as Hasil);
  }

  if (hasil) {
    return (
      <section className="card p-6">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Check size={18} /> Pesanan dibuat</h2>
        <p className="mb-4 text-sm muted">Kode pesanan <b className="font-mono">{hasil.ref}</b> · {hasil.paket} · <b>{hasil.nominal}</b></p>
        <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm">
          <li>
            {hasil.bank
              ? <>Transfer <b>{hasil.nominal}</b> ke <b>{hasil.bank.nama} {hasil.bank.rekening}</b> a.n. {hasil.bank.atasNama}. Tulis <b className="font-mono">{hasil.ref}</b> di berita transfer.</>
              : <>Hubungi admin lewat WhatsApp untuk cara pembayaran (sebutkan kode <b className="font-mono">{hasil.ref}</b>).</>}
          </li>
          <li>Kirim bukti transfer ke WhatsApp admin dengan tombol di bawah.</li>
          <li>Setelah dicek, admin mengirim <b>email &amp; sandi sementara</b> akunmu lewat WhatsApp. Masuk di halaman Masuk → "Masuk dengan email".</li>
        </ol>
        {hasil.wa
          ? <a className="btn btn-primary" href={hasil.wa} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Konfirmasi via WhatsApp</a>
          : <p className="text-sm" style={{ color: "var(--warn)" }}>Nomor WhatsApp admin belum diatur di server — hubungi admin Exact Course.</p>}
      </section>
    );
  }

  const input = "input";
  return (
    <form onSubmit={submit} className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {paket.map((p) => (
          <label key={p.id} className="card cursor-pointer p-4" style={{ borderColor: f.paket === p.id ? "var(--accent)" : undefined }}>
            <input type="radio" name="paket" value={p.id} checked={f.paket === p.id} onChange={() => setF({ ...f, paket: p.id })} className="mr-2" />
            <span className="font-semibold">{p.name}</span>
            {p.popular && <span className="chip ml-2 text-[10px]">populer</span>}
            <div className="mt-1 text-lg font-semibold">{rupiah(p.harga)} {p.coret && <s className="text-xs muted">{rupiah(p.coret)}</s>}</div>
            <div className="text-xs muted">{p.blurb}</div>
          </label>
        ))}
      </div>
      <section className="card grid gap-3 p-5">
        {err && <p className="text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
        <input className={input} required placeholder="Nama lengkap" value={f.nama} onChange={set("nama")} />
        <input className={input} type="email" required placeholder="Email (jadi nama akun)" value={f.email} onChange={set("email")} />
        <input className={input} type="tel" required placeholder="Nomor WhatsApp (untuk menerima akun)" value={f.hp} onChange={set("hp")} />
        <input className={input} placeholder="Kode afiliasi / teman yang mengajak (opsional)" value={f.kode} onChange={set("kode")} />
        <button className="btn btn-primary" disabled={busy || !f.paket}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Building2 size={15} />} Pesan &amp; lihat cara bayar
        </button>
        <p className="text-xs muted">Pembayaran manual (transfer) dikonfirmasi lewat WhatsApp admin. Akun dibuat setelah pembayaran dicek.</p>
      </section>
    </form>
  );
}
