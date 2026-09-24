import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { packageById, priceOf, visiblePackages } from "@/lib/packages";
import { currencyForCountry } from "@/lib/geo";
import { resolveCoupon } from "@/lib/coupons.server";
import { normalizeCouponCode } from "@/lib/coupons";
import { clientIp, rateLimit } from "@/lib/ratelimit";

/** Memeriksa kupon sebelum pesanan dibuat, supaya pembeli melihat harga
 *  akhirnya sebelum menekan tombol bayar. Hasil di sini TIDAK dipercaya saat
 *  pesanan dibuat — nominalnya dihitung ulang di sana dari kode yang sama. */
export async function POST(req: Request) {
  /* Kupon adalah rahasia bernilai uang: tanpa pembatas, kode enam huruf bisa
   * disisir dari satu peramban dalam hitungan menit. */
  const l = rateLimit(`coupon:${clientIp(req)}`, 20, 600);
  if (!l.ok) {
    return NextResponse.json(
      { ok: false, reason: "throttled" },
      { status: 429, headers: { "retry-after": String(l.retryAfterSec) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const pkg = packageById(String(body.packageId ?? ""));
  if (!pkg) return NextResponse.json({ error: "Paket tidak dikenal" }, { status: 400 });

  const user = await currentUser();
  const currency = currencyForCountry(user?.country ?? String(body.country ?? ""));
  if (!visiblePackages(currency).some((p) => p.id === pkg.id)) {
    return NextResponse.json({ ok: false, reason: "notApplicable" });
  }

  const price = priceOf(pkg, currency);
  const res = await resolveCoupon({
    code: normalizeCouponCode(String(body.code ?? "")),
    pkg, currency, price, userId: user?.id,
  });

  if (!res.ok) return NextResponse.json({ ok: false, reason: res.reason });
  return NextResponse.json({
    ok: true,
    code: res.coupon.code,
    label: res.coupon.label,
    discount: res.discount,
    total: res.total,
    currency,
  });
}
