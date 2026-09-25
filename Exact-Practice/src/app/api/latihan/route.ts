import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { bolehBuka, getPaket } from "@/lib/practice/paket";
import { mulaiDariPaket, mulaiPerbaikan } from "@/lib/practice/latihan";
import { getDb } from "@/lib/db";

/** Mulai latihan dari paket. body: { paketId, perbaikan? } — murid harus sudah
 *  memasukkan kode ujian paket itu (lihat /api/latihan/gabung). `perbaikan`:
 *  hanya nomor yang masih salah, tanpa batas waktu. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Perlu masuk" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { paketId?: string; perbaikan?: boolean };
  const p = b.paketId ? await getPaket(b.paketId) : null;
  // Paket yang tidak boleh dibuka dijawab sama dengan yang tidak ada: jangan
  // biarkan id paket orang lain bisa dipastikan keberadaannya.
  if (!p || !bolehBuka(user, p)) return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });
  if (!p.questionIds.length) return NextResponse.json({ error: "Paket ini belum punya soal" }, { status: 400 });
  try {
    /* Satu attempt berjalan per paket: kalau masih ada yang belum selesai
     * (utama atau perbaikan), lanjutkan itu — jangan membuka jam kedua. */
    const { milikPaket } = await import("@/lib/practice/latihan");
    const berjalan = (await getDb().attemptsOf(user.id))
      .find((x) => x.exam === "LATIHAN" && x.status === "in_progress" && milikPaket(x, p));
    if (berjalan) return NextResponse.json({ attemptId: berjalan.id, lanjut: true });
    const a = b.perbaikan
      ? await mulaiPerbaikan(user.id, p, await getDb().attemptsOf(user.id))
      : await mulaiDariPaket(user.id, p);
    return NextResponse.json({ attemptId: a.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal memulai latihan" }, { status: 400 });
  }
}
