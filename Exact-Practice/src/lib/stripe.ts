import crypto from "crypto";
import { toMinorUnits, type Currency } from "@/lib/geo";

/* =========================================================================
 * Stripe Checkout — jalur pembayaran internasional.
 *
 * Midtrans hanya melayani rupiah dengan metode lokal Indonesia (VA, QRIS,
 * GoPay). Peserta SAT di Nigeria atau CSCA di Kazakhstan tidak bisa memakainya
 * sama sekali, jadi setiap mata uang selain IDR dirutekan ke Stripe.
 *
 * Dipanggil lewat REST, bukan SDK, agar konsisten dengan integrasi Midtrans
 * yang sudah ada dan tidak menambah dependensi.
 * ========================================================================= */

export const stripeEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);

const API = "https://api.stripe.com/v1";

function auth() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY belum diisi di .env.local");
  return `Bearer ${key}`;
}

/** Stripe menerima application/x-www-form-urlencoded dengan kunci bersarang. */
function form(obj: Record<string, string | number | undefined>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) body.append(k, String(v));
  return body;
}

export interface CheckoutParams {
  orderId: string;
  amount: number;
  currency: Currency;
  itemName: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(p: CheckoutParams) {
  const res = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: {
      authorization: auth(),
      "content-type": "application/x-www-form-urlencoded",
      // Mencegah sesi ganda kalau pengguna menekan tombol bayar dua kali.
      "idempotency-key": `checkout_${p.orderId}`,
    },
    body: form({
      mode: "payment",
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": p.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": toMinorUnits(p.amount, p.currency),
      "line_items[0][price_data][product_data][name]": p.itemName.slice(0, 250),
      customer_email: p.customerEmail,
      client_reference_id: p.orderId,
      "metadata[order_id]": p.orderId,
      // Nominal ikut ditanam di metadata supaya webhook bisa memverifikasinya
      // tanpa memercayai angka yang dikirim balik.
      "metadata[amount]": String(p.amount),
      "metadata[currency]": p.currency,
      /* Metadata sesi TIDAK ikut turun ke charge, sedangkan event
       * `charge.refunded` hanya membawa charge. Tanpa baris ini, refund yang
       * dilakukan dari dasbor Stripe tidak dapat dipetakan kembali ke pesanan
       * mana pun, dan webhook hanya bisa mencatat bahwa ada refund entah untuk
       * siapa. */
      "payment_intent_data[metadata][order_id]": p.orderId,
      success_url: p.successUrl,
      cancel_url: p.cancelUrl,
    }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`Stripe Checkout gagal: ${body?.error?.message ?? res.status}`);
  return { id: body.id as string, url: body.url as string };
}

/* ---------------------------------------------------------------- webhook */

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

/** Verifikasi tanda tangan webhook Stripe.
 *
 *  Header `stripe-signature` berisi `t=<timestamp>,v1=<hmac>`; HMAC dihitung
 *  atas `"<timestamp>.<raw body>"` memakai signing secret. Tanpa langkah ini,
 *  siapa pun bisa mengirim notifikasi palsu dan memperoleh kuota gratis. */
export function verifyStripeSignature(rawBody: string, header: string | null, toleranceSec = 300) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;

  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, ...rest] = kv.split("=");
      return [k.trim(), rest.join("=")];
    }),
  ) as { t?: string; v1?: string };

  if (!parts.t || !parts.v1) return false;

  // Menolak notifikasi lama menutup celah replay attack.
  const age = Math.abs(Date.now() / 1000 - Number(parts.t));
  if (!Number.isFinite(age) || age > toleranceSec) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parts.t}.${rawBody}`, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(parts.v1, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function retrieveSession(sessionId: string) {
  const res = await fetch(`${API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { authorization: auth() },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Stripe retrieve gagal: ${body?.error?.message ?? res.status}`);
  return body as Record<string, unknown>;
}
