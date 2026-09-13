import { NextResponse } from "next/server";
import { getDb, usingDev } from "@/lib/db";
import { devAuth } from "@/lib/db/dev";
import { packageById } from "@/lib/packages";
import { gatewayFor } from "@/lib/geo";
import { createSnapTransaction, midtransEnabled } from "@/lib/midtrans";
import { createCheckoutSession, stripeEnabled } from "@/lib/stripe";
import { clientIp, rateLimit } from "@/lib/ratelimit";

/** Membuat sesi pembayaran pada gateway yang sesuai mata uang pesanan:
 *  rupiah lewat Midtrans, sisanya lewat Stripe. */
export async function POST(req: Request) {
  /* Endpoint ini sengaja tanpa sesi: saat membayar, pendaftar belum login —
   * akunnya baru dibuat dan sesinya menyusul lewat OTP. Jadi `orderId` yang
   * berupa UUID itulah yang berperan sebagai tokennya.
   *
   * Konsekuensinya harus ditanggung: siapa pun yang memegang orderId bisa
   * membuat sesi pembayaran, dan halaman Stripe menampilkan email pemilik
   * pesanan. UUID tidak bisa ditebak, tetapi ia ikut muncul di URL
   * /daftar?order=… — jadi bisa bocor lewat riwayat peramban, header referrer,
   * atau log. Pembatas laju menahan penyalahgunaan orderId yang sudah bocor
   * dan mencegah pembuatan sesi gateway tanpa batas. */
  const l = rateLimit(`checkout:${clientIp(req)}`, 10, 600);
  if (!l.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan pembayaran. Coba lagi sebentar." },
      { status: 429, headers: { "retry-after": String(l.retryAfterSec) } },
    );
  }

  const { orderId } = await req.json();
  const order = await getDb().getOrder(String(orderId ?? ""));
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status === "paid") return NextResponse.json({ error: "Order already paid" }, { status: 409 });

  const gateway = gatewayFor(order.currency);
  const live = gateway === "midtrans" ? midtransEnabled() : stripeEnabled();
  if (!live) return NextResponse.json({ gateway: "simulation" });

  const pkg = packageById(order.packageId);
  const profile = await profileOf(order.userId);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  /* Ke mana gateway memulangkan pembeli. Sebuah konstanta, bukan parameter
   * dari peramban: URL kembali yang bebas diisi adalah pengalihan terbuka.
   * Semua pembelian — pertama maupun tambahan — terjadi di /paket sejak
   * pendaftaran tidak lagi merangkap checkout. */
  const returnTo = `${site}/paket`;

  try {
    if (gateway === "midtrans") {
      const snap = await createSnapTransaction({
        orderId: order.id,
        amount: order.amount,
        itemName: pkg?.name ?? order.packageId,
        customer: {
          firstName: (profile?.fullName ?? "Candidate").split(" ")[0],
          email: profile?.email ?? "",
          phone: profile?.phone ?? "",
        },
        finishUrl: `${returnTo}?order=${order.id}`,
      });
      return NextResponse.json({ gateway: "midtrans", ...snap });
    }

    const session = await createCheckoutSession({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      itemName: `${pkg?.name ?? order.packageId} — Exact Try Out`,
      customerEmail: profile?.email ?? "",
      successUrl: `${returnTo}?order=${order.id}&paid=1`,
      cancelUrl: `${returnTo}?order=${order.id}`,
    });
    return NextResponse.json({ gateway: "stripe", url: session.url, id: session.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start the payment" },
      { status: 502 },
    );
  }
}

async function profileOf(userId: string) {
  if (usingDev()) {
    const u = await devAuth.userById(userId);
    return u ? { fullName: u.fullName, email: u.email, phone: u.phone } : null;
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const { data } = await createAdminClient()
    .from("profiles").select("full_name,email,phone").eq("id", userId).maybeSingle();
  return data ? { fullName: data.full_name, email: data.email, phone: data.phone } : null;
}
