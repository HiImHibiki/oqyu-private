"use client";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

export function SettingsForm({ user, canSetPassword }: {
  user: { fullName: string; email: string; phone: string; school: string };
  canSetPassword: boolean;
}) {
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Data peserta</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Item k="Nama lengkap" v={user.fullName} />
          <Item k="ID peserta (email)" v={user.email} />
          <Item k="Nomor HP" v={user.phone} />
          <Item k="Sekolah / kampus" v={user.school || "—"} />
        </dl>
        <p className="mt-4 text-xs muted">
          Nama dan email dipakai pada sertifikat dan papan peringkat. Hubungi admin untuk mengubahnya.
        </p>
      </section>

      {!canSetPassword ? (
        <section className="card p-5">
          <h2 className="mb-2 font-semibold">Cara masuk</h2>
          <p className="text-sm muted">
            Akunmu memakai <strong>{user.email}</strong> lewat Google. Tidak ada kata sandi
            yang perlu diingat — dan tidak ada yang bisa dicuri. Keamanan akunmu
            mengikuti pengaturan keamanan akun Google-mu.
          </p>
        </section>
      ) : (
      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Ganti kata sandi</h2>
        <p className="mb-4 text-sm muted">
          Dipakai di halaman masuk admin. Peserta masuk lewat Google.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Kata sandi baru</span>
            <input className="input" type="password" value={pw.password}
              onChange={(e) => setPw((p) => ({ ...p, password: e.target.value }))} autoComplete="new-password" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Konfirmasi</span>
            <input className="input" type="password" value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" />
          </label>
        </div>

        {msg && (
          <p className="mt-3 text-sm" style={{ color: msg.ok ? "var(--ok)" : "var(--danger)" }}>
            {msg.ok && <Check size={13} className="mr-1 inline" />}{msg.text}
          </p>
        )}

        <button className="btn btn-primary mt-4" disabled={busy || !pw.password}
          onClick={async () => {
            setBusy(true); setMsg(null);
            const r = await fetch("/api/auth/password", {
              method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(pw),
            });
            const j = await r.json();
            setBusy(false);
            setMsg(r.ok ? { ok: true, text: "Kata sandi diperbarui." } : { ok: false, text: j.error });
            if (r.ok) setPw({ password: "", confirm: "" });
          }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null} Simpan kata sandi
        </button>
      </section>
      )}
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg px-3.5 py-2.5" style={{ background: "var(--bg-sunken)" }}>
      <dt className="text-[11px] uppercase tracking-wider muted">{k}</dt>
      <dd className="mt-0.5 text-sm">{v}</dd>
    </div>
  );
}
