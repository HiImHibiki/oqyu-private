import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { packageById, priceOf, visiblePackages } from "@/lib/packages";
import { currencyForCountry, gatewayFor } from "@/lib/geo";
import { midtransEnabled } from "@/lib/midtrans";
import { stripeEnabled } from "@/lib/stripe";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { normalizeCouponCode } from "@/lib/coupons";
import { manualPaymentEnabled, orderRef } from "@/lib/payment";
import { resolveCoupon } from "@/lib/coupons.server";

/* Pembelian paket tambahan oleh peserta yang SUDAH punya akun.
 *
 * Bedanya dengan /api/auth/register yang juga membuat pesanan: di sini tidak
 * ada pendaftaran, tidak ada data diri yang diisi ulang, dan pemiliknya
 * diambil dari sesi — bukan dari email yang dikirim peramban. Selebihnya
 * pesanan ini identik, jadi /api/checkout/create dan webhook yang sudah ada
 * menanganinya tanpa perubahan: markOrderPaid() menambah SATU baris
 * entitlement baru, sehingga kuotanya menumpuk di atas yang lama.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Silakan masuk dulu." }, { status: 401 });

  /* Pesanan pending tidak memberi apa pun sampai dibayar, tetapi tetap dibatasi
   * supaya satu akun tidak bisa membanjiri tabel orders. */
  const l = rateLimit(`order:${user.id}:${clientIp(req)}`, 8, 600);
  if (!l.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak pesanan dibuat. Coba lagi sebentar." },
      { status: 429, headers: { "retry-after": String(l.retryAfterSec) } },
    );
  }

  const { packageId, coupon, method } = await req.json().catch(() => ({ packageId: "" }));
  const pkg = packageById(String(packageId ?? ""));
  if (!pkg) return NextResponse.json({ error: "Paket tidak dikenal" }, { status: 400 });

  /* Mata uang mengikuti negara di profil, sama seperti saat mendaftar — harga
   * tidak boleh ditentukan oleh peramban. */
  const currency = currencyForCountry(user.country);
  if (!visiblePackages(currency).some((p) => p.id === pkg.id)) {
    return NextResponse.json({ error: "Paket ini tidak tersedia untuk negaramu" }, { status: 400 });
  }

  const price = priceOf(pkg, currency);

  /* Kupon dihitung ulang di sini, dari kodenya, memakai harga di server.
   * Apa pun yang ditampilkan layar checkout tidak ikut menentukan tagihan. */
  const code = normalizeCouponCode(String(coupon ?? ""));
  const applied = code
    ? await resolveCoupon({ code, pkg, currency, price, userId: user.id })
    : null;
  const amount = applied?.ok ? applied.total : price;
  const discount = applied?.ok ? applied.discount : 0;

  const gateway = gatewayFor(currency);
  const live = gateway === "midtrans" ? midtransEnabled() : stripeEnabled();

  /* Cara bayar ditentukan pembeli, tetapi ketersediaannya ditentukan server:
   * «manual» hanya berarti sesuatu bila rekeningnya memang sudah diisi, dan
   * jalur gateway hanya ada bila kuncinya terpasang. Kalau dua-duanya kosong,
   * yang tersisa adalah simulasi — yang route pembayarannya sendiri menolak
   * berjalan di produksi. */
  const wantsManual = String(method ?? "") === "manual";
  const provider = wantsManual && manualPaymentEnabled() ? "manual"
    : live ? gateway
    : manualPaymentEnabled() ? "manual"
    : "simulation";

  const order = await getDb().createOrder({
    userId: user.id,
    packageId: pkg.id,
    exam: pkg.exam,
    amount,
    currency,
    provider,
    couponCode: applied?.ok ? applied.coupon.code : null,
    discount,
  });

  return NextResponse.json({
    orderId: order.id,
    amount,
    discount,
    /* Kupon yang ditolak tidak menggagalkan pesanan — pembeli tetap boleh
     * membayar harga penuh — tetapi alasannya dikembalikan supaya layarnya
     * bisa berhenti menampilkan potongan yang tidak jadi diberikan. */
    coupon: applied?.ok ? applied.coupon.code : null,
    couponRejected: applied && !applied.ok ? applied.reason : null,
    currency,
    gateway: provider,
    /* Kode yang ditulis pembeli di berita transfer. Dikirim dari server supaya
     * yang ditampilkan layar dan yang dicari admin selalu satu rumus. */
    ref: orderRef(order.id),
  });
}
