import { NextResponse } from "next/server";
import { loadAttempt } from "@/lib/exams/attempt";
import { catatPosisi } from "@/lib/practice/posisi";

/** Murid pindah nomor → server tahu nomor yang sedang dibuka (untuk pantauan
 *  guru). body: { questionId } — hanya pemilik attempt yang berjalan. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await loadAttempt(id);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.error === "not_found" ? 404 : 403 });
  if (res.attempt.status !== "in_progress") return NextResponse.json({ ok: false });
  const { questionId } = (await req.json().catch(() => ({}))) as { questionId?: string };
  const ids = new Set(res.attempt.formLayout.flatMap((s) => s.questionIds));
  if (!questionId || !ids.has(questionId)) return NextResponse.json({ error: "soal tidak dikenal" }, { status: 400 });
  catatPosisi(id, questionId);
  return NextResponse.json({ ok: true });
}
