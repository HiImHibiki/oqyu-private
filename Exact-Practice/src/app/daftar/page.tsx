import Link from "next/link";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { FormDaftar } from "@/components/auth/FormDaftar";
import { usingDev } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { safePath } from "@/lib/redirects";

export const metadata = { title: "Daftar" };

/* Pendaftaran murid: nama, username, kata sandi — akun langsung aktif. Soal
 * baru terlihat setelah murid memasukkan kode ujian dari guru di /latihan. */
export default async function DaftarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const next = safePath(one("next"));
  const t = await getT();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-5 py-16">
        <section className="card p-7 rise">
          <h1 className="display mb-1 text-2xl">Buat akun</h1>
          <p className="mb-6 text-sm muted">Sesudah daftar, masukkan kode ujian dari guru untuk membuka soalnya.</p>

          {usingDev() ? <FormDaftar next={next} /> : <p className="text-sm muted">Pendaftaran hanya tersedia di mode berkas.</p>}

          <p className="mt-6 text-center text-xs muted">
            {t("auth.haveAccount")} <Link href="/masuk" className="underline">{t("auth.signInHere")}</Link>
          </p>
        </section>
      </main>
    </>
  );
}
