import { cookies } from "next/headers";
import crypto from "crypto";

/* Aturan program afiliasi — satu tempat, supaya angka tidak tersebar. */

export const AFFILIATE = {
  /** komisi default untuk afiliasi baru */
  defaultRate: 0.15,
  /** batas minimum pencairan */
  minPayoutIdr: 100_000,
  /** berapa lama cookie rujukan bertahan */
  cookieDays: 30,
  /** komisi menunggu selama masa refund sebelum bisa disetujui */
  holdDays: 14,
  /** kuota bonus untuk pendaftar yang datang lewat tautan afiliasi */
  refereeBonusAttempts: 1,
} as const;

export const REF_COOKIE = "exact_ref";

/** Kode 8 karakter tanpa huruf/angka yang mudah tertukar (0/O, 1/I). */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode(seedName = ""): string {
  const prefix = seedName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3)
    .padEnd(3, "X");
  let tail = "";
  const bytes = crypto.randomBytes(5);
  for (let i = 0; i < 5; i++) tail += ALPHABET[bytes[i] % ALPHABET.length];
  return prefix + tail;
}

export const normalizeCode = (c: string) => c.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);

export function commissionFor(amountIdr: number, rate: number) {
  return Math.max(0, Math.round(amountIdr * rate));
}

/** Tautan yang dibagikan afiliasi. */
export function referralUrl(code: string, packageId?: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${base}/r/${code}${packageId ? `?paket=${packageId}` : ""}`;
}

/* ------------------------------------------------------------- cookie */

export async function setRefCookie(code: string) {
  const jar = await cookies();
  jar.set(REF_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: AFFILIATE.cookieDays * 24 * 3600,
  });
}

export async function readRefCookie(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(REF_COOKIE)?.value;
  return v ? normalizeCode(v) : null;
}

export async function clearRefCookie() {
  const jar = await cookies();
  jar.delete(REF_COOKIE);
}

/** Komisi baru boleh disetujui setelah masa tahan lewat. */
export function isReleasable(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() >= AFFILIATE.holdDays * 864e5;
}
