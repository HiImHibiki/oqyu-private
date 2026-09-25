/* Logika bersama paket latihan: membuat attempt dari paket, mengacak soal
 * per topik, dan menghitung kemajuan/kesalahan untuk pantauan guru. */
import { getDb } from "@/lib/db";
import { questionsByIds, type BankQuestion } from "@/lib/exams/bank";
import { gradeAnswer } from "@/lib/exams/grade";
import type { AttemptRecord } from "@/lib/db/types";
import type { FormSectionLayout, ResponseValue } from "@/lib/types";
import type { Paket } from "./paket";

const M = 60;

export function layoutLatihan(questionIds: string[], durasiMenit: number): FormSectionLayout[] {
  return [{
    code: "latihan", name: "Latihan", durationSec: Math.max(5, durasiMenit) * M,
    calculatorAllowed: true, questionIds,
  }];
}

export async function mulaiDariPaket(userId: string, paket: Paket) {
  return getDb().createAttempt({
    userId, exam: "LATIHAN", formTitle: paket.judul, isDemo: false,
    formLayout: layoutLatihan(paket.questionIds, paket.durasiMenit),
  });
}

/** Soal LATIHAN yang disetujui, dikelompokkan menurut tag mapel/kelas/topik. */
export function tagDari(q: BankQuestion) {
  return { mapel: q.domain, kelas: (q.tags ?? []).find((t) => t.startsWith("kelas-"))?.slice(6) ?? "", topik: q.skill };
}

/* ------------------------------------------------------------------ */
/* Pantauan guru                                                        */
/* ------------------------------------------------------------------ */

export interface RingkasAttempt {
  attemptId: string;
  judul: string;
  status: AttemptRecord["status"];
  startedAt: string;
  total: number;
  dijawab: number;
  benar: number;
  salah: number[];      // nomor soal (1-based) yang dijawab salah
  kosong: number[];     // nomor soal yang belum dijawab
  terakhir: number;     // nomor soal terjauh yang sudah dijawab
  skor?: number | null;
}

export async function ringkasAttempt(a: AttemptRecord, bank?: Map<string, BankQuestion>): Promise<RingkasAttempt> {
  const ids = a.formLayout.flatMap((s) => s.questionIds);
  const peta = bank ?? (await questionsByIds(ids));
  const resp = (a.responses ?? {}) as Record<string, ResponseValue>;
  const salah: number[] = [], kosong: number[] = [];
  let benar = 0, dijawab = 0, terakhir = 0;
  ids.forEach((id, i) => {
    const q = peta.get(id);
    const r = resp[id];
    const raw = r?.raw;
    const ada = raw !== undefined && raw !== null && raw !== "";
    if (!ada) { kosong.push(i + 1); return; }
    dijawab++; terakhir = i + 1;
    if (!q) return;
    const g = gradeAnswer(q, raw);
    if (g.correct) benar++; else salah.push(i + 1);
  });
  const skor = (a as AttemptRecord & { score?: { total?: number } }).score?.total ?? null;
  return {
    attemptId: a.id, judul: a.formTitle, status: a.status, startedAt: a.startedAt,
    total: ids.length, dijawab, benar, salah, kosong, terakhir, skor,
  };
}

/* ------------------------------------------------------------------ */
/* Lembar cetak milik satu murid                                        */
/* ------------------------------------------------------------------ */

/** Attempt SELESAI terakhir milik murid untuk paket ini, kalau ada.
 *
 * Dicocokkan lewat daftar id soal, bukan judul: judul paket bisa diganti guru
 * kapan saja, sedangkan susunan soal dibekukan ke formLayout saat attempt
 * dibuat — jadi id soal itulah yang benar-benar menyatakan "attempt ini
 * mengerjakan paket ini".
 *
 * Hanya yang berstatus submitted yang dihitung. Attempt yang masih berjalan
 * sengaja dianggap belum mengerjakan: lembar bersama jawaban memuat kunci,
 * dan mencetaknya di tengah ujian sama saja membocorkan kunci ke murid yang
 * jamnya masih jalan. */
export function attemptSelesaiPaket(attempts: AttemptRecord[], paket: Paket): AttemptRecord | null {
  const kunciPaket = paket.questionIds.join(",");
  const cocok = attempts.filter(
    (a) => a.exam === "LATIHAN" && a.status === "submitted" &&
      a.formLayout.flatMap((x) => x.questionIds).join(",") === kunciPaket,
  );
  if (!cocok.length) return null;
  return cocok.reduce((a, b) => (a.startedAt >= b.startedAt ? a : b));
}

/** Jawaban murid apa adanya, dibuat terbaca untuk lembar cetak. */
export function jawabanMuridTeks(q: BankQuestion, raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") return "";
  if (Array.isArray(raw)) return raw.map(String).join(", ");
  const teks = String(raw);
  /* Untuk pilihan ganda yang tersimpan cuma id opsinya ("C"), sedangkan yang
   * dibaca murid di lembar adalah kalimat opsinya — dua-duanya ditulis supaya
   * tidak perlu bolak-balik mencocokkan huruf. */
  const opsi = q.choices?.find((c) => c.id === teks);
  return opsi ? `${opsi.id}. ${opsi.text}` : teks;
}
