import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/adminGuard";
import { getPaket, hapusPaket, listPaket, savePaket } from "@/lib/practice/paket";
import { questionsByIds } from "@/lib/exams/bank";

export async function GET() {
  const guru = await adminOrNull();
  if (!guru) return NextResponse.json({ error: "Hanya guru" }, { status: 403 });
  return NextResponse.json({ paket: await listPaket() });
}

/** POST: susun paket dari soal bank. body: { judul, mapel, kelas, topik, questionIds, durasiMenit } */
export async function POST(req: Request) {
  const guru = await adminOrNull();
  if (!guru) return NextResponse.json({ error: "Hanya guru" }, { status: 403 });
  const b = (await req.json()) as { judul: string; mapel?: string; kelas?: string; topik?: string; questionIds: string[]; durasiMenit?: number };
  const ids = Array.isArray(b.questionIds) ? b.questionIds.filter((x) => typeof x === "string") : [];
  if (!ids.length) return NextResponse.json({ error: "Pilih minimal satu soal" }, { status: 400 });
  const ada = await questionsByIds(ids);
  const sah = ids.filter((id) => ada.has(id));
  const paket = await savePaket({
    judul: b.judul?.trim() || "Paket latihan", mapel: b.mapel?.trim() || "", kelas: b.kelas?.trim() || "",
    topik: b.topik?.trim() || "", questionIds: sah, durasiMenit: Math.max(5, Number(b.durasiMenit) || 120),
    sumber: "bank", terbit: true, oleh: guru.id,
  });
  return NextResponse.json({ paket });
}

/** PATCH: ubah judul/durasi/terbit. body: { id, ...perubahan } */
export async function PATCH(req: Request) {
  const guru = await adminOrNull();
  if (!guru) return NextResponse.json({ error: "Hanya guru" }, { status: 403 });
  const b = (await req.json()) as { id: string; judul?: string; durasiMenit?: number; terbit?: boolean };
  const p = await getPaket(b.id);
  if (!p) return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });
  const paket = await savePaket({
    ...p,
    ...(b.judul !== undefined ? { judul: b.judul.trim() || p.judul } : {}),
    ...(b.durasiMenit !== undefined ? { durasiMenit: Math.max(5, Number(b.durasiMenit) || p.durasiMenit) } : {}),
    ...(b.terbit !== undefined ? { terbit: Boolean(b.terbit) } : {}),
  });
  return NextResponse.json({ paket });
}

export async function DELETE(req: Request) {
  const guru = await adminOrNull();
  if (!guru) return NextResponse.json({ error: "Hanya guru" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id") || "";
  return NextResponse.json({ ok: await hapusPaket(id) });
}
