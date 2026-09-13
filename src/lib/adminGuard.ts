import { redirect } from "next/navigation";
import { currentUser, type CurrentUser } from "@/lib/auth";

export const ADMIN_ROLES = ["admin", "reviewer"];

export const isAdmin = (u: CurrentUser | null) => Boolean(u && ADMIN_ROLES.includes(u.role));

/** Dipakai halaman admin. Melempar ke /admin/masuk kalau bukan admin —
 *  bukan ke /masuk, supaya peserta biasa tidak bingung. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!isAdmin(user)) redirect("/admin/masuk");
  return user!;
}

/** Versi untuk route handler: mengembalikan null alih-alih melempar. */
export async function adminOrNull(): Promise<CurrentUser | null> {
  const user = await currentUser();
  return isAdmin(user) ? user : null;
}
