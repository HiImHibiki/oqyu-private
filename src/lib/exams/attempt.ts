import { getDb, type AttemptRecord } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { sectionsFrom } from "./formBuilder";
import type { FormSectionLayout } from "@/lib/types";
import type { PlayerSection } from "@/components/exam/ExamPlayer";

/** Ambil attempt sekaligus periksa hak akses. Attempt demo dapat dibuka
 *  siapa saja yang tahu id acaknya; attempt berbayar hanya oleh pemiliknya. */
export async function loadAttempt(id: string) {
  const attempt = await getDb().getAttempt(id);
  if (!attempt) return { error: "not_found" as const };

  if (!attempt.isDemo) {
    const user = await currentUser();
    if (!user || user.id !== attempt.userId) return { error: "forbidden" as const };
    return { attempt, user };
  }
  return { attempt, user: null };
}

/* Menyusutkan susunan beku menjadi satu entri per section.
 *
 * Modul adaptif disimpan sebagai DUA entri dengan kode yang sama. Yang
 * ditampilkan hanya varian yang sudah dipilih server. Selama routing belum
 * ditetapkan, kedua varian disembunyikan — peserta memang belum boleh
 * mencapainya, dan menampilkan salah satunya lebih awal akan membocorkan
 * modul yang mungkin bukan miliknya. */
export function resolveLayout(attempt: AttemptRecord): FormSectionLayout[] {
  const layout = attempt.formLayout ?? [];
  const out: FormSectionLayout[] = [];
  const seen = new Set<string>();

  for (const s of layout) {
    if (!s.variant) { out.push(s); continue; }
    if (seen.has(s.code)) continue;

    const chosen = attempt.routing?.[s.code];
    if (!chosen) { seen.add(s.code); continue; }      // belum dirutekan → belum tampil
    const pick = layout.find((x) => x.code === s.code && x.variant === chosen);
    if (pick) out.push(pick);
    seen.add(s.code);
  }
  return out;
}

/** Paket dibangun ulang dari susunan yang DIBEKUKAN saat attempt dibuat,
 *  bukan dengan memilih ulang dari bank. */
export function sectionsOf(attempt: AttemptRecord): Promise<PlayerSection[]> {
  return sectionsFrom(resolveLayout(attempt));
}

/** Berapa section yang akan ada setelah semua routing selesai — untuk
 *  menampilkan «bagian 2 dari 4» sejak awal, tanpa membocorkan isinya. */
export function plannedSectionCount(attempt: AttemptRecord): number {
  const codes = new Set((attempt.formLayout ?? []).map((s) => s.code));
  return codes.size;
}

/** Peta questionId -> kode section, dipakai saat menilai supaya jawaban yang
 *  datang setelah tenggat section-nya bisa ditolak. */
export function sectionIndexOf(sections: PlayerSection[]) {
  const map = new Map<string, { code: string; position: number }>();
  for (const s of sections) {
    s.questions.forEach((q, i) => {
      if (!map.has(q.id)) map.set(q.id, { code: s.code, position: i });
    });
  }
  return map;
}

export function remainingSec(deadlineIso: string | undefined, now = Date.now()) {
  if (!deadlineIso) return 0;
  return Math.max(0, Math.round((new Date(deadlineIso).getTime() - now) / 1000));
}
