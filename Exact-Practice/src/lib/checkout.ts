import { getDb } from "@/lib/db";
import { packageById, money } from "@/lib/packages";
import { getBlueprint } from "@/lib/exams/blueprints";
import type { ExamCode } from "@/lib/types";
import type { Currency } from "@/lib/geo";
import { mailSubject, receiptEmail, refundEmail, sendMail } from "@/lib/mail";
import { intlTag } from "@/lib/i18n";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";
import { usingDev } from "@/lib/db";
import { devAuth } from "@/lib/db/dev";
import { AFFILIATE, commissionFor } from "@/lib/affiliate";

/* Pemenuhan pesanan.
 *
 * Dipanggil dari EMPAT tempat dan tidak boleh dari mana pun lagi:
 *   1. webhook Midtrans yang signature-nya sudah diverifikasi
 *   2. webhook Stripe yang signature-nya sudah diverifikasi
 *   3. /api/admin/orders/confirm — admin menyatakan transfer bank sudah masuk
 *   4. /api/checkout/pay — simulasi, hanya di mesin pengembang
 *
 * Fungsi ini idempoten: markOrderPaid() mengembalikan pesanan apa adanya
 * kalau statusnya sudah `paid`, jadi notifikasi ganda tidak menggandakan kuota.
 */
export async function fulfillOrder(orderId: string, providerRef?: string) {
  const db = getDb();
  const order = await db.getOrder(orderId);
  if (!order) return { ok: false as const, error: "Pesanan tidak ditemukan" };
  if (order.status === "paid") return { ok: true as const, alreadyPaid: true, order };

  const pkg = packageById(order.packageId);
  if (!pkg) return { ok: false as const, error: "Paket tidak dikenal" };

  const paid = await db.markOrderPaid(order.id, pkg.attempts, providerRef);
  if (!paid) return { ok: false as const, error: "Gagal menandai pesanan lunas" };

  const email = await emailOf(order.userId);
  const name = await nameOf(order.userId);

  if (email) {
    const locale = await localeOf(order.userId);
    await sendMail(
      email,
      mailSubject(locale, "receipt"),
      receiptEmail(
        locale, name, pkg.name,
        money(order.amount, order.currency, intlTag(locale)),
        getBlueprint(order.exam)?.name ?? order.exam,
      ),
    ).catch((e) => console.error("kirim struk gagal:", e));
  }

  // komisi afiliasi + kuota bonus untuk pendaftar rujukan
  await settleReferral(order.userId, order.id, order.amount, order.currency, order.exam, order.packageId);

  /* Tidak ada kode aktivasi yang dikirim di sini.
   *
   * Dulu pembayaran memicu OTP karena akun baru lahir setengah jadi: pendaftar
   * mengisi formulir, membayar, lalu barulah sesinya dibuat lewat kode email.
   * Sekarang sesi sudah ada jauh sebelum pesanan dibuat — orangnya masuk lewat
   * Google terlebih dulu — jadi yang tersisa hanyalah menambah kuota ke akun
   * yang memang sedang dipakai. */
  return { ok: true as const, alreadyPaid: false, order: paid };
}

/* Pembatalan pesanan — sisi lain dari fulfillOrder().
 *
 * Dipanggil dari TIGA tempat: webhook Stripe, webhook Midtrans, dan tombol di
 * panel admin. Ketiganya harus berperilaku sama persis, termasuk dalam hal
 * yang paling mudah terlupa — mengabari pembelinya. Sebelum fungsi ini ada,
 * ketiga pemanggil menuliskan langkahnya sendiri-sendiri dan tak satu pun
 * mengirim surat: pembeli mendapati kuotanya lenyap tanpa keterangan apa pun.
 *
 * Idempoten lewat db.refundOrder(): pesanan yang sudah `refunded` tidak
 * mencabut apa pun lagi, dan karena itu tidak mengirim surat kedua. */
