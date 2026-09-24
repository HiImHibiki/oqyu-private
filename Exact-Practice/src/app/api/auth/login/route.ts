import { NextResponse } from "next/server";
import { login } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const target = String(email ?? "").trim().toLowerCase();

  for (const key of [`login:mail:${target}`, `login:ip:${clientIp(req)}`]) {
    const l = rateLimit(key, 8, 900);
    if (!l.ok) {
      return NextResponse.json(
        { error: `Terlalu banyak percobaan masuk. Coba lagi dalam ${l.retryAfterSec} detik.` },
        { status: 429, headers: { "retry-after": String(l.retryAfterSec) } },
      );
    }
  }

  const res = await login(target, String(password ?? ""));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 401 });
  return NextResponse.json({ ok: true });
}
