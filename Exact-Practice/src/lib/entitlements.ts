import type { EntitlementRecord } from "@/lib/db";
import type { ExamCode } from "@/lib/types";
import { getBlueprint } from "@/lib/exams/blueprints";
import { packageById } from "@/lib/packages";

export interface ExamQuota {
  exam: string;
  /** Kuota yang benar-benar bisa dipakai hari ini. */
  left: number;
  /** Kedaluwarsa terdekat di antara kuota yang masih bisa dipakai. */
  expiresAt?: string | null;
}

/* Kuota yang sudah kedaluwarsa TIDAK dihitung.
 *
 * Kedua driver basis data menolak memakai entitlement yang lewat masa
 * berlakunya saat attempt dibuat, tetapi dashboard menjumlahkan semuanya —
 * sehingga peserta bisa melihat «3 kuota tersisa» lalu ditolak saat menekan
 * mulai. Angka yang ditampilkan harus angka yang sama dengan yang dipakai
 * paywall. */
export const usableEntitlements = (ents: EntitlementRecord[], now = Date.now()) =>
  ents.filter(
    (e) => e.attemptsUsed < e.attemptsTotal && (!e.expiresAt || new Date(e.expiresAt).getTime() > now),
  );

export function quotaByExam(ents: EntitlementRecord[], now = Date.now()): ExamQuota[] {
  const map = new Map<string, ExamQuota>();
  for (const e of usableEntitlements(ents, now)) {
    const cur = map.get(e.exam) ?? { exam: e.exam, left: 0, expiresAt: null as string | null };
    cur.left += e.attemptsTotal - e.attemptsUsed;
    if (e.expiresAt && (!cur.expiresAt || e.expiresAt < cur.expiresAt)) cur.expiresAt = e.expiresAt;
    map.set(e.exam, cur);
  }
  return [...map.values()].sort((a, b) => a.exam.localeCompare(b.exam));
}

export const totalQuota = (list: { left: number }[]) => list.reduce((n, q) => n + q.left, 0);

/** Kuota yang habis dalam 30 hari — alasan yang jujur untuk mengingatkan,
 *  bukan hitung mundur yang dibuat-buat. */
export const expiringSoon = (q: { expiresAt?: string | null }, now = Date.now()) =>
  q.expiresAt ? new Date(q.expiresAt).getTime() - now < 30 * 864e5 : false;

/* =========================================================================
 * Cakupan mata uji
 *
 * Sebagian paket hanya mencakup satu mata uji — pelamar teknik CSCA membeli
 * Matematika dan Fisika saja, dan tidak seharusnya bisa memakai kuotanya untuk
 * mengerjakan 文科中文.
 *
 * Cakupan itu TIDAK disimpan di baris entitlement. Baris itu sudah menyimpan
 * `packageId`, dan katalog paket sudah menyebutkan mata uji apa yang dijual —
 * jadi menyalinnya ke basis data hanya akan menciptakan sumber kebenaran kedua
 * yang bisa berbeda dari yang pertama, plus satu migrasi yang tidak perlu.
 * ========================================================================= */

/** Seluruh kode mata uji sebuah ujian, urut sesuai blueprint. */
export const allSectionsOf = (exam: ExamCode | string): string[] =>
  getBlueprint(exam as ExamCode)?.sections.map((s) => s.code) ?? [];

/** Mata uji yang dicakup satu paket. Paket tanpa daftar sendiri mencakup
 *  seluruh mata uji ujiannya. */
export function packageSections(packageId: string, exam: ExamCode | string): string[] {
  const listed = packageById(packageId)?.sections;
  return listed?.length ? listed : allSectionsOf(exam);
}

/** Bolehkah kuota dari paket ini dipakai untuk mengerjakan `wanted`?
 *
 *  `wanted` kosong berarti «paket lengkap sesuai blueprint», dan itu hanya
 *  boleh dipenuhi oleh paket yang memang mencakup semuanya. */
export function packageCovers(
  packageId: string, exam: ExamCode | string, wanted?: readonly string[] | null,
): boolean {
  const mine = new Set(packageSections(packageId, exam));
  const need = wanted?.length ? wanted : allSectionsOf(exam);
  return need.every((code) => mine.has(code));
}

/* Satu kartu «mulai try out» di dashboard.
 *
 * Dikelompokkan menurut CAKUPANNYA, bukan menurut paketnya: dua pembelian
 * «CSCA Mathematics» adalah satu kuota berisi delapan percobaan di mata uji
 * yang sama, dan menampilkannya sebagai dua kartu identik hanya membuat
 * peserta menebak-nebak bedanya. */
export interface QuotaGroup {
  key: string;
  exam: ExamCode;
  /** Kode mata uji yang boleh dikerjakan dengan kuota ini. */
  sections: string[];
  /** true bila cakupannya seluruh mata uji ujian tersebut. */
  full: boolean;
  left: number;
  expiresAt?: string | null;
  /** Paket yang menyumbang kuota ini — untuk ditampilkan, bukan untuk logika. */
  packageIds: string[];
}

export function quotaGroups(ents: EntitlementRecord[], now = Date.now()): QuotaGroup[] {
  const map = new Map<string, QuotaGroup>();

  for (const e of usableEntitlements(ents, now)) {
    const sections = packageSections(e.packageId, e.exam);
    const key = `${e.exam}|${[...sections].sort().join(",")}`;
    const cur = map.get(key) ?? {
      key,
      exam: e.exam,
      sections,
      full: sections.length === allSectionsOf(e.exam).length,
      left: 0,
      expiresAt: null as string | null,
      packageIds: [] as string[],
    };
    cur.left += e.attemptsTotal - e.attemptsUsed;
    if (e.expiresAt && (!cur.expiresAt || e.expiresAt < cur.expiresAt)) cur.expiresAt = e.expiresAt;
    if (!cur.packageIds.includes(e.packageId)) cur.packageIds.push(e.packageId);
    map.set(key, cur);
  }

  /* Paket lengkap lebih dulu, lalu yang cakupannya paling luas — kartu
   * «semua mata uji» adalah yang paling sering ditekan. */
  return [...map.values()].sort(
    (a, b) => a.exam.localeCompare(b.exam) || b.sections.length - a.sections.length,
  );
}
