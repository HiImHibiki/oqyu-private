import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";

/** Dipakai halaman pendaftaran dan halaman paket untuk menunggu webhook tiba. */
export async function GET(req: Request) {
  /* Dipanggil berulang selagi menunggu webhook, jadi batasnya longgar —
   * cukup untuk menghentikan penyisiran orderId, tidak sampai mengganggu
   * penantian yang wajar. */
  const l = rateLimit(`checkout-status:${clientIp(req)}`, 120, 600);
  if (!l.ok) {
    return NextResponse.json(
      { error: "Terlalu sering memeriksa status." },
      { status: 429, headers: { "retry-after": String(l.retryAfterSec) } },
    );
  }

  const orderId = new URL(req.url).searchParams.get("orderId");
  if (!orderId) return NextResponse.json({ error: "orderId wajib" }, { status: 400 });

  const order = await getDb().getOrder(orderId);
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });

  return NextResponse.json({ status: order.status, paidAt: order.paidAt, packageId: order.packageId });
}
