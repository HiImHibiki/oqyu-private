/* Paket latihan: daftar soal yang disusun guru — dari pembuat soal otomatis,
 * dari bank, atau acak per topik. Disimpan di berkas sendiri, bukan di
 * db.json, supaya tidak menyentuh kontrak FullDb yang juga dipakai driver
 * Supabase; paket hanya berarti untuk instalasi bimbel ini. */
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export type SumberPaket = "gemini" | "bank" | "acak";

export interface Paket {
  id: string;
  judul: string;
  mapel: string;
  kelas: string;
  topik: string;
  questionIds: string[];
  durasiMenit: number;
  sumber: SumberPaket;
  /** nama berkas PDF lembar siswa di Desktop Mac (dibuat Exact Worksheet) */
  pdf?: string | null;
  /** nama berkas PDF berkunci */
  pdfKunci?: string | null;
  /** id pekerjaan di Exact Worksheet, untuk penelusuran */
  jid?: string | null;
  terbit: boolean;
  dibuatAt: string;
  oleh: string;
  /** soal esai yang dilewati saat impor (tidak bisa dinilai otomatis) */
  dilewati?: number;
}

const FILE = path.join(process.env.EXACT_DATA_DIR || path.join(process.cwd(), ".data"), "paket.json");

async function baca(): Promise<Paket[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const d = JSON.parse(raw);
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

/* Tulis ke berkas sementara lalu ganti nama: writeFile memotong berkas lebih
 * dulu, jadi kalau proses mati di tengah, seluruh daftar paket hilang. */
async function tulis(list: Paket[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list, null, 2));
  await fs.rename(tmp, FILE);
}

export const listPaket = async () =>
  (await baca()).sort((a, b) => (a.dibuatAt < b.dibuatAt ? 1 : -1));

export async function getPaket(id: string) {
  return (await baca()).find((p) => p.id === id) ?? null;
}

export async function savePaket(p: Omit<Paket, "id" | "dibuatAt"> & { id?: string; dibuatAt?: string }) {
  const list = await baca();
  const paket: Paket = {
    ...p,
    id: p.id ?? `pk-${crypto.randomBytes(5).toString("hex")}`,
    dibuatAt: p.dibuatAt ?? new Date().toISOString(),
  };
  const i = list.findIndex((x) => x.id === paket.id);
  if (i >= 0) list[i] = paket; else list.push(paket);
  await tulis(list);
  return paket;
}

export async function hapusPaket(id: string) {
  const list = await baca();
  const sisa = list.filter((p) => p.id !== id);
  if (sisa.length !== list.length) await tulis(sisa);
  return sisa.length !== list.length;
}
