import { redirect } from "next/navigation";
import { Hourglass } from "lucide-react";
import { currentUser, menunggu } from "@/lib/auth";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { Tunggu } from "./Tunggu";

export const metadata = { title: "Menunggu persetujuan" };
export const dynamic = "force-dynamic";

export default async function MenungguPage() {
  const user = await currentUser();
  if (!user) redirect("/masuk");
  if (!menunggu(user)) redirect("/latihan");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col justify-center px-5 py-16">
        <section className="card p-7 text-center rise">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <Hourglass size={22} />
          </span>
          <h1 className="display mb-2 text-2xl">Menunggu persetujuan guru</h1>
          <p className="text-sm muted">
            Akun <b>{user.fullName}</b> ({user.email}) sudah terdaftar. Guru perlu menyetujuinya dulu —
            halaman ini akan lanjut sendiri begitu disetujui.
          </p>
          <Tunggu />
        </section>
      </main>
    </>
  );
}
