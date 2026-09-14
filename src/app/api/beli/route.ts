import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { devAuth } from "@/lib/db/dev";
import { usingDev } from "@/lib/db";
import { packageById, priceOf } from "@/lib/packages";
import { normalizeCode } from "@/lib/affiliate";
import { MANUAL_PAYMENT, confirmationMessage, orderRef, whatsappUrl } from "@/lib/payment";
import { clientIp, rateLimit } from "@/lib/ratelimit";

/* Pembelian oleh pengguna UMUM tanpa akun: isi nama, email, WhatsApp, pilih
 * paket, (kode afiliasi). Akun dibuat setengah jadi (role umum, tanpa sandi)
 * bersama pesanan pending; sandinya lahir saat admin menandai lunas. */
export async function POST(req: Request) {
  if (!usingDev()) return NextResponse.json({ error: "Hanya untuk mode berkas." }, { status: 400 });
  const l = rateLimit(`beli:${clientIp(req)}`, 10, 3600);
  if (!l.ok) return NextResponse.json({ error: `Terlalu banyak pesanan. Coba lagi dalam ${l.retryAfterSec} detik.` }, { status: 429 });

  const b = await req.json().catch(() => ({}));
  const nama = String(b.nama ?? "").trim().slice(0, 60);
  const email = String(b.email ?? "").trim().toLowerCase();
  const hp = String(b.hp ?? "").replace(/[^\d+]/g, "");
  const kode = normalizeCode(String(b.kode ?? ""));
  const pkg = packageById(String(b.paket ?? ""));
  if (!nama) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Alamat email tidak valid" }, { status: 400 });
  if (hp.replace(/\D/g, "").length < 9) return NextResponse.json({ error: "Nomor WhatsApp tidak valid" }, { status: 400 });
  if (!pkg || pkg.exam !== "LATIHAN") return NextResponse.json({ error: "Paket tidak dikenal" }, { status: 400 });

  const db = getDb();
  const ada = await devAuth.userByEmail(email);
  if (ada && ada.role !== "umum" && ada.role !== "menunggu") {
    return NextResponse.json({ error: "Email ini sudah terdaftar sebagai murid Exact Course — latihan sudah gratis untukmu, silakan masuk." }, { status: 409 });
  }
  const u = ada ?? await devAuth.upsertUser({ email, fullName: nama, phone: hp });
  if (u.role !== "umum") await db.setUserRole(u.id, "umum");
  if (!ada && kode) await db.attachReferral(kode, u.id).catch(() => undefined);

  const amount = priceOf(pkg, "IDR");
  const order = await db.createOrder({ userId: u.id, packageId: pkg.id, exam: "LATIHAN", amount, currency: "IDR", provider: "manual" });
  const ref = orderRef(order.id);
  const nominal = "Rp" + amount.toLocaleString("id-ID");
  const pesan = confirmationMessage({ ref, packageName: pkg.name, amount: nominal, name: nama })
    + `\nEmail : ${email}\nWA    : ${hp}`;
  return NextResponse.json({
    orderId: order.id, ref, amount, nominal, paket: pkg.name, hari: pkg.days,
    wa: whatsappUrl(pesan),
    bank: MANUAL_PAYMENT.bank ? { nama: MANUAL_PAYMENT.bank, rekening: MANUAL_PAYMENT.accountNumber, atasNama: MANUAL_PAYMENT.accountHolder } : null,
  });
}
