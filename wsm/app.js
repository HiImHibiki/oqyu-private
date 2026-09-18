/* Exact Worksheet Maker
 * Parses a semi-structured Indonesian worksheet script (formulas / multiple
 * choice / true-false / answer key / explanations) and renders it as a
 * print-ready A4 worksheet. Falls back to a plain flowing layout for
 * unstructured text. Math/chemistry rendered via KaTeX + mhchem.
 */

// ---------------------------------------------------------------------
// 1. PARSER
// ---------------------------------------------------------------------

function toNiceCase(s) {
  if (!/[a-z]/.test(s) && /[A-Z]/.test(s)) {
    return s.replace(/\w\S*/g, w => w.charAt(0) + w.slice(1).toLowerCase());
  }
  return s;
}

// A sub-topic heading with no marker of its own — e.g. a worksheet that
// groups one section's items by skill ("Coordinating Conjunctions
// (FANBOYS)" before PG4, then "Connectives & Vocabulary in Context" before
// PG9), or groups the Kunci Jawaban block into the same sub-topics as the
// questions ("Pilihan Ganda" / "Isian" / "Essay") — has nothing to delimit
// it from whatever precedes it, so it ends up glued onto that item's last
// option/stem/answer with no space of its own. Strip it back off — but only
// when a blank line clearly separates the real content from a short,
// heading-shaped trailing paragraph (letters/spacing/light punctuation
// only, no digits, and critically no sentence-ending punctuation like "."/
// "?"/"!"). A genuine answer or option practically never has that exact
// shape, so this rarely fires on real content.
const STRAY_HEADING_TAIL_RE = /^[A-Za-z][A-Za-z\s/()&,:;-]{0,160}$/;
function stripStrayHeading(text) {
  if (!text) return text;
  const blankLineRe = /\n[ \t]*\n/g;
  let bm, lastBlankEnd = -1;
  while ((bm = blankLineRe.exec(text))) lastBlankEnd = bm.index + bm[0].length;
  if (lastBlankEnd === -1) return text;
  const tail = text.slice(lastBlankEnd).trim();
  if (tail && !/\d/.test(tail) && STRAY_HEADING_TAIL_RE.test(tail)) {
    return text.slice(0, lastBlankEnd).trim();
  }
  return text;
}

// ---------------------------------------------------------------------
// Alokasi nilai + sub-soal berjenjang
// ---------------------------------------------------------------------
// An international paper states what each part is worth ("[3]") and nests
// its questions two deep — 1 (a), 1 (b)(i), 1 (b)(ii) — rather than running
// a flat list. Both are opt-in: a naskah that uses neither parses exactly
// as it did before, since nothing here fires without a "[N]" or a "(a)"
// marker actually being present.

// "[3]" at the very end of a stem or sub-part. Diagram tags end in "]]",
// never "[digits]", so the two can never be confused for each other.
function extractMarks(text) {
  const str = String(text == null ? '' : text);
  const m = str.match(/\[(\d{1,3})\]\s*$/);
  if (!m) return { text: str.trim(), marks: null };
  return { text: str.slice(0, m.index).trim(), marks: Number(m[1]) };
}

// Latin "(a)".."(h)" opens a first-level part; roman "(i)".."(x)" opens a
// second level under whichever part is currently open. The two sets are
// deliberately disjoint — latin stops at h, roman starts at i — so a lone
// "(i)" is never ambiguous about which level it belongs to.
const SUBPART_LATIN_RE = /^[a-h]$/;
const SUBPART_ROMAN_RE = /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)$/;
const SUBPART_ROMAN_SEQ = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];

function pushRomanSub(part, label, body) {
  const em = extractMarks(body);
  part.subs.push({ id: part.id + '.' + label, label, text: em.text, marks: em.marks });
}

function sumMarks(list) {
  const total = list.reduce((sum, x) => sum + (x.marks || 0), 0);
  return total > 0 ? total : null;
}

// Splits one item's text into its stem and its (a)/(b)(i) sub-parts.
//
// Two things keep ordinary parenthesised text from being mistaken for a
// sub-part marker, and BOTH are needed:
//
//  1. The "(" must sit at a line start or directly after whitespace. That
//     alone rules out every function-notation form a maths naskah is full
//     of — f(x), C(n, r), P(A), MC(x), \sin(x) — since none of them has a
//     space before the bracket. The assertion is zero-width (lookbehind),
//     so "(b) (i)" on one line still finds BOTH markers.
//
//  2. The labels must form a real sequence: latin runs a, b, c... from "a",
//     and roman runs i, ii, iii... from "i" under whichever latin part is
//     open. A bracket that doesn't continue the sequence is prose, not a
//     marker, and is skipped. So "($\det(A) = 0$)" or a stray "(v)" in the
//     middle of a sentence can never fragment an item.
//
// Requiring markers to start their own LINE was the earlier rule, and it
// was wrong: pasting a naskah out of a chat UI routinely collapses the
// newlines, which silently dropped every sub-part and left their answer
// keys orphaned.
function parseSubParts(rawText, parentId) {
  const text = String(rawText == null ? '' : rawText);
  const markerRe = /(?<![^\n \t])\(([a-z]{1,4})\)[ \t]*/g;
  const hits = [];
  let expectedLatin = 'a';
  let expectedRomanIdx = 0;
  let level1 = null;   // 'latin' once (a) is seen, 'roman' for an (i)-only list
  let m;

  while ((m = markerRe.exec(text))) {
    const label = m[1];
    const hit = { label, start: m.index, end: m.index + m[0].length };

    if (SUBPART_LATIN_RE.test(label) && label === expectedLatin) {
      hit.kind = 'part';
      hits.push(hit);
      expectedLatin = label < 'h' ? String.fromCharCode(label.charCodeAt(0) + 1) : '';
      expectedRomanIdx = 0;
      level1 = 'latin';
    } else if (level1 === 'latin' && label === SUBPART_ROMAN_SEQ[expectedRomanIdx]) {
      hit.kind = 'sub';
      hits.push(hit);
      expectedRomanIdx++;
    } else if (level1 !== 'latin' && label === SUBPART_ROMAN_SEQ[expectedRomanIdx]) {
      // A worksheet whose sub-parts are numbered (i), (ii), (iii) with no
      // lettered level above them — those are first-level parts of their own.
      hit.kind = 'part';
      hits.push(hit);
      expectedRomanIdx++;
      level1 = 'roman';
    }
    // Anything else is ordinary text inside brackets — not a marker.
  }

  if (!hits.length) return { stem: text.trim(), parts: [] };

  const stem = text.slice(0, hits[0].start).trim();
  const parts = [];
  let current = null;

  hits.forEach((hit, i) => {
    const bodyEnd = i + 1 < hits.length ? hits[i + 1].start : text.length;
    const body = text.slice(hit.end, bodyEnd).trim();

    if (hit.kind === 'sub' && current) {
      pushRomanSub(current, hit.label, body);
      return;
    }
    current = { id: parentId + hit.label, label: hit.label, text: '', marks: null, subs: [] };
    parts.push(current);
    const em = extractMarks(body);
    current.text = em.text;
    current.marks = em.marks;
  });

  // A part that only holds roman sub-parts is worth what they add up to —
  // it never carries a "[N]" of its own.
  parts.forEach((part) => {
    if (part.subs.length && part.marks == null) part.marks = sumMarks(part.subs);
  });

  return { stem, parts };
}

// Applied to every parsed item regardless of type: pulls the "[N]" off a
// flat item, or splits a structured one into parts and totals them up.
function attachItemStructure(item, allowSubParts) {
  const parsed = allowSubParts ? parseSubParts(item.stem, item.id) : { parts: [] };
  if (parsed.parts.length) {
    item.stem = extractMarks(parsed.stem).text;
    item.parts = parsed.parts;
    item.marks = sumMarks(parsed.parts);
  } else {
    const em = extractMarks(item.stem);
    item.stem = em.text;
    item.marks = em.marks;
  }
  return item;
}

// Parses the item list for one section given its raw items text and an
// optional explicit type code ('PG'/'B'/'I'/'E'/'M'/'IB'); falls back to
// sniffing the content for the relevant marker when no code is known.
function parseItemsByCode(itemsText, code) {
  const items = [];
  let type = 'unknown';
  if (code === 'PG' || (!code && /PG\d+\./.test(itemsText))) {
    type = 'pg';
    const pgRe = /PG(\d+)\.\s*([\s\S]*?)(?=PG\d+\.|$)/g;
    let pm;
    while ((pm = pgRe.exec(itemsText))) {
      const id = 'PG' + pm[1];
      const chunk = pm[2].trim();
      // No \b here: a stem that runs straight into the options with no
      // space (e.g. "...isA. (-2, 5]B. ...", a dropped space from the
      // source) would otherwise never find a word boundary before "A.".
      const optStart = chunk.search(/A\.\s/);
      let stem = chunk, optionsText = '';
      if (optStart > -1) {
        stem = chunk.slice(0, optStart).trim();
        optionsText = chunk.slice(optStart);
      }
      const options = [];
      const optRe = /([A-E])\.\s*([\s\S]*?)(?=[A-E]\.\s|$)/g;
      let om;
      while ((om = optRe.exec(optionsText))) {
        options.push({ label: om[1], tex: om[2].trim() });
      }
      if (options.length) {
        const last = options[options.length - 1];
        last.tex = stripStrayHeading(last.tex);
      }
      items.push({ id, type: 'pg', stem, options });
    }
  } else if (code === 'IB' || (!code && /IB\d+\./.test(itemsText))) {
    // Fill-in-the-blank with a word bank ("Kotak Kata") — same one-stem
    // shape as plain isian (I), just checked/rendered with a word list
    // attached at the section level (see sec.bank in renderSection). Checked
    // before plain 'B' below — "IB1." contains "B1.", which /B\d+\./ would
    // otherwise happily match on its own, mis-sniffing an IB run as B.
    type = 'ib';
    const ibRe = /IB(\d+)\.\s*([\s\S]*?)(?=IB\d+\.|$)/g;
    let ibm;
    while ((ibm = ibRe.exec(itemsText))) {
      items.push({ id: 'IB' + ibm[1], type: 'ib', stem: stripStrayHeading(ibm[2].trim()) });
    }
  } else if (code === 'B' || (!code && /(?<!I)B\d+\./.test(itemsText))) {
    type = 'b';
    const bRe = /(?<!I)B(\d+)\.\s*([\s\S]*?)(?=(?<!I)B\d+\.|$)/g;
    let bm;
    while ((bm = bRe.exec(itemsText))) {
      items.push({ id: 'B' + bm[1], type: 'b', stem: stripStrayHeading(bm[2].trim()) });
    }
  } else if (code === 'I' || (!code && /I\d+\./.test(itemsText))) {
    type = 'i';
    const iRe = /I(\d+)\.\s*([\s\S]*?)(?=I\d+\.|$)/g;
    let imt;
    while ((imt = iRe.exec(itemsText))) {
      items.push({ id: 'I' + imt[1], type: 'i', stem: stripStrayHeading(imt[2].trim()) });
    }
  } else if (code === 'E' || (!code && /E\d+\./.test(itemsText))) {
    type = 'e';
    const eRe = /E(\d+)\.\s*([\s\S]*?)(?=E\d+\.|$)/g;
    let emt;
    while ((emt = eRe.exec(itemsText))) {
      items.push({ id: 'E' + emt[1], type: 'e', stem: stripStrayHeading(emt[2].trim()) });
    }
  } else if (code === 'M' || (!code && /M\d+\./.test(itemsText))) {
    // Matching (Mencocokkan) — each item is one "Kolom A" prompt; the
    // shared "Kolom B" answer choices live on the section (sec.bank), not
    // per item, since they're the same list for every row.
    type = 'm';
    const mRe = /M(\d+)\.\s*([\s\S]*?)(?=M\d+\.|$)/g;
    let mm;
    while ((mm = mRe.exec(itemsText))) {
      items.push({ id: 'M' + mm[1], type: 'm', stem: stripStrayHeading(mm[2].trim()) });
    }
  }
  items.forEach((it) => attachItemStructure(it, type === 'e'));
  return { type, items };
}

// "Kolom B: A. teks B. teks C. teks" — reuses the same lettered-option shape
// as PG's own options, just scoped to the whole Mencocokkan section instead
// of one item.
function parseLetterOptions(text) {
  const options = [];
  const re = /([A-J])\.\s*([\s\S]*?)(?=[A-J]\.\s|$)/g;
  let m;
  while ((m = re.exec(text))) {
    options.push({ label: m[1], tex: m[2].trim() });
  }
  return options;
}

function sanitizeMath(text) {
  // "\,^" (thin-space immediately before a superscript, e.g. degree symbols
  // like "25\,^\circ\text{C}") is invalid TeX — a spacing command can't take
  // a script — and makes KaTeX fail the whole expression ("Got group of
  // unknown type: 'internal'"). Drop the stray thin-space; the superscript
  // then attaches to the preceding digit as intended.
  //
  // "\text{ ^\circ C}" (a superscript INSIDE text mode, which AI-written
  // chemistry/physics keys produce for every temperature) is just as fatal:
  // KaTeX stops at the "^" ("Expected 'EOF', got '^'") and prints the whole
  // expression raw in red. Lift the degree sign out — "^\circ\text{C}" — and
  // drop the \text{} entirely when nothing but the degree sign was in it.
  return text
    .replace(/\\,\s*\^/g, '^')
    .replace(/\\text\{\s*\^\s*(\{\s*\\circ\s*\}|\\circ)\s*([^{}]*?)\s*\}/g, (m, _c, rest) => '^\\circ' + (rest ? '\\text{' + rest + '}' : ''));
}

// A line reading just "SET 1", "SET 2", etc. (matching what "Buat Prompt
// AI" instructs the AI to use when generating several sets at once — same
// section structure, different question content) marks where one complete
// worksheet ends and the next begins. Splits on that marker so several sets
// pasted together in one go each get parsed and rendered as their own
// worksheet, back to back, instead of being read as one long garbled
// document. Not anchored to line start/end — a paste that's lost every
// line break (the whole document arrives as one run-on paragraph) still
// has "SET 2" sitting glued directly onto the end of set 1's last
// Pembahasan sentence with no separator at all ("...= 6 = 0$SET 2Naskah
// Soal..."), and requiring "SET n" to be alone on its own line would miss
// that entirely, silently collapsing every set into one giant merged
// worksheet. Case-sensitive (matches only the literal uppercase "SET" the
// app's own AI prompt asks for) and requires at least two markers — a
// single stray "SET 1" (or the plain English word appearing incidentally
// in prose) isn't enough to flip a normal, single-worksheet paste into
// multi-set mode. The negative lookbehind (rather than \b) is deliberate:
// \b doesn't fire between two word characters, so it would miss "SET 2"
// glued directly onto the lowercase end of set 1's last sentence with zero
// separator ("...akhirSET 2Naskah...") — the exact shape this whole no-
// newline case produces. Only reject a "SET" that's itself the tail of a
// longer ALL-CAPS word (e.g. "OFFSET 2", "ASSET 5"); a preceding lowercase
// letter, digit, punctuation, or start-of-string all count as a boundary.
const SET_MARKER_RE = /(?<![A-Z])SET[ \t]+(\d+)/g;
function splitIntoSets(rawInput) {
  const text = String(rawInput || '').replace(/\r\n/g, '\n');
  const markers = [];
  let m;
  SET_MARKER_RE.lastIndex = 0;
  while ((m = SET_MARKER_RE.exec(text))) {
    markers.push({ start: m.index, end: m.index + m[0].length });
  }
  if (markers.length >= 2) {
    return markers.map((mk, i) => {
      const end = i + 1 < markers.length ? markers[i + 1].start : text.length;
      return text.slice(mk.end, end).trim();
    });
  }
  const byTitle = splitByRepeatedTitle(text);
  return byTitle.length >= 2 ? byTitle : [rawInput];
}

