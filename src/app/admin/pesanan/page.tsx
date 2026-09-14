import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { money } from "@/lib/packages";
import { orderRef } from "@/lib/payment";
import { PageHead } from "@/components/ui/AppShell";
import { StatusChip } from "../StatusChip";
import { ConfirmButton } from "./ConfirmButton";
import { RefundButton } from "./RefundButton";
import { semuaSandiSementara } from "@/lib/practice/sandi";
import { devAuth } from "@/lib/db/dev";
import { usingDev } from "@/lib/db";
import { MessageCircle } from "lucide-react";

export const metadata = { title: "Pesanan" };

export default async function PesananPage() {
  await requireAdmin();
  const orders = await getDb().listOrders(200);
  const sandi = await semuaSandiSementara();
  const hpDari = new Map<string, string>();
  if (usingDev()) for (const o of orders) if (!hpDari.has(o.userId)) hpDari.set(o.userId, (await devAuth.userById(o.userId))?.phone ?? "");
  const situs = process.env.NEXT_PUBLIC_SITE_URL || "";
  const waKe = (hp: string, teks: string) => hp.replace(/\D/g, "") ? `https://wa.me/${hp.replace(/\D/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(teks)}` : null;
  const paid = orders.filter((o) => o.status === "paid");
  /* Transfer bank yang menunggu dicocokkan. Ditarik ke atas karena inilah satu-
   * satunya baris di halaman ini yang menuntut tindakan, bukan sekadar dibaca. */
  const awaiting = orders.filter((o) => o.status === "pending" && o.provider === "manual");
  // Pendapatan dijumlahkan PER MATA UANG — menjumlahkan rupiah dengan dolar
  // menghasilkan angka yang tidak berarti apa pun.
  const revenue = new Map<string, number>();
  for (const o of paid) revenue.set(o.currency, (revenue.get(o.currency) ?? 0) + o.amount);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHead
        title="Pesanan"
        subtitle={`${paid.length} dari ${orders.length} pesanan lunas · ${[...revenue].map(([c, v]) => money(v, c as never)).join(" + ") || "-"}`}
      />

      {awaiting.length > 0 && (
        <p className="mb-4 rounded-xl px-3.5 py-2.5 text-sm"
          style={{ background: "color-mix(in srgb, var(--warn) 14%, transparent)", color: "var(--warn)" }}>
          {awaiting.length} transfer bank menunggu dicocokkan dengan mutasi rekening.
          Cocokkan kode pesanan dan nominalnya, lalu tekan «Tandai lunas».
        </p>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bg-sunken)" }}>
              <th className="px-4 py-2.5 text-left font-medium">Peserta</th>
              <th className="px-4 py-2.5 text-left font-medium">Paket</th>
              <th className="px-4 py-2.5 text-left font-medium">Kode</th>
              <th className="px-4 py-2.5 text-right font-medium">Nominal</th>
              <th className="px-4 py-2.5 text-left font-medium">Gateway</th>
              <th className="px-4 py-2.5 text-left font-medium">Waktu</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
              <th className="px-4 py-2.5 text-left font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-2.5">
                  <div>{o.fullName ?? "—"}</div>
                  <div className="text-xs muted">{o.email}</div>
                  {hpDari.get(o.userId) && <div className="text-xs muted">WA {hpDari.get(o.userId)}</div>}
                  {o.status === "paid" && sandi[o.userId] && (
                    <div className="mt-1 rounded-lg px-2 py-1 text-xs" style={{ background: "var(--bg-sunken)" }}>
                      Akun: <b>{sandi[o.userId].email}</b> · sandi <b className="font-mono">{sandi[o.userId].sandi}</b>
                      {waKe(hpDari.get(o.userId) || sandi[o.userId].hp, `Halo ${o.fullName ?? ""}, paket Exact Practice kamu sudah aktif.\n\nMasuk di ${situs}/masuk (pilih "Masuk dengan email")\nEmail: ${sandi[o.userId].email}\nSandi sementara: ${sandi[o.userId].sandi}\n\nGanti sandinya di menu Pengaturan ya. Selamat belajar!`) && (
                        <a className="ml-2 inline-flex items-center gap-1 underline" target="_blank" rel="noreferrer"
                          href={waKe(hpDari.get(o.userId) || sandi[o.userId].hp, `Halo ${o.fullName ?? ""}, paket Exact Practice kamu sudah aktif.\n\nMasuk di ${situs}/masuk (pilih "Masuk dengan email")\nEmail: ${sandi[o.userId].email}\nSandi sementara: ${sandi[o.userId].sandi}\n\nGanti sandinya di menu Pengaturan ya. Selamat belajar!`)!}>
                          <MessageCircle size={12} /> Kirim akun via WA
                        </a>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span className="chip">{o.exam}</span> <span className="text-xs">{o.packageId}</span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{orderRef(o.id)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{money(o.amount, o.currency)}</td>
                <td className="px-4 py-2.5 text-xs">{o.provider}</td>
                <td className="px-4 py-2.5 text-xs muted">
                  {new Date(o.paidAt ?? o.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                </td>
                <td className="px-4 py-2.5"><StatusChip status={o.status} /></td>
                <td className="px-4 py-2.5">
                  {o.status === "paid" && (
                    <RefundButton orderId={o.id} label={`${o.packageId} — ${o.email ?? o.userId}`} />
                  )}
                  {o.status === "pending" && (
                    <ConfirmButton orderId={o.id} code={orderRef(o.id)}
                      label={`${o.packageId} · ${money(o.amount, o.currency)} · ${o.fullName ?? ""} ${o.email ?? o.userId}`} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && <p className="p-6 text-center text-sm muted">Belum ada pesanan.</p>}
      </div>
    </div>
  );
}
