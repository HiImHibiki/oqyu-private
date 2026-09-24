import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { completeGoogleSignIn } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { LEGAL_VERSION, recordConsent } from "@/lib/privacy";
import { normalizeCode, readRefCookie } from "@/lib/affiliate";
import { clientIp } from "@/lib/ratelimit";
import { getLocale } from "@/lib/i18n";
import { OAUTH_REF_COOKIE, safePath, siteUrl } from "@/lib/redirects";

/** Negara awal ditebak dari bahasa antarmuka — yang menentukan mata uang
 *  harganya. Peserta bisa menggantinya kapan saja di /pengaturan, dan
 *  tebakan yang bisa diperbaiki jauh lebih baik daripada satu pertanyaan
 *  tambahan sebelum ia sempat melihat aplikasinya. */
const COUNTRY_FOR_LOCALE: Record<string, string> = { id: "ID", zh: "CN", en: "US" };

/* Tempat Google memulangkan peserta.
 *
 * Semua yang dulu tersebar di empat langkah pendaftaran terjadi di sini, dalam
 * satu permintaan yang tidak dilihat siapa pun: sesi dibuat, profil dilengkapi,
 * persetujuan dicatat, rujukan afiliasi diikat. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const site = siteUrl(req);
  const next = safePath(url.searchParams.get("next"));

  /* Google mengirim `error` kalau pengguna menekan «Batal» di layar izinnya.
   * Itu bukan kegagalan sistem, jadi tidak diperlakukan sebagai galat. */
  if (url.searchParams.get("error")) {
    return NextResponse.redirect(`${site}/masuk?cancelled=1`);
  }

  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${site}/masuk?error=${encodeURIComponent("Tautan masuk tidak lengkap.")}`);

  const locale = await getLocale();
  const res = await completeGoogleSignIn(code, {
    locale,
    country: COUNTRY_FOR_LOCALE[locale] ?? "US",
  });
  if (!res.ok) return NextResponse.redirect(`${site}/masuk?error=${encodeURIComponent(res.error)}`);

  const jar = await cookies();

  if (res.data.isNew) {
    /* Persetujuan click-through: halaman /daftar menyatakan di sebelah tombolnya
     * bahwa melanjutkan berarti menyetujui Ketentuan dan Kebijakan Privasi.
     * Dicatat sekali, saat akunnya benar-benar lahir. */
    await recordConsent(res.data.userId, {
      terms: new Date().toISOString(),
      privacy: new Date().toISOString(),
      version: LEGAL_VERSION,
      ip: clientIp(req),
    }).catch(() => {});

    /* Kode rujukan bisa datang dari dua tempat: cookie 30 hari yang dipasang
     * /r/<kode>, atau titipan sesaat dari /daftar?ref=<kode>. */
    const ref = normalizeCode(jar.get(OAUTH_REF_COOKIE)?.value ?? "") || (await readRefCookie());
    if (ref) await getDb().attachReferral(ref, res.data.userId).catch(() => {});
  }

  /* Peserta yang belum punya kuota sama sekali tidak ada gunanya diantar ke
   * dasbor kosong — ia diantar ke daftar paket. */
  let destination = next;
  if (next === "/dashboard") {
    const ents = await getDb().entitlements(res.data.userId).catch(() => []);
    const left = ents.reduce((n, e) => n + Math.max(0, e.attemptsTotal - e.attemptsUsed), 0);
    if (left === 0) destination = "/paket";
  }

  const redirect = NextResponse.redirect(`${site}${destination}`);
  redirect.cookies.delete(OAUTH_REF_COOKIE);
  return redirect;
}