// Fallback for several complete worksheets pasted back to back WITHOUT the
// "SET N" marker lines above — e.g. copied straight out of an AI chat reply
// that titled each one "... Practice Examination Set 4" / "Set 5" / "Set 6"
// instead of following the marker format "Buat Prompt AI" asks for. Every
// worksheet's own title (whatever text sits before its first F1/F2/...
// formula, or before its first PG1./Bagian heading if it has no formula
// box — the same rule parseWorksheet itself uses to read a title) is
// checked for a trailing "Set <number>" — the one part of the wording that
// actually changes between sets — and if found, every later repeat of that
// same title text (number aside) marks where the next worksheet starts.
// Not anchored to line starts: a chat reply pasted into a plain textarea
// can lose its blank lines/paragraph breaks entirely, running one set's
// last Pembahasan sentence straight into the next set's title with no
// separator at all.
function splitByRepeatedTitle(text) {
  const firstBoundary = text.search(/F\d+(?:[.:]\s*|\s+(?=\())|Bagian\s*[A-Za-z0-9]+\s*:|Section\s*[A-Za-z0-9]+\s*:|PG\d+\.|IB\d+\.|B\d+\.|I\d+\.|E\d+\.|M\d+\./i);
  const firstTitle = (firstBoundary > -1 ? text.slice(0, firstBoundary) : '').trim();
  if (!firstTitle || /\n/.test(firstTitle)) return [text];
  const titleMatch = firstTitle.match(/^(.*?\bSet)\s*\d+\s*$/i);
  if (!titleMatch) return [text];

  const base = titleMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const re = new RegExp(base + '\\s*\\d+', 'gi');
  const starts = [];
  let mm;
  while ((mm = re.exec(text))) starts.push(mm.index);
  if (starts.length < 2) return [text];

  return starts.map((start, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : text.length;
    return text.slice(start, end).trim();
  });
}

function parseWorksheet(rawInput) {
  // Diagram tags ([[type: ...]]) are pulled out first and replaced with a
  // short opaque token, so none of the section/item/answer-key regexes
  // below ever have to know diagrams exist. The tokens ride along inside
  // whatever text they were embedded in (stem, option, freeform body) and
  // get swapped for rendered SVG at the very end, in render().
  const preExtract = extractDiagramTags((rawInput || '').replace(/\r\n/g, '\n').trim());
  let text = sanitizeMath(preExtract.text);
  const diagramTags = preExtract.tags;
  if (!text) return null;

  // -- Reading Passage (English/literacy worksheets) --------------------
  // A passage sits before any formula/section content, introduced by a bare
  // "Reading Passage"/"Passage"/"Bacaan"/"Teks Bacaan" heading with no colon
  // (unlike "Bagian X:"/"Section X:"). Pulled out up front so its own
  // multi-paragraph prose — which legitimately contains blank lines between
  // paragraphs — never reaches the title/formula/section heuristics below,
  // all of which assume a single short line of title text; left in place, a
  // three-paragraph passage was getting swallowed whole into the worksheet's
  // one-line title.
  //
  // The heading may also come AFTER the worksheet's own title line
  // ("Latihan Membaca\n\nBacaan\nJudul teks\n\n...") — that is the shape
  // the AI prompt for Bahasa Indonesia / Bahasa Inggris asks for — so it is
  // looked for anywhere before the first formula/section/item boundary, not
  // only at the very start. Whatever sits before it (the title) is kept and
  // re-joined with the rest, so the title heuristics below still see it.
  // "Bacaan 1" / "Bacaan:" spellings are tolerated; the heading word itself
  // is never printed, only the passage's own title and body.
  let passageTitle = '';
  let passageBody = '';
  const PASSAGE_BOUNDARY_RE = /F\d+(?:[.:]\s*|\s+(?=\())|Bagian\s*[A-Za-z0-9]+\s*:|Section\s*[A-Za-z0-9]+\s*:|(?:Bagian|Section)\s+[^:\n()]{2,80}?\s*:\s*\([A-Za-z]{1,4}\)|PG\d+\.|IB\d+\.|B\d+\.|I\d+\.|E\d+\.|M\d+\./i;
  const passageHeadingMatch = text.match(/(^|\n)[ \t]*(?:Reading\s*Passage|Reading\s*Text|Passage|Bacaan|Teks\s*Bacaan|Wacana)[ \t]*(?:\d{1,2})?[ \t]*:?[ \t]*\n+/i);
  const firstBoundaryIdx = text.search(PASSAGE_BOUNDARY_RE);
  if (passageHeadingMatch && (firstBoundaryIdx === -1 || passageHeadingMatch.index < firstBoundaryIdx)) {
    const beforeHeading = text.slice(0, passageHeadingMatch.index).trim();
    const afterHeading = text.slice(passageHeadingMatch.index + passageHeadingMatch[0].length);
    const passageEndIdx = afterHeading.search(PASSAGE_BOUNDARY_RE);
    const passageRaw = (passageEndIdx > -1 ? afterHeading.slice(0, passageEndIdx) : afterHeading).trim();
    const passageParas = passageRaw.split(/\n[ \t]*\n/).map((p) => p.trim()).filter(Boolean);
    // A short (single-line, no internal blank line) first paragraph followed
    // by more paragraphs reads as the passage's own title line; otherwise
    // there's no separate title, just body paragraphs.
    if (passageParas.length > 1 && passageParas[0].length <= 120 && !/\n/.test(passageParas[0])) {
      passageTitle = passageParas.shift();
    }
    passageBody = passageParas.join('\n\n');
    const restText = (passageEndIdx > -1 ? afterHeading.slice(passageEndIdx) : '').trim();
    text = beforeHeading ? (beforeHeading + '\n\n' + restText).trim() : restText;
  }

  // -- "Kolom B" (Mencocokkan answer bank) / "Kotak Kata" (Isian Berpilihan
  //    word bank) — pulled out of the RAW text before formula parsing or any
  //    section-splitting runs. Both contain periods ("A. .. B. .. C. ..")
  //    that the formula-lookahead and HEADING_TAIL_RE heuristics can't see
  //    past; left in place, the plain-text tail of the bank's last option
  //    (e.g. "...Ibu kota Singapura") looks exactly like a legitimate
  //    trailing heading and gets misread as one, corrupting whichever
  //    formula or section heading actually sits nearby. Attached to their
  //    section (by type) once sections exist, further down.
  let kolomBBank = '';
  let kotakKataBank = '';
  const bankStopLookahead = '(?=M\\d+\\.|IB\\d+\\.|PG\\d+\\.|B\\d+\\.|I\\d+\\.|E\\d+\\.|Kunci Jawaban|ANSWER KEY|Pembahasan|$)';
  text = text.replace(new RegExp('Kolom\\s*B\\s*:\\s*([\\s\\S]*?)' + bankStopLookahead, 'i'), (mm, content) => {
    kolomBBank = content.trim();
    return '';
  });
  text = text.replace(new RegExp('Kotak\\s*Kata\\s*:\\s*([\\s\\S]*?)' + bankStopLookahead, 'i'), (mm, content) => {
    kotakKataBank = content.trim();
    return '';
  });

  // Item id prefixes actually in use (PG/B/I/E). Kept as an explicit
  // alternation rather than a generic [A-Z]{1,3} — a generic uppercase-run
  // prefix greedily swallows a preceding single-letter MC answer (e.g. the
  // "A" in "PG1-APG2-B" gets absorbed into "APG2" instead of stopping at "A").
  // Longest roman alternatives first: a plain "|i|" placed early would
  // match the "i" of "iii" and leave "ii" dangling outside the id.
  const ITEM_ID = '(?:PG|IB|B|I|E|M)\\d+[a-z]?(?:\\.(?:viii|vii|vi|iii|ii|ix|iv|xi|x|v|i))?';

  // Trailing short letters-only phrase — used to recover a bare category
  // heading (e.g. "Multiple Choice Questions") that has no delimiter of its
  // own and would otherwise get glued onto whatever precedes it (the last
  // formula, or the previous item-type run) since there's no marker between
  // the two to split on. Includes \s (not just literal spaces) so a heading
  // sitting on its own line — "Bagian Esai\nE1. ..." — is still recovered;
  // without it, the newline breaks the match and the heading is lost while
  // its blank line gets glued onto the end of the previous section's last
  // answer instead.
  const HEADING_TAIL_RE = /[A-Za-z][A-Za-z\s/()&,-]{0,58}$/;

  // HEADING_TAIL_RE alone can't tell "the next section's heading" apart from
  // "the previous item's own bare-word stem/answer" when both are plain
  // letters+spaces with nothing but a blank line between them (e.g. "M3.
  // Bangkok\n\nBagian Isian Berpilihan" — naively it grabs "Bangkok" too).
  // Preferring the text after the LAST blank line resolves that: a blank
  // line unambiguously starts a new paragraph, so anything before it is the
  // previous item's, never the heading's.
  function recoverHeadingTail(raw) {
    const blankLineRe = /\n[ \t]*\n/g;
    let bm, lastBlankEnd = -1;
    while ((bm = blankLineRe.exec(raw))) lastBlankEnd = bm.index + bm[0].length;
    const searchSpace = lastBlankEnd > -1 ? raw.slice(lastBlankEnd) : raw;
    const m = searchSpace.match(HEADING_TAIL_RE);
    if (!m) return null;
    // A Kunci Jawaban entry's own value ("PG20-A") ends in exactly the same
    // bare-letters shape a stray heading does — when the answer key runs
    // straight into the next heading with no blank line ("...PG20-A\nPembahasan"),
    // the match above lands on that trailing "A" instead of any real heading
    // text. Bail out when what precedes the match is literally "ID-" with
    // nothing else, since that means the match IS the answer value, not a
    // glued-on heading — recovering it here would silently blank out that
    // question's answer key entry.
    const beforeMatch = searchSpace.slice(0, m.index);
    if (new RegExp('(?:' + ITEM_ID + ')-\\s*$').test(beforeMatch)) return null;
    let tail = m[0];
    // A trailing heading can be glued directly onto the previous item's own
    // answer text with no separating space at all (a stripped-whitespace
    // paste turns "...D. TrapeziumBagian Esai" into one run) — HEADING_TAIL_RE
    // can't tell the leaked answer word apart from the real heading since
    // both look like ordinary capitalized text. Trim the match back to start
    // right after the LAST such no-space lowercase->uppercase boundary, so
    // only the genuine heading (which keeps its own internal spaces) comes
    // back, and the leaked word stays part of the preceding item instead of
    // vanishing from it.
    const glueRe = /[a-z](?=[A-Z])/g;
    let gm, lastGlueEnd = -1;
    while ((gm = glueRe.exec(tail))) lastGlueEnd = gm.index + 1;
    if (lastGlueEnd > -1) tail = tail.slice(lastGlueEnd);
    return tail || null;
  }

  // -- Formulas (F1. / F1: / F1 (Label): ...) --------------------------------------
  const formulas = [];
  // A real formula marker needs "F<n>." / "F<n>:" or "F<n> (Label):" — a
  // bare "F<n>" (e.g. the "F1" and "F49" inside a heading like "Formulas
  // Used (F1 - F49)") must NOT count, or it gets mistaken for the actual
  // start of formula content and mangles the title/formula list.
  // IB\d+\. and M\d+\. must be listed (not just inferred from I\d+\./B\d+\.)
  // — "I\d+\." needs a digit right after "I" so it can't see "IB1.", and a
  // bare "B\d+\." WOULD match the "B1." sitting inside "IB1." if IB\d+\.
  // weren't offered as an earlier, leftmost-winning alternative first.
  // The "Bagian\s*[A-Za-z0-9]+\s*:" alternative only recognizes a single-
  // word section name ("Bagian A:") — a multi-word "named" header like
  // "Bagian Pilihan Ganda: (PG)" (see sectionHeaderNamedRe below, which
  // DOES handle this style) isn't a valid stop point for it, so without
  // its own alternative here the last formula's non-greedy capture reads
  // straight through that whole header line looking for the next marker
  // it does recognize (typically the section's own first item, e.g.
  // "PG1.") — silently swallowing the header into the formula's text and
  // leaving the section with no header, so it never gets split out on
  // its own and its items vanish. Mirrors the boundary pattern already
  // used for this same header style elsewhere (see the title-boundary
  // search above and sectionHeaderNamedRe).
  const formulaRe = new RegExp('F(\\d+)(?:[.:]\\s*|\\s+(?=\\())([\\s\\S]*?)(?=F\\d+(?:[.:]|\\s+\\()|Exact Course|Bagian\\s*[A-Za-z0-9]+\\s*:|Section\\s*[A-Za-z0-9]+\\s*:|(?:Bagian|Section)\\s+[^:\\n()]{2,80}?\\s*:\\s*\\([A-Za-z]{1,4}\\)|PROBLEM SET|Problem\\s*\\d+|Soal\\s*\\d+|PG\\d+\\.|IB\\d+\\.|B\\d+\\.|I\\d+\\.|E\\d+\\.|M\\d+\\.|Kunci Jawaban|ANSWER KEY|Answer Key|Pembahasan|EXPLANATIONS|Explanations|SOLUTIONS|Solutions|$)', 'gi');
  let firstFormulaIndex = -1;
  let lastFormulaEnd = 0;
  let m;
  while ((m = formulaRe.exec(text))) {
    if (firstFormulaIndex === -1) firstFormulaIndex = m.index;
    lastFormulaEnd = m.index + m[0].length;
    const tex = m[2].trim();
    if (tex) formulas.push({ id: 'F' + m[1], tex });
  }
  // Only try to recover a leaked heading when the formula list stopped at a
  // BARE item marker (PG1./B1./I1./E1. with no "Bagian"/"Section" wrapper) —
  // that's the one case where a plain heading like "Multiple Choice
  // Questions" has no marker of its own and can end up glued to the last
  // formula. When a real marker (e.g. "Bagian I:") did the stopping, the
  // formula's own trailing text (parenthetical notes etc.) is legitimate
  // and must NOT be chopped off.
  if (formulas.length && /^(?:PG|IB|B|I|E|M)\d+[.:]?/.test(text.slice(lastFormulaEnd))) {
    const lastF = formulas[formulas.length - 1];
    // Match against the raw text ending exactly at lastFormulaEnd, not
    // against lastF.tex — tex was already .trim()'d when pushed, so any
    // whitespace (e.g. a "\n\n" before the heading) that trim() ate is
    // invisible to a match against tex, and subtracting that match's length
    // from lastFormulaEnd (a position in the untrimmed source) would then
    // land short by exactly however much whitespace got silently dropped —
    // observed as the heading's leading character(s) going missing.
    const rawTail = text.slice(Math.max(0, lastFormulaEnd - 200), lastFormulaEnd);
    const tailMatch = recoverHeadingTail(rawTail);
    if (tailMatch) {
      lastF.tex = lastF.tex.slice(0, Math.max(0, lastF.tex.length - tailMatch.length)).trim();
      lastFormulaEnd -= tailMatch.length;
    }
  }

  // -- Title & body start -------------------------------------------
  let title = '';
  let bodyStart = 0;
  if (firstFormulaIndex > -1 && formulas.length) {
    title = text.slice(0, firstFormulaIndex).trim();
    bodyStart = lastFormulaEnd;
  } else {
    // The third alternative mirrors sectionHeaderNamedRe below (a
    // descriptive, possibly multi-word section name directly before the
    // colon, e.g. "Bagian Bentuk Molekul Ikatan Kimia: (PG)") — without it,
    // this search skips straight past that header to the first PG\d+./etc.
    // marker instead, sweeping the header (and anything before it) into the
    // title as one giant unwanted run.
    const firstMarker = text.search(/Bagian\s*[A-Za-z0-9]+\s*:|Section\s*[A-Za-z0-9]+\s*:|(?:Bagian|Section)\s+[^:\n()]{2,80}?\s*:\s*\([A-Za-z]{1,4}\)|PG\d+\.|IB\d+\.|B\d+\.|M\d+\.|PROBLEM SET|Problem\s*\d+|Soal\s*\d+/i);
    title = firstMarker > -1 ? text.slice(0, firstMarker).trim() : '';
    bodyStart = firstMarker > -1 ? firstMarker : 0;
  }
  if (/^(FORMULAS?|RUMUS(-RUMUS)?)$/i.test(title)) title = '';

  let body = text.slice(bodyStart);
  body = body.replace(/\bExact Course/g, '').trim();

  // -- Split off Kunci Jawaban / Pembahasan tail (with English aliases) ---
  let sectionsText = body;
  let kunciText = '';
  let pembahasanText = '';
  const kunciMatch = body.match(/Kunci Jawaban|ANSWER KEY/i);
  // EXPLANATIONS/SOLUTIONS require a capitalized first letter (matches both
  // "SOLUTIONS" and "Solutions" heading styles, not lowercase "solution")
  // AND the plural form specifically — a fully case-insensitive or
  // singular-permitting match would also catch ordinary prose/labels like
  // "the general solution to..." or a formula named "...Inequality
  // Solution", corrupting the Kunci Jawaban / Pembahasan split. "pembahasan"
  // (no capital) is excluded for the same reason: it's also an everyday
  // Indonesian word ("discussion/topic") that shows up naturally inside
  // ordinary question text — e.g. "Fokus pembahasan utama pada Sidang
  // Pertama..." — and matching it there finds a "heading" earlier than the
  // real "Kunci Jawaban", making the whole answer-key slice come out empty.
  // A genuine heading is written capitalized either way, so requiring that
  // (like EXPLANATIONS/SOLUTIONS already do) filters the false hit out
  // without needing a line-start anchor, which would break the many
  // worksheets that run everything together with no newlines at all.
  const pembMatch = body.match(/Pembahasan|PEMBAHASAN|E(?:XPLANATIONS|xplanations)|S(?:OLUTIONS|olutions)/);
  const kunciIdx = kunciMatch ? kunciMatch.index : -1;
  let pembIdx = pembMatch ? pembMatch.index : -1;
  // Where the trigger word itself ends — kept separate from pembIdx (which
  // gets pulled backward below) so pembahasanText still starts right after
  // "Solutions", not partway through it.
  const pembHeadingEnd = pembIdx > -1 ? pembIdx + pembMatch[0].length : -1;
  if (pembIdx > -1) {
    // The trigger word alone (e.g. "Solutions") may be preceded by more of
    // its own heading ("Detailed Solutions for Essay Questions") with no
    // marker of its own — pull the boundary back over that leftover prefix
    // so it doesn't stay glued to whatever answer/value precedes it.
    const preMatch = recoverHeadingTail(body.slice(0, pembIdx));
    if (preMatch) pembIdx -= preMatch.length;
  }
  if (kunciIdx > -1) {
    sectionsText = body.slice(0, kunciIdx);
    const end = pembIdx > -1 ? pembIdx : body.length;
    kunciText = body.slice(kunciIdx + kunciMatch[0].length, end).trim();
  }
  if (pembIdx > -1) {
    pembahasanText = body.slice(pembHeadingEnd).trim();
    if (kunciIdx === -1) sectionsText = body.slice(0, pembIdx);
  }

  // -- Sections: "Bagian N:" or "Section X:" headers, item type read from the
  //    label's trailing (CODE) — PG = multiple choice, B = true/false,
  //    I = fill-in-the-blank, IB = fill-in-the-blank with word bank,
  //    E = essay/extended response, M = matching -----------------------------
  const sections = [];
  const ITEM_MARKERS = /PG\d+\.|IB\d+\.|B\d+\.|I\d+\.|E\d+\.|M\d+\./;
  const sectionHeaderRe = /(Bagian|Section)\s*([A-Za-z0-9]+)\s*:\s*/gi;
  // A second header style: the descriptive section name itself sits
  // directly before the colon (e.g. "Bagian Bentuk Molekul Ikatan Kimia:
  // (PG)") instead of a short id with the name coming after the colon
  // ("Bagian A: Nama Bagian (PG)") — sectionHeaderRe's single-word capture
  // can't span "Bentuk Molekul Ikatan Kimia" at all, so headers like that
  // were never recognized as section boundaries and their questions got
  // silently lost into whichever section preceded them (or the title, if
  // it was the very first one). Requiring the item-type code to land
  // immediately after the colon is what keeps this from misfiring on
  // ordinary prose that happens to contain "bagian ...:" as a sentence
  // fragment (e.g. "Perhatikan bagian tubuh berikut: jantung, ...") — no
  // question stem ends "...: (PG)" by coincidence the way a real header does.
  // The code also has to be followed by whitespace/end-of-string OR the
  // section's own first item marker glued straight on with no space at all
  // (e.g. "Bagian Pilihan Ganda: (PG)PG1. ..." — a fully run-together paste
  // with every line break stripped). Without that second option the header
  // never matches in that case, so the section silently vanishes (its items
  // are lost, though the Kunci Jawaban/Pembahasan entries survive since
  // those are parsed separately) even though the exact same style of
  // boundary is already tolerated for formulas (see formulaRe above).
  const sectionHeaderNamedRe = new RegExp('(Bagian|Section)\\s+([^:\\n()]{2,80}?)\\s*:\\s*(?=\\([A-Za-z]{1,4}\\)(?:\\s|$|(?=' + ITEM_ID + ')))', 'gi');
  const starts = [];
  while ((m = sectionHeaderRe.exec(sectionsText))) {
    starts.push({ word: m[1], num: m[2], headerEnd: m.index + m[0].length, index: m.index, named: false });
  }
  while ((m = sectionHeaderNamedRe.exec(sectionsText))) {
    starts.push({ word: m[1], num: m[2], headerEnd: m.index + m[0].length, index: m.index, named: true });
  }
  // Both regexes match the same spot when a single-word name is immediately
  // followed by "(CODE)" (e.g. "Bagian Homeostasis: (PG)") — keep only the
  // "named" match for that position, since it's the one that carries the
  // full descriptive name through into the label instead of discarding it.
  starts.sort((a, b) => (a.index !== b.index ? a.index - b.index : (a.named ? -1 : 1)));
  const dedupedStarts = starts.filter((s, i) => i === 0 || s.index !== starts[i - 1].index);

  for (let i = 0; i < dedupedStarts.length; i++) {
    const s = dedupedStarts[i];
    const spanEnd = i + 1 < dedupedStarts.length ? dedupedStarts[i + 1].index : sectionsText.length;
    const rest = sectionsText.slice(s.headerEnd, spanEnd);

    let label = '';
    let noteAndItems = rest;
    if (s.named) {
      const namedCodeMatch = rest.match(/^\s*\(([A-Za-z]{1,4})\)\s*/);
      label = s.num.trim() + (namedCodeMatch ? ' (' + namedCodeMatch[1].toUpperCase() + ')' : '');
      noteAndItems = namedCodeMatch ? rest.slice(namedCodeMatch[0].length) : rest;
    } else {
      const labelMatch = rest.match(/^([^()]*\([A-Za-z/ ]{1,20}\))/);
      if (labelMatch) {
        label = labelMatch[1].trim();
        noteAndItems = rest.slice(labelMatch[0].length);
      } else {
        const firstItem = rest.search(ITEM_MARKERS);
        label = (firstItem > -1 ? rest.slice(0, firstItem) : rest).trim();
        noteAndItems = firstItem > -1 ? rest.slice(firstItem) : '';
      }
    }

    let note = '';
    let itemsText = noteAndItems;
    const firstItemIdx = noteAndItems.search(ITEM_MARKERS);
    if (firstItemIdx > -1) {
      note = noteAndItems.slice(0, firstItemIdx).trim().replace(/^\(|\)$/g, '');
      itemsText = noteAndItems.slice(firstItemIdx);
    }

    const codeMatch = label.match(/\(([A-Za-z]{1,4})\)\s*$/);
    const code = codeMatch ? codeMatch[1].toUpperCase() : null;

    const { type, items } = parseItemsByCode(itemsText, code);
    // For a "named" header, `label` already IS the full descriptive name
    // (plus code) — renderSection's titleText would otherwise print it
    // twice ("Bagian Bentuk Molekul Ikatan Kimia: Bentuk Molekul Ikatan
    // Kimia (PG)") by prefixing "Bagian <num>:" in front of a label that
    // already contains that same name, so num is left out for those.
    sections.push({ headingWord: s.word, num: s.named ? null : s.num, label, note, type, items });
  }

  // -- Fallback: "Problem N / Soal N" essay format with lettered sub-items --
  if (sections.length === 0) {
    const problemHeaderRe = /(?:Problem|Soal)\s*(\d+)\.?/gi;
    const pStarts = [];
    while ((m = problemHeaderRe.exec(sectionsText))) {
      pStarts.push({ num: m[1], headerEnd: m.index + m[0].length, index: m.index });
    }
    const subItemRe = new RegExp('(' + ITEM_ID + ')\\s*:\\s*', 'g');
    const hasSubItems = pStarts.length > 0 && subItemRe.test(sectionsText);

    if (hasSubItems) {
      const heading = sectionsText.slice(0, pStarts[0].index).trim();
      const label = heading ? toNiceCase(heading) : 'Soal';

      const items = [];
      for (let i = 0; i < pStarts.length; i++) {
        const p = pStarts[i];
        const spanEnd = i + 1 < pStarts.length ? pStarts[i + 1].index : sectionsText.length;
        const rest = sectionsText.slice(p.headerEnd, spanEnd);

        const localSubRe = new RegExp('(' + ITEM_ID + ')\\s*:\\s*', 'g');
        const firstSub = localSubRe.exec(rest);
        const stem = (firstSub ? rest.slice(0, firstSub.index) : rest).trim();
        const subText = firstSub ? rest.slice(firstSub.index) : '';

        const subItems = [];
        const subRe = new RegExp('(' + ITEM_ID + ')\\s*:\\s*([\\s\\S]*?)(?=' + ITEM_ID + '\\s*:|$)', 'g');
        let sm;
        while ((sm = subRe.exec(subText))) {
          const letter = (sm[1].match(/[a-z]$/i) || [])[0] || '';
          const em = extractMarks(sm[2]);
          subItems.push({ id: sm[1], letter, text: em.text, marks: em.marks });
        }
        const stemMarks = extractMarks(stem);
        items.push({
          id: 'Problem' + p.num, num: p.num, type: 'essay',
          stem: stemMarks.text,
          marks: sumMarks(subItems) || stemMarks.marks,
          subItems
        });
      }
      sections.push({ num: null, label, note: '', type: 'essay', items });
    }
  }

  // -- Fallback: bare category headings with no "Bagian"/"Section" wrapper —
  //    e.g. "Multiple Choice QuestionsPG1. ..." then later "Essay QuestionsE1. ...".
  //    Sections are inferred from where the item-type prefix changes
  //    (PG run, then E run, etc); the heading text sitting right before each
  //    run's first marker is recovered and used as that section's label. --
  if (sections.length === 0) {
    const markerRe = /(PG|IB|B|I|E|M)\d+\./g;
    const markers = [];
    while ((m = markerRe.exec(sectionsText))) {
      markers.push({ prefix: m[1], index: m.index });
    }
    if (markers.length) {
      const runs = [];
      for (const mk of markers) {
        const last = runs[runs.length - 1];
        if (!last || last.prefix !== mk.prefix) runs.push({ prefix: mk.prefix, start: mk.index });
      }
      let pendingHeading = (recoverHeadingTail(sectionsText.slice(0, runs[0].start)) || '').trim();
      for (let i = 0; i < runs.length; i++) {
        const rawEnd = i + 1 < runs.length ? runs[i + 1].start : sectionsText.length;
        let itemsText = sectionsText.slice(runs[i].start, rawEnd);
        let nextHeading = '';
        if (i + 1 < runs.length) {
          const tailMatch = recoverHeadingTail(itemsText);
          if (tailMatch) {
            nextHeading = tailMatch.trim();
            itemsText = itemsText.slice(0, itemsText.length - tailMatch.length);
          }
        }
        const { type, items } = parseItemsByCode(itemsText, runs[i].prefix === 'PG' ? 'PG' : runs[i].prefix);
        sections.push({ num: null, label: pendingHeading, note: '', type, items });
        pendingHeading = nextHeading;
      }
    }
  }

  // -- Kunci Jawaban / ANSWER KEY ----------------------------------------
  const answerKey = {};
  const akRe = new RegExp('(' + ITEM_ID + ')-\\s*([\\s\\S]*?)(?=' + ITEM_ID + '-|$)', 'g');
  let am;
  while ((am = akRe.exec(kunciText))) {
    let val = stripStrayHeading(am[2].trim()).replace(/,\s*$/, '');
    if (/^true$/i.test(val)) val = 'Benar';
    if (/^false$/i.test(val)) val = 'Salah';
    answerKey[am[1]] = val;
  }

  // Fallback: Kunci Jawaban keyed the same way as the questions themselves —
  // "PG1." "I1." (period) — rather than the "PG1-" dash style. Also covers
  // worksheets that group their answer key into the same named sub-topics as
  // the questions ("Pilihan Ganda" / "Isian" / "Essay", each with a blank
  // line before its first item and after its last) — stripStrayHeading
  // peels those group labels back off the previous item's answer.
  if (Object.keys(answerKey).length === 0 && kunciText) {
    const akDotRe = new RegExp('(' + ITEM_ID + ')\\.\\s*([\\s\\S]*?)(?=' + ITEM_ID + '\\.|$)', 'g');
    let adm;
    while ((adm = akDotRe.exec(kunciText))) {
      let val = stripStrayHeading(adm[2].trim()).replace(/,\s*$/, '');
      if (/^true$/i.test(val)) val = 'Benar';
      if (/^false$/i.test(val)) val = 'Salah';
      answerKey[adm[1]] = val;
    }
  }

  // -- Pembahasan / EXPLANATION --------------------------------------------
  const explanations = {};
  const pbRe = new RegExp('(' + ITEM_ID + ')-\\s*([\\s\\S]*?)(?=' + ITEM_ID + '-|$)', 'g');
  let pbm;
  while ((pbm = pbRe.exec(pembahasanText))) {
    explanations[pbm[1]] = stripStrayHeading(pbm[2].trim());
  }

  // Fallback: prose-style explanations grouped by "Problem N" / "Soal N"
  // (no ID-value pairs at all, e.g. full worked solutions per problem).
  if (Object.keys(explanations).length === 0 && pembahasanText) {
    const hdrRe = /(?:Problem|Soal)\s*(\d+)\.?/gi;
    const hdrs = [];
    let hm;
    while ((hm = hdrRe.exec(pembahasanText))) {
      hdrs.push({ num: hm[1], start: hm.index, end: hm.index + hm[0].length });
    }
    for (let i = 0; i < hdrs.length; i++) {
      const textEnd = i + 1 < hdrs.length ? hdrs[i + 1].start : pembahasanText.length;
      explanations['Problem' + hdrs[i].num] = stripStrayHeading(pembahasanText.slice(hdrs[i].end, textEnd).trim());
    }
  }

  // Second fallback: explanations keyed the same way as the questions
  // themselves — "E1." "E2." (period, like the question list) rather than
  // the "E1-" dash style the Kunci Jawaban block uses.
  if (Object.keys(explanations).length === 0 && pembahasanText) {
    const dotRe = new RegExp('(' + ITEM_ID + ')\\.\\s*([\\s\\S]*?)(?=' + ITEM_ID + '\\.|$)', 'g');
    let dm;
    while ((dm = dotRe.exec(pembahasanText))) {
      explanations[dm[1]] = stripStrayHeading(dm[2].trim());
    }
  }

  sections.forEach((sec) => {
    if (sec.type === 'm') sec.bank = kolomBBank;
    if (sec.type === 'ib') sec.bank = kotakKataBank;
    // Section total is only meaningful once at least one item in it was
    // actually given a "[N]"; a naskah with no marks at all keeps null all
    // the way up and the renderer prints no totals anywhere.
    sec.marks = sumMarks(sec.items);
  });

  const totalMarks = sumMarks(sections);

  const structured = sections.length > 0 || formulas.length > 0;

  return {
    title,
    passageTitle,
    passageBody,
    formulas,
    sections,
    answerKey,
    explanations,
    structured,
    totalMarks,
    freeformBody: structured ? '' : text,
    diagramTags
  };
}

// ---------------------------------------------------------------------
// 2. RENDERER
// ---------------------------------------------------------------------

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function numOf(id) {
  const n = id.match(/\d+/);
  return n ? n[0] : id;
}

// Kunci Jawaban / Pembahasan values for fill-in-blank (I) and essay (E) items
// are conventionally LaTeX (numbers, formulas), unlike PG (a bare option
// letter) and B (Benar/Salah) — wrap only those in $...$ so KaTeX's
// auto-render picks them up instead of leaving raw "\rho", "\pm" etc. visible.
function mathAnswer(id, val) {
  const prefix = (id.match(/^[A-Za-z]+/) || [''])[0];
  if (prefix !== 'I' && prefix !== 'E') return val;
  // Essay (E) answers/explanations are often prose, not a bare formula — two
  // cases must NOT be wrapped again here:
  // 1. The value already has its own $...$ (e.g. "$Z = 34$, $\text{Group
  //    VIA}$") — wrapping the whole thing in another pair turns the leading
  //    "$" + "$" into a "$$" display-math delimiter, and the auto-render
  //    pass later pairs it with the next stray "$$" it finds, swallowing
  //    everything between (including the literal "$" signs) into one broken
  //    expression. The author's own delimiters are enough; auto-render picks
  //    them up on its own pass over the page.
  // 2. The value is plain-language prose with no math markup at all (e.g.
  //    "Aufbau governs energy order of filling, Hund governs..."). Math mode
  //    discards ordinary spaces between letters, so wrapping prose collapses
  //    it into one unreadable, unbreakable run-on word. Six or more
  //    dictionary-like words (letter runs of 2+, as opposed to the bare
  //    single-letter variables and symbol-heavy tokens a real formula is
  //    made of) is treated as prose.
  // 3. The value has no actual LaTeX markup in it at all — e.g. a language
  //    worksheet's fill-in-blank answer "for" or a multiple-acceptable-
  //    answer list like "After / When / As soon as" (only 5 words, so #2
  //    alone wouldn't catch it). Nothing here needs math typesetting, and
  //    wrapping it would still eat the spaces around "/" the same way it
  //    would eat spaces in prose. Only wrap when a real LaTeX control
  //    character (^, _, \, {, }) is actually present.
  if (val.indexOf('$') > -1) return val;
  const wordCount = (val.match(/[A-Za-z]{2,}/g) || []).length;
  if (wordCount >= 6) return val;
  if (!/[\^_\\{}]/.test(val)) return val;
  // A literal "%" (e.g. "%\Delta\rho = 6.7%" typed as a plain percent sign)
  // is TeX's comment marker — inside $...$ it silently swallows everything
  // after it, so an answer starting with "%" renders as nothing at all.
  // Escape any "%" not already escaped as "\%" before entering math mode.
  const safe = val.replace(/(^|[^\\])%/g, '$1\\%');
  return '$' + safe + '$';
}

// Pembahasan box shown directly under a single item (rather than grouped
// into one block at the end of the sheet), so students/teachers reading
// the answer key version see the reasoning right where the question is.
function renderInlineExplanation(id, data, opts) {
  if (!opts.showExplanation) return '';
  const exp = data.explanations[id];
  if (exp == null) return '';
  return `<div class="ws-inline-explanation"><strong>Pembahasan:</strong> ${esc(mathAnswer(id, exp))}</div>`;
}

function renderWorksheet(data, opts) {
  if (!data) return '<div class="empty-state">Tempel naskah soal di panel kiri, lalu klik "Render Worksheet".</div>';

  opts = Object.assign({}, opts, {
    brandName: (opts.brandName || '').replace(/\$/g, ''),
    worksheetSubject: (opts.worksheetSubject || '').replace(/\$/g, '')
  });

  // Titles/header text are plain labels, never meant to hold live LaTeX.
  // Strip stray "$" so a leftover/unclosed delimiter here can never make
  // KaTeX's auto-render scan swallow unrelated text later in the page
  // (an unmatched "$" makes it hunt forward for the next "$" anywhere in
  // the DOM, corrupting everything in between).
  const title = (opts.titleOverride || data.title || 'Lembar Kerja').replace(/\$/g, '');

  const fieldsHtml = [
    opts.showName ? '<span>Nama: &nbsp;</span>' : '',
    opts.showClass ? '<span>Kelas: &nbsp;</span>' : '',
    opts.showDate ? '<span>Tanggal: &nbsp;</span>' : '',
    opts.showScore ? '<span>Nilai: &nbsp;</span>' : ''
  ].join('');

  // Paper total, printed alongside Nama/Kelas/Tanggal/Nilai — the same
  // place a real paper states "Total: 60 marks".
  const totalMarksHtml = (opts.showMarks && data.totalMarks)
    ? `<span class="ws-total-marks">Total nilai: ${data.totalMarks}</span>`
    : '';

  let passageHtml = '';
  if (data.passageBody) {
    const paras = data.passageBody.split(/\n[ \t]*\n/).map((p) => `<p>${esc(p)}</p>`).join('');
    passageHtml = `
      <div class="ws-passage">
        ${data.passageTitle ? `<div class="ws-passage-title">${esc(data.passageTitle)}</div>` : ''}
        <div class="ws-passage-body">${paras}</div>
      </div>`;
  }

  let formulasHtml = '';
  if (opts.showFormulaBox && data.formulas.length) {
    const gridClass = opts.compactFormulas ? 'ws-formulas-grid cols-2' : 'ws-formulas-grid';
    formulasHtml = `
      <div class="ws-formulas">
        <div class="ws-formulas-title">Ringkasan Rumus</div>
        <div class="${gridClass}">
          ${data.formulas.map(f => `<div class="ws-formula-item"><strong>${esc(f.id)}.</strong> ${esc(f.tex)}</div>`).join('')}
        </div>
      </div>`;
  }

  let bodyInner = '';

  if (data.structured) {
    bodyInner = data.sections.map(sec => sec.type === 'essay' ? renderEssaySection(sec, data, opts) : renderSection(sec, data, opts)).join('');
  } else {
    bodyInner = `<div class="ws-freeform" style="white-space:pre-wrap;">${esc(data.freeformBody)}</div>`;
  }

  let answerKeyHtml = '';
  if (opts.showAnswerKey && Object.keys(data.answerKey).length) {
    const entries = allItemIds(data).filter(id => data.answerKey[id] != null);
    answerKeyHtml = `
      <div class="ws-answerkey">
        <div class="ws-answerkey-title">Kunci Jawaban</div>
        <div class="ws-answerkey-grid">
          ${entries.map(id => `<div>${esc(displayLabel(id))}: <strong>${esc(mathAnswer(id, data.answerKey[id]))}</strong></div>`).join('')}
        </div>
      </div>`;
  }

  const modeTag = (opts.showAnswerKey || opts.showExplanation)
    ? '<div class="ws-mode-tag">VERSI GURU</div>'
    : '<div class="ws-mode-tag">LEMBAR SISWA</div>';

  const logoHtml = opts.showLogo
    ? '<img class="ws-logo" src="assets/logo.png" alt="">'
    : '';

  return `
    <div class="ws-header">
      <div class="ws-brand-row">
        ${logoHtml}
        <div>
          <div class="ws-brand">${esc(opts.brandName || 'Worksheet')}</div>
          ${opts.worksheetSubject ? `<div class="ws-subject">${esc(opts.worksheetSubject)}</div>` : ''}
        </div>
      </div>
      <div class="ws-titleblock">
        <div class="ws-title">${esc(title)}</div>
        ${modeTag}
      </div>
    </div>
    <div class="ws-fields">${fieldsHtml}${totalMarksHtml}</div>
    ${passageHtml}
    ${formulasHtml}
    <div class="ws-body">
      ${bodyInner}
      ${answerKeyHtml}
    </div>
  `;
}

function allItemIds(data) {
  const ids = [];
  data.sections.forEach(sec => sec.items.forEach(it => {
    ids.push(it.id);
    if (it.subItems) it.subItems.forEach(si => ids.push(si.id));
    // Structured (a)/(b)(i) parts hold their own answers, so their ids
    // belong in the key block just as much as the item's own.
    if (it.parts) it.parts.forEach(part => {
      ids.push(part.id);
      (part.subs || []).forEach(sub => ids.push(sub.id));
    });
  }));
  return ids;
}

function displayLabel(id) {
  const m = id.match(/^Problem(\d+)$/);
  return m ? ('Soal ' + m[1]) : id;
}

// Marks are printed the way a real paper prints them: right-aligned in
// their own column at the end of the line, so a student can see at a
// glance what each part is worth. Suppressed entirely when the worksheet
// carries no marks, or when the teacher turned the column off.
function renderMarks(marks, opts) {
  if (!opts.showMarks || !marks) return '';
  return `<span class="ws-marks">[${marks}]</span>`;
}

// Blank ruled space sized from what the part is worth — the whole reason
// marks and answer space belong to the same feature. Falls back to one
// line so an unmarked part still gets somewhere to write.
function renderAutoAnswerSpace(marks, opts) {
  if (!opts.autoAnswerSpace) return '';
  const perMark = Number(opts.linesPerMark) || 2;
  const count = Math.max(1, Math.min(10, Math.round((marks || 1) * perMark)));
  let html = '<div class="ws-answer-lines">';
  for (let i = 0; i < count; i++) html += '<div class="ws-answer-line"></div>';
  return html + '</div>';
}

// One (a)/(i) row: label, text, marks, then either the model answer (guru)
// or ruled space to write in (siswa).
function renderPartRow(part, data, opts, isSub) {
  const ans = opts.showAnswerKey ? data.answerKey[part.id] : null;
  const answerHtml = ans != null
    ? `<div class="ws-part-answer"><strong>Jawaban:</strong> ${esc(mathAnswer(part.id, ans))}</div>`
    : renderAutoAnswerSpace(part.marks, opts);
  // A part that only introduces its roman sub-parts has no text and no
  // answer of its own — just its label, sitting above them.
  const bodyHtml = part.text
    ? `<div class="ws-part-row">
         <span class="ws-part-label">(${esc(part.label)})</span>
         <div class="ws-part-text">${esc(part.text)}</div>
         ${renderMarks(part.marks, opts)}
       </div>${answerHtml}${renderInlineExplanation(part.id, data, opts)}`
    : `<div class="ws-part-row"><span class="ws-part-label">(${esc(part.label)})</span><div class="ws-part-text"></div></div>`;
  return `<div class="${isSub ? 'ws-subpart' : 'ws-part'}">${bodyHtml}</div>`;
}

function renderPartsTree(item, data, opts) {
  if (!item.parts || !item.parts.length) return '';
  const parts = item.parts.map((part) => {
    const subs = (part.subs || []).map((sub) => renderPartRow(sub, data, opts, true)).join('');
    return renderPartRow(part, data, opts, false) + (subs ? `<div class="ws-subparts">${subs}</div>` : '');
  }).join('');
  const total = opts.showMarks && item.marks
    ? `<div class="ws-item-total">[Total: ${item.marks}]</div>`
    : '';
  return `<div class="ws-parts">${parts}</div>${total}`;
}

// Panjang tampak sebuah pilihan: TeX dihitung kasar (perintah \frac dsb.
// jadi satu huruf, pembatas $ { } ^ _ tidak dihitung) supaya "$Na < Mg$"
// tidak dianggap lebih panjang daripada kelihatannya.
function optionTextLength(tex) {
  return String(tex || '')
    .replace(/\\[a-zA-Z]+/g, 'x')
    .replace(/[${}^_]/g, '')
    .trim().length;
}

// Berapa pilihan berdampingan untuk satu soal PG — diputuskan per soal,
// bukan per lembar. "2 kolom (hemat)" hanya berlaku kalau semua pilihannya
// cukup pendek untuk muat di setengah lebar kolom tanpa terlipat; kalimat
// panjang ("Bertambah karena jumlah kulit elektron makin banyak") tetap
// satu kolom penuh, dan pilihan sangat pendek (Na / Al / P / Cl) dijajar
// berempat. Ambangnya ikut lebar badan: kolom koran kira-kira 250pt, jadi
// setengahnya memuat ±20 huruf; lembar 1 kolom dua kali lebih lapang.
function optionColsClass(options, opts) {
  if (opts.pgOptionCols !== '2') return '';
  const lens = (options || []).map(o => optionTextLength(o.tex));
  if (!lens.length) return '';
  const maxLen = Math.max(...lens);
  const lapang = opts.bodyColumns === '1' ? 2 : 1;
  if (lens.length <= 4 && maxLen <= 5 * lapang) return ' cols-4';
  if (maxLen <= 20 * lapang) return ' cols-2';
  return '';
}

function renderSection(sec, data, opts) {
  const noteHtml = sec.note ? `<div class="ws-section-note">${esc(sec.note)}</div>` : '';
  const colsClass = opts.bodyColumns === '2' ? 'ws-section-cols cols-2' : 'ws-section-cols';
  let itemsHtml = '';

  if (sec.type === 'pg') {
    itemsHtml = sec.items.map(item => {
      const optCols = 'ws-options' + optionColsClass(item.options, opts);
      const correct = opts.showAnswerKey ? data.answerKey[item.id] : null;
      const optionsHtml = item.options.map(o => {
        const isCorrect = correct && o.label === correct;
        return `<div class="ws-option${isCorrect ? ' ws-correct' : ''}">
            <span class="ws-option-label">${esc(o.label)}.</span>
            <span>${esc(o.tex)}</span>${isCorrect ? ' <strong>&#10003;</strong>' : ''}
          </div>`;
      }).join('');
      return `
        <div class="ws-item">
          <div class="ws-item-stem">
            <span class="ws-item-num">${numOf(item.id)}.</span>
            <div class="ws-item-text">${esc(item.stem)}</div>
            ${renderMarks(item.marks, opts)}
          </div>
          <div class="${optCols}">${optionsHtml}</div>
          ${renderInlineExplanation(item.id, data, opts)}
        </div>`;
    }).join('');
  } else if (sec.type === 'b') {
    itemsHtml = sec.items.map(item => {
      const ans = opts.showAnswerKey ? data.answerKey[item.id] : null;
      const isBenar = ans === 'Benar';
      const isSalah = ans === 'Salah';
      return `
        <div class="ws-item">
          <div class="ws-tf-row">
            <div class="ws-item-stem">
              <span class="ws-item-num">${numOf(item.id)}.</span>
              <div class="ws-item-text">${esc(item.stem)}</div>
              ${renderMarks(item.marks, opts)}
            </div>
            <div class="ws-tf-choices">B${isBenar ? '<span style="border-color:#111;font-weight:700;">&#10003;</span>' : '<span></span>'} / S${isSalah ? '<span style="border-color:#111;font-weight:700;">&#10003;</span>' : '<span></span>'}</div>
          </div>
          ${renderInlineExplanation(item.id, data, opts)}
        </div>`;
    }).join('');
  } else if (sec.type === 'i') {
    itemsHtml = sec.items.map(item => {
      const ans = opts.showAnswerKey ? data.answerKey[item.id] : null;
      return `
        <div class="ws-item">
          <div class="ws-item-stem">
            <span class="ws-item-num">${numOf(item.id)}.</span>
            <div class="ws-item-text">${esc(item.stem)}${ans != null ? ' <strong>&rarr; ' + esc(mathAnswer(item.id, ans)) + '</strong>' : ''}</div>
            ${renderMarks(item.marks, opts)}
          </div>
          ${renderInlineExplanation(item.id, data, opts)}
        </div>`;
    }).join('');
  } else if (sec.type === 'e') {
    itemsHtml = sec.items.map(item => {
      const ans = opts.showAnswerKey ? data.answerKey[item.id] : null;
      // A structured item's answer space belongs to its individual parts,
      // not to the item as a whole — the parts tree provides it.
      const hasParts = !!(item.parts && item.parts.length);
      const workAreaHtml = hasParts
        ? ''
        : ans != null
          ? `<div class="ws-essay-answer"><strong>Jawaban:</strong> ${esc(mathAnswer(item.id, ans))}</div>`
          : (opts.autoAnswerSpace && item.marks
            ? renderAutoAnswerSpace(item.marks, opts)
            : `<div class="ws-essay-workspace"></div>`);
      return `
        <div class="ws-item">
          <div class="ws-item-stem">
            <span class="ws-item-num">${numOf(item.id)}.</span>
            <div class="ws-item-text">${esc(item.stem)}</div>
            ${hasParts ? '' : renderMarks(item.marks, opts)}
          </div>
          ${workAreaHtml}
          ${renderPartsTree(item, data, opts)}
          ${renderInlineExplanation(item.id, data, opts)}
        </div>`;
    }).join('');
  } else if (sec.type === 'ib') {
    itemsHtml = sec.items.map(item => {
      const ans = opts.showAnswerKey ? data.answerKey[item.id] : null;
      return `
        <div class="ws-item">
          <div class="ws-item-stem">
            <span class="ws-item-num">${numOf(item.id)}.</span>
            <div class="ws-item-text">${esc(item.stem)}${ans != null ? ' <strong>&rarr; ' + esc(mathAnswer(item.id, ans)) + '</strong>' : ''}</div>
            ${renderMarks(item.marks, opts)}
          </div>
          ${renderInlineExplanation(item.id, data, opts)}
        </div>`;
    }).join('');
  } else if (sec.type === 'm') {
    itemsHtml = sec.items.map(item => {
      const ans = opts.showAnswerKey ? data.answerKey[item.id] : null;
      return `
        <div class="ws-item">
          <div class="ws-match-row">
            <span class="ws-item-num">${numOf(item.id)}.</span>
            <div class="ws-item-text">${esc(item.stem)}</div>
            <span class="ws-match-answer">${ans != null ? '<strong>(' + esc(ans) + ')</strong>' : '( &nbsp; )'}</span>
          </div>
          ${renderInlineExplanation(item.id, data, opts)}
        </div>`;
    }).join('');
  }

  const bankHtml = sec.type === 'm'
    ? renderKolomBBox(sec.bank)
    : sec.type === 'ib'
      ? renderWordBankBox(sec.bank)
      : '';

  const headingWord = sec.headingWord || 'Bagian';
  const titleText = sec.num != null ? `${headingWord} ${sec.num}: ${sec.label}` : sec.label;
  return `
    <div class="ws-section">
      <div class="ws-section-title">${esc(titleText)}${renderSectionMarks(sec, opts)}</div>
      ${noteHtml}
      ${bankHtml}
      <div class="${colsClass}">${itemsHtml}</div>
    </div>`;
}

// "(20 nilai)" beside the section heading. Sits in the heading rather than
// as a trailing line so it survives the two-column body layout, where a
// trailing element would be stranded at the bottom of whichever column the
// section happened to end in.
function renderSectionMarks(sec, opts) {
  if (!opts.showMarks || !sec.marks) return '';
  return ` <span class="ws-section-marks">(${sec.marks} nilai)</span>`;
}

// "Kolom B" box for Mencocokkan sections — the shared multiple-choice-style
// answer list (A. .. B. .. ..) that every M item's blank is filled in from.
function renderKolomBBox(bankRaw) {
  if (!bankRaw) return '';
  const options = parseLetterOptions(bankRaw);
  if (!options.length) return '';
  return `
    <div class="ws-wordbank">
      <div class="ws-wordbank-title">Kolom B</div>
      <div class="ws-kolomb-grid">
        ${options.map(o => `<div><strong>${esc(o.label)}.</strong> ${esc(o.tex)}</div>`).join('')}
      </div>
    </div>`;
}

// "Kotak Kata" box for Isian Berpilihan sections — the word bank students
// pick from to fill each blank.
function renderWordBankBox(bankRaw) {
  if (!bankRaw) return '';
  const words = bankRaw.split(',').map(w => w.trim()).filter(Boolean);
  if (!words.length) return '';
  return `
    <div class="ws-wordbank">
      <div class="ws-wordbank-title">Kotak Kata</div>
      <div class="ws-wordbank-words">${words.map(w => esc(w)).join(' &bull; ')}</div>
    </div>`;
}

function renderEssaySection(sec, data, opts) {
  const colsClass = opts.bodyColumns === '2' ? 'ws-section-cols cols-2' : 'ws-section-cols';

  const itemsHtml = sec.items.map(item => {
    const subHtml = item.subItems.map(si => {
      const ans = opts.showAnswerKey ? data.answerKey[si.id] : null;
      const answerHtml = ans != null
        ? `<strong>${esc(mathAnswer(si.id, ans))}</strong>`
        : '<span class="ws-sub-blank"></span>';
      return `
        <div>
          <div class="ws-essay-sub">
            <div class="ws-sub-textwrap">
              <span class="ws-sub-label">${esc(si.letter || '')}.</span>
              <span class="ws-sub-text">${esc(si.text)}</span>
              ${renderMarks(si.marks, opts)}
            </div>
            <span class="ws-sub-answer">${answerHtml}</span>
          </div>
          ${renderInlineExplanation(si.id, data, opts)}
        </div>`;
    }).join('');

    return `
      <div class="ws-item">
        <div class="ws-item-stem">
          <span class="ws-item-num">${esc(item.num)}.</span>
          <div class="ws-item-text">${esc(item.stem)}</div>
        </div>
        ${renderInlineExplanation(item.id, data, opts)}
        <div class="ws-essay-subitems">${subHtml}</div>
      </div>`;
  }).join('');

  return `
    <div class="ws-section">
      <div class="ws-section-title">${esc(sec.label)}${renderSectionMarks(sec, opts)}</div>
      <div class="${colsClass}">${itemsHtml}</div>
    </div>`;
}

// ---------------------------------------------------------------------
// 3. PEMERIKSAAN NASKAH — pre-print validation
// ---------------------------------------------------------------------
// The tag language is now large enough (40 types, nested figures, image
// ids that can go stale when a picture is deleted) that a typo is easy to
// make and invisible until it shows up as a red placeholder in a PDF that
// has already been photocopied. Everything checkable without rendering a
// full sheet is checked here instead, and reported in the sidebar.

// A diagram tag reports its own failure by rendering one of these markers
// rather than throwing, so the cheapest reliable check is to render each
// tag once and look for them.
const DIAGRAM_ERROR_MARKERS = [
  'diagram tidak dikenali', 'diagram error', 'gambar error',
  'tidak ada di penyimpanan', 'bukan berkas gambar yang sah',
  'tidak ada panel', 'wajib ada', 'tidak boleh ditaruh di dalam figur'
];

function validateWorksheet(data, setLabel) {
  const issues = [];
  const where = setLabel ? setLabel + ': ' : '';
  const add = (level, text) => issues.push({ level, text: where + text });

  if (!data) return issues;

  // -- Diagram / image tags --------------------------------------------
  (data.diagramTags || []).forEach((tag) => {
    let html = '';
    try {
      html = typeof renderDiagramTag === 'function' ? renderDiagramTag(tag) : '';
    } catch (err) {
      add('error', 'Tag diagram gagal digambar: [[' + tag + ']] — ' + err.message);
      return;
    }
    if (DIAGRAM_ERROR_MARKERS.some((marker) => html.indexOf(marker) > -1)) {
      const plain = html.replace(/<[^>]*>/g, '').trim();
      add('error', 'Tag bermasalah [[' + tag.slice(0, 60) + ']] — ' + plain);
    }
  });

  // -- Items -------------------------------------------------------------
  const seen = {};
  const byPrefix = {};
  const allIds = [];
  data.sections.forEach((sec) => {
    const marked = [];
    sec.items.forEach((item) => {
      allIds.push(item.id);
      if (seen[item.id]) add('error', 'Nomor soal ganda: ' + item.id + ' muncul lebih dari sekali.');
      seen[item.id] = true;

      const prefix = (item.id.match(/^[A-Za-z]+/) || [''])[0];
      const num = parseInt((item.id.match(/\d+/) || [0])[0], 10);
      (byPrefix[prefix] = byPrefix[prefix] || []).push(num);

      if (item.type === 'pg') {
        const count = item.options ? item.options.length : 0;
        if (count < 2) {
          add('error', 'Soal ' + item.id + ' bertipe pilihan ganda tapi pilihannya hanya ' + count + '.');
        } else if (count < 4) {
          add('warn', 'Soal ' + item.id + ' hanya punya ' + count + ' pilihan (biasanya 4 atau 5).');
        }
      }
      marked.push(item.marks != null);

      (item.parts || []).forEach((part) => {
        allIds.push(part.id);
        (part.subs || []).forEach((sub) => allIds.push(sub.id));
      });
      (item.subItems || []).forEach((si) => allIds.push(si.id));
    });
    // Half-marked sections are almost always an unfinished edit, and they
    // make the section/paper totals silently wrong.
    const withMarks = marked.filter(Boolean).length;
    if (withMarks && withMarks < marked.length) {
      add('warn', 'Bagian "' + (sec.label || '(tanpa judul)') + '": ' + withMarks + ' dari ' + marked.length
        + ' soal punya bobot nilai — totalnya jadi tidak mewakili seluruh bagian.');
    }
  });

  Object.keys(byPrefix).forEach((prefix) => {
    const nums = byPrefix[prefix].slice().sort((a, b) => a - b);
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] > nums[i - 1] + 1) {
        add('warn', 'Penomoran ' + prefix + ' melompat dari ' + prefix + nums[i - 1] + ' ke ' + prefix + nums[i] + '.');
      }
    }
  });

  // -- Answer key --------------------------------------------------------
  const keyIds = Object.keys(data.answerKey || {});
  if (keyIds.length) {
    const idSet = {};
    allIds.forEach((id) => { idSet[id] = true; });
    keyIds.forEach((id) => {
      if (!idSet[id]) add('warn', 'Kunci jawaban untuk "' + id + '" tidak punya soal yang cocok.');
    });
    const missing = allIds.filter((id) => data.answerKey[id] == null && !/^Problem/.test(id));
    // Structured items ("E1" with (a)/(b) parts) hold their answers on the
    // parts, so the parent id having no key of its own is normal.
    const structuredParents = {};
    data.sections.forEach((sec) => sec.items.forEach((it) => {
      if (it.parts && it.parts.length) structuredParents[it.id] = true;
      // A part that only introduces its roman sub-parts likewise carries
      // no answer of its own.
      (it.parts || []).forEach((part) => { if (part.subs && part.subs.length) structuredParents[part.id] = true; });
    }));
    const realMissing = missing.filter((id) => !structuredParents[id]);
    if (realMissing.length) {
      const shown = realMissing.slice(0, 8).join(', ');
      add('warn', 'Belum ada kunci jawaban untuk ' + realMissing.length + ' soal: ' + shown
        + (realMissing.length > 8 ? ', ...' : ''));
    }
  }

  return issues;
}

