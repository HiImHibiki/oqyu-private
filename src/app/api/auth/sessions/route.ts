import { NextResponse } from "next/server";
import { currentUser, logoutEverywhere } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";

/* Mengakhiri seluruh sesi pemilik akun, termasuk sesi yang memanggil.
 *
 * Hanya untuk dirinya sendiri: userId diambil dari sesi yang sedang berjalan,
 * tidak pernah dari badan permintaan. Kalau boleh dikirim, siapa pun bisa
 * mengeluarkan orang lain dari akunnya. */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Perlu masuk" }, { status: 401 });

  const l = rateLimit(`sessions:${me.id}:${clientIp(req)}`, 5, 600);
  if (!l.ok) {
    return NextResponse.json(
      { error: `Terlalu sering. Coba lagi dalam ${l.retryAfterSec} detik.` },
      { status: 429, headers: { "retry-after": String(l.retryAfterSec) } },
    );
  }

  const n = await logoutEverywhere(me.id);
  return NextResponse.json({ ok: true, ended: n });
}
