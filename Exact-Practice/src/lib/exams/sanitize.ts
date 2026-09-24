import type { Question } from "@/lib/types";
import type { PlayerSection } from "@/components/exam/ExamPlayer";

/* Kunci jawaban, pembahasan, dan analisis distraktor TIDAK BOLEH ikut terkirim
 * ke browser selama ujian berlangsung — kalau ikut, siapa pun bisa membacanya
 * dari React payload. Semua penilaian dilakukan di server (lihat
 * /api/attempts/[id]/submit). */

type SafeQuestion = Omit<Question, "answer" | "explanation" | "hints" | "distractorRationale"> & {
  answer: { mode: Question["answer"]["mode"]; selectCount?: number };
};

export function stripAnswer(q: Question): SafeQuestion {
  const { answer, explanation, hints, distractorRationale, ...rest } = q;
  void explanation; void hints; void distractorRationale;
  return {
    ...rest,
    // hanya `mode` yang dipertahankan, karena renderer memerlukannya
    answer: {
      mode: answer.mode,
      ...(answer.mode === "choice_set" ? { selectCount: answer.selectCount } : {}),
    },
  };
}

/* Selain kunci jawaban, ISI SOAL section yang belum dicapai juga tidak boleh
 * ikut terkirim.
 *
 * Sebelumnya seluruh paket dikirim sekaligus saat halaman ujian dimuat, jadi
 * peserta yang membuka devtools pada bagian pertama sudah dapat membaca semua
 * soal bagian berikutnya. Itu meniadakan arti pembagian waktu per bagian:
 * seseorang bisa memakai 30 menit bagian pertama untuk mengerjakan bagian
 * ketiga. Soal bagian berikutnya baru dikirim ketika servernya memulai
 * section itu — lihat /api/attempts/[id]/section. */
export function stripSections(sections: PlayerSection[], visibleUpTo = Infinity): PlayerSection[] {
  return sections.map((s, i) => ({
    ...s,
    questionCount: s.questionCount ?? s.questions.length,
    questions: i <= visibleUpTo ? (s.questions.map(stripAnswer) as unknown as Question[]) : [],
  }));
}
