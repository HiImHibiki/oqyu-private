"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { Logo } from "@/components/ui/SiteHeader";

export function AdminLoginForm({ signedInAs }: { signedInAs: string | null }) {
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
      body: JSON.stringify({ username: email, password }),
    });
    const j = await r.json();
    if (!r.ok) { setBusy(false); return setErr(j.error ?? "Gagal masuk"); }

    // Login berhasil belum tentu berarti punya akses admin.
    const me = await (await fetch("/api/me")).json();
    setBusy(false);
    if (!["admin", "reviewer"].includes(me?.user?.role)) {
      setErr("Akun ini bukan admin. Hubungi pemilik akun admin untuk diberi akses.");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16">
      <form onSubmit={submit} className="card w-full max-w-md p-7 rise">
        <div className="mb-6 flex items-center gap-3">
          <Logo small />
          <span className="chip ml-auto" style={{ color: "var(--accent)" }}>
            <ShieldCheck size={11} /> Panel admin
          </span>
        </div>

        <h1 className="display mb-1 text-2xl">Masuk sebagai admin</h1>
        <p className="mb-6 text-sm muted">
          Halaman ini terpisah dari halaman masuk peserta. Hanya akun berperan
          <strong> admin</strong> atau <strong>reviewer</strong> yang bisa lanjut.
        </p>

        {signedInAs && (
          <div className="mb-4 rounded-xl px-3.5 py-2.5 text-sm" style={{ background: "var(--bg-sunken)" }}>
            Kamu sedang masuk sebagai <strong>{signedInAs}</strong>, dan akun itu belum berperan admin.
          </div>
        )}

        {err && (
          <div className="mb-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm"
            style={{ background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {err}
          </div>
        )}

        <label className="mb-4 block">
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><User size={15} /> Username</span>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="username" autoCapitalize="none" spellCheck={false} required />
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><Lock size={15} /> Kata sandi</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" required />
        </label>

        <button className="btn btn-primary mt-5 w-full" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Masuk
        </button>

        <p className="mt-4 text-center text-xs muted">
          Bukan admin? <Link href="/masuk" className="underline">Masuk sebagai peserta</Link>
        </p>
      </form>
    </main>
  );
}
