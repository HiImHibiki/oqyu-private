import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { PageHead } from "@/components/ui/AppShell";
import { UserTable } from "./UserTable";

export const metadata = { title: "Peserta" };

export default async function PesertaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const me = await requireAdmin();
  const { q } = await searchParams;
  const users = await getDb().listUsers(q, 200);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHead title="Peserta" subtitle={`${users.length} akun ditampilkan.`} />
      <UserTable rows={JSON.parse(JSON.stringify(users))} q={q ?? ""} meId={me.id} canEditRole={me.role === "admin"} />
    </div>
  );
}
