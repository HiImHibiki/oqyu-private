import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { normalizeCode, setRefCookie } from "@/lib/affiliate";
import { cookies } from "next/headers";

/* Tautan yang dibagikan afiliasi: /r/KODE
 * Mencatat klik, menaruh cookie 30 hari, lalu melempar ke halaman daftar. */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const clean = normalizeCode(code);
  const url = new URL(req.url);
  const paket = url.searchParams.get("paket");

  const target = new URL(paket ? `/beli?paket=${paket}` : "/beli", url.origin);

  if (clean) {
    const aff = await getDb().affiliateByCode(clean).catch(() => null);
    if (aff && aff.status === "active") {
      // Kode selalu ikut di URL — parameter navigasi bukan cookie dan tidak
      // memerlukan persetujuan. Cookie 30 hari hanya dipasang bila pengunjung
      // sudah mengizinkannya lewat banner.
      target.searchParams.set("ref", aff.code);
      await getDb().recordClick(aff.code).catch(() => {});

      const consent = (await cookies()).get("exact_cookie_consent")?.value;
      if (consent === "all") await setRefCookie(aff.code);
    }
  }

  return NextResponse.redirect(target);
}
