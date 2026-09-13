import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/adminGuard";
import { AdminLoginForm } from "./AdminLoginForm";

export const metadata = { title: "Masuk admin" };

export default async function AdminMasukPage() {
  const user = await currentUser();
  if (isAdmin(user)) redirect("/admin");
  // Pengguna yang sudah masuk tetapi bukan admin perlu tahu alasannya.
  return <AdminLoginForm signedInAs={user ? user.email : null} />;
}
