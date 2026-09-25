/* Jembatan ke Exact Worksheet — mesin pembuat soal (Gemini lewat Chrome
 * kendali), pencetak PDF, dan pemotret HTML. Semuanya lewat HTTP ke Mac yang
 * sama; Practice tidak menulis ulang otomasi browsernya. */
import type { Question } from "@/lib/types";

const BASE = process.env.EXACT_WORKSHEET_URL || "http://127.0.0.1:7790";

/** Teks bacaan yang menyertai soal (lembar Bahasa Indonesia / Inggris):
 *  blok "Bacaan" di bawah judul naskah, dibawa naskah.urai() di tiap butir. */
export interface Bacaan { judul?: string; isi: string }

/** Satu butir soal sebagaimana dikeluarkan naskah.urai() di Exact Worksheet. */
export interface Butir {
  kode: string;            // "PG1", "B2", "I1", "E1"
  jenis: string;           // "PG" | "B" | "I" | "E" | "M" | "IB"
  no: number;
  batang: string;
  opsi: Record<string, string>;
  bobot?: number | null;
  sub?: { label: string; teks: string; bobot?: number | null }[];
  set?: number;
  kunci?: string | null;
  pembahasan?: string | null;
  bacaan?: Bacaan | null;
}

export interface ParamBuat {
  topik: string;
  mapel: string;
  kelas: string;
  jumlah: number;
  instruksi?: string;
  mesin?: "gemini" | "claude";
}

export async function mulaiBuat(p: ParamBuat): Promise<{ jid: string }> {
  const fd = new FormData();
  fd.set("topik", p.topik);
  fd.set("mapel", p.mapel);
  fd.set("jenjang", `Kelas ${p.kelas}`);
  fd.set("kelas", p.kelas);
  fd.set("jumlah", String(p.jumlah));
  fd.set("instruksi", p.instruksi ?? "");
  fd.set("mesin", p.mesin ?? "gemini");
  fd.set("kolom", "1");
  fd.set("kunci", "on");
  fd.set("pembahasan", "on");
  fd.set("bahasa", "ikut");
  const r = await fetch(`${BASE}/buat`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`Exact Worksheet menolak: HTTP ${r.status}`);
  const j = (await r.json()) as { jid?: string; galat?: string };
  if (!j.jid) throw new Error(j.galat || "Exact Worksheet tidak memulai pekerjaan");
  return { jid: j.jid };
}

export interface StatusBuat {
  langkah: string[];
  maju: number;
  selesai: boolean;
  galat?: string;
  pdf?: string;
  antre?: { nomor: number; panjang: number; kerja?: { nama: string; detik: number } | null };
}

export async function statusBuat(jid: string): Promise<StatusBuat> {
  const r = await fetch(`${BASE}/status?jid=${encodeURIComponent(jid)}`, { cache: "no-store" });
  return (await r.json()) as StatusBuat;
}

