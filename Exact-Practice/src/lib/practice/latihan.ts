/* Logika bersama paket latihan: membuat attempt dari paket, mengacak soal
 * per topik, dan menghitung kemajuan/kesalahan untuk pantauan guru. */
import { getDb } from "@/lib/db";
import { questionsByIds, type BankQuestion } from "@/lib/exams/bank";
import { gradeAnswer } from "@/lib/exams/grade";
import type { AttemptRecord } from "@/lib/db/types";
import type { FormSectionLayout, ResponseValue } from "@/lib/types";
import type { Paket } from "./paket";

const M = 60;

export function layoutLatihan(questionIds: string[], durasiMenit: number, ekstra: Partial<FormSectionLayout> = {}): FormSectionLayout[] {
  return [{
    code: "latihan", name: "Latihan", durationSec: Math.max(5, durasiMenit) * M,
    calculatorAllowed: true, questionIds, ...ekstra,
  }];
}

/** Attempt utama: seluruh soal paket, berwaktu sesuai durasi paket. Waktu
 *  habis → pemutar mengirim otomatis; yang belum dijawab dinilai salah. */
export async function mulaiDariPaket(userId: string, paket: Paket) {
  return getDb().createAttempt({
    userId, exam: "LATIHAN", formTitle: paket.judul, isDemo: false,
    formLayout: layoutLatihan(paket.questionIds, paket.durasiMenit, { paketId: paket.id }),
  });
}

/* Perbaikan tidak berwaktu. Mesin ujian tetap butuh tenggat, jadi diberi 30
 * hari — pemutar menyembunyikan jamnya lewat penanda `tanpaWaktu`. */
const PERBAIKAN_MENIT = 30 * 24 * 60;

/** Attempt ini milik paket itu? Attempt lama (sebelum ada paketId) dicocokkan
 *  lewat susunan soalnya. */
export function milikPaket(a: AttemptRecord, paket: Paket) {
  const s = a.formLayout[0];
  if (s?.paketId) return s.paketId === paket.id;
  return a.formLayout.flatMap((x) => x.questionIds).join(",") === paket.questionIds.join(",");
}

const jawabanAda = (raw: unknown) => raw !== undefined && raw !== null && raw !== "";

export interface StatusPaket {
  total: number;
  /** attempt utama yang sudah selesai, urut lama → baru */
  selesai: RingkasAttempt[];
  /** attempt perbaikan yang sudah selesai, urut lama → baru */
  perbaikan: RingkasAttempt[];
  /** attempt yang masih berjalan (utama atau perbaikan) */
  berjalan: AttemptRecord | null;
  /** nomor paket (1-based) yang belum pernah dijawab benar di attempt selesai mana pun */
  masihSalah: number[];
  benarGabungan: number;
  /** nilai 0–100 dari attempt utama pertama / setelah semua perbaikan */
  nilaiAwal: number | null;
  nilaiAkhir: number | null;
}

/** Riwayat satu murid di satu paket: nilai awal, nomor yang masih salah, dan
 *  nilai setelah perbaikan (soal dihitung benar begitu pernah dijawab benar). */
export async function statusPaket(paket: Paket, attempts: AttemptRecord[], bank?: Map<string, BankQuestion>): Promise<StatusPaket> {
  const milik = attempts.filter((a) => a.exam === "LATIHAN" && milikPaket(a, paket))
    .sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
  const peta = bank ?? (await questionsByIds(paket.questionIds));
  const nomor = new Map(paket.questionIds.map((id, i) => [id, i + 1]));
  const selesaiRec = milik.filter((a) => a.status === "submitted");
  const benar = new Set<string>();
  for (const a of selesaiRec) {
    const resp = (a.responses ?? {}) as Record<string, ResponseValue>;
    for (const id of a.formLayout.flatMap((x) => x.questionIds)) {
      const q = peta.get(id); const raw = resp[id]?.raw;
      if (q && jawabanAda(raw) && gradeAnswer(q, raw).correct) benar.add(id);
    }
  }
  const utama = selesaiRec.filter((a) => !a.formLayout[0]?.perbaikan);
  const selesai = await Promise.all(utama.map((a) => ringkasAttempt(a, peta, nomor)));
  const perbaikan = await Promise.all(selesaiRec.filter((a) => a.formLayout[0]?.perbaikan).map((a) => ringkasAttempt(a, peta, nomor)));
  const total = paket.questionIds.length;
  const persen = (n: number) => (total ? Math.round((100 * n) / total) : 0);
  return {
    total, selesai, perbaikan,
    berjalan: milik.filter((a) => a.status === "in_progress").pop() ?? null,
    masihSalah: selesai.length ? paket.questionIds.filter((id) => !benar.has(id)).map((id) => nomor.get(id)!) : [],
    benarGabungan: benar.size,
    nilaiAwal: selesai.length ? persen(selesai[0].benar) : null,
    nilaiAkhir: selesai.length ? persen(benar.size) : null,
  };
}

