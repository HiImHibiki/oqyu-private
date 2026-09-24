"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Building2, Check, CreditCard, Loader2, PartyPopper, ShieldCheck, Tag } from "lucide-react";
import { money, packageById, priceOf, strikeOf, visiblePackages, type TryoutPackage } from "@/lib/packages";
import type { Currency } from "@/lib/geo";
import { useI18n } from "@/components/ui/I18nProvider";
import { usePayment, type Gateway } from "@/lib/usePayment";
import { COUPON_ERROR_KEY, type CouponError } from "@/lib/coupons";
import { manualPaymentEnabled } from "@/lib/payment";
import { ManualTransfer } from "./ManualTransfer";

interface Applied { code: string; label: string; discount: number; total: number }

/** Pembelian paket tambahan untuk peserta yang sudah punya akun.
 *
 *  Pesanan baru dibuat ketika tombol bayar ditekan, bukan ketika paket
 *  dipilih — memilih-milih paket tidak boleh meninggalkan jejak pesanan
 *  menggantung. Setelah pesanan ada, harganya terkunci: kupon tidak bisa lagi
 *  diubah, karena nominal yang dikirim ke gateway sudah nominal itu. */
export function BuyPackage({ currency, onlineAvailable, buyerName }: {
  currency: Currency;
  /** Apakah Midtrans atau Stripe benar-benar terpasang. Diputuskan di server:
   *  kunci gateway tidak pernah sampai ke peramban, jadi peramban tidak bisa
   *  menyimpulkannya sendiri. */
  onlineAvailable: boolean;
  buyerName?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { t, intl } = useI18n();

  const [pkg, setPkg] = useState<TryoutPackage | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [gateway, setGateway] = useState<Gateway>("simulation");
  const [locked, setLocked] = useState<number | null>(null);   // total yang sudah terkunci di pesanan
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<Applied | null>(null);
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [done, setDone] = useState<TryoutPackage | null>(null);

  /* Transfer bank selalu jadi pilihan awal ketika rekeningnya diisi: itu cara
   * yang paling sedikit syaratnya — tidak butuh kartu, tidak butuh e-wallet,
   * dan tidak butuh apa pun berhasil dimuat dari pihak ketiga. */
  const manualOk = manualPaymentEnabled();
  const [method, setMethod] = useState<"manual" | "online">(manualOk ? "manual" : "online");
  const [manual, setManual] = useState<{ orderId: string; amount: number } | null>(null);

  const { busy, waiting, err, setErr, post, pay, waitFor } = usePayment((paidPackageId) => {
    setDone(packageById(String(paidPackageId ?? "")) ?? pkg);
    setPkg(null); setOrderId(null); setLocked(null); setManual(null); setApplied(null); setCode("");
    router.refresh();          // ringkasan kuota dan riwayat di halaman ikut segar
  });

  const shown = visiblePackages(currency);

  /* Dua hal yang bisa dibawa URL saat halaman ini dibuka:
   *   - `order`: kembali dari halaman Stripe atau Midtrans. `paid=1` bukan
   *     bukti apa pun, jadi status pesanannya yang ditunggu.
   *   - `paket`: paket yang tadi diklik di halaman depan, sebelum masuk. */
  useEffect(() => {
    const back = params.get("order");
    if (back) { void waitFor(back); return; }

    const wanted = params.get("paket");
    if (wanted) {
      const found = visiblePackages(currency).find((p) => p.id === wanted);
      if (found) setPkg(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyCoupon() {
    if (!pkg || !code.trim()) return;
    setCouponErr(null);
    const j = await post("/api/coupons/validate", { packageId: pkg.id, code });
    if (!j) return;
    if (!j.ok) { setApplied(null); setCouponErr(String(j.reason ?? "unknown")); return; }
    setApplied({ code: j.code, label: j.label, discount: j.discount, total: j.total });
  }

  /* Mengganti cara bayar membuang pesanan yang tadi dibuat dan memulai yang
   * baru. Pesanan membawa cara bayarnya sendiri — itulah yang dilihat admin di
   * /admin/pesanan — jadi menyeret pesanan «transfer bank» ke jalur gateway
   * akan membuat catatannya berbohong. */
  function chooseMethod(m: "manual" | "online") {
    if (m === method) return;
    setMethod(m);
    setOrderId(null); setLocked(null); setManual(null); setErr(null);
  }

  async function payNow() {
    if (!pkg) return;

    if (method === "manual" && manualOk) {
      if (manual) return;                                  // instruksinya sudah tampil
      const j = await post("/api/orders", {
        packageId: pkg.id, coupon: applied?.code ?? "", method: "manual",
      });
      if (!j) return;
      setLocked(Number(j.amount));
      if (j.couponRejected) { setApplied(null); setCouponErr(String(j.couponRejected)); return; }
      setOrderId(j.orderId as string);
      setGateway("manual");
      /* Sengaja TIDAK router.refresh() di sini: halaman ini akan memunculkan
       * spanduk «menunggu konfirmasi» yang isinya instruksi transfer yang
       * sama persis, dan dua salinan instruksi di satu layar membuat pembeli
       * bertanya-tanya mana yang berlaku. Spanduknya muncul saat halaman
       * dibuka lagi — persis ketika ia memang dibutuhkan. */
      setManual({ orderId: j.orderId as string, amount: Number(j.amount) });
      return;
    }

    if (orderId) { await pay(orderId, gateway, pkg.id); return; }

    const j = await post("/api/orders", { packageId: pkg.id, coupon: applied?.code ?? "" });
    if (!j) return;

    setOrderId(j.orderId as string);
    setGateway((j.gateway ?? "simulation") as Gateway);
    setLocked(Number(j.amount));

    /* Kupon bisa kedaluwarsa atau kehabisan kuota di antara layar ini dan
     * pembuatan pesanan. Kalau itu terjadi, pembayaran TIDAK diteruskan
     * diam-diam dengan harga penuh — harga barunya ditampilkan lebih dulu. */
    if (j.couponRejected) {
      setApplied(null);
      setCouponErr(String(j.couponRejected));
      return;
    }
    await pay(j.orderId as string, (j.gateway ?? "simulation") as Gateway, pkg.id);
  }

  function back() {
    setPkg(null); setOrderId(null); setLocked(null); setManual(null);
    setApplied(null); setCode(""); setCouponErr(null); setErr(null);
  }

  /* ------------------------------------------------------------- selesai */

  if (done) {
    return (
      <section className="card flex flex-col items-center gap-3 p-12 text-center rise">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          <PartyPopper size={20} />
        </span>
        <h2 className="text-lg font-semibold">{t("packages.doneTitle")}</h2>
        <p className="max-w-sm text-sm muted">{t("packages.doneBody", { attempts: done?.attempts ?? 0 })}</p>
        <div className="mt-2 flex gap-2">
          <Link href="/dashboard" className="btn btn-primary">{t("packages.toDashboard")}</Link>
          <button className="btn btn-ghost" onClick={() => setDone(null)}>{t("packages.another")}</button>
        </div>
      </section>
    );
  }

  /* --------------------------------------------------------- konfirmasi */

  if (pkg) {
    const price = priceOf(pkg, currency);
    const total = locked ?? applied?.total ?? price;
    const discount = locked != null ? price - locked : (applied?.discount ?? 0);

    return (
      <section className="card p-6 rise">
        {err && <Alert>{err}</Alert>}

        <h2 className="display mb-4 text-xl">{t("packages.summary")}</h2>

        <div className="mb-5 rounded-xl p-4" style={{ background: "var(--bg-sunken)" }}>
          <Line k={t("auth.package")} v={pkg.name} />
          <Line k={t("auth.quota")} v={`${pkg.attempts} ${t("auth.tests")}`} />
          <Line k={t("auth.validity")} v={t("auth.validity12")} />
          <Line k={t("packages.subtotal")} v={money(price, currency, intl)} />
          {discount > 0 && (
            <Line k={t("packages.discount")} v={`− ${money(discount, currency, intl)}`} good />
          )}
          <div className="mt-3 flex justify-between border-t pt-3">
            <span className="font-medium">{t("auth.total")}</span>
            <span className="display text-xl">{money(total, currency, intl)}</span>
          </div>
        </div>

        {/* Kupon hanya bisa diubah selama pesanan belum dibuat. */}
        {locked == null && (
          <div className="mb-5">
            {applied ? (
              <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                <Tag size={15} /> {t("packages.couponOn", { label: applied.label })}
                <button className="ml-auto text-xs underline"
                  onClick={() => { setApplied(null); setCode(""); }}>
                  {t("packages.couponRemove")}
                </button>
              </div>
            ) : (
              <>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                  <Tag size={15} /> {t("packages.coupon")}
                </label>
                <div className="flex gap-2">
                  <input className="input" value={code} placeholder="EXACT10"
                    onChange={(e) => { setCode(e.target.value.toUpperCase()); setCouponErr(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") void applyCoupon(); }} />
                  <button className="btn btn-ghost shrink-0" disabled={busy || !code.trim()} onClick={applyCoupon}>
                    {t("packages.couponApply")}
                  </button>
                </div>
              </>
            )}
            {couponErr && (
              <p className="mt-1.5 text-xs" style={{ color: "var(--danger)" }}>
                {t(COUPON_ERROR_KEY[couponErr as CouponError] ?? "packages.errUnknown")}
              </p>
            )}
          </div>
        )}

        {manualOk && onlineAvailable ? (
          <div className="mb-5">
            <p className="mb-2 text-sm font-medium">{t("packages.methodTitle")}</p>
            <div className="space-y-2">
              <MethodOption
                selected={method === "manual"} onSelect={() => chooseMethod("manual")}
                icon={<Building2 size={15} />}
                title={t("packages.methodManual")} hint={t("packages.methodManualHint")} />
              <MethodOption
                selected={method === "online"} onSelect={() => chooseMethod("online")}
                icon={<CreditCard size={15} />}
                title={t("packages.methodOnline")}
                hint={currency === "IDR" ? t("packages.gwMidtrans") : t("packages.gwStripe")} />
            </div>
          </div>
        ) : (
          <p className="mb-5 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm" style={{ background: "var(--bg-sunken)" }}>
            {manualOk
              ? <><Building2 size={15} className="muted" /> {t("packages.methodManualHint")}</>
              : <><CreditCard size={15} className="muted" />
                  {gateway === "stripe" && t("packages.gwStripe")}
                  {gateway === "midtrans" && t("packages.gwMidtrans")}
                  {gateway === "simulation" && t("packages.gwSim")}
                </>}
          </p>
        )}

        {manual ? (
          <div className="mb-4">
            <ManualTransfer orderId={manual.orderId} amount={manual.amount} currency={currency}
              packageName={pkg.name} buyerName={buyerName} />
          </div>
        ) : !manualOk && !onlineAvailable ? (
          /* Tidak ada rekening dan tidak ada gateway: tidak ada cara membayar
           * sama sekali. Menampilkan tombol bayar yang pasti gagal hanya
           * memindahkan kekecewaannya satu klik lebih jauh. */
          <Alert>{t("packages.notConfigured")}</Alert>
        ) : (
          <button className="btn btn-primary w-full" disabled={busy || waiting} onClick={payNow}>
            {busy || waiting ? <Loader2 size={16} className="animate-spin" /> : null}
            {waiting ? t("auth.waitingPayment")
              : method === "manual" && manualOk ? t("packages.continue")
              : t("auth.pay", { amount: money(total, currency, intl) })}
          </button>
        )}

        <p className="mt-3 flex items-start gap-2 text-xs muted">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" style={{ color: "var(--ok)" }} />
          {t("packages.guarantee")}
        </p>

        <button className="mt-3 w-full text-xs underline muted" disabled={busy || waiting} onClick={back}>
          {t("packages.another")}
        </button>
      </section>
    );
  }

  /* -------------------------------------------------------------- daftar */

  return (
    <section>
      {err && <Alert>{err}</Alert>}
      {waiting && (
        <p className="mb-4 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm" style={{ background: "var(--bg-sunken)" }}>
          <Loader2 size={15} className="animate-spin" /> {t("auth.waitingPayment")}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {shown.map((p) => {
          const price = priceOf(p, currency);
          const strike = strikeOf(p, currency);
          const off = strike ? Math.round((1 - price / strike) * 100) : 0;
          return (
            <article key={p.id} className="card relative flex flex-col p-6"
              style={p.popular ? { borderColor: "var(--accent)", borderWidth: 1.5 } : undefined}>
              {p.popular && (
                <span className="absolute -top-2.5 left-6 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
                  ★
                </span>
              )}
              <div className="mb-1 flex items-center gap-2">
                <span className="chip">{p.exam}</span>
                <span className="text-xs muted">{p.attempts} {t("landing.packages")}</span>
              </div>
              <h3 className="display text-xl">{p.name}</h3>
              <p className="mb-4 text-sm muted">{p.blurb}</p>
              <div className="mb-1 flex items-end gap-2">
                <span className="display text-3xl">{money(price, currency, intl)}</span>
                {strike && <span className="mb-1 text-sm line-through muted">{money(strike, currency, intl)}</span>}
                {off > 0 && (
                  <span className="mb-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: "color-mix(in srgb, var(--ok) 16%, transparent)", color: "var(--ok)" }}>
                    {t("packages.save", { percent: off })}
                  </span>
                )}
              </div>
              <p className="mb-4 text-xs muted">
                {t("packages.perTest", { amount: money(Math.round(price / p.attempts), currency, intl) })}
              </p>
              <ul className="mb-6 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check size={15} className="mt-0.5 shrink-0" style={{ color: "var(--ok)" }} />
                    <span className="muted">{f}</span>
                  </li>
                ))}
              </ul>
              <button className={`btn ${p.popular ? "btn-primary" : "btn-ghost"} w-full`}
                disabled={busy || waiting} onClick={() => setPkg(p)}>
                {t("landing.choosePackage")}
              </button>
            </article>
          );
        })}
      </div>

      <p className="mt-5 flex items-center justify-center gap-2 text-xs muted">
        <ShieldCheck size={14} style={{ color: "var(--ok)" }} /> {t("packages.guarantee")}
      </p>
    </section>
  );
}

function MethodOption({ selected, onSelect, icon, title, hint }: {
  selected: boolean; onSelect: () => void; icon: React.ReactNode; title: string; hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3"
      style={{
        borderColor: selected ? "var(--accent)" : "var(--border)",
        background: selected ? "var(--accent-soft)" : "transparent",
      }}>
      <input type="radio" name="paymethod" className="mt-1 accent-[var(--accent)]"
        checked={selected} onChange={onSelect} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium">{icon} {title}</span>
        <span className="mt-0.5 block text-xs muted">{hint}</span>
      </span>
    </label>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm"
      style={{ background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }}>
      <AlertCircle size={16} className="mt-0.5 shrink-0" /> {children}
    </div>
  );
}

function Line({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div className="mt-1.5 flex justify-between text-sm first:mt-0">
      <span className="muted">{k}</span>
      <span className="font-medium" style={good ? { color: "var(--ok)" } : undefined}>{v}</span>
    </div>
  );
}
