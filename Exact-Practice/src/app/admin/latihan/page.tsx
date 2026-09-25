import { requireAdmin } from "@/lib/adminGuard";
import { listPaket } from "@/lib/practice/paket";
import { PageHead } from "@/components/ui/AppShell";
import { PanelLatihan } from "./PanelLatihan";

export const metadata = { title: "Buat latihan" };
export const dynamic = "force-dynamic";

export default async function AdminLatihanPage() {
  await requireAdmin();
  const paket = await listPaket();
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead title="Buat latihan" subtitle="Salin prompt, buat soalnya di Claude (atau AI lain), lalu tempel balasannya di sini — paket langsung jadi dengan kode ujian. Lembar dari Exact Worksheet («Ke Practice») juga muncul di daftar ini." />
      <PanelLatihan awal={paket} />
    </div>
  );
}
