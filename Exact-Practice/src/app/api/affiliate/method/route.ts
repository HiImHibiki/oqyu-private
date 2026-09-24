import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const Body = z.object({
  type: z.enum(["bank", "ewallet"]),
  provider: z.string().min(2).max(40),
  accountNumber: z.string().min(6).max(30),
  accountName: z.string().min(3).max(80),
});

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Perlu masuk" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const db = getDb();
  if (!(await db.getAffiliate(user.id))) {
    return NextResponse.json({ error: "Kamu belum terdaftar sebagai afiliasi" }, { status: 400 });
  }
  await db.updatePayoutMethod(user.id, parsed.data);
  return NextResponse.json({ ok: true });
}
