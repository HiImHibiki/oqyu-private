import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const me = await adminOrNull();
  if (!me || me.role !== "admin") return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });

  const { id, status, note } = await req.json();
  if (!["paid", "rejected", "requested"].includes(status)) {
    return NextResponse.json({ error: "Status tidak dikenal" }, { status: 400 });
  }

  await getDb().setPayoutStatus(String(id), status, note ? String(note).slice(0, 300) : undefined);
  return NextResponse.json({ ok: true });
}
