import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { composeDemoLayout, composeLayout, normalizeMultiplier, seenQuestionIds } from "@/lib/exams/formBuilder";
import crypto from "crypto";
import { getBlueprint } from "@/lib/exams/blueprints";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import type { ExamCode } from "@/lib/types";

/** Mulai attempt baru. body: { exam, isDemo } */
export async function POST(req: Request) {
  const { exam, isDemo } = (await req.json()) as { exam: ExamCode; isDemo?: boolean };
  const bp = getBlueprint(exam);
  if (!bp) return NextResponse.json({ error: "Ujian tidak dikenal" }, { status: 400 });

  const user = await currentUser();
  const demo = Boolean(isDemo);
  if (!demo && !user) return NextResponse.json({ error: "Perlu masuk" }, { status: 401 });

  if (demo) {
    const l = rateLimit(`demo:${clientIp(req)}`, 5, 3600);
    if (!l.ok) {
      return NextResponse.json(
        { error: "Batas demo tercapai. Daftar untuk paket lengkap." },
        { status: 429 },
      );
    }
  }

  // Susunan paket dipilih sekali di sini lalu dibekukan bersama attempt.
  // `seed` membuat urutan soal berbeda antar peserta tetapi tetap sama
  // setiap kali paket itu dibangun ulang untuk dinilai.
  const seed = crypto.randomUUID();

  /* Akomodasi waktu diambil dari profil peserta di server, tidak pernah dari
   * badan permintaan: kalau browser boleh menyebut pengalinya sendiri, siapa
   * pun bisa meminta waktu ganda. Demo selalu berdurasi normal. */
  const timeMultiplier = demo ? 1 : normalizeMultiplier(user?.timeMultiplier);

  /* Soal yang sudah pernah dilihat peserta ini, dikumpulkan dari seluruh
   * attempt sebelumnya — termasuk yang masih berjalan, supaya dua paket yang
   * hidup bersamaan tidak berbagi soal. Paket demo tidak ikut: pesertanya bisa
   * saja tamu, dan sepuluh soal demo tidak layak menghanguskan bank. */
  const seen = demo || !user
    ? undefined
    : (await getDb().attemptsOf(user.id))
        .filter((a) => !a.isDemo)
        .flatMap((a) => seenQuestionIds(a.formLayout, a.routing));

  const layout = demo
    ? await composeDemoLayout(exam, seed)
    : await composeLayout(exam, seed, timeMultiplier, seen);
  if (!layout.length) {
    return NextResponse.json(
      { error: "Bank soal untuk ujian ini belum tersedia. Impor soal lebih dulu di /admin/soal." },
      { status: 503 },
    );
  }

  try {
    const attempt = await getDb().createAttempt({
      userId: user?.id ?? "guest",
      exam,
      formTitle: demo ? `Demo ${bp.name}` : bp.name,
      isDemo: demo,
      formLayout: layout,
      timeMultiplier,
    });
    return NextResponse.json({ attemptId: attempt.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memulai try out";
    const status = msg.includes("Kuota") ? 402 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