// ---------------------------------------------------------------------
// 4. PAKET ACAK — variant generator
// ---------------------------------------------------------------------
// Turns one parsed worksheet into several "paket" (A, B, C, ...) that hold
// exactly the same questions in a different order, with each PG item's
// options shuffled too — so neighbouring students can't copy each other,
// while the teacher still only wrote (and only has to check) one set of
// questions. Every variant gets its own renumbered Kunci Jawaban and
// Pembahasan, since both are keyed by item id and those ids move.

const VARIANT_LETTERS = 'ABCDEF';

// Seeded PRNG (mulberry32). The shuffle MUST be reproducible: render() runs
// again on every slider drag and checkbox toggle, and a Math.random()-based
// shuffle would deal a different Paket B on each of those — so the preview
// would never match what actually prints, and the page count readout would
// jitter. Same seed in, same paket out, until "Acak Ulang" changes the seed.
function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates on a copy — the caller's array (the original, un-shuffled
// worksheet data, which Paket A still renders from) is never touched.
function shuffledCopy(arr, rng) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
  }
  return out;
}

// "Semua jawaban benar" / "None of the above" style options only make sense
// as the LAST choice — shuffling one into the middle of the list reads as a
// mistake and can even make the item unanswerable ("semua di atas benar"
// sitting at B refers to A alone). These are held in place; only the real
// options around them are shuffled.
const ANCHORED_OPTION_RE = /^(?:semua|semuanya|tidak ada|bukan|salah semua|benar semua|all of|none of|both|neither)\b/i;

