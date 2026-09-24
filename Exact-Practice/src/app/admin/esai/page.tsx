import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { questionsByIds } from "@/lib/exams/bank";
import { PageHead } from "@/components/ui/AppShell";
import { MarkQueue, type MarkTask } from "./MarkQueue";

export const metadata = { title: "Penilaian esai" };

/* Antrean penilaian esai.
 *
 * Soal bernilai rubrik dikeluarkan dari skor sampai ada manusia yang
 * menilainya — jujur, tetapi artinya peserta belum mendapat apa pun dari
 * bagian esainya. Halaman ini yang menutup jarak itu. */
export default async function EsaiPage() {
  await requireAdmin();

  const attempts = await getDb().attemptsAwaitingMarks(50);

  const ids = [...new Set(attempts.flatMap((a) => a.pendingRubric ?? []))];
  const bank = await questionsByIds(ids);

  const tasks: MarkTask[] = [];
  for (const a of attempts) {
    for (const qid of a.pendingRubric ?? []) {
      if (a.marks?.[qid]) continue;                 // sudah dinilai
      const q = bank.get(qid);
      if (!q || q.answer?.mode !== "rubric") continue;
      const jawaban = a.responses?.[qid]?.raw;
      tasks.push({
        attemptId: a.id,
        questionId: qid,
        student: a.fullName || "Peserta",
        exam: a.exam,
        submittedAt: a.submittedAt ?? a.startedAt,
        stem: q.stem,
        points: q.points ?? 0,
        rubric: q.answer.rubric,
        exemplar: q.answer.exemplar,
        answer: typeof jawaban === "string" ? jawaban : jawaban == null ? "" : JSON.stringify(jawaban),
      });
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHead
        title="Penilaian esai"
        subtitle="Jawaban uraian yang menunggu pengajar. Sampai dinilai, soal-soal ini dikeluarkan dari skor peserta — bukan dianggap salah."
      />
      <MarkQueue tasks={JSON.parse(JSON.stringify(tasks))} />
    </div>
  );
}
