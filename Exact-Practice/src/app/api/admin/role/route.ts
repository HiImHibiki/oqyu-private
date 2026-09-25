import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";

const ROLES = ["student", "reviewer", "admin"];

export async function POST(req: Request) {
  const me = await adminOrNull();
  // hanya admin penuh yang boleh mengubah peran; reviewer tidak
  if (!me || me.role !== "admin") return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });

  const { userId, role } = await req.json();
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Peran tidak dikenal" }, { status: 400 });
  if (userId === me.id) {
    // mencegah admin terakhir mengunci dirinya sendiri di luar panel
    return NextResponse.json({ error: "Tidak bisa mengubah peran akun sendiri" }, { status: 400 });
  }

  await getDb().setUserRole(String(userId), role);
  return NextResponse.json({ ok: true });
}
