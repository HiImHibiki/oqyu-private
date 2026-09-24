import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getBlueprint } from "@/lib/exams/blueprints";
import type { ExamCode } from "@/lib/types";

export async function GET(req: Request) {
  const exam = (new URL(req.url).searchParams.get("exam") ?? "SAT") as ExamCode;
  if (!getBlueprint(exam)) return NextResponse.json({ error: "Ujian tidak dikenal" }, { status: 400 });
  return NextResponse.json({ rows: await getDb().leaderboard(exam) });
}
