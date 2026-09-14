"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import type { AdminUserRow } from "@/lib/db/types";

export function UserTable({ rows, q, meId, canEditRole }: {
  rows: AdminUserRow[]; q: string; meId: string; canEditRole: boolean;
}) {
  const router = useRouter();
  const [needle, setNeedle] = useState(q);
  const [busy, setBusy] = useState<string | null>(null);

  async function setAccommodation(userId: string, multiplier: string) {
    setBusy(userId);
    await fetch("/api/admin/accommodation", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, multiplier: Number(multiplier) }),
    });
    setBusy(null);
    router.refresh();
  }

  async function setRole(userId: string, role: string) {
    setBusy(userId);
    await fetch("/api/admin/role", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <>
      <form
        className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2"
        style={{ background: "var(--bg-sunken)" }}
        onSubmit={(e) => { e.preventDefault(); router.push(`/admin/peserta?q=${encodeURIComponent(needle)}`); }}
      >
        <Search size={15} className="muted" />
        <input className="w-full bg-transparent text-sm outline-none" placeholder="Cari nama atau email…"
          value={needle} onChange={(e) => setNeedle(e.target.value)} />
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bg-sunken)" }}>
              <Th>Peserta</Th><Th>HP</Th><Th right>Latihan</Th>
              <Th>Rujukan</Th><Th>Waktu</Th><Th>Peran</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t" style={{ borderColor: "var(--border)", background: u.role === "menunggu" ? "color-mix(in srgb, var(--warn) 8%, transparent)" : undefined }}>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{u.fullName || "—"}</div>
                  <div className="text-xs muted">{u.email}</div>
                  {u.school && <div className="text-[11px] muted">{u.school}</div>}
                </td>
                <td className="px-4 py-2.5 text-xs">{u.phone || "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{u.attempts}</td>
                <td className="px-4 py-2.5">
                  {u.referredBy ? <span className="chip font-mono">{u.referredBy}</span> : <span className="muted">—</span>}
                </td>
                <td className="px-4 py-2.5">
                  {canEditRole ? (
                    <select className="input !w-auto !py-1 text-xs" value={String(u.timeMultiplier ?? 1)}
                      disabled={busy === u.id}
                      title="Akomodasi waktu. Berlaku untuk try out BERIKUTNYA — yang sedang berjalan durasinya sudah dibekukan."
                      onChange={(e) => setAccommodation(u.id, e.target.value)}>
                      <option value="1">normal</option>
                      <option value="1.5">1,5×</option>
                      <option value="2">2×</option>
                    </select>
                  ) : (u.timeMultiplier ?? 1) === 1 ? (
                    <span className="muted">normal</span>
                  ) : (
                    <span className="chip">{String(u.timeMultiplier).replace(".", ",")}×</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {canEditRole && u.role === "menunggu" ? (
                    <span className="flex items-center gap-1.5">
                      <button className="btn btn-primary !px-3 !py-1 text-xs" disabled={busy === u.id}
                        title="Terima akun ini — murid langsung bisa membuka latihan"
                        onClick={() => setRole(u.id, "student")}>
                        {busy === u.id ? <Loader2 size={13} className="animate-spin" /> : null} Setujui
                      </button>
                      <span className="chip" style={{ color: "var(--warn)" }}>menunggu</span>
                    </span>
                  ) : canEditRole && u.id !== meId ? (
                    <span className="flex items-center gap-1.5">
                      <select className="input !w-auto !py-1 text-xs" value={u.role}
                        disabled={busy === u.id}
                        onChange={(e) => setRole(u.id, e.target.value)}>
                        <option value="student">student (murid, gratis)</option>
                        <option value="umum">umum (berbayar)</option>
                        <option value="reviewer">reviewer</option>
                        <option value="admin">admin</option>
                      </select>
                      {busy === u.id && <Loader2 size={13} className="animate-spin" />}
                    </span>
                  ) : (
                    <span className="chip">{u.role}{u.id === meId ? " · kamu" : ""}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-6 text-center text-sm muted">Tidak ada peserta yang cocok.</p>}
      </div>

      {!canEditRole && (
        <p className="mt-3 text-xs muted">Hanya peran <strong>admin</strong> yang bisa mengubah peran akun dan akomodasi waktu.</p>
      )}
      <p className="mt-3 text-xs muted">
        Akomodasi waktu berlaku untuk try out <strong>berikutnya</strong>. Try out yang sedang
        berjalan durasinya sudah dibekukan saat dimulai — memperpanjangnya di tengah jalan
        membuat hasilnya tidak lagi bisa dibandingkan, dan memperpendeknya jelas lebih buruk.
      </p>
    </>
  );
}

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>
);
