import type { ExamCode, Question } from "@/lib/types";
import { SEED_QUESTIONS } from "./seed";

/* =========================================================================
 * BANK SOAL
 *
 * Satu-satunya sumber soal untuk menyusun paket. Membaca dari:
 *   - Supabase tabel `questions`  (produksi)
 *   - .data/question-bank.json    (mode pengembangan, hasil `npm run import`)
 *   - src/lib/exams/seed.ts       (19 soal contoh, selalu ikut sebagai `approved`)
 *
 * Soal hasil impor menimpa soal contoh yang ber-id sama, jadi kamu bisa
 * mengganti soal contoh cukup dengan mengimpor soal ber-id sama.
 * ========================================================================= */

export type BankStatus = "draft" | "in_review" | "approved" | "retired";

export interface BankQuestion extends Question {
  status: BankStatus;
  source?: string;
  model?: string;
  review?: ReviewRecord;
}

/* Jejak tinjauan.
 *
 * Status saja tidak cukup: «approved» tidak memberi tahu siapa yang memeriksa,
 * kapan, dan apa yang ia periksa. Tanpa itu, «sudah ditinjau guru» hanyalah
 * klaim yang tidak bisa dibuktikan saat ada soal yang keliru lolos. */
export interface ReviewRecord {
  by: string;                 // email peninjau
  at: string;                 // ISO timestamp
  verdict: "correct" | "returned";
  note?: string;              // wajib diisi saat dikembalikan
}

export interface BankFilter {
  exam?: ExamCode;
  section?: string;
  statuses?: BankStatus[];
  q?: string;
}

/* Cache pendek supaya satu permintaan halaman tidak memukul basis data
 * berkali-kali. Dibersihkan setiap kali bank berubah (impor / ubah status). */
const TTL_MS = 15_000;
let cache: { at: number; rows: BankQuestion[] } | null = null;

export function invalidateBank() {
  cache = null;
}

async function loadAll(): Promise<BankQuestion[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;

  const seed: BankQuestion[] = SEED_QUESTIONS.map((q) => ({
    ...q, status: "approved" as const, source: "seed",
  }));

  const byId = new Map<string, BankQuestion>(seed.map((q) => [q.id, q]));
  for (const q of await loadImported()) byId.set(q.id, q);

  const rows = [...byId.values()];
  cache = { at: Date.now(), rows };
  return rows;
}

/* Satu-satunya tempat letak berkas bank ditentukan.
 *
 * Sebelumnya pembacaan menghormati EXACT_DATA_DIR sementara kedua jalur
 * tulisnya memakai process.cwd() langsung. Akibatnya uji yang berjalan di atas
 * salinan data tetap MENULIS ke bank sungguhan: ia membaca salinan, menulis
 * aslinya, lalu membaca salinan lagi dan menyimpulkan tulisannya gagal. Satu
 * kali dijalankan, itu menukar kunci jawaban sebuah soal di bank produksi
 * tanpa satu pun pesan. Karena itu jalurnya disatukan di sini. */
async function bankFile(): Promise<string> {
  const path = await import("path");
  // EXACT_DATA_DIR — lihat catatan yang sama di lib/db/dev.ts
  const dir = process.env.EXACT_DATA_DIR || path.join(process.cwd(), ".data");
  return path.join(dir, "question-bank.json");
}

async function loadImported(): Promise<BankQuestion[]> {
  const { usingDev } = await import("@/lib/db");

  if (usingDev()) {
    try {
      const { promises: fs } = await import("fs");
      const raw = await fs.readFile(await bankFile(), "utf8");
      const list = JSON.parse(raw) as (Question & { _status?: BankStatus; _review?: ReviewRecord })[];
      return list.map((q) => {
        const { _status, _review, ...rest } = q;
        return { ...(rest as Question), status: _status ?? "draft", source: "import", review: _review };
      });
    } catch {
      return [];                       // belum ada berkas impor — wajar
    }
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const { data, error } = await createAdminClient()
    .from("questions")
    .select("payload,status,source,model")
    .limit(5000);
  if (error) {
    console.error("bank: gagal membaca tabel questions:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    ...(r.payload as Question),
    status: r.status as BankStatus,
    source: r.source ?? undefined,
    model: r.model ?? undefined,
  }));
}

