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
process.env.EXACT_DATA_DIR = tmp;

const { getDb } = await import("@/lib/db");
const { devAuth } = await import("@/lib/db/dev");
const { composeLayout, normalizeMultiplier, seenQuestionIds } = await import("@/lib/exams/formBuilder");
const { getBlueprint } = await import("@/lib/exams/blueprints");
const { checkRefund } = await import("@/lib/refunds.ts");
const { settleRefund } = await import("@/lib/checkout.ts");
const { evaluate, MathExprError } = await import("@/lib/mathexpr.ts");
const { DICTIONARIES, LOCALES } = await import("@/lib/i18n/dictionaries.ts");
const { sectionsOf } = await import("@/lib/exams/attempt");
const { finalizeStale, finalizeIfExpired, regradeAttempt } = await import("@/lib/exams/finalize");
const { clampRubricAwards } = await import("@/lib/exams/grade");
const { questionsByIds, importQuestions } = await import("@/lib/exams/bank");
const { applyHighlights } = await import("@/lib/exams/highlight");

let lulus = 0, gagal = 0;
const ok = (nama, syarat, catatan = "") => {
  if (syarat) { lulus++; console.log(`  \x1b[32m✓\x1b[0m ${nama}`); }
  else { gagal++; console.log(`  \x1b[31m✗\x1b[0m ${nama}${catatan ? ` — ${catatan}` : ""}`); }
};
const bagian = (t) => console.log(`\n${t}`);

const uid = (await devAuth.read()).users[0].id;
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

