/* =========================================================================
 * Uji jalur ujian: kuota, akomodasi waktu, pemulihan jawaban, penilaian.
 *
 * Ditulis setelah audit menemukan empat cacat yang seluruhnya lolos karena
 * tidak ada satu pun yang memeriksanya: kuota tidak ditegakkan di driver
 * berkas, jawaban hilang dari layar setelah memuat ulang, attempt yang
 * ditinggalkan tidak pernah dinilai, dan peserta A Level yang sempurna hanya
 * memperoleh 73%. Semuanya cacat perilaku, bukan cacat tipe — TypeScript
 * meloloskan keempatnya.
 *
 * Berjalan di atas salinan data (EXACT_DATA_DIR), jadi tidak pernah menyentuh
 * .data yang sedang dipakai.
 *
 *   npm run test:exams
 * ========================================================================= */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/* --- Siapkan data terpisah SEBELUM modul aplikasi dimuat pertama kali. --- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "exact-uji-"));
fs.mkdirSync(tmp, { recursive: true });
for (const f of ["db.json", "question-bank.json"]) {
  const asal = path.join(process.cwd(), ".data", f);
  if (fs.existsSync(asal)) fs.copyFileSync(asal, path.join(tmp, f));
}
/* Bank uji = berkas soal di repo (semua approved, supaya paket SAT/A Level
 * bisa disusun penuh), ditimpa isi bank .data bila ada. Dulu bank .data
 * dipakai apa adanya — begitu berisi beberapa soal latihan saja, uji paket
 * SAT gagal karena banknya nyaris kosong. */
{
  const byId = new Map();
  for (const dir of ["question-bank", "sample-tests"]) {
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json"))) {
      const isi = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      for (const q of Array.isArray(isi) ? isi : [isi]) byId.set(q.id, { ...q, _status: "approved" });
    }
  }
  const salinan = path.join(tmp, "question-bank.json");
  if (fs.existsSync(salinan)) for (const q of JSON.parse(fs.readFileSync(salinan, "utf8"))) byId.set(q.id, q);
  fs.writeFileSync(salinan, JSON.stringify([...byId.values()]));
}
process.env.EXACT_DATA_DIR = tmp;

const { getDb } = await import("@/lib/db");
const { devAuth } = await import("@/lib/db/dev");
const { composeLayout, normalizeMultiplier, seenQuestionIds } = await import("@/lib/exams/formBuilder");
const { getBlueprint } = await import("@/lib/exams/blueprints");
const { evaluate, MathExprError } = await import("@/lib/mathexpr.ts");
const { DICTIONARIES, LOCALES } = await import("@/lib/i18n/dictionaries.ts");
const { sectionsOf } = await import("@/lib/exams/attempt");
const { finalizeStale, finalizeIfExpired, regradeAttempt } = await import("@/lib/exams/finalize");
const { clampRubricAwards } = await import("@/lib/exams/grade");
const { questionsByIds, importQuestions } = await import("@/lib/exams/bank");
const { applyHighlights } = await import("@/lib/exams/highlight");

const approvedPoolAny = async () => (await (await import("@/lib/exams/bank")).approvedPool("SAT")).map((q) => q.id);
let lulus = 0, gagal = 0;
const ok = (nama, syarat, catatan = "") => {
  if (syarat) { lulus++; console.log(`  \x1b[32m✓\x1b[0m ${nama}`); }
  else { gagal++; console.log(`  \x1b[31m✗\x1b[0m ${nama}${catatan ? ` — ${catatan}` : ""}`); }
};
const bagian = (t) => console.log(`\n${t}`);

/* Peserta uji dibuat sendiri: di clone bersih .data belum ada, dan meminjam
 * users[0] dari salinan data membuat uji bergantung pada isi data dev. */
const uid = (await devAuth.upsertUser({ email: "uji-peserta@contoh.test", fullName: "Peserta Uji", phone: "" })).id;
let nKuota = 0;
async function beriKuota(exam, jumlah = 1) {
  const d = await devAuth.read();
  d.entitlements.push({ id: `uji-ent-${nKuota++}`, userId: uid, exam, attemptsTotal: jumlah, attemptsUsed: 0 });
  await devAuth.write(d);
}
async function buatAttempt(exam, { mult = 1, seed = String(nKuota) } = {}) {
  const layout = await composeLayout(exam, `uji-${exam}-${seed}`, mult);
  return getDb().createAttempt({
    userId: uid, exam, formTitle: exam, isDemo: false, formLayout: layout, timeMultiplier: mult,
  });
}
const kunci = (a) => a.mode === "numeric_list"
  ? Object.fromEntries(a.values.map((v) => [v.key, v.value]))
  : a.mode === "rubric" ? "Uraian jawaban peserta." : a.value;

