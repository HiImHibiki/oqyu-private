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
    <>
      <PageHead title="Buat latihan" subtitle="Cara termudah: buat lembar di Exact Worksheet lalu tekan «Ke Practice» — paketnya muncul di sini dengan kode ujian. Atau buat langsung dari halaman ini." />
      <PanelLatihan awal={paket} />
    </>
  );
}
