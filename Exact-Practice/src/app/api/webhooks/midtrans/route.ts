import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fulfillOrder, settleRefund } from "@/lib/checkout";
import {
  failureStatus, isFailure, isPartialRefund, isRefund, isSettled, verifySignature,
  type MidtransNotification,
} from "@/lib/midtrans";

/* Webhook Midtrans.
 *
 * Ini SATU-SATUNYA jalur pemberian kuota di produksi.
 * Urutan pemeriksaannya penting:
 *   1. verifikasi signature  -> menolak notifikasi palsu
 *   2. cocokkan nominal      -> menolak notifikasi dengan gross_amount yang diubah
 *   3. baru penuhi pesanan   -> fulfillOrder() sendiri idempoten
 *
 * Daftarkan URL ini di dashboard Midtrans:
 *   https://domainmu.com/api/webhooks/midtrans
 */
export async function POST(req: Request) {
  let body: MidtransNotification;
  try {
    body = (await req.json()) as MidtransNotification;
  } catch {
    return NextResponse.json({ error: "Body bukan JSON" }, { status: 400 });
  }

  if (!verifySignature(body)) {
    console.warn("Webhook Midtrans dengan signature tidak valid:", body.order_id);
    return NextResponse.json({ error: "Signature tidak valid" }, { status: 403 });
  }

  const db = getDb();
  const order = await db.getOrder(body.order_id);
  if (!order) return NextResponse.json({ error: "Pesanan tidak dikenal" }, { status: 404 });

  if (isSettled(body)) {
    /* Nominal diperiksa HANYA pada jalur yang memberi kuota. Notifikasi
     * refund dan kegagalan tidak memberi apa pun, dan menolaknya karena
     * selisih nominal hanya akan membuat Midtrans mengulang kiriman yang
     * tidak akan pernah diterima. Keasliannya sudah dijamin signature.
     *
     * gross_amount datang sebagai "349000.00". */
    if (Math.round(Number(body.gross_amount)) !== order.amount) {
      console.warn("Nominal webhook tidak cocok:", body.order_id, body.gross_amount, order.amount);
      return NextResponse.json({ error: "Nominal tidak cocok" }, { status: 409 });
    }
    const res = await fulfillOrder(order.id, body.transaction_id ?? body.order_id);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
    return NextResponse.json({ ok: true, alreadyPaid: res.alreadyPaid });
  }

  /* Pengembalian dana penuh dari dasbor Midtrans. Tanpa cabang ini, uang
   * kembali ke pembeli sementara kuotanya tetap utuh dan komisi afiliasinya
   * tetap tertagih. */
  if (isRefund(body)) {
    const res = await settleRefund(order.id, "midtrans");
    if (!res) return NextResponse.json({ error: "Gagal memproses pengembalian" }, { status: 500 });
    return NextResponse.json({
      ok: true, attemptsRevoked: res.attemptsRevoked, commissionsVoided: res.commissionsVoided,
    });
  }

  if (isPartialRefund(body)) {
    console.info("Refund sebagian, kuota tidak dicabut:", order.id);
    return NextResponse.json({ ok: true, partial: true });
  }

  /* Pesanan yang gagal atau kedaluwarsa DITUTUP, tidak dibiarkan `pending`.
   * Pesanan pending yang menggantung selamanya akan terus muncul sebagai
   * «pembayaran belum selesai» di dashboard peserta — menagih orang untuk
   * virtual account yang sudah mati. */
  if (isFailure(body)) {
    const status = failureStatus(body);
    await db.setOrderStatus(order.id, status);
    console.info("Pembayaran gagal/kedaluwarsa:", body.order_id, body.transaction_status);
    return NextResponse.json({ ok: true, closed: status });
  }

  // pending / challenge: terima notifikasinya, jangan beri kuota
  return NextResponse.json({ ok: true, ignored: body.transaction_status });
}
