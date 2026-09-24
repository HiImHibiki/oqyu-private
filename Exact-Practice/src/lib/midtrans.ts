import crypto from "crypto";

/* Integrasi Midtrans Snap.
 * Aktif hanya bila MIDTRANS_SERVER_KEY terisi; kalau tidak, aplikasi memakai
 * jalur simulasi di /api/checkout/pay. */

export const midtransEnabled = () => Boolean(process.env.MIDTRANS_SERVER_KEY);

const isProd = () => process.env.MIDTRANS_IS_PRODUCTION === "true";
const snapBase = () =>
  isProd() ? "https://app.midtrans.com/snap/v1" : "https://app.sandbox.midtrans.com/snap/v1";

const authHeader = () =>
  "Basic " + Buffer.from(`${process.env.MIDTRANS_SERVER_KEY}:`).toString("base64");

export interface SnapParams {
  orderId: string;
  amount: number;
  itemName: string;
  customer: { firstName: string; email: string; phone: string };
  finishUrl?: string;
}

export async function createSnapTransaction(p: SnapParams) {
  const res = await fetch(`${snapBase()}/transactions`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: authHeader(),
    },
    body: JSON.stringify({
      transaction_details: { order_id: p.orderId, gross_amount: p.amount },
      item_details: [{ id: p.orderId, price: p.amount, quantity: 1, name: p.itemName.slice(0, 50) }],
      customer_details: {
        first_name: p.customer.firstName.slice(0, 40),
        email: p.customer.email,
        phone: p.customer.phone,
      },
      credit_card: { secure: true },
      callbacks: p.finishUrl ? { finish: p.finishUrl } : undefined,
      expiry: { unit: "hours", duration: 24 },
    }),
  });

  const body = (await res.json()) as { token?: string; redirect_url?: string; error_messages?: string[] };
  if (!res.ok || !body.token) {
    throw new Error(`Midtrans Snap gagal: ${body.error_messages?.join("; ") ?? res.status}`);
  }
  return { token: body.token, redirectUrl: body.redirect_url! };
}

export interface MidtransNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  transaction_id?: string;
  payment_type?: string;
}

/** Verifikasi tanda tangan. Tanpa ini, siapa pun bisa mengirim notifikasi palsu
 *  ke webhook dan mendapatkan kuota gratis. */
export function verifySignature(n: MidtransNotification): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return false;
  const expected = crypto
    .createHash("sha512")
    .update(n.order_id + n.status_code + n.gross_amount + serverKey)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(n.signature_key ?? ""), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Apakah notifikasi ini berarti "uang sudah masuk". */
export function isSettled(n: MidtransNotification): boolean {
  const s = n.transaction_status;
  if (s === "settlement") return true;
  if (s === "capture") return n.fraud_status !== "challenge" && n.fraud_status !== "deny";
  return false;
}

export function isFailure(n: MidtransNotification): boolean {
  return ["deny", "cancel", "expire", "failure"].includes(n.transaction_status);
}

/** Pengembalian dana penuh. `partial_refund` sengaja TIDAK termasuk: berapa
 *  try out yang setara dengan sebagian uang adalah keputusan manusia, bukan
 *  aturan yang pantas dikarang di kode. */
export function isRefund(n: MidtransNotification): boolean {
  return n.transaction_status === "refund";
}

export const isPartialRefund = (n: MidtransNotification) =>
  n.transaction_status === "partial_refund";

/** Status pesanan yang sepadan dengan notifikasi kegagalan.
 *  Dibedakan supaya panel admin bisa memisahkan «pembeli membatalkan» dari
 *  «virtual account keburu mati». */
export const failureStatus = (n: MidtransNotification): "expired" | "failed" =>
  n.transaction_status === "expire" ? "expired" : "failed";
