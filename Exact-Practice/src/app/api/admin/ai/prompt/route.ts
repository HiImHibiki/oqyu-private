import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/adminGuard";
import { buildPrompt, type Criteria } from "@/lib/ai/promptRegistry";

/** Merakit prompt dari kriteria — dipakai tombol "Salin prompt" supaya teks
 *  yang disalin identik dengan yang dikirim ke API. */
export async function POST(req: Request) {
  const me = await adminOrNull();
  if (!me) return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });

  const c = (await req.json()) as Criteria;
  if (!c?.section) return NextResponse.json({ error: "Section wajib dipilih" }, { status: 400 });

  const jumlah = Math.max(1, Math.min(30, Number(c.jumlah) || 8));

  try {
    const built = await buildPrompt({ ...c, jumlah });
    return NextResponse.json({ ...built, jumlah });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal menyusun prompt" },
      { status: 400 },
    );
  }
}
