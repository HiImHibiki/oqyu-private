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

  /* Lembar Worksheet bisa memuat beberapa set (SET 1, SET 2 — soal berbeda,
   * kunci berbeda). Tiap set jadi paket sendiri dengan kode ujiannya sendiri,
   * supaya guru bisa membagi kelas: "yang duduk di kiri kode A, kanan kode B".
   * Lembar yang sama diterbitkan dua kali memperbarui paket yang sama. */
  const perSet = new Map<number, Butir[]>();
  for (const b of k.butir) { const n = b.set ?? 1; perSet.set(n, [...(perSet.get(n) ?? []), b]); }
  const banyakSet = perSet.size > 1;
  const semua = await listPaket();
  const hasil: { paket: Awaited<ReturnType<typeof savePaket>>; jumlah: number; dilewati: number }[] = [];
  for (const [set, butir] of [...perSet].sort((x, y) => x[0] - y[0])) {
    const lama = k.pdf ? semua.find((p) => p.sumber === "worksheet" && p.pdf === k.pdf && (p.set ?? 1) === set) : undefined;
    const paketId = lama?.id ?? `pk-${crypto.randomBytes(5).toString("hex")}`;
    const judulDasar = k.judul?.trim() || lama?.judul || "Paket latihan";
    const ctx = { paketId, mapel: k.mapel?.trim() || "", kelas: k.kelas?.trim() || "", topik: k.topik?.trim() || judulDasar };
    const soal = butir.map((b) => butirKeQuestion(b, ctx));
    const dipakai = soal.filter((q): q is NonNullable<typeof q> => q !== null);
    if (!dipakai.length) continue;
    await importQuestions(dipakai, "approved", { force: true });
    const paket = await savePaket({
      id: paketId, dibuatAt: lama?.dibuatAt,
      judul: banyakSet ? `${judulDasar.replace(/ — Set \d+$/, "")} — Set ${set}` : judulDasar,
      mapel: ctx.mapel, kelas: ctx.kelas, topik: ctx.topik, set: banyakSet ? set : null,
      questionIds: dipakai.map((q) => q.id),
      durasiMenit: Math.max(5, Number(k.durasiMenit) || Math.ceil(dipakai.length * 2)),
      sumber: "worksheet", pdf: k.pdf ?? lama?.pdf ?? null, pdfKunci: k.pdfKunci ?? lama?.pdfKunci ?? null,
      terbit: true, oleh: "exact-worksheet", dilewati: soal.length - dipakai.length,
    });
    hasil.push({ paket, jumlah: dipakai.length, dilewati: soal.length - dipakai.length });
  }
  if (!hasil.length) return NextResponse.json({ galat: "Tidak ada soal yang bisa dinilai otomatis (PG / benar-salah / isian berkunci)" }, { status: 422 });
  const jumlah = hasil.reduce((a, h) => a + h.jumlah, 0), dilewati = hasil.reduce((a, h) => a + h.dilewati, 0);
  const paket = hasil[0].paket;
  const publik = process.env.EXACT_PRACTICE_PUBLIC || "";
  return NextResponse.json({ ok: true, paket, semua: hasil.map((h) => ({ id: h.paket.id, judul: h.paket.judul, kode: h.paket.kode, jumlah: h.jumlah })), jumlah, dilewati, url: `${publik}/latihan`, admin: `${publik}/admin/latihan` });
}
