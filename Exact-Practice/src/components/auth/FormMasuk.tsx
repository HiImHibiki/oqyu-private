"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";

/** Masuk murid: email + kata sandi (akun lokal Exact Practice). */
export function FormMasuk({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await fetch("/api/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
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
      <input className="input" type="email" required placeholder="Email" autoComplete="email"
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="input" type="password" required placeholder="Kata sandi" autoComplete="current-password"
        value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />} Masuk
      </button>
    </form>
  );
}