/** Tutup attempt latihan yang waktunya sudah habis tapi ditinggal murid
 *  (tab ditutup sebelum kirim otomatis). Jawaban tersimpan dinilai, sisanya
 *  kosong = salah. Dipanggil saat daftar murid/guru dibuka, supaya statusnya
 *  tidak menggantung "sedang mengerjakan" selamanya. Mengembalikan true bila
 *  ada yang ditutup (daftar attempt perlu dibaca ulang). */
export async function tutupYangKedaluwarsa(attempts: AttemptRecord[]) {
  const { finalizeIfExpired } = await import("@/lib/exams/finalize");
  let ada = false;
  for (const a of attempts) {
    if (a.exam === "LATIHAN" && a.status === "in_progress" && (await finalizeIfExpired(a))) ada = true;
  }
  return ada;
}

/** Kerjakan ulang hanya nomor yang masih salah — tanpa batas waktu. */
export async function mulaiPerbaikan(userId: string, paket: Paket, attempts: AttemptRecord[]) {
  const st = await statusPaket(paket, attempts);
  if (!st.selesai.length) throw new Error("Kerjakan paketnya sampai selesai dulu, baru perbaikan.");
  if (!st.masihSalah.length) throw new Error("Semua nomor sudah benar — tidak ada yang perlu diperbaiki.");
  const ids = st.masihSalah.map((n) => paket.questionIds[n - 1]);
  return getDb().createAttempt({
    userId, exam: "LATIHAN", formTitle: `Perbaikan — ${paket.judul}`, isDemo: false,
    formLayout: layoutLatihan(ids, PERBAIKAN_MENIT, { paketId: paket.id, perbaikan: true, tanpaWaktu: true, nomorAsli: st.masihSalah }),
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
  /** attempt perbaikan (hanya nomor yang salah, tanpa waktu) */
  perbaikan?: boolean;
  paketId?: string;
}

/** `nomorAsli`: id soal → nomor di paket. Tanpa itu nomornya urutan di attempt
 *  ini — untuk perbaikan (hanya sebagian soal) itu bukan nomor yang dikenal murid. */
export async function ringkasAttempt(a: AttemptRecord, bank?: Map<string, BankQuestion>, nomorAsli?: Map<string, number>): Promise<RingkasAttempt> {
  const ids = a.formLayout.flatMap((s) => s.questionIds);
  const peta = bank ?? (await questionsByIds(ids));
  const resp = (a.responses ?? {}) as Record<string, ResponseValue>;
  const salah: number[] = [], kosong: number[] = [];
  let benar = 0, dijawab = 0, terakhir = 0;
  ids.forEach((id, i) => {
    const no = nomorAsli?.get(id) ?? i + 1;
    const q = peta.get(id);
    const r = resp[id];
    const raw = r?.raw;
    const ada = raw !== undefined && raw !== null && raw !== "";
    if (!ada) { kosong.push(no); return; }
    dijawab++; terakhir = Math.max(terakhir, no);
    if (!q) return;
    const g = gradeAnswer(q, raw);
    if (g.correct) benar++; else salah.push(no);
  });
  const skor = (a as AttemptRecord & { score?: { total?: number } }).score?.total ?? null;
  return {
    attemptId: a.id, judul: a.formTitle, status: a.status, startedAt: a.startedAt,
    total: ids.length, dijawab, benar, salah, kosong, terakhir, skor,
    perbaikan: Boolean(a.formLayout[0]?.perbaikan), paketId: a.formLayout[0]?.paketId,
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

/** Kunci jawaban yang terbaca guru (pilihan ganda ditulis beserta kalimat opsinya). */
export function kunciTeks(q: BankQuestion): string {
  const a = q.answer as { mode?: string; value?: unknown; accepted?: string[]; min?: number; max?: number } | undefined;
  if (!a) return "";
  if (a.mode === "choice" && typeof a.value === "string") return jawabanMuridTeks(q, a.value);
  if (a.mode === "numeric") return String(a.value);
  if (a.mode === "numeric_range") return `${a.min} – ${a.max}`;
  if (a.mode === "text") return (a.accepted ?? []).slice(0, 3).join(" / ");
  if (Array.isArray(a.value)) return a.value.map(String).join(", ");
  return "";
}
