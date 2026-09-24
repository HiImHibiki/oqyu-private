import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { loadAttempt, remainingSec, sectionsOf } from "@/lib/exams/attempt";
import { stripSections } from "@/lib/exams/sanitize";
import { finalizeIfExpired } from "@/lib/exams/finalize";
import { getBlueprint } from "@/lib/exams/blueprints";
import type { ExamCode } from "@/lib/types";
import { ExamRunner } from "./ExamRunner";

export const metadata = { title: "Ruang ujian" };

export default async function UjianPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;

  const res = await loadAttempt(attemptId);
  if ("error" in res) {
    if (res.error === "not_found") notFound();
    redirect("/masuk");
  }

  const { attempt } = res;
  if (attempt.status === "submitted") redirect(`/hasil/${attemptId}`);

  /* Peserta kembali ke attempt yang seluruh tenggatnya sudah lewat —
   * baterai habis, peramban tertutup, koneksi putus. Tutup sekarang dengan
   * jawaban yang tersimpan, lalu antar ke halaman hasil. Tanpa ini attempt-nya
   * menggantung selamanya: kuota sudah terpakai tetapi nilainya tidak pernah
   * keluar. */
  if (await finalizeIfExpired(attempt)) redirect(`/hasil/${attemptId}`);

  const user = await currentUser();
  const exam = attempt.exam as ExamCode;
  const sections = await sectionsOf(attempt);
  const idx = Math.min(attempt.currentSection, sections.length - 1);
  const deadline = attempt.sectionDeadlines[sections[idx].code];

  /* Jawaban yang sudah tersimpan untuk section yang sedang berjalan.
   *
   * Hanya section ini: soal section berikutnya belum dikirim ke browser sama
   * sekali, jadi jawabannya pun tidak ada gunanya di sana. Ini jawaban peserta
   * sendiri, bukan kunci — `stripSections` tetap yang menjaga kunci jawaban. */
  const visible = new Set(sections[idx].questions.map((q) => q.id));
  const savedResponses = Object.fromEntries(
    Object.entries(attempt.responses ?? {}).filter(([qid]) => visible.has(qid)),
  );

  return (
    <ExamRunner
      attemptId={attemptId}
      examCode={exam}
      examName={attempt.formTitle || getBlueprint(exam)?.name || exam}
      studentName={user?.fullName || "Peserta demo"}
      isDemo={attempt.isDemo}
      sections={stripSections(sections, idx)}
      savedResponses={savedResponses}
      timeMultiplier={attempt.timeMultiplier ?? 1}
      initial={{
        sectionIndex: idx,
        // 0 kalau jam belum pernah dimulai — layar persiapan yang memulainya
        remainingSec: deadline ? remainingSec(deadline) : sections[idx].durationSec,
        started: Boolean(deadline),
      }}
    />
  );
}
