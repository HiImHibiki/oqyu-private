/* Posisi murid saat ini (nomor soal yang sedang dibuka) — untuk layar pantau
 * guru. Sengaja di memori proses, bukan di berkas: ini keadaan "saat ini" yang
 * berubah tiap beberapa detik, tidak perlu selamat dari restart, dan menulisnya
 * ke db.json tiap pindah nomor hanya memperlambat autosave jawaban. Practice
 * jalan sebagai satu proses di laptop guru, jadi satu Map cukup. */

export interface Posisi { questionId: string; at: number }

const peta: Map<string, Posisi> = ((globalThis as { __posisiLatihan?: Map<string, Posisi> }).__posisiLatihan ??= new Map());

export function catatPosisi(attemptId: string, questionId: string) {
  peta.set(attemptId, { questionId, at: Date.now() });
}

export function posisiDari(attemptId: string): Posisi | null {
  return peta.get(attemptId) ?? null;
}
