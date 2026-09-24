/* Pengurai naskah berformat Exact Worksheet Maker — port TypeScript dari
 * naskah.py (urai()) milik Exact Worksheet.
 *
 * Kenapa diport, bukan memanggil Worksheet lewat HTTP seperti jembatan lain di
 * worksheet.ts: justru inti alur "tempel dari AI" adalah tidak bergantung pada
 * mesin Gemini/Chrome di Worksheet — guru menempel naskah dari ChatGPT/Gemini/
 * Claude mana pun, dan itu harus tetap jalan saat Worksheet mati. Selain itu
 * berkas ini murni teks (tanpa modul node), jadi pengurai yang sama dipakai di
 * peramban untuk pratinjau langsung DAN di server saat menyimpan — pratinjau
 * tidak mungkin beda dengan hasil akhirnya.
 *
 * Format yang dipahami sama persis dengan yang dikeluarkan Worksheet Maker:
 *
 *   Bagian Pilihan Ganda: (PG)
 *   PG1. Teks soal [2]
 *   A. opsi pertama
 *   B. opsi kedua
 *
 *   Kunci Jawaban
 *   PG1-B, I1-18
 *
 *   Pembahasan
 *   PG1-langkahnya, I1-langkahnya
 *
 * Beberapa set dipisah baris "SET 2" dan diurai sendiri-sendiri, supaya kunci
 * set 2 (kodenya berulang dari PG1 lagi) tidak menimpa kunci set 1.
 */
import type { Bacaan, Butir } from "./worksheet";

const BAGIAN = /^\s*Bagian\s+([^:]{2,60}):\s*\((PG|B|I|E|M|IB)\)\s*$/i;
const BUTIR = /^\s*(PG|B|I|E|M|IB)(\d{1,3})\.\s*(.*)$/;
const OPSI = /^\s*\(?([A-Ea-e])\s*[.)]\s*(.+)$/;
const SUB = /^\s*\((?:([a-h])|(i{1,3}|iv|v|vi{1,3}))\)\s*(.*)$/;
const BOBOT = /\s*\[(\d{1,2})\]\s*$/;
const KEPALA_KUNCI = /^\s*Kunci\s*Jawaban\s*:?\s*$/i;
/* Teks bacaan (lembar Bahasa Indonesia / Inggris): baris "Bacaan" sendirian
 * di bawah judul naskah, lalu judul teks (opsional), lalu paragraf-paragrafnya
 * sampai bagian soal pertama. Ejaan yang diterima sama dengan naskah.py dan
 * wsm/app.js milik Exact Worksheet. */
const KEPALA_BACAAN = /^\s*(?:Reading\s*Passage|Reading\s*Text|Passage|Bacaan|Teks\s*Bacaan|Wacana)\s*(?:\d{1,2})?\s*:?\s*$/i;
/* Batas akhir bacaan: kepala bagian apa pun (termasuk "Bagian A: (PG)" yang
 * namanya satu huruf — BAGIAN di atas minta 2 huruf) atau butir soal pertama. */
const BATAS_BACAAN = /^\s*(?:Bagian|Section)\s+[^\n]{1,80}?:\s*(?:\([A-Za-z]{1,4}\))?\s*$/i;
const KEPALA_BAHAS = /^\s*Pembahasan\s*:?\s*$/i;
const TANDA_SET = /^\s*SET\s+(\d+)\s*$/i;
/* "PG1-B, I1-18, E1a-5x+2" — kode, tanda hubung, lalu jawaban sampai koma yang
 * diikuti kode berikutnya. Jawaban sendiri boleh memuat koma (mis. "1, 2, 3"),
 * jadi batasnya dicari lewat lookahead, bukan dengan memecah di tiap koma. */
const PASANG = /\b((?:PG|B|I|E|M|IB)\d{1,3}[a-h]?(?:\.(?:i{1,3}|iv|v|vi{1,3}))?)\s*-\s*([^,]+?)(?=\s*,\s*(?:PG|B|I|E|M|IB)\d|\s*$)/gs;

export interface MetaNaskah {
  judul: string;
  /** teks bacaan set pertama, kalau naskahnya lembar pemahaman bacaan */
  bacaan?: Bacaan | null;
  /** banyaknya entri di blok Kunci Jawaban (semua set digabung) */
  nKunci: number;
  nSet: number;
}

