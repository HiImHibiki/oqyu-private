import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { fulfillOrder } from "@/lib/checkout";
import { orderRef } from "@/lib/payment";

/* Menyatakan sebuah transfer bank sudah masuk.
 *
 * Inilah satu-satunya jalan kuota lahir tanpa gateway, jadi ia diperlakukan
 * setara dengan webhook: hanya `admin` yang boleh — bukan `reviewer`, yang
 * tidak punya urusan dengan uang — dan hasilnya melewati fulfillOrder() yang
 * sama, sehingga struk, komisi afiliasi, dan kuota bonus rujukan mengikuti
 * persis seperti pembayaran otomatis.
 *
 * Idempoten lewat fulfillOrder(): menekan tombolnya dua kali tidak menggandakan
 * kuota siapa pun. */
export async function POST(req: Request) {
  const me = await adminOrNull();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }

  const { orderId } = await req.json().catch(() => ({}));
  const order = await getDb().getOrder(String(orderId ?? ""));
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });

  /* Pesanan yang sudah dikembalikan dananya tidak boleh dihidupkan lagi lewat
   * pintu ini: refund mencabut kuota dan membatalkan komisi, dan «melunasi»
   * ulang akan mengembalikan kuotanya tanpa mengembalikan komisinya. */
  if (order.status === "refunded") {
    return NextResponse.json({ error: "Pesanan ini sudah dikembalikan dananya." }, { status: 409 });
  }

  const res = await fulfillOrder(order.id, `manual:${me.email}`);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  console.info(
    `konfirmasi manual: pesanan ${order.id} (${orderRef(order.id)}) oleh ${me.email}` +
    `${res.alreadyPaid ? " — sudah lunas sebelumnya, tidak ada yang berubah" : ""}`,
  );

  return NextResponse.json({ ok: true, alreadyPaid: res.alreadyPaid });
}
