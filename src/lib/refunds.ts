import type { EntitlementRecord, OrderRecord } from "@/lib/db";

/* =========================================================================
 * Kelayakan pengembalian dana.
 *
 * Aturannya diambil apa adanya dari Ketentuan Layanan, bukan dikarang di
 * sini: «penuh dalam 14 hari sejak pembelian, sepanjang kamu belum memulai
 * lebih dari satu try out penuh». Kalau kelak ketentuannya berubah, satu-
 * satunya tempat yang perlu disunting adalah berkas ini — dan `legal.ts`.
 *
 * Fungsi ini TIDAK memutuskan apa pun; ia hanya menjawab «apakah memenuhi
 * syarat». Admin tetap boleh mengembalikan dana di luar syarat, misalnya
 * karena kesalahan sistem, dan itu dicatat sebagai keputusan yang diambil
 * sadar (`force`), bukan sebagai syarat yang diam-diam dilonggarkan.
 * ========================================================================= */

export const REFUND_WINDOW_DAYS = 14;
/** Satu try out yang sudah dimulai masih boleh direfund; dua tidak. */
export const REFUND_MAX_ATTEMPTS_USED = 1;

export type RefundBlock = "notPaid" | "windowClosed" | "tooManyAttempts";

export interface RefundCheck {
  eligible: boolean;
  reason?: RefundBlock;
  /** Sisa hari dalam masa pengembalian; negatif berarti sudah lewat. */
  daysLeft: number;
  attemptsUsed: number;
}

export function checkRefund(
  order: Pick<OrderRecord, "status" | "paidAt" | "createdAt">,
  entitlement: Pick<EntitlementRecord, "attemptsUsed"> | null | undefined,
  now = Date.now(),
): RefundCheck {
  const attemptsUsed = entitlement?.attemptsUsed ?? 0;

  /* Tanggal acuan adalah saat pembayaran diterima, bukan saat pesanan dibuat:
   * pesanan bisa menggantung berhari-hari sebelum dibayar, dan masa
   * pengembalian yang mulai berjalan sebelum uang masuk merugikan pembeli. */
  const paidAt = new Date(order.paidAt ?? order.createdAt).getTime();
  const daysLeft = REFUND_WINDOW_DAYS - Math.floor((now - paidAt) / 864e5);

  if (order.status !== "paid") return { eligible: false, reason: "notPaid", daysLeft, attemptsUsed };
  if (daysLeft < 0) return { eligible: false, reason: "windowClosed", daysLeft, attemptsUsed };
  if (attemptsUsed > REFUND_MAX_ATTEMPTS_USED) {
    return { eligible: false, reason: "tooManyAttempts", daysLeft, attemptsUsed };
  }
  return { eligible: true, daysLeft, attemptsUsed };
}

export const refundBlockText: Record<RefundBlock, string> = {
  notPaid: "Pesanan ini belum lunas, jadi tidak ada yang dikembalikan.",
  windowClosed: `Sudah lewat ${REFUND_WINDOW_DAYS} hari sejak pembayaran.`,
  tooManyAttempts: `Peserta sudah memulai lebih dari ${REFUND_MAX_ATTEMPTS_USED} try out.`,
};
