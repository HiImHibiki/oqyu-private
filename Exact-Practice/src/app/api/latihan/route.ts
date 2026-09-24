import { NextResponse } from "next/server";
import { currentUser, menunggu } from "@/lib/auth";
import { getPaket } from "@/lib/practice/paket";
import { mulaiAcak, mulaiDariPaket } from "@/lib/practice/latihan";
import { aksesLatihan } from "@/lib/practice/akses";

/** Mulai latihan. body: { paketId } atau { mapel, kelas?, topik?, jumlah? } */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Perlu masuk" }, { status: 401 });
  if (menunggu(user)) return NextResponse.json({ error: "Akunmu belum disetujui guru" }, { status: 403 });
  const akses = await aksesLatihan(user);
  if (!akses.boleh) return NextResponse.json({ error: `${akses.alasan}. Beli/perpanjang paket di /beli` }, { status: 402 });
  const b = (await req.json()) as { paketId?: string; mapel?: string; kelas?: string; topik?: string; jumlah?: number };
  try {
    if (b.paketId) {
      const p = await getPaket(b.paketId);
      if (!p || (!p.terbit && user.role === "student")) return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });
      if (!p.questionIds.length) return NextResponse.json({ error: "Paket ini belum punya soal" }, { status: 400 });
      const a = await mulaiDariPaket(user.id, p);
      return NextResponse.json({ attemptId: a.id });
    }
    if (b.mapel) {
      const a = await mulaiAcak(user.id, { mapel: b.mapel, kelas: b.kelas, topik: b.topik, jumlah: Number(b.jumlah) || 10 });
      if (!a) return NextResponse.json({ error: "Belum ada soal untuk pilihan itu" }, { status: 404 });
      return NextResponse.json({ attemptId: a.id });
    }
    return NextResponse.json({ error: "Sebutkan paketId atau mapel" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal memulai latihan" }, { status: 500 });
  }
}
