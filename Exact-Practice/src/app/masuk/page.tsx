import Link from "next/link";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { GoogleSignIn } from "@/components/auth/GoogleSignIn";
import { usingDev } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { safePath } from "@/lib/redirects";
import { FormMasuk } from "@/components/auth/FormMasuk";
import { FormCanvas } from "@/components/auth/FormCanvas";

export const metadata = { title: "Masuk" };

export default async function MasukPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const t = await getT();
  const next = safePath(one("next"));
  const dev = usingDev();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col justify-center px-5 py-16">
        <section className="card p-7 rise">
          <h1 className="display mb-1 text-2xl">{t("auth.signInTitle")}</h1>
          <p className="mb-6 text-sm muted">{t("auth.signInSub")}</p>

          {one("error") && (
            <div className="mb-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm"
              style={{ background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)" }}>
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {one("error")}
            </div>
          )}
          {one("cancelled") && (
            <div className="mb-4 rounded-xl px-3.5 py-2.5 text-sm" style={{ background: "var(--bg-sunken)" }}>
              {t("auth.cancelled")}
            </div>
          )}

          {dev ? (
            <>
              {/* Murid: akun Exact Canvas (No. HP + sandi) — satu akun untuk kanvas dan latihan. */}
              <FormCanvas next={next} />
              <details className="mt-5">
                <summary className="cursor-pointer text-center text-xs muted">Masuk dengan email (guru / akun lokal)</summary>
                <div className="mt-3"><FormMasuk next={next} /></div>
              </details>
            </>
          ) : (
            <>
              <GoogleSignIn label={t("auth.googleContinue")} next={next} />
              <p className="mt-4 text-center text-xs muted">{t("auth.googleNote")}</p>
            </>
          )}

          <hr className="my-6" style={{ borderColor: "var(--border)" }} />

          <p className="text-center text-xs muted">
            {t("auth.noAccount")}{" "}
            <Link href="/daftar" className="underline">{t("auth.registerLink")}</Link>
          </p>
          <p className="mt-2 text-center text-xs muted">
            Bukan murid Exact Course? <Link href="/beli" className="underline">Beli paket latihan</Link> — mulai Rp20.000/minggu.
          </p>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs muted">
            <ShieldCheck size={13} />
            <Link href="/admin/masuk" className="underline">{t("auth.adminLink")}</Link>
          </p>
        </section>
      </main>
    </>
  );
}
