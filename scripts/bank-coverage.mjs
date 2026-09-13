/* =========================================================================
 * Ukur bank soal: isi per section, sebaran kesulitan, dan berapa banyak soal
 * yang TERULANG antara dua percobaan berbeda.
 *
 * Angka «terulang» itulah janji paket kepada pembeli. Paket menjual 2–10
 * percobaan; kalau dua percobaan berbagi 90% soal, yang dijual sebenarnya
 * satu percobaan.
 *
 * Berjalan di atas salinan data, jadi tidak pernah menyentuh .data yang
 * sedang dipakai.
 *
 *   node --experimental-strip-types --import ./scripts/alias-register.mjs scripts/bank-coverage.mjs
 * ========================================================================= */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/* EXACT_DATA_DIR yang sudah disetel pemanggil dihormati — itulah cara mengukur
 * bank lain, misalnya salinan yang seluruh soal barunya dianggap sudah
 * disetujui. Tanpa itu, skrip ini menyalin .data dan mengukur salinannya. */
if (!process.env.EXACT_DATA_DIR) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "exact-cakupan-"));
  for (const f of ["db.json", "question-bank.json"]) {
    const asal = path.join(process.cwd(), ".data", f);
    if (fs.existsSync(asal)) fs.copyFileSync(asal, path.join(tmp, f));
  }
  process.env.EXACT_DATA_DIR = tmp;
}

const { composeLayout, seenQuestionIds } = await import("@/lib/exams/formBuilder");
const { approvedPool } = await import("@/lib/exams/bank");
const { getBlueprint, EXAM_LIST } = await import("@/lib/exams/blueprints");

/* Daftar ujian diambil dari blueprint, bukan ditulis ulang di sini.
 * Sebelumnya daftar ini dikunci empat nama, sehingga ujian baru diam-diam
 * tidak pernah terukur — laporan tetap terlihat lengkap padahal ada bank
 * yang tidak pernah diperiksa sama sekali. */
const EXAMS = EXAM_LIST.map((b) => b.code);
const RONDE = 40;
const URUT = 6;          // paket berturut-turut untuk satu peserta

const pct = (n) => `${(n * 100).toFixed(0)}%`;

for (const exam of EXAMS) {
  const bp = getBlueprint(exam);
  const pool = await approvedPool(exam);
  if (!bp) continue;

  console.log(`\n${exam} — ${pool.length} soal di bank`);
  console.log("  section              punya  /form  rasio  E/M/H");

  let perAttempt = 0;
  for (const s of bp.sections) {
    const mine = pool.filter((q) => q.section === s.code);
    /* Modul adaptif memakan DUA kali jatahnya: varian mudah dan varian sulit
     * sama-sama disusun dan dibekukan bersama attempt. */
    const need = s.questionCount * (s.adaptive?.module === 2 ? 2 : 1);
    perAttempt += need;
    const d = { E: 0, M: 0, H: 0 };
    for (const q of mine) d[q.difficulty] = (d[q.difficulty] ?? 0) + 1;
    const rasio = need ? (mine.length / need).toFixed(1) : "—";
    console.log(
      `  ${s.code.padEnd(20)} ${String(mine.length).padStart(5)}  ${String(need).padStart(5)}` +
      `  ${rasio.padStart(5)}×  ${d.E}/${d.M}/${d.H}`,
    );
  }

  // Berapa soal yang sama antara dua percobaan berbeda, diukur pada HIMPUNAN
  // id seluruh paket — urutan bagian bisa berbeda, jadi membandingkan per
  // posisi akan membandingkan bagian yang tidak sama.
  let jumlah = 0;
  for (let i = 0; i < RONDE; i++) {
    const a = new Set((await composeLayout(exam, `ukur-a-${i}`)).flatMap((s) => s.questionIds));
    const b = new Set((await composeLayout(exam, `ukur-b-${i}`)).flatMap((s) => s.questionIds));
    if (!a.size || !b.size) continue;
    let sama = 0;
    for (const id of a) if (b.has(id)) sama++;
    jumlah += sama / a.size;
  }
  console.log(`  dipakai per percobaan: ${perAttempt} · terulang antar percobaan: ${pct(jumlah / RONDE)}`);

  /* Angka di atas membandingkan DUA PERCOBAAN ACAK, dan itu bukan yang dialami
   * pembeli. Ia mengerjakan paket pertama, lalu paket kedua — yang penting
   * baginya adalah berapa soal yang belum pernah ia lihat SENDIRI.
   *
   * Di bawah ini disimulasikan satu peserta yang mengerjakan enam paket
   * berturut-turut, dengan dan tanpa pendahuluan soal yang belum terlihat.
   * Peserta diasumsikan selalu masuk ke varian sulit pada modul adaptif. */
  const jalankan = async (pakaiRiwayat) => {
    const seen = new Set();
    const baris = [];
    for (let i = 1; i <= URUT; i++) {
      const layout = await composeLayout(exam, `urut-${exam}-${i}`, 1, pakaiRiwayat ? seen : undefined);
      const dilihat = seenQuestionIds(layout, Object.fromEntries(
        layout.filter((s) => s.variant).map((s) => [s.code, "harder"]),
      ));
      if (!dilihat.length) break;
      const baru = dilihat.filter((id) => !seen.has(id)).length;
      baris.push(baru / dilihat.length);
      for (const id of dilihat) seen.add(id);
    }
    return { baris, unik: seen.size };
  };

  const lama = await jalankan(false);
  const baru = await jalankan(true);
  console.log(`  soal baru per paket berturut-turut (paket 1..${URUT})`);
  console.log(`    tanpa riwayat : ${lama.baris.map(pct).join("  ")}   → ${lama.unik} soal berbeda`);
  console.log(`    dengan riwayat: ${baru.baris.map(pct).join("  ")}   → ${baru.unik} soal berbeda`);

  /* Berapa paket yang benar-benar BERBEDA yang bisa dijual dengan jujur:
   * paket berturut-turut yang seluruh soalnya belum pernah dilihat. */
  const penuh = baru.baris.findIndex((x) => x < 1);
  console.log(`    paket sepenuhnya baru: ${penuh === -1 ? URUT + "+" : penuh}`);
}
