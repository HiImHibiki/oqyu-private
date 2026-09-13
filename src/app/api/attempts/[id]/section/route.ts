import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { loadAttempt, plannedSectionCount, remainingSec, sectionsOf } from "@/lib/exams/attempt";
import { decideRouting, needsRouting } from "@/lib/exams/adaptive";
import { getBlueprint } from "@/lib/exams/blueprints";
import { stripAnswer } from "@/lib/exams/sanitize";

/* Mulai section berikutnya. Tenggatnya ditetapkan server dan hanya sekali —
 * memanggil ulang endpoint ini tidak menambah waktu. */
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

  const { index } = (await req.json()) as { index: number };

  /* Routing modul adaptif.
   *
   * Section berikutnya mungkin modul 2 yang variannya belum ditentukan. Kalau
   * begitu, tentukan sekarang dari jawaban modul 1 yang sudah tersimpan —
   * SEBELUM daftar section disusun, karena varian yang tidak terpilih tidak
   * boleh pernah muncul dalam daftar itu.
   *
   * Keputusan ini ditulis sekali. Memanggil endpoint ini lagi tidak akan
   * mengubahnya, jadi peserta tidak bisa mencoba kedua varian. */
  let current = attempt;
  const bp = getBlueprint(current.exam);
  const decided = current.currentSection;
  const pending = (bp?.sections ?? []).filter((s) => needsRouting(current, s.code));
  for (const s of pending) {
    const already = (bp?.sections ?? []).findIndex((x) => x.code === s.code);
    // hanya rutekan section yang akan segera dibuka, bukan seluruhnya sekaligus
    if (already > index) continue;
    const d = await decideRouting(current, s.code);
    if (!d) continue;
    const next = await getDb().setRouting(current.id, s.code, d.variant);
    if (next) current = next;
  }
  void decided;

  const sections = await sectionsOf(current);
  if (!Number.isInteger(index) || index < 0 || index >= sections.length) {
    return NextResponse.json({ error: "Indeks section tidak valid" }, { status: 400 });
  }
  // hanya boleh maju satu langkah, atau membuka ulang section yang sedang berjalan
  if (index > current.currentSection + 1) {
    return NextResponse.json({ error: "Tidak boleh melompati section" }, { status: 400 });
  }

  const section = sections[index];
  const updated = await getDb().startSection(id, index, {
    code: section.code,
    durationSec: section.durationSec,
  });
  if (!updated) return NextResponse.json({ error: "Gagal memulai section" }, { status: 500 });

  const deadline = updated.sectionDeadlines[section.code];
  return NextResponse.json({
    sectionIndex: index,
    sectionCode: section.code,
    deadline,
    serverNow: new Date().toISOString(),
    remainingSec: remainingSec(deadline),
    // Soal section ini baru dikirim sekarang, bukan saat halaman dimuat.
    questions: section.questions.map(stripAnswer),
    totalSections: plannedSectionCount(current),
  });
}