export async function soalDari(jid: string): Promise<{ butir: Butir[]; pdf: string | null; judul: string | null; galat?: string | null }> {
  const r = await fetch(`${BASE}/api/soal?jid=${encodeURIComponent(jid)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`soal tidak bisa diambil: HTTP ${r.status}`);
  return (await r.json()) as { butir: Butir[]; pdf: string | null; judul: string | null; galat?: string | null };
}

export async function hentikanBuat(jid: string) {
  await fetch(`${BASE}/batal?jid=${encodeURIComponent(jid)}`).catch(() => undefined);
}

/** Cetak daftar soal jadi PDF lewat Exact Worksheet Maker. */
export async function renderPdf(input: {
  butir: Butir[]; judul: string; kop: { mapel?: string; kelas?: string; sekolah?: string; lembaga?: string };
  kunci?: boolean; pembahasan?: boolean; kolom?: "1" | "2";
}): Promise<{ pdf: string; unduh: string }> {
  const r = await fetch(`${BASE}/api/render`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  const j = (await r.json()) as { pdf?: string; unduh?: string; galat?: string };
  if (!r.ok || !j.pdf) throw new Error(j.galat || `cetak gagal: HTTP ${r.status}`);
  return { pdf: j.pdf, unduh: j.unduh! };
}

/** Ambil berkas PDF dari Desktop Mac lewat Exact Worksheet (untuk diteruskan ke browser). */
export async function ambilPdf(nama: string): Promise<Response> {
  return fetch(`${BASE}/berkas?f=${encodeURIComponent(nama)}`, { cache: "no-store" });
}

/* ------------------------------------------------------------------ */
/* Konversi butir naskah <-> Question milik mesin ujian                 */
/* ------------------------------------------------------------------ */

const slug = (s: string) =>
  (s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function normalBS(k: string | null | undefined): string | null {
  const v = (k || "").trim().toLowerCase();
  if (!v) return null;
  if (v.startsWith("b") || v === "true" || v === "t") return "B";
  if (v.startsWith("s") || v === "false" || v === "f") return "S";
  return null;
}

/* Kunci isian dari Gemini ditulis LaTeX ($\frac{13}{24}$), sedangkan murid
 * mengetik "13/24". Kunci dipoloskan, dan semua bentuk yang masuk akal
 * diterima — kalau tidak, isian yang benar dinilai salah. */
export function polosKunci(k: string): string {
  return k
    .replace(/\$/g, "")
    .replace(/\\(d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$2/$3")
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, "√$1")
    .replace(/\\(times|cdot)/g, "×")
    .replace(/\\(,|;|!|\s)/g, " ")
    .replace(/\^\{([^{}]*)\}/g, "^$1")
    .replace(/\\(text|mathrm)\s*\{([^{}]*)\}/g, "$2")
    .replace(/\\?%/g, "%")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function ragamKunci(k: string): string[] {
  const polos = polosKunci(k);
  const set = new Set<string>([k, polos, polos.replace(/\s/g, "")]);
  set.add(polos.replace(/×/g, "x")); set.add(polos.replace(/√/g, "sqrt"));
  set.add(polos.replace(/,/g, ".")); set.add(polos.replace(/\./g, ","));
  set.add(polos.replace(/\s*\/\s*/g, "/"));
  return [...set].filter(Boolean);
}

/** Ubah satu butir jadi Question. null = tidak bisa dinilai otomatis (esai/majemuk), dilewati. */
export function butirKeQuestion(
  b: Butir,
  ctx: { paketId: string; mapel: string; kelas: string; topik: string },
): Question | null {
  const id = `prc-${ctx.paketId}-${b.kode.toLowerCase()}${(b.set ?? 1) > 1 ? `-s${b.set}` : ""}`;
  const dasar = {
    id,
    exam: "LATIHAN" as const,
    section: "latihan",
    domain: ctx.mapel || "Umum",
    skill: ctx.topik || "Latihan",
    difficulty: "M" as const,
    calculatorAllowed: true,
    locale: "id" as const,
    stem: b.batang,
    explanation: b.pembahasan || "",
    tags: ["practice", slug(ctx.mapel), `kelas-${slug(ctx.kelas)}`, slug(ctx.topik)].filter(Boolean),
    estimatedTimeSec: 90,
    points: Number(b.bobot) > 0 ? Number(b.bobot) : 1,
    meta: { generator: "gemini-worksheet", version: 1, reviewed: true },
    /* Teks bacaan jadi stimulus: mesin ujian menampilkannya di panel kiri
     * (dengan stabilo) di samping soalnya, seperti soal SAT/A-Level. */
    ...(b.bacaan?.isi?.trim()
      ? { stimulus: { type: "passage" as const, title: b.bacaan.judul?.trim() || undefined, content: b.bacaan.isi.trim() } }
      : {}),
  };
  const jenis = (b.jenis || "PG").toUpperCase();

  if (jenis === "PG") {
    const choices = Object.entries(b.opsi || {})
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([cid, text]) => ({ id: cid.toUpperCase(), text: String(text).trim() }));
    const kunci = (b.kunci || "").trim().toUpperCase();
    if (choices.length < 2 || !choices.some((c) => c.id === kunci)) return null;
    return { ...dasar, type: "mcq_single", choices, answer: { mode: "choice", value: kunci } };
  }
  if (jenis === "B") {
    const kunci = normalBS(b.kunci);
    if (!kunci) return null;
    return {
      ...dasar, type: "mcq_single",
      choices: [{ id: "B", text: "Benar" }, { id: "S", text: "Salah" }],
      answer: { mode: "choice", value: kunci },
    };
  }
  if (jenis === "I") {
    const kunci = (b.kunci || "").trim();
    if (!kunci) return null;
    const polos = polosKunci(kunci);
    const murniAngka = /^[-+]?\d+([.,]\d+)?$/.test(polos.replace(/\s/g, ""));
    if (murniAngka) {
      return { ...dasar, type: "spr_numeric", answer: { mode: "numeric", value: Number(polos.replace(",", ".")), tolerance: 0.01 } };
    }
    return { ...dasar, type: "short_text", answer: { mode: "text", accepted: ragamKunci(kunci), caseSensitive: false, ignoreDiacritics: true } };
  }
  return null; // esai / majemuk: perlu penilaian guru, tidak masuk ujian otomatis
}

/** Kebalikannya, untuk mencetak paket yang disusun dari bank. */
export function questionKeButir(q: Question, no: number): Butir {
  const kunci = q.answer.mode === "choice" ? q.answer.value
    : q.answer.mode === "numeric" ? String(q.answer.value)
    : q.answer.mode === "text" ? q.answer.accepted[0] : "";
  const bs = q.choices?.length === 2 && q.choices.every((c) => ["B", "S"].includes(c.id));
  /* Stimulus kembali jadi blok Bacaan supaya PDF cetak ulang membawa teksnya. */
  const bacaan: Bacaan | null = q.stimulus?.content?.trim()
    ? { judul: q.stimulus.title?.trim() || "", isi: q.stimulus.content.trim() } : null;
  if (q.type === "mcq_single" && !bs) {
    return {
      kode: `PG${no}`, jenis: "PG", no, batang: q.stem,
      opsi: Object.fromEntries((q.choices ?? []).map((c) => [c.id, c.text])),
      bobot: q.points || 1, sub: [], set: 1, kunci, pembahasan: q.explanation || "", bacaan,
    };
  }
  if (bs) return { kode: `B${no}`, jenis: "B", no, batang: q.stem, opsi: {}, bobot: q.points || 1, sub: [], set: 1, kunci: kunci === "B" ? "Benar" : "Salah", pembahasan: q.explanation || "", bacaan };
  return { kode: `I${no}`, jenis: "I", no, batang: q.stem, opsi: {}, bobot: q.points || 1, sub: [], set: 1, kunci, pembahasan: q.explanation || "", bacaan };
}
