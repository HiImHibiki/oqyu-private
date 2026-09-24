#!/usr/bin/env node
/* Regression tests for parseWorksheet()/renderWorksheet() across the
 * various soal formats the app supports (PG/B/I/IB/M/E, essay sub-items,
 * reading passage, formula sheet, diagram tags, and the various Kunci
 * Jawaban / Pembahasan fallback styles).
 *
 * No dependencies — uses only Node's built-in assert. Run with:
 *   node test.js
 */

const assert = require('assert/strict');

// app.js/diagrams.js are written as plain browser <script> files that also
// export via module.exports when `module` exists (see the bottom of each
// file). app.js calls extractDiagramTags()/substituteDiagramTokens() as
// bare globals (the way the two <script> tags share them in the browser),
// so diagrams.js's exports are copied onto `global` before app.js loads.
global.document = { addEventListener: () => {} };
Object.assign(global, require('./diagrams.js'));
const { parseWorksheet, renderWorksheet, splitIntoSets, makeVariant, validateWorksheet, extractMarks, parseSubParts } = require('./app.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function render(raw, opts) {
  const data = parseWorksheet(raw);
  assert.ok(data, 'parseWorksheet returned null — input was not recognized at all');
  const html = renderWorksheet(data, Object.assign({
    showLogo: false, brandName: 'Test', pgOptionCols: '2', bodyColumns: '1'
  }, opts));
  return { data, html };
}

// ---------------------------------------------------------------------
// Pilihan Ganda (PG)
// ---------------------------------------------------------------------
test('PG: parses options, marks correct answer, shows inline pembahasan', () => {
  const raw = `Bagian A: Pilihan Ganda (PG)
PG1. Berapa hasil $2+2$?
A. $3$
B. $4$
C. $5$
D. $6$

Kunci Jawaban
PG1-B

Pembahasan
PG1-$2+2=4$, jadi jawabannya B`;
  const { data, html } = render(raw, { showAnswerKey: true, showExplanation: true });
  assert.equal(data.sections[0].type, 'pg');
  assert.equal(data.sections[0].items.length, 1);
  assert.equal(data.answerKey.PG1, 'B');
  assert.match(html, /ws-correct/); // correct option highlighted
  assert.match(html, /ws-inline-explanation/); // pembahasan rendered inline
  assert.doesNotMatch(html, />Pembahasan</); // no combined end-of-sheet block anymore
});

test('PG: kolom pilihan diputuskan per soal dari panjang teksnya', () => {
  const raw = `Bagian A: Pilihan Ganda (PG)
PG1. Unsur yang paling elektronegatif adalah...
A. Na
B. Al
C. P
D. Cl
PG2. Urutan yang benar adalah...
A. $Na < Mg < Al$
B. $Si < P < S$
C. $Cl < S < P$
D. $K < Ca < Sc$
PG3. Jari-jari atom dalam satu periode dari kiri ke kanan...
A. Bertambah karena jumlah kulit elektron makin banyak
B. Bertambah karena muatan inti efektif makin kecil
C. Berkurang karena muatan inti efektif makin besar
D. Berkurang karena jumlah elektron valensi makin sedikit
PG4. Afinitas elektron halogen bernilai sangat negatif, artinya...
A. Sangat sukar menerima elektron
B. Melepaskan energi yang besar
C. Memerlukan energi yang tinggi
D. Stabil dan tidak bereaksi

Kunci Jawaban
PG1-D PG2-A PG3-C PG4-B`;
  // Kolom koran (bodyColumns 2): sangat pendek → 4 sejajar, pendek → 2,
  // kalimat (sedang maupun panjang) → 1 kolom penuh.
  const { html } = render(raw, { bodyColumns: '2' });
  const kelas = [...html.matchAll(/class="ws-options([^"]*)"/g)].map(m => m[1].trim());
  assert.deepEqual(kelas, ['cols-4', 'cols-2', '', '']);
  // Lembar 1 kolom dua kali lebih lapang: kalimat sedang muat berdua,
  // kalimat panjang tetap satu kolom.
  const lapang = render(raw, { bodyColumns: '1' }).html;
  const kelasLapang = [...lapang.matchAll(/class="ws-options([^"]*)"/g)].map(m => m[1].trim());
  assert.deepEqual(kelasLapang, ['cols-4', 'cols-2', '', 'cols-2']);
  // "1 kolom" dipilih guru: tidak pernah berdampingan.
  const satu = render(raw, { pgOptionCols: '1' }).html;
  assert.doesNotMatch(satu, /cols-[24]/);
});

// ---------------------------------------------------------------------
// Benar/Salah (B) — including the True/False -> Benar/Salah alias mapping
// ---------------------------------------------------------------------
test('B: true/false statements, English True/False aliased to Benar/Salah', () => {
  const raw = `Bagian B: Benar Salah (B)
B1. Matriks identitas selalu memiliki determinan $1$.
B2. $2+2=5$.

Kunci Jawaban
B1-True, B2-False`;
  const { data, html } = render(raw, { showAnswerKey: true });
  assert.equal(data.sections[0].type, 'b');
  assert.equal(data.answerKey.B1, 'Benar');
  assert.equal(data.answerKey.B2, 'Salah');
  assert.match(html, /ws-tf-row/);
});

// ---------------------------------------------------------------------
// Isian (I) — short fill-in-the-blank
// ---------------------------------------------------------------------
test('I: fill-in-the-blank shows answer inline with math wrapping', () => {
  const raw = `Bagian C: Isian (I)
I1. Nilai dari $5+5$ adalah ______.

Kunci Jawaban
I1-10`;
  const { data, html } = render(raw, { showAnswerKey: true });
  assert.equal(data.sections[0].type, 'i');
  assert.equal(data.answerKey.I1, '10');
  assert.match(html, /&rarr;/); // "-> 10" answer marker rendered
});

// ---------------------------------------------------------------------
// Isian Berpilihan (IB) — fill-in-the-blank with a word bank ("Kotak Kata")
// ---------------------------------------------------------------------
test('IB: word bank (Kotak Kata) is parsed and rendered as its own box', () => {
  const raw = `Bagian D: Isian Berpilihan (IB)
Kotak Kata: fotosintesis, respirasi, klorofil
IB1. Proses tumbuhan membuat makanan disebut ______.

Kunci Jawaban
IB1-fotosintesis`;
  const { data, html } = render(raw, { showAnswerKey: true });
  assert.equal(data.sections[0].type, 'ib');
  assert.equal(data.sections[0].bank, 'fotosintesis, respirasi, klorofil');
  assert.match(html, /ws-wordbank/);
  assert.match(html, /Kotak Kata/);
});

// ---------------------------------------------------------------------
// Mencocokkan (M) — matching, with a "Kolom B" answer bank
// ---------------------------------------------------------------------
test('M: matching items resolve their letter answer against Kolom B', () => {
  const raw = `Bagian E: Mencocokkan (M)
Kolom B: A. Ibu kota Prancis B. Ibu kota Jepang C. Ibu kota Mesir
M1. Paris
M2. Tokyo

Kunci Jawaban
M1-A, M2-B`;
  const { data, html } = render(raw, { showAnswerKey: true });
  assert.equal(data.sections[0].type, 'm');
  assert.equal(data.answerKey.M1, 'A');
  assert.match(html, /Kolom B/);
  assert.match(html, /ws-match-row/);
});

// ---------------------------------------------------------------------
// Esai (E) — extended response, with/without answer key
// ---------------------------------------------------------------------
test('E: essay shows a blank workspace with no key, and the answer once keyed', () => {
  const rawNoKey = `Bagian F: Esai (E)
E1. Jelaskan proses terjadinya hujan.`;
  const { html: htmlNoKey } = render(rawNoKey, { showAnswerKey: true });
  assert.match(htmlNoKey, /ws-essay-workspace/);

  const rawWithKey = `Bagian F: Esai (E)
E1. Jelaskan proses terjadinya hujan.

Kunci Jawaban
E1-Air menguap, mengembun jadi awan, lalu turun sebagai hujan

Pembahasan
E1-Siklus air: evaporasi, kondensasi, presipitasi`;
  const { data, html } = render(rawWithKey, { showAnswerKey: true, showExplanation: true });
  assert.equal(data.sections[0].type, 'e');
  assert.match(html, /ws-essay-answer/);
  assert.match(html, /ws-inline-explanation/);
});

// ---------------------------------------------------------------------
// Esai dengan sub-soal ("Problem N" + lettered sub-items, e.g. E1a/E1b)
// ---------------------------------------------------------------------
test('Essay with lettered sub-items (Problem N / E1a, E1b) parses each sub-answer', () => {
  const raw = `Problem 1
E1a: Jelaskan Hukum Newton pertama.
E1b: Berikan satu contohnya.

Kunci Jawaban
E1a-Benda diam tetap diam selama tidak ada gaya net
E1b-Buku diam di atas meja

Pembahasan
E1a-Karena resultan gaya nol
E1b-Gaya berat dan gaya normal saling meniadakan`;
  const { data, html } = render(raw, { showAnswerKey: true, showExplanation: true });
  assert.equal(data.sections[0].type, 'essay');
  assert.equal(data.sections[0].items[0].subItems.length, 2);
  assert.equal(data.answerKey.E1a, 'Benda diam tetap diam selama tidak ada gaya net');
  const idxA = html.indexOf('Jelaskan Hukum Newton');
  const idxExpA = html.indexOf('Karena resultan gaya nol');
  const idxB = html.indexOf('Berikan satu contohnya');
  assert.ok(idxA < idxExpA && idxExpA < idxB, 'pembahasan E1a should sit between sub-item a and sub-item b');
});

// ---------------------------------------------------------------------
// Reading passage
// ---------------------------------------------------------------------
test('Reading passage: title + body extracted and rendered before the sections', () => {
  const raw = `Reading Passage
The Water Cycle

The water cycle describes how water evaporates, condenses, and falls back to earth as precipitation.

Bagian A: Pilihan Ganda (PG)
PG1. What is the passage about?
A. The water cycle
B. Photosynthesis
C. Volcanoes
D. Gravity

Kunci Jawaban
PG1-A`;
  const { data, html } = render(raw, { showAnswerKey: true });
  assert.equal(data.passageTitle, 'The Water Cycle');
  assert.match(data.passageBody, /water cycle describes/);
  assert.match(html, /ws-passage/);
});

