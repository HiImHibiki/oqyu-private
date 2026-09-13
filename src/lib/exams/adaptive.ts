import { getBlueprint } from "./blueprints";
import { questionsByIds } from "./bank";
import { gradeAnswer } from "./grade";
import { routeAdaptive } from "./scoring";
import type { AttemptRecord } from "@/lib/db";

/* =========================================================================
 * ROUTING MODUL ADAPTIF (Digital SAT)
 *
 * Pada SAT digital, modul 2 tidak sama untuk semua orang: hasil modul 1
 * menentukan apakah peserta menerima modul yang lebih mudah atau lebih sulit,
 * dan modul yang mudah membatasi plafon skornya.
 *
 * Sebelumnya blueprint sudah menyatakan `adaptive`, beranda sudah menjanjikan
 * «Digital SAT yang adaptif per modul», dan fungsi routeAdaptive() sudah
 * ditulis — tetapi tidak ada satu pun kode yang memanggilnya. Semua peserta
 * menerima modul 2 yang sama, dan skornya selalu dihitung seolah modul sulit.
 * Modul ini yang menyambungkannya.
 *
 * Keputusan routing dibuat di SERVER, satu kali, dari jawaban yang sudah
 * tersimpan. Ia tidak boleh dihitung ulang: peserta yang bisa memicu routing
 * dua kali akan dapat mencoba kedua varian.
 * ========================================================================= */

export interface RoutingDecision {
  sectionCode: string;
  variant: "easier" | "harder";
  correct: number;
  total: number;
  ratio: number;
  threshold: number;
}

/** Nilai modul 1 dari jawaban tersimpan, lalu pilih varian modul 2. */
export async function decideRouting(
  attempt: AttemptRecord,
  targetSectionCode: string,
): Promise<RoutingDecision | null> {
  const bp = getBlueprint(attempt.exam);
  const target = bp?.sections.find((s) => s.code === targetSectionCode);
  const from = target?.adaptive?.routesFrom;
  if (!target || !from) return null;

  // Susunan modul 1 diambil dari layout beku, bukan dari bank saat ini.
  const m1 = (attempt.formLayout ?? []).find((s) => s.code === from && !s.variant);
  if (!m1?.questionIds.length) return null;

  const map = await questionsByIds(m1.questionIds);
  let correct = 0;
  let total = 0;

  for (const id of m1.questionIds) {
    const q = map.get(id);
    if (!q) continue;
    total++;
    const raw = attempt.responses?.[id]?.raw;
    // Tidak dijawab dihitung salah — sama seperti pada ujian sungguhan.
    if (raw === undefined || raw === null || raw === "") continue;
    if (gradeAnswer(q, raw).credit >= 1) correct++;
  }

  const threshold = target.adaptive?.threshold ?? 0.6;
  const ratio = total ? correct / total : 0;
  const variant = routeAdaptive(ratio, threshold) === "hard" ? "harder" : "easier";

  return { sectionCode: targetSectionCode, variant, correct, total, ratio, threshold };
}

/** Apakah section ini modul adaptif yang variannya belum dipilih? */
export function needsRouting(attempt: AttemptRecord, sectionCode: string): boolean {
  const hasVariants = (attempt.formLayout ?? []).some((s) => s.code === sectionCode && s.variant);
  return hasVariants && !attempt.routing?.[sectionCode];
}
