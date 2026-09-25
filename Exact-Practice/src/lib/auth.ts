import { cookies } from "next/headers";
import { devAuth } from "./db/dev";
import { usingDev } from "./db";

/* =========================================================================
 * Autentikasi — username + kata sandi (24 Sep 2026).
 *
 * Exact Practice dipakai internal untuk les privat: murid mendaftar sendiri
 * dengan nama, username, dan kata sandi, akunnya langsung aktif, lalu masuk ke
 * soal dengan kode ujian dari guru. Tidak ada email, No. HP, Google, maupun
 * persetujuan guru. Username disimpan di kolom `email` milik driver (warisan
 * Try Out) — nama kolomnya saja yang lama; isinya username.
 *
 *  Mode berkas (produksi): pengguna & sesi di <data>/db.json, cookie sendiri.
 *  Mode Supabase (warisan, tidak dipakai): masuk dengan sandi saja.
 * ========================================================================= */

export const SESSION_COOKIE = "exact_session";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  school?: string;
  country?: string;
  themeId: string;
  passwordSet: boolean;
  role: string;
  /** Akomodasi waktu: 1 (normal), 1.5, atau 2. Ditetapkan admin. */
  timeMultiplier: number;
}

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });

/* ------------------------------------------------------------- pengguna */

export async function currentUser(): Promise<CurrentUser | null> {
  if (usingDev()) {
    const jar = await cookies();
    const u = await devAuth.userByToken(jar.get(SESSION_COOKIE)?.value);
    if (!u) return null;
    return {
      id: u.id, email: u.email, fullName: u.fullName, phone: u.phone,
      school: u.school, country: u.country, themeId: u.themeId,
      passwordSet: u.passwordSet, role: u.role ?? "student",
      timeMultiplier: u.timeMultiplier ?? 1,
    };
  }

  const { createClient } = await import("./supabase/server");
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    fullName: p?.full_name ?? (data.user.user_metadata?.full_name as string) ?? "",
    phone: p?.phone ?? (data.user.user_metadata?.phone as string) ?? "",
    school: p?.school ?? undefined,
    country: p?.country ?? undefined,
    themeId: p?.theme_id ?? "porcelain",
    passwordSet: p?.password_set ?? false,
    role: p?.role ?? "student",
    timeMultiplier: Number(p?.time_multiplier ?? 1),
  };
}

/* ------------------------------------------------------------------ dev */

/** Masuk cepat untuk mode pengembangan, tempat Google tidak tersedia sama
 *  sekali karena tidak ada project Supabase. Dijaga oleh usingDev() di sini
 *  DAN oleh route-nya — jalur yang membuat sesi tanpa membuktikan apa pun
 *  pantas dijaga dua kali. */
export async function devSignIn(input: {
  email: string; fullName?: string; country?: string;
}): Promise<Result<{ userId: string; isNew: boolean }>> {
  if (!usingDev()) return fail("Masuk cepat hanya tersedia di mode pengembangan.");

  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Alamat email tidak valid");

  const existing = await devAuth.userByEmail(email);
  const u = await devAuth.upsertUser({
    email,
    fullName: input.fullName?.trim() || existing?.fullName || email.split("@")[0],
    phone: existing?.phone ?? "",
    country: input.country ?? existing?.country,
  });
  await setSessionCookie(await devAuth.createSession(u.id));
  return ok({ userId: u.id, isNew: !existing });
}

/** Username: 3–32 huruf kecil, angka, titik, garis bawah, atau tanda hubung. */
export const POLA_USERNAME = /^[a-z0-9._-]{3,32}$/;

/** Pendaftaran murid: nama + username + kata sandi, langsung aktif. Username di
 *  ADMIN_USERNAMES (atau ADMIN_EMAILS lama) langsung jadi guru/admin. */
export async function daftarMurid(input: {
  username: string; fullName: string; password: string;
}): Promise<Result<{ userId: string }>> {
  if (!usingDev()) return fail("Pendaftaran hanya tersedia di mode berkas.");
  const username = input.username.trim().toLowerCase();
  if (!POLA_USERNAME.test(username)) return fail("Username 3–32 karakter: huruf kecil, angka, titik, _ atau -");
  if (!input.fullName.trim()) return fail("Nama wajib diisi");
  if (input.password.length < 6) return fail("Kata sandi minimal 6 karakter");
  if (await devAuth.userByEmail(username)) return fail("Username sudah dipakai — pilih yang lain atau masuk.");
  const u = await devAuth.upsertUser({ email: username, fullName: input.fullName.trim(), phone: "" });
  await devAuth.setPassword(u.id, input.password);
  await setSessionCookie(await devAuth.createSession(u.id));
  return ok({ userId: u.id });
}

/* --------------------------------------------------------- Exact Canvas */

/* Murid bimbel sudah punya akun di Exact Canvas (No. HP + sandi, disetujui
 * guru). Practice menumpang identitas itu: akun lokal dibuat otomatis dengan
 * email sintetis canvas-<id>@murid.exact, jadi "Tanya guru" pun jatuh ke
 * murid yang sama di kanvas. Hanya akun yang sudah disetujui guru yang
 * diterima. */
