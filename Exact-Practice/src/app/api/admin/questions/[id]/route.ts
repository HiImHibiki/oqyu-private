import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/adminGuard";
import { searchBank } from "@/lib/exams/bank";

/* Soal utuh — termasuk kunci jawaban dan pembahasan.
 *
 * Endpoint ini sengaja terpisah dari data yang dikirim ke tabel: tabel hanya
 * memuat potongan stem, karena kunci jawaban tidak boleh ikut terkirim ke
 * halaman mana pun yang bisa dibuka peserta. Di sini kunci memang dibutuhkan —
 * peninjau tidak mungkin memeriksa jawaban yang tidak bisa ia lihat — jadi
 * aksesnya dijaga adminOrNull() dan hanya untuk satu soal per permintaan. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await adminOrNull())) {
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const q = (await searchBank({ q: id })).find((x) => x.id === id);
  if (!q) return NextResponse.json({ error: "Soal tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ question: q });
}