function isAnchoredOption(option) {
  return ANCHORED_OPTION_RE.test(String(option && option.tex || '').trim());
}

// Shuffles an item's options, then relabels them A/B/C/... in their new
// order. Returns the new option list plus a map from each option's OLD
// label to its NEW one, which is what the Kunci Jawaban letter is rewritten
// through afterwards.
function shuffleOptionsOf(options, rng) {
  const anchored = [];
  const movable = [];
  options.forEach((o, i) => {
    if (isAnchoredOption(o)) anchored.push({ o, i });
    else movable.push(o);
  });
  const mixed = shuffledCopy(movable, rng);
  // Put the anchored ones back at the positions they originally held (they
  // are, in practice, always the trailing option or two).
  anchored.forEach(({ o, i }) => mixed.splice(i, 0, o));

  const labelMap = {};
  const newOptions = mixed.map((o, i) => {
    const newLabel = String.fromCharCode(65 + i);
    labelMap[o.label] = newLabel;
    return { label: newLabel, tex: o.tex };
  });
  return { options: newOptions, labelMap };
}

// Rewrites a Kunci Jawaban value through an option-letter map. Values are
// normally a bare letter ("C"), but "C." and "C. 24" both turn up in real
// pastes, so only the leading letter is swapped and any trailing text is
// left alone.
function remapAnswerLetter(value, labelMap) {
  const m = String(value).match(/^\s*([A-E])(\b|\.|$)([\s\S]*)$/);
  if (!m || !labelMap[m[1]]) return value;
  return labelMap[m[1]] + m[2] + m[3];
}

