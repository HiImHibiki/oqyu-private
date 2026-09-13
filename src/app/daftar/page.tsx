import Link from "next/link";
import { PlayCircle, Zap } from "lucide-react";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { GoogleSignIn } from "@/components/auth/GoogleSignIn";
import { FormDaftar } from "@/components/auth/FormDaftar";
import { usingDev } from "@/lib/db";
import { normalizeCode } from "@/lib/affiliate";
import { packageById } from "@/lib/packages";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Daftar" };

/* Pendaftaran, seluruhnya.
 *
 * Dulu halaman ini punya empat langkah — data diri, pembayaran, kode OTP, lalu
 * membuat kata sandi — dan calon peserta harus melewati keempatnya sebelum
 * melihat satu soal pun. Sekarang tinggal satu tombol. Nama dan email datang
 * dari Google; paket dipilih setelah masuk, di /paket, tempat peserta lama
 * juga membelinya. Satu jalur pembelian, bukan dua yang harus dijaga sama. */
export default async function DaftarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const refCode = normalizeCode(one("ref")) || undefined;
  const t = await getT();

  /* Paket yang diklik di halaman depan ikut menyeberang: setelah masuk, orang
   * itu mendarat di /paket dengan paket yang sama sudah terpilih. Divalidasi
   * di sini supaya id karangan tidak ikut masuk ke URL tujuan. */
  const wanted = packageById(one("paket"))?.id;
  const next = wanted ? `/paket?paket=${wanted}` : undefined;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-5 py-16">
        <section className="card p-7 rise">
          <span className="chip mb-4" style={{ color: "var(--accent)" }}>
            <Zap size={12} /> {t("auth.oneStep")}
          </span>

          <h1 className="display mb-1 text-2xl">{t("auth.createTitle")}</h1>
          <p className="mb-6 text-sm muted">{t("auth.createSub")}</p>

          {usingDev() ? <FormDaftar next={next ?? ""} /> : <GoogleSignIn label={t("auth.googleContinue")} refCode={refCode} next={next} />}

          <p className="mt-4 text-center text-xs muted">
            {t("legal.consentInline")}{" "}
            <Link href="/ketentuan" target="_blank" className="underline">{t("legal.terms")}</Link>
            {" · "}
            <Link href="/privasi" target="_blank" className="underline">{t("legal.privacy")}</Link>
            <span className="mt-1 block">{t("legal.consentMinor")}</span>
          </p>

          <div className="mt-6 rounded-xl border border-dashed p-4 text-center"
            style={{ borderColor: "var(--border-strong)" }}>
            <p className="mb-2 text-sm muted">{t("auth.tryFirst")}</p>
            <Link href="/demo" className="btn btn-ghost">
              <PlayCircle size={16} /> {t("landing.ctaDemo")}
            </Link>
          </div>

          <p className="mt-5 text-center text-xs muted">
            {t("auth.haveAccount")} <Link href="/masuk" className="underline">{t("auth.signInHere")}</Link>
          </p>
        </section>
      </main>
    </>
  );
}
