"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Loader2, X } from "lucide-react";
import { money, rupiah } from "@/lib/packages";
import type { AffiliateRecord, AffiliateStats, CommissionRecord, PayoutRecord } from "@/lib/db/types";

type Aff = AffiliateRecord & AffiliateStats & { fullName?: string; email?: string };
type Comm = CommissionRecord & { affiliateName: string };

export function AffiliateAdmin({ affiliates, payouts, commissions, holdDays }: {
  affiliates: Aff[]; payouts: PayoutRecord[]; commissions: Comm[]; holdDays: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"payouts" | "commissions" | "affiliates">("payouts");

  async function post(url: string, body: unknown, key: string) {
    setBusy(key);
    await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    router.refresh();
  }

  const pending = commissions.filter((c) => c.status === "pending");
  const ripe = pending.filter((c) => Date.now() - new Date(c.createdAt).getTime() >= holdDays * 864e5);
  const requested = payouts.filter((p) => p.status === "requested");

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        <Tab on={tab === "payouts"} onClick={() => setTab("payouts")}>
          Pencairan {requested.length > 0 && <b>({requested.length})</b>}
        </Tab>
        <Tab on={tab === "commissions"} onClick={() => setTab("commissions")}>
          Komisi {ripe.length > 0 && <b>({ripe.length} siap)</b>}
        </Tab>
        <Tab on={tab === "affiliates"} onClick={() => setTab("affiliates")}>Daftar afiliasi</Tab>
      </div>

      {/* ------------------------------------------------------ pencairan */}
      {tab === "payouts" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ background: "var(--bg-sunken)" }}>
              <Th>Afiliasi</Th><Th right>Nominal</Th><Th>Rekening</Th><Th>Diajukan</Th><Th>Status</Th><Th />
            </tr></thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2.5">{p.affiliateName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">{money(p.amount, p.currency)}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {p.method
                      ? <>{p.method.provider} · {p.method.accountNumber}<br /><span className="muted">{p.method.accountName}</span></>
                      : <span className="muted">belum diisi</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs muted">
                    {new Date(p.requestedAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                  </td>
                  <td className="px-4 py-2.5"><Chip s={p.status} /></td>
                  <td className="px-4 py-2.5 text-right">
                    {p.status === "requested" && (
                      <span className="flex justify-end gap-1.5">
                        <button className="btn btn-primary !px-2 !py-1 !text-xs" disabled={busy === p.id}
                          onClick={() => post("/api/admin/payout", { id: p.id, status: "paid" }, p.id)}>
                          {busy === p.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Sudah dibayar
                        </button>
                        <button className="btn btn-ghost !px-2 !py-1 !text-xs" disabled={busy === p.id}
                          onClick={() => post("/api/admin/payout", { id: p.id, status: "rejected" }, p.id)}>
                          <X size={12} />
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!payouts.length && <p className="p-6 text-center text-sm muted">Belum ada permintaan pencairan.</p>}
        </div>
      )}

      {/* -------------------------------------------------------- komisi */}
      {tab === "commissions" && (
        <>
          {ripe.length > 0 && (
            <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
              <p className="flex-1 text-sm">
                <strong>{ripe.length} komisi</strong> sudah melewati masa tahan {holdDays} hari dan siap disetujui
                ({money(ripe.reduce((a, c) => a + c.amount, 0), ripe[0]?.currency ?? "IDR")}).
              </p>
              <button className="btn btn-primary" disabled={busy === "bulk"}
                onClick={() => post("/api/admin/commissions", { ids: ripe.map((c) => c.id), status: "approved" }, "bulk")}>
                {busy === "bulk" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Setujui semua
              </button>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ background: "var(--bg-sunken)" }}>
                <Th>Afiliasi</Th><Th right>Komisi</Th><Th right>Rate</Th><Th>Dibuat</Th><Th>Status</Th><Th />
              </tr></thead>
              <tbody>
                {commissions.map((c) => {
                  const ready = Date.now() - new Date(c.createdAt).getTime() >= holdDays * 864e5;
                  return (
                    <tr key={c.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-4 py-2.5">{c.affiliateName}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(c.amount, c.currency)}</td>
                      <td className="px-4 py-2.5 text-right text-xs">{Math.round(c.rate * 100)}%</td>
                      <td className="px-4 py-2.5 text-xs muted">
                        {new Date(c.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                        {c.status === "pending" && !ready && (
                          <span className="ml-1 inline-flex items-center gap-0.5"><Clock size={10} /> ditahan</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5"><Chip s={c.status} /></td>
                      <td className="px-4 py-2.5 text-right">
                        {c.status === "pending" && (
                          <span className="flex justify-end gap-1.5">
                            <button className="btn btn-ghost !px-2 !py-1 !text-xs" disabled={busy === c.id}
                              onClick={() => post("/api/admin/commissions", { ids: [c.id], status: "approved" }, c.id)}>
                              Setujui
                            </button>
                            <button className="btn btn-ghost !px-2 !py-1 !text-xs" disabled={busy === c.id}
                              onClick={() => post("/api/admin/commissions", { ids: [c.id], status: "void" }, c.id)}>
                              Batalkan
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!commissions.length && <p className="p-6 text-center text-sm muted">Belum ada komisi.</p>}
          </div>
        </>
      )}

      {/* ------------------------------------------------------ afiliasi */}
      {tab === "affiliates" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ background: "var(--bg-sunken)" }}>
              <Th>Afiliasi</Th><Th>Kode</Th><Th right>Klik</Th><Th right>Daftar</Th>
              <Th right>Beli</Th><Th right>Menunggu</Th><Th right>Siap cair</Th><Th right>Dibayar</Th>
            </tr></thead>
            <tbody>
              {affiliates.map((a) => (
                <tr key={a.userId} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2.5">
                    <div>{a.fullName ?? "—"}</div>
                    <div className="text-xs muted">{a.email}</div>
                  </td>
                  <td className="px-4 py-2.5"><span className="chip font-mono">{a.code}</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{a.clicks}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{a.signups}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{a.conversions}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{rupiah(a.pendingIdr)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{rupiah(a.withdrawableIdr)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{rupiah(a.paidIdr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!affiliates.length && <p className="p-6 text-center text-sm muted">Belum ada afiliasi.</p>}
        </div>
      )}
    </>
  );
}

const Th = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => (
  <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>
);

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="chip" onClick={onClick}
      style={on ? { background: "var(--accent)", color: "var(--accent-fg)", borderColor: "transparent" } : undefined}>
      {children}
    </button>
  );
}

function Chip({ s }: { s: string }) {
  const label: Record<string, string> = {
    pending: "menunggu", approved: "disetujui", paid: "dibayar", void: "dibatalkan",
    requested: "diajukan", rejected: "ditolak",
  };
  const color: Record<string, string> = {
    approved: "var(--ok)", paid: "var(--ok)", pending: "var(--warn)",
    requested: "var(--warn)", void: "var(--danger)", rejected: "var(--danger)",
  };
  return <span className="chip" style={{ color: color[s] ?? "var(--fg-muted)" }}>{label[s] ?? s}</span>;
}