function makeVariant(data, seed, opts) {
  opts = opts || {};
  const shuffleItems = opts.shuffleItems !== false;
  const shuffleOptions = opts.shuffleOptions !== false;
  const rng = makeRng(seed);

  const idMap = {};        // old item id -> new item id
  const letterMaps = {};   // old item id -> { oldOptionLabel: newOptionLabel }
  // Item numbering runs continuously across sections per prefix, the same
  // way the original naskah numbers them (a worksheet with two PG sections
  // runs PG1..PG5 then PG6..PG10, not PG1..PG5 twice) — so the counter is
  // held out here, across the whole worksheet, not reset per section.
  const counters = {};
  function nextId(prefix) {
    counters[prefix] = (counters[prefix] || 0) + 1;
    return prefix + counters[prefix];
  }

  const sections = data.sections.map((sec) => {
    const source = shuffleItems && sec.items.length > 1 ? shuffledCopy(sec.items, rng) : sec.items.slice();
    const items = source.map((item) => {
      if (item.type === 'essay') {
        // "Problem N" essays carry lettered sub-items whose own ids embed
        // the problem number ("E3a"), so those have to be renumbered along
        // with their parent or the answer key stops lining up.
        counters.Problem = (counters.Problem || 0) + 1;
        const newNum = String(counters.Problem);
        const newId = 'Problem' + newNum;
        idMap[item.id] = newId;
        const subItems = (item.subItems || []).map((si) => {
          const prefix = (si.id.match(/^[A-Za-z]+/) || [''])[0];
          const newSubId = prefix + newNum + (si.letter || '');
          idMap[si.id] = newSubId;
          return Object.assign({}, si, { id: newSubId });
        });
        return Object.assign({}, item, { id: newId, num: newNum, subItems });
      }

      const prefix = (item.id.match(/^[A-Za-z]+/) || [''])[0];
      const newId = nextId(prefix);
      idMap[item.id] = newId;
      const next = Object.assign({}, item, { id: newId });
      // Structured sub-part ids are built from the parent's id ("E1" ->
      // "E1a" -> "E1a.ii"), so renumbering the parent has to rebuild the
      // whole branch or the answer key stops resolving. Sub-part ORDER is
      // never shuffled: (a) routinely sets up the calculation that (b)
      // depends on, so reordering them would break the question itself.
      if (item.parts && item.parts.length) {
        next.parts = item.parts.map((part) => {
          const newPartId = newId + part.label;
          idMap[part.id] = newPartId;
          return Object.assign({}, part, {
            id: newPartId,
            subs: (part.subs || []).map((sub) => {
              const newSubId = newPartId + '.' + sub.label;
              idMap[sub.id] = newSubId;
              return Object.assign({}, sub, { id: newSubId });
            })
          });
        });
      }
      if (shuffleOptions && item.type === 'pg' && item.options && item.options.length > 1) {
        const shuffled = shuffleOptionsOf(item.options, rng);
        next.options = shuffled.options;
        letterMaps[item.id] = shuffled.labelMap;
      }
      return next;
    });
    return Object.assign({}, sec, { items });
  });

  // Kunci Jawaban and Pembahasan are plain { itemId: value } maps, so both
  // are rebuilt through idMap. Mapped ids are written first; an id the
  // worksheet has no matching item for (a stray key for a question that
  // was deleted from the naskah) is only carried over if it doesn't
  // collide with a renumbered one.
  function remapKeyed(source, remapValue) {
    const out = {};
    Object.keys(source).forEach((oldId) => {
      if (!idMap[oldId]) return;
      out[idMap[oldId]] = remapValue ? remapValue(oldId, source[oldId]) : source[oldId];
    });
    Object.keys(source).forEach((oldId) => {
      if (idMap[oldId] || Object.prototype.hasOwnProperty.call(out, oldId)) return;
      out[oldId] = source[oldId];
    });
    return out;
  }

  return Object.assign({}, data, {
    sections,
    answerKey: remapKeyed(data.answerKey, (oldId, val) => (
      letterMaps[oldId] ? remapAnswerLetter(val, letterMaps[oldId]) : val
    )),
    explanations: remapKeyed(data.explanations)
  });
}

// ---------------------------------------------------------------------
// 5. UI WIRING
// ---------------------------------------------------------------------

// DIAGRAM_DOCS, SUBJECT_PRESETS, ITEM_TYPE_DOCS, buildAIPrompt, and
// buildDefaultAIPrompt now live in prompt-builder.js (loaded via <script>
// before this file, so they're plain top-level bindings here too) — shared
// with default-prompt.js (CLI) and the menu bar app's "Copy Prompt AI" menu,
// which reuse buildDefaultAIPrompt to skip the form entirely.