/** Soal yang boleh dipakai menyusun paket berbayar. */
export async function approvedPool(exam: ExamCode): Promise<BankQuestion[]> {
  return (await loadAll()).filter((q) => q.exam === exam && q.status === "approved");
}

/** Pencarian untuk panel admin — semua status. */
export async function searchBank(f: BankFilter = {}): Promise<BankQuestion[]> {
  const needle = f.q?.toLowerCase().trim();
  return (await loadAll())
    .filter((q) => (!f.exam || q.exam === f.exam))
    .filter((q) => (!f.section || q.section === f.section))
    .filter((q) => (!f.statuses?.length || f.statuses.includes(q.status)))
    .filter((q) =>
      !needle ||
      q.id.toLowerCase().includes(needle) ||
      q.stem.toLowerCase().includes(needle) ||
      q.skill.toLowerCase().includes(needle) ||
      q.domain.toLowerCase().includes(needle))
    .sort((a, b) => a.exam.localeCompare(b.exam) || a.section.localeCompare(b.section) || a.id.localeCompare(b.id));
}

/** Ambil soal berdasarkan id, apa pun statusnya.
 *  Dipakai saat membangun ulang paket sebuah attempt — soal yang sudah
 *  dipensiunkan pun harus tetap bisa ditemukan, kalau tidak nilai siswa
 *  yang mengerjakannya jadi hilang. */
export async function questionsByIds(ids: string[]): Promise<Map<string, BankQuestion>> {
  const all = await loadAll();
  const want = new Set(ids);
  return new Map(all.filter((q) => want.has(q.id)).map((q) => [q.id, q]));
}

/** Ringkasan jumlah soal per ujian dan status — untuk panel admin. */
export async function bankSummary() {
  const all = await loadAll();
  const map = new Map<string, { exam: string; approved: number; in_review: number; draft: number; retired: number; total: number }>();
  for (const q of all) {
    const row = map.get(q.exam) ?? { exam: q.exam, approved: 0, in_review: 0, draft: 0, retired: 0, total: 0 };
    row[q.status]++;
    row.total++;
    map.set(q.exam, row);
  }
  return [...map.values()].sort((a, b) => a.exam.localeCompare(b.exam));
}

/* ------------------------------------------------------------- penulisan */

export interface ImportResult {
  imported: number;
  skipped: number;
  replaced: number;
}

/** Menulis soal ke bank. Soal ber-id sama ditimpa (mengunggah ulang berkas
 *  yang sama aman dan tidak menggandakan apa pun).
 *
 *  Menolak menimpa soal yang sedang dikerjakan, kecuali `force`.
 *
 *  Alasannya bukan kehati-hatian umum, melainkan satu kerusakan yang konkret.
 *  Attempt hanya membekukan DAFTAR ID soal; isinya dibaca ulang dari bank
 *  setiap kali paket dibangun ulang (sectionsFrom), termasuk saat dinilai.
 *  Sementara itu impor — dan scripts/balance-keys.mjs — memindahkan TEKS
 *  antar huruf: opsi yang tadinya di B pindah ke A, dan answer.value ikut
 *  digeser. Peserta yang sudah menyimpan «B» tidak mengubah apa pun, tetapi
 *  «B» miliknya kini menunjuk opsi yang sama sekali lain, dan penilaian
 *  membandingkannya dengan kunci yang juga sudah bergeser. Jawabannya berubah
 *  tanpa ia menyentuhnya, dan tidak ada satu pun jejak yang menunjukkan itu
 *  terjadi.
 *
 *  balance-keys.mjs sudah menjaga hal yang sama di sisi CLI. Penjagaan di sini
 *  menutup jalur aplikasinya: /api/admin/questions/import dan pemanggil lain
 *  mana pun, di kedua driver. */
