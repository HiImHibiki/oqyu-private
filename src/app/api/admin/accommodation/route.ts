import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { TIME_MULTIPLIERS } from "@/lib/exams/formBuilder";

/* Menetapkan akomodasi waktu seorang peserta (1, 1.5, atau 2).
 *
 * Hanya admin penuh — bukan reviewer. Memberi waktu ganda adalah keputusan
 * yang mengubah nilai, jadi kewenangannya disamakan dengan mengubah peran.
 *
 * Attempt yang SEDANG berjalan tidak ikut berubah: durasinya sudah dibekukan
 * ke dalam `formLayout` saat attempt itu dibuat. Itu disengaja — memperpanjang
 * ujian yang sedang berlangsung akan membuat hasilnya tidak bisa dibandingkan
 * dengan hasil orang lain, dan memperpendeknya jelas lebih buruk lagi. */
export async function POST(req: Request) {
  const me = await adminOrNull();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }

  const { userId, multiplier } = await req.json();
  const m = Number(multiplier);
  if (!(TIME_MULTIPLIERS as readonly number[]).includes(m)) {
    return NextResponse.json(
      { error: `Pengali harus salah satu dari: ${TIME_MULTIPLIERS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId wajib" }, { status: 400 });
  }

  await getDb().setTimeMultiplier(userId, m);
  return NextResponse.json({ ok: true, multiplier: m });
}
