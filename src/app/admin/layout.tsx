import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/adminGuard";
import { AdminShell } from "./AdminShell";

/* Layout ini tidak menjaga akses — penjaganya requireAdmin() di tiap halaman,
 * karena halaman masuk admin berada di bawah path yang sama. Yang dilakukan
 * di sini hanya memilih kerangka tampilan. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!isAdmin(user)) return <>{children}</>;
  return <AdminShell user={{ fullName: user!.fullName, email: user!.email, role: user!.role }}>{children}</AdminShell>;
}