export async function importQuestions(
  list: Question[],
  status: BankStatus,
  opts: { force?: boolean } = {},
): Promise<ImportResult> {
  const { usingDev } = await import("@/lib/db");

  if (!opts.force) {
    const { questionsInFlight } = await import("./inFlight");
    const busy = await questionsInFlight();
    const bentrok = list.filter((q) => busy.has(q.id)).map((q) => q.id);
    if (bentrok.length) {
      throw new Error(
        `${bentrok.length} soal sedang dipakai attempt yang berjalan dan tidak boleh ditimpa: ` +
          `${bentrok.slice(0, 10).join(", ")}${bentrok.length > 10 ? ", …" : ""}. ` +
          `Tunggu attempt-nya selesai, atau impor dengan force bila perubahan ini memang mendesak.`,
      );
    }
  }
  const existing = new Set((await loadAll()).map((q) => q.id));
  const replaced = list.filter((q) => existing.has(q.id)).length;

  if (usingDev()) {
    const { promises: fs } = await import("fs");
    const path = await import("path");
    const file = await bankFile();
    await fs.mkdir(path.dirname(file), { recursive: true });

    let current: (Question & { _status?: BankStatus })[] = [];
    try { current = JSON.parse(await fs.readFile(file, "utf8")); } catch { /* berkas belum ada */ }

    const byId = new Map(current.map((q) => [q.id, q]));
    for (const q of list) {
      // Impor ulang tidak boleh menghapus jejak tinjauan yang sudah ada.
      const prev = byId.get(q.id) as (Question & { _review?: ReviewRecord }) | undefined;
      byId.set(q.id, { ...q, _status: status, ...(prev?._review ? { _review: prev._review } : {}) });
    }
    await fs.writeFile(file, JSON.stringify([...byId.values()], null, 2));
  } else {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const rows = list.map((q) => ({
      id: q.id, exam: q.exam, section: q.section, domain: q.domain, skill: q.skill,
      difficulty: q.difficulty, irt_b: q.irtB ?? null, calc_allowed: Boolean(q.calculatorAllowed),
      locale: q.locale, qtype: q.type, payload: q, status,
      source: q.meta?.generator ?? "ai", model: q.meta?.model ?? null,
    }));
    const { error } = await createAdminClient().from("questions").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(`importQuestions: ${error.message}`);
  }

  invalidateBank();
  return { imported: list.length, skipped: 0, replaced };
}

export async function setQuestionStatus(
  ids: string[],
  status: BankStatus,
  review?: ReviewRecord,
): Promise<number> {
  const { usingDev } = await import("@/lib/db");

  if (usingDev()) {
    const { promises: fs } = await import("fs");
    const path = await import("path");
    const file = await bankFile();

    let current: (Question & { _status?: BankStatus; _review?: ReviewRecord })[] = [];
    try { current = JSON.parse(await fs.readFile(file, "utf8")); } catch { /* berkas belum ada */ }

    const known = new Set(current.map((q) => q.id));
    // soal contoh dari seed.ts belum ada di berkas — salin dulu supaya
    // statusnya bisa disimpan
    for (const q of SEED_QUESTIONS) {
      if (ids.includes(q.id) && !known.has(q.id)) current.push({ ...q, _status: "approved" });
    }

    let n = 0;
    for (const q of current) {
      if (!ids.includes(q.id)) continue;
      q._status = status;
      if (review) {
        q._review = review;
        q.meta = { ...(q.meta ?? {}), reviewed: review.verdict === "correct" };
      }
      n++;
    }
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(current, null, 2));
    invalidateBank();
    return n;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const { data, error } = await createAdminClient()
    .from("questions")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      ...(review ? { review } : {}),
    })
    .in("id", ids)
    .select("id");
  if (error) throw new Error(`setQuestionStatus: ${error.message}`);
  invalidateBank();
  return data?.length ?? ids.length;
}
