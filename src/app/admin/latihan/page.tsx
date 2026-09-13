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
      <PageHead title="Buat latihan" subtitle="Soal dibuat Gemini lewat Exact Worksheet, langsung masuk bank dan bisa dicetak atau dikerjakan online." />
      <PanelLatihan awal={paket} />
    </>
  );
}
