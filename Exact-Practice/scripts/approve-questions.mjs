#!/usr/bin/env node
/**
 * Menyetujui soal secara massal.
 *
 *   node --env-file-if-exists=.env.local scripts/approve-questions.mjs --exam CSCA
 *   node ... scripts/approve-questions.mjs --exam CSCA --section csca_math --dry
 *
 * Mode Supabase : memperbarui public.questions
 * Mode berkas   : memperbarui .data/question-bank.json
 *
 * KAPAN INI PANTAS DIPAKAI
 *
 * Soal berstatus `in_review` tidak pernah masuk paket berbayar — approvedPool()
 * hanya mengambil yang `approved`. Jadi bank yang terlihat besar bisa saja
 * separuhnya tidak pernah dipakai, dan pembeli paket «6 try out» memperoleh
 * soal berulang bukan karena banknya kurang melainkan karena separuhnya
 * terkunci di antrean tinjauan.
 *
 * Skrip ini MELEWATI tinjauan manusia. Karena itu ia mencatat siapa yang
 * menjalankannya dan menandai `bulk: true` pada jejak tinjauan — supaya soal
 * yang lolos lewat jalan pintas masih bisa dibedakan dari soal yang benar-benar
 * dibaca orang, dan bisa ditinjau ulang belakangan lewat /admin/tinjauan.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const exam = flag("exam");
const section = flag("section");
const from = flag("from", "in_review");
const by = flag("by", process.env.APPROVER_EMAIL || "bulk-approval");
const dry = has("dry");

if (!exam && !section) {
  console.error(
    "Pemakaian: node scripts/approve-questions.mjs --exam CSCA [--section csca_math] [--from in_review] [--by email] [--dry]\n" +
    "Sebutkan setidaknya --exam atau --section; menyetujui SELURUH bank sekaligus terlalu mudah dilakukan tanpa sengaja.",
  );
  process.exit(2);
}

const review = {
  by,
  at: new Date().toISOString(),
  verdict: "correct",
  note: `Disetujui massal lewat scripts/approve-questions.mjs (${[exam, section, `dari ${from}`].filter(Boolean).join(", ")})`,
  bulk: true,
};

const cocok = (q, status) =>
  (!exam || q.exam === exam) &&
  (!section || q.section === section) &&
  (from === "any" || status === from);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (url && key) {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  let q = sb.from("questions").select("id,exam,section,status");
  if (exam) q = q.eq("exam", exam);
  if (section) q = q.eq("section", section);
  if (from !== "any") q = q.eq("status", from);

  const { data, error } = await q.limit(10000);
  if (error) { console.error("Gagal membaca:", error.message); process.exit(1); }
  const ids = (data ?? []).map((r) => r.id);
  report(data ?? [], (r) => r.section);
  if (dry || !ids.length) process.exit(0);

  /* Dipotong per 500 karena `in(...)` menaruh seluruh daftar id di URL, dan
   * daftar sepuluh ribu id melampaui batas panjang permintaan. */
  let n = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const { data: up, error: e2 } = await sb.from("questions")
      .update({ status: "approved", reviewed_at: review.at, review })
      .in("id", chunk).select("id");
    if (e2) { console.error("Gagal memperbarui:", e2.message); process.exit(1); }
    n += up?.length ?? 0;
  }
  console.log(`✓ ${n} soal disetujui di Supabase.`);
} else {
  const file = path.join(process.env.EXACT_DATA_DIR || path.join(process.cwd(), ".data"), "question-bank.json");
  if (!existsSync(file)) {
    console.error(`Tidak ada ${file}. Jalankan \`npm run import\` lebih dulu.`);
    process.exit(1);
  }
  const bank = JSON.parse(readFileSync(file, "utf8"));
  const kena = bank.filter((q) => cocok(q, q._status ?? "draft"));
  report(kena, (q) => q.section);
  if (dry || !kena.length) process.exit(0);

  for (const q of kena) {
    q._status = "approved";
    q._review = review;
    q.meta = { ...(q.meta ?? {}), reviewed: true };
  }
  writeFileSync(file, JSON.stringify(bank, null, 2));
  console.log(`✓ ${kena.length} soal disetujui di ${file}`);
}

function report(rows, keyOf) {
  const per = new Map();
  for (const r of rows) per.set(keyOf(r), (per.get(keyOf(r)) ?? 0) + 1);
  console.log(`${rows.length} soal cocok (${exam ?? "semua ujian"}${section ? ` / ${section}` : ""}, status ${from}):`);
  for (const [k, v] of [...per].sort()) console.log(`  ${String(k).padEnd(22)} ${v}`);
  if (dry) console.log("\n(--dry: tidak ada yang diubah)");
}
