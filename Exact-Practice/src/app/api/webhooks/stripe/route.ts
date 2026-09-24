import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fulfillOrder, settleRefund } from "@/lib/checkout";
import { verifyStripeSignature, type StripeEvent } from "@/lib/stripe";

/* Webhook Stripe — satu-satunya pemberi kuota untuk pembayaran non-rupiah.
 *
 * Urutan pemeriksaannya sama dengan webhook Midtrans:
 *   1. verifikasi signature   -> menolak notifikasi palsu
 *   2. cocokkan nominal       -> menolak nominal yang diubah
 *   3. baru penuhi pesanan    -> fulfillOrder() idempoten
 *
 * Daftarkan di dashboard Stripe: https://domainmu.com/api/webhooks/stripe
 * dengan event `checkout.session.completed`, `charge.refunded`, dan
 * `checkout.session.expired`.
 */
export async function POST(req: Request) {
  // Body mentah wajib dibaca sebagai teks: signature dihitung atas byte aslinya,
  // sehingga JSON.parse lebih dulu akan merusak verifikasi.
  const raw = await req.text();

  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"))) {
    console.warn("Webhook Stripe dengan signature tidak valid");
    return NextResponse.json({ error: "Signature tidak valid" }, { status: 403 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Body bukan JSON" }, { status: 400 });
  }

  /* Refund yang dilakukan dari dasbor Stripe sampai ke sini sebagai
   * `charge.refunded`. Tanpa menanganinya, uang kembali ke pembeli sementara
   * kuotanya tetap utuh dan komisi afiliasinya tetap tertagih. */
  if (event.type === "charge.refunded") return handleRefund(event);

  /* Sesi Stripe kedaluwarsa setelah 24 jam. Tanpa cabang ini, pesanan yang
   * ditinggalkan di halaman pembayaran tetap `pending` selamanya dan terus
   * muncul sebagai «pembayaran belum selesai» di dashboard peserta. */
  if (event.type === "checkout.session.expired") return handleExpired(event);

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const session = event.data.object as {
    client_reference_id?: string;
    payment_status?: string;
    amount_total?: number;
    currency?: string;
    metadata?: { order_id?: string; amount?: string; currency?: string };
    id?: string;
  };

  if (session.payment_status !== "paid") {
    return NextResponse.json({ ok: true, ignored: session.payment_status });
  }

  const orderId = session.client_reference_id ?? session.metadata?.order_id;
  if (!orderId) return NextResponse.json({ error: "Pesanan tidak teridentifikasi" }, { status: 400 });

  const order = await getDb().getOrder(orderId);
  if (!order) return NextResponse.json({ error: "Pesanan tidak dikenal" }, { status: 404 });

  // amount_total dalam satuan terkecil; IDR tanpa desimal, sisanya sen.
  const zeroDecimal = order.currency === "IDR";
  const expected = zeroDecimal ? Math.round(order.amount) : Math.round(order.amount * 100);
  if (typeof session.amount_total === "number" && session.amount_total !== expected) {
    console.warn("Nominal webhook Stripe tidak cocok:", orderId, session.amount_total, expected);
    return NextResponse.json({ error: "Nominal tidak cocok" }, { status: 409 });
  }
  if (session.currency && session.currency.toUpperCase() !== order.currency) {
    return NextResponse.json({ error: "Mata uang tidak cocok" }, { status: 409 });
  }

  const res = await fulfillOrder(order.id, session.id ?? orderId);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });

  return NextResponse.json({ ok: true, alreadyPaid: res.alreadyPaid });
}

/* -------------------------------------------------------------- refund */

async function handleRefund(event: StripeEvent) {
  const charge = event.data.object as {
    metadata?: { order_id?: string };
    amount?: number;
    amount_refunded?: number;
    id?: string;
  };

  const orderId = charge.metadata?.order_id;
  if (!orderId) {
    /* Pesanan lama dibuat sebelum metadata diturunkan ke PaymentIntent, jadi
     * charge-nya tidak membawa order_id. Dicatat, bukan digagalkan: Stripe
     * akan mengulang kiriman yang dijawab error, dan pengulangan itu tidak
     * akan pernah berhasil. Kasus semacam ini diselesaikan lewat tombol
     * pengembalian dana di /admin/pesanan. */
    console.warn("charge.refunded tanpa order_id:", charge.id);
    return NextResponse.json({ ok: true, ignored: "no_order_id" });
  }

  /* Refund sebagian tidak mencabut kuota. Menentukan berapa banyak try out
   * yang setara dengan sebagian uang adalah keputusan yang harus diambil
   * manusia, bukan aturan yang dikarang di sini. */
  if (typeof charge.amount === "number" && typeof charge.amount_refunded === "number"
      && charge.amount_refunded < charge.amount) {
    console.info("Refund sebagian, kuota tidak dicabut:", orderId);
    return NextResponse.json({ ok: true, partial: true });
  }

  const res = await settleRefund(orderId, "stripe");
  if (!res) return NextResponse.json({ error: "Pesanan tidak dikenal" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    attemptsRevoked: res.attemptsRevoked,
    commissionsVoided: res.commissionsVoided,
  });
}

/* ------------------------------------------------------------- kedaluwarsa */

async function handleExpired(event: StripeEvent) {
  const session = event.data.object as { client_reference_id?: string; metadata?: { order_id?: string } };
  const orderId = session.client_reference_id ?? session.metadata?.order_id;
  if (!orderId) return NextResponse.json({ ok: true, ignored: "no_order_id" });

  /* setOrderStatus hanya bekerja dari `pending`, sehingga sesi yang
   * kedaluwarsa SETELAH pembayaran berhasil lewat jalur lain tidak dapat
   * menurunkan pesanan yang sudah lunas. */
  const order = await getDb().setOrderStatus(orderId, "expired");
  if (!order) return NextResponse.json({ error: "Pesanan tidak dikenal" }, { status: 404 });
  return NextResponse.json({ ok: true, status: order.status });
}
