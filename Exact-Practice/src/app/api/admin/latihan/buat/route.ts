import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/adminGuard";
import { importQuestions } from "@/lib/exams/bank";
import { listPaket, savePaket } from "@/lib/practice/paket";
import { butirKeQuestion, hentikanBuat, mulaiBuat, soalDari, statusBuat } from "@/lib/practice/worksheet";
import crypto from "crypto";

export interface PermintaanBuat {
  judul?: string; topik: string; mapel: string; kelas: string; jumlah: number;
  instruksi?: string; durasiMenit?: number; mesin?: "gemini" | "claude";
}

/** POST: mulai pembuatan soal di Exact Worksheet → { jid } */
export async function POST(req: Request) {
  const guru = await adminOrNull();
  if (!guru) return NextResponse.json({ error: "Hanya guru" }, { status: 403 });
  const b = (await req.json()) as PermintaanBuat;
  if (!b.topik?.trim()) return NextResponse.json({ error: "Topik wajib diisi" }, { status: 400 });
  try {
    const { jid } = await mulaiBuat({
      topik: b.topik.trim(), mapel: b.mapel?.trim() || "", kelas: b.kelas?.trim() || "",
      jumlah: Math.min(40, Math.max(1, Number(b.jumlah) || 10)), instruksi: b.instruksi, mesin: b.mesin,
    });
    // Paket dicatat sejak awal (belum terbit, tanpa soal) supaya jid-nya tidak
    // hilang kalau tab guru tertutup sebelum Gemini selesai.
    const paket = await savePaket({
      id: `pk-${crypto.randomBytes(5).toString("hex")}`,
      judul: b.judul?.trim() || `${b.mapel || "Latihan"} — ${b.topik.trim()}`,
      mapel: b.mapel?.trim() || "", kelas: b.kelas?.trim() || "", topik: b.topik.trim(),
      questionIds: [], durasiMenit: Math.max(5, Number(b.durasiMenit) || 120), sumber: "gemini",
      jid, terbit: false, oleh: guru.id,
    });
    return NextResponse.json({ jid, paketId: paket.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Exact Worksheet tidak bisa dihubungi" }, { status: 502 });
  }
}

/** GET ?paketId= : pantau; begitu selesai, soal diimpor ke bank dan paket diisi. */
export async function GET(req: Request) {
  const guru = await adminOrNull();
  if (!guru) return NextResponse.json({ error: "Hanya guru" }, { status: 403 });
  const paketId = new URL(req.url).searchParams.get("paketId") || "";
  const paket = (await listPaket()).find((p) => p.id === paketId);
  if (!paket) return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });
  if (paket.questionIds.length) return NextResponse.json({ selesai: true, paket });
  if (!paket.jid) return NextResponse.json({ selesai: false, galat: "Paket ini tidak punya pekerjaan" });

  let st;
  try { st = await statusBuat(paket.jid); }
  catch { return NextResponse.json({ selesai: false, langkah: ["Exact Worksheet tidak menjawab…"], maju: 0 }); }
  if (!st.selesai) return NextResponse.json({ selesai: false, langkah: st.langkah, maju: st.maju, antre: st.antre });
  if (st.galat) return NextResponse.json({ selesai: true, galat: st.galat, langkah: st.langkah });

  const hasil = await soalDari(paket.jid);
  const soal = hasil.butir.map((b) => butirKeQuestion(b, { paketId: paket.id, mapel: paket.mapel, kelas: paket.kelas, topik: paket.topik }));
  const dipakai = soal.filter((q): q is NonNullable<typeof q> => q !== null);
  if (!dipakai.length) return NextResponse.json({ selesai: true, galat: "Tidak ada soal yang bisa dinilai otomatis dari hasil ini", langkah: st.langkah });
  await importQuestions(dipakai, "approved", { force: true });
  const terisi = await savePaket({
    ...paket, questionIds: dipakai.map((q) => q.id), pdf: hasil.pdf ?? st.pdf ?? null,
    dilewati: soal.length - dipakai.length, terbit: true,
  });
  return NextResponse.json({ selesai: true, paket: terisi, langkah: st.langkah });
}

/** DELETE ?jid= : hentikan pekerjaan yang masih berjalan */
export async function DELETE(req: Request) {
  const guru = await adminOrNull();
  if (!guru) return NextResponse.json({ error: "Hanya guru" }, { status: 403 });
  const jid = new URL(req.url).searchParams.get("jid") || "";
  if (jid) await hentikanBuat(jid);
  return NextResponse.json({ ok: true });
}