async function kerjakan(at, { benar = true } = {}) {
  const secs = await sectionsOf(at);
  for (const s of secs) {
    await getDb().startSection(at.id, secs.indexOf(s), { code: s.code, durationSec: s.durationSec });
    const j = {};
    for (const q of s.questions) {
      j[q.id] = { questionId: q.id, raw: benar ? kunci(q.answer) : "Z", visited: true, timeSpentSec: 5 };
    }
    await getDb().saveResponses(at.id, s.code, j);
  }
  return secs;
}
async function lewatkanTenggat(id) {
  const d = await devAuth.read();
  const a = d.attempts.find((x) => x.id === id);
  for (const k of Object.keys(a.sectionDeadlines)) {
    a.sectionDeadlines[k] = new Date(Date.now() - 3600e3).toISOString();
  }
  await devAuth.write(d);
}

/* ------------------------------------------------------------------ kuota */
bagian("Kuota try out");
{
  const d = await devAuth.read();
  d.entitlements = d.entitlements.filter((e) => e.userId !== uid);
  await devAuth.write(d);

  let ditolak = false;
  try { await buatAttempt("SAT"); } catch { ditolak = true; }
  ok("tanpa entitlement, attempt ditolak", ditolak);

  await beriKuota("SAT", 1);
  const a = await buatAttempt("SAT", { seed: "kuota-a" });
  ok("dengan kuota tersisa, attempt dibuat", Boolean(a?.id));

  const ent = (await devAuth.read()).entitlements.find((e) => e.userId === uid && e.exam === "SAT");
  ok("kuota terpakai satu", ent.attemptsUsed === 1, `attemptsUsed=${ent.attemptsUsed}`);

  let ditolak2 = false;
  try { await buatAttempt("SAT", { seed: "kuota-b" }); } catch { ditolak2 = true; }
  ok("kuota habis, attempt berikutnya ditolak", ditolak2);

  const kedaluwarsa = await devAuth.read();
  kedaluwarsa.entitlements.push({
    id: "uji-ent-lewat", userId: uid, exam: "UTBK", attemptsTotal: 5, attemptsUsed: 0,
    expiresAt: new Date(Date.now() - 864e5).toISOString(),
  });
  await devAuth.write(kedaluwarsa);
  let ditolak3 = false;
  try { await buatAttempt("UTBK", { seed: "lewat" }); } catch { ditolak3 = true; }
  ok("entitlement kedaluwarsa tidak dipakai", ditolak3);
}

/* --------------------------------------------------------- akomodasi waktu */
bagian("Akomodasi waktu");
{
  for (const bad of [1.7, 3, 0, -1, "banyak", null, undefined]) {
    if (normalizeMultiplier(bad) !== 1) ok(`pengali ${JSON.stringify(bad)} ditolak`, false);
  }
  ok("pengali di luar 1 / 1,5 / 2 dinormalkan ke 1", true);
  ok("1,5 dan 2 diterima apa adanya", normalizeMultiplier(1.5) === 1.5 && normalizeMultiplier(2) === 2);

  await beriKuota("SAT", 3);
  const normal = await buatAttempt("SAT", { mult: 1, seed: "akom-1" });
  const ganda = await buatAttempt("SAT", { mult: 2, seed: "akom-2" });
  const dNormal = (await sectionsOf(normal))[0].durationSec;
  const dGanda = (await sectionsOf(ganda))[0].durationSec;
  ok("pengali 2 menggandakan durasi", dGanda === dNormal * 2, `${dNormal} → ${dGanda}`);
  ok("durasi bulat menit", dGanda % 60 === 0);
  ok("pengali tercatat di attempt", ganda.timeMultiplier === 2);

  // dibekukan: mengubah hak peserta tidak menggeser ujian yang berjalan
  const s0 = (await sectionsOf(normal))[0];
  await getDb().startSection(normal.id, 0, { code: s0.code, durationSec: s0.durationSec });
  const dl = (await getDb().getAttempt(normal.id)).sectionDeadlines[s0.code];
  await getDb().setTimeMultiplier(uid, 2);
  const setelah = await getDb().getAttempt(normal.id);
  ok("menaikkan akomodasi tidak menggeser tenggat yang berjalan",
    setelah.sectionDeadlines[s0.code] === dl);
  ok("durasi attempt berjalan tidak berubah",
    (await sectionsOf(setelah))[0].durationSec === dNormal);
  await getDb().setTimeMultiplier(uid, 1);
}

