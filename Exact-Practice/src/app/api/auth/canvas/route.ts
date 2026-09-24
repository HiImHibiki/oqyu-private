import { NextResponse } from "next/server";
import { masukDariCanvas, masukDariSesiCanvas } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { safePath } from "@/lib/redirects";

/** POST { hp, sandi } — masuk dengan akun Exact Canvas. */
export async function POST(req: Request) {
  const l = rateLimit(`canvas:${clientIp(req)}`, 10, 900);
  if (!l.ok) return NextResponse.json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${l.retryAfterSec} detik.` }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const res = await masukDariCanvas(String(b.hp ?? "").trim(), String(b.sandi ?? ""));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 401 });
  return NextResponse.json({ ok: true });
}

/** GET ?sesi=<token>&next= — tautan dari halaman murid Exact Canvas: sesi
 *  Canvas yang masih hidup langsung jadi sesi Practice, lalu ke /latihan. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const res = await masukDariSesiCanvas(u.searchParams.get("sesi") ?? "");
  const mintaNext = u.searchParams.get("next");
  const next = mintaNext ? safePath(mintaNext) : "/latihan";
  // Location relatif: di balik tunnel Cloudflare, origin yang dilihat Node
  // adalah http://localhost — memakainya akan melempar murid keluar dari HTTPS.
  const ke = res.ok ? next : `/masuk?error=${encodeURIComponent(res.error)}`;
  return new Response(null, { status: 303, headers: { Location: ke } });
}
