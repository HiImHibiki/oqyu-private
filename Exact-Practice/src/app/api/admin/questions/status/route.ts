import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/adminGuard";
import { setQuestionStatus, type BankStatus, type ReviewRecord } from "@/lib/exams/bank";

const STATUSES: BankStatus[] = ["draft", "in_review", "approved", "retired"];

export async function POST(req: Request) {
  const me = await adminOrNull();
  if (!me) return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });

  const { ids, status, verdict, note } = await req.json() as {
    ids: unknown; status: BankStatus; verdict?: ReviewRecord["verdict"]; note?: string;
  };
  if (!Array.isArray(ids) || !ids.length) {
    return NextResponse.json({ error: "Tidak ada soal yang dipilih" }, { status: 400 });
  }
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: "Status tidak dikenal" }, { status: 400 });
  }
  if (status === "approved" && me.role !== "admin") {
    return NextResponse.json({ error: "Hanya admin yang bisa menyetujui soal" }, { status: 403 });
  }

  /* Mengembalikan soal tanpa alasan membuat penulisnya tidak tahu apa yang
   * harus diperbaiki, sehingga soal yang sama kembali lagi. Karena itu catatan
   * diwajibkan untuk verdict "returned". */
  let review: ReviewRecord | undefined;
  if (verdict === "correct" || verdict === "returned") {
    const text = String(note ?? "").trim().slice(0, 600);
    if (verdict === "returned" && text.length < 5) {
      return NextResponse.json(
        { error: "Tulis alasan pengembalian agar penulis tahu apa yang keliru." },
        { status: 400 },
      );
    }
    review = {
      by: me.email,
      at: new Date().toISOString(),
      verdict,
      ...(text ? { note: text } : {}),
    };
  }

  const n = await setQuestionStatus(ids.map(String).slice(0, 500), status, review);
  return NextResponse.json({ ok: true, updated: n });
}
