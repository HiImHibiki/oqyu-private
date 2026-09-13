import { SiteHeader } from "@/components/ui/SiteHeader";
import { DemoPicker } from "./DemoPicker";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Demo gratis" };

export default async function DemoPage() {
  const t = await getT();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="display mb-2 text-3xl">{t("demo.title")}</h1>
        <p className="mb-8 max-w-xl muted">{t("demo.sub")}</p>
        <DemoPicker />
      </main>
    </>
  );
}
