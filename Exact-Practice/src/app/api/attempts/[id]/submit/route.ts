import { NextResponse } from "next/server";
import { loadAttempt, sectionIndexOf, sectionsOf } from "@/lib/exams/attempt";
import { acceptResponses, gradeAndClose } from "@/lib/exams/finalize";
import type { ResponseValue } from "@/lib/types";

/* Penilaian dilakukan di server: kunci jawaban tidak pernah dikirim ke browser
 * selama ujian berlangsung.
 *
 * Jawaban yang dipakai bukan begitu saja yang dikirim browser. Untuk setiap
 * soal, server memilih:
 *   - jawaban dari payload, HANYA kalau tenggat section-nya belum lewat
 *   - kalau sudah lewat, jawaban terakhir yang tersimpan sebelum tenggat
 * Dengan begitu, menghentikan timer di browser tidak memberi waktu tambahan.
 *
 * Penilaiannya sendiri ada di lib/exams/finalize.ts, karena jalan yang sama
 * dipakai saat attempt yang ditinggalkan ditutup otomatis. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await loadAttempt(id);
  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: res.error === "not_found" ? 404 : 403 });
  }

  const { attempt } = res;
  if (attempt.status === "submitted") {
    return NextResponse.json({ ok: true, already: true, score: attempt.score });
  }

  const { responses: incoming, integrity } = (await req.json()) as {
    responses: Record<string, ResponseValue>;
    integrity: unknown;
  };

  const sections = await sectionsOf(attempt);
  const index = sectionIndexOf(sections);
  const { accepted, lateRejected } = acceptResponses(attempt, index, incoming);
  const score = await gradeAndClose(attempt, accepted, integrity);

  return NextResponse.json({ ok: true, score, lateRejected });
}
