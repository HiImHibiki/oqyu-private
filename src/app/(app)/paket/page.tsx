import { Suspense } from "react";
import { Clock, ShieldCheck } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getBlueprint } from "@/lib/exams/blueprints";
import { currencyForCountry, gatewayFor } from "@/lib/geo";
import { getLocale, intlTag, translatorFor } from "@/lib/i18n";
import { expiringSoon, quotaByExam } from "@/lib/entitlements";
import { money, packageById } from "@/lib/packages";
import { PageHead } from "@/components/ui/AppShell";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { OrderRecord } from "@/lib/db";
import { midtransEnabled } from "@/lib/midtrans";
import { stripeEnabled } from "@/lib/stripe";
import { BuyPackage } from "./BuyPackage";
import { ManualTransfer } from "./ManualTransfer";
import { ResumePayment } from "./ResumePayment";

export const metadata = { title: "Paket" };

const STATUS_KEY: Record<OrderRecord["status"], MessageKey> = {
  pending: "packages.statusPending",
  paid: "packages.statusPaid",
  failed: "packages.statusFailed",
  expired: "packages.statusExpired",
  refunded: "packages.statusRefunded",
};

export default async function PackagesPage() {
  const user = (await currentUser())!;
  const locale = await getLocale();
  const tag = intlTag(locale);
  const t = translatorFor(locale);

  const [ents, orders] = await Promise.all([
    getDb().entitlements(user.id),
    getDb().ordersOf(user.id),
  ]);

  /* Mata uangnya mengikuti negara di profil, bukan bahasa antarmuka: harga
   * ditetapkan per mata uang, jadi mengganti bahasa tidak boleh mengganti
   * harga. */
  const currency = currencyForCountry(user.country);
  const quota = quotaByExam(ents);

  /* Kunci gateway hanya ada di server, jadi jawabannya dihitung di sini dan
   * dikirim sebagai fakta — bukan ditebak oleh peramban. */
  const onlineAvailable = gatewayFor(currency) === "midtrans" ? midtransEnabled() : stripeEnabled();

  /* Pesanan yang tertinggal di tengah jalan. Ditampilkan berapa pun umurnya —
   * sesi pembayarannya dibuat ulang saat tombolnya ditekan. */
  const pending = orders.find((o) => o.status === "pending");
  const pendingPkg = pending ? packageById(pending.packageId) : null;

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(tag, { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHead title={t("packages.title")} subtitle={t("packages.sub")} />

      {pending && (
        <section className="card mb-5 p-5" style={{ borderColor: "var(--warn)" }}>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "color-mix(in srgb, var(--warn) 16%, transparent)", color: "var(--warn)" }}>
              <Clock size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{t("packages.pendingTitle")}</h2>
              <p className="mt-0.5 text-sm muted">
                {pending.provider === "manual"
                  ? t("packages.transferPending")
                  : t("packages.pendingBody", { pkg: pendingPkg?.name ?? pending.packageId })}
                {" · "}
                {money(pending.amount, pending.currency, tag)}
              </p>
            </div>
            {pending.provider !== "manual" && (
              <ResumePayment orderId={pending.id} packageId={pending.packageId}
                gateway={(pending.provider === "stripe" || pending.provider === "midtrans")
                  ? pending.provider : "simulation"} />
            )}
          </div>

          {/* Transfer yang belum dikonfirmasi tidak butuh tombol — ia butuh
              nomor rekening dan kode pesanannya, lagi, tanpa harus dicari. */}
          {pending.provider === "manual" && (
            <div className="mt-4">
              <ManualTransfer orderId={pending.id} amount={pending.amount} currency={pending.currency}
                packageName={pendingPkg?.name ?? pending.packageId} buyerName={user.fullName} />
            </div>
          )}
        </section>
      )}

      <section className="card mb-7 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider muted">{t("packages.quotaTitle")}</h2>
        {quota.length === 0 ? (
          <p className="text-sm muted">{t("packages.quotaEmpty")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {quota.map((q) => (
              <li key={q.exam} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                style={{ background: "var(--bg-sunken)" }}>
                <span className="chip">{q.exam}</span>
                <span className="font-medium">{getBlueprint(q.exam)?.name ?? q.exam}</span>
                <span className="text-xs muted">{t("packages.remaining", { n: q.left })}</span>
                {q.expiresAt && (
                  <span className="text-xs" style={{ color: expiringSoon(q) ? "var(--warn)" : "var(--fg-muted)" }}>
                    · {t("packages.expiresOn", { date: date(q.expiresAt) })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Suspense fallback={<p className="text-sm muted">…</p>}>
        <BuyPackage currency={currency} onlineAvailable={onlineAvailable} buyerName={user.fullName} />
      </Suspense>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider muted">{t("packages.history")}</h2>
        {orders.length === 0 ? (
          <p className="text-sm muted">{t("packages.historyEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => {
              const p = packageById(o.packageId);
              return (
                <li key={o.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="chip">{o.exam}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p?.name ?? o.packageId}</span>
                    <span className="block text-xs muted">
                      {date(o.createdAt)}
                      {o.couponCode ? ` · ${o.couponCode}` : ""}
                      {o.discount ? ` −${money(o.discount, o.currency, tag)}` : ""}
                    </span>
                  </span>
                  <span className="text-sm font-semibold">{money(o.amount, o.currency, tag)}</span>
                  <span className="chip" style={{ color: o.status === "paid" ? "var(--ok)" : o.status === "pending" ? "var(--warn)" : "var(--fg-muted)" }}>
                    {t(STATUS_KEY[o.status])}
                  </span>
                  {o.status === "pending" && o.provider !== "manual" && (
                    <ResumePayment compact orderId={o.id} packageId={o.packageId}
                      gateway={(o.provider === "stripe" || o.provider === "midtrans") ? o.provider : "simulation"} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 flex items-start gap-2 text-xs muted">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" style={{ color: "var(--ok)" }} />
          {t("packages.guarantee")}
        </p>
      </section>
    </div>
  );
}
