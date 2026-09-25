import { NextResponse } from "next/server";
import { currentUser, idCanvasDari } from "@/lib/auth";
import { sesiCanvasUntuk, sesiPracticeUntuk, urlPapan } from "@/lib/practice/canvas";

/** Alamat kanvas murid Exact Canvas yang ditanam di halaman soal & hasil.
 *
 *  Murid yang masuk dengan akun Canvas memakai akunnya sendiri; murid
 *  username Practice dibuatkan akun Canvas otomatis. Keduanya langsung berada
 *  di kanvas pribadinya dengan izin coret, dan guru melihat coretannya dari
 *  Mac. `url: null` = Canvas mati atau EXACT_CANVAS_PIN belum diisi — halaman
 *  latihan tetap jalan tanpa papan. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ url: null });
  const idCanvas = idCanvasDari(user.email);
  const token = idCanvas ? await sesiCanvasUntuk(idCanvas) : await sesiPracticeUntuk(user.id, user.fullName);
  return NextResponse.json({ url: token ? urlPapan(token) : null });
}
