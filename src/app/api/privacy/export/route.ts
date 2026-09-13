import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { exportUserData } from "@/lib/privacy";
import { clientIp, rateLimit } from "@/lib/ratelimit";

/** Hak akses & portabilitas — UU PDP Pasal 5-6, GDPR Art. 15 & 20.
 *  Mengembalikan berkas JSON yang langsung terunduh. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const limit = rateLimit(`export:${user.id}:${clientIp(req)}`, 5, 3600);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many export requests. Try again later." }, { status: 429 });
  }

  const data = await exportUserData(user.id);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="exact-tryout-data-${stamp}.json"`,
      "cache-control": "no-store",
    },
  });
}
