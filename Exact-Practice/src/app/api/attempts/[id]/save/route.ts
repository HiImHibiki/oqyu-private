import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { loadAttempt, remainingSec, sectionsOf } from "@/lib/exams/attempt";
import type { ResponseValue } from "@/lib/types";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await loadAttempt(id);
  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: res.error === "not_found" ? 404 : 403 });
  }

  const { attempt } = res;
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "Attempt sudah selesai" }, { status: 409 });
  }

  const { sectionCode, responses } = (await req.json()) as {
    sectionCode: string;
    responses: Record<string, ResponseValue>;
  };

  const sections = await sectionsOf(attempt);
  const section = sections.find((s) => s.code === sectionCode);
  if (!section) return NextResponse.json({ error: "Section tidak dikenal" }, { status: 400 });

  // hanya jawaban milik section ini yang diterima
  const allowed = new Set(section.questions.map((q) => q.id));
  const filtered: Record<string, ResponseValue> = {};
  for (const [qid, v] of Object.entries(responses ?? {})) {
    if (allowed.has(qid)) filtered[qid] = v;
  }

  // Jam belum berjalan untuk section ini (siswa melewati layar mulai):
  // mulai sekarang, supaya tidak ada celah "mengerjakan tanpa tenggat".
  let live = attempt;
  if (!live.sectionDeadlines[sectionCode]) {
    const started = await getDb().startSection(id, sections.indexOf(section), {
      code: section.code,
      durationSec: section.durationSec,
    });
    if (started) live = started;
  }

  const saved = await getDb().saveResponses(id, sectionCode, filtered);
  if (saved.expired) {
    return NextResponse.json(
      { expired: true, error: "Waktu subtes ini sudah habis", serverNow: saved.serverNow },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: saved.ok,
    serverNow: saved.serverNow,
    remainingSec: remainingSec(live.sectionDeadlines[sectionCode]),
  });
}