/* Penanda kode di awal baris, untuk blok yang ditulis satu entri per baris. */
const AWAL_BARIS = /^\s*((?:PG|B|I|E|M|IB)\d{1,3}[a-h]?(?:\.(?:i{1,3}|iv|v|vi{1,3}))?)\s*-\s*(.*)$/;
const HITUNG_KODE = /\b(?:PG|B|I|E|M|IB)\d{1,3}[a-h]?(?:\.(?:i{1,3}|iv|v|vi{1,3}))?\s*-/g;

const bersih = (t: string) => (t || "").trim().replace(/\s{2,}/g, " ");

function pasanganKoma(teks: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of teks.matchAll(PASANG)) out[m[1].toUpperCase()] = bersih(m[2]);
  return out;
}

function pasanganBaris(baris: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  let kode: string | null = null;
  for (const b of baris) {
    const m = AWAL_BARIS.exec(b);
    if (m) { kode = m[1].toUpperCase(); out[kode] = bersih(m[2]); }
    else if (kode && b.trim()) out[kode] += " " + b.trim();
  }
  return out;
}

/* Blok kunci/pembahasan datang dalam dua bentuk, dan keduanya harus terbaca:
 *
 *   a) satu baris berisi daftar dipisah koma — "PG1-B, PG2-C" (bentuk yang
 *      dikeluarkan Exact Worksheet Maker sendiri lewat ke_naskah());
 *   b) satu entri per baris — bentuk yang diminta prompt kita untuk blok
 *      Pembahasan, karena kalimat penjelasan hampir selalu memuat koma, dan
 *      di bentuk (a) koma itu memotong penjelasannya di tengah jalan.
 *
 * Pembedanya: di bentuk (b) tiap baris hanya memuat SATU kode. Begitu ada satu
 * baris dengan dua kode atau lebih, baris itu pasti daftar berkoma, jadi
 * seluruh blok dibaca sebagai bentuk (a) — kalau tidak, "PG1-B, PG2-C" akan
 * terbaca sebagai satu entri PG1 bernilai "B, PG2-C". */
function pasanganLuwes(baris: string[]): Record<string, string> {
  const satuKodePerBaris = baris
    .filter((b) => b.trim())
    .every((b) => (b.match(HITUNG_KODE) ?? []).length <= 1);
  return satuKodePerBaris ? pasanganBaris(baris) : pasanganKoma(baris.join("\n"));
}

/* Pisahkan blok teks bacaan dari baris-baris soal. Judul teks = paragraf
 * pertama kalau pendek, satu baris, dan masih ada paragraf lain sesudahnya —
 * aturan yang sama dengan naskah.py / wsm/app.js supaya PDF dan Practice
 * membaca judul yang sama. */
function ambilBacaan(isi: string[]): { sisa: string[]; bacaan: Bacaan | null } {
  const awal = isi.findIndex((b) => KEPALA_BACAAN.test(b));
  if (awal < 0) return { sisa: isi, bacaan: null };
  let batas = isi.findIndex((b) => BATAS_BACAAN.test(b) || BUTIR.test(b));
  if (batas < 0) batas = isi.length;
  if (awal >= batas) return { sisa: isi, bacaan: null };
  const blok = isi.slice(awal + 1, batas).join("\n").trim();
  const para = blok.split(/\n[ \t]*\n/).map((p) => p.trim()).filter(Boolean);
  let judul = "";
  if (para.length > 1 && para[0].length <= 120 && !/\n/.test(para[0])) judul = para.shift()!;
  const sisa = [...isi.slice(0, awal), ...isi.slice(batas)];
  return { sisa, bacaan: para.length ? { judul, isi: para.join("\n\n") } : null };
}

