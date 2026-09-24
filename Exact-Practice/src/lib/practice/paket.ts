/* Paket latihan: daftar soal yang disusun guru — dari pembuat soal otomatis,
 * dari bank, atau acak per topik. Disimpan di berkas sendiri, bukan di
 * db.json, supaya tidak menyentuh kontrak FullDb yang juga dipakai driver
 * Supabase; paket hanya berarti untuk instalasi bimbel ini. */
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export type SumberPaket = "gemini" | "bank" | "acak" | "worksheet" | "tempel";

export interface Paket {
  id: string;
  judul: string;
  mapel: string;
  kelas: string;
  topik: string;
  /** kode ujian pendek yang dibagikan guru, mis. 7K4QX2 — dicari murid/pembeli di halaman Latihan */
  kode: string;
  questionIds: string[];
  durasiMenit: number;
  sumber: SumberPaket;
  /** nama berkas PDF lembar siswa di Desktop Mac (dibuat Exact Worksheet) */
  pdf?: string | null;
  /** nama berkas PDF berkunci */
  pdfKunci?: string | null;
  /** nomor set bila lembar Worksheet-nya memuat beberapa set (SET 1, SET 2) */
  set?: number | null;
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

/* Huruf/angka yang mudah dibaca lewat WhatsApp — tanpa 0/O dan 1/I. */
const HURUF = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function buatKode(dipakai: Set<string>) {
  for (;;) {
    const k = Array.from(crypto.randomBytes(6), (b) => HURUF[b % HURUF.length]).join("");
    if (!dipakai.has(k)) return k;
  }
}

/** Paket lama yang belum berkode diberi kode saat dibaca, lalu disimpan. */
async function bacaBerkode(): Promise<Paket[]> {
  const list = await baca();
  const dipakai = new Set(list.map((p) => p.kode).filter(Boolean));
  let ubah = false;
  for (const p of list) if (!p.kode) { p.kode = buatKode(dipakai); dipakai.add(p.kode); ubah = true; }
  if (ubah) await tulis(list);
  return list;
}

export const listPaket = async () =>
  (await bacaBerkode()).sort((a, b) => (a.dibuatAt < b.dibuatAt ? 1 : -1));

export async function paketDariKode(kode: string) {
  const k = kode.trim().toUpperCase();
  return k ? (await bacaBerkode()).find((p) => p.kode === k) ?? null : null;
}

export async function getPaket(id: string) {
  return (await bacaBerkode()).find((p) => p.id === id) ?? null;
}

export async function savePaket(p: Omit<Paket, "id" | "dibuatAt" | "kode"> & { id?: string; dibuatAt?: string; kode?: string }) {
  const list = await bacaBerkode();
  const i = list.findIndex((x) => x.id === p.id);
  const paket: Paket = {
    ...p,
    id: p.id ?? `pk-${crypto.randomBytes(5).toString("hex")}`,
    dibuatAt: p.dibuatAt ?? new Date().toISOString(),
    kode: p.kode || (i >= 0 ? list[i].kode : "") || buatKode(new Set(list.map((x) => x.kode))),
  };
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
