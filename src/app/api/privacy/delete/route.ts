import { NextResponse } from "next/server";
import { currentUser, logout } from "@/lib/auth";
import { deleteUserData } from "@/lib/privacy";
import { clientIp, rateLimit } from "@/lib/ratelimit";

/** Hak penghapusan — UU PDP Pasal 8, GDPR Art. 17.
 *
 *  Menuntut konfirmasi teks yang diketik ulang, bukan sekadar satu klik:
 *  tindakan ini tidak bisa dibatalkan dan menghapus seluruh riwayat try out. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const limit = rateLimit(`delete:${clientIp(req)}`, 5, 3600);
  if (!limit.ok) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });

  const { confirm } = await req.json();
  if (String(confirm ?? "").trim().toUpperCase() !== "DELETE") {
    return NextResponse.json(
      { error: 'Type DELETE to confirm. This cannot be undone.' },
      { status: 400 },
    );
  }

  // Admin tidak boleh menghapus dirinya lewat jalur ini — panel bisa terkunci
  // tanpa admin tersisa.
  if (user.role === "admin") {
    return NextResponse.json(
      { error: "Admin accounts cannot be deleted here. Transfer the admin role first." },
      { status: 400 },
    );
  }

  const res = await deleteUserData(user.id);
  if (!res.ok) return NextResponse.json({ error: res.error ?? "Deletion failed" }, { status: 500 });

  await logout();
  return NextResponse.json({ ok: true, deleted: res.deleted, retained: res.retained });
}