test('Reading passage: "Bacaan" heading after the worksheet title keeps the title', () => {
  const raw = `Latihan Membaca Pemahaman

Bacaan
Hutan Kota

Hutan kota adalah kawasan hijau di tengah permukiman. Fungsinya menyerap air hujan dan menurunkan suhu.

Selain itu, hutan kota menjadi tempat hidup burung dan serangga.

Bagian Pilihan Ganda: (PG)
PG1. Apa fungsi hutan kota menurut teks?
A. Menyerap air hujan
B. Menambah polusi
C. Menaikkan suhu
D. Mengurangi burung

Kunci Jawaban
PG1-A`;
  const { data, html } = render(raw, { showAnswerKey: true });
  assert.equal(data.title, 'Latihan Membaca Pemahaman');
  assert.equal(data.passageTitle, 'Hutan Kota');
  assert.match(data.passageBody, /menyerap air hujan/);
  assert.match(data.passageBody, /burung dan serangga/);
  assert.equal(data.sections.length, 1);
  assert.equal(data.sections[0].items.length, 1);
  assert.match(html, /ws-passage/);
});

test('Reading passage: "Bacaan 1:" spelling and no worksheet title', () => {
  const raw = `Bacaan 1:
Reading is a habit that grows with practice.

Bagian A: (PG)
PG1. What is the text about?
A. Reading
B. Cooking
C. Running
D. Sleeping

Kunci Jawaban
PG1-A`;
  const { data } = render(raw, { showAnswerKey: true });
  assert.equal(data.title, '');
  assert.equal(data.passageTitle, '');
  assert.match(data.passageBody, /habit that grows/);
  assert.equal(data.sections[0].items.length, 1);
});

// ---------------------------------------------------------------------
// Formula reference sheet (F1, F2, ...)
// ---------------------------------------------------------------------
test('Formula sheet: F-prefixed formulas are collected into the Ringkasan Rumus box', () => {
  const raw = `F1 (Luas Lingkaran): $L = \\pi r^2$
F2 (Keliling Lingkaran): $K = 2 \\pi r$
Bagian A: Pilihan Ganda (PG)
PG1. Berapa luas lingkaran dengan $r=7$?
A. $154$
B. $22$
C. $49$
D. $14$

Kunci Jawaban
PG1-A`;
  const { data, html } = render(raw, { showFormulaBox: true });
  assert.equal(data.formulas.length, 2);
  assert.match(html, /ws-formulas/);
  assert.match(html, /Ringkasan Rumus/);
});

// A "named" section header — the descriptive name itself sits before the
// colon, e.g. "Bagian Pilihan Ganda: (PG)" — directly following the last
// formula used to get swallowed into that formula's own text, because the
// formula list's stop-lookahead only recognized single-word "Bagian A:"
// headers as a boundary, not this multi-word style. That silently deleted
// the whole section (its header never got split out, so its items were
// never found at all) whenever a worksheet had both a formula box and a
// named section header — as opposed to a formula box paired with the
// short-code style ("Bagian A: Pilihan Ganda (PG)"), which always worked.
test('Formula sheet followed by a "named" section header (no short code) does not swallow the section', () => {
  const raw = `F1 (Luas Lingkaran): $L = \\pi r^2$
F2 (Keliling Lingkaran): $K = 2 \\pi r$
Bagian Pilihan Ganda: (PG)
PG1. Berapa luas lingkaran dengan $r=7$?
A. $154$
B. $22$

Bagian Esai: (E)
E1. Hitung luas lingkaran dengan $r=10$.

Kunci Jawaban
PG1-A, E1-$314$`;
  const { data } = render(raw, { showFormulaBox: true });
  assert.equal(data.formulas.length, 2);
  assert.equal(data.sections.map(s => s.type).join(','), 'pg,e');
  assert.equal(data.sections[0].items.length, 1);
  assert.match(data.sections[0].items[0].stem, /luas lingkaran dengan/);
});

