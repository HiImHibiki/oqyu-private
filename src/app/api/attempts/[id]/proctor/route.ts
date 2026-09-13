import { NextResponse } from "next/server";
import { loadAttempt } from "@/lib/exams/attempt";
import { usingDev } from "@/lib/db";

const ALLOWED = new Set([
  "blur", "fullscreen_exit", "copy", "cut", "paste", "contextmenu",
  "print", "devtools", "shortcut", "offline",
]);

/** Catatan pengawasan. Sengaja dipisah dari /save supaya kegagalan mencatat
 *  event tidak pernah mengganggu penyimpanan jawaban. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await loadAttempt(id);
  if ("error" in res) return NextResponse.json({ ok: false }, { status: 204 });

  const { type, detail } = (await req.json()) as { type?: string; detail?: string };
  if (!type || !ALLOWED.has(type)) return NextResponse.json({ ok: false }, { status: 400 });

  if (!usingDev()) {
    const { createAdminClient } = await import("@/lib/supabase/server");
    await createAdminClient()
      .from("proctor_events")
      .insert({ attempt_id: id, type, detail: detail?.slice(0, 200) ?? null })
      .then(({ error }) => { if (error) console.error("proctor_events:", error.message); });
  }
  // Di mode pengembangan, ringkasannya tetap ikut terkirim bersama submit.

  return NextResponse.json({ ok: true });
}
