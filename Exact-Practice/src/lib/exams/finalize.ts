import { getDb, isExpired, type ItemOutcomeRow } from "@/lib/db";
import type { AttemptRecord } from "@/lib/db/types";
import { sectionIndexOf, sectionsOf } from "./attempt";
import { gradeAnswer } from "./grade";
import { scoreAttempt, type ItemOutcome } from "./scoring";
import type { ExamCode, ResponseValue } from "@/lib/types";

/* Menilai dan menutup sebuah attempt.
 *
 * Dipisahkan dari route /submit karena ada dua jalan menuju ke sini:
 *   1. peserta menekan «Selesai»
 *   2. seluruh tenggat sudah lewat tetapi peserta tidak pernah kembali
 *
 * Jalan kedua sebelumnya tidak ada sama sekali. Attempt yang ditinggalkan —
 * baterai habis, peramban tertutup, koneksi putus dan tidak pulih — tetap
 * berstatus `in_progress` selamanya: kuotanya sudah terpakai, jawabannya
 * tersimpan rapi, tetapi nilainya tidak pernah keluar dan tidak pernah muncul
 * di halaman hasil. Terukur 8 attempt dalam keadaan itu. */

/** Semua section sudah punya tenggat DAN semuanya sudah lewat. */
export function allSectionsExpired(attempt: AttemptRecord, sectionCodes: string[]): boolean {
  if (!sectionCodes.length) return false;
  return sectionCodes.every((code) => {
    const dl = attempt.sectionDeadlines[code];
    return Boolean(dl) && isExpired(dl);
  });
}

/** Jawaban yang boleh dinilai: yang masuk lewat tenggat diganti yang tersimpan. */
export function acceptResponses(
  attempt: AttemptRecord,
  index: Map<string, { code: string }>,
  incoming: Record<string, ResponseValue> | undefined,
  now = Date.now(),
): { accepted: Record<string, ResponseValue>; lateRejected: number } {
  const accepted: Record<string, ResponseValue> = { ...(attempt.responses ?? {}) };
  let lateRejected = 0;

  for (const [qid, value] of Object.entries(incoming ?? {})) {
    const meta = index.get(qid);
    if (!meta) continue;                                     // soal bukan bagian paket ini
    const deadline = attempt.sectionDeadlines[meta.code];
    // Tanpa tenggat berarti section itu tidak pernah dimulai lewat server —
    // jawabannya tidak bisa dipertanggungjawabkan waktunya.
    if (!deadline || isExpired(deadline, now)) { lateRejected++; continue; }
    accepted[qid] = value;
  }
  return { accepted, lateRejected };
}

/** Membangun hasil per soal, memperhitungkan nilai esai yang sudah masuk. */
async function outcomes(attempt: AttemptRecord, accepted: Record<string, ResponseValue>) {
  const sections = await sectionsOf(attempt);
  const bySection: Record<string, ItemOutcome[]> = {};
  const items: ItemOutcomeRow[] = [];
  const pendingRubric: string[] = [];

  for (const s of sections) {
    bySection[s.code] = s.questions.map((q, i) => {
      const r = accepted[q.id];
      const isRubric = q.answer?.mode === "rubric";
      const mark = isRubric ? attempt.marks?.[q.id] : undefined;

      /* Soal esai: kreditnya datang dari pengajar, bukan dari gradeAnswer —
       * yang untuk mode rubrik selalu mengembalikan nol. Selama belum
       * dinilai, soalnya ditandai `pendingManual` dan dikeluarkan dari
       * hitungan, bukan dianggap salah. */
      const g = isRubric
        ? { credit: mark ? mark.total / (q.points || 1) : 0, correct: false }
        : gradeAnswer(q, r?.raw);
      const pending = isRubric && !mark;
      if (isRubric) pendingRubric.push(q.id);

      items.push({
        questionId: q.id,
        sectionCode: s.code,
        position: i,
        credit: g.credit,
        correct: g.correct,
        timeSpentSec: r?.timeSpentSec ?? 0,
        flagged: Boolean(r?.flagged),
      });
      return { question: q, credit: g.credit, correct: g.correct, pendingManual: pending };
    });
  }
  return { bySection, items, pendingRubric };
}

/** Nilai `accepted` lalu tutup attempt-nya. Mengembalikan skornya. */
export async function gradeAndClose(
  attempt: AttemptRecord,
  accepted: Record<string, ResponseValue>,
  integrity: unknown,
) {
  const { bySection, items, pendingRubric } = await outcomes(attempt, accepted);
  const score = scoreAttempt(attempt.exam as ExamCode, bySection, attempt.routing ?? {});
  await getDb().submitAttempt(attempt.id, score, integrity, accepted, items, pendingRubric);
  return score;
}

/** Hitung ulang skor setelah satu jawaban esai dinilai.
 *
 *  Attempt tetap berstatus «submitted»; yang berubah hanya skornya. Tanpa ini,
 *  memberi nilai esai tidak akan mengubah apa pun yang dilihat peserta. */
export async function regradeAttempt(attemptId: string) {
  const attempt = await getDb().getAttempt(attemptId);
  if (!attempt || attempt.status !== "submitted") return null;
  const { bySection, items, pendingRubric } = await outcomes(attempt, attempt.responses ?? {});
  const score = scoreAttempt(attempt.exam as ExamCode, bySection, attempt.routing ?? {});
  void pendingRubric;   // daftarnya sudah ditulis saat attempt ditutup
  await getDb().rescoreAttempt(attemptId, score, items);
  return score;
}

/** Tutup attempt memakai jawaban tersimpan apa adanya. Section yang tidak
 *  pernah dibuka bernilai nol — itu cerminan jujur dari yang dikerjakan. */
export async function finalizeStale(attempt: AttemptRecord) {
  if (attempt.status !== "in_progress") return null;
  const sections = await sectionsOf(attempt);
  const index = sectionIndexOf(sections);
  const { accepted } = acceptResponses(attempt, index, undefined);
  return gradeAndClose(attempt, accepted, attempt.integrity ?? null);
}

/** Tutup attempt yang seluruh tenggatnya sudah lewat.
 *
 *  Sengaja konservatif: kalau ada satu section yang tenggatnya belum
 *  ditetapkan, pesertanya masih bisa kembali dan mengerjakannya. Menutup
 *  attempt semacam itu berarti merampas sesuatu yang masih menjadi haknya.
 *  Untuk yang benar-benar tidak pernah kembali, ada
 *  scripts/finalize-abandoned.mjs --stale-days. */
export async function finalizeIfExpired(attempt: AttemptRecord) {
  if (attempt.status !== "in_progress") return null;
  const sections = await sectionsOf(attempt);
  if (!allSectionsExpired(attempt, sections.map((s) => s.code))) return null;
  return finalizeStale(attempt);
}