/* ------------------------------------------------- pemulihan jawaban */
bagian("Pemulihan jawaban setelah memuat ulang");
{
  await beriKuota("SAT", 1);
  const at = await buatAttempt("SAT", { seed: "pulih" });
  const secs = await sectionsOf(at);
  const s0 = secs[0];
  await getDb().startSection(at.id, 0, { code: s0.code, durationSec: s0.durationSec });
  const j = {};
  for (const q of s0.questions.slice(0, 3)) j[q.id] = { questionId: q.id, raw: "B", visited: true, timeSpentSec: 9 };
  await getDb().saveResponses(at.id, s0.code, j);

  const fresh = await getDb().getAttempt(at.id);
  const terlihat = new Set((await sectionsOf(fresh))[0].questions.map((q) => q.id));
  const dipulihkan = Object.entries(fresh.responses ?? {}).filter(([qid]) => terlihat.has(qid));
  ok("jawaban tersimpan dipulihkan", dipulihkan.length === 3, `${dipulihkan.length} dari 3`);

  // autosave dengan state kosong TIDAK boleh menghapus yang tersimpan
  await getDb().saveResponses(at.id, s0.code, {});
  const setelah = await getDb().getAttempt(at.id);
  ok("menyimpan objek kosong tidak menghapus jawaban",
    Object.keys(setelah.responses ?? {}).length === 3);
}

/* ------------------------------------------- attempt yang ditinggalkan */
bagian("Attempt yang ditinggalkan");
{
  await beriKuota("SAT", 2);
  const belum = await buatAttempt("SAT", { seed: "tinggal-a" });
  const s = await sectionsOf(belum);
  await getDb().startSection(belum.id, 0, { code: s[0].code, durationSec: s[0].durationSec });
  ok("section berikutnya belum dimulai → belum ditutup",
    (await finalizeIfExpired(await getDb().getAttempt(belum.id))) === null);

  const habis = await buatAttempt("SAT", { seed: "tinggal-b" });
  await kerjakan(habis, { benar: true });
  await lewatkanTenggat(habis.id);
  const skor = await finalizeIfExpired(await getDb().getAttempt(habis.id));
  const rec = await getDb().getAttempt(habis.id);
  ok("seluruh tenggat lewat → ditutup dan dinilai", Boolean(skor) && rec.status === "submitted");
  ok("dinilai dari jawaban tersimpan", skor.total > 0, `total=${skor?.total}`);
}

/* -------------------------------------------------- rentang skor tiap ujian */
bagian("Rentang skor");
{
  const harap = { SAT: [400, 1600], UTBK: [100, 1000], CSCA: [0, 100], ALEVEL: [0, 100] };
  for (const exam of ["SAT", "UTBK", "CSCA", "ALEVEL"]) {
    await beriKuota(exam, 2);
    const kosong = await buatAttempt(exam, { seed: `skor-0-${exam}` });
    await kerjakan(kosong, { benar: false });
    await lewatkanTenggat(kosong.id);
    const sKosong = await finalizeStale(await getDb().getAttempt(kosong.id));

    const penuh = await buatAttempt(exam, { seed: `skor-1-${exam}` });
    await kerjakan(penuh, { benar: true });
    await lewatkanTenggat(penuh.id);
    const sPenuh = await finalizeStale(await getDb().getAttempt(penuh.id));

    const [lo, hi] = harap[exam];
    ok(`${exam}: skor dalam rentang ${lo}–${hi}`,
      sKosong.total >= lo && sPenuh.total <= hi && sPenuh.total > sKosong.total,
      `kosong=${sKosong.total} penuh=${sPenuh.total}`);
  }
}

/* --------------------------------------------------------- penilaian esai */
bagian("Penilaian esai");
{
  for (const [nama, masuk, harap] of [
    ["melebihi maksimum dijepit", [99, 99, 99], 5],
    ["negatif jadi nol", [-5, -5, -5], 0],
    ["bukan angka jadi nol", ["banyak", 1, 1], 2],
    ["bukan array jadi nol", "5", 0],
    ["kelebihan elemen diabaikan", [2, 2, 1, 99], 5],
  ]) {
    const r = [{ criterion: "A", points: 2 }, { criterion: "B", points: 2 }, { criterion: "C", points: 1 }];
    ok(`poin rubrik: ${nama}`, clampRubricAwards(r, masuk).total === harap);
  }

  await beriKuota("ALEVEL", 1);
  const at = await buatAttempt("ALEVEL", { seed: "esai" });
  await kerjakan(at, { benar: true });
  await lewatkanTenggat(at.id);
  const sebelum = await finalizeStale(await getDb().getAttempt(at.id));
  ok("esai belum dinilai dikeluarkan dari skor, bukan dianggap salah",
    sebelum.total === 100 && (sebelum.pendingManual?.count ?? 0) > 0,
    `total=${sebelum.total} menunggu=${sebelum.pendingManual?.count ?? 0}`);

  const rec = await getDb().getAttempt(at.id);
  const antre = await getDb().attemptsAwaitingMarks(20);
  ok("attempt masuk antrean penilai", antre.some((a) => a.id === at.id));

  const bank = await questionsByIds(rec.pendingRubric ?? []);
  for (const qid of rec.pendingRubric ?? []) {
    const q = bank.get(qid);
    const { awarded, total } = clampRubricAwards(q.answer.rubric, q.answer.rubric.map(() => 0));
    await getDb().setRubricMark(at.id, qid, {
      awarded, total, comment: "nol untuk uji", by: "uji@contoh.test", at: new Date().toISOString(),
    });
  }
  const sesudah = await regradeAttempt(at.id);
  ok("setelah dinilai, esai ikut dihitung", (sesudah.pendingManual?.count ?? 0) === 0);
  ok("nilai nol pada esai menurunkan skor", sesudah.total < sebelum.total,
    `${sebelum.total} → ${sesudah.total}`);
  ok("antrean kosong setelah semua dinilai",
    !(await getDb().attemptsAwaitingMarks(20)).some((a) => a.id === at.id));
}