// ---------------------------------------------------------------------
// Diagram tag ([[grafik: ...]]) — extraction + token substitution to SVG
// ---------------------------------------------------------------------
test('Diagram tag: [[grafik: ...]] is extracted, tokenized, then substituted with SVG', () => {
  const raw = `Bagian A: Pilihan Ganda (PG)
PG1. Perhatikan grafik berikut. [[grafik: f1=x^2-4; xmin=-5; xmax=5; ymin=-6; ymax=8]] Berapa akar-akarnya?
A. $-2, 2$
B. $-4, 4$
C. $0, 4$
D. $-2, 0$

Kunci Jawaban
PG1-A`;
  const { data, html } = render(raw, {});
  assert.equal(data.diagramTags.length, 1);
  assert.doesNotMatch(html, /\[\[grafik:/, 'raw diagram tag text must not leak into the rendered HTML');
  const withSvg = substituteDiagramTokens(html, data.diagramTags);
  assert.match(withSvg, /<svg/, 'diagram token should resolve to an inline SVG');
});

// ---------------------------------------------------------------------
// Kunci Jawaban fallback: "PG1. B" dot-style instead of "PG1-B" dash-style
// ---------------------------------------------------------------------
test('Answer key fallback: dot-style ("PG1. B") is read when dash-style is absent', () => {
  const raw = `Bagian A: Pilihan Ganda (PG)
PG1. Berapa hasil $3 \\times 3$?
A. $6$
B. $9$
C. $12$
D. $3$

Kunci Jawaban
PG1. B`;
  const { data } = render(raw, {});
  assert.equal(data.answerKey.PG1, 'B');
});

// ---------------------------------------------------------------------
// Pembahasan fallback: prose grouped by "Problem N" with no ID-value pairs.
// Only meaningful for the "Problem N + lettered sub-items" essay shape —
// there, item.id IS "Problem1", so a whole-problem prose explanation (as
// opposed to one dash-keyed per sub-item) still has a real id to attach
// to and renders once above the sub-items.
// ---------------------------------------------------------------------
test('Explanation fallback: prose-style "Problem N" grouping (no ID-value pairs)', () => {
  const raw = `Problem 1
E1a: Jelaskan Hukum Newton pertama.
E1b: Berikan satu contohnya.

Kunci Jawaban
E1a-Benda diam tetap diam
E1b-Buku diam di atas meja

Pembahasan
Problem 1
Hukum ini menyatakan benda mempertahankan keadaannya selama resultan gaya yang bekerja padanya nol.`;
  const { data, html } = render(raw, { showAnswerKey: true, showExplanation: true });
  assert.ok(data.explanations.Problem1, 'fallback should key the explanation as Problem1');
  assert.match(html, /ws-inline-explanation/);
});

// ---------------------------------------------------------------------
// Integration smoke test: several section types in one worksheet
// ---------------------------------------------------------------------
test('Integration: a worksheet mixing PG/B/I/E sections renders without throwing', () => {
  const raw = `Bagian A: Pilihan Ganda (PG)
PG1. $1+1=$?
A. $1$
B. $2$
C. $3$
D. $4$

Bagian B: Benar Salah (B)
B1. Bumi datar.

Bagian C: Isian (I)
I1. $10-4=$ ______.

Bagian D: Esai (E)
E1. Jelaskan revolusi bumi.

Kunci Jawaban
PG1-B, B1-False, I1-6, E1-Bumi mengelilingi matahari dalam 365 hari

Pembahasan
PG1-1+1=2
B1-Bumi berbentuk bulat (geoid)
I1-10-4=6
E1-Revolusi bumi memakan waktu sekitar 365,25 hari`;
  const { data, html } = render(raw, { showAnswerKey: true, showExplanation: true });
  assert.equal(data.sections.length, 4);
  assert.equal(data.sections.map(s => s.type).join(','), 'pg,b,i,e');
  // exactly one inline pembahasan box per item, none combined at the end
  assert.equal((html.match(/ws-inline-explanation/g) || []).length, 4);
  assert.doesNotMatch(html, />Pembahasan</);
});

// ---------------------------------------------------------------------
// splitIntoSets: multiple complete worksheets pasted in one go, marked
// off by standalone "SET N" lines (what "Buat Prompt AI" instructs the
// AI to produce when asked for more than one set).
// ---------------------------------------------------------------------
test('splitIntoSets: a normal single worksheet (no SET markers) is left untouched', () => {
  const raw = 'PG1. Soal biasa?\nA. 1\nB. 2';
  assert.deepEqual(splitIntoSets(raw), [raw]);
});

test('splitIntoSets: a single stray "SET 1" line alone does not trigger split (needs 2+)', () => {
  const raw = 'SET 1\nPG1. Soal biasa?\nA. 1\nB. 2';
  assert.deepEqual(splitIntoSets(raw), [raw]);
});

test('splitIntoSets: two+ SET markers split into separate, trimmed, ordered chunks', () => {
  const raw = `SET 1
PG1. Soal set satu?
A. 1
B. 2

SET 2
PG1. Soal set dua?
A. 3
B. 4

SET 3
PG1. Soal set tiga?
A. 5
B. 6`;
  const sets = splitIntoSets(raw);
  assert.equal(sets.length, 3);
  assert.match(sets[0], /Soal set satu/);
  assert.match(sets[1], /Soal set dua/);
  assert.match(sets[2], /Soal set tiga/);
  assert.doesNotMatch(sets[0], /Soal set dua|Soal set tiga/);
});

test('splitIntoSets: marker matching is case/whitespace tolerant ("set 2", extra spaces)', () => {
  const raw = 'set   1\nPG1. A?\nA. x\nB. y\n\nSET 2\nPG1. B?\nA. x\nB. y';
  const sets = splitIntoSets(raw);
  assert.equal(sets.length, 2);
  assert.match(sets[0], /Soal A\?|A\?/);
});

// splitIntoSets falls back to detecting each worksheet's own repeated title
// (no explicit "SET N" marker line at all) — e.g. several complete
// worksheets pasted straight from an AI chat reply that titled each one
// "... Practice Set 4" / "Set 5" instead of using the marker format.
test('splitIntoSets: falls back to a repeated "... Set N" title when there is no SET marker', () => {
  const raw = `Indices Practice Set 4
F1 (Rule): $a^m$

Bagian Indices Set 4: (PG)
PG1. Soal set empat?
A. 1
B. 2

Kunci Jawaban
PG1-A

Indices Practice Set 5
F1 (Rule): $a^m$

Bagian Indices Set 5: (PG)
PG1. Soal set lima?
A. 3
B. 4

Kunci Jawaban
PG1-B`;
  const sets = splitIntoSets(raw);
  assert.equal(sets.length, 2);
  assert.match(sets[0], /^Indices Practice Set 4/);
  assert.match(sets[0], /Soal set empat/);
  assert.doesNotMatch(sets[0], /Soal set lima/);
  assert.match(sets[1], /^Indices Practice Set 5/);
  assert.match(sets[1], /Soal set lima/);
});

test('splitIntoSets: repeated-title fallback also works with no blank lines/newlines between sets', () => {
  // A worksheet pasted into a plain textarea can lose its paragraph breaks
  // entirely, running one set's last sentence straight into the next
  // set's title with no separator at all.
  const raw = 'Indices Practice Set 4F1 (Rule): $a^m$Bagian Indices Set 4: (PG)PG1. Soal set empat?A. 1B. 2Kunci JawabanPG1-AIndices Practice Set 5F1 (Rule): $a^m$Bagian Indices Set 5: (PG)PG1. Soal set lima?A. 3B. 4Kunci JawabanPG1-B';
  const sets = splitIntoSets(raw);
  assert.equal(sets.length, 2);
  assert.match(sets[0], /Soal set empat/);
  assert.doesNotMatch(sets[0], /Soal set lima/);
  assert.match(sets[1], /Soal set lima/);
});

test('splitIntoSets: a title with no trailing "Set N" never triggers the fallback', () => {
  const raw = 'Ulangan Harian Matematika\nPG1. Soal biasa?\nA. 1\nB. 2';
  assert.deepEqual(splitIntoSets(raw), [raw]);
});

test('Integration: a multi-set paste parses into independently correct worksheets', () => {
  const raw = `SET 1
Bagian A: Pilihan Ganda (PG)
PG1. Berapa $1+1$?
A. $1$
B. $2$

Kunci Jawaban
PG1-B

SET 2
Bagian A: Pilihan Ganda (PG)
PG1. Berapa $2+2$?
A. $3$
B. $4$

Kunci Jawaban
PG1-A`;
  const sets = splitIntoSets(raw).map(parseWorksheet);
  assert.equal(sets.length, 2);
  assert.equal(sets[0].answerKey.PG1, 'B');
  assert.equal(sets[1].answerKey.PG1, 'A');
  assert.match(sets[0].sections[0].items[0].stem, /1\+1/);
  assert.match(sets[1].sections[0].items[0].stem, /2\+2/);
});


// ---------------------------------------------------------------------
// Paket acak (makeVariant) — the "anti-nyontek" A/B/C variant generator
// ---------------------------------------------------------------------

// A worksheet with two PG sections, so the continuous-numbering rule
// (PG1..PG3 then PG4..PG5, never PG1.. twice) is actually exercised.
const VARIANT_RAW = `Bagian 1: Aljabar (PG)
PG1. Nilai $x$ dari $x+1=3$?
A. $1$
B. $2$
C. $3$
D. Semua jawaban benar
PG2. Nilai $y$ dari $2y=8$?
A. $2$
B. $3$
C. $4$
D. $5$
PG3. Hasil $3^2$?
A. $6$
B. $8$
C. $9$
D. $12$

Bagian 2: Geometri (PG)
PG4. Luas persegi sisi $4$?
A. $8$
B. $12$
C. $16$
D. $20$
PG5. Keliling persegi sisi $4$?
A. $8$
B. $16$
C. $20$
D. $24$

Kunci Jawaban
PG1-B, PG2-C, PG3-C, PG4-C, PG5-B

Pembahasan
PG1-$x=3-1=2$
PG5-$K=4s=16$`;

test('Paket: items are renumbered continuously across sections, none lost or duplicated', () => {
  const data = parseWorksheet(VARIANT_RAW);
  const variant = makeVariant(data, 12345, { shuffleItems: true, shuffleOptions: true });
  const ids = variant.sections.flatMap(s => s.items.map(i => i.id));
  assert.deepEqual(ids, ['PG1', 'PG2', 'PG3', 'PG4', 'PG5']);
  // Same five questions, just in a different order — compare by stem text.
  const stems = variant.sections.flatMap(s => s.items.map(i => i.stem)).sort();
  const original = data.sections.flatMap(s => s.items.map(i => i.stem)).sort();
  assert.deepEqual(stems, original);
});

test('Paket: the original data is never mutated (Paket A still renders as written)', () => {
  const data = parseWorksheet(VARIANT_RAW);
  const before = JSON.stringify(data);
  makeVariant(data, 999, { shuffleItems: true, shuffleOptions: true });
  assert.equal(JSON.stringify(data), before);
});

test('Paket: same seed reproduces the same shuffle, a different seed changes it', () => {
  const data = parseWorksheet(VARIANT_RAW);
  const order = (d) => d.sections.flatMap(s => s.items.map(i => i.stem)).join('|');
  assert.equal(order(makeVariant(data, 42, {})), order(makeVariant(data, 42, {})));
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map(s => order(makeVariant(data, s, {})));
  assert.ok(new Set(seeds).size > 1, 'every seed produced the identical order');
});

test('Paket: each shuffled item keeps its own answer and pembahasan', () => {
  const data = parseWorksheet(VARIANT_RAW);
  const variant = makeVariant(data, 777, { shuffleItems: true, shuffleOptions: true });
  variant.sections.forEach(sec => sec.items.forEach(item => {
    // Find what this same question was called in the original naskah...
    const origSec = data.sections.find(s => s.items.some(i => i.stem === item.stem));
    const orig = origSec.items.find(i => i.stem === item.stem);
    // ...its answer must still point at the option holding the same text.
    const correctText = orig.options.find(o => o.label === data.answerKey[orig.id]).tex;
    const newLabel = variant.answerKey[item.id];
    assert.equal(item.options.find(o => o.label === newLabel).tex, correctText,
      `answer for ${orig.id} -> ${item.id} no longer points at the correct option`);
    if (data.explanations[orig.id] != null) {
      assert.equal(variant.explanations[item.id], data.explanations[orig.id]);
    }
  }));
});

test('Paket: options are relabelled A..D in order, "Semua jawaban benar" stays last', () => {
  const data = parseWorksheet(VARIANT_RAW);
  for (let seed = 1; seed <= 12; seed++) {
    const variant = makeVariant(data, seed, { shuffleItems: true, shuffleOptions: true });
    variant.sections.forEach(sec => sec.items.forEach(item => {
      assert.deepEqual(item.options.map(o => o.label), ['A', 'B', 'C', 'D']);
      const anchored = item.options.findIndex(o => /Semua jawaban benar/.test(o.tex));
      if (anchored > -1) assert.equal(anchored, item.options.length - 1);
    }));
  }
});

test('Paket: shuffleItems:false keeps order, shuffleOptions:false keeps option letters', () => {
  const data = parseWorksheet(VARIANT_RAW);
  const variant = makeVariant(data, 5, { shuffleItems: false, shuffleOptions: false });
  assert.deepEqual(
    variant.sections.flatMap(s => s.items.map(i => i.stem)),
    data.sections.flatMap(s => s.items.map(i => i.stem))
  );
  assert.deepEqual(variant.answerKey, data.answerKey);
});

test('Paket: essay sub-item ids are renumbered along with their parent Problem', () => {
  const raw = `Problem 1. Tentukan besaran berikut.
E1a: Massa jenis air
E1b: Titik didih air
Problem 2. Jelaskan konsep berikut.
E2a: Hukum Newton I
E2b: Hukum Newton II

Kunci Jawaban
E1a-$1000$, E1b-$100$, E2a-Kelembaman, E2b-$F=ma$`;
  const data = parseWorksheet(raw);
  const variant = makeVariant(data, 3, { shuffleItems: true });
  const items = variant.sections[0].items;
  assert.deepEqual(items.map(i => i.id), ['Problem1', 'Problem2']);
  items.forEach((item) => {
    // Sub-ids embed the parent number, so they must follow the renumbering.
    assert.deepEqual(item.subItems.map(si => si.id), [item.num + 'a', item.num + 'b'].map(s => 'E' + s));
    const orig = data.sections[0].items.find(i => i.stem === item.stem);
    item.subItems.forEach((si, k) => {
      assert.equal(variant.answerKey[si.id], data.answerKey[orig.subItems[k].id]);
    });
  });
});

test('Paket: a variant renders without throwing and shows the renumbered key', () => {
  const data = parseWorksheet(VARIANT_RAW);
  const variant = makeVariant(data, 2024, { shuffleItems: true, shuffleOptions: true });
  const html = renderWorksheet(variant, {
    showLogo: false, brandName: 'Test', pgOptionCols: '2', bodyColumns: '1',
    showAnswerKey: true, showExplanation: true, titleOverride: 'MATH/XI - Paket B'
  });
  assert.match(html, /MATH\/XI - Paket B/);
  assert.equal((html.match(/ws-correct/g) || []).length, 5); // one marked answer per item
});


// ---------------------------------------------------------------------
// Figur berpanel, gambar impor, anotasi, dan ruang jawab
// ---------------------------------------------------------------------
const D = require('./diagrams.js');

test('Figur: panels render side by side, auto-labelled (a)/(b), with a caption', () => {
  D.resetFigureCounter();
  const html = D.renderDiagramTag('figur: judul=Percobaan; panel=bangun: bentuk=persegi; sisi=5 // grafik: f1=x^2-4; xmin=-4; xmax=4');
  assert.match(html, /<figure class="ws-figure">/);
  assert.equal((html.match(/ws-figure-panel"/g) || []).length, 2);
  assert.match(html, /\(a\)/);
  assert.match(html, /\(b\)/);
  assert.match(html, /Gambar 1 — Percobaan/);
  assert.equal((html.match(/<svg/g) || []).length, 2);
});

test('Figur: a single panel gets a caption but no (a) label', () => {
  D.resetFigureCounter();
  const html = D.renderDiagramTag('figur: panel=bangun: bentuk=persegi; sisi=5');
  assert.match(html, /Gambar 1/);
  assert.doesNotMatch(html, /ws-figure-panel-label/);
});

test('Figur: numbering runs 1,2,3 and resetFigureCounter starts it over per sheet', () => {
  D.resetFigureCounter();
  const nums = [1, 2, 3].map(() => {
    const h = D.renderDiagramTag('figur: panel=bangun: bentuk=persegi; sisi=5');
    return h.match(/Gambar (\d+)/)[1];
  });
  assert.deepEqual(nums, ['1', '2', '3']);
  D.resetFigureCounter();
  assert.match(D.renderDiagramTag('figur: panel=bangun: bentuk=persegi; sisi=5'), /Gambar 1/);
});

test('Figur: an explicit nomor overrides the counter (e.g. "2.1")', () => {
  D.resetFigureCounter();
  assert.match(D.renderDiagramTag('figur: nomor=2.1; panel=bangun: bentuk=persegi; sisi=5'), /Gambar 2\.1/);
});

test('Figur: "panel=" holds semicolons verbatim instead of being split as params', () => {
  D.resetFigureCounter();
  // "xmin=-4" sits after a ";" INSIDE the panel — a naive param parse would
  // lose it and the graph would render with the default -10..10 range.
  const html = D.renderDiagramTag('figur: panel=grafik: f1=x; xmin=-4; xmax=4; ymin=-4; ymax=4');
  assert.match(html, /<svg/);
  // -4..4 with niceStep gives a "2" tick that a -10..10 graph never draws
  // on its own; its presence proves the inner params survived.
  assert.match(html, />2</);
});

test('Figur: a missing panel= and a nested figur both fail visibly, not silently', () => {
  D.resetFigureCounter();
  assert.match(D.renderDiagramTag('figur: judul=Tanpa panel'), /panel.*wajib/i);
  assert.match(D.renderDiagramTag('figur: panel=figur: panel=bangun: bentuk=persegi'), /tidak boleh ditaruh di dalam figur/);
});

test('Gambar: resolves a stored picture, and refuses a non-image data URL', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgo=';
  D.setImageResolver((id) => (id === 'g1' ? { id, name: 'foto.png', dataUrl: PNG } : null));
  const ok = D.renderDiagramTag('gambar: id=g1');
  assert.match(ok, /<img class="ws-image"/);
  assert.match(ok, /src="data:image\/png;base64,iVBORw0KGgo="/);
  assert.match(D.renderDiagramTag('gambar: id=g9'), /tidak ada di penyimpanan/);
  // An id resolving to something that is not an image must never reach src.
  D.setImageResolver(() => ({ id: 'g2', dataUrl: 'javascript:alert(1)' }));
  const bad = D.renderDiagramTag('gambar: id=g2');
  assert.doesNotMatch(bad, /javascript:/);
  assert.match(bad, /bukan berkas gambar yang sah/);
  D.setImageResolver(null);
});

test('Gambar: alt text and the id in the error message are HTML-escaped', () => {
  D.setImageResolver(() => null);
  assert.doesNotMatch(D.renderDiagramTag('gambar: id=<script>'), /<script>/);
  D.setImageResolver((id) => ({ id, name: 'x', dataUrl: 'data:image/png;base64,AA' }));
  const html = D.renderDiagramTag('gambar: id=g1; alt=<b>tebal</b>');
  assert.doesNotMatch(html, /<b>tebal<\/b>/);
  // alt is an ATTRIBUTE value: a bare quote in it must not be able to close
  // the attribute and turn the rest of the naskah into markup.
  const quoted = D.renderDiagramTag('gambar: id=g1; alt=lebar 5" onerror=alert(1)');
  assert.doesNotMatch(quoted, /"\s*onerror/);
  assert.match(quoted, /&quot;/);
  // A stored value that is not a clean data: URL never reaches src.
  D.setImageResolver(() => ({ id: 'g1', dataUrl: 'data:image/png;base64,AA" onerror="alert(1)' }));
  assert.doesNotMatch(D.renderDiagramTag('gambar: id=g1'), /onerror/);
  D.setImageResolver(null);
});

test('Anotasi: teks, panah and ukuran are drawn over any SVG diagram', () => {
  const plain = D.renderDiagramTag('bangun: bentuk=persegi; sisi=5');
  const annotated = D.renderDiagramTag(
    'bangun: bentuk=persegi; sisi=5; teks=50,20:Sisi miring; panah=10,10>40,40:Arah; ukuran=20,90>80,90:8 cm'
  );
  assert.ok(annotated.length > plain.length);
  assert.match(annotated, /Sisi miring/);
  assert.match(annotated, /<polygon/);          // arrowhead
  assert.match(annotated, /8 cm/);
  // Percentages resolve against the diagram's own viewBox, not raw pixels.
  const vb = annotated.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const midX = (parseFloat(vb[1]) * 0.5).toFixed(1);
  assert.ok(annotated.indexOf('x="' + midX + '"') > -1, 'teks at 50% did not land at half the viewBox width');
});

test('Anotasi: annotation text is escaped and a diagram without them is untouched', () => {
  const html = D.renderDiagramTag('bangun: bentuk=persegi; sisi=5; teks=50,50:<img onerror=x>');
  assert.doesNotMatch(html, /<img onerror/);
  const noAnnot = D.renderDiagramTag('bangun: bentuk=persegi; sisi=5');
  assert.doesNotMatch(noAnnot, /paint-order/);
});

test('Kertas grafik: ruled grid, labelled axes, and crosses for pre-plotted points', () => {
  const html = D.renderDiagramTag(
    'kertasgrafik: xmin=0; xmax=10; ymin=0; ymax=20; sumbux=Waktu (s); sumbuy=Jarak (m); kotak=2; subkotak=5; titik=2:6,4:12'
  );
  // Label sumbu gaya A-Level ("besaran / satuan") di ujung panah, tidak diputar.
  assert.match(html, /Waktu \/ s/);
  assert.match(html, /Jarak \/ m/);
  assert.doesNotMatch(html, /rotate\(-90/);
  // Minor ruling is thinner than major ruling — both must actually be drawn.
  assert.ok((html.match(/stroke-width="0.5"/g) || []).length > 20, 'no minor grid drawn');
  assert.ok((html.match(/stroke-width="0.9"/g) || []).length > 4, 'no major grid drawn');
  // Two plotted points, each drawn as a cross (two strokes).
  assert.equal((html.match(/stroke-width="1.4"/g) || []).length, 4); // 4 cross strokes
});

test('Kertas grafik: the y axis picks its own scale when only x squares are auto', () => {
  // 0..10 by 0..200 ruled in steps of 1 on both axes would be 200 squares
  // tall — the y axis must choose its own nice step instead.
  const html = D.renderDiagramTag('kertasgrafik: xmin=0; xmax=10; ymin=0; ymax=200');
  const vb = html.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  assert.ok(parseFloat(vb[2]) < 600, 'graph paper grew unusably tall: ' + vb[2]);
  assert.match(html, />200</);  // top gridline is still labelled
});

test('Ruang jawab: blank table has the asked-for rows, answer lines the asked-for count', () => {
  const table = D.renderDiagramTag('tabelkosong: header=Percobaan,Massa (g); baris=4; tinggi=22');
  assert.equal((table.match(/<tr style="height:22pt">/g) || []).length, 4);
  assert.equal((table.match(/<td><\/td>/g) || []).length, 8); // 4 rows x 2 columns
  assert.match(table, /ws-table-blank/);
  const lines = D.renderDiagramTag('garisjawab: judul=Jawaban:; baris=6; spasi=20');
  assert.equal((lines.match(/class="ws-answer-line"/g) || []).length, 6);
  assert.match(lines, /Jawaban:/);
});

test('Ruang jawab: row/line counts are clamped, so a typo cannot emit 9999 rows', () => {
  const table = D.renderDiagramTag('tabelkosong: header=A,B; baris=9999');
  assert.equal((table.match(/<tr /g) || []).length, 30);
  const lines = D.renderDiagramTag('garisjawab: baris=0');
  assert.equal((lines.match(/class="ws-answer-line"/g) || []).length, 1);
});

test('Integration: new tags survive extract -> tokenize -> substitute inside a worksheet', () => {
  D.resetFigureCounter();
  const raw = `Bagian A: Fisika (PG)
PG1. Perhatikan Gambar 1. [[figur: judul=Rangkaian; panel=rangkaian: tipe=seri; komponen=R1:10,R2:20; sumber=12]] Berapa arus totalnya?
A. $0{,}4$ A
B. $1{,}2$ A

Bagian B: Uraian (E)
E1. Plot data berikut lalu tarik garis lurus terbaik. [[kertasgrafik: xmin=0; xmax=10; ymin=0; ymax=20; sumbux=t (s); sumbuy=s (m)]] Tulis kesimpulanmu. [[garisjawab: baris=3]]`;
  const data = parseWorksheet(raw);
  assert.equal(data.diagramTags.length, 3);
  let html = renderWorksheet(data, { showLogo: false, brandName: 'Test', pgOptionCols: '2', bodyColumns: '1' });
  html = D.substituteDiagramTokens(html, data.diagramTags);
  assert.match(html, /ws-figure/);
  assert.match(html, /Gambar 1 — Rangkaian/);
  assert.match(html, /t \/ s/);   // "t (s)" dicetak gaya A-Level "t / s"
  assert.equal((html.match(/class="ws-answer-line"/g) || []).length, 3);
  assert.doesNotMatch(html, /DG\d/);  // every token was substituted
});


// ---------------------------------------------------------------------
// Alokasi nilai + sub-soal berjenjang
// ---------------------------------------------------------------------
const STRUCTURED_RAW = `Bagian C: Uraian Terstruktur (E)
E1. Perhatikan rangkaian pada Gambar 1.
(a) Nyatakan apa yang dimaksud dengan hambatan. [1]
(b) (i) Hitung hambatan total. [3]
(ii) Jelaskan mengapa arus berkurang. [2]
E2. Hitung daya total rangkaian. [4]

Kunci Jawaban
E1a- Perbandingan tegangan terhadap arus, E1b.i- $30$, E1b.ii- Hambatan naik, E2- $4{,}8$ W`;

test('Nilai: "[3]" is pulled off a stem, and a stem without one keeps its text', () => {
  assert.deepEqual(extractMarks('Hitung hambatan total. [3]'), { text: 'Hitung hambatan total.', marks: 3 });
  assert.deepEqual(extractMarks('Hitung hambatan total.'), { text: 'Hitung hambatan total.', marks: null });
  // A diagram tag ends in "]]" and must never be mistaken for a mark.
  assert.deepEqual(extractMarks('Lihat [[grafik: f1=x^2]]'), { text: 'Lihat [[grafik: f1=x^2]]', marks: null });
});

test('Sub-soal: (a)/(b) nest one level, (i)/(ii) nest under the part above them', () => {
  const data = parseWorksheet(STRUCTURED_RAW);
  const e1 = data.sections[0].items[0];
  assert.equal(e1.stem, 'Perhatikan rangkaian pada Gambar 1.');
  assert.deepEqual(e1.parts.map(p => p.id), ['E1a', 'E1b']);
  assert.deepEqual(e1.parts[1].subs.map(p => p.id), ['E1b.i', 'E1b.ii']);
  // A part that only introduces its roman sub-parts carries no text itself.
  assert.equal(e1.parts[1].text, '');
});

test('Nilai: item, section and paper totals are summed from the parts', () => {
  const data = parseWorksheet(STRUCTURED_RAW);
  const [e1, e2] = data.sections[0].items;
  assert.equal(e1.parts[0].marks, 1);
  assert.equal(e1.parts[1].marks, 5);   // 3 + 2, from its roman sub-parts
  assert.equal(e1.marks, 6);
  assert.equal(e2.marks, 4);
  assert.equal(data.sections[0].marks, 10);
  assert.equal(data.totalMarks, 10);
});

test('Nilai: sub-part ids resolve against the Kunci Jawaban ("E1b.ii-")', () => {
  const data = parseWorksheet(STRUCTURED_RAW);
  assert.equal(data.answerKey['E1a'], 'Perbandingan tegangan terhadap arus');
  assert.equal(data.answerKey['E1b.i'], '$30$');
  assert.equal(data.answerKey['E1b.ii'], 'Hambatan naik');
});

test('Nilai: a naskah with no marks at all prints no marks anywhere', () => {
  const data = parseWorksheet('Bagian A: PG\nPG1. Berapa $2+2$?\nA. $3$\nB. $4$');
  assert.equal(data.totalMarks, null);
  const html = renderWorksheet(data, {
    showLogo: false, brandName: 'T', pgOptionCols: '2', bodyColumns: '1',
    showMarks: true, autoAnswerSpace: true, linesPerMark: 2
  });
  assert.doesNotMatch(html, /ws-marks|Total nilai|nilai\)/);
});

test('Nilai: answer space is sized from the marks, and replaced by the key for the teacher', () => {
  const data = parseWorksheet(STRUCTURED_RAW);
  const base = {
    showLogo: false, brandName: 'T', pgOptionCols: '2', bodyColumns: '1',
    showMarks: true, autoAnswerSpace: true, linesPerMark: 2
  };
  const siswa = renderWorksheet(data, base);
  // (a)=1, (b)(i)=3, (b)(ii)=2, E2=4 marks -> 2 + 6 + 4 + 8 lines
  assert.equal((siswa.match(/class="ws-answer-line"/g) || []).length, 20);
  assert.match(siswa, /\[Total: 6\]/);
  assert.match(siswa, /Total nilai: 10/);
  const guru = renderWorksheet(data, Object.assign({}, base, { showAnswerKey: true }));
  assert.equal((guru.match(/class="ws-answer-line"/g) || []).length, 0);
  assert.equal((guru.match(/ws-part-answer/g) || []).length, 3);
  // showMarks off suppresses the column without touching anything else.
  const tanpaNilai = renderWorksheet(data, Object.assign({}, base, { showMarks: false }));
  assert.doesNotMatch(tanpaNilai, /ws-marks|Total nilai/);
});

test('Sub-soal: markers are found even when the paste collapsed every newline', () => {
  // Copying a naskah out of a chat UI routinely joins the sub-part lines
  // onto the end of the question. That used to drop every sub-part
  // silently and leave its answer key orphaned.
  const inline = `Bagian Penalaran: (E)
E1. Suatu fungsi $f(x) = -x^2 + 6x - 5$. (a) Tentukan titik potong sumbu-$X$. [2] (b) Tentukan titik balik. [2] (c) Hitung luasnya. [3]
E2. Biaya $C(x) = 2x^3 - 30x^2$. (a) Tentukan $MC(x) = C'(x)$. [1] (b) (i) Tentukan intervalnya. [3] (ii) Tentukan minimumnya. [2]

Kunci Jawaban
E1a-(1, 0), E1b-(3, 4), E1c-\\frac{32}{3}, E2a-$6x^2-60x$, E2b.i-$x<5$, E2b.ii-$5$`;
  const data = parseWorksheet(inline);
  const [e1, e2] = data.sections[0].items;
  assert.deepEqual(e1.parts.map(p => p.id), ['E1a', 'E1b', 'E1c']);
  assert.deepEqual(e2.parts.map(p => p.id), ['E2a', 'E2b']);
  assert.deepEqual(e2.parts[1].subs.map(p => p.id), ['E2b.i', 'E2b.ii']);
  assert.equal(e1.marks, 7);
  // The whole point: no orphaned answer keys once the sub-parts are found.
  assert.deepEqual(validateWorksheet(data, ''), []);
});

test('Sub-soal: same naskah parses identically whether or not the newlines survived', () => {
  const body = `Bagian Penalaran: (E)
E1. Suatu fungsi $f(x)$.{SEP}(a) Tentukan A. [2]{SEP}(b) Tentukan B. [3]

Kunci Jawaban
E1a-A, E1b-B`;
  const withLines = parseWorksheet(body.split('{SEP}').join('\n'));
  const inline = parseWorksheet(body.split('{SEP}').join(' '));
  const shape = (d) => JSON.stringify(d.sections[0].items.map(i => ({
    id: i.id, marks: i.marks, parts: (i.parts || []).map(p => [p.id, p.text, p.marks])
  })));
  assert.equal(shape(inline), shape(withLines));
});

test('Sub-soal: maths and prose in brackets are never mistaken for markers', () => {
  // Every one of these is lifted from a real TKA Matematika naskah.
  const raw = `Bagian Penalaran: (E)
E1. Diketahui $f(x) = ax^2$, $C(n, r)$, $P(A \\cup B)$, dan $MC(x) = C'(x)$ dengan $\\sin(x)$ serta $(x-1)(x-5) = 0$. Untuk $1 \\le x \\le 12$ ($\\det(A) = 0$), hitung $(3, 4)$ dan $(2)(3)$. [4]

Kunci Jawaban
E1-selesai`;
  const item = parseWorksheet(raw).sections[0].items[0];
  assert.equal(item.parts, undefined, 'brackets in maths were read as sub-parts');
  assert.equal(item.marks, 4);
});

test('Sub-soal: a bracket that does not continue the sequence is ignored', () => {
  const raw = `Bagian Penalaran: (E)
E1. Soal induk.
(a) Bagian pertama. [1]
Catatan tambahan (v) yang bukan penanda, dan (z) juga bukan.
(b) Bagian kedua. [2]

Kunci Jawaban
E1a-x, E1b-y`;
  const item = parseWorksheet(raw).sections[0].items[0];
  assert.deepEqual(item.parts.map(p => p.id), ['E1a', 'E1b']);
  // "(v)" would only be a marker after (iv); "(z)" is not a label at all.
  assert.equal(item.parts[0].subs.length, 0);
  assert.match(item.parts[0].text, /Catatan tambahan \(v\)/);
});

test('Sub-soal: only uraian (E) items get sub-parts — PG/B/I stems are left alone', () => {
  const raw = `Bagian A: Pilihan Ganda (PG)
PG1. Diketahui (a) sebagai koefisien dan (b) sebagai konstanta. [2]
A. $1$
B. $2$
C. $3$
D. $4$

Bagian B: Konsep (B)
B1. Jika ($\\det(A) = 0$) maka (a) tidak punya invers. [1]

Kunci Jawaban
PG1-B, B1-Benar`;
  const data = parseWorksheet(raw);
  assert.equal(data.sections[0].items[0].parts, undefined);
  assert.equal(data.sections[1].items[0].parts, undefined);
  assert.equal(data.sections[0].items[0].marks, 2);
  assert.deepEqual(validateWorksheet(data, ''), []);
});

test('Sub-soal: a section header code like "(E)" never becomes a marker', () => {
  // Codes are uppercase and the label pattern is lowercase-only, but this
  // pins the behaviour so a future loosening cannot break section parsing.
  const data = parseWorksheet(`Bagian Penalaran dan Analisis: (E)
E1. Soal tanpa sub-soal. [2]

Kunci Jawaban
E1-jawaban`);
  assert.equal(data.sections.length, 1);
  assert.equal(data.sections[0].type, 'e');
  assert.equal(data.sections[0].items[0].parts, undefined);
});

test('Nilai: mid-sentence "(x)" in a formula is not mistaken for a sub-part', () => {
  const data = parseWorksheet('Bagian A: Uraian (E)\nE1. Diketahui f(x) = 2x + 1. Hitung f(3). [2]');
  const item = data.sections[0].items[0];
  assert.equal(item.parts, undefined);
  assert.equal(item.marks, 2);
  assert.match(item.stem, /f\(x\) = 2x \+ 1/);
});

test('Paket: shuffling renumbers sub-part ids along with their parent', () => {
  const data = parseWorksheet(STRUCTURED_RAW);
  const variant = makeVariant(data, 11, { shuffleItems: true });
  variant.sections[0].items.forEach((item) => {
    (item.parts || []).forEach((part) => {
      assert.ok(part.id.indexOf(item.id) === 0, part.id + ' does not belong to ' + item.id);
      (part.subs || []).forEach((sub) => {
        assert.ok(sub.id.indexOf(part.id + '.') === 0);
        // The answer must have travelled with the sub-part it belongs to.
        assert.ok(variant.answerKey[sub.id] != null, 'lost answer for ' + sub.id);
      });
    });
  });
});

// ---------------------------------------------------------------------
// Pemeriksaan naskah (validator)
// ---------------------------------------------------------------------
test('Validator: a clean worksheet reports nothing', () => {
  const data = parseWorksheet(`Bagian A: PG
PG1. Berapa $2+2$?
A. $3$
B. $4$
C. $5$
D. $6$

Kunci Jawaban
PG1-B`);
  assert.deepEqual(validateWorksheet(data, ''), []);
});

test('Validator: catches unknown tags, short PG, gaps, orphan and missing keys', () => {
  const data = parseWorksheet(`Bagian A: PG
PG1. Perhatikan [[ngawurbanget: a=1]] lalu jawab.
A. $3$
B. $4$
C. $5$
D. $6$
PG2. Berapa $1+1$?
A. $1$
B. $2$
PG4. Berapa $3+3$?
A. $5$
B. $6$
C. $7$
D. $8$

Kunci Jawaban
PG1-B, PG9-C`);
  const issues = validateWorksheet(data, '');
  const text = issues.map(i => i.level + ':' + i.text).join('\n');
  assert.match(text, /error:.*ngawurbanget/);
  assert.match(text, /warn:.*PG2 hanya punya 2 pilihan/);
  assert.match(text, /warn:.*melompat dari PG2 ke PG4/);
  assert.match(text, /warn:.*"PG9" tidak punya soal/);
  assert.match(text, /warn:.*Belum ada kunci jawaban.*PG2/);
});

test('Validator: a structured item needs no key of its own, only its parts do', () => {
  const data = parseWorksheet(STRUCTURED_RAW);
  const issues = validateWorksheet(data, '');
  // E1 and E1b both only introduce their sub-parts — neither should be
  // reported as a question missing its answer.
  assert.doesNotMatch(issues.map(i => i.text).join('\n'), /E1\b|E1b\b/);
});

test('Validator: reports a picture whose id is no longer in the store', () => {
  const D2 = require('./diagrams.js');
  D2.setImageResolver(() => null);
  const data = parseWorksheet('Bagian A: PG\nPG1. Lihat [[gambar: id=g7]].\nA. $1$\nB. $2$\nC. $3$\nD. $4$\n\nKunci Jawaban\nPG1-A');
  const issues = validateWorksheet(data, '');
  assert.match(issues.map(i => i.text).join('\n'), /g7.*tidak ada di penyimpanan/);
  D2.setImageResolver(null);
});

test('Validator: labels each set when several are pasted together', () => {
  const data = parseWorksheet('Bagian A: PG\nPG1. Lihat [[ngawur: x=1]].\nA. $1$\nB. $2$\nC. $3$\nD. $4$');
  const issues = validateWorksheet(data, 'Set 2');
  assert.match(issues[0].text, /^Set 2: /);
});

// ---------------------------------------------------------------------
// Renderer baru: statistika, rangkaian, alat lab, geometri, biologi
// ---------------------------------------------------------------------
test('Grafik: axis captions, shading, tangent triangle and asymptotes all draw', () => {
  const html = D.renderDiagramTag(
    'grafik: f1=x^2-4; xmin=-4; xmax=4; ymin=-6; ymax=12; sumbux=Waktu (s); sumbuy=Jarak (m); arsir=f1:0,3; singgung=f1:2; asimtot=y=0'
  );
  assert.match(html, /Waktu \/ s/);               // label sumbu gaya A-Level di ujung panah
  assert.match(html, /Jarak \/ m/);
  assert.match(html, /fill-opacity="0.12"/);      // shaded area under the curve
  assert.match(html, /stroke-dasharray="7,3"/);   // tangent line
  assert.match(html, /stroke-dasharray="2,2"/);   // gradient triangle
  assert.match(html, /stroke-dasharray="4,4"/);   // asymptote
  // The translate group added for the captions must be closed exactly once.
  assert.equal((html.match(/<g /g) || []).length, (html.match(/<\/g>/g) || []).length);
});

test('Grafik: a restricted domain draws the curve over a narrower span of the axes', () => {
  const spanOf = (html) => {
    // The curve is sampled at a fixed number of points whatever the domain,
    // so it is the x EXTENT of the drawn path that shrinks, not its length.
    const d = (html.match(/<path d="([^"]*)" fill="none" stroke="#000000" stroke-width="[\d.]+"/) || ['', ''])[1];
    const xs = [...d.matchAll(/[ML]([\d.]+) /g)].map(m => parseFloat(m[1]));
    return Math.max.apply(null, xs) - Math.min.apply(null, xs);
  };
  const full = spanOf(D.renderDiagramTag('grafik: f1=x^2; xmin=-5; xmax=5; ymin=0; ymax=25'));
  const limited = spanOf(D.renderDiagramTag('grafik: f1=x^2; xmin=-5; xmax=5; ymin=0; ymax=25; domain=f1:-2,2'));
  assert.ok(full > 0 && limited > 0, 'no curve was drawn at all');
  // -2..2 is two fifths of -5..5, so the drawn span should be about 40%.
  assert.ok(limited < full * 0.5, 'domain did not narrow the curve: ' + limited + ' vs ' + full);
});

test('Pencar: least-squares fit is exact on collinear data, crosses and error bars draw', () => {
  const fit = D.leastSquaresFit([1, 2, 3, 4], [2, 4, 6, 8]);
  assert.equal(fit.m, 2);
  assert.equal(fit.c, 0);
  assert.equal(fit.r, 1);
  const html = D.renderDiagramTag('pencar: x=1,2,3; y=2,4,6; galat=0.5; rerata=ya; sumbuy=Panjang (cm)');
  assert.equal((html.match(/stroke-width="1.4"/g) || []).length, 7); // 3 crosses x2 + mean ring
  assert.match(html, /Panjang \/ cm/);   // label sumbu gaya A-Level
  assert.match(html, /r="4"/); // mean point ring
});

test('Histogram: unequal class widths become frequency density, not raw height', () => {
  // 0-10 freq 5 -> density 0.5 ; 20-50 freq 12 over width 30 -> density 0.4.
  // So the WIDE class must be the SHORTER bar despite the larger frequency.
  const html = D.renderDiagramTag('histogram: batas=0,10,20,50; frekuensi=5,8,12');
  const rects = [...html.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
    .map(m => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }));
  const bars = rects.filter(r => r.x > 1);           // skip the background frame
  assert.equal(bars.length, 3);
  assert.ok(bars[2].w > bars[0].w, 'third class should be the widest');
  assert.ok(bars[2].h < bars[0].h, 'widest class should be the shortest bar (density, not frequency)');
  assert.match(html, /densitas frekuensi/i);
});

test('Batang-daun: stems fill gaps and the key line explains the notation', () => {
  const html = D.renderDiagramTag('batangdaun: data=12,15,41; satuan=10');
  // Stems 1..4 — 2 and 3 are empty but must still be shown.
  ['>1<', '>2<', '>3<', '>4<'].forEach(t => assert.ok(html.indexOf(t) > -1, 'missing stem ' + t));
  assert.match(html, /Kunci: 1 \| 2 = 12/);
});

test('Rangkaian: component kinds parse, draw their own symbol, and R1:10 still works', () => {
  assert.deepEqual(D.parseCircuitComponent('R1:10'), { name: 'R1', kind: 'resistor', value: 10 });
  assert.equal(D.parseCircuitComponent('S1:saklar').kind, 'saklar');
  assert.equal(D.parseCircuitComponent('Rv:geser:20').value, 20);
  const html = D.renderDiagramTag('rangkaian: tipe=seri; komponen=R1:10,A1:amperemeter,S1:saklar,L1:lampu; sumber=12');
  assert.match(html, />A</);              // ammeter
  assert.match(html, /R1 = 10 Ω/);        // original resistor labelling intact
  // A voltmeter goes in a parallel branch across the component it measures.
  assert.match(D.renderDiagramTag('rangkaian: tipe=campuran; susunan=R1:10+(R2:20|V1:voltmeter); sumber=6'), />V</);
});

test('Alat lab: every apparatus renders, and label=tidak strips all its captions', () => {
  Object.keys(D.LAB_APPARATUS).forEach((jenis) => {
    const html = D.renderDiagramTag('alatlab: jenis=' + jenis);
    assert.doesNotMatch(html, /diagram error/, jenis + ' failed to draw');
    assert.ok((html.match(/<text/g) || []).length >= 4, jenis + ' has no part labels');
    const blank = D.renderDiagramTag('alatlab: jenis=' + jenis + '; label=tidak');
    assert.equal((blank.match(/<text/g) || []).length, 0, jenis + ' still labelled');
  });
  assert.match(D.renderDiagramTag('alatlab: jenis=tidakada'), /tidak dikenal/);
});

test('Geometri: circle theorems, nets and plan views all render for every variant', () => {
  Object.keys(D.CIRCLE_THEOREMS).forEach((jenis) => {
    assert.doesNotMatch(D.renderDiagramTag('lingkaranteorema: jenis=' + jenis), /diagram error/, jenis);
  });
  Object.keys(D.SOLID_NETS).forEach((bentuk) => {
    assert.doesNotMatch(D.renderDiagramTag('jaring: bentuk=' + bentuk), /diagram error/, bentuk);
  });
  Object.keys(D.SOLID_VIEWS).forEach((bentuk) => {
    const html = D.renderDiagramTag('pandangan: bentuk=' + bentuk);
    assert.equal((html.match(/Tampak/g) || []).length, 3, bentuk);
  });
  // Right-angle marks are what make the 90° theorems readable.
  assert.match(D.renderDiagramTag('lingkaranteorema: jenis=semilingkaran'), /<path d="M[\d.]+ [\d.]+ L/);
});

test('Punnett: monohybrid gives 1:2:1 and 3:1, dihybrid gives 9:3:3:1', () => {
  const mono = D.renderDiagramTag('punnett: induk1=Aa; induk2=Aa');
  assert.match(mono, /Genotipe — AA 1 : Aa 2 : aa 1/);
  assert.match(mono, /Fenotipe — A_ 3 : aa 1/);
  const di = D.renderDiagramTag('punnett: induk1=AaBb; induk2=AaBb');
  assert.match(di, /Fenotipe — A_B_ 9 : A_bb 3 : aaB_ 3 : aabb 1/);
  // A blank grid keeps the gamete headers but empties the cells.
  const blank = D.renderDiagramTag('punnett: induk1=Aa; induk2=Aa; jawaban=kosong');
  assert.doesNotMatch(blank, />Aa</);
  assert.match(blank, />A</);
  assert.match(D.renderDiagramTag('punnett: induk1=Aa; induk2=AaBb'), /jumlah gen yang sama/);
});

test('Jaring makanan: trophic levels are derived, producers sit at the bottom', () => {
  const html = D.renderDiagramTag('jaringmakanan: hubungan=Rumput>Belalang, Belalang>Katak, Katak>Ular');
  const yOf = (name) => {
    const re = new RegExp('<rect x="([\\d.]+)" y="([\\d.]+)"[^>]*/><text x="[\\d.]+" y="[\\d.]+"[^>]*>' + name + '<');
    const m = html.match(re);
    return m ? parseFloat(m[2]) : null;
  };
  // Larger y is lower on the page: the producer must be below its predator.
  assert.ok(yOf('Rumput') > yOf('Belalang'));
  assert.ok(yOf('Belalang') > yOf('Katak'));
  assert.ok(yOf('Katak') > yOf('Ular'));
});

test('Kunci determinasi: numeric results read as "lanjut ke", names stay names', () => {
  const html = D.renderDiagramTag('kuncideterminasi: langkah=1a:Berdaun jarum:Pinus|1b:Berdaun lebar:2|2a:Menjari:Pepaya|2b:Menyirip:Mangga');
  assert.match(html, /lanjut ke 2/);
  assert.match(html, />Pinus</);
  assert.match(html, /font-style="italic"[^>]*>Pinus</);
  assert.match(D.renderDiagramTag('kuncideterminasi: judul=x'), /diagram error/);
});

// ---------------------------------------------------------------------
// Grafik gerak: nilai di sumbu y
// ---------------------------------------------------------------------
test('Gerak: every vertex value is printed on the y-axis, with dashed guides', () => {
  const html = D.renderDiagramTag('gerak: tipe=kecepatan-waktu; titik=0:0,2:10,5:10,8:0');
  // y-axis tick labels are anchored "end" just left of the axis (x = pad-6 = 38).
  assert.match(html, /<text x="38(?:\.0)?" y="[\d.]+" font-size="10" text-anchor="end" fill="#[0-9a-f]{6}">10<\/text>/);
  assert.match(html, /<text x="38(?:\.0)?" y="[\d.]+" font-size="10" text-anchor="end" fill="#[0-9a-f]{6}">0<\/text>/);
  assert.match(html, /stroke-dasharray="3,3"/);
  // Label kemiringan "m=..." sengaja dibuang: bukan konvensi grafik naskah
  // A-Level, dan angkanya sering bertabrakan dengan kurva/label lain.
  assert.doesNotMatch(html, /m=\d/);
});

test('Gerak: bantu=tidak drops the guide lines but keeps the y-axis values', () => {
  const html = D.renderDiagramTag('gerak: titik=0:0,4:20; bantu=tidak');
  assert.doesNotMatch(html, /stroke-dasharray="3,3"/);
  assert.match(html, /text-anchor="end" fill="#[0-9a-f]{6}">20<\/text>/);
});

test('Gerak: values too close together on the y-axis are not printed twice', () => {
  const html = D.renderDiagramTag('gerak: titik=0:0,2:100,4:101,6:0');
  const labels = (html.match(/font-size="10" text-anchor="end" fill="#[0-9a-f]{6}">[\d.]+<\/text>/g) || []);
  assert.equal(labels.length, 2); // 0 and 100 — 101 sits under 10px away
});

test('Gerak: sumbux/sumbuy override the axis titles, in A-Level "besaran / satuan" form', () => {
  const html = D.renderDiagramTag('gerak: titik=0:0,2:10; sumbuy=v (km/jam); sumbux=t (jam)');
  // "v (km/jam)" ditulis pemakai dengan satuan berkurung; labelSumbuALevel
  // membawanya ke bentuk "besaran / satuan" seperti naskah Cambridge.
  assert.match(html, />v \/ km jam⁻¹</);
  assert.match(html, />t \/ jam</);
});

// ---------------------------------------------------------------------
// sanitizeMath: LaTeX mistakes AI keys make that KaTeX refuses outright
// ---------------------------------------------------------------------
test('Math: a superscript inside \\text{} (AI-style "\\text{ ^\\circ C}") is lifted out so KaTeX can parse it', () => {
  const raw = `Bagian A: Pilihan Ganda (PG)
PG1. Air dipanaskan dari $20.0\\text{ ^\\circ C}$ ke $29.0\\text{^{\\circ}C}$. Berapa $\\Delta T$?
A. $+9.0\\text{ ^\\circ C}$
B. $-9.0\\text{ ^\\circ }$
Kunci Jawaban: 1. A
Pembahasan: 1. $\\Delta T = 29.0 - 20.0 = +9.0\\text{ ^\\circ C}$`;
  const { html } = render(raw);
  assert.doesNotMatch(html, /\\text\{\s*\^/);
  assert.match(html, /20\.0\^\\circ\\text\{C\}/);
  assert.match(html, /29\.0\^\\circ\\text\{C\}/);
  assert.match(html, /-9\.0\^\\circ\$/);
  assert.match(html, /\+9\.0\^\\circ\\text\{C\}\$/);
});

// --- A-Level: grafik & statistik ---
// Konvensi naskah Cambridge/Edexcel: hitam-putih, sumbu berpanah berlabel
// "besaran / satuan" di ujung panah, teks >= 9.5 pt, kurva di-clip ke daerah
// plot, seri dibedakan pola garis/arsiran (bukan warna). Tes tidak mengunci
// hex warna: yang dicek hanya "semua warna abu-abu" (r = g = b).
const TAG_GRAFIK_STAT = [
  'grafik: f1=x^2-4; xmin=-5; xmax=5; ymin=-6; ymax=12; sumbux=Waktu (s); arsir=f1:0,3; singgung=f1:2',
  'grafik: f1=sin(x); f2=cos(x); f3=0.5x; xmin=-4; xmax=4; ymin=-2; ymax=2',
  'programlinear: pertidaksamaan=2x+y<=10,x+3y<=12,x>=0,y>=0; xmax=8; ymax=8',
  'statistik: tipe=lingkaran; label=Bola,Basket,Renang,Catur; data=12,8,5,1',
  'statistik: tipe=batang; label=Sen,Sel,Rab; data=12,8,5',
  'statistik: tipe=garis; label=2019,2020,2021; data=12,18,5',
  'ogive: data=12,15,15,18,20,22,25,28,30,35',
  'boxplot: data=12,15,15,18,20,22,25,28,30,35',
  'pencar: x=1,2,3,4,5; y=2.1,3.9,6.2,7.8,10.1; sumbux=Massa (g); sumbuy=Panjang (cm); galat=0.3',
  'histogram: batas=0,10,20,50; frekuensi=5,8,12',
  'batangdaun: data=12,15,15,21,23,34,38,41; satuan=10',
  'piktogram: simbol=bintang; skala=5; label=Sen,Sel; data=15,10',
  'pohonpeluang: level1=Merah:2/5,Biru:3/5; level2=Merah:2/5,Biru:3/5',
  'kertasgrafik: xmin=0; xmax=10; ymin=0; ymax=20; sumbux=Waktu (s); sumbuy=Jarak (m); subkotak=5',
  'garisbilangan: min=-10; max=10; step=1; titik=3:A,-5:B',
];

test('A-Level: semua grafik/statistik hitam-putih, teks >= 9.5 pt, tanpa bingkai, tanpa error', () => {
  TAG_GRAFIK_STAT.forEach((tag) => {
    const html = D.renderDiagramTag(tag);
    assert.doesNotMatch(html, /diagram error/, tag);
    const sizes = [...html.matchAll(/font-size="([\d.]+)"/g)].map((m) => parseFloat(m[1]));
    assert.ok(sizes.length && Math.min.apply(null, sizes) >= 9.5, 'teks terlalu kecil di ' + tag);
    // Hanya abu-abu: r = g = b untuk setiap warna yang tercetak.
    [...html.matchAll(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})\b/gi)].forEach((m) => {
      assert.ok(m[1].toLowerCase() === m[2].toLowerCase() && m[2].toLowerCase() === m[3].toLowerCase(), 'warna bukan abu-abu di ' + tag + ': #' + m[1] + m[2] + m[3]);
    });
    // Bingkai lama = rect latar dengan stroke abu-abu yang benar-benar
    // tercetak (rapikanSVG menetralkan stroke-nya jadi "none", dan sebuah
    // rect fill="#ffffff" stroke="none" di 0.5,0.5 tidak tampil sebagai
    // bingkai apa pun — jadi memeriksa posisinya saja salah menandai itu).
    assert.doesNotMatch(html, /<rect x="0.5" y="0.5"[^>]*stroke="(?!none)[^"]/, 'masih ada bingkai tampak di ' + tag);
  });
});

test('A-Level grafik: kurva di-clip ke daerah plot, id clip unik antar gambar', () => {
  const a = D.renderDiagramTag(TAG_GRAFIK_STAT[0]);
  const b = D.renderDiagramTag(TAG_GRAFIK_STAT[0]);
  const idA = (a.match(/<clipPath id="([^"]+)"/) || [])[1];
  const idB = (b.match(/<clipPath id="([^"]+)"/) || [])[1];
  assert.ok(idA && idB && idA !== idB, 'clipPath harus ada dan unik per gambar');
  assert.match(a, new RegExp('<g clip-path="url\\(#' + idA + '\\)">'));
  // Kurva (path pertama setelah arsiran) berada di dalam grup ber-clip.
  const grup = a.slice(a.indexOf('<g clip-path'), a.indexOf('</g>'));
  assert.match(grup, /<path d="M[^"]*" fill="none" stroke="#000000"/);
  // Parabola dengan ymax=12 memang menembus tepi atas: titik path boleh di
  // luar plot karena clip yang memotong — yang penting clip-nya ada.
  const vb = a.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  assert.ok(parseFloat(vb[2]) < 320, 'kanvas tidak boleh membengkak: ' + vb[2]);
});

test('A-Level grafik: sumbu berpanah, label di ujung sumbu (x/y bawaan, "Waktu / s" dari sumbux), titik asal "O"', () => {
  const polos = D.renderDiagramTag('grafik: f1=x; xmin=-4; xmax=4; ymin=-4; ymax=4');
  assert.ok((polos.match(/<polygon points=/g) || []).length >= 2, 'dua kepala panah sumbu');
  assert.match(polos, />x<\/text>/);
  assert.match(polos, />y<\/text>/);
  assert.match(polos, />O<\/text>/);
  const bersatuan = D.renderDiagramTag(TAG_GRAFIK_STAT[0]);
  assert.match(bersatuan, />Waktu \/ s<\/text>/);
  assert.doesNotMatch(bersatuan, /Waktu \(s\)/);
  // Label sumbu x berada di KANAN ujung panah (di luar daerah plot 328 px).
  const lx = parseFloat(bersatuan.match(/<text x="([\d.]+)" y="[\d.]+" font-size="[\d.]+" fill="#000000">Waktu \/ s/)[1]);
  assert.ok(lx > 328, 'label sumbu x harus di luar plot: ' + lx);
});

test('A-Level grafik: dua kurva atau lebih dibedakan pola garis dan diberi nama f1/f2 di dekat kurva', () => {
  const html = D.renderDiagramTag(TAG_GRAFIK_STAT[1]);
  const kurva = [...html.matchAll(/<path d="M[^"]*" fill="none" stroke="#000000" stroke-width="[\d.]+"( stroke-dasharray="[^"]+")?\/>/g)];
  assert.equal(kurva.length, 3);
  assert.equal(kurva[0][1], undefined);          // f1 padat
  assert.match(kurva[1][1], /stroke-dasharray/);  // f2 putus
  assert.match(kurva[2][1], /stroke-dasharray/);  // f3 titik
  assert.notEqual(kurva[1][1], kurva[2][1]);
  ['f1', 'f2', 'f3'].forEach((n) => assert.ok((html.match(new RegExp('>' + n + '<')).length), 'label ' + n));
  // Satu kurva: tidak ada label f1 maupun legenda.
  const satu = D.renderDiagramTag('grafik: f1=x^2; xmin=-3; xmax=3');
  assert.doesNotMatch(satu, />f1</);
});

test('A-Level statistik lingkaran: label nama+persen di juring, pola arsiran, garis penunjuk untuk juring sempit, id pola unik', () => {
  const a = D.renderDiagramTag(TAG_GRAFIK_STAT[3]);
  assert.doesNotMatch(a, /1\. Bola/);           // daftar bernomor lama hilang
  assert.match(a, />Bola<\/text>/);
  assert.match(a, />46\.2%<\/text>/);           // 12/26
  assert.match(a, /<pattern id=/);
  assert.match(a, /fill="url\(#/);
  assert.match(a, /<polyline/);                 // Catur (3.8%) diberi garis penunjuk
  assert.match(a, /Catur 3\.8%/);
  const b = D.renderDiagramTag(TAG_GRAFIK_STAT[3]);
  const idA = a.match(/<pattern id="([^"]+)"/)[1], idB = b.match(/<pattern id="([^"]+)"/)[1];
  assert.notEqual(idA, idB);
  const lebar = D.renderDiagramTag('statistik: tipe=lingkaran; label=A,B; data=1,1');
  assert.doesNotMatch(lebar, /<polyline/);     // juring lebar tidak perlu penunjuk
});

test('A-Level statistik batang/garis: sumbu berpanah berlabel "frekuensi", angka skala, nilai di atas batang', () => {
  const batang = D.renderDiagramTag(TAG_GRAFIK_STAT[4]);
  assert.match(batang, />frekuensi<\/text>/);
  assert.ok((batang.match(/<polygon points=/g) || []).length >= 2);
  assert.equal((batang.match(/<rect /g) || []).length, 3);
  assert.match(batang, /<rect [^>]*fill="#[0-9a-f]{6}" stroke="#000000"/); // batang berisi + bertepi
  [12, 8, 5].forEach((v) => assert.match(batang, new RegExp('>' + v + '<')));
  assert.match(batang, />Sen<\/text>/);
  const garis = D.renderDiagramTag(TAG_GRAFIK_STAT[5]);
  assert.match(garis, />frekuensi<\/text>/);
  assert.equal((garis.match(/<circle /g) || []).length, 3);
});

test('A-Level ogive: label "frekuensi kumulatif", angka skala di kedua sumbu, kuartil abu-abu putus-putus', () => {
  const html = D.renderDiagramTag(TAG_GRAFIK_STAT[6]);
  assert.match(html, />frekuensi kumulatif<\/text>/);
  assert.match(html, />12<\/text>/);   // skala x mulai dari data terkecil
  assert.match(html, />10<\/text>/);   // n = 10 di sumbu y
  ['Q1', 'Q2', 'Q3'].forEach((q) => assert.match(html, new RegExp('>' + q + '<')));
  assert.match(html, /Q2 ≈ 20/);
  assert.equal((html.match(/stroke-dasharray="6 4"/g) || []).length, 6); // 3 kuartil x 2 garis bantu
});

test('A-Level boxplot: skala bernomor berpanah di bawah kotak, nama lima serangkai tidak bertumpuk', () => {
  const html = D.renderDiagramTag(TAG_GRAFIK_STAT[7]);
  assert.ok((html.match(/<polygon points=/g) || []).length >= 1);
  assert.ok((html.match(/text-anchor="middle">\d+<\/text>/g) || []).length >= 8, 'angka skala kurang');
  assert.match(html, />Median<\/text>/);
  // Q1=6 dan Median=7 terlalu rapat: salah satunya naik satu baris.
  const rapat = D.renderDiagramTag('boxplot: min=5; q1=6; median=7; q3=12; max=20');
  const ys = [...rapat.matchAll(/<text x="[\d.]+" y="([\d.]+)" font-size="[\d.]+" text-anchor="middle" fill="#000000">(?:Min|Q1|Median|Q3|Max)</g)].map((m) => m[1]);
  assert.equal(new Set(ys).size, 2);
});

test('A-Level pencar & histogram: garis regresi putus-putus, tanda silang, label sumbu di ujung panah', () => {
  const pencar = D.renderDiagramTag(TAG_GRAFIK_STAT[8]);
  assert.match(pencar, /<line [^>]*stroke-dasharray="6 4"\/>/);       // garis lurus terbaik
  assert.equal((pencar.match(/stroke-width="1.4"/g) || []).length, 10); // 5 silang x 2
  assert.match(pencar, />Massa \/ g<\/text>/);
  assert.match(pencar, />Panjang \/ cm<\/text>/);
  assert.doesNotMatch(pencar, /rotate\(-90/);
  const hist = D.renderDiagramTag(TAG_GRAFIK_STAT[9]);
  assert.match(hist, />densitas frekuensi<\/text>/);
  assert.equal((hist.match(/<rect /g) || []).length, 3);
  [0, 10, 20, 50].forEach((b) => assert.match(hist, new RegExp('>' + b + '<')));
});

test('A-Level kertas grafik & garis bilangan: sumbu hitam berpanah, "O" di titik asal, kanvas dipotong pas', () => {
  const kertas = D.renderDiagramTag(TAG_GRAFIK_STAT[13]);
  assert.ok((kertas.match(/<polygon points=/g) || []).length >= 2);
  assert.match(kertas, />O<\/text>/);
  assert.doesNotMatch(kertas, /<rect /);         // tidak ada bingkai; sumbu adalah garis berpanah
  const gb = D.renderDiagramTag(TAG_GRAFIK_STAT[14]);
  const vb = gb.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  assert.ok(parseFloat(vb[2]) < 80, 'garis bilangan tidak butuh kanvas tinggi: ' + vb[2]);
  assert.equal((gb.match(/<polygon points=/g) || []).length, 2);
  assert.match(gb, />A<\/text>/);
  // Skala terlalu rapat (101 angka) dijarangkan otomatis, tanda tetap semua.
  const rapat = D.renderDiagramTag('garisbilangan: min=0; max=100; step=1');
  assert.ok((rapat.match(/<text /g) || []).length <= 26);
  assert.equal((rapat.match(/<line /g) || []).length, 101 + 2);
});

test('A-Level pohon peluang & program linear: nama simpul tidak tertimpa cabang berikutnya, arsiran abu-abu', () => {
  const pohon = D.renderDiagramTag(TAG_GRAFIK_STAT[12]);
  assert.match(pohon, /P = 0\.16/);
  // Cabang tahap 2 mulai di sebelah kanan nama simpul tahap 1 (x lebih besar).
  const simpul1 = parseFloat(pohon.match(/<circle cx="([\d.]+)"/g)[1].match(/[\d.]+/)[0]);
  const cabang2 = [...pohon.matchAll(/<line x1="([\d.]+)"/g)].map((m) => parseFloat(m[1])).filter((x) => x > simpul1);
  assert.ok(cabang2.length >= 4 && Math.min.apply(null, cabang2) > simpul1 + 20, 'cabang tahap 2 harus mulai setelah nama simpul');
  const lp = D.renderDiagramTag(TAG_GRAFIK_STAT[2]);
  assert.match(lp, /<pattern id="lpHatch\d+"/);
  assert.match(lp, /fill="url\(#lpHatch/);
  assert.match(lp, />x<\/text>/);
  assert.match(lp, />y<\/text>/);
  assert.match(lp, /\(3\.6, 2\.8\)/);
});

// ---------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------
let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    console.log(`  ok  - ${t.name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  - ${t.name}`);
    console.log(`        ${err.message}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);
