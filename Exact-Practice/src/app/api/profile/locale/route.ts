import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { usingDev } from "@/lib/db";
import { devAuth } from "@/lib/db/dev";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const { locale } = await req.json();
  if (!isLocale(locale)) return NextResponse.json({ error: "Locale tidak dikenal" }, { status: 400 });

  // cookie selalu di-set, bahkan untuk pengunjung yang belum punya akun —
  // pemilihan bahasa harus bertahan sebelum orang mendaftar
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, {
    httpOnly: false, sameSite: "lax", path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 365 * 24 * 3600,
  });

  const user = await currentUser();
  if (user) {
    if (usingDev()) await devAuth.setLocale(user.id, locale);
    else {
      const { createAdminClient } = await import("@/lib/supabase/server");
      await createAdminClient().from("profiles").update({ locale }).eq("id", user.id);
    }
  }

  return NextResponse.json({ ok: true, locale });
}
