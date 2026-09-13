import { NextResponse } from "next/server";
import { loadAttempt, remainingSec, sectionsOf } from "@/lib/exams/attempt";

/* Sumber kebenaran waktu ujian.
 * Browser hanya menghitung mundur untuk tampilan; angka yang mengikat
 * datang dari sini. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await loadAttempt(id);
  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: res.error === "not_found" ? 404 : 403 });
  }

  const { attempt } = res;
  const sections = await sectionsOf(attempt);
  const idx = Math.min(attempt.currentSection, sections.length - 1);
  const section = sections[idx];
  const deadline = attempt.sectionDeadlines[section.code];

  return NextResponse.json({
    status: attempt.status,
    serverNow: new Date().toISOString(),
    sectionIndex: idx,
    sectionCode: section.code,
    deadline: deadline ?? null,
    remainingSec: remainingSec(deadline),
  });
}