document.addEventListener('DOMContentLoaded', () => {
  const el = id => document.getElementById(id);

  const rawInput = el('rawInput');
  const pageEl = el('page');
  let titleTouched = false;
  el('worksheetTitle').addEventListener('input', () => { titleTouched = true; });

  // The app is normally opened straight from disk (file://), where there's
  // no server to control. This banner only appears when the page is being
  // served by server.js (started via "Start Server.command") — i.e. when a
  // teaching assistant on the same WiFi could actually be reaching it too —
  // and gives an in-app way to turn that access back off.
  if (location.protocol !== 'file:') {
    const banner = el('serverBanner');
    if (banner) {
      banner.hidden = false;
      const bannerText = el('serverBannerText');
      const copyBtn = el('btnCopyServerAddr');
      bannerText.textContent = 'Server lokal aktif — memuat alamat WiFi...';

      // location.origin is whatever address THIS browser happened to load
      // the page from — "Start Server.command" opens localhost, which only
      // ever means "this computer" and is useless to hand an assistant on
      // another device. The real LAN address(es) only server.js can see
      // (via os.networkInterfaces()), so it's fetched from there instead.
      fetch('/__info').then((r) => r.json()).then(({ port, addresses }) => {
        if (!addresses || !addresses.length) {
          bannerText.textContent = 'Server lokal aktif, tapi alamat WiFi tidak terdeteksi — pastikan komputer ini terhubung ke jaringan.';
          return;
        }
        const primary = 'http://' + addresses[0] + ':' + port;
        bannerText.innerHTML = 'Bagikan alamat ini ke asisten (WiFi yang sama):<br><strong>' + esc(primary) + '</strong>'
          + (addresses.length > 1
            ? '<br><span style="opacity:.75;">Alternatif jika tidak berhasil: ' + addresses.slice(1).map((a) => esc('http://' + a + ':' + port)).join(', ') + '</span>'
            : '');
        copyBtn.hidden = false;
        copyBtn.addEventListener('click', () => {
          copyText(primary).then(() => {
            flashButton(copyBtn, '✅ Tersalin!');
          }).catch(() => {
            window.prompt('Salin alamat ini secara manual:', primary);
          });
        });
      }).catch(() => {
        bannerText.textContent = 'Server lokal aktif — bisa diakses siapa pun di WiFi ini lewat ' + location.origin;
      });

      el('btnStopServer').addEventListener('click', () => {
        if (!confirm('Matikan server lokal? Asisten tidak akan bisa mengakses lagi sampai server dinyalakan ulang lewat "Start Server.command".')) return;
        const btn = el('btnStopServer');
        btn.textContent = 'Mematikan...';
        btn.disabled = true;
        copyBtn.hidden = true;
        fetch('/__shutdown', { method: 'POST' }).catch(() => {}).finally(() => {
          bannerText.textContent = 'Server dimatikan. Halaman ini sudah tidak tersambung.';
        });
      });
    }
  }

  // Small "Mapel/Sekolah/Kelas/TglBulan/Soal ke-" fields auto-join into the
  // Judul field so the user doesn't have to type the whole code by hand.
  const CODE_FIELD_IDS = ['codeMapel', 'codeSekolah', 'codeKelas', 'codeTanggal', 'codeNomor'];
  function updateCodeTitle() {
    const parts = CODE_FIELD_IDS.map(id => el(id).value.trim()).filter(Boolean);
    if (parts.length) {
      el('worksheetTitle').value = parts.join('/');
      titleTouched = true;
    }
  }

  // When several sets are pasted at once (see splitIntoSets), each set's
  // own title needs to say which set it is — otherwise two or three
  // worksheets with an identical header are impossible to tell apart once
  // printed back to back. Reuses the "Soal ke-" slot in the code system
  // (Mapel/Sekolah/Kelas/TglBulan/Soal-ke) for the set number(s) when that
  // system is in use, since that's exactly the slot it's for; otherwise
  // falls back to appending "- Set N" to whatever title would normally
  // show. `setLabel` can be a single set's number or a joined "1-2-3" for
  // a combined filename covering every set in the document.
  function titleForSet(baseTitle, setLabel) {
    const codeFieldsInUse = CODE_FIELD_IDS.some(id => el(id).value.trim());
    if (codeFieldsInUse) {
      const parts = ['codeMapel', 'codeSekolah', 'codeKelas', 'codeTanggal'].map(id => el(id).value.trim()).filter(Boolean);
      parts.push(String(setLabel));
      return parts.join('/');
    }
    return baseTitle + ' - Set ' + setLabel;
  }

  // "TglBulan" (DDMM, e.g. "1908" for 19 August) is filled in fresh from
  // today's date on every page load — unlike the other code/settings
  // fields below, it's never remembered from a past session, since a
  // remembered date would silently go stale.
  function autofillTanggal() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    el('codeTanggal').value = dd + mm;
  }

  // Header/layout settings the user configures once and reuses every
  // worksheet (brand name, Mapel/Sekolah/Kelas/Soal-ke codes, checkboxes,
  // column/font/line-height/diagram-size preferences) are remembered
  // across sessions so they don't have to be re-entered each time — only
  // the raw naskah soal (a new document every time) and TglBulan (always
  // today, see autofillTanggal) are left out.
  const SETTINGS_STORAGE_KEY = 'exactWorksheetMaker.settings';
  const PERSISTED_FIELD_IDS = [
    'brandName', 'codeMapel', 'codeSekolah', 'codeKelas', 'codeNomor',
    'showLogo', 'showName', 'showClass', 'showDate', 'showScore',
    'pgOptionCols', 'bodyColumns', 'compactFormulas', 'showFormulaBox',
    'showAnswerKey', 'showExplanation', 'fontSize', 'lineHeight', 'diagramSize', 'imageSize', 'spreadView',
    // How the paket are shuffled is a lasting preference; how MANY paket to
    // print deliberately isn't (variantCount is left out) — a forgotten "4
    // paket" would quadruple the next session's paper on the first print.
    'variantShuffleItems', 'variantShuffleOptions',
    'showMarks', 'autoAnswerSpace', 'linesPerMark'
  ];
  function saveSettings() {
    const data = {};
    PERSISTED_FIELD_IDS.forEach(id => {
      const node = el(id);
      data[id] = node.type === 'checkbox' ? node.checked : node.value;
    });
    try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* private mode etc. — skip */ }
  }
  function loadSettings() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}'); } catch (e) { saved = {}; }
    PERSISTED_FIELD_IDS.forEach(id => {
      if (!(id in saved)) return;
      const node = el(id);
      if (node.type === 'checkbox') node.checked = !!saved[id];
      else node.value = saved[id];
    });
  }

  // -------------------------------------------------------------------
  // Riwayat Lembar Kerja — local, per-browser document history
  // -------------------------------------------------------------------
  // saveSettings() above only remembers the header/layout preferences; the
  // naskah soal itself — the part that actually took work to produce — used
  // to vanish the moment the tab closed. Every render writes the current
  // document back into this list, so reopening the app (or clicking an
  // older entry) brings the whole worksheet back, settings included.
  //
  // localStorage rather than IndexedDB on purpose: these entries are a few
  // KB of plain text each, the app is normally opened over file:// (where
  // an async DB adds real complexity for nothing), and a synchronous write
  // can't lose a save to a tab being closed mid-transaction.
  const HISTORY_STORAGE_KEY = 'exactWorksheetMaker.history';
  const HISTORY_LIMIT = 40;
  // Below this, the textarea is somebody typing a title or halfway through
  // a paste, not a worksheet worth keeping a version of.
  const HISTORY_MIN_CHARS = 40;
  // The full field snapshot an entry restores. Same list saveSettings()
  // persists, plus TglBulan — normally re-stamped to today on every load,
  // but an entry reopened next week should still show the date the
  // worksheet was actually written for.
  const HISTORY_FIELD_IDS = PERSISTED_FIELD_IDS.concat(['codeTanggal']);

  // Which stored entry the current editor content belongs to. Null means
  // "unsaved new document" — the next auto-save mints a fresh id instead of
  // overwriting whatever was open before.
  let currentDocId = null;
  let historySaveTimer = null;
  let historyStorageFailed = false;

  function loadHistory() {
    let list;
    try { list = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]'); } catch (e) { list = []; }
    return Array.isArray(list) ? list.filter(e => e && e.id && typeof e.raw === 'string') : [];
  }

  function writeHistory(list) {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
      historyStorageFailed = false;
      return true;
    } catch (e) {
      // Quota exceeded (or private mode): drop the oldest half and retry
      // once, so a long history can't permanently block new saves.
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list.slice(0, Math.max(1, Math.floor(list.length / 2)))));
        historyStorageFailed = false;
        return true;
      } catch (e2) {
        historyStorageFailed = true;
        return false;
      }
    }
  }

  function snapshotFields() {
    const data = {};
    HISTORY_FIELD_IDS.forEach(id => {
      const node = el(id);
      data[id] = node.type === 'checkbox' ? node.checked : node.value;
    });
    return data;
  }

  function applyFieldSnapshot(snapshot) {
    if (!snapshot) return;
    HISTORY_FIELD_IDS.forEach(id => {
      if (!(id in snapshot)) return;
      const node = el(id);
      if (node.type === 'checkbox') node.checked = !!snapshot[id];
      else node.value = snapshot[id];
    });
  }

  function historyTitleForCurrent() {
    const coded = el('worksheetTitle').value.trim();
    if (coded) return coded;
    const firstLine = (rawInput.value.split('\n').find(l => l.trim()) || '').trim();
    return firstLine.slice(0, 70) || 'Lembar Kerja';
  }

  function countItemsIn(raw) {
    return (raw.match(/(?:PG|IB|B|I|E|M)\d+\./g) || []).length;
  }

  function newDocId() {
    return 'ws-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  // `forceNew` is what the "Simpan Salinan" button passes: it freezes the
  // entry currently being auto-saved into and continues under a fresh id,
  // so the teacher keeps the version they had before editing further.
  function saveCurrentToHistory(forceNew) {
    const raw = rawInput.value;
    if (raw.trim().length < HISTORY_MIN_CHARS) return false;
    if (!currentDocId || forceNew) currentDocId = newDocId();
    const list = loadHistory();
    const entry = {
      id: currentDocId,
      title: historyTitleForCurrent(),
      savedAt: Date.now(),
      raw,
      settings: snapshotFields()
    };
    const existing = list.findIndex(e => e.id === entry.id);
    if (existing > -1) list.splice(existing, 1);
    list.unshift(entry);
    while (list.length > HISTORY_LIMIT) list.pop();
    const ok = writeHistory(list);
    renderHistoryList();
    return ok;
  }

  // Auto-save is debounced because render() re-runs on every slider drag
  // and keystroke — without this, dragging the font-size slider would
  // rewrite the whole history entry a few dozen times per second.
  function scheduleHistorySave() {
    clearTimeout(historySaveTimer);
    historySaveTimer = setTimeout(() => saveCurrentToHistory(false), 1500);
  }

  function openHistoryEntry(id) {
    const entry = loadHistory().find(e => e.id === id);
    if (!entry) return;
    // A save for the document being navigated AWAY from may still be
    // pending — letting it fire after the swap would write the new
    // document's content into the old entry's id.
    clearTimeout(historySaveTimer);
    currentDocId = entry.id;
    rawInput.value = entry.raw;
    applyFieldSnapshot(entry.settings);
    titleTouched = false;
    updateCodeTitle();
    renderHistoryList();
    render();
  }

  function deleteHistoryEntry(id) {
    const list = loadHistory().filter(e => e.id !== id);
    writeHistory(list);
    // Deleting the entry the editor is currently bound to detaches it, so
    // the next auto-save starts a new one rather than resurrecting the
    // deleted row — and any save already queued for that id is dropped,
    // since letting it fire would write the row straight back.
    if (id === currentDocId) {
      clearTimeout(historySaveTimer);
      currentDocId = null;
    }
    renderHistoryList();
  }

  function formatSavedAt(ts) {
    const then = new Date(ts);
    const diffMin = Math.round((Date.now() - ts) / 60000);
    if (diffMin < 1) return 'baru saja';
    if (diffMin < 60) return diffMin + ' menit lalu';
    const sameDay = then.toDateString() === new Date().toDateString();
    const hhmm = String(then.getHours()).padStart(2, '0') + '.' + String(then.getMinutes()).padStart(2, '0');
    if (sameDay) return 'hari ini ' + hhmm;
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return then.getDate() + ' ' + MONTHS[then.getMonth()] + ' ' + hhmm;
  }

  function renderHistoryList() {
    const host = el('historyList');
    const status = el('historyStatus');
    const list = loadHistory();
    host.innerHTML = '';

    if (historyStorageFailed) {
      status.textContent = 'Riwayat tidak bisa disimpan di browser ini (penyimpanan penuh atau mode penyamaran).';
    } else if (!list.length) {
      status.textContent = 'Belum ada lembar kerja tersimpan.';
    } else {
      status.textContent = list.length + ' lembar kerja tersimpan · disimpan otomatis';
    }

    list.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'history-entry' + (entry.id === currentDocId ? ' is-current' : '');

      // Entry titles come from the user's own naskah, so they're set as
      // text nodes rather than innerHTML — a worksheet whose first line
      // contains "<" must never become markup in the sidebar.
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'history-open';
      open.title = 'Buka lembar kerja ini';
      const titleEl = document.createElement('span');
      titleEl.className = 'history-title';
      titleEl.textContent = entry.title || 'Lembar Kerja';
      const metaEl = document.createElement('span');
      metaEl.className = 'history-meta';
      const count = countItemsIn(entry.raw);
      metaEl.textContent = (count ? count + ' soal · ' : '') + formatSavedAt(entry.savedAt)
        + (entry.id === currentDocId ? ' · sedang dibuka' : '');
      open.appendChild(titleEl);
      open.appendChild(metaEl);
      open.addEventListener('click', () => openHistoryEntry(entry.id));

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'history-action';
      del.title = 'Hapus dari riwayat';
      del.textContent = '🗑️';
      del.addEventListener('click', () => {
        if (!confirm('Hapus "' + (entry.title || 'Lembar Kerja') + '" dari riwayat?')) return;
        deleteHistoryEntry(entry.id);
      });

      row.appendChild(open);
      row.appendChild(del);
      host.appendChild(row);
    });
  }

  el('btnSaveHistory').addEventListener('click', () => {
    if (rawInput.value.trim().length < HISTORY_MIN_CHARS) {
      alert('Naskah soal masih kosong (atau terlalu pendek) untuk disimpan.');
      return;
    }
    clearTimeout(historySaveTimer);
    // Flush the current document under its existing id first, so the frozen
    // copy keeps the latest edits, then continue in a new entry. Skipped
    // when nothing has been auto-saved yet — otherwise a never-saved naskah
    // would land twice, as two identical entries.
    if (currentDocId) saveCurrentToHistory(false);
    if (saveCurrentToHistory(true)) flashButton(el('btnSaveHistory'), '✅ Tersimpan!');
  });

  el('btnClearHistory').addEventListener('click', () => {
    const list = loadHistory();
    if (!list.length) return;
    if (!confirm('Hapus SEMUA ' + list.length + ' lembar kerja dari riwayat? Tindakan ini tidak bisa dibatalkan.')) return;
    writeHistory([]);
    currentDocId = null;
    renderHistoryList();
  });

  // -------------------------------------------------------------------
  // Penyimpanan Gambar — imported pictures, kept out of the naskah
  // -------------------------------------------------------------------
  // Pictures are stored here under a short id ("g1") and referenced from
  // the naskah as [[gambar: id=g1]], rather than pasted inline as base64:
  // a single photo is tens of thousands of characters, and inlining one
  // would bury the questions it belongs to. diagrams.js resolves those ids
  // back to real data URLs through setImageResolver() below.
  const IMAGE_STORAGE_KEY = 'exactWorksheetMaker.images';
  // 1200px on the long edge is roughly 300 dpi at the ~260pt width a
  // diagram prints at — enough for print, small enough that a worksheet's
  // worth of pictures still fits in localStorage.
  const IMAGE_MAX_DIM = 1200;
  const IMAGE_MAX_BYTES = 420000;
  const IMAGE_QUALITY_STEPS = [0.85, 0.7, 0.55];

  function loadImages() {
    let store;
    try { store = JSON.parse(localStorage.getItem(IMAGE_STORAGE_KEY) || '{}'); } catch (e) { store = {}; }
    return store && typeof store === 'object' ? store : {};
  }

  function writeImages(store) {
    try {
      localStorage.setItem(IMAGE_STORAGE_KEY, JSON.stringify(store));
      return true;
    } catch (e) {
      // Deliberately NOT self-healing by dropping images: unlike history
      // entries, a discarded picture leaves a dead [[gambar: id=...]] tag
      // in a naskah that may already be printed. The import is refused
      // instead, and the teacher decides what to delete.
      return false;
    }
  }

  function nextImageId(store) {
    for (let n = 1; n <= 999; n++) {
      if (!store['g' + n]) return 'g' + n;
    }
    return 'g' + Date.now();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Berkas gambar tidak bisa dibaca.'));
      reader.readAsDataURL(file);
    });
  }

  function loadImageElement(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Berkas ini bukan gambar yang bisa dibuka.'));
      img.src = dataUrl;
    });
  }

  // Shrinks to print size and re-encodes until it fits the per-picture
  // budget, trading quality first and only then more resolution.
  async function downscaleImage(dataUrl, mimeType) {
    const img = await loadImageElement(dataUrl);
    const isPng = mimeType === 'image/png';
    let scale = Math.min(1, IMAGE_MAX_DIM / Math.max(img.width, img.height));
    for (let attempt = 0; attempt < 4; attempt++) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      // PNGs may be transparent; flattening onto white keeps them printable
      // instead of turning transparent areas black in the PDF.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const quality = IMAGE_QUALITY_STEPS[Math.min(attempt, IMAGE_QUALITY_STEPS.length - 1)];
      // A scanned diagram (line art) stays PNG on the first pass, where
      // JPEG's ringing around black lines is very visible; if that blows
      // the budget it falls back to JPEG like everything else.
      const out = (isPng && attempt === 0)
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', quality);
      if (out.length <= IMAGE_MAX_BYTES || attempt === 3) {
        return { dataUrl: out, width: canvas.width, height: canvas.height };
      }
      scale *= 0.8;
    }
    return null;
  }

  async function importImageFile(file) {
    const raw = await readFileAsDataUrl(file);
    // SVG is already resolution-independent text — rasterising it through
    // a canvas would only make it bigger AND blurrier.
    const prepared = file.type === 'image/svg+xml'
      ? { dataUrl: raw, width: 0, height: 0 }
      : await downscaleImage(raw, file.type);
    if (!prepared || !/^data:image\//.test(prepared.dataUrl)) {
      throw new Error('Format gambar ini tidak didukung.');
    }
    if (prepared.dataUrl.length > IMAGE_MAX_BYTES * 2) {
      throw new Error('Gambar terlalu besar untuk disimpan, bahkan setelah diperkecil.');
    }
    const store = loadImages();
    const id = nextImageId(store);
    store[id] = {
      id,
      name: file.name || 'gambar',
      dataUrl: prepared.dataUrl,
      width: prepared.width,
      height: prepared.height,
      addedAt: Date.now()
    };
    if (!writeImages(store)) {
      throw new Error('Penyimpanan browser penuh. Hapus beberapa gambar lama dulu lewat daftar di bawah tombol impor.');
    }
    return id;
  }

  // Same cursor-aware insertion the diagram builder uses, so a picture
  // lands inside the sentence the teacher was writing.
  function insertAtCursor(text) {
    const start = rawInput.selectionStart != null ? rawInput.selectionStart : rawInput.value.length;
    const end = rawInput.selectionEnd != null ? rawInput.selectionEnd : rawInput.value.length;
    const before = rawInput.value.slice(0, start);
    const after = rawInput.value.slice(end);
    const insertion = (before.length && !/\s$/.test(before) ? ' ' : '') + text + ' ';
    rawInput.value = before + insertion + after;
    const cursor = (before + insertion).length;
    rawInput.focus();
    rawInput.setSelectionRange(cursor, cursor);
  }

  async function importAndInsert(files) {
    const list = Array.from(files || []).filter(f => /^image\//.test(f.type));
    if (!list.length) return;
    const status = el('imageStatus');
    status.textContent = 'Mengimpor ' + list.length + ' gambar...';
    const ids = [];
    for (const file of list) {
      try {
        ids.push(await importImageFile(file));
      } catch (err) {
        alert('Gagal mengimpor "' + (file.name || 'gambar') + '": ' + err.message);
        break;
      }
    }
    if (ids.length) {
      // Tanpa "lebar=": besarnya ikut slider "Ukuran gambar", jadi satu
      // geseran membesarkan semua gambar di lembar; lebar= tetap bisa
      // ditulis tangan untuk satu gambar yang perlu beda.
      insertAtCursor(ids.map(id => '[[gambar: id=' + id + ']]').join(' '));
      render();
    }
    renderImageList();
  }

  function imageStoreBytes(store) {
    return Object.keys(store).reduce((sum, id) => sum + (store[id].dataUrl || '').length, 0);
  }

  function deleteImage(id) {
    // A tag pointing at a deleted picture renders as a visible red
    // placeholder rather than silently vanishing, so warn while the naskah
    // still mentions it — that's the moment the teacher can still undo.
    const inUse = rawInput.value.indexOf('id=' + id) > -1;
    const msg = inUse
      ? 'Gambar "' + id + '" masih dipakai di naskah soal. Hapus juga? Tag [[gambar: id=' + id + ']] akan berubah jadi tanda merah.'
      : 'Hapus gambar "' + id + '" dari penyimpanan?';
    if (!confirm(msg)) return;
    const store = loadImages();
    delete store[id];
    writeImages(store);
    renderImageList();
    render();
  }

  function renderImageList() {
    const host = el('imageList');
    const status = el('imageStatus');
    const store = loadImages();
    const ids = Object.keys(store).sort((a, b) => (store[a].addedAt || 0) - (store[b].addedAt || 0));
    host.innerHTML = '';
    if (!ids.length) {
      status.textContent = '';
      return;
    }
    status.textContent = ids.length + ' gambar tersimpan · ' + (imageStoreBytes(store) / 1048576).toFixed(2) + ' MB';

    ids.forEach((id) => {
      const rec = store[id];
      const cell = document.createElement('div');
      cell.className = 'image-chip';

      const thumb = document.createElement('img');
      thumb.className = 'image-thumb';
      thumb.src = rec.dataUrl;
      thumb.alt = rec.name || id;
      thumb.title = 'Sisipkan [[gambar: id=' + id + ']] ke naskah';
      thumb.addEventListener('click', () => {
        insertAtCursor('[[gambar: id=' + id + ']]');
        render();
      });

      const tag = document.createElement('span');
      tag.className = 'image-chip-id';
      tag.textContent = id;

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'image-chip-del';
      del.title = 'Hapus gambar';
      del.textContent = '×';
      del.addEventListener('click', () => deleteImage(id));

      cell.appendChild(thumb);
      cell.appendChild(tag);
      cell.appendChild(del);
      host.appendChild(cell);
    });
  }

  // diagrams.js keeps no storage of its own — this is how [[gambar: id=g1]]
  // finds the actual picture at render time.
  if (typeof setImageResolver === 'function') {
    setImageResolver((id) => loadImages()[id] || null);
  }

  el('btnInsertImage').addEventListener('click', () => el('imageFileInput').click());
  el('imageFileInput').addEventListener('change', (e) => {
    importAndInsert(e.target.files);
    // Reset so re-picking the SAME file still fires a change event.
    e.target.value = '';
  });

  rawInput.addEventListener('dragover', (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') > -1) {
      e.preventDefault();
      rawInput.classList.add('drop-target');
    }
  });
  rawInput.addEventListener('dragleave', () => rawInput.classList.remove('drop-target'));
  rawInput.addEventListener('drop', (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    e.preventDefault();
    rawInput.classList.remove('drop-target');
    importAndInsert(files);
  });

  rawInput.addEventListener('paste', (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    const files = Array.from(items).filter(it => it.kind === 'file' && /^image\//.test(it.type)).map(it => it.getAsFile());
    if (!files.length) return;
    // Only swallow the paste when it really is an image — a normal text
    // paste of the naskah must still land in the textarea untouched.
    e.preventDefault();
    importAndInsert(files);
  });

  // -------------------------------------------------------------------
  // Berkas Proyek (.ews) — naskah + pengaturan + gambar dalam satu berkas
  // -------------------------------------------------------------------
  // Imported pictures live in THIS browser's storage, so a naskah copied
  // to another computer as plain text arrives with dead [[gambar]] tags.
  // An .ews bundle carries the pictures along with the text and settings,
  // which is what makes a worksheet shareable in still-editable form
  // rather than only as a finished PDF.
  const PROJECT_FORMAT = 'exact-worksheet-maker';
  const PROJECT_VERSION = 1;

  // Matches the id of any image tag, whichever alias was used for the type.
  const IMAGE_TAG_ID_RE = /(\[\[\s*(?:gambar|foto|image)\s*:[^\]]*?\bid\s*=\s*)([A-Za-z0-9_]+)/gi;

  function imageIdsUsedIn(raw) {
    const ids = {};
    let m;
    IMAGE_TAG_ID_RE.lastIndex = 0;
    while ((m = IMAGE_TAG_ID_RE.exec(raw))) ids[m[2]] = true;
    return Object.keys(ids);
  }

  function downloadTextFile(text, filename, mime) {
    const blob = new Blob([text], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoking immediately can cancel the download in some builds; a short
    // delay is the usual way to let the browser start reading the blob.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function exportProject() {
    const raw = rawInput.value;
    if (!raw.trim()) {
      alert('Naskah soal masih kosong — tidak ada yang bisa diekspor.');
      return;
    }
    const store = loadImages();
    // Only the pictures this naskah actually refers to travel with it, so
    // a bundle never carries the whole image library along by accident.
    const images = {};
    imageIdsUsedIn(raw).forEach((id) => { if (store[id]) images[id] = store[id]; });
    const bundle = {
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      savedAt: Date.now(),
      title: historyTitleForCurrent(),
      raw,
      settings: snapshotFields(),
      images
    };
    const safeName = (historyTitleForCurrent() || 'Lembar Kerja').replace(/[\\/:*?"<>|]/g, '-').trim();
    downloadTextFile(JSON.stringify(bundle), safeName + '.ews', 'application/json');
    flashButton(el('btnExportProject'), '✅ Terunduh!');
  }

  async function importProject(file) {
    let bundle;
    try {
      bundle = JSON.parse(await file.text());
    } catch (err) {
      alert('Berkas ini bukan berkas .ews yang sah (isinya tidak bisa dibaca).');
      return;
    }
    if (!bundle || bundle.format !== PROJECT_FORMAT || typeof bundle.raw !== 'string') {
      alert('Berkas ini bukan berkas proyek Exact Worksheet Maker.');
      return;
    }
    if (rawInput.value.trim() && !confirm('Buka "' + (bundle.title || 'lembar kerja') + '"? Naskah yang sekarang tetap tersimpan di Riwayat.')) {
      return;
    }
    clearTimeout(historySaveTimer);
    saveCurrentToHistory(false);

    const store = loadImages();
    const idMap = {};
    let raw = bundle.raw;
    Object.keys(bundle.images || {}).forEach((oldId) => {
      const rec = bundle.images[oldId];
      if (!rec || !/^data:image\//.test(rec.dataUrl || '')) return;
      // The same picture already here (byte-identical) is reused rather
      // than stored a second time under a new id.
      const twin = Object.keys(store).find((id) => store[id].dataUrl === rec.dataUrl);
      if (twin) { idMap[oldId] = twin; return; }
      // An id that is free locally keeps its name; one that would collide
      // gets a fresh id, so an incoming picture can never overwrite one
      // that is already in use by another worksheet in the history.
      const target = store[oldId] ? nextImageId(store) : oldId;
      store[target] = Object.assign({}, rec, { id: target });
      idMap[oldId] = target;
    });
    if (Object.keys(idMap).length && !writeImages(store)) {
      alert('Gambar dari berkas ini tidak muat di penyimpanan browser. Hapus beberapa gambar lama dulu, lalu impor ulang.');
      return;
    }
    raw = raw.replace(IMAGE_TAG_ID_RE, (m, pre, id) => pre + (idMap[id] || id));

    currentDocId = null;   // an imported project starts its own history entry
    rawInput.value = raw;
    applyFieldSnapshot(bundle.settings);
    titleTouched = false;
    updateCodeTitle();
    renderImageList();
    renderHistoryList();
    render();
  }

  el('btnExportProject').addEventListener('click', exportProject);
  el('btnImportProject').addEventListener('click', () => el('projectFileInput').click());
  el('projectFileInput').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) importProject(e.target.files[0]);
    e.target.value = '';
  });

  // -------------------------------------------------------------------
  // Pemeriksaan Naskah — validator readout
  // -------------------------------------------------------------------
  function renderCheckResults(issues) {
    const host = el('checkList');
    const summary = el('checkSummary');
    host.innerHTML = '';
    summary.className = 'hint check-summary';

    if (!rawInput.value.trim()) {
      summary.textContent = '';
      return;
    }
    const errors = issues.filter(i => i.level === 'error').length;
    const warns = issues.length - errors;
    if (!issues.length) {
      summary.textContent = '✅ Tidak ada masalah ditemukan.';
      summary.classList.add('is-clean');
      return;
    }
    summary.textContent = (errors ? errors + ' kesalahan' : '')
      + (errors && warns ? ' · ' : '')
      + (warns ? warns + ' peringatan' : '');
    summary.classList.add(errors ? 'has-error' : 'has-warn');

    // Errors first: a broken tag prints as a red placeholder on paper,
    // which matters more than a numbering gap that only looks untidy.
    const ordered = issues.slice().sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
    ordered.slice(0, 40).forEach((issue) => {
      const row = document.createElement('div');
      row.className = 'check-entry level-' + issue.level;
      const icon = document.createElement('span');
      icon.textContent = issue.level === 'error' ? '⛔' : '⚠️';
      const text = document.createElement('span');
      text.textContent = issue.text;
      row.appendChild(icon);
      row.appendChild(text);
      host.appendChild(row);
    });
    if (ordered.length > 40) {
      const more = document.createElement('div');
      more.className = 'check-entry level-warn';
      more.textContent = 'dan ' + (ordered.length - 40) + ' temuan lain...';
      host.appendChild(more);
    }
  }

  // -------------------------------------------------------------------
  // Paket acak — seed shared by every variant in one render
  // -------------------------------------------------------------------
  // Held in memory (not persisted): reopening the app should deal a fresh
  // shuffle, but every render within a session must reproduce the same one
  // — see makeRng() for why that matters.
  let variantSeed = Math.floor(Math.random() * 1000000) + 1;

  // The browser's print/"Save as PDF" dialog suggests document.title as the
  // filename. The tab's title stays a fixed "Exact Worksheet" the rest of
  // the time (see <title> in index.html) so the tab is easy to spot among
  // others while working — this only swaps it to the worksheet's own
  // code/title for the moment print() is invoked (slashes aren't valid in
  // filenames, so swapped for dashes here), then afterprint restores it.
  let printFilenameTitle = 'Lembar Kerja';
  function updateDocumentTitle(titleText) {
    const safe = (titleText || 'Worksheet').replace(/[\\/:*?"<>|]/g, '-').trim();
    document.title = safe || 'Worksheet';
  }
  window.addEventListener('afterprint', () => { document.title = 'Exact Worksheet'; });

  function currentOpts() {
    return {
      brandName: el('brandName').value.trim(),
      worksheetSubject: el('worksheetSubject').value.trim(),
      titleOverride: el('worksheetTitle').value.trim(),
      showLogo: el('showLogo').checked,
      showName: el('showName').checked,
      showClass: el('showClass').checked,
      showDate: el('showDate').checked,
      showScore: el('showScore').checked,
      pgOptionCols: el('pgOptionCols').value,
      bodyColumns: el('bodyColumns').value,
      compactFormulas: el('compactFormulas').checked,
      showFormulaBox: el('showFormulaBox').checked,
      showAnswerKey: el('showAnswerKey').checked,
      showExplanation: el('showExplanation').checked,
      showMarks: el('showMarks').checked,
      autoAnswerSpace: el('autoAnswerSpace').checked,
      linesPerMark: el('linesPerMark').value
    };
  }

  function applyStyleVars() {
    const fs = el('fontSize').value;
    const lh = el('lineHeight').value;
    const ds = el('diagramSize').value;
    const is = el('imageSize').value;
    pageEl.style.setProperty('--ws-font-size', fs + 'pt');
    pageEl.style.setProperty('--ws-line-height', lh);
    pageEl.style.setProperty('--ws-diagram-width', ds + 'pt');
    pageEl.style.setProperty('--ws-image-width', is + 'pt');
    el('fontSizeVal').textContent = fs + 'pt';
    el('lineHeightVal').textContent = lh;
    el('diagramSizeVal').textContent = ds + 'pt';
    el('imageSizeVal').textContent = is + 'pt';
    el('linesPerMarkVal').textContent = el('linesPerMark').value;
  }

  // Paged.js needs the tiny @page rule (page size/margin) handed to it as
  // literal CSS text, not a URL — under file:// (how this app is normally
  // opened), both fetch() and reading an external <link>'s CSSOM are
  // blocked by Chrome's CORS policy for local files, so a URL/path here
  // would silently fail. Everything else (column-count, break-inside,
  // fonts, widths, ...) Paged.js reads straight off the live DOM via
  // getComputedStyle, the same way it's already applied by the normal
  // style.css <link> — so that's all this needs to carry.
  const PAGED_PAGE_CSS = '@page { size: A4; margin: 12mm 11mm; }';

  // KaTeX has to typeset the math BEFORE Paged.js paginates — pagination
  // decides where content breaks across pages based on rendered element
  // heights, and un-typeset "$x^2$" text vs. the final KaTeX glyphs are a
  // very different height. Typesetting happens in this offscreen host
  // (kept out of the viewport, not display:none — KaTeX needs real layout
  // to size itself) so Paged.js only ever sees final, already-typeset HTML.
  const measureHost = document.createElement('div');
  // A far-off-screen fixed position keeps this out of view without
  // display:none (which would give KaTeX a zero-size box to lay out
  // into). But left:-99999px still counts as real page area to Chrome's
  // print engine — printing without hiding it here produced one extra
  // blank trailing page, since the print layout tiled that huge
  // off-canvas space into physical pages too. no-print removes it from
  // layout entirely for print, which is fine: its content has already
  // been read into pageEl by the time anyone could print it.
  measureHost.className = 'no-print';
  measureHost.style.cssText = 'position:fixed; left:-99999px; top:0; visibility:hidden;';
  document.body.appendChild(measureHost);

  // Scratch target for Paged.js's own pagination pass — see the "one
  // Previewer run per sheet" note in renderNow() for why this exists
  // separately from measureHost. Same off-screen/no-print treatment.
  const pagedScratch = document.createElement('div');
  pagedScratch.className = 'no-print';
  pagedScratch.style.cssText = 'position:fixed; left:-99999px; top:0; visibility:hidden;';
  document.body.appendChild(pagedScratch);

  // Paged.js's own pagination pass takes real (if short) time, and several
  // settings fields fire render() on every keystroke — without this, two
  // overlapping .preview() calls could both be mutating pageEl at once,
  // corrupting the output. Queuing forces each render to fully finish
  // before the next one starts, so the DOM only ever reflects the latest
  // settings once pagination actually catches up.
  let renderQueue = Promise.resolve();

  function render() {
    renderQueue = renderQueue.then(renderNow).catch((err) => {
      console.error('Gagal me-render worksheet:', err);
    });
    return renderQueue;
  }

  // ---------------------------------------------------------------------
  // Custom two-column pagination — replaces Paged.js's own multicol
  // fragmentation for bodyColumns:"2" (the "2 kolom koran" layout).
  // Paged.js's chunker has repeatedly proven unreliable across a page
  // break for multi-column content: it has silently dropped questions
  // outright in the past (see the removed cols-2 Grid-vs-multicol CSS
  // history), and even the plain multicol fallback still mis-measures how
  // much of a page a diagram-heavy column actually fills, stranding both
  // columns with blank space and pushing content that would fit onto the
  // next page instead. This measures every block's real rendered height
  // at its real final width itself, then places blocks onto pages with
  // plain arithmetic — no browser fragmentation heuristic involved, so it
  // can't mis-measure or drop anything.
  const PAGE_CONTENT_WIDTH_MM = 188; // A4 210mm minus the 11mm+11mm @page margin
  const PAGE_CONTENT_HEIGHT_MM = 273; // A4 297mm minus the 12mm+12mm @page margin
  const COL_GAP_MM = 11; // matches .ws-page-cols' column-gap below

  // A block's outer (margin-inclusive) height, matching what stacking it
  // in normal block flow would actually consume.
  function outerHeightPx(el) {
    const cs = getComputedStyle(el);
    return el.getBoundingClientRect().height + parseFloat(cs.marginTop || 0) + parseFloat(cs.marginBottom || 0);
  }

  // A hidden, fixed-width probe carrying the same font-size/line-height/
  // diagram-width the live preview uses (read off pageEl, where
  // applyStyleVars() sets them), so measured heights match what actually
  // prints. probe.sheet is a real ".sheet" child so every font/spacing
  // rule scoped to ".sheet ..." applies exactly as it would in the final
  // output.
  function makeMeasureProbe(widthMm) {
    const probe = document.createElement('div');
    probe.className = 'no-print';
    probe.style.cssText = `position:fixed; left:-99999px; top:0; visibility:hidden; width:${widthMm}mm;`;
    const cs = getComputedStyle(pageEl);
    ['--ws-font-size', '--ws-line-height', '--ws-diagram-width', '--ws-image-width'].forEach((v) => {
      const val = cs.getPropertyValue(v);
      if (val) probe.style.setProperty(v, val.trim());
    });
    document.body.appendChild(probe);
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    probe.appendChild(sheet);
    return { probe, sheet };
  }

  // Height, in px, of an empty box sized to the given mm — turns the
  // fixed A4 content box into a px budget comparable to the heights
  // measured above (both come from the same browser layout pass, so
  // there's no DPI/zoom unit conversion to get wrong).
  function mmHeightPx(heightMm) {
    const probe = document.createElement('div');
    probe.style.cssText = `position:fixed; left:-99999px; top:0; visibility:hidden; width:1px; height:${heightMm}mm;`;
    document.body.appendChild(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h;
  }

  // Parses one already-typeset sheet (header/fields/formulas/sections/
  // answer key — the same HTML renderWorksheet() + substituteDiagramTokens()
  // produce, after KaTeX has run on it) into real A4 .pagedjs_page
  // elements, splitting its 2-column sections across pages/columns by
  // measured height instead of CSS fragmentation. Returns an array of DOM
  // elements ready to append to the preview container.
  function paginateSheetTwoColumn(sheetHtml) {
    const parseHost = document.createElement('div');
    parseHost.innerHTML = sheetHtml;
    const sheetRoot = parseHost.firstElementChild; // .sheet
    const bodyEl = sheetRoot.querySelector(':scope > .ws-body');
    const frontNodes = Array.from(sheetRoot.children).filter((c) => c !== bodyEl);

    const full = makeMeasureProbe(PAGE_CONTENT_WIDTH_MM);
    const colWidthMm = (PAGE_CONTENT_WIDTH_MM - COL_GAP_MM) / 2;
    const col = makeMeasureProbe(colWidthMm);
    const pageContentHeightPx = mmHeightPx(PAGE_CONTENT_HEIGHT_MM);

    // Front matter (header/fields/passage/formulas) is one atomic block
    // that always opens page 1 of this sheet.
    frontNodes.forEach((n) => full.sheet.appendChild(n.cloneNode(true)));
    const frontHeight = frontNodes.length ? outerHeightPx(full.sheet) : 0;
    const frontHtml = frontNodes.map((n) => n.outerHTML).join('');
    full.sheet.innerHTML = '';

    // A flat list of "chunks": each is either the answer-key block, or
    // one question section (head + its individually placeable items).
    const chunks = [];
    if (bodyEl) {
      Array.from(bodyEl.children).forEach((child) => {
        if (child.classList.contains('ws-section')) {
          const colsEl = child.querySelector(':scope > .ws-section-cols');
          const itemNodes = colsEl ? Array.from(colsEl.children) : [];
          const headClone = child.cloneNode(true);
          const headColsEl = headClone.querySelector(':scope > .ws-section-cols');
          if (headColsEl) headClone.removeChild(headColsEl);
          chunks.push({ headNode: headClone, items: itemNodes });
        } else if (child.classList.contains('ws-answerkey')) {
          chunks.push({ headNode: child.cloneNode(true), items: [] });
        }
      });
    }

    // Measure every chunk's head (full width) and every item (column
    // width) in as few reflows as possible: one batch fill per probe.
    chunks.forEach((c) => full.sheet.appendChild(c.headNode.cloneNode(true)));
    Array.from(full.sheet.children).forEach((node, i) => {
      chunks[i].headHeight = outerHeightPx(node);
      chunks[i].headHtml = node.outerHTML;
    });

    chunks.forEach((c) => {
      if (!c.items.length) { c.itemHeights = []; c.itemHtml = []; return; }
      col.sheet.innerHTML = '';
      c.items.forEach((it) => col.sheet.appendChild(it.cloneNode(true)));
      c.itemHeights = Array.from(col.sheet.children).map((node) => outerHeightPx(node));
      c.itemHtml = c.items.map((it) => it.outerHTML);
    });

    full.probe.remove();
    col.probe.remove();

    // Greedy placement: front matter always opens page 1; each chunk's
    // head must be followed on the same page by at least one item (or be
    // the answer key alone), else it starts a fresh page; items fill
    // column 1 top-down, then column 2, then overflow to a new page.
    const pages = [];
    let rows = [frontHtml];
    let used = frontHeight;
    const flush = () => { if (rows.length) pages.push(rows); rows = []; used = 0; };

    chunks.forEach((c) => {
      const firstItemH = c.itemHeights.length ? c.itemHeights[0] : 0;
      if (used > 0 && used + c.headHeight + firstItemH > pageContentHeightPx) flush();
      rows.push(c.headHtml);
      used += c.headHeight;

      let i = 0;
      while (i < c.itemHeights.length) {
        const avail = pageContentHeightPx - used;
        const col1 = [];
        let col1h = 0;
        while (i < c.itemHeights.length && (col1h + c.itemHeights[i] <= avail || col1.length === 0)) {
          col1.push(c.itemHtml[i]); col1h += c.itemHeights[i]; i++;
        }
        const col2 = [];
        let col2h = 0;
        while (i < c.itemHeights.length && col2h + c.itemHeights[i] <= avail) {
          col2.push(c.itemHtml[i]); col2h += c.itemHeights[i]; i++;
        }
        rows.push(`<div class="ws-page-cols"><div>${col1.join('')}</div><div>${col2.join('')}</div></div>`);
        used += Math.max(col1h, col2h);
        if (i < c.itemHeights.length) flush();
      }
    });
    flush();

    return pages.map((rowsHtml) => {
      const pageDiv = document.createElement('div');
      pageDiv.className = 'pagedjs_page';
      pageDiv.style.cssText = 'width:210mm; height:297mm; overflow:hidden;';
      pageDiv.innerHTML = `<div class="pagedjs_page_content" style="width:100%; height:100%; padding:12mm 11mm; box-sizing:border-box; overflow:hidden;"><div class="sheet">${rowsHtml.join('')}</div></div>`;
      return pageDiv;
    });
  }

  async function renderNow() {
    applyStyleVars();
    // Several complete sets pasted together (marked off by standalone
    // "SET 1" / "SET 2" lines — see splitIntoSets) render back to back as
    // separate worksheets instead of being parsed as one garbled document.
    // A normal single-worksheet paste has no such marker, so dataList is
    // just [thatOneData] and every step below behaves exactly as before.
    const dataList = splitIntoSets(rawInput.value).map(parseWorksheet);
    const isMultiSet = dataList.length > 1;
    const firstData = dataList[0];
    if (firstData && !titleTouched) {
      el('worksheetTitle').value = firstData.title || '';
    }
    const opts = currentOpts();
    const wantsAnswerSheet = opts.showAnswerKey || opts.showExplanation;
    // Suggested PDF filename should say when it includes the answer
    // key/explanation, so a saved "...-Soal+Jawaban.pdf" is never mixed up
    // with the plain student version sitting in the same folder. For
    // multiple sets, the sets' numbers join into one "1-2-3" filename
    // since they all print into the same PDF.
    const baseTitle = opts.titleOverride || (firstData && firstData.title) || 'Lembar Kerja';
    let filenameTitle = isMultiSet
      ? titleForSet(baseTitle, dataList.map((_, i) => i + 1).join('-'))
      : baseTitle;
    const variantCount = Math.max(1, Math.min(VARIANT_LETTERS.length, Number(el('variantCount').value) || 1));
    if (variantCount > 1) {
      filenameTitle += ' - Paket A-' + VARIANT_LETTERS[variantCount - 1];
    }
    printFilenameTitle = wantsAnswerSheet ? filenameTitle + ' - Soal+Jawaban' : filenameTitle;
    saveSettings();
    scheduleHistorySave();

    const studentOpts = Object.assign({}, opts, { showAnswerKey: false, showExplanation: false });

    // One entry per physical sheet (a student or teacher version of one
    // set). Paged.js's break-before handling turned out not to reliably
    // force a page break before every sheet once 3 or more were run
    // through a single .preview() call back to back (multi-set
    // worksheets) — sheets past the second would sometimes just run on
    // instead of starting a fresh page, even with an explicit
    // "break-before: page" class the browser itself confirmed was applied
    // (a Paged.js chunker limitation, not a CSS problem). Paginating each
    // sheet in its own separate Previewer run and concatenating the
    // resulting pages sidesteps that: every sheet always starts its own
    // run at "page 1", so there's no internal break to rely on at all.
    // One entry per worksheet version to lay out: every set, expanded into
    // however many shuffled paket were asked for. Paket A is deliberately
    // the untouched original — so the teacher's own naskah always prints
    // as-is somewhere in the stack, and turning the feature on never
    // silently reorders the only copy they were expecting.
    // Validation runs on the ORIGINAL parsed sets, not the shuffled paket:
    // a variant is a mechanical rearrangement of the same items, so it can
    // only ever repeat findings the source naskah already has.
    const issues = [];
    dataList.forEach((data, i) => {
      validateWorksheet(data, isMultiSet ? 'Set ' + (i + 1) : '').forEach(x => issues.push(x));
    });
    renderCheckResults(issues);

    const variantOpts = {
      shuffleItems: el('variantShuffleItems').checked,
      shuffleOptions: el('variantShuffleOptions').checked
    };
    const versions = [];
    dataList.forEach((data, i) => {
      const setTitle = isMultiSet ? titleForSet(baseTitle, i + 1) : opts.titleOverride;
      if (variantCount <= 1) {
        versions.push({ data, titleOverride: setTitle });
        return;
      }
      const variantBase = setTitle || (data && data.title) || baseTitle;
      for (let v = 0; v < variantCount; v++) {
        // Each (set, paket) pair gets its own seed derived from the shared
        // variantSeed, so set 2's Paket B isn't dealt the identical
        // permutation as set 1's — two large primes keep those streams apart.
        const seed = variantSeed + v * 7919 + i * 104729;
        versions.push({
          data: v === 0 ? data : makeVariant(data, seed, variantOpts),
          titleOverride: variantBase + ' - Paket ' + VARIANT_LETTERS[v]
        });
      }
    });

    const sheetHtmlList = [];
    versions.forEach(({ data, titleOverride }) => {
      const setStudentOpts = Object.assign({}, studentOpts, { titleOverride });
      let studentHtml = `<div class="sheet">${renderWorksheet(data, setStudentOpts)}</div>`;
      if (data && data.diagramTags && data.diagramTags.length) {
        // Figure numbering ("Gambar 1", "Gambar 2", ...) restarts on every
        // printed sheet, so Paket B's figures aren't numbered as if they
        // continued from Paket A's, and the teacher's copy of a sheet
        // carries the same figure numbers as the student's.
        resetFigureCounter();
        studentHtml = substituteDiagramTokens(studentHtml, data.diagramTags);
      }
      sheetHtmlList.push(studentHtml);
      if (wantsAnswerSheet) {
        const setTeacherOpts = Object.assign({}, opts, { titleOverride });
        let teacherHtml = `<div class="sheet">${renderWorksheet(data, setTeacherOpts)}</div>`;
        if (data && data.diagramTags && data.diagramTags.length) {
          resetFigureCounter();
          teacherHtml = substituteDiagramTokens(teacherHtml, data.diagramTags);
        }
        sheetHtmlList.push(teacherHtml);
      }
    });

    pageEl.innerHTML = '';
    const pagesContainer = document.createElement('div');
    pagesContainer.className = 'pagedjs_pages' + (el('spreadView').checked ? ' spread-view' : '');
    pageEl.appendChild(pagesContainer);

    for (const sheetHtml of sheetHtmlList) {
      measureHost.innerHTML = sheetHtml;
      if (window.renderMathInElement) {
        renderMathInElement(measureHost, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      }
      if (opts.bodyColumns === '2') {
        // Two-column layout: our own measured pagination (see
        // paginateSheetTwoColumn above), not Paged.js's multicol
        // fragmentation — see that function's comment for why.
        paginateSheetTwoColumn(measureHost.innerHTML).forEach((p) => pagesContainer.appendChild(p));
      } else {
        pagedScratch.innerHTML = '';
        await new PagedModule.Previewer().preview(measureHost.innerHTML, [{ 'page.css': PAGED_PAGE_CSS }], pagedScratch);
        // Move (not clone) each finished page out of the scratch run and
        // into the real, shared pages container, in order.
        pagedScratch.querySelectorAll('.pagedjs_page').forEach((p) => pagesContainer.appendChild(p));
      }
    }

    updateFillStat(pagesContainer);
  }

  // "Coba kepadatan" / efficiency readout: lets the user compare layout
  // settings (density presets, or their own slider tweaks) by actual
  // result — page count and how full those pages really ended up —
  // instead of guessing from the preview alone. Measures each finished,
  // on-screen .pagedjs_page (not the off-screen measureHost) since this
  // runs after Paged.js has placed everything at real, final positions.
  function updateFillStat(pagesContainer) {
    const pages = Array.from(pagesContainer.querySelectorAll('.pagedjs_page'));
    const statEl = el('fillStat');
    if (!pages.length) { statEl.textContent = ''; return; }
    let totalRatio = 0;
    pages.forEach((p) => {
      const content = p.querySelector('.pagedjs_page_content');
      // .sheet is the actual worksheet content Paged.js sliced onto this
      // page — its own immediate parent (an unnamed div Paged.js inserts
      // per page) is deliberately stretched to the full page height for
      // its internal bookkeeping, so measuring anything above .sheet here
      // would read every page as 100% full regardless of real content.
      const sheet = content && content.querySelector('.sheet');
      if (!content || !sheet) return;
      const contentRect = content.getBoundingClientRect();
      const used = Math.max(0, sheet.getBoundingClientRect().bottom - contentRect.top);
      totalRatio += Math.min(1, contentRect.height ? used / contentRect.height : 0);
    });
    const avgFill = Math.round((totalRatio / pages.length) * 100);
    statEl.textContent = pages.length + ' halaman • rata-rata terisi ' + avgFill + '%';
  }

  // Briefly swaps a button's label to confirm an action that has no other
  // visible result (clipboard read/write doesn't touch the page), then
  // restores it — the standard "Copied!" pattern.
  function flashButton(btn, tempText, ms) {
    const original = btn.textContent;
    btn.textContent = tempText;
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
    }, ms || 1600);
  }

  // navigator.clipboard only exists in a "secure context" (https://, or
  // http://localhost). This app is normally opened via file:// on the
  // teacher's own computer and via plain http://<lan-ip>:port on a phone
  // connecting to "Start Server.command" — NEITHER is secure, so on most
  // Android/iPhone browsers `navigator.clipboard` is simply undefined and
  // calling `.writeText()` on it throws synchronously (before any
  // `.catch()` can run), making the button look like it silently does
  // nothing. document.execCommand('copy') isn't gated behind a secure
  // context and still works from a direct click handler in every browser
  // that matters here, so it's tried first as the reliable path, with the
  // modern API only as a secondary attempt (some in-app WebViews disable
  // execCommand too, e.g. certain versions of Instagram/WhatsApp's
  // built-in browser).
  function copyText(text) {
    const legacyCopy = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      const prevFocus = document.activeElement;
      ta.select();
      ta.setSelectionRange(0, text.length);
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      return ok;
    };

    if (legacyCopy()) return Promise.resolve();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error('no clipboard method available'));
  }

  // "Buat Prompt AI" modal: lets the subject/topic/counts be picked per
  // worksheet instead of always copying one long, generic prompt covering
  // every section type and all 16 diagram kinds — Gemini would sometimes
  // truncate or drift off-format on that full-length version.
  //
  // Two panes: fill the form, then "Buat Prompt" swaps to a result pane
  // showing the generated text in a plain, already-selected <textarea>.
  // Auto-copy is still attempted (best-effort, silent) so the common case
  // stays one click, but the text sitting right there means a blocked/
  // permission-prompted clipboard call is never a dead end — the user can
  // just select and Ctrl/Cmd+C it themselves instead of hitting a
  // "This file wants to see text copied to the clipboard" prompt with no
  // visible fallback.
  const aiModalOverlay = el('aiPromptModalOverlay');
  const aiSubjectSelect = el('aiSubject');
  const aiSubjectCustomWrap = el('aiSubjectCustomWrap');
  const aiFormPane = el('aiFormPane');
  const aiResultPane = el('aiResultPane');
  const aiResultText = el('aiResultText');
  const GEMINI_URL = 'https://gemini.google.com/app';

  function openAiModal() {
    aiModalOverlay.hidden = false;
    showAiFormView();
  }
  function closeAiModal() {
    aiModalOverlay.hidden = true;
  }
  function showAiFormView() {
    aiFormPane.hidden = false;
    aiResultPane.hidden = true;
    el('btnCancelAiPrompt').hidden = false;
    el('btnConfirmAiPrompt').hidden = false;
    el('btnBackAiPrompt').hidden = true;
    el('btnCopyAiResult').hidden = true;
    el('btnOpenGemini').hidden = true;
  }
  function showAiResultView() {
    aiFormPane.hidden = true;
    aiResultPane.hidden = false;
    el('btnCancelAiPrompt').hidden = true;
    el('btnConfirmAiPrompt').hidden = true;
    el('btnBackAiPrompt').hidden = false;
    el('btnCopyAiResult').hidden = false;
    el('btnOpenGemini').hidden = false;
  }

  // "Copy Prompt Cepat" — same buildAIPrompt() as the modal above, but with
  // fixed sensible defaults (buildDefaultAIPrompt, from prompt-builder.js)
  // instead of a form: pick a subject, click, done. No modal, no fields.
  el('btnQuickCopyPrompt').addEventListener('click', () => {
    const btn = el('btnQuickCopyPrompt');
    const prompt = buildDefaultAIPrompt(el('quickPromptSubject').value);
    copyText(prompt).then(() => {
      flashButton(btn, '✅ Tersalin!');
    }).catch(() => {
      window.prompt('Salin prompt ini secara manual (Ctrl/Cmd+C):', prompt);
    });
  });

  el('btnCopyPrompt').addEventListener('click', openAiModal);
  el('btnCloseAiModal').addEventListener('click', closeAiModal);
  el('btnCancelAiPrompt').addEventListener('click', closeAiModal);
  el('btnBackAiPrompt').addEventListener('click', showAiFormView);
  aiModalOverlay.addEventListener('click', (e) => {
    if (e.target === aiModalOverlay) closeAiModal();
  });

  aiSubjectSelect.addEventListener('change', () => {
    aiSubjectCustomWrap.hidden = aiSubjectSelect.value !== 'lainnya';
  });

  el('btnConfirmAiPrompt').addEventListener('click', () => {
    const counts = {
      PG: parseInt(el('aiCountPG').value, 10) || 0,
      B: parseInt(el('aiCountB').value, 10) || 0,
      I: parseInt(el('aiCountI').value, 10) || 0,
      E: parseInt(el('aiCountE').value, 10) || 0
    };
    if (counts.PG + counts.B + counts.I + counts.E <= 0) {
      alert('Isi jumlah soal untuk setidaknya satu jenis (PG/Benar-Salah/Isian/Esai).');
      return;
    }
    const prompt = buildAIPrompt({
      subject: aiSubjectSelect.value,
      subjectCustom: el('aiSubjectCustom').value.trim(),
      topic: el('aiTopic').value.trim(),
      grade: el('aiGrade').value.trim(),
      language: el('aiLanguage').value,
      counts,
      setCount: parseInt(el('aiSetCount').value, 10) || 1,
      difficulty: el('aiDifficulty').value,
      includeHots: el('aiIncludeHots').checked,
      includeDiagrams: el('aiIncludeDiagrams').checked,
      includeExplanation: el('aiIncludeExplanation').checked,
      includeMarks: el('aiIncludeMarks').checked
    });

    aiResultText.value = prompt;
    showAiResultView();
    aiResultText.focus();
    aiResultText.select();

    // Gemini isn't opened here — the result pane still has other things
    // the user might want first (double-check the topic/count fields by
    // going "← Kembali", copy the text, etc.), so opening a new tab out
    // from under them the moment "Buat Prompt" is clicked would jump
    // ahead of that. "🌐 Buka Gemini" below is its own explicit step.

    // Best-effort, silent: no window.prompt()/alert() on failure — the
    // textarea above is already the fallback, so a blocked/prompted
    // clipboard call here just means the "Salin" button (or manual
    // Ctrl/Cmd+C) is what the user ends up using instead.
    copyText(prompt).catch(() => {});
  });

  el('btnCopyAiResult').addEventListener('click', () => {
    const btn = el('btnCopyAiResult');
    aiResultText.focus();
    aiResultText.select();
    copyText(aiResultText.value).then(() => {
      flashButton(btn, '✅ Tersalin!');
    }).catch(() => {
      // Text is already selected in the visible textarea — nothing more
      // to do than let the user finish with their own Ctrl/Cmd+C.
    });
  });

  el('btnOpenGemini').addEventListener('click', () => {
    window.open(GEMINI_URL, '_blank');
  });

  el('btnPasteClipboard').addEventListener('click', () => {
    const btn = el('btnPasteClipboard');
    // Unlike copy, there is no legacy/insecure-context fallback for
    // *reading* the clipboard from script — browsers intentionally block
    // that everywhere except the permission-gated Clipboard API in a
    // secure context. Feature-detect up front instead of letting a
    // missing `navigator.clipboard` throw silently, so unsupported
    // browsers (most phones reaching this over file:// or plain http://)
    // get a clear, actionable instruction on the one path that always
    // works: the device's own native paste.
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      rawInput.focus();
      alert('Browser ini tidak mengizinkan tempel otomatis (biasanya karena diakses lewat file:// atau http:// biasa, bukan https://). Tekan-tahan di kotak naskah soal lalu pilih "Tempel" — cara ini selalu berfungsi di HP maupun komputer.');
      return;
    }
    navigator.clipboard.readText().then((text) => {
      if (!text) return;
      rawInput.value = text;
      titleTouched = false;
      render();
      flashButton(btn, '✅ Ditempel!');
    }).catch(() => {
      rawInput.focus();
      alert('Izin akses clipboard ditolak/dibatalkan. Tekan-tahan di kotak naskah soal lalu pilih "Tempel" — cara ini selalu berfungsi di HP maupun komputer.');
    });
  });

  el('btnClearInput').addEventListener('click', () => {
    if (!rawInput.value.trim()) return;
    if (!confirm('Kosongkan naskah soal? Naskah yang sekarang tetap tersimpan di Riwayat Lembar Kerja.')) return;
    // Flush whatever is in the editor into its history entry before wiping
    // it, then detach — so this really is "start a new document", not
    // "overwrite the one I just cleared with an empty naskah".
    clearTimeout(historySaveTimer);
    saveCurrentToHistory(false);
    currentDocId = null;
    rawInput.value = '';
    titleTouched = false;
    updateCodeTitle();
    renderHistoryList();
    render();
    rawInput.focus();
  });

  // A new seed means a genuinely different deal of every paket past A;
  // render() then repaints the preview from it.
  el('btnReshuffle').addEventListener('click', () => {
    variantSeed = Math.floor(Math.random() * 1000000) + 1;
    if ((Number(el('variantCount').value) || 1) <= 1) {
      alert('Pilih dulu jumlah paket (2 atau lebih) supaya pengacakan terlihat.');
      return;
    }
    flashButton(el('btnReshuffle'), '🎲 Diacak!');
    render();
  });

  el('btnRender').addEventListener('click', render);
  el('btnPrint').addEventListener('click', async () => {
    // Pagination is async — wait for whatever render() is still in flight
    // so a setting changed right before clicking "Cetak" is reflected in
    // the printed output instead of printing a stale, mid-update page.
    await renderQueue;
    updateDocumentTitle(printFilenameTitle);
    window.print();
  });

  ['brandName', 'worksheetSubject', 'worksheetTitle', 'showLogo', 'showName', 'showClass', 'showDate',
   'showScore', 'pgOptionCols', 'bodyColumns', 'compactFormulas', 'showFormulaBox',
   'showAnswerKey', 'showExplanation', 'fontSize', 'lineHeight', 'diagramSize', 'imageSize', 'spreadView',
   'variantCount', 'variantShuffleItems', 'variantShuffleOptions',
   'showMarks', 'autoAnswerSpace', 'linesPerMark'
  ].forEach(id => {
    el(id).addEventListener('input', render);
    el(id).addEventListener('change', render);
  });

  CODE_FIELD_IDS.forEach(id => {
    el(id).addEventListener('input', () => { updateCodeTitle(); render(); });
  });

  // "Coba kepadatan" presets — each just drives the same three sliders a
  // user could drag by hand, bundled into one click so trying "how much
  // tighter can this get" doesn't mean hunting for a good combination of
  // font size / line height / diagram size manually. fillStat (see
  // updateFillStat) reports back the actual page count and fill % for
  // whichever preset ends up used, so the comparison is by real result,
  // not guesswork.
  const DENSITY_PRESETS = {
    lega: { fontSize: 11, lineHeight: 1.45, diagramSize: 280 },
    normal: { fontSize: 10.5, lineHeight: 1.3, diagramSize: 260 },
    padat: { fontSize: 9.5, lineHeight: 1.15, diagramSize: 200 }
  };
  function applyDensityPreset(name) {
    const preset = DENSITY_PRESETS[name];
    el('fontSize').value = preset.fontSize;
    el('lineHeight').value = preset.lineHeight;
    el('diagramSize').value = preset.diagramSize;
    render();
  }
  el('densityLega').addEventListener('click', () => applyDensityPreset('lega'));
  el('densityNormal').addEventListener('click', () => applyDensityPreset('normal'));
  el('densityPadat').addEventListener('click', () => applyDensityPreset('padat'));

  // Preview-only zoom (doesn't touch the printed/exported output — Paged.js
  // already lays out real, fixed A4-sized page boxes regardless of this;
  // "zoom", unlike transform:scale, also resizes the box itself so the
  // surrounding scroll area adjusts instead of leaving dead space or
  // clipping). Applied to #page directly, which — unlike its innerHTML —
  // survives every render() call, so it doesn't need reapplying per render.
  // 60% starting zoom fits a whole A4 page in view on a typical laptop
  // screen without scrolling — 100% (actual print size) ran taller than
  // most viewports, so the very first thing anyone saw was a cropped page.
  const ZOOM_DEFAULT = 0.6;
  let previewZoom = ZOOM_DEFAULT;
  const ZOOM_MIN = 0.4, ZOOM_MAX = 2, ZOOM_STEP = 0.1;
  function applyZoom() {
    pageEl.style.zoom = previewZoom;
    el('zoomVal').textContent = Math.round(previewZoom * 100) + '%';
  }
  el('btnZoomIn').addEventListener('click', () => {
    previewZoom = Math.min(ZOOM_MAX, +(previewZoom + ZOOM_STEP).toFixed(2));
    applyZoom();
  });
  el('btnZoomOut').addEventListener('click', () => {
    previewZoom = Math.max(ZOOM_MIN, +(previewZoom - ZOOM_STEP).toFixed(2));
    applyZoom();
  });
  el('btnZoomReset').addEventListener('click', () => {
    previewZoom = ZOOM_DEFAULT;
    applyZoom();
  });
  applyZoom();

  // Initial state: restore last-used settings, stamp today's date into
  // TglBulan, and fold both into the title code — the naskah soal itself
  // starts empty (a fresh document every time).
  loadSettings();
  autofillTanggal();
  updateCodeTitle();
  renderHistoryList();
  renderImageList();
  render();
});

// Export for Node-based testing (no-op in browser).
if (typeof module !== 'undefined') {
  module.exports = { parseWorksheet, renderWorksheet, splitIntoSets, makeVariant, VARIANT_LETTERS, validateWorksheet, extractMarks, parseSubParts };
}
