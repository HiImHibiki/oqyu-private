import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { settleRefund } from "@/lib/checkout";
import { checkRefund, refundBlockText } from "@/lib/refunds";

/* Mengembalikan dana satu pesanan.
 *
 * Yang dilakukan di SINI hanyalah pembukuan: status pesanan, sisa kuota, dan
 * komisi afiliasi. Uangnya sendiri dikembalikan lewat dasbor Midtrans atau
 * Stripe — aplikasi ini tidak memegang kredensial refund, dan sebaiknya
 * memang tidak. Urutan yang dianjurkan: refund di gateway lebih dulu, lalu
 * tekan tombol ini. Untuk Stripe, webhook `charge.refunded` sudah melakukannya
 * sendiri, sehingga tombol ini menjadi cadangan.
 *
 * Hanya `admin` yang boleh, bukan `reviewer`: peninjau soal tidak punya urusan
 * dengan uang. */
export async function POST(req: Request) {
  const me = await adminOrNull();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }

  const { orderId, force } = await req.json().catch(() => ({}));
  const db = getDb();
  const order = await db.getOrder(String(orderId ?? ""));
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  if (order.status === "refunded") {
    return NextResponse.json({ ok: true, alreadyRefunded: true });
  }

  const ents = await db.entitlements(order.userId);
  const mine = ents.find((e) =>
    e.orderId ? e.orderId === order.id
      : e.packageId === order.packageId && e.exam === order.exam,
  );

  /* Syarat dari Ketentuan Layanan diperiksa di sini, dan hanya bisa dilewati
   * dengan `force` yang dikirim sadar oleh admin — bukan diam-diam. */
  const check = checkRefund(order, mine);
  if (!check.eligible && !force) {
    return NextResponse.json(
      { error: refundBlockText[check.reason!], check, needsForce: check.reason !== "notPaid" },
      { status: 409 },
    );
  }

  const res = await settleRefund(order.id, "admin");
  if (!res) return NextResponse.json({ error: "Gagal memproses pengembalian" }, { status: 500 });

  /* Siapa yang menekan tombolnya dicatat terpisah: settleRefund() mencatat
   * APA yang terjadi, baris ini mencatat SIAPA dan atas dasar apa. */
  console.info(
    `refund: pesanan ${order.id} oleh ${me.email}` +
    `${force && !check.eligible ? ` (di luar syarat: ${check.reason})` : ""}`,
  );

  return NextResponse.json({
    ok: true,
    attemptsRevoked: res.attemptsRevoked,
    commissionsVoided: res.commissionsVoided,
    forced: Boolean(force) && !check.eligible,
  });
}
