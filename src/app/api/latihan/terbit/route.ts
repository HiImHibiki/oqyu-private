import { NextResponse } from "next/server";
import crypto from "crypto";
import { importQuestions } from "@/lib/exams/bank";
import { listPaket, savePaket } from "@/lib/practice/paket";
import { butirKeQuestion, type Butir } from "@/lib/practice/worksheet";

/* Exact Worksheet → Exact Practice: guru membuat lembar seperti biasa di
 * Worksheet, lalu menekan "Ke Practice". Worksheet mengirim butir soal yang
 * sudah diurai ke sini. Bukan permintaan dari peramban, jadi dijaga kunci
 * bersama, bukan sesi — dan tunnel pun menyodorkan permintaan sebagai
 * localhost, jadi asal alamat tidak bisa dipercaya. */
interface Kiriman {
  judul: string; mapel?: string; kelas?: string; topik?: string; durasiMenit?: number;
  butir: Butir[]; pdf?: string | null; pdfKunci?: string | null;
}

function kunciSah(req: Request) {
  const mau = process.env.EXACT_PRACTICE_KUNCI || "";
  const dapat = req.headers.get("x-exact-kunci") || "";
  return mau.length > 0 && dapat.length === mau.length &&
    crypto.timingSafeEqual(Buffer.from(dapat), Buffer.from(mau));
}

export async function POST(req: Request) {
  if (!kunciSah(req)) return NextResponse.json({ galat: "Kunci Practice salah atau belum diatur" }, { status: 401 });
  const k = (await req.json().catch(() => null)) as Kiriman | null;
  if (!k || !Array.isArray(k.butir) || !k.butir.length) return NextResponse.json({ galat: "Tidak ada butir soal" }, { status: 400 });

  // Lembar yang sama diterbitkan dua kali → paket yang sama diperbarui, bukan digandakan.
  const lama = k.pdf ? (await listPaket()).find((p) => p.sumber === "worksheet" && p.pdf === k.pdf) : undefined;
  const paketId = lama?.id ?? `pk-${crypto.randomBytes(5).toString("hex")}`;
  const ctx = { paketId, mapel: k.mapel?.trim() || "", kelas: k.kelas?.trim() || "", topik: k.topik?.trim() || k.judul || "" };
  const soal = k.butir.map((b) => butirKeQuestion(b, ctx));
  const dipakai = soal.filter((q): q is NonNullable<typeof q> => q !== null);
  if (!dipakai.length) return NextResponse.json({ galat: "Tidak ada soal yang bisa dinilai otomatis (PG / benar-salah / isian berkunci)" }, { status: 422 });

  await importQuestions(dipakai, "approved", { force: true });
  const paket = await savePaket({
    id: paketId, dibuatAt: lama?.dibuatAt,
    judul: k.judul?.trim() || lama?.judul || "Paket latihan", mapel: ctx.mapel, kelas: ctx.kelas, topik: ctx.topik,
    questionIds: dipakai.map((q) => q.id),
    durasiMenit: Math.max(5, Number(k.durasiMenit) || Math.ceil(dipakai.length * 2)),
    sumber: "worksheet", pdf: k.pdf ?? lama?.pdf ?? null, pdfKunci: k.pdfKunci ?? lama?.pdfKunci ?? null,
    terbit: true, oleh: "exact-worksheet", dilewati: soal.length - dipakai.length,
  });
  const publik = process.env.EXACT_PRACTICE_PUBLIC || "";
  return NextResponse.json({ ok: true, paket, jumlah: dipakai.length, dilewati: soal.length - dipakai.length, url: `${publik}/latihan`, admin: `${publik}/admin/latihan` });
}
