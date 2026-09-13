/* =========================================================================
 * Menyeimbangkan posisi kunci jawaban.
 *
 * Saat menulis soal, penulis cenderung menaruh jawaban benar di opsi pertama
 * lalu menyusun pengecoh sesudahnya. Akibatnya 89% kunci jatuh di opsi A —
 * siswa yang selalu memilih A akan benar 89% kali tanpa membaca satu soal pun.
 * Itu menghancurkan validitas seluruh bank.
 *
 * IDEMPOTEN. Soal yang sudah pernah diseimbangkan ditandai
 * `meta.keyBalanced` dan TIDAK PERNAH diacak ulang. Ini bukan kerapian —
 * urutan opsi tidak ikut dibekukan ke dalam attempt (FormSectionLayout hanya
 * menyimpan questionIds), jadi mengacak ulang soal yang sedang dikerjakan
 * akan menggeser huruf di bawah kaki peserta: jawaban "A" yang tersimpan
 * tiba-tiba menunjuk opsi lain, dan penilaiannya jadi salah.
 *
 * Soal baru mengisi huruf yang paling jarang terpakai secara global, jadi
 * sebarannya tetap rata tanpa menyentuh soal lama.
 *
 * Empat hal dijaga tetap konsisten saat mengacak:
 *   - answer.value
 *   - distractorRationale (kuncinya id opsi)
 *   - i18n.*.choices (validator menuntut urutan id sama persis)
 *   - rujukan huruf di dalam pembahasan ("Option B", "**A**")
 *
 * Opsi seperti «tidak dapat ditentukan» tetap dikunci di posisi terakhir,
 * karena memindahkannya ke tengah membuat soal terbaca janggal.
 *
 *   node scripts/balance-keys.mjs                       # laporan saja
 *   node scripts/balance-keys.mjs --write               # tulis perubahan
 *   node scripts/balance-keys.mjs question-bank/x.json --write
 *   node scripts/balance-keys.mjs --adopt --write       # tandai yang ada
 *                                                       # sebagai sudah rapi
 *   node scripts/balance-keys.mjs --rebalance-all --write
 *                                # acak ulang SEMUANYA — hanya aman kalau
 *                                # tidak ada attempt yang sedang berjalan
 * ========================================================================= */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const FLAGS = process.argv.slice(2).filter((a) => a.startsWith("-"));
const ARGS = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const WRITE = FLAGS.includes("--write");
const ADOPT = FLAGS.includes("--adopt");
const REBALANCE_ALL = FLAGS.includes("--rebalance-all");
const FORCE = FLAGS.includes("--force");
const LETTERS = "ABCDE";

/** Kumpulkan berkas dari argumen: boleh berkas .json, boleh direktori. */
function collect(targets) {
  const files = [];
  for (const t of targets) {
    if (!fs.existsSync(t)) { console.error(`tidak ditemukan: ${t}`); process.exit(1); }
    if (fs.statSync(t).isDirectory()) {
      for (const f of fs.readdirSync(t).filter((f) => f.endsWith(".json"))) files.push(path.join(t, f));
    } else if (t.endsWith(".json")) {
      files.push(t);
    } else {
      console.error(`bukan .json atau direktori: ${t}`); process.exit(1);
    }
  }
  return files.sort();
}

const FILES = collect(ARGS.length ? ARGS : ["question-bank", "sample-tests"]);

/* --- Pengaman: jangan menggeser opsi soal yang sedang dikerjakan. --------
 * Yang berbahaya bukan "ada ujian berjalan", melainkan "soal ini ada di dalam
 * ujian yang sedang berjalan". Soal yang baru ditulis belum masuk formLayout
 * mana pun, jadi aman diacak kapan saja — tanpa pembedaan ini, satu attempt
 * yang menggantung akan membekukan seluruh bank. */
function questionsInFlight() {
  const p = ".data/db.json";
  const ids = new Set();
  if (!fs.existsSync(p)) return ids;
  try {
    const db = JSON.parse(fs.readFileSync(p, "utf8"));
    const rows = Array.isArray(db.attempts) ? db.attempts : Object.values(db.attempts ?? {});
    for (const a of rows) {
      if (!a || a.status !== "in_progress") continue;
      for (const sec of a.formLayout ?? []) for (const id of sec.questionIds ?? []) ids.add(id);
    }
  } catch { /* db rusak — perlakukan sebagai tidak ada attempt */ }
  return ids;
}

