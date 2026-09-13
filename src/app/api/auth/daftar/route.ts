import { NextResponse } from "next/server";
import { daftarMurid } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const l = rateLimit(`daftar:${clientIp(req)}`, 10, 3600);
  if (!l.ok) return NextResponse.json({ error: `Terlalu banyak pendaftaran. Coba lagi dalam ${l.retryAfterSec} detik.` }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const res = await daftarMurid({
    email: String(b.email ?? ""), fullName: String(b.fullName ?? ""),
    password: String(b.password ?? ""), kode: String(b.kode ?? ""),
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
