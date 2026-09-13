import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const me = await adminOrNull();
  if (!me || me.role !== "admin") return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });

  const { ids, status } = await req.json();
  if (!Array.isArray(ids) || !ids.length) {
    return NextResponse.json({ error: "Tidak ada komisi yang dipilih" }, { status: 400 });
  }
  if (!["pending", "approved", "paid", "void"].includes(status)) {
    return NextResponse.json({ error: "Status tidak dikenal" }, { status: 400 });
  }

  await getDb().setCommissionStatus(ids.map(String).slice(0, 500), status);
  return NextResponse.json({ ok: true });
}
