import { promises as fs } from "fs";
import path from "path";
import { getBlueprint } from "@/lib/exams/blueprints";

/* Menyusun prompt dari berkas di /prompts.
 *
 * Berkasnya sengaja tetap berupa Markdown yang bisa dibaca manusia, bukan
 * string di dalam kode: penulis soal harus bisa menyuntingnya tanpa menyentuh
 * aplikasi, dan tombol "Salin prompt" harus menghasilkan teks yang sama persis
 * dengan yang dikirim ke API. */

const ROOT = () => path.join(process.cwd(), "prompts");

/** section blueprint -> berkas prompt (relatif terhadap /prompts) */
const FILE_FOR_SECTION: Record<string, string> = {
  sat_rw_m1: "sat/reading-writing.md",
  sat_rw_m2: "sat/reading-writing.md",
  sat_math_m1: "sat/math.md",
  sat_math_m2: "sat/math.md",

  utbk_pu: "utbk/01-penalaran-umum.md",
  utbk_ppu: "utbk/02-ppu.md",
  utbk_pbm: "utbk/03-pbm.md",
  utbk_pk: "utbk/04-pengetahuan-kuantitatif.md",
  utbk_lbi: "utbk/05-literasi-bahasa-indonesia.md",
  utbk_lbe: "utbk/06-literasi-bahasa-inggris.md",
  utbk_pm: "utbk/07-penalaran-matematika.md",

  csca_math: "csca/01-mathematics.md",
  csca_physics: "csca/02-physics.md",
  csca_chemistry: "csca/03-chemistry.md",
  csca_chinese_stem: "csca/04-chinese-stem.md",
  csca_chinese_hum: "csca/05-chinese-humanities.md",

  al_math_p1: "alevel/01-mathematics-9709-p1.md",
  al_phys_p2: "alevel/02-physics-9702.md",
  al_chem_p1: "alevel/03-chemistry-9701.md",
  al_econ_p2: "alevel/04-economics-9708.md",
};

/** Berkas yang selalu ikut sebelum prompt segmen (CSCA wajib baca aturan bilingual). */
const PREFIX_FOR_SECTION: Record<string, string> = {
  csca_math: "csca/00-aturan-csca.md",
  csca_physics: "csca/00-aturan-csca.md",
  csca_chemistry: "csca/00-aturan-csca.md",
  csca_chinese_stem: "csca/00-aturan-csca.md",
  csca_chinese_hum: "csca/00-aturan-csca.md",
};

export interface Criteria {
  jumlah: number;
  section: string;
  domain?: string;
  skill?: string;
  varian?: "base" | "hard" | "easy";
  tingkat?: string;
  topik?: string;
  catatan?: string;
}

export interface BuiltPrompt {
  system: string;
  user: string;
  sourceFiles: string[];
}

const read = (rel: string) => fs.readFile(path.join(ROOT(), rel), "utf8");

export function promptFileFor(section: string) {
  return FILE_FOR_SECTION[section] ?? null;
}

export function sectionsWithPrompt() {
  return Object.keys(FILE_FOR_SECTION);
}

export async function buildPrompt(c: Criteria): Promise<BuiltPrompt> {
  const rel = FILE_FOR_SECTION[c.section];
  if (!rel) throw new Error(`Belum ada berkas prompt untuk section "${c.section}"`);

  const files = [PREFIX_FOR_SECTION[c.section], rel].filter(Boolean) as string[];
  const system = await read("_shared/system.md");
  const parts = await Promise.all(files.map(read));

  let user = parts.join("\n\n---\n\n");

  // isi placeholder {{...}} yang dipakai berkas prompt
  const values: Record<string, string> = {
    JUMLAH: String(c.jumlah),
    SECTION: c.section,
    VARIAN: c.varian ?? "base",
    DOMAIN: c.domain ?? "campuran sesuai porsi di tabel",
    TINGKAT: c.tingkat ?? "E 25% / M 50% / H 25%",
    TEMA_BACAAN: c.topik ?? "bebas, sebarkan topiknya",
    TEMA: c.topik ?? "bebas, sebarkan topiknya",
    KONTEKS: c.topik ?? "situasi sehari-hari di Indonesia",
    JENIS_TEKS: c.topik ?? "campuran",
    TOPIK: c.topik ?? "campuran sesuai porsi di tabel",
    HSK: c.tingkat ?? "HSK 4-5",
    TOTAL_MARKS: String(c.jumlah * 5),
    JENIS: c.topik ?? "data-response",
  };
  user = user.replace(/\{\{(\w+)\}\}/g, (m, key: string) => values[key] ?? m);

  // ringkasan kriteria ditaruh di akhir supaya menjadi instruksi terakhir
  user += "\n\n---\n\n" + criteriaBlock(c);

  return { system, user, sourceFiles: files };
}

function criteriaBlock(c: Criteria) {
  const lines = [
    "# Permintaan untuk kali ini",
    "",
    `- Jumlah soal: **${c.jumlah}**`,
    `- Section: \`${c.section}\``,
  ];
  if (c.domain) lines.push(`- Domain: **${c.domain}** (hanya domain ini)`);
  if (c.skill) lines.push(`- Skill: **${c.skill}** (hanya skill ini)`);
  if (c.varian && c.varian !== "base") lines.push(`- Varian modul adaptif: **${c.varian}**`);
  if (c.tingkat) lines.push(`- Komposisi kesulitan: ${c.tingkat}`);
  if (c.topik) lines.push(`- Tema / konteks: ${c.topik}`);
  if (c.catatan) lines.push("", "## Instruksi tambahan dari penyusun", "", c.catatan);

  lines.push(
    "",
    "Keluarkan **hanya** JSON array berisi objek soal. Tanpa pengantar, tanpa penutup,",
    "tanpa pagar kode.",
  );
  return lines.join("\n");
}

/** Daftar section yang punya berkas prompt, dikelompokkan per ujian —
 *  dipakai untuk mengisi dropdown di panel admin. */
export function sectionOptions() {
  const out: { exam: string; code: string; name: string; domains: { name: string; skills: string[] }[] }[] = [];
  for (const code of Object.keys(FILE_FOR_SECTION)) {
    const exam = code.startsWith("sat") ? "SAT"
      : code.startsWith("utbk") ? "UTBK"
      : code.startsWith("csca") ? "CSCA" : "ALEVEL";
    const s = getBlueprint(exam)?.sections.find((x) => x.code === code);
    if (s) out.push({ exam, code, name: s.name, domains: s.domains.map((d) => ({ name: d.name, skills: d.skills })) });
  }
  return out;
}
