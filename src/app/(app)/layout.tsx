import { redirect } from "next/navigation";
import { currentUser, menunggu } from "@/lib/auth";
import { AppShell } from "@/components/ui/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/masuk");
  if (menunggu(user)) redirect("/menunggu");
  return <AppShell user={{ fullName: user.fullName, email: user.email }}>{children}</AppShell>;
}
