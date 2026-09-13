import { currentUser } from "@/lib/auth";
import { PageHead } from "@/components/ui/AppShell";
import { Board } from "./Board";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Papan peringkat" };

export default async function LeaderboardPage() {
  const user = (await currentUser())!;
  const t = await getT();
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHead title={t("lb.title")} subtitle={t("lb.sub")} />
      <Board meId={user.id} />
    </div>
  );
}
