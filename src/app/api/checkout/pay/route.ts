import { NextResponse } from "next/server";
import { fulfillOrder } from "@/lib/checkout";
import { midtransEnabled } from "@/lib/midtrans";

/* SIMULASI pembayaran.
 *
 * Sengaja dimatikan begitu Midtrans dikonfigurasi dan di build produksi —
 * kalau tidak, endpoint ini menjadi cara gratis mendapatkan kuota. Di
 * produksi, kuota hanya lahir dari webhook yang signature-nya terverifikasi
 * atau dari admin yang menyatakan transfer banknya sudah masuk. */
export async function POST(req: Request) {
  if (midtransEnabled() || process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Simulasi pembayaran dinonaktifkan. Gunakan transfer bank atau gateway pembayaran." },
      { status: 403 },
    );
  }

  const { orderId } = await req.json();
  const res = await fulfillOrder(String(orderId ?? ""), "simulation");
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
