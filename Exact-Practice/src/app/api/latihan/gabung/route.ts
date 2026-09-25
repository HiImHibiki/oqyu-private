import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { gabungPaket } from "@/lib/practice/paket";
import { rateLimit } from "@/lib/ratelimit";

/** Murid memasukkan kode ujian dari guru. body: { kode } */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Perlu masuk" }, { status: 401 });
  // Kode 6 huruf bisa ditebak kalau percobaannya tak terbatas.
  const l = rateLimit(`gabung:${user.id}`, 20, 900);
  if (!l.ok) return NextResponse.json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${l.retryAfterSec} detik.` }, { status: 429 });
  const { kode } = (await req.json().catch(() => ({}))) as { kode?: string };
  const r = await gabungPaket(String(kode ?? ""), user.id);
  if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: 404 });
  return NextResponse.json({ ok: true, baru: r.baru, paket: { id: r.paket.id, judul: r.paket.judul } });
}
