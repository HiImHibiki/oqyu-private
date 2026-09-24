import { NextResponse } from "next/server";
import { googleAuthUrl } from "@/lib/auth";
import { usingDev } from "@/lib/db";
import { normalizeCode } from "@/lib/affiliate";
import { OAUTH_REF_COOKIE, safePath, siteUrl } from "@/lib/redirects";

/* Titik masuk satu-satunya bagi peserta.
 *
 * Sengaja GET dan sengaja sebuah redirect, bukan fetch dari JavaScript: tombol
 * «Lanjut dengan Google» jadi tautan biasa yang tetap berfungsi sebelum React
 * sempat terpasang, dan tidak ada state klien yang perlu dijaga. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const site = siteUrl(req);
  const next = safePath(url.searchParams.get("next"));
  const ref = normalizeCode(url.searchParams.get("ref") ?? "");

  /* Tanpa Supabase tidak ada provider OAuth sama sekali. Alih-alih halaman
   * galat, pengembang dilempar ke masuk cepat lokal. */
  if (usingDev()) {
    return NextResponse.redirect(`${site}/masuk?dev=1&next=${encodeURIComponent(next)}`);
  }

  const res = await googleAuthUrl(`${site}/auth/callback?next=${encodeURIComponent(next)}`);
  if (!res.ok) {
    return NextResponse.redirect(`${site}/masuk?error=${encodeURIComponent(res.error)}`);
  }

  const redirect = NextResponse.redirect(res.data.url);
  if (ref) {
    redirect.cookies.set(OAUTH_REF_COOKIE, ref, {
      httpOnly: true, sameSite: "lax", path: "/",
      secure: process.env.NODE_ENV === "production", maxAge: 900,
    });
  }
  return redirect;
}
