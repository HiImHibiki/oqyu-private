"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2, ShieldAlert } from "lucide-react";

/* Mengeluarkan akun dari semua perangkat.
 *
 * Ditambahkan karena sebelumnya tidak ada jalan sama sekali: seseorang yang
 * menduga akunnya dipakai orang lain hanya bisa menunggu sesi itu kedaluwarsa
 * sendiri setelah tujuh hari. Mengganti kata sandi pun tidak memutus sesi yang
 * sudah berjalan. */
export function SessionControl() {
  const router = useRouter();
  const [siap, setSiap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function keluarkan() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/auth/sessions", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Gagal mengakhiri sesi"); return; }
    router.push("/masuk");
    router.refresh();
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 font-semibold">Keamanan sesi</h2>
      <p className="mb-4 text-xs muted">
        Sesi berakhir sendiri setelah tujuh hari. Kalau kamu menduga ada orang lain
        yang masih masuk ke akunmu, akhiri semuanya sekarang.
      </p>

      {err && <p className="mb-3 text-sm" style={{ color: "var(--danger)" }}>{err}</p>}

      {!siap ? (
        <button className="btn" onClick={() => setSiap(true)}>
          <LogOut size={15} /> Keluarkan dari semua perangkat
        </button>
      ) : (
        <div className="rounded-xl p-4" style={{ background: "var(--bg-sunken)" }}>
          <p className="mb-3 flex items-start gap-2 text-sm">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" style={{ color: "var(--warn)" }} />
            <span>
              Seluruh sesi akan diakhiri, <strong>termasuk yang sedang kamu pakai</strong>.
              Kamu perlu masuk lagi setelah ini.
            </span>
          </p>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={busy} onClick={() => void keluarkan()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              Ya, akhiri semua
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => setSiap(false)}>
              Batal
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
