#!/usr/bin/env node --experimental-strip-types
/**
 * Membangun ulang .data/question-bank.json dari berkas sumber di question-bank/
 * dan sample-tests/.
 *
 *   npm run seed
 *
 * Kenapa ada: di mode pengembangan, bank.ts hanya membaca .data/question-bank.json
 * — berkas itu tidak masuk git karena besar dan merupakan hasil olahan. Berkas
 * sumberlah yang disinkronkan antar-perangkat. Tanpa perintah ini, `git pull` di
 * laptop lain menghasilkan bank kosong, dan `npm run import` per berkas selalu
 * memasukkan soal sebagai `draft` sehingga tidak ada satu pun yang bisa dipakai
 * menyusun paket.
 *
 * Status tinjauan dibaca dari field `status` di berkas sumber. Jejak tinjauan
 * (_review) yang sudah ada di .data dipertahankan — status bisa dilahirkan ulang
 * dari sumber, tetapi catatan siapa memeriksa apa dan kapan tidak bisa.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "fs";
import path from "path";

const DIRS = ["question-bank", "sample-tests"];
const STATUSES = ["draft", "in_review", "approved", "retired"];
const FORCE = process.argv.includes("--force");

const list = [];
const seen = new Map();                  // id -> berkas, untuk menangkap id ganda
for (const dir of DIRS) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".json")) continue;
    const p = path.join(dir, f);
    let raw;
    try {
      raw = JSON.parse(readFileSync(p, "utf8"));
    } catch (e) {
      console.error(`✗ ${p} bukan JSON yang sah: ${e.message}`);
      process.exit(1);
    }
    for (const q of Array.isArray(raw) ? raw : [raw]) {
      if (!q?.id) {
        console.error(`✗ ${p}: ada soal tanpa id`);
        process.exit(1);
      }
      /* Id ganda berarti satu soal menimpa soal lain diam-diam, dan yang menang
       * ditentukan urutan abjad nama berkas — bukan keputusan siapa pun. */
      if (seen.has(q.id)) {
        console.error(`✗ id ganda "${q.id}": ${seen.get(q.id)} dan ${p}`);
        process.exit(1);
      }
      seen.set(q.id, p);
      if (q.status && !STATUSES.includes(q.status)) {
        console.error(`✗ ${p}: status "${q.status}" pada ${q.id} tidak dikenal (${STATUSES.join(" / ")})`);
        process.exit(1);
      }
      list.push(q);
    }
  }
}

if (!list.length) {
  console.error(`✗ tidak ada soal ditemukan di ${DIRS.join(" / ")}`);
  process.exit(1);
}

/* Menimpa soal yang sedang dikerjakan mengubah jawaban peserta tanpa ia
 * menyentuhnya — penjelasan lengkapnya di importQuestions() pada bank.ts.
 * Penjagaan yang sama ada di import-questions.mjs dan balance-keys.mjs. */
if (!FORCE) {
  const inFlight = await (async () => {
    try {
      const m = await import("@/lib/exams/inFlight");
      return await m.questionsInFlight();
    } catch (e) {
      console.error(`✗ Gagal memeriksa attempt yang berjalan: ${e.message}`);
      console.error("  Jalankan dengan --force bila memang yakin tidak ada peserta yang sedang ujian.");
      process.exit(1);
    }
  })();
  const bentrok = list.filter((q) => inFlight.has(q.id)).map((q) => q.id);
  if (bentrok.length) {
    console.error(`✗ ${bentrok.length} soal sedang dipakai attempt yang berjalan:`);
    console.error(`  ${bentrok.slice(0, 10).join(", ")}${bentrok.length > 10 ? ", …" : ""}`);
    console.error("  Tunggu attempt-nya selesai, atau jalankan dengan --force.");
    process.exit(1);
  }
}

const dir = process.env.EXACT_DATA_DIR || path.join(process.cwd(), ".data");
const target = path.join(dir, "question-bank.json");
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const prev = existsSync(target)
  ? new Map(JSON.parse(readFileSync(target, "utf8")).map((q) => [q.id, q]))
  : new Map();

const tally = {};
const rows = list.map((q) => {
  const { status, ...rest } = q;
  const s = status ?? "draft";
  tally[s] = (tally[s] ?? 0) + 1;
  const keep = prev.get(q.id)?._review;
  return { ...rest, _status: s, ...(keep ? { _review: keep } : {}) };
});

writeFileSync(target, JSON.stringify(rows, null, 2));
console.log(`✓ ${rows.length} soal dari ${seen.size ? new Set([...seen.values()]).size : 0} berkas ditulis ke ${target}`);
console.log(`  ${STATUSES.filter((s) => tally[s]).map((s) => `${s}: ${tally[s]}`).join("  ")}`);
