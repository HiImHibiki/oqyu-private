"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";

/** Pendaftaran murid: nama, username, kata sandi — langsung aktif. */
export function FormDaftar({ next }: { next: string }) {
  const router = useRouter();
  const [f, setF] = useState({ fullName: "", username: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await fetch("/api/auth/daftar", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Tidak bisa mendaftar");
    router.push(next || "/latihan");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <p className="text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
      <input className="input" required placeholder="Nama lengkap" autoComplete="name" value={f.fullName} onChange={set("fullName")} />
      <input className="input" required placeholder="Username (huruf kecil/angka)" autoComplete="username"
        autoCapitalize="none" spellCheck={false} pattern="[a-zA-Z0-9._\-]{3,32}"
        title="3–32 karakter: huruf, angka, titik, _ atau -" value={f.username} onChange={set("username")} />
      <input className="input" type="password" required minLength={6} placeholder="Kata sandi (min. 6)" autoComplete="new-password" value={f.password} onChange={set("password")} />
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Daftar
      </button>
    </form>
  );
}
