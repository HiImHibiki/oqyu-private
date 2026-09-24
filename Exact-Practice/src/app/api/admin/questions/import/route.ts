import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/adminGuard";
import { validateQuestions } from "@/lib/exams/validate";
import { importQuestions, type BankStatus } from "@/lib/exams/bank";

const STATUSES: BankStatus[] = ["draft", "in_review", "approved", "retired"];

/* Impor soal dari JSON.
 *
 * Soal yang punya temuan BLOCKER TIDAK diimpor — hanya yang lolos yang masuk,
 * dan temuannya dikembalikan supaya bisa diperbaiki. Lebih baik separuh masuk
 * daripada seluruh berkas ditolak tanpa penjelasan. */
export async function POST(req: Request) {
  const me = await adminOrNull();
  if (!me) return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });

  let body: { json?: string; status?: string; strict?: boolean; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON" }, { status: 400 });
  }

  const status = (body.status ?? "in_review") as BankStatus;
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: "Status tidak dikenal" }, { status: 400 });
  }
  // hanya admin penuh yang boleh langsung menerbitkan soal
  if (status === "approved" && me.role !== "admin") {
    return NextResponse.json({ error: "Hanya admin yang bisa langsung menyetujui soal" }, { status: 403 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.json ?? "");
  } catch (e) {
    return NextResponse.json(
      { error: `JSON tidak valid: ${e instanceof Error ? e.message : "gagal diurai"}` },
      { status: 400 },
    );
  }

  const list = Array.isArray(parsed) ? parsed : [parsed];
  if (!list.length) return NextResponse.json({ error: "Tidak ada soal di dalam JSON" }, { status: 400 });
  if (list.length > 500) return NextResponse.json({ error: "Maksimal 500 soal per impor" }, { status: 400 });

  const report = validateQuestions(list, { strict: Boolean(body.strict) });

  let result = { imported: 0, replaced: 0, skipped: list.length };
  if (report.accepted.length) {
    /* Menimpa soal yang sedang dikerjakan mengubah jawaban peserta tanpa ia
     * menyentuhnya (lihat importQuestions). Penolakannya dikembalikan sebagai
     * 409 dengan pesannya utuh, supaya admin tahu attempt mana yang harus
     * ditunggu — dan bisa mengulang dengan `force` bila memang mendesak. */
    try {
      const r = await importQuestions(report.accepted, status, { force: Boolean(body.force) });
      result = { imported: r.imported, replaced: r.replaced, skipped: list.length - r.imported };
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Impor gagal" },
        { status: 409 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    status,
    ...result,
    checked: report.checked,
    blockers: report.blockers,
    majors: report.majors,
    minors: report.minors,
    findings: report.findings.slice(0, 100),
  });
}
