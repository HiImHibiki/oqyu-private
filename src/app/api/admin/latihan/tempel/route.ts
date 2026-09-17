import { NextResponse } from "next/server";
import crypto from "crypto";
import { adminOrNull } from "@/lib/adminGuard";
import { importQuestions } from "@/lib/exams/bank";
import { savePaket } from "@/lib/practice/paket";
import { uraiNaskah } from "@/lib/practice/naskah";
import { butirKeQuestion } from "@/lib/practice/worksheet";

/* Guru menempel naskah soal hasil AI (ChatGPT/Gemini/Claude) yang disusun dari
 * prompt di /admin/latihan. Bedanya dengan /api/latihan/terbit: yang itu
 * dipanggil Exact Worksheet dengan kunci bersama, yang ini permintaan peramban
 * guru sendiri — jadi dijaga sesi admin. Sesudah naskah diurai, sisanya jalur
 * yang sama persis: butir → Question → bank soal → paket. */
export async function POST(req: Request) {
  const guru = await adminOrNull();
  if (!guru) return NextResponse.json({ error: "Hanya guru" }, { status: 403 });

  const b = (await req.json().catch(() => null)) as
    | { naskah?: string; judul?: string; mapel?: string; kelas?: string; topik?: string; durasiMenit?: number; terbit?: boolean; set?: number | null }
    | null;
  const naskah = (b?.naskah || "").trim();
  if (!naskah) return NextResponse.json({ error: "Naskahnya masih kosong" }, { status: 400 });

  const { butir, meta } = uraiNaskah(naskah);
  if (!butir.length) {
    return NextResponse.json(
      { error: "Tidak ada soal yang terbaca. Pastikan tiap soal diawali kode seperti «PG1.» dan ada blok «Kunci Jawaban»." },
      { status: 422 },
    );
  }

  /* Naskah boleh memuat beberapa set (SET 2, SET 3 — soal dan kunci berbeda).
   * Tiap set jadi paket sendiri dengan kode ujiannya sendiri, sama seperti
   * lembar Worksheet, supaya guru bisa membagi kelas jadi beberapa kode. */
  const perSet = new Map<number, typeof butir>();
  for (const x of butir) { const n = x.set ?? 1; perSet.set(n, [...(perSet.get(n) ?? []), x]); }
  const banyakSet = perSet.size > 1;
  /* Naskah satu set boleh diberi nomor set oleh guru ("ini set ke-3"). */
  const setGuru = Number.isInteger(b?.set) && (b!.set as number) > 0 ? (b!.set as number) : null;

  const judulDasar = b?.judul?.trim() || meta.judul || b?.topik?.trim() || "Paket latihan";
  const hasil: { paket: Awaited<ReturnType<typeof savePaket>>; jumlah: number; dilewati: number }[] = [];

  for (const [set, daftar] of [...perSet].sort((x, y) => x[0] - y[0])) {
    const paketId = `pk-${crypto.randomBytes(5).toString("hex")}`;
    const ctx = {
      paketId,
      mapel: b?.mapel?.trim() || "",
      kelas: b?.kelas?.trim() || "",
      topik: b?.topik?.trim() || judulDasar,
    };
    const soal = daftar.map((x) => butirKeQuestion(x, ctx));
    const dipakai = soal.filter((q): q is NonNullable<typeof q> => q !== null);
    if (!dipakai.length) continue;

    await importQuestions(dipakai, "approved", { force: true });
    const paket = await savePaket({
      id: paketId,
      judul: (banyakSet ? set : setGuru) ? `${judulDasar} — Set ${banyakSet ? set : setGuru}` : judulDasar,
      mapel: ctx.mapel, kelas: ctx.kelas, topik: ctx.topik, set: banyakSet ? set : setGuru,
      questionIds: dipakai.map((q) => q.id),
      durasiMenit: Math.max(5, Number(b?.durasiMenit) || 120),
      sumber: "tempel", terbit: b?.terbit !== false, oleh: guru.id,
      dilewati: soal.length - dipakai.length,
    });
    hasil.push({ paket, jumlah: dipakai.length, dilewati: soal.length - dipakai.length });
  }

  if (!hasil.length) {
    return NextResponse.json(
      { error: `${butir.length} soal terbaca, tapi tidak ada yang bisa dinilai otomatis. Cek blok «Kunci Jawaban» — kode soalnya harus sama persis (mis. PG1-B).` },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ok: true,
    paket: hasil.map((h) => h.paket),
    jumlah: hasil.reduce((a, h) => a + h.jumlah, 0),
    dilewati: hasil.reduce((a, h) => a + h.dilewati, 0),
  });
}