/** Urai SATU set: soalnya, lalu blok Kunci Jawaban dan Pembahasan miliknya. */
function uraiSet(baris: string[], setIni: number): { soal: Butir[]; judul: string; nKunci: number; bacaan: Bacaan | null } {
  const isiMentah: string[] = [], barisKunci: string[] = [], barisBahas: string[] = [];
  let mode: "soal" | "kunci" | "bahas" = "soal";
  for (const b of baris) {
    if (KEPALA_KUNCI.test(b)) { mode = "kunci"; continue; }
    if (KEPALA_BAHAS.test(b)) { mode = "bahas"; continue; }
    (mode === "soal" ? isiMentah : mode === "kunci" ? barisKunci : barisBahas).push(b);
  }
  const { sisa: isi, bacaan } = ambilBacaan(isiMentah);
  /* Judul dibaca SESUDAH bacaan dipisah — kalau tidak, naskah tanpa judul
   * yang langsung "Bacaan" berjudul "Bacaan". */
  const judulMentah = isi.slice(0, 4).map((b) => b.trim()).find(Boolean) ?? "";
  const judul = BATAS_BACAAN.test(judulMentah) || BUTIR.test(judulMentah) ? "" : judulMentah;

  const kunci = pasanganLuwes(barisKunci);
  const bahas = pasanganLuwes(barisBahas);

  const soal: Butir[] = [];
  let kini: Butir | null = null;
  let huruf: string | null = null;

  /* Batang di bawah 5 karakter hampir pasti sisa salah-urai (mis. baris "PG3."
   * yang teksnya kebawa ke baris berikutnya), bukan soal sungguhan. */
  const tutup = () => {
    if (kini) {
      kini.batang = bersih(kini.batang);
      if (kini.batang.length >= 5) soal.push(kini);
    }
    kini = null;
  };

  for (const b of isi) {
    if (BAGIAN.test(b)) { tutup(); continue; }

    const mButir = BUTIR.exec(b);
    if (mButir) {
      tutup();
      let sisa = mButir[3];
      let bobot: number | null = null;
      const mb = BOBOT.exec(sisa);
      if (mb) { bobot = Number(mb[1]); sisa = sisa.slice(0, mb.index); }
      kini = {
        kode: `${mButir[1].toUpperCase()}${mButir[2]}`, jenis: mButir[1].toUpperCase(),
        no: Number(mButir[2]), batang: sisa, opsi: {}, bobot, sub: [], set: setIni,
      };
      huruf = null;
      continue;
    }
    if (!kini) continue;

    const mSub = SUB.exec(b);
    if (mSub) {
      let sisa = mSub[3];
      let bobot: number | null = null;
      const mb = BOBOT.exec(sisa);
      if (mb) { bobot = Number(mb[1]); sisa = sisa.slice(0, mb.index); }
      if (mSub[1]) {
        huruf = mSub[1];
        kini.sub!.push({ label: huruf, teks: bersih(sisa), bobot });
      } else {
        kini.sub!.push({ label: `${huruf ?? "a"}.${mSub[2]}`, teks: bersih(sisa), bobot });
      }
      continue;
    }

    const mOpsi = OPSI.exec(b);
    if (mOpsi && (kini.jenis === "PG" || kini.jenis === "IB")) {
      kini.opsi[mOpsi[1].toUpperCase()] = bersih(mOpsi[2]);
      continue;
    }

    /* Baris lanjutan: disambung ke bagian terakhir yang sedang dibaca, supaya
     * soal/opsi yang terbungkus beberapa baris tidak terpotong. */
    if (kini.sub!.length) kini.sub![kini.sub!.length - 1].teks += " " + b.trim();
    else if (Object.keys(kini.opsi).length) {
      const akhir = Object.keys(kini.opsi).sort().pop()!;
      kini.opsi[akhir] += " " + b.trim();
    } else kini.batang += " " + b.trim();
  }
  tutup();

  for (const s of soal) {
    s.kunci = kunci[s.kode] ?? "";
    s.pembahasan = bahas[s.kode] ?? "";
    /* Bacaan menempel di tiap soal: soal disimpan satu per satu sebagai
     * Question, dan tiap Question membawa stimulusnya sendiri. */
    s.bacaan = bacaan;
  }
  return { soal, judul, nKunci: Object.keys(kunci).length, bacaan };
}

/** Urai naskah lengkap (boleh berisi beberapa SET) jadi butir soal + meta. */
export function uraiNaskah(teks: string): { butir: Butir[]; meta: MetaNaskah } {
  const baris = (teks || "").replace(/\r/g, "").split("\n");

  const potongan: { set: number; baris: string[] }[] = [];
  let kiniSet = 1, kiniBaris: string[] = [];
  for (const b of baris) {
    const m = TANDA_SET.exec(b);
    if (m) { potongan.push({ set: kiniSet, baris: kiniBaris }); kiniSet = Number(m[1]); kiniBaris = []; }
    else kiniBaris.push(b);
  }
  potongan.push({ set: kiniSet, baris: kiniBaris });

  const terpakai = potongan.filter((p) => p.baris.some((x) => x.trim()));
  const dipakai = terpakai.length ? terpakai : [{ set: 1, baris }];

  const butir: Butir[] = [];
  let judul = "", nKunci = 0;
  let bacaan: Bacaan | null = null;
  for (const p of dipakai) {
    const h = uraiSet(p.baris, p.set);
    butir.push(...h.soal);
    nKunci += h.nKunci;
    judul = judul || h.judul;
    bacaan = bacaan ?? h.bacaan;
  }
  return { butir, meta: { judul, bacaan, nKunci, nSet: Math.max(1, ...butir.map((b) => b.set ?? 1)) } };
}
