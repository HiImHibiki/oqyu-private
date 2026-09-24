import { SiteHeader } from "@/components/ui/SiteHeader";
import { packagesByExam } from "@/lib/packages";
import { currentUser } from "@/lib/auth";
import { FormBeli } from "./FormBeli";

export const metadata = { title: "Beli paket latihan" };
export const dynamic = "force-dynamic";

/* Halaman umum (tanpa login): teman murid yang datang lewat tautan afiliasi
 * memilih paket, mengisi data, lalu membayar lewat transfer + konfirmasi
 * WhatsApp. Akunnya dibuat saat admin menandai lunas. */
export default async function BeliPage({ searchParams }: { searchParams: Promise<{ ref?: string; paket?: string }> }) {
  const { ref, paket } = await searchParams;
  const user = await currentUser();
  const daftar = packagesByExam("LATIHAN").map((p) => ({
    id: p.id, name: p.name, blurb: p.blurb, hari: p.days ?? 365, harga: p.prices.IDR, coret: p.strike?.IDR ?? null,
    popular: Boolean(p.popular), features: p.features,
  }));
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="display mb-1 text-2xl">Paket latihan Exact Practice</h1>
        <p className="mb-6 text-sm muted">
          Semua paket latihan & bank soal, ujian online dengan nilai dan pembahasan, PDF lembar soal.
          Murid Exact Course tidak perlu membeli — masuk dengan akun Exact Canvas, latihannya gratis.
        </p>
        <FormBeli paket={daftar} refAwal={ref ?? ""} paketAwal={paket ?? ""}
          awal={user && user.role === "umum" ? { nama: user.fullName, email: user.email, hp: user.phone } : null} />
      </main>
    </>
  );
}
