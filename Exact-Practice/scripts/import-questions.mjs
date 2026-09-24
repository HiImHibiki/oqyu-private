#!/usr/bin/env node --experimental-strip-types
/**
 * Impor soal hasil AI ke bank soal.
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/import-questions.mjs hasil.json [--status in_review]
 *
 * - Kalau SUPABASE_SERVICE_ROLE_KEY tersedia, soal di-upsert ke tabel `questions`.
 * - Kalau tidak, soal ditulis ke .data/question-bank.json supaya bisa dipakai
 *   driver pengembangan tanpa Supabase.
 *
 * Soal SELALU masuk dengan status `draft` (atau nilai --status), tidak pernah
 * langsung `approved`. Persetujuan dilakukan lewat tinjauan manusia.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const file = process.argv[2];
if (!file) {
  console.error("Pemakaian: node --experimental-strip-types scripts/import-questions.mjs <file.json> [--status draft|in_review]");
  process.exit(2);
}
const statusIdx = process.argv.indexOf("--status");
const status = statusIdx > -1 ? process.argv[statusIdx + 1] : "draft";
if (!["draft", "in_review", "approved", "retired"].includes(status)) {
  console.error(`status "${status}" tidak dikenal`);
  process.exit(2);
}

const questions = JSON.parse(readFileSync(file, "utf8"));
const list = Array.isArray(questions) ? questions : [questions];

/* Menimpa soal yang sedang dikerjakan mengubah jawaban peserta tanpa ia
 * menyentuhnya — penjelasan lengkapnya di importQuestions() pada bank.ts.
 * Penjagaan yang sama sudah ada di balance-keys.mjs dan di rute impor. */
const FORCE = process.argv.includes("--force");
if (!FORCE) {
  const inFlight = await (async () => {
    try {
      const m = await import("@/lib/exams/inFlight");
      return await m.questionsInFlight();
    } catch (e) {
      // Tanpa daftar attempt kita tidak bisa menjamin apa pun; berhenti, jangan
      // menebak bahwa tidak ada yang sedang berjalan.
      console.error(`✗ Gagal memeriksa attempt yang berjalan: ${e.message}`);
      console.error("  Jalankan dengan --force bila memang yakin tidak ada peserta yang sedang ujian.");
      process.exit(1);
    }
  })();
  const bentrok = list.filter((q) => inFlight.has(q.id)).map((q) => q.id);
  if (bentrok.length) {
    console.error(`✗ ${bentrok.length} soal sedang dipakai attempt yang berjalan:`);
    console.error(`  ${bentrok.slice(0, 10).join(", ")}${bentrok.length > 10 ? ", …" : ""}`);
    console.error("  Isi soal tidak dibekukan ke dalam attempt, jadi menimpanya sekarang akan");
    console.error("  mengubah jawaban peserta tanpa ia menyentuhnya. Tunggu attempt-nya selesai,");
    console.error("  atau jalankan dengan --force bila perubahan ini memang mendesak.");
    process.exit(1);
  }
}
console.log(`Membaca ${list.length} soal dari ${file} (status: ${status})`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (url && key) {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const rows = list.map((q) => ({
    id: q.id,
    exam: q.exam,
    section: q.section,
    domain: q.domain,
    skill: q.skill,
    difficulty: q.difficulty,
    irt_b: q.irtB ?? null,
    calc_allowed: Boolean(q.calculatorAllowed),
    locale: q.locale,
    qtype: q.type,
    payload: q,
    status,
    source: q.meta?.generator ?? "ai",
    model: q.meta?.model ?? null,
  }));

  const { error, count } = await sb.from("questions").upsert(rows, { onConflict: "id", count: "exact" });
  if (error) {
    console.error("Gagal:", error.message);
    process.exit(1);
  }
  console.log(`✓ ${count ?? rows.length} soal di-upsert ke Supabase.`);
} else {
  const dir = process.env.EXACT_DATA_DIR || path.join(process.cwd(), ".data");
  const target = path.join(dir, "question-bank.json");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const existing = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : [];
  const byId = new Map(existing.map((q) => [q.id, q]));
  for (const q of list) {
    // Impor ulang tidak boleh menghapus jejak tinjauan — sama seperti
    // importQuestions() di bank.ts.
    const prev = byId.get(q.id);
    byId.set(q.id, { ...q, _status: status, ...(prev?._review ? { _review: prev._review } : {}) });
  }
  writeFileSync(target, JSON.stringify([...byId.values()], null, 2));
  console.log(`✓ ${list.length} soal ditulis ke ${target} (mode pengembangan, tanpa Supabase).`);
  console.log("  Isi NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY untuk mengimpor ke database.");
}
