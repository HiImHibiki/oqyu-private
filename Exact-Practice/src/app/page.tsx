import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

/* Exact Practice tidak menjual paket try out, jadi beranda jualan warisan
 * Exact Try Out tidak dipakai: yang sudah masuk langsung ke daftar latihan,
 * yang belum ke halaman masuk. */
export default async function Beranda() {
  redirect((await currentUser()) ? "/latihan" : "/masuk");
}
