import { NextResponse } from "next/server";
import { currentUser, setTheme } from "@/lib/auth";
import { THEMES } from "@/lib/themes";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false });

  const { theme_id } = await req.json();
  if (!THEMES.some((t) => t.id === theme_id)) {
    return NextResponse.json({ error: "Tema tidak dikenal" }, { status: 400 });
  }

  await setTheme(user.id, String(theme_id));
  return NextResponse.json({ ok: true });
}