/* ------------------------------------- tulisan bersamaan ke berkas data */
bagian("Tulisan bersamaan (dua tab ujian)");
{
  const d0 = await devAuth.read();
  d0.entitlements = d0.entitlements.filter((e) => !(e.userId === uid && e.exam === "UTBK"));
  d0.entitlements.push({ id: "uji-ent-tabrak", userId: uid, exam: "UTBK", attemptsTotal: 2, attemptsUsed: 0 });
  await devAuth.write(d0);

  const buka = async (seed) => {
    const at = await buatAttempt("UTBK", { seed });
    const s = (await sectionsOf(at))[0];
    await getDb().startSection(at.id, 0, { code: s.code, durationSec: s.durationSec });
    return { at, s };
  };
  const t1 = await buka("tabrak-1");
  const t2 = await buka("tabrak-2");

  const tugas = [];
  for (let i = 0; i < 30; i++) {
    for (const t of [t1, t2]) {
      const j = {};
      for (const q of t.s.questions.slice(0, 5)) {
        j[q.id] = { questionId: q.id, raw: `putaran-${i}`, visited: true, timeSpentSec: i };
      }
      tugas.push(getDb().saveResponses(t.at.id, t.s.code, j));
    }
  }
  await Promise.all(tugas);

  let sah = true;
  try { JSON.parse(fs.readFileSync(path.join(tmp, "db.json"), "utf8")); } catch { sah = false; }
  ok("60 penyimpanan bersamaan tidak merusak berkas", sah);

  const a1 = await getDb().getAttempt(t1.at.id);
  const a2 = await getDb().getAttempt(t2.at.id);
  ok("kedua attempt bertahan", Boolean(a1 && a2));
  ok("jawaban kedua tab tidak saling menimpa",
    Object.keys(a1?.responses ?? {}).length === 5 && Object.keys(a2?.responses ?? {}).length === 5,
    `tab1=${Object.keys(a1?.responses ?? {}).length} tab2=${Object.keys(a2?.responses ?? {}).length}`);

  const ent = (await devAuth.read()).entitlements.find((e) => e.id === "uji-ent-tabrak");
  ok("kuota terpakai tepat dua, tidak ada yang hilang", ent.attemptsUsed === 2, `attemptsUsed=${ent.attemptsUsed}`);

  // berkas rusak TIDAK boleh dibaca sebagai basis data kosong
  const cadangan = fs.readFileSync(path.join(tmp, "db.json"), "utf8");
  fs.writeFileSync(path.join(tmp, "db.json"), cadangan + "}");
  let melempar = false;
  try { await getDb().getAttempt(t1.at.id); } catch { melempar = true; }
  ok("berkas rusak melempar galat, bukan dianggap kosong", melempar);
  fs.writeFileSync(path.join(tmp, "db.json"), cadangan);
}

/* ------------------------------------------------------- sorotan bacaan */
bagian("Penyorot bacaan");
{
  const terbaca = (h) => h.replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

  for (const [nama, html, spans, harap] of [
    ["dalam satu paragraf",      "<p>Tenun ikat NTT</p>",                  [{ start: 6, end: 10 }], "ikat"],
    ["melintasi <strong>",       "<p>Tenun <strong>ikat</strong> NTT</p>", [{ start: 0, end: 10 }], "Tenun ikat"],
    ["melintasi dua paragraf",   "<p>Satu dua</p><p>tiga empat</p>",       [{ start: 5, end: 12 }], "duatiga"],
    ["dua sorotan terpisah",     "<p>abc def ghi</p>",                     [{ start: 0, end: 3 }, { start: 8, end: 11 }], "abcghi"],
    ["entitas dihitung satu",    "<p>A &amp; B kata</p>",                  [{ start: 6, end: 10 }], "kata"],
    ["tanpa sorotan",            "<p>tetap sama</p>",                      [],                      ""],
  ]) {
    const hasil = applyHighlights(html, spans);
    const didalam = [...hasil.matchAll(/<mark[^>]*>([\s\S]*?)<\/mark>/g)].map((m) => terbaca(m[1])).join("");
    const utuh = terbaca(hasil) === terbaca(html);
    const seimbang = (hasil.match(/<mark/g) ?? []).length === (hasil.match(/<\/mark>/g) ?? []).length;
    ok(`sorotan: ${nama}`, didalam === harap && utuh && seimbang,
      `tersorot=${JSON.stringify(didalam)} harap=${JSON.stringify(harap)}${utuh ? "" : " TEKS BERUBAH"}${seimbang ? "" : " TAG TIMPANG"}`);
  }
}

