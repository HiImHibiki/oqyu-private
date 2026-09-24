import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AFFILIATE } from "@/lib/affiliate";
import { rupiah } from "@/lib/packages";

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Perlu masuk" }, { status: 401 });

  const db = getDb();
  const aff = await db.getAffiliate(user.id);
  if (!aff) return NextResponse.json({ error: "Kamu belum terdaftar sebagai afiliasi" }, { status: 400 });
  if (!aff.payoutMethod) {
    return NextResponse.json({ error: "Isi rekening tujuan lebih dulu" }, { status: 400 });
  }

  const stats = await db.affiliateStats(user.id);
  if (stats.withdrawableIdr < AFFILIATE.minPayoutIdr) {
    return NextResponse.json(
      { error: `Minimum pencairan ${rupiah(AFFILIATE.minPayoutIdr)}. Saldo siap cair kamu ${rupiah(stats.withdrawableIdr)}.` },
      { status: 400 },
    );
  }

  const payout = await db.requestPayout(user.id, stats.withdrawableIdr, stats.currency, aff.payoutMethod);
  return NextResponse.json({ ok: true, payout });
}
