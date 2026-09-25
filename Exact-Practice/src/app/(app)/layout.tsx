import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AppShell } from "@/components/ui/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/masuk");
  return <AppShell user={{ fullName: user.fullName, email: user.email }}>{children}</AppShell>;
}
