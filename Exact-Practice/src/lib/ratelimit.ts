/* Pembatas laju sederhana berbasis memori proses.
 *
 * Cukup untuk satu instance dan untuk menahan penyalahgunaan kasar
 * (membombardir email orang lain dengan OTP, menebak kata sandi).
 * Untuk beberapa instance di Vercel, ganti dengan Upstash Redis —
 * antarmuka fungsinya sengaja dibuat sama supaya penggantiannya satu file. */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export interface LimitResult { ok: boolean; retryAfterSec: number; remaining: number }

export function rateLimit(key: string, max: number, windowSec: number): LimitResult {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { ok: true, retryAfterSec: 0, remaining: max - 1 };
  }

  b.count++;
  if (b.count > max) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000), remaining: 0 };
  }
  return { ok: true, retryAfterSec: 0, remaining: max - b.count };
}

/** Bersihkan bucket kedaluwarsa sesekali supaya memori tidak tumbuh terus. */
export function sweep() {
  const now = Date.now();
  for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}
