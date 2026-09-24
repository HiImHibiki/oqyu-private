/* Akun pengguna umum lahir dari pesanan, bukan dari pendaftaran: begitu admin
 * menandai transfernya lunas, kata sandi sementara dibuat dari nama emailnya
 * dan disimpan di sini supaya admin bisa mengirimkannya lewat WhatsApp —
 * berulang kali kalau perlu. Dihapus begitu pengguna mengganti sandinya. */
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const FILE = path.join(process.env.EXACT_DATA_DIR || path.join(process.cwd(), ".data"), "sandi-sementara.json");

export interface SandiSementara { userId: string; email: string; sandi: string; hp: string; orderId: string; dibuatAt: string }

async function baca(): Promise<Record<string, SandiSementara>> {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")); } catch { return {}; }
}
async function tulis(d: Record<string, SandiSementara>) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(d, null, 2)); await fs.rename(tmp, FILE);
}

/** "budi.santoso@gmail.com" → "budi" + 3 angka, mis. budi482 — mudah dibaca lewat WhatsApp. */
export function buatSandi(email: string) {
  const nama = (email.split("@")[0] || "murid").toLowerCase().replace(/[^a-z]/g, "").slice(0, 8) || "murid";
  return `${nama}${100 + crypto.randomInt(900)}`;
}

export async function simpanSandiSementara(s: SandiSementara) {
  const d = await baca(); d[s.userId] = s; await tulis(d);
}
export async function sandiSementaraDari(userId: string) {
  return (await baca())[userId] ?? null;
}
export async function semuaSandiSementara() { return baca(); }
export async function hapusSandiSementara(userId: string) {
  const d = await baca(); if (d[userId]) { delete d[userId]; await tulis(d); }
}
