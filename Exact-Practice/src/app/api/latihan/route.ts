import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { bolehBuka, getPaket } from "@/lib/practice/paket";
import { mulaiDariPaket } from "@/lib/practice/latihan";

/** Mulai latihan dari paket. body: { paketId } — murid harus sudah memasukkan
 *  kode ujian paket itu (lihat /api/latihan/gabung). */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Perlu masuk" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { paketId?: string };
  const p = b.paketId ? await getPaket(b.paketId) : null;
  // Paket yang tidak boleh dibuka dijawab sama dengan yang tidak ada: jangan
  // biarkan id paket orang lain bisa dipastikan keberadaannya.
  if (!p || !bolehBuka(user, p)) return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });
  if (!p.questionIds.length) return NextResponse.json({ error: "Paket ini belum punya soal" }, { status: 400 });
  try {
    const a = await mulaiDariPaket(user.id, p);
    return NextResponse.json({ attemptId: a.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal memulai latihan" }, { status: 500 });
  }
}