/* ------------------------------------------------------ keamanan sesi */
bagian("Mengakhiri seluruh sesi");
{
  const d0 = await devAuth.read();
  const aku = d0.users[0].id, lain = d0.users[1].id;
  d0.sessions = [];
  await devAuth.write(d0);

  const t1 = await devAuth.createSession(aku);
  const t2 = await devAuth.createSession(aku);
  await devAuth.createSession(aku);
  const tLain = await devAuth.createSession(lain);

  ok("sesi berlaku sebelum diakhiri", Boolean(await devAuth.userByToken(t1)));
  const n = await devAuth.dropAllSessions(aku);
  ok("seluruh sesi milik pengguna itu diakhiri", n === 3, `diakhiri ${n}`);
  ok("token lama tidak berlaku lagi",
    !(await devAuth.userByToken(t1)) && !(await devAuth.userByToken(t2)));
  ok("sesi pengguna LAIN tidak ikut terputus", Boolean(await devAuth.userByToken(tLain)));

  // sesi kedaluwarsa tidak boleh dianggap berlaku
  const dd = await devAuth.read();
  dd.sessions.push({ token: "kedaluwarsa", userId: aku, expiresAt: Date.now() - 1000 });
  await devAuth.write(dd);
  ok("sesi kedaluwarsa ditolak", !(await devAuth.userByToken("kedaluwarsa")));
}

/* ------------------------------------------------------- kata sandi & masuk */
bagian("Kata sandi dan masuk");
{
  const crypto = await import("node:crypto");
  const { hashPw, cocokPw } = await import("@/lib/db/dev");

  const h1 = hashPw("rahasia123");
  ok("hash berformat scrypt", h1.startsWith("scrypt$"));
  ok("sandi sama menghasilkan hash berbeda (bergaram)", hashPw("rahasia123") !== h1);
  ok("sandi benar cocok", cocokPw("rahasia123", h1));
  ok("sandi salah ditolak", !cocokPw("rahasia124", h1));

  // hash lama (SHA-256) harus tetap bisa diperiksa, kalau tidak orang terkunci
  const lama = crypto.createHash("sha256").update("sandiLama!" + "::exact").digest("hex");
  ok("hash lama masih bisa diperiksa", cocokPw("sandiLama!", lama));
  ok("sandi salah terhadap hash lama ditolak", !cocokPw("bukan", lama));

  /* Uji masuk yang sesungguhnya. Ada karena pembungkus antrean driver sempat
   * menghilangkan `this`, sehingga login() melempar — dan tidak ada satu pun
   * yang menangkapnya sampai uji ini ditulis. */
  const dd = await devAuth.read();
  const orang = dd.users[0];
  orang.passwordHash = lama;
  orang.passwordSet = true;
  await devAuth.write(dd);

  const masuk = await devAuth.login(orang.email, "sandiLama!");
  ok("bisa masuk dengan sandi berhash lama", Boolean(masuk));
  const setelah = (await devAuth.read()).users[0].passwordHash;
  ok("hash ditingkatkan ke scrypt setelah masuk", setelah.startsWith("scrypt$"), setelah.slice(0, 12));
  ok("masuk lagi dengan sandi sama tetap berhasil", Boolean(await devAuth.login(orang.email, "sandiLama!")));
  ok("sandi salah ditolak saat masuk", !(await devAuth.login(orang.email, "salah")));
  ok("email tidak dikenal ditolak", !(await devAuth.login("bukan-siapa-siapa@contoh.test", "apa pun")));
}

