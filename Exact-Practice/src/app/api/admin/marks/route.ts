import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { questionsByIds } from "@/lib/exams/bank";
import { regradeAttempt } from "@/lib/exams/finalize";
import { clampRubricAwards } from "@/lib/exams/grade";
import type { RubricMark } from "@/lib/db/types";

/* Menyimpan nilai esai, lalu menghitung ulang skor attempt-nya.
 *
 * Poin yang diberikan DIJUMLAHKAN ULANG di server dari rubrik soalnya, tidak
 * dipercaya dari browser: kalau total boleh dikirim apa adanya, satu
 * permintaan yang disusun tangan bisa memberi nilai berapa pun tanpa terlihat
 * janggal di layar penilai. Tiap kriteria juga dibatasi poin maksimalnya. */
export async function POST(req: Request) {
  const me = await adminOrNull();
  if (!me) return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });

  const { attemptId, questionId, awarded, comment } = (await req.json()) as {
    attemptId: string; questionId: string; awarded: number[]; comment?: string;
  };
  if (!attemptId || !questionId) {
    return NextResponse.json({ error: "attemptId dan questionId wajib" }, { status: 400 });
  }

  const attempt = await getDb().getAttempt(attemptId);
  if (!attempt) return NextResponse.json({ error: "Attempt tidak ditemukan" }, { status: 404 });
  if (attempt.status !== "submitted") {
    return NextResponse.json({ error: "Attempt belum selesai" }, { status: 409 });
  }
  if (!(attempt.pendingRubric ?? []).includes(questionId)) {
    return NextResponse.json({ error: "Soal ini bukan soal esai dalam paket tersebut" }, { status: 400 });
  }

  const q = (await questionsByIds([questionId])).get(questionId);
  const rubric = q?.answer?.mode === "rubric" ? q.answer.rubric : null;
  if (!rubric) return NextResponse.json({ error: "Rubrik soal tidak ditemukan" }, { status: 404 });

  if (!Array.isArray(awarded) || awarded.length !== rubric.length) {
    return NextResponse.json(
      { error: `Butuh ${rubric.length} nilai kriteria, diterima ${Array.isArray(awarded) ? awarded.length : 0}` },
      { status: 400 },
    );
  }

  const { awarded: bersih, total } = clampRubricAwards(rubric, awarded);

  const mark: RubricMark = {
    awarded: bersih,
    total,
    comment: typeof comment === "string" && comment.trim() ? comment.trim().slice(0, 2000) : undefined,
    by: me.email,
    at: new Date().toISOString(),
  };

  await getDb().setRubricMark(attemptId, questionId, mark);
  const score = await regradeAttempt(attemptId);

  return NextResponse.json({ ok: true, mark, score });
}
