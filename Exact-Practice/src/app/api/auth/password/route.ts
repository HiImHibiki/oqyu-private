import { NextResponse } from "next/server";
import { currentUser, setPassword } from "@/lib/auth";
import { hapusSandiSementara } from "@/lib/practice/sandi";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });

  const { password, confirm } = await req.json();
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Kata sandi minimal 8 karakter" }, { status: 400 });
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ error: "Kata sandi harus memuat huruf dan angka" }, { status: 400 });
  }
  if (password !== confirm) {
    return NextResponse.json({ error: "Konfirmasi kata sandi tidak cocok" }, { status: 400 });
  }

  const res = await setPassword(password);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  await hapusSandiSementara(user.id).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
