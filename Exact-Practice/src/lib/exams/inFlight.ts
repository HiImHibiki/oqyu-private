import { getDb } from "@/lib/db";

/* Soal yang sedang berada di dalam attempt yang belum ditutup.
 *
 * Dipakai untuk menolak perubahan isi soal yang akan menggeser tanah di bawah
 * kaki peserta yang sedang mengerjakannya. Lihat importQuestions() di bank.ts
 * untuk alasan lengkapnya. */
export async function questionsInFlight(limit = 5000): Promise<Set<string>> {
  const ids = new Set<string>();
  /* `recentAttempts` ada di kedua driver dan mengembalikan semua status.
   * Batasnya dinaikkan jauh di atas 30 bawaan karena yang dicari justru
   * attempt lama yang masih terbuka. */
  for (const a of await getDb().recentAttempts(limit)) {
    if (a.status !== "in_progress") continue;
    for (const sec of a.formLayout ?? []) {
      for (const id of sec.questionIds ?? []) ids.add(id);
    }
  }
  return ids;
}