const CANVAS = process.env.EXACT_CANVAS_URL || "http://127.0.0.1:4747";
export const emailCanvas = (id: string) => `canvas-${id.toLowerCase()}@murid.exact`;
export const idCanvasDari = (email: string) => email.match(/^canvas-([a-z0-9]+)@murid\.exact$/)?.[1] ?? null;

interface AkunCanvas { id: string; nama: string; hp: string; disetujui?: boolean; token?: string }

async function sesiUntukAkunCanvas(a: AkunCanvas): Promise<Result<{ userId: string }>> {
  if (!usingDev()) return fail("Masuk lewat Exact Canvas hanya untuk mode berkas.");
  if (!a.disetujui) return fail("Akun Exact Canvas-mu belum disetujui guru. Minta guru menerimanya di panel Class.");
  const u = await devAuth.upsertUser({ email: emailCanvas(a.id), fullName: a.nama, phone: a.hp });
  await setSessionCookie(await devAuth.createSession(u.id));
  return ok({ userId: u.id });
}

export async function masukDariCanvas(hp: string, sandi: string): Promise<Result<{ userId: string }>> {
  let r: Response;
  try {
    r = await fetch(`${CANVAS}/api/akun/masuk`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ hp, sandi }), cache: "no-store",
    });
  } catch { return fail("Exact Canvas tidak bisa dihubungi."); }
  if (!r.ok) return fail(r.status === 401 ? "No. HP atau sandi Exact Canvas salah." : (await r.text()) || "Exact Canvas menolak.");
  return sesiUntukAkunCanvas((await r.json()) as AkunCanvas);
}

export async function masukDariSesiCanvas(token: string): Promise<Result<{ userId: string }>> {
  if (!token || token.length < 16) return fail("Sesi Exact Canvas tidak valid.");
  let r: Response;
  try {
    r = await fetch(`${CANVAS}/api/akun/saya`, { headers: { "x-exact-sesi": token }, cache: "no-store" });
  } catch { return fail("Exact Canvas tidak bisa dihubungi."); }
  if (!r.ok) return fail("Sesi Exact Canvas sudah habis — masuk lagi di Exact Canvas.");
  return sesiUntukAkunCanvas((await r.json()) as AkunCanvas);
}

/* ------------------------------------------------------------ kata sandi */

export async function setPassword(password: string): Promise<Result> {
  const user = await currentUser();
  if (!user) return fail("Sesi tidak valid");

  if (usingDev()) {
    await devAuth.setPassword(user.id, password);
    return ok(undefined);
  }

  const { createClient, createAdminClient } = await import("./supabase/server");
  const sb = await createClient();
  const { error } = await sb.auth.updateUser({ password });
  if (error) return fail(error.message);
  await createAdminClient().from("profiles").update({ password_set: true }).eq("id", user.id);
  return ok(undefined);
}

export async function login(username: string, password: string): Promise<Result> {
  const target = username.trim().toLowerCase();

  if (usingDev()) {
    const u = await devAuth.login(target, password);
    if (!u) return fail("Username atau kata sandi salah");
    await setSessionCookie(await devAuth.createSession(u.id));
    return ok(undefined);
  }

  const { createClient } = await import("./supabase/server");
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({ email: target, password });
  if (error) return fail("Username atau kata sandi salah");
  return ok(undefined);
}

/** Keluarkan pengguna dari SEMUA perangkat. Mengembalikan jumlah sesi yang
 *  diakhiri (di Supabase jumlahnya tidak dilaporkan, jadi -1). */
export async function logoutEverywhere(userId: string): Promise<number> {
  if (usingDev()) {
    const n = await devAuth.dropAllSessions(userId);
    (await cookies()).delete(SESSION_COOKIE);
    return n;
  }
  const { createAdminClient } = await import("./supabase/server");
  /* `signOut(jwt, "global")` butuh token pengguna; jalur admin lebih pasti
   * karena tidak bergantung pada sesi mana yang sedang memanggil. */
  await createAdminClient().auth.admin.signOut(userId, "global").catch(() => {});
  const { createClient } = await import("./supabase/server");
  await (await createClient()).auth.signOut();
  return -1;
}

export async function logout() {
  if (usingDev()) {
    const jar = await cookies();
    await devAuth.dropSession(jar.get(SESSION_COOKIE)?.value);
    jar.delete(SESSION_COOKIE);
    return;
  }
  const { createClient } = await import("./supabase/server");
  await (await createClient()).auth.signOut();
}

export async function setTheme(userId: string, themeId: string) {
  if (usingDev()) return void (await devAuth.setTheme(userId, themeId));
  const { createAdminClient } = await import("./supabase/server");
  await createAdminClient().from("profiles").update({ theme_id: themeId }).eq("id", userId);
}

/* ---------------------------------------------------------------- cookie */

async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 3600,
  });
}