/** Opsi yang maknanya bergantung pada posisi terakhir. */
const PINNED =
  /(?:[Aa]ll of the above|[Nn]one of the above|[Cc]annot be determined|The passage does not say|Tidak dapat ditentukan|Tidak dapat|无法(?:确定|判断|从表中判断)|以上都|都(?:成立|正确))/;

/** Acak berulang (deterministik) dari id soal, supaya hasilnya dapat direproduksi. */
function rng(seed) {
  let h = crypto.createHash("sha256").update(seed).digest();
  let i = 0;
  return () => {
    if (i >= h.length) { h = crypto.createHash("sha256").update(h).digest(); i = 0; }
    return h[i++] / 256;
  };
}

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Peka huruf besar-kecil adalah cacat, bukan pilihan: «option B» yang ditulis
 * huruf kecil LOLOS dari pemetaan ulang, lalu menunjuk opsi yang keliru tanpa
 * satu pun peringatan. Terukur: 6 butir di bank — lima CSCA dan satu UTBK —
 * memuat pembahasan yang menyebut opsi yang bukan maksudnya, termasuk satu
 * yang menyebut «option C» dua kali untuk dua opsi berbeda. Penanda /i
 * menutup celah itu. */
const REF = /(\*\*)([A-E])(\*\*)|((?:Option|Choice|选项|Pilihan|Opsi)\s+\*{0,2})([A-E])(\*{0,2})/gi;
function remapRefs(text, map) {
  if (!text) return text;
  return text.replace(REF, (m, b1, l1, b2, pre, l2, post) =>
    l1 ? `${b1}${map[l1] ?? l1}${b2}` : `${pre}${map[l2] ?? l2}${post}`,
  );
}

const isMcq = (q) => q.type === "mcq_single" && Array.isArray(q.choices);
const isSettled = (q) => Boolean(q.meta?.keyBalanced);

/* --- Muat semuanya dulu, supaya keputusan bisa melihat sebaran global. --- */
const docs = FILES.map((p) => ({ p, qs: JSON.parse(fs.readFileSync(p, "utf8")), touched: false }));
const all = docs.flatMap((d) => d.qs.filter(isMcq).map((q) => ({ q, d })));

/* Sebaran dihitung PER JUMLAH OPSI. Soal 5 opsi (UTBK) dan 4 opsi tidak boleh
 * dihitung dalam satu ember: E hanya ada di soal 5 opsi, jadi menganggapnya
 * "jarang terpakai" secara global akan menjejalkan semua kunci baru ke E. */
const bucket = (n, letter) => `${n}:${letter}`;
const settled = new Map();
const pending = [];
for (const item of all) {
  if (REBALANCE_ALL || !isSettled(item.q)) pending.push(item);
  else {
    const k = bucket(item.q.choices.length, item.q.answer.value);
    settled.set(k, (settled.get(k) ?? 0) + 1);
  }
}

if (!pending.length) {
  console.log(`soal pilihan ganda : ${all.length}`);
  console.log("Semua sudah seimbang — tidak ada yang perlu diacak.");
  process.exit(0);
}

const inFlight = questionsInFlight();
const blocked = pending.filter(({ q }) => inFlight.has(q.id));
if (blocked.length && WRITE && !ADOPT && !FORCE) {
  console.error(`\n✗ ${blocked.length} soal sedang dipakai attempt yang berjalan.`);
  console.error("  Urutan opsi tidak dibekukan ke dalam attempt, jadi mengacaknya sekarang");
  console.error("  akan menggeser huruf di bawah kaki peserta dan merusak penilaiannya.");
  console.error(`  Contoh: ${blocked.slice(0, 5).map((b) => b.q.id).join(", ")}`);
  console.error("  Tunggu sampai selesai, atau paksa dengan --force bila yakin.\n");
  process.exit(1);
}

/* --- Mode adopsi: tandai apa adanya, tanpa menggeser satu opsi pun. ------ */
if (ADOPT) {
  for (const { q, d } of pending) {
    q.meta = { ...(q.meta ?? {}), keyBalanced: 1 };
    d.touched = true;
  }
  if (WRITE) for (const d of docs) if (d.touched) fs.writeFileSync(d.p, JSON.stringify(d.qs, null, 2) + "\n");
  console.log(`ditandai sudah seimbang : ${pending.length} soal (urutan opsi tidak diubah)`);
  console.log(WRITE ? "\nPerubahan ditulis." : "\nUji coba saja — jalankan dengan --write untuk menyimpan.");
  process.exit(0);
}