export async function settleRefund(orderId: string, source: "stripe" | "midtrans" | "admin") {
  const db = getDb();
  const before = await db.getOrder(orderId);
  if (!before) return null;
  const alreadyRefunded = before.status === "refunded";

  const res = await db.refundOrder(orderId);
  if (!res) return null;

  if (!alreadyRefunded) {
    const email = await emailOf(res.order.userId);
    const pkg = packageById(res.order.packageId);
    if (email) {
      const locale = await localeOf(res.order.userId);
      await sendMail(
        email,
        mailSubject(locale, "refund"),
        refundEmail(
          locale,
          await nameOf(res.order.userId),
          pkg?.name ?? res.order.packageId,
          money(res.order.amount, res.order.currency, intlTag(locale)),
          getBlueprint(res.order.exam)?.name ?? res.order.exam,
          res.attemptsRevoked,
        ),
      ).catch((e) => console.error("kirim surat refund gagal:", e));
    }
    console.info(
      `refund (${source}): pesanan ${orderId} — ${res.attemptsRevoked} kuota dicabut, ` +
      `${res.commissionsVoided} komisi dibatalkan`,
    );
  }

  return { ...res, alreadyRefunded };
}

/* Dijalankan hanya dari fulfillOrder(), artinya hanya setelah pembayaran
 * terverifikasi. Semua langkahnya idempoten:
 *   - createCommission() mengembalikan null kalau order_id sudah punya komisi
 *   - kuota bonus hanya diberikan untuk pesanan PERTAMA pendaftar itu */
async function settleReferral(
  buyerId: string, orderId: string, amount: number, currency: Currency,
  exam: ExamCode, packageId: string,
) {
  try {
    const db = getDb();
    const referral = await db.referralOfUser(buyerId);
    if (!referral) return;

    const affiliate = await db.affiliateByCode(referral.code);
    if (!affiliate || affiliate.status !== "active") return;
    if (affiliate.userId === buyerId) return;              // tidak boleh merujuk diri sendiri

    const isFirstOrder = !referral.firstOrderId;

    const commission = await db.createCommission({
      affiliateUserId: affiliate.userId,
      referredUserId: buyerId,
      orderId,
      amount: commissionFor(amount, affiliate.rate),
      currency,
      rate: affiliate.rate,
    });

    if (commission && isFirstOrder && AFFILIATE.refereeBonusAttempts > 0) {
      for (let i = 0; i < AFFILIATE.refereeBonusAttempts; i++) {
        await db.grantBonusAttempt(buyerId, exam, packageId);
      }
    }
  } catch (e) {
    // afiliasi tidak boleh menggagalkan pemenuhan pesanan
    console.error("settleReferral:", e instanceof Error ? e.message : e);
  }
}

async function emailOf(userId: string) {
  if (usingDev()) return (await devAuth.userById(userId))?.email ?? null;
  const { createAdminClient } = await import("@/lib/supabase/server");
  const { data } = await createAdminClient().from("profiles").select("email").eq("id", userId).maybeSingle();
  return data?.email ?? null;
}

/** Bahasa yang dipilih pembeli. Jatuh ke bawaan bila belum pernah memilih —
 *  bukan ke bahasa Indonesia, karena pengunjung pertama kali melihat aplikasi
 *  ini dalam bahasa Inggris. */
async function localeOf(userId: string) {
  if (usingDev()) {
    const u = await devAuth.userById(userId);
    return isLocale(u?.locale) ? u.locale : DEFAULT_LOCALE;
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const { data } = await createAdminClient()
    .from("profiles").select("locale").eq("id", userId).maybeSingle();
  return isLocale(data?.locale) ? data.locale : DEFAULT_LOCALE;
}

async function nameOf(userId: string) {
  if (usingDev()) return (await devAuth.userById(userId))?.fullName ?? "";
  const { createAdminClient } = await import("@/lib/supabase/server");
  const { data } = await createAdminClient().from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return data?.full_name ?? "";
}
