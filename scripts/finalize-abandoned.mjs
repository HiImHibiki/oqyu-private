/* =========================================================================
 * Menutup attempt yang ditinggalkan.
 *
 * Attempt yang seluruh tenggatnya sudah lewat tetapi peserta tidak pernah
 * kembali akan berstatus `in_progress` selamanya: kuotanya sudah terpakai,
 * jawabannya tersimpan, tetapi nilainya tidak pernah keluar dan tidak pernah
 * muncul di halaman hasil maupun papan peringkat.
 *
 * Halaman ujian menutupnya sendiri kalau pesertanya kembali. Skrip ini untuk
 * yang tidak pernah kembali — jalankan berkala (cron harian sudah cukup).
 *
 * Dua aturan, sengaja dipisah:
 *   «tenggat habis» — SETIAP section sudah punya tenggat dan semuanya lewat.
 *                     Aman ditutup otomatis: tidak ada lagi yang bisa
 *                     dikerjakan. Halaman ujian memakai aturan ini sendiri.
 *   «basi»          — attempt dimulai lebih dari N hari lalu dan masih
 *                     terbuka. Ini KEPUTUSAN, bukan kesimpulan: peserta yang
 *                     baru memulai section 1 secara teknis masih bisa
 *                     melanjutkan section 2 kapan pun. Karena itu aturan ini
 *                     hanya berjalan bila diminta dengan --stale-days.
 *
 *   node --experimental-strip-types --import ./scripts/alias-register.mjs \
 *     scripts/finalize-abandoned.mjs                    # laporan saja
 *   … scripts/finalize-abandoned.mjs --write            # tutup yang tenggatnya habis
 *   … scripts/finalize-abandoned.mjs --stale-days 30 --write
 * ========================================================================= */

import { getDb } from "@/lib/db";
import { sectionsOf } from "@/lib/exams/attempt";
import { allSectionsExpired, finalizeStale } from "@/lib/exams/finalize";

const WRITE = process.argv.includes("--write");
const staleIdx = process.argv.indexOf("--stale-days");
const STALE_DAYS = staleIdx > -1 ? Number(process.argv[staleIdx + 1]) : null;
if (staleIdx > -1 && (!Number.isFinite(STALE_DAYS) || STALE_DAYS <= 0)) {
  console.error("--stale-days butuh angka hari yang positif");
  process.exit(1);
}

/* `recentAttempts` sudah ada di kedua driver dan mengembalikan semua status.
 * Batasnya dinaikkan: yang dicari justru attempt lama yang tidak pernah
 * ditutup, jadi 30 bawaan tidak cukup. */
const all = await getDb().recentAttempts(5000);

const now = Date.now();
const habis = [], basi = [];
for (const a of all) {
  if (a.status !== "in_progress") continue;
  const sections = await sectionsOf(a);
  if (allSectionsExpired(a, sections.map((s) => s.code))) { habis.push(a); continue; }
  if (STALE_DAYS !== null) {
    const umurHari = (now - new Date(a.startedAt).getTime()) / 864e5;
    if (umurHari > STALE_DAYS) basi.push(a);
  }
}

console.log(`attempt in_progress         : ${all.filter((a) => a.status === "in_progress").length}`);
console.log(`seluruh tenggat sudah lewat : ${habis.length}`);
if (STALE_DAYS !== null) console.log(`lebih tua dari ${STALE_DAYS} hari      : ${basi.length}`);

const target = [...habis, ...basi];
if (!target.length) { console.log("\nTidak ada yang perlu ditutup."); process.exit(0); }

for (const a of target) {
  const dijawab = Object.keys(a.responses ?? {}).length;
  const sebab = habis.includes(a) ? "tenggat habis" : `basi >${STALE_DAYS}h`;
  if (!WRITE) {
    console.log(`  ${a.id}  ${a.exam.padEnd(7)} ${String(dijawab).padStart(3)} jawaban  (${sebab})`);
    continue;
  }
  try {
    /* Attempt basi dinilai dengan jawaban tersimpan apa adanya, sama seperti
     * yang tenggatnya habis: section yang tidak pernah dibuka bernilai nol,
     * dan itu memang cerminan yang jujur dari apa yang dikerjakan. */
    const score = await finalizeStale(a);
    console.log(`  ✓ ${a.id}  ${a.exam.padEnd(7)} ${String(dijawab).padStart(3)} jawaban → total ${score?.total ?? "—"}  (${sebab})`);
  } catch (e) {
    console.error(`  ✗ ${a.id}: ${e instanceof Error ? e.message : e}`);
  }
}

console.log(WRITE ? "\nSelesai." : "\nUji coba saja — jalankan dengan --write untuk menutupnya.");