/* --------------------------------------------------- komisi multi-mata-uang */
bagian("Komisi afiliasi lintas mata uang");
{
  const { commissionFor } = await import("@/lib/affiliate");
  const d = await devAuth.read();
  const aff = d.users[0].id, p1 = d.users[1].id, p2 = d.users[2].id;
  d.affiliates = [{ userId: aff, code: "UJIKOM", rate: 0.15, status: "active", createdAt: new Date().toISOString() }];
  d.commissions = []; d.payouts = [];
  d.referrals = [
    { id: "rk1", code: "UJIKOM", referredUserId: p1, createdAt: new Date().toISOString(), converted: false },
    { id: "rk2", code: "UJIKOM", referredUserId: p2, createdAt: new Date().toISOString(), converted: false },
  ];
  await devAuth.write(d);

  ok("komisi 15% dari Rp 349.000 = Rp 52.350", commissionFor(349_000, 0.15) === 52_350);
  ok("komisi 15% dari US$ 60 = US$ 9", commissionFor(60, 0.15) === 9);

  await getDb().createCommission({ affiliateUserId: aff, referredUserId: p1, orderId: "ok-1", amount: 52_350, currency: "IDR", rate: 0.15 });
  await getDb().createCommission({ affiliateUserId: aff, referredUserId: p2, orderId: "ok-2", amount: 9, currency: "USD", rate: 0.15 });
  const ulang = await getDb().createCommission({ affiliateUserId: aff, referredUserId: p1, orderId: "ok-1", amount: 999, currency: "IDR", rate: 0.15 });
  ok("komisi ganda untuk pesanan yang sama ditolak", ulang === null);

  const st = await getDb().affiliateStats(aff);
  const idr = st.balances.find((b) => b.currency === "IDR");
  const usd = st.balances.find((b) => b.currency === "USD");
  ok("saldo dipisah per mata uang", st.balances.length === 2, `balances=${JSON.stringify(st.balances)}`);
  ok("rupiah utuh, tidak tercampur", idr?.pending === 52_350, `IDR=${idr?.pending}`);
  ok("dolar utuh, tidak tercampur", usd?.pending === 9, `USD=${usd?.pending}`);
  ok("angka utama berasal dari SATU mata uang", st.pendingIdr === 52_350 && st.currency === "IDR",
    `${st.pendingIdr} ${st.currency}`);
  ok("tidak ada penjumlahan rupiah + dolar", st.pendingIdr !== 52_359, `pendingIdr=${st.pendingIdr}`);

  const ov = await getDb().adminOverview();
  ok("ringkasan admin: utang komisi rupiah hanya rupiah", ov.commissionOwedIdr === 52_350,
    `commissionOwedIdr=${ov.commissionOwedIdr}`);
  ok("ringkasan admin: mata uang lain dirinci terpisah", (ov.commissionOwed?.USD ?? 0) === 9,
    `commissionOwed=${JSON.stringify(ov.commissionOwed)}`);
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

/* ================================================ Pengembalian dana */
bagian("Pengembalian dana mencabut kuota dan membatalkan komisi");
{
  const db = getDb();

  const buatPesananLunas = async (jumlahKuota) => {
    const o = await db.createOrder({
      userId: uid, packageId: "utbk-starter", exam: "UTBK",
      amount: 149000, currency: "IDR", provider: "simulation",
    });
    await db.markOrderPaid(o.id, jumlahKuota, "uji-refund");
    return o;
  };
  const kuotaPesanan = async (orderId) =>
    (await db.entitlements(uid)).find((e) => e.orderId === orderId);

  /* --- kuota utuh: seluruh sisa dicabut --- */
  const o1 = await buatPesananLunas(3);
  const k1 = await kuotaPesanan(o1.id);
  ok("kuota tercatat atas pesanan itu", Boolean(k1) && k1.attemptsTotal === 3,
    k1 ? `total ${k1.attemptsTotal}` : "tidak ditemukan");

  const r1 = await db.refundOrder(o1.id);
  const k1b = await kuotaPesanan(o1.id);
  ok("status pesanan menjadi refunded", r1.order.status === "refunded", r1.order.status);
  ok("seluruh sisa kuota dicabut", r1.attemptsRevoked === 3 && k1b.attemptsTotal - k1b.attemptsUsed === 0,
    `dicabut ${r1.attemptsRevoked}, sisa ${k1b.attemptsTotal - k1b.attemptsUsed}`);

  /* --- kuota terpakai sebagian: yang terpakai TIDAK diutak-atik --- */
  const o2 = await buatPesananLunas(3);
  const k2 = await kuotaPesanan(o2.id);
  await beriKuota("UTBK", 0);                       // pastikan tidak ada kuota lain menyerap
  const d = await devAuth.read();
  d.entitlements.find((e) => e.id === k2.id).attemptsUsed = 1;
  await devAuth.write(d);

  const r2 = await db.refundOrder(o2.id);
  const k2b = await kuotaPesanan(o2.id);
  ok("hanya sisa yang dicabut, yang terpakai dibiarkan",
    r2.attemptsRevoked === 2 && k2b.attemptsUsed === 1 && k2b.attemptsTotal === 1,
    `dicabut ${r2.attemptsRevoked}, terpakai ${k2b.attemptsUsed}, total ${k2b.attemptsTotal}`);

  /* --- komisi afiliasi --- */
  const o3 = await buatPesananLunas(2);
  await db.createCommission({
    affiliateUserId: uid, referredUserId: uid, orderId: o3.id,
    amount: 22350, currency: "IDR", rate: 0.15,
  });
  const r3 = await db.refundOrder(o3.id);
  const komisi = (await db.commissionsOf(uid)).filter((c) => c.orderId === o3.id);
  ok("komisi atas pesanan itu dibatalkan",
    r3.commissionsVoided === 1 && komisi.every((c) => c.status === "void"),
    komisi.map((c) => c.status).join(",") || "tidak ada komisi");

  /* --- idempoten --- */
  const r3b = await db.refundOrder(o3.id);
  ok("refund kedua tidak mencabut apa pun lagi",
    r3b.attemptsRevoked === 0 && r3b.commissionsVoided === 0,
    `${r3b.attemptsRevoked} kuota, ${r3b.commissionsVoided} komisi`);

  /* --- surat pemberitahuan dikirim sekali, tidak dua kali --- */
  {
    /* sendMail tanpa RESEND_API_KEY hanya menulis ke console; suratnya
     * dihitung dengan menyadap console.log sebentar. */
    const o = await buatPesananLunas(2);
    const asli = console.log;
    let surat = 0;
    console.log = (...a) => { if (String(a[0] ?? "").includes("[MAIL:dev]")) surat++; else asli(...a); };
    try {
      const a = await settleRefund(o.id, "admin");
      const b = await settleRefund(o.id, "admin");
      console.log = asli;
      ok("pembeli diberi tahu saat dananya dikembalikan", surat === 1, `${surat} surat`);
      ok("refund kedua tidak mengirim surat lagi",
        b.alreadyRefunded === true && a.alreadyRefunded === false, `${surat} surat total`);
    } finally {
      console.log = asli;
    }
  }

  /* --- pesanan yang tidak jadi dibayar ditutup, bukan dibiarkan pending --- */
  const o4 = await db.createOrder({
    userId: uid, packageId: "utbk-starter", exam: "UTBK",
    amount: 149000, currency: "IDR", provider: "midtrans",
  });
  const ditutup = await db.setOrderStatus(o4.id, "expired");
  ok("pesanan pending yang kedaluwarsa ditutup", ditutup.status === "expired", ditutup.status);

  const o5 = await buatPesananLunas(2);
  const tetap = await db.setOrderStatus(o5.id, "failed");
  ok("pesanan yang SUDAH LUNAS tidak bisa diturunkan", tetap.status === "paid", tetap.status);

  /* --- syarat kelayakan --- */
  const kemarin = { status: "paid", paidAt: new Date(Date.now() - 3 * 864e5).toISOString() };
  const lampau = { status: "paid", paidAt: new Date(Date.now() - 40 * 864e5).toISOString() };
  ok("dalam 14 hari dan belum mengerjakan: memenuhi syarat",
    checkRefund(kemarin, { attemptsUsed: 0 }).eligible);
  ok("satu try out sudah dimulai: masih memenuhi syarat",
    checkRefund(kemarin, { attemptsUsed: 1 }).eligible);
  ok("dua try out sudah dimulai: tidak memenuhi syarat",
    checkRefund(kemarin, { attemptsUsed: 2 }).reason === "tooManyAttempts");
  ok("lewat 14 hari: tidak memenuhi syarat",
    checkRefund(lampau, { attemptsUsed: 0 }).reason === "windowClosed");
  ok("pesanan belum lunas: tidak ada yang dikembalikan",
    checkRefund({ status: "pending", createdAt: new Date().toISOString() }, null).reason === "notPaid");
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
