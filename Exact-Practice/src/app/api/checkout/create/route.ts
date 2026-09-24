import { NextResponse } from "next/server";

/* Exact Practice gratis untuk murid bimbel — tidak ada paket berbayar, jadi
 * checkout warisan Exact Try Out dimatikan (bukan dihapus, supaya tautan lama
 * mendapat jawaban yang jelas, bukan 404). */
export async function POST() {
  return NextResponse.json({ error: "Exact Practice gratis — tidak ada paket berbayar." }, { status: 410 });
}