/* ------------------------------------- impor vs attempt yang sedang jalan */
bagian("Impor tidak boleh menimpa soal yang sedang dikerjakan");
{
  await beriKuota("SAT", 1);
  const at = await buatAttempt("SAT", { seed: "inflight" });

  /* Diambil dari sectionsOf, bukan dari formLayout: paket SAT membekukan DUA
   * varian modul 2 sekaligus, dan hanya satu yang benar-benar dikerjakan.
   * Soal dari varian yang tidak terkirim tidak akan menggerakkan skor. */
  const asli = (await sectionsOf(at))
    .flatMap((s) => s.questions)
    .find((q) => q?.answer?.mode === "choice" && q.choices?.length >= 2);
  ok("ada soal pilihan ganda untuk diuji", Boolean(asli), asli?.id);

  // Soal yang tidak dipakai attempt mana pun tetap boleh diimpor.
  let bebas = true, kenapa = "";
  try { await importQuestions([{ ...asli, id: `${asli.id}-uji-salinan` }], "draft"); }
  catch (e) { bebas = false; kenapa = e.message; }
  ok("impor soal yang tidak dipakai tetap boleh", bebas, kenapa.slice(0, 90));

  // Soal yang sedang dikerjakan ditolak.
  let ditolak = false, pesan = "";
  try { await importQuestions([asli], "approved"); } catch (e) { ditolak = true; pesan = e.message; }
  ok("impor soal yang sedang dikerjakan ditolak", ditolak);
  ok("pesan penolakan menyebut id soalnya", pesan.includes(asli.id), pesan.slice(0, 90));

  /* Mengapa penjagaan itu ada. Dengan force, impor menukar teks antar huruf
   * persis seperti balance-keys: opsi kunci pindah slot dan answer.value ikut
   * bergeser. Peserta sudah menyimpan huruf lamanya dan tidak menyentuh apa
   * pun — jawabannya tetap berubah. */
  const kunciLama = asli.answer.value;
  const lain = asli.choices.find((c) => c.id !== kunciLama).id;
  const teks = Object.fromEntries(asli.choices.map((c) => [c.id, c.text]));
  const ditukar = {
    ...asli,
    choices: asli.choices.map((c) =>
      c.id === kunciLama ? { ...c, text: teks[lain] } : c.id === lain ? { ...c, text: teks[kunciLama] } : c),
    answer: { ...asli.answer, value: lain },
  };

  await kerjakan(at, { benar: true });
  await lewatkanTenggat(at.id);
  const mentah = (r) => r.sections.reduce((s, x) => s + x.raw, 0);
  const sebelum = await finalizeStale(await getDb().getAttempt(at.id));

  await importQuestions([ditukar], "approved", { force: true });
  const sesudah = await regradeAttempt(at.id);
  ok("menimpa soal yang berjalan MEMANG membalik nilai peserta — inilah yang dijaga",
    mentah(sesudah) === mentah(sebelum) - 1,
    `mentah ${mentah(sebelum)} → ${mentah(sesudah)}`);

  // Kembalikan soalnya supaya uji berikutnya tidak mewarisi bank yang rusak.
  await importQuestions([asli], "approved", { force: true });
}

/* ============================================ Paket kedua tidak mengulang */
bagian("Soal yang sudah dilihat tidak diulang di paket berikutnya");
{
  /* Paket menjual 2–10 percobaan. Kalau percobaan kedua mengulang separuh
   * soal percobaan pertama, yang dijual sebenarnya satu percobaan. */
  const exam = "UTBK";
  const bp = getBlueprint(exam);

  const satu = await composeLayout(exam, "riwayat-1");
  const dilihat = seenQuestionIds(satu);
  ok("paket pertama tersusun", dilihat.length > 0, `${dilihat.length} soal`);

  const tanpa = seenQuestionIds(await composeLayout(exam, "riwayat-2"));
  const tumpangTanpa = tanpa.filter((id) => dilihat.includes(id)).length;

  const dengan = seenQuestionIds(await composeLayout(exam, "riwayat-2", 1, dilihat));
  const tumpangDengan = dengan.filter((id) => dilihat.includes(id)).length;

  ok("tanpa riwayat, paket kedua memang mengulang", tumpangTanpa > 0,
    `${tumpangTanpa} soal terulang`);
  ok("dengan riwayat, paket kedua tidak mengulang satu soal pun", tumpangDengan === 0,
    `${tumpangDengan} soal terulang`);
  ok("paket kedua tetap utuh, bukan dipendekkan", dengan.length === tanpa.length,
    `${dengan.length} vs ${tanpa.length} soal`);

  /* Riwayat mendahulukan, bukan menyaring: begitu bank habis, paket harus
   * tetap tersusun penuh — lebih baik mengulang daripada memberi paket
   * setengah jadi. */
  const semua = (await composeLayout(exam, "riwayat-3")).flatMap((x) => x.questionIds);
  const habis = await composeLayout(exam, "riwayat-4", 1, [...dilihat, ...semua, ...tanpa]);
  const jumlah = habis.flatMap((x) => x.questionIds).length;
  const target = bp.sections.reduce((n, x) => n + x.questionCount, 0);
  ok("bank habis pun paket tetap tersusun penuh", jumlah === target,
    `${jumlah} dari ${target} soal`);

  /* Varian modul adaptif yang TIDAK dikerjakan belum pernah dilihat peserta. */
  const sat = await composeLayout("SAT", "riwayat-sat");
  const adaptif = sat.filter((x) => x.variant);
  const hanyaSulit = seenQuestionIds(sat, Object.fromEntries(adaptif.map((x) => [x.code, "harder"])));
  const semuanya = sat.flatMap((x) => x.questionIds);
  ok("varian adaptif yang tidak dikerjakan tidak dianggap sudah dilihat",
    adaptif.length === 0 || hanyaSulit.length < semuanya.length,
    `${hanyaSulit.length} dari ${semuanya.length}`);
}

