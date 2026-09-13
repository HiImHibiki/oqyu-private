"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, Banknote, Check, Copy, Gift, Link2, Loader2, MousePointerClick, Users, Wallet,
} from "lucide-react";
import { money } from "@/lib/packages";
import type { Currency } from "@/lib/geo";
import type {
  AffiliateStats, CommissionRecord, PayoutMethod, PayoutRecord, ReferralRecord,
} from "@/lib/db/types";

interface Props {
  state: "none" | "active";
  code?: string;
  rate: number;
  link?: string;
  method?: PayoutMethod | null;
  minPayout: number;
  holdDays: number;
  bonus: number;
  stats?: AffiliateStats;
  referrals?: ReferralRecord[];
  commissions?: CommissionRecord[];
  payouts?: PayoutRecord[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu", approved: "Disetujui", paid: "Dibayar", void: "Dibatalkan",
  requested: "Diajukan", rejected: "Ditolak",
};

export function AffiliatePanel(p: Props) {
  const cur: Currency = p.stats?.currency ?? "IDR";
  const fmt = (n: number) => money(n, cur);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [method, setMethod] = useState<PayoutMethod>(
    p.method ?? { type: "bank", provider: "", accountNumber: "", accountName: "" },
  );

  async function post(url: string, body?: unknown) {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Terjadi kesalahan");
      router.refresh();
      return j;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Terjadi kesalahan");
      return null;
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------------------------------ belum bergabung */
  if (p.state === "none") {
    return (
      <div className="card p-7 rise">
        <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          <Gift size={22} />
        </span>
        <h2 className="display mb-2 text-xl">Ajak teman, dapat komisi</h2>
        <p className="mb-5 max-w-lg text-sm leading-relaxed muted">
          Kamu mendapat <strong>{Math.round(p.rate * 100)}%</strong> dari setiap paket yang dibeli lewat
          tautanmu, dan temanmu mendapat <strong>{p.bonus} kuota try out bonus</strong> di pembelian
          pertamanya. Tidak ada biaya dan tidak ada target.
        </p>

        <ul className="mb-6 space-y-2.5 text-sm">
          <Step n={1} text="Ambil tautan afiliasimu di halaman ini." />
          <Step n={2} text="Bagikan ke grup angkatan, Instagram, atau ke adik kelas." />
          <Step n={3} text={`Komisi masuk begitu temanmu membayar, dan bisa dicairkan setelah ${p.holdDays} hari masa refund lewat.`} />
          <Step n={4} text={`Cairkan kapan saja setelah saldo mencapai ${fmt(p.minPayout)}.`} />
        </ul>

        {err && <Err msg={err} />}
        <button className="btn btn-primary" disabled={busy} onClick={() => post("/api/affiliate/join")}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
          Aktifkan tautan afiliasi
        </button>
      </div>
    );
  }

  /* ---------------------------------------------------------- sudah aktif */
  const s = p.stats!;
  const canWithdraw = s.withdrawableIdr >= p.minPayout;

  return (
    <div className="space-y-5">
      {err && <Err msg={err} />}

      {/* tautan */}
      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Tautan kamu</h2>
        <p className="mb-3 text-xs muted">
          Kode <strong className="font-mono">{p.code}</strong> · komisi {Math.round(p.rate * 100)}%
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 truncate rounded-lg px-3 py-2 text-sm" style={{ background: "var(--bg-sunken)" }}>
            {p.link}
          </code>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(p.link ?? "");
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              } catch {
                setErr("Browser menolak akses papan klip. Salin manual dari kotak di samping.");
              }
            }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Tersalin" : "Salin"}
          </button>
        </div>
      </section>

      {/* statistik */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<MousePointerClick size={15} />} label="Klik tautan" value={String(s.clicks)} />
        <Stat icon={<Users size={15} />} label="Mendaftar" value={String(s.signups)}
          sub={`${s.conversions} membeli`} />
        <Stat icon={<Wallet size={15} />} label="Menunggu" value={fmt(s.pendingIdr)}
          sub={`cair setelah ${p.holdDays} hari`} />
        <Stat icon={<Banknote size={15} />} label="Siap dicairkan" value={fmt(s.withdrawableIdr)}
          sub={`total dibayar ${fmt(s.paidIdr)}`} accent />
      </div>

      {/* Komisi dalam mata uang lain.
          Angka di atas hanya mencakup SATU mata uang — menjumlahkan rupiah
          dengan dolar menghasilkan angka yang bukan keduanya. Sisanya
          ditampilkan terpisah supaya tidak ada komisi yang hilang dari layar. */}
      {(s.balances ?? []).length > 1 && (
        <section className="card p-5">
          <h2 className="mb-1 font-semibold">Komisi mata uang lain</h2>
          <p className="mb-3 text-xs muted">
            Pembeli dari luar Indonesia membayar dalam mata uangnya sendiri, jadi komisinya
            dihitung dan dicairkan terpisah — bukan dijumlahkan dengan rupiah.
          </p>
          <ul className="space-y-2">
            {(s.balances ?? []).filter((b) => b.currency !== cur).map((b) => (
              <li key={b.currency} className="flex items-baseline gap-3 text-sm">
                <span className="chip">{b.currency}</span>
                <span className="muted">menunggu</span>
                <span className="tabular-nums">{new Intl.NumberFormat("id-ID", { style: "currency", currency: b.currency, maximumFractionDigits: 0 }).format(b.pending)}</span>
                <span className="ml-auto muted">siap dicairkan</span>
                <span className="tabular-nums">{new Intl.NumberFormat("id-ID", { style: "currency", currency: b.currency, maximumFractionDigits: 0 }).format(b.withdrawable)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* pencairan */}
      <section className="card p-5">
        <h2 className="mb-1 font-semibold">Pencairan</h2>
        <p className="mb-4 text-xs muted">
          Minimum {fmt(p.minPayout)}. Dana dikirim ke rekening di bawah dalam 3 hari kerja setelah diajukan.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Jenis</span>
            <select className="input" value={method.type}
              onChange={(e) => setMethod({ ...method, type: e.target.value as PayoutMethod["type"] })}>
              <option value="bank">Rekening bank</option>
              <option value="ewallet">E-wallet</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{method.type === "bank" ? "Bank" : "Penyedia"}</span>
            <input className="input" value={method.provider} placeholder={method.type === "bank" ? "BCA" : "GoPay"}
              onChange={(e) => setMethod({ ...method, provider: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Nomor</span>
            <input className="input font-mono" value={method.accountNumber} placeholder="1234567890"
              onChange={(e) => setMethod({ ...method, accountNumber: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Atas nama</span>
            <input className="input" value={method.accountName} placeholder="Nama sesuai rekening"
              onChange={(e) => setMethod({ ...method, accountName: e.target.value })} />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-ghost" disabled={busy}
            onClick={() => post("/api/affiliate/method", method)}>
            Simpan rekening
          </button>
          <button className="btn btn-primary" disabled={busy || !canWithdraw}
            onClick={() => post("/api/affiliate/payout")}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />}
            Cairkan {fmt(s.withdrawableIdr)}
          </button>
          {!canWithdraw && (
            <span className="self-center text-xs muted">
              Kurang {fmt(Math.max(0, p.minPayout - s.withdrawableIdr))} lagi untuk bisa dicairkan.
            </span>
          )}
        </div>

        {Boolean(p.payouts?.length) && (
          <ul className="mt-4 space-y-1.5 text-sm">
            {p.payouts!.map((x) => (
              <li key={x.id} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: "var(--bg-sunken)" }}>
                <span className="flex-1">{fmt(x.amount)}</span>
                <span className="text-xs muted">
                  {new Date(x.requestedAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                </span>
                <span className="chip">{STATUS_LABEL[x.status] ?? x.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* rujukan */}
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Teman yang kamu ajak</h2>
        {!p.referrals?.length ? (
          <p className="text-sm muted">Belum ada yang mendaftar lewat tautanmu.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {p.referrals.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="flex-1">{r.referredName || "Peserta"}</span>
                <span className="text-xs muted">
                  {new Date(r.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                </span>
                <span className="chip" style={r.converted ? { color: "var(--ok)" } : undefined}>
                  {r.converted ? "sudah membeli" : "baru daftar"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* komisi */}
      {Boolean(p.commissions?.length) && (
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Riwayat komisi</h2>
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {p.commissions!.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="flex-1 font-medium">{fmt(c.amount)}</span>
                <span className="text-xs muted">{Math.round(c.rate * 100)}%</span>
                <span className="text-xs muted">
                  {new Date(c.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                </span>
                <span className="chip">{STATUS_LABEL[c.status] ?? c.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs muted">
        Komisi dibatalkan bila pesanan direfund. Membuat akun ganda untuk merujuk diri sendiri
        membatalkan seluruh komisi dan menutup akun afiliasi.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ kecil */

function Stat({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className="card p-4" style={accent ? { borderColor: "var(--accent)" } : undefined}>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs muted">{icon} {label}</div>
      <div className="display text-xl">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] muted">{sub}</div>}
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{n}</span>
      <span className="muted">{text}</span>
    </li>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm"
      style={{ background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }}>
      <AlertCircle size={16} className="mt-0.5 shrink-0" /> {msg}
    </div>
  );
}
