#!/usr/bin/env node --experimental-strip-types
/**
 * Validator soal hasil AI (pembungkus CLI).
 *
 *   node --experimental-strip-types scripts/validate-questions.mjs hasil.json [--strict]
 *
 * Aturannya ada di src/lib/exams/validate.ts, dipakai bersama oleh panel
 * admin — supaya CLI dan tombol impor tidak pernah berbeda hasilnya.
 */
import { readFileSync } from "fs";
import { validateQuestions } from "../src/lib/exams/validate.ts";

const file = process.argv[2];
const strict = process.argv.includes("--strict");
if (!file) {
  console.error("Pemakaian: node --experimental-strip-types scripts/validate-questions.mjs <file.json> [--strict]");
  process.exit(2);
}

const raw = JSON.parse(readFileSync(file, "utf8"));
const list = Array.isArray(raw) ? raw : [raw];
const report = validateQuestions(list, { strict });

const mark = { BLOCKER: "✗ BLOCKER", MAJOR: "! MAJOR  ", MINOR: "· minor  " };
for (const f of report.findings) {
  console.log(`  ${mark[f.severity]}  #${f.index} ${f.id}  ${f.message}`);
}

console.log("");
console.log(`Diperiksa ${report.checked} soal.`);
console.log(`  BLOCKER : ${report.blockers}`);
console.log(`  MAJOR   : ${report.majors}`);
console.log(`  minor   : ${report.minors}`);
if (!report.findings.length) console.log("\nSemua soal lolos validasi struktural.");
else console.log(`\n${report.accepted.length} dari ${report.checked} soal aman diimpor.`);

/* Sebaran posisi kunci.
 *
 * Penulis soal — manusia maupun AI — cenderung menaruh jawaban benar di opsi
 * pertama lalu menyusun pengecoh sesudahnya. Bila kecenderungan itu dibiarkan,
 * siswa bisa menebak dengan benar tanpa membaca soal, dan seluruh berkas
 * kehilangan validitasnya. Cacat ini tidak terlihat per soal, hanya terlihat
 * pada tingkat berkas — karena itu diperiksa di sini, bukan di validate.ts. */
const mcq = list.filter((q) => q?.type === "mcq_single" && Array.isArray(q.choices));
if (mcq.length >= 8) {
  const tally = {};
  for (const q of mcq) tally[q.answer?.value] = (tally[q.answer?.value] ?? 0) + 1;
  const letters = Object.keys(tally).sort();
  const top = letters.reduce((a, b) => (tally[a] >= tally[b] ? a : b));
  const share = tally[top] / mcq.length;
  const line = letters.map((l) => `${l}=${tally[l]} (${(100 * tally[l] / mcq.length).toFixed(0)}%)`).join("  ");

  console.log(`\nSebaran kunci  : ${line}`);
  if (share > 0.45) {
    console.log(`  ⚠ ${(100 * share).toFixed(0)}% kunci ada di opsi ${top}. Siswa bisa menebak tanpa membaca.`);
    console.log("    Jalankan: node scripts/balance-keys.mjs --write");
  }
}

console.log("\nCatatan: validator ini tidak bisa memastikan kunci jawaban benar secara matematis.");
console.log("Selalu jalankan prompts/_shared/review.md dan tinjauan guru sebelum soal dipakai.");

process.exit(report.blockers > 0 ? 1 : 0);
