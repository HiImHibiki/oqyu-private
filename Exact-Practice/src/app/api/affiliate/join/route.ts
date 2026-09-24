import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AFFILIATE, generateCode } from "@/lib/affiliate";

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Perlu masuk" }, { status: 401 });

  const db = getDb();
  const existing = await db.getAffiliate(user.id);
  if (existing) return NextResponse.json({ code: existing.code, rate: existing.rate });

  // kode harus unik; coba beberapa kali sebelum menyerah
  for (let i = 0; i < 6; i++) {
    const code = generateCode(user.fullName);
    if (await db.affiliateByCode(code)) continue;
    const rec = await db.createAffiliate(user.id, code, AFFILIATE.defaultRate);
    return NextResponse.json({ code: rec.code, rate: rec.rate });
  }
  return NextResponse.json({ error: "Gagal membuat kode unik, coba lagi" }, { status: 500 });
}