/* ======================================== Kode ujian membuka paket */
bagian("Kode ujian: hanya peserta yang bisa membuka paket");
{
  const { savePaket, gabungPaket, bolehBuka, paketUntuk, getPaket } = await import("@/lib/practice/paket");
  const qid = (await approvedPoolAny())[0];
  const p = await savePaket({ judul: "Paket uji kode", mapel: "Uji", kelas: "", topik: "", questionIds: [qid],
    durasiMenit: 10, sumber: "bank", terbit: true, oleh: "uji" });
  const murid = { id: uid, role: "student" };
  ok("murid belum bergabung tidak boleh membuka", !bolehBuka(murid, p));
  ok("paket belum tampil di Paket saya", !(await paketUntuk(murid)).some((x) => x.id === p.id));
  ok("kode salah ditolak", !(await gabungPaket("XXXXXX", uid)).ok);
  const g1 = await gabungPaket(p.kode.toLowerCase(), uid);
  ok("kode benar (huruf kecil pun) diterima", g1.ok && g1.baru);
  const g2 = await gabungPaket(p.kode, uid);
  ok("kode yang sama dua kali tidak menggandakan peserta", g2.ok && !g2.baru && (await getPaket(p.id)).peserta.length === 1);
  ok("setelah bergabung boleh membuka", bolehBuka(murid, await getPaket(p.id)));
  ok("paket tampil di Paket saya", (await paketUntuk(murid)).some((x) => x.id === p.id));
  // Worksheet menerbitkan ulang tanpa tahu daftar peserta — tidak boleh terhapus.
  const lama = await getPaket(p.id);
  const { peserta: _abaikan, ...tanpaPeserta } = lama;
  await savePaket({ ...tanpaPeserta, judul: "Paket uji kode (terbit ulang)" });
  ok("terbit ulang mempertahankan peserta", ((await getPaket(p.id)).peserta ?? []).includes(uid));
  await savePaket({ ...(await getPaket(p.id)), terbit: false });
  ok("paket ditutup guru tidak bisa dibuka murid", !bolehBuka(murid, await getPaket(p.id)));
  ok("paket ditutup tidak bisa di-join", !(await gabungPaket(p.kode, "murid-lain")).ok);
  ok("guru selalu boleh membuka", bolehBuka({ id: "g", role: "admin" }, await getPaket(p.id)));
}

/* ==================== Waktu habis, perbaikan, dan nilai setelah perbaikan */
bagian("Latihan: waktu habis ditutup otomatis, perbaikan hanya nomor yang salah");
{
  const { savePaket } = await import("@/lib/practice/paket");
  const { mulaiDariPaket, mulaiPerbaikan, statusPaket, tutupYangKedaluwarsa } = await import("@/lib/practice/latihan");
  const { approvedPool } = await import("@/lib/exams/bank");
  const pg = (await approvedPool("SAT")).filter((q) => q.answer?.mode === "choice" && typeof q.answer.value === "string").slice(0, 3);
  const p = await savePaket({ judul: "Paket uji perbaikan", mapel: "Uji", kelas: "", topik: "", questionIds: pg.map((q) => q.id),
    durasiMenit: 10, sumber: "bank", terbit: true, oleh: "uji" });
  const salahDari = (q) => (q.choices ?? []).find((c) => c.id !== q.answer.value)?.id;
  const jawab = (q, raw) => ({ questionId: q.id, raw, visited: true, timeSpentSec: 5 });
  const lewatkanTenggat = async (id) => {
    const d = await devAuth.read();
    const a = d.attempts.find((x) => x.id === id);
    a.sectionDeadlines = { latihan: new Date(Date.now() - 60_000).toISOString() };
    await devAuth.write(d);
  };

  const a1 = await mulaiDariPaket(uid, p);
  ok("attempt utama berwaktu sesuai paket & bertanda paketId",
    a1.formLayout[0].durationSec === 600 && a1.formLayout[0].paketId === p.id && !a1.formLayout[0].tanpaWaktu);
  await getDb().startSection(a1.id, 0, { code: "latihan", durationSec: 600 });
  // nomor 1 benar, nomor 2 salah, nomor 3 dibiarkan kosong
  await getDb().saveResponses(a1.id, "latihan", { [pg[0].id]: jawab(pg[0], pg[0].answer.value), [pg[1].id]: jawab(pg[1], salahDari(pg[1])) });
  await lewatkanTenggat(a1.id);
  const ditutup = await tutupYangKedaluwarsa(await getDb().attemptsOf(uid));
  const a1b = await getDb().getAttempt(a1.id);
  ok("waktu habis & tab ditinggal → ditutup otomatis", ditutup && a1b.status === "submitted");
  const st1 = await statusPaket(p, await getDb().attemptsOf(uid));
  ok("nilai awal: 1 dari 3 benar (kosong dihitung salah)", st1.nilaiAwal === 33 && st1.benarGabungan === 1, `nilaiAwal=${st1.nilaiAwal}`);
  ok("nomor yang masih salah = 2 dan 3", JSON.stringify(st1.masihSalah) === "[2,3]", JSON.stringify(st1.masihSalah));

  const pb = await mulaiPerbaikan(uid, p, await getDb().attemptsOf(uid));
  const lay = pb.formLayout[0];
  ok("perbaikan hanya berisi nomor yang salah", JSON.stringify(lay.questionIds) === JSON.stringify([pg[1].id, pg[2].id]));
  ok("perbaikan tanpa batas waktu", lay.tanpaWaktu === true && lay.perbaikan === true && lay.durationSec >= 7 * 86400);
  await getDb().startSection(pb.id, 0, { code: "latihan", durationSec: lay.durationSec });
  await getDb().saveResponses(pb.id, "latihan", { [pg[1].id]: jawab(pg[1], pg[1].answer.value), [pg[2].id]: jawab(pg[2], salahDari(pg[2])) });
  await lewatkanTenggat(pb.id);
  await tutupYangKedaluwarsa(await getDb().attemptsOf(uid));
  const st2 = await statusPaket(p, await getDb().attemptsOf(uid));
  ok("nilai naik setelah perbaikan (33 → 67), nilai awal tetap", st2.nilaiAwal === 33 && st2.nilaiAkhir === 67, `${st2.nilaiAwal}→${st2.nilaiAkhir}`);
  ok("tinggal nomor 3 yang salah", JSON.stringify(st2.masihSalah) === "[3]", JSON.stringify(st2.masihSalah));
  ok("riwayat mencatat 1 pengerjaan + 1 perbaikan, nomor perbaikan = nomor asli",
    st2.selesai.length === 1 && st2.perbaikan.length === 1 && JSON.stringify(st2.perbaikan[0].salah) === "[3]", JSON.stringify(st2.perbaikan[0]?.salah));

  const pb2 = await mulaiPerbaikan(uid, p, await getDb().attemptsOf(uid));
  await getDb().startSection(pb2.id, 0, { code: "latihan", durationSec: pb2.formLayout[0].durationSec });
  await getDb().saveResponses(pb2.id, "latihan", { [pg[2].id]: jawab(pg[2], pg[2].answer.value) });
  await lewatkanTenggat(pb2.id); await tutupYangKedaluwarsa(await getDb().attemptsOf(uid));
  const st3 = await statusPaket(p, await getDb().attemptsOf(uid));
  ok("semua benar → nilai 100, tidak ada yang tersisa", st3.nilaiAkhir === 100 && st3.masihSalah.length === 0);
  let tolak = false;
  try { await mulaiPerbaikan(uid, p, await getDb().attemptsOf(uid)); } catch { tolak = true; }
  ok("perbaikan ditolak bila semua sudah benar", tolak);
}

