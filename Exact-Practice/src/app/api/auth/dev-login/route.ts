import { NextResponse } from "next/server";
import { devSignIn } from "@/lib/auth";
import { usingDev } from "@/lib/db";

/* Masuk cepat khusus mode pengembangan.
 *
 * Membuat sesi hanya dari sebuah alamat email, tanpa membuktikan apa pun —
 * jadi penjaganya berlapis dan sengaja kaku: harus mode dev (tidak ada
 * Supabase) DAN build bukan produksi. Kalau salah satunya tidak terpenuhi,
 * endpointnya tidak ada. */
export async function POST(req: Request) {
  if (!usingDev() || process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Tidak tersedia." }, { status: 404 });
  }

  const { email, fullName } = await req.json().catch(() => ({}));
  const res = await devSignIn({ email: String(email ?? ""), fullName: String(fullName ?? "") });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, isNew: res.data.isNew });
}
