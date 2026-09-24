import { getDb } from "@/lib/db";
import { checkCoupon, couponByCode, type CouponCheck } from "@/lib/coupons";
import type { TryoutPackage } from "@/lib/packages";
import type { Currency } from "@/lib/geo";

/** Memeriksa kupon dengan data yang hanya ada di server: berapa kali kode itu
 *  sudah terpakai, dan apakah pembelinya sudah pernah membayar. Dipakai baik
 *  saat memvalidasi di layar checkout maupun saat pesanan dibuat — keduanya
 *  harus memakai jalur yang sama, kalau tidak yang satu bisa meloloskan apa
 *  yang ditolak yang lain. */
export async function resolveCoupon(input: {
  code: string;
  pkg: TryoutPackage;
  currency: Currency;
  price: number;
  userId?: string | null;
}): Promise<CouponCheck> {
  const coupon = couponByCode(input.code);
  if (!coupon) return { ok: false, reason: "unknown" };

  const db = getDb();
  const usedCount = coupon.maxRedemptions != null ? await db.countCouponUses(coupon.code) : 0;

  let buyerHasPaidBefore = false;
  if (coupon.firstPurchaseOnly && input.userId) {
    buyerHasPaidBefore = (await db.ordersOf(input.userId)).some((o) => o.status === "paid");
  }

  return checkCoupon({
    code: input.code, pkg: input.pkg, currency: input.currency, price: input.price,
    usedCount, buyerHasPaidBefore,
  });
}
