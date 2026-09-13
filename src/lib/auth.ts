import { cookies } from "next/headers";
import { devAuth } from "./db/dev";
import { usingDev } from "./db";

/* =========================================================================
 * Autentikasi.
 *
 * SATU cara masuk untuk peserta: Google. Tidak ada OTP, tidak ada kata sandi
 * yang harus dibuat, tidak ada formulir pendaftaran. Alasannya sederhana —
 * setiap langkah tambahan antara «mau coba» dan «sudah masuk» adalah tempat
 * orang berhenti, dan alur lama punya empat langkah sebelum peserta melihat
 * dasbornya sekali pun.
 *
 * Kata sandi TIDAK dihapus: /admin/masuk masih memakainya. Itu disengaja.
 * Kalau OAuth Google bermasalah — kunci klien kedaluwarsa, domain belum
 * diizinkan, akun Google tim terkunci — tim operasional tetap harus bisa
 * masuk untuk mengonfirmasi pembayaran orang lain.
 *
 *  Supabase (produksi) : Supabase Auth, provider Google.
 *  Dev (tanpa env)     : pengguna dan sesi di .data/db.json; masuk cepat lewat
 *                        /api/auth/dev-login tanpa Google sama sekali.
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

/** Email di ADMIN_EMAILS langsung berperan admin begitu akunnya ada — cara
 *  membuat admin pertama tanpa menyentuh basis data. Jalur dev sudah
 *  melakukannya sendiri di devAuth.upsertUser(). */
const bootstrapAdmin = (email: string) =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
    .includes(email.trim().toLowerCase());

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

/* --------------------------------------------------------------- Google */

/** Alamat halaman izin Google. Sesi BELUM terbentuk di sini — yang terjadi
 *  hanyalah Supabase menyiapkan PKCE verifier di cookie lalu memberi tahu ke
 *  mana peramban harus pergi. Sesinya lahir di completeGoogleSignIn(). */
export async function googleAuthUrl(redirectTo: string): Promise<Result<{ url: string }>> {
  if (usingDev()) {
    return fail("Supabase belum dikonfigurasi, jadi masuk lewat Google belum bisa dipakai.");
  }

  const { createClient } = await import("./supabase/server");
  const sb = await createClient();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      /* Memaksa pemilih akun. Tanpa ini, orang yang punya dua akun Google
       * di satu peramban selalu masuk dengan yang pertama tanpa pernah
       * ditanya — dan baru sadar setelah melihat dasbor orang lain. */
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) return fail(error?.message ?? "Gagal memulai masuk lewat Google");
  return ok({ url: data.url });
}

/** Menukar `code` dari Google menjadi sesi, lalu memastikan profilnya lengkap.
 *
 *  Profil dibuat oleh trigger handle_new_user() saat baris auth.users lahir,
 *  jadi tugas di sini hanya melengkapi yang tidak diketahui trigger itu:
 *  bahasa antarmuka, negara (yang menentukan mata uang), dan nama bila Google
 *  mengirimkannya lewat `name` alih-alih `full_name`. */
export async function completeGoogleSignIn(
  code: string,
  hints: { country?: string; locale?: string } = {},
): Promise<Result<{ userId: string; email: string; isNew: boolean }>> {
  if (usingDev()) return fail("Supabase belum dikonfigurasi.");

  const { createClient, createAdminClient } = await import("./supabase/server");
  const sb = await createClient();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail(error?.message ?? "Sesi Google tidak bisa dibuka");

  const user = data.user;
  const email = (user.email ?? "").toLowerCase();
  const admin = createAdminClient();

  const { data: p } = await admin
    .from("profiles")
    .select("full_name,country,locale,role,onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  /* «Baru» di sini berarti belum pernah menyelesaikan satu putaran masuk pun,
   * bukan «barusan dibuat»: orang yang mendarat di sini dua kali karena
   * jaringannya putus tidak boleh diperlakukan sebagai pendaftar baru. */
  const isNew = !p?.onboarded_at;

  const meta = user.user_metadata ?? {};
  const nameFromGoogle = (meta.full_name as string) || (meta.name as string) || "";

  const patch: Record<string, unknown> = { onboarded_at: p?.onboarded_at ?? new Date().toISOString() };
  if (!p?.full_name && nameFromGoogle) patch.full_name = nameFromGoogle;
  if (!p?.country && hints.country) patch.country = hints.country;
  if (!p?.locale && hints.locale) patch.locale = hints.locale;
  if (bootstrapAdmin(email) && (p?.role ?? "student") === "student") patch.role = "admin";

  await admin.from("profiles").update(patch).eq("id", user.id);

  return ok({ userId: user.id, email, isNew });
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

/** Pendaftaran murid Exact Practice: email + nama + kata sandi, dijaga kode
 *  kelas dari guru (EXACT_KODE_KELAS). Tanpa Supabase tidak ada Google, dan
 *  murid bimbel tidak perlu OAuth — cukup akun lokal di berkas. */
export async function daftarMurid(input: {
  email: string; fullName: string; password: string; kode: string;
}): Promise<Result<{ userId: string }>> {
  if (!usingDev()) return fail("Pendaftaran lokal hanya untuk mode berkas.");
  const kodeKelas = (process.env.EXACT_KODE_KELAS ?? "").trim();
  if (!kodeKelas) return fail("Pendaftaran belum dibuka: EXACT_KODE_KELAS belum diatur di server.");
  if (input.kode.trim().toLowerCase() !== kodeKelas.toLowerCase()) return fail("Kode kelas salah. Minta kode ke guru.");
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Alamat email tidak valid");
  if (!input.fullName.trim()) return fail("Nama wajib diisi");
  if (input.password.length < 6) return fail("Kata sandi minimal 6 karakter");
  if (await devAuth.userByEmail(email)) return fail("Email ini sudah terdaftar — silakan masuk.");
  const u = await devAuth.upsertUser({ email, fullName: input.fullName.trim(), phone: "" });
  await devAuth.setPassword(u.id, input.password);
  await setSessionCookie(await devAuth.createSession(u.id));
  return ok({ userId: u.id });
}

/* ------------------------------------------------------------ kata sandi */

/* Hanya untuk jalur admin. Peserta tidak pernah melihat layar kata sandi. */

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

export async function login(email: string, password: string): Promise<Result> {
  const target = email.trim().toLowerCase();

  if (usingDev()) {
    const u = await devAuth.login(target, password);
    if (!u) return fail("Email atau kata sandi salah");
    await setSessionCookie(await devAuth.createSession(u.id));
    return ok(undefined);
  }

  const { createClient } = await import("./supabase/server");
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({ email: target, password });
  if (error) return fail("Email atau kata sandi salah");
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