/* ============================== Galat kalkulator tidak berbahasa apa pun */
bagian("Evaluator melempar kode, bukan kalimat");
{
  /* Pesan galat kalkulator tampil di dalam ruang ujian, dan ruang itu bisa
   * berbahasa Inggris, Indonesia, atau Mandarin. Kalimat yang ditanam di
   * pustaka matematika tidak dapat diterjemahkan oleh siapa pun di hilir. */
  const kode = (src) => {
    try { evaluate(src); return null; }
    catch (e) { return e instanceof MathExprError ? e.code : `BUKAN-KODE:${e.message}`; }
  };

  ok("kurung tidak tertutup → kode", kode("2*(3+4") === "unclosedParen", kode("2*(3+4"));
  ok("karakter asing → kode", kode("2 # 3") === "unknownChar", kode("2 # 3"));
  ok("variabel tidak dikenal → kode", kode("2*zz") === "unknownVariable", kode("2*zz"));
  ok("ekspresi tidak lengkap → kode", kode("2+") === "incomplete", kode("2+"));
  ok("ekspresi sah tidak melempar", kode("2*(3+4)") === null);

  /* Setiap kode wajib punya terjemahan di KETIGA bahasa. TypeScript sudah
   * menjaga kelengkapannya, tetapi uji ini menangkap kunci yang dihapus dari
   * kamus tanpa menyentuh berkas TypeScript mana pun. */
  const KODE = ["unknownChar", "incomplete", "unclosedParen", "unclosedFuncParen",
                "unknownVariable", "unexpectedToken", "trailingTokens"];
  const kunci = (c) => "calc.err" + c[0].toUpperCase() + c.slice(1);
  const kurang = [];
  for (const c of KODE) {
    for (const l of LOCALES) {
      if (!DICTIONARIES[l]?.[kunci(c)]) kurang.push(`${l}:${kunci(c)}`);
    }
  }
  ok("setiap kode galat punya terjemahan di tiga bahasa", kurang.length === 0, kurang.join(", "));
  ok("pesan umum tersedia di tiga bahasa",
    LOCALES.every((l) => DICTIONARIES[l]?.["calc.errGeneric"]));
}

/* ------------------------------------------------------------------ tutup */
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
