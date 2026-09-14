"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Smartphone } from "lucide-react";

/** Masuk dengan akun Exact Canvas: No. HP + sandi yang sama. */
export function FormCanvas({ next }: { next: string }) {
  const router = useRouter();
  const [hp, setHp] = useState("");
  const [sandi, setSandi] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await fetch("/api/auth/canvas", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hp, sandi }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Tidak bisa masuk");
    router.push(next || "/latihan");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <p className="text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
      <input className="input" type="tel" required placeholder="No. HP (akun Exact Canvas)" autoComplete="tel"
        value={hp} onChange={(e) => setHp(e.target.value)} />
      <input className="input" type="password" required placeholder="Sandi Exact Canvas" autoComplete="current-password"
        value={sandi} onChange={(e) => setSandi(e.target.value)} />
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} />} Masuk dengan akun Exact Canvas
      </button>
    </form>
  );
}
