import { redirect } from "next/navigation";

/** Halaman awal guru = Pantau kelas (Ringkasan warisan Try Out dihapus). */
export default function AdminHome() {
  redirect("/admin/kelas");
}
