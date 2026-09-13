import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/adminGuard";
import { searchBank } from "@/lib/exams/bank";
import { tagDari } from "@/lib/practice/latihan";

/** GET ?q=&mapel=&kelas= → daftar ringkas soal LATIHAN untuk menyusun paket */
export async function GET(req: Request) {
  const guru = await adminOrNull();
  if (!guru) return NextResponse.json({ error: "Hanya guru" }, { status: 403 });
  const u = new URL(req.url);
  const q = u.searchParams.get("q") || undefined;
  const mapel = u.searchParams.get("mapel") || "";
  const kelas = u.searchParams.get("kelas") || "";
  const daftar = (await searchBank({ exam: "LATIHAN", q, statuses: ["approved"] }))
    .map((x) => ({ id: x.id, stem: x.stem, type: x.type, ...tagDari(x) }))
    .filter((x) => (!mapel || x.mapel === mapel) && (!kelas || x.kelas === kelas))
    .slice(0, 400);
  return NextResponse.json({ soal: daftar });
}
