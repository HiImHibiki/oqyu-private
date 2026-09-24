/* =========================================================================
 * Mendeteksi aksara yang nyasar ke bahasa yang salah.
 *
 * Dua kali cacat jenis ini lolos: kata Mandarin 支持 di dalam stem SAT
 * berbahasa Inggris, dan kata Inggris "structure" di dalam opsi berbahasa
 * Mandarin. Keduanya lolos validator struktural karena bentuk JSON-nya sah —
 * yang salah adalah isinya, dan itu hanya kelihatan kalau ada yang membaca.
 *
 * Skrip ini membacanya secara mekanis:
 *   - soal locale "en"  : tidak boleh ada aksara CJK di stem/opsi/pembahasan
 *   - soal locale "zh"  : tidak boleh ada kata Latin utuh di opsi berbahasa
 *                         Mandarin (istilah teknis di daftar putih dikecualikan)
 *   - semua soal        : tidak boleh ada Sirilik, Kana, Hangul, atau Arab
 *   - seluruh bank      : id tidak boleh dipakai dua kali
 *
 * Pemeriksaan id ditambahkan setelah 16 soal fisika form 2 memakai id yang
 * sudah dipakai form 1. Impor memetakan soal ke dalam Map berdasarkan id, jadi
 * soal lama tertimpa tanpa pesan apa pun — bank menyusut 13 soal dan tidak ada
 * satu pun peringatan. Validator berjalan per berkas, sehingga bentrokan
 * antar-berkas mustahil terlihat dari sana.
 *
 *   node scripts/check-scripts.mjs
 * ========================================================================= */

import fs from "node:fs";
import path from "node:path";

const DIRS = ["question-bank", "sample-tests"].filter((d) => fs.existsSync(d));

/** Istilah Latin yang memang wajar muncul di teks Mandarin. */
const ALLOWED = new Set([
  "pH", "mol", "DNA", "RNA", "GPS", "SI",
]);

const CJK = /[一-鿿㐀-䶿]/;
const CYRILLIC = /[Ѐ-ӿ]/;
const KANA = /[぀-ヿ]/;
const HANGUL = /[가-힯ᄀ-ᇿ]/;
const ARABIC = /[؀-ۿ]/;

/** Buang matematika, kode, dan tanda baca yang bukan bahasa. */
const stripMath = (s) => String(s ?? "").replace(/\$[^$]*\$/g, " ").replace(/`[^`]*`/g, " ");

/* Pinyin dalam kurung — 溶解（róng）— adalah anotasi yang memang harus ada di
 * soal pelafalan, bukan terjemahan yang tertinggal. Buang isi kurung dulu. */
const stripParenthetical = (s) => s.replace(/[（(][^）)]*[）)]/g, " ");

const LATIN_WORD = /[A-Za-zÀ-ÿāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]{2,}/g;

const idSeen = new Map();
let problems = 0;
function flag(file, id, where, msg, sample) {
  console.log(`  ✗ ${id} · ${where}: ${msg}`);
  if (sample) console.log(`      ${sample}`);
  problems++;
}

for (const dir of DIRS)
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const p = path.join(dir, file);
  const qs = JSON.parse(fs.readFileSync(p, "utf8"));
  const before = problems;

  for (const q of qs) {
    const locale = q.locale ?? "en";

    /* Id ganda: soal yang diimpor belakangan menimpa yang sebelumnya. */
    const prev = idSeen.get(q.id);
    if (prev) flag(p, q.id, "id", `sudah dipakai di ${prev} — impor akan menimpanya`);
    else idSeen.set(q.id, p);

    /* Aksara yang tidak boleh muncul di mana pun. */
    const everything = [q.stem, q.explanation, q.stimulus?.content,
      ...(q.choices ?? []).map((c) => c.text),
      ...Object.values(q.distractorRationale ?? {})].map(stripMath).join(" ");
    for (const [name, re] of [["Sirilik", CYRILLIC], ["Kana", KANA], ["Hangul", HANGUL], ["Arab", ARABIC]]) {
      const m = everything.match(re);
      if (m) flag(p, q.id, "teks", `aksara ${name} nyasar`, m[0]);
    }

    if (locale === "en") {
      /* Soal berbahasa Inggris: aksara Mandarin hanya boleh di i18n.zh. */
      const en = [q.stem, q.explanation, q.stimulus?.content,
        ...(q.choices ?? []).map((c) => c.text),
        ...Object.values(q.distractorRationale ?? {})].map(stripMath).join(" ");
      const m = en.match(new RegExp(`${CJK.source}+`));
      if (m) flag(p, q.id, "stem/opsi (en)", "aksara Mandarin di dalam soal berbahasa Inggris", m[0]);
    }

    if (locale === "zh") {
      /* Opsi Mandarin: kata Latin utuh hampir selalu berarti terjemahan
       * yang tertinggal separuh. */
      for (const c of q.choices ?? []) {
        const text = stripMath(c.text);
        if (!CJK.test(text)) continue;              // opsi murni Latin (mis. pinyin) dilewati
        for (const w of stripParenthetical(text).match(LATIN_WORD) ?? []) {
          if (ALLOWED.has(w)) continue;
          flag(p, q.id, `opsi ${c.id}`, `kata Latin di dalam opsi Mandarin`, `«${w}» dalam «${c.text}»`);
        }
      }
    }
  }

  if (problems > before) console.log(`  ↑ ${p}\n`);
}

console.log(problems === 0
  ? `✓ ${idSeen.size} soal diperiksa: id unik, tidak ada aksara nyasar (${DIRS.join(", ")}).`
  : `\n${problems} masalah ditemukan.`);
process.exit(problems === 0 ? 0 : 1);
