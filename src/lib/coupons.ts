import type { Currency } from "@/lib/geo";
import type { ExamCode } from "@/lib/types";
import type { TryoutPackage } from "@/lib/packages";
import type { MessageKey } from "@/lib/i18n/dictionaries";

/* =========================================================================
 * Kupon.
 *
 * Daftarnya ada di berkas ini, bukan di basis data — kampanye harga adalah
 * keputusan yang pantas ikut ter-review bersama kode, dan jumlahnya sedikit.
 * Yang tersimpan di basis data hanyalah jejaknya pada pesanan (lihat migrasi
 * 0015), supaya batas pemakaian bisa dihitung dari pesanan yang LUNAS.
 *
 * Aturan yang tidak boleh dilanggar: potongan dihitung di server, dari harga
 * paket di server. Peramban hanya mengirim kodenya. Kalau peramban boleh
 * mengirim nominalnya, harga menjadi milik pembeli.
 * ========================================================================= */

export interface Coupon {
  code: string;                                  // selalu huruf besar
  /** Ditampilkan ke pembeli setelah kodenya diterima. */
  label: string;
  percentOff?: number;                           // 1–70
  /** Potongan tetap per mata uang. Mata uang yang tidak terdaftar = tidak berlaku. */
  amountOff?: Partial<Record<Currency, number>>;
  startsAt?: string;                             // ISO
  endsAt?: string;                               // ISO, inklusif sampai detik itu
  /** Kalau diisi, hanya berlaku untuk paket/ujian ini. */
  packages?: string[];
  exams?: ExamCode[];
  /** Batas jumlah pesanan LUNAS yang boleh memakai kode ini. */
  maxRedemptions?: number;
  /** Hanya untuk pembeli yang belum pernah punya pesanan lunas. */
  firstPurchaseOnly?: boolean;
}

/* Silakan ubah, tambah, atau kosongkan daftar ini — inilah kampanye yang
 * sedang berjalan. Setiap kupon sebaiknya punya `endsAt`: diskon tanpa
 * tanggal berakhir berhenti menjadi kampanye dan menjadi harga baru. */
export const COUPONS: Coupon[] = [
  {
    code: "EXACT10",
    label: "Diskon 10%",
    percentOff: 10,
    endsAt: "2026-12-31T23:59:59Z",
  },
  {
    code: "SNBT25",
    label: "Diskon 25% paket UTBK-SNBT",
    percentOff: 25,
    exams: ["UTBK"],
    endsAt: "2026-12-31T23:59:59Z",
  },
  {
    code: "COBADULU",
    label: "Diskon 15% pembelian pertama",
    percentOff: 15,
    firstPurchaseOnly: true,
    endsAt: "2026-12-31T23:59:59Z",
  },
];

export const normalizeCouponCode = (raw: string) =>
  (raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);

export const couponByCode = (raw: string) => {
  const code = normalizeCouponCode(raw);
  return code ? COUPONS.find((c) => c.code === code) : undefined;
};

export type CouponError =
  | "unknown"          // kode tidak ada
  | "expired"          // sudah lewat, atau belum mulai
  | "notApplicable"    // paket/ujian/mata uang di luar cakupan
  | "exhausted"        // kuota kampanye habis
  | "firstOnly";       // hanya untuk pembelian pertama

/** Satu tempat untuk memetakan penolakan menjadi kalimat, supaya layar
 *  pendaftaran dan layar paket tidak pernah menjelaskan hal yang sama dengan
 *  dua kalimat berbeda. `throttled` datang dari pembatas laju, bukan dari
 *  pemeriksaan kupon, tetapi pembeli melihatnya di tempat yang sama. */
export const COUPON_ERROR_KEY: Record<CouponError | "throttled", MessageKey> = {
  unknown: "packages.errUnknown",
  expired: "packages.errExpired",
  notApplicable: "packages.errNotApplicable",
  exhausted: "packages.errExhausted",
  firstOnly: "packages.errFirstOnly",
  throttled: "packages.errThrottled",
};

export type CouponCheck =
  | { ok: true; coupon: Coupon; discount: number; total: number }
  | { ok: false; reason: CouponError };

/* Harga di aplikasi ini selalu bilangan bulat dalam mata uangnya masing-masing
 * (Rp249.000, US$19), dan kolom `amount` pun bilangan bulat. Pembulatan karena
 * itu wajib, dan arahnya ke bawah — selisih pembulatan menjadi milik pembeli,
 * bukan milik kita. */
const roundDown = (n: number, currency: Currency) =>
  currency === "IDR" ? Math.floor(n / 1000) * 1000 : Math.floor(n);

/** Batas bawah yang masih masuk akal ditagih gateway. Potongan yang menembus
 *  batas ini dipotong, bukan ditolak: pembeli tidak perlu tahu soal batas
 *  minimum transaksi Midtrans. */
const MIN_TOTAL: Record<Currency, number> = { IDR: 10_000, USD: 3, EUR: 3, CNY: 20 };

export function checkCoupon(input: {
  code: string;
  pkg: TryoutPackage;
  currency: Currency;
  price: number;
  /** Jumlah pesanan lunas yang sudah memakai kode ini. */
  usedCount?: number;
  /** Pembeli sudah pernah menyelesaikan satu pesanan? */
  buyerHasPaidBefore?: boolean;
  now?: Date;
}): CouponCheck {
  const { pkg, currency, price } = input;
  const coupon = couponByCode(input.code);
  if (!coupon) return { ok: false, reason: "unknown" };

  const now = (input.now ?? new Date()).getTime();
  if (coupon.startsAt && now < new Date(coupon.startsAt).getTime()) return { ok: false, reason: "expired" };
  if (coupon.endsAt && now > new Date(coupon.endsAt).getTime()) return { ok: false, reason: "expired" };

  if (coupon.packages && !coupon.packages.includes(pkg.id)) return { ok: false, reason: "notApplicable" };
  if (coupon.exams && !coupon.exams.includes(pkg.exam)) return { ok: false, reason: "notApplicable" };

  if (coupon.maxRedemptions != null && (input.usedCount ?? 0) >= coupon.maxRedemptions) {
    return { ok: false, reason: "exhausted" };
  }
  if (coupon.firstPurchaseOnly && input.buyerHasPaidBefore) return { ok: false, reason: "firstOnly" };

  let raw = 0;
  if (coupon.percentOff) raw = (price * Math.min(coupon.percentOff, 70)) / 100;
  else if (coupon.amountOff) {
    const off = coupon.amountOff[currency];
    if (off == null) return { ok: false, reason: "notApplicable" };   // tidak dikonversi antar mata uang
    raw = off;
  }
  if (raw <= 0) return { ok: false, reason: "notApplicable" };

  const floor = Math.min(MIN_TOTAL[currency], price);
  const total = Math.max(floor, roundDown(price - raw, currency));
  const discount = price - total;
  if (discount <= 0) return { ok: false, reason: "notApplicable" };

  return { ok: true, coupon, discount, total };
}