/* --- Isi huruf yang paling jarang terpakai. ------------------------------
 * Urut berdasarkan id supaya hasilnya tidak bergantung urutan baca direktori. */
pending.sort((a, b) => String(a.q.id).localeCompare(String(b.q.id)));

const count = new Map(settled);
function leastUsed(freeSlots, n) {
  let best = freeSlots[0], bestN = Infinity;
  for (const i of freeSlots) {
    const used = count.get(bucket(n, LETTERS[i])) ?? 0;
    if (used < bestN) { best = i; bestN = used; }
  }
  return best;
}

let changed = 0;
const before = {}, after = {};
for (const item of all) before[item.q.answer.value] = (before[item.q.answer.value] ?? 0) + 1;

for (const { q, d } of pending) {
  const n = q.choices.length;
  const oldKey = q.choices.findIndex((c) => c.id === q.answer.value);
  if (oldKey < 0) { console.error(`kunci tidak ditemukan: ${q.id}`); continue; }

  const pinned = q.choices.map((c, i) => (PINNED.test(c.text) ? i : -1)).filter((i) => i >= 0);
  const free = [...Array(n).keys()].filter((i) => !pinned.includes(i));

  // Bila kunci justru opsi yang dikunci posisinya, biarkan di tempatnya.
  const target = pinned.includes(oldKey) ? oldKey : leastUsed(free, n);
  count.set(bucket(n, LETTERS[target]), (count.get(bucket(n, LETTERS[target])) ?? 0) + 1);

  const rand = rng(q.id);
  const rest = shuffle(free.filter((i) => i !== oldKey), rand);

  const order = new Array(n).fill(-1);
  for (const i of pinned) order[i] = i;          // tetap di posisinya
  order[target] = oldKey;
  let r = 0;
  for (const slot of free) if (order[slot] === -1) order[slot] = rest[r++];

  if (order.some((x) => x === -1) || new Set(order).size !== n) {
    console.error(`permutasi gagal: ${q.id}`); continue;
  }

  q.meta = { ...(q.meta ?? {}), keyBalanced: 1 };
  d.touched = true;

  if (order.every((v, i) => v === i)) continue;   // sudah pas di tempatnya

  // old id -> new id
  const map = {};
  order.forEach((oldIdx, newIdx) => { map[q.choices[oldIdx].id] = LETTERS[newIdx]; });

  const reorder = (list) => order.map((oldIdx, newIdx) => ({ ...list[oldIdx], id: LETTERS[newIdx] }));

  q.choices = reorder(q.choices);
  q.answer = { ...q.answer, value: LETTERS[target] };

  if (q.distractorRationale) {
    const next = {};
    for (const [oldId, text] of Object.entries(q.distractorRationale)) {
      if (map[oldId]) next[map[oldId]] = remapRefs(text, map);
    }
    q.distractorRationale = Object.fromEntries(
      Object.entries(next).sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  q.explanation = remapRefs(q.explanation, map);

  for (const tr of Object.values(q.i18n ?? {})) {
    if (Array.isArray(tr.choices)) tr.choices = reorder(tr.choices);
    if (tr.explanation) tr.explanation = remapRefs(tr.explanation, map);
  }

  changed++;
}

for (const item of all) after[item.q.answer.value] = (after[item.q.answer.value] ?? 0) + 1;

if (WRITE) for (const d of docs) if (d.touched) fs.writeFileSync(d.p, JSON.stringify(d.qs, null, 2) + "\n");

const total = all.length;
const pct = (o) => LETTERS.split("").filter((l) => o[l])
  .map((l) => `${l}=${o[l]} (${(100 * o[l] / total).toFixed(1)}%)`).join("  ");
console.log(`soal pilihan ganda : ${total}`);
console.log(`sudah seimbang     : ${all.length - pending.length} (tidak disentuh)`);
console.log(`diproses           : ${pending.length}`);
console.log(`diacak ulang       : ${changed}`);
console.log(`sebelum            : ${pct(before)}`);
console.log(`sesudah            : ${pct(after)}`);
console.log(WRITE ? "\nPerubahan ditulis." : "\nUji coba saja — jalankan dengan --write untuk menyimpan.");
