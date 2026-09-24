"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, TerminalSquare } from "lucide-react";

/* Masuk cepat untuk mesin pengembang.
 *
 * Hanya dirender ketika Supabase belum dikonfigurasi — di situ Google tidak
 * bisa dipakai sama sekali, dan tanpa jalan pintas ini seluruh aplikasi tidak
 * bisa dijalankan secara lokal. Sengaja terlihat jelas sebagai perkakas dev,
 * bukan sebagai bagian dari antarmuka peserta. */
export function DevQuickSignIn({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await fetch("/api/auth/dev-login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, fullName: name }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Could not sign in");
    router.push(next || "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-xl border border-dashed p-4"
      style={{ borderColor: "var(--border-strong)" }}>
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider muted">
        <TerminalSquare size={13} /> Development sign-in
      </p>
      <p className="mb-3 text-xs muted">
        Supabase is not configured, so Google sign-in is unavailable. Enter any
        email to create a local account in <code>.data/db.json</code>.
      </p>

      {err && <p className="mb-2 text-xs" style={{ color: "var(--danger)" }}>{err}</p>}

      <div className="space-y-2">
        <input className="input" type="email" required placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" placeholder="Full name (optional)"
          value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <button className="btn btn-ghost mt-3 w-full" disabled={busy}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : null} Sign in locally
      </button>
    </form>
  );
}
