/* Logika bersama paket latihan: membuat attempt dari paket, mengacak soal
 * per topik, dan menghitung kemajuan/kesalahan untuk pantauan guru. */
import { getDb } from "@/lib/db";
import { approvedPool, questionsByIds, type BankQuestion } from "@/lib/exams/bank";
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

export async function kelompokBank() {
  const pool = await approvedPool("LATIHAN");
  const peta = new Map<string, { mapel: string; kelas: string; topik: string; jumlah: number }>();
  for (const q of pool) {
    const t = tagDari(q);
    const k = `${t.mapel}|${t.kelas}|${t.topik}`;
    const v = peta.get(k) ?? { ...t, jumlah: 0 };
    v.jumlah++; peta.set(k, v);
  }
  return [...peta.values()].sort((a, b) => a.mapel.localeCompare(b.mapel) || a.kelas.localeCompare(b.kelas) || a.topik.localeCompare(b.topik));
}

function acak<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export async function mulaiAcak(userId: string, f: { mapel: string; kelas?: string; topik?: string; jumlah: number }) {
  const pool = (await approvedPool("LATIHAN")).filter((q) => {
    const t = tagDari(q);
    return t.mapel === f.mapel && (!f.kelas || t.kelas === f.kelas) && (!f.topik || t.topik === f.topik);
  });
  if (!pool.length) return null;
  const ids = acak(pool).slice(0, Math.max(1, f.jumlah)).map((q) => q.id);
  const judul = `Latihan acak: ${f.topik || f.mapel}${f.kelas ? ` (Kelas ${f.kelas})` : ""}`;
  return getDb().createAttempt({
    userId, exam: "LATIHAN", formTitle: judul, isDemo: false,
    formLayout: layoutLatihan(ids, Math.ceil(ids.length * 2)),
  });
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
