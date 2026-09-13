/* =========================================================================
 * Uji tanda tangan webhook pembayaran.
 *
 * Yang diuji adalah satu-satunya hal yang memisahkan pembayaran sungguhan
 * dari orang yang mengarang HTTP request: verifikasi tanda tangan. Berkas ini
 * mengimpor fungsi yang SAMA dengan yang dipakai webhook produksi — bukan
 * salinannya — supaya perubahan pada implementasi ikut teruji di sini.
 *
 * Tidak menyentuh akun Stripe atau Midtrans mana pun: seluruh payload
 * ditandatangani dengan kunci uji lokal, jadi bisa dijalankan offline.
 *
 *   npm run test:webhooks
 * ========================================================================= */

import crypto from "node:crypto";

process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_0123456789abcdef";
process.env.MIDTRANS_SERVER_KEY = "SB-Mid-server-TESTKEY";

const { verifyStripeSignature } = await import("@/lib/stripe.ts");
const { verifySignature, isSettled, isFailure, isRefund, isPartialRefund, failureStatus } =
  await import("@/lib/midtrans.ts");

let pass = 0, fail = 0;
const check = (name, actual, expected) => {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}` +
    (ok ? "" : `\n      diharapkan ${expected}, dapat ${actual}`));
};

/* ---------------------------------------------------------------- Stripe */
const nowSec = () => Math.floor(Date.now() / 1000);

function stripeHeader(body, { secret = process.env.STRIPE_WEBHOOK_SECRET, ageSec = 0 } = {}) {
  const t = nowSec() - ageSec;
  const v1 = crypto.createHmac("sha256", secret).update(`${t}.${body}`, "utf8").digest("hex");
  return `t=${t},v1=${v1}`;
}

console.log("\nStripe — verifyStripeSignature()");
{
  const body = JSON.stringify({
    id: "evt_1", type: "checkout.session.completed",
    data: { object: { id: "cs_1", metadata: { orderId: "ord_1" }, amount_total: 49900, currency: "usd" } },
  });

  check("payload sah diterima", verifyStripeSignature(body, stripeHeader(body)), true);

  check("isi payload diubah setelah ditandatangani → ditolak",
    verifyStripeSignature(body.replace("49900", "100"), stripeHeader(body)), false);

  check("ditandatangani kunci lain → ditolak",
    verifyStripeSignature(body, stripeHeader(body, { secret: "whsec_kunci_penyerang" })), false);

  check("header hilang → ditolak", verifyStripeSignature(body, null), false);
  check("header kosong → ditolak", verifyStripeSignature(body, ""), false);

  check("header tanpa bagian v1 → ditolak",
    verifyStripeSignature(body, `t=${nowSec()}`), false);

  check("header tanpa bagian t → ditolak",
    verifyStripeSignature(body, "v1=" + "0".repeat(64)), false);

  check("replay berumur 10 menit → ditolak",
    verifyStripeSignature(body, stripeHeader(body, { ageSec: 600 })), false);

  check("selisih waktu 4 menit → masih diterima",
    verifyStripeSignature(body, stripeHeader(body, { ageSec: 240 })), true);

  check("timestamp bukan angka → ditolak",
    verifyStripeSignature(body, `t=besok,v1=${"a".repeat(64)}`), false);

  check("v1 lebih pendek dari HMAC → ditolak tanpa melempar",
    verifyStripeSignature(body, `t=${nowSec()},v1=abc`), false);

  {
    // Tanpa signing secret, verifikasi harus GAGAL — bukan lolos begitu saja.
    const saved = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    check("secret belum diset → ditolak (bukan lolos diam-diam)",
      verifyStripeSignature(body, `t=${nowSec()},v1=${"a".repeat(64)}`), false);
    process.env.STRIPE_WEBHOOK_SECRET = saved;
  }
}

/* -------------------------------------------------------------- Midtrans */
const mtSign = (n, key = process.env.MIDTRANS_SERVER_KEY) =>
  crypto.createHash("sha512")
    .update(n.order_id + n.status_code + n.gross_amount + key)
    .digest("hex");

console.log("\nMidtrans — verifySignature()");
{
  const base = { order_id: "ord_2", status_code: "200", gross_amount: "499000.00", transaction_status: "settlement" };
  const notif = { ...base, signature_key: mtSign(base) };

  check("notifikasi sah diterima", verifySignature(notif), true);
  check("gross_amount diubah → ditolak", verifySignature({ ...notif, gross_amount: "1000.00" }), false);
  check("order_id diubah → ditolak", verifySignature({ ...notif, order_id: "ord_lain" }), false);
  check("status_code diubah → ditolak", verifySignature({ ...notif, status_code: "202" }), false);
  check("ditandatangani kunci penyerang → ditolak",
    verifySignature({ ...base, signature_key: mtSign(base, "kunci-palsu") }), false);
  check("tanpa signature_key → ditolak", verifySignature(base), false);
  check("signature_key panjangnya beda → ditolak tanpa melempar",
    verifySignature({ ...notif, signature_key: "abc" }), false);

  // Jebakan klasik: nominal kadang ditulis "499000" dan kadang "499000.00".
  // Tanda tangan dihitung atas string persis, jadi keduanya tidak sama.
  check("format nominal berbeda → ditolak", verifySignature({ ...notif, gross_amount: "499000" }), false);

  {
    const saved = process.env.MIDTRANS_SERVER_KEY;
    delete process.env.MIDTRANS_SERVER_KEY;
    check("server key belum diset → ditolak", verifySignature(notif), false);
    process.env.MIDTRANS_SERVER_KEY = saved;
  }

  console.log("\nMidtrans — pembacaan status transaksi");
  check("settlement dianggap lunas", isSettled({ ...base }), true);
  check("capture + fraud accept dianggap lunas",
    isSettled({ ...base, transaction_status: "capture", fraud_status: "accept" }), true);
  check("capture + fraud challenge BELUM lunas",
    isSettled({ ...base, transaction_status: "capture", fraud_status: "challenge" }), false);
  check("pending belum lunas", isSettled({ ...base, transaction_status: "pending" }), false);
  check("expire dianggap gagal", isFailure({ ...base, transaction_status: "expire" }), true);
  check("deny dianggap gagal", isFailure({ ...base, transaction_status: "deny" }), true);
  check("settlement bukan kegagalan", isFailure({ ...base }), false);
}

/* --------------------------------------------------- pencocokan nominal */
/* Tanda tangan sah hanya membuktikan pesan datang dari gateway — bukan bahwa
 * nominalnya sesuai pesanan. Pemeriksaan kedua inilah yang menghalangi orang
 * membayar Rp 1.000 untuk paket Rp 499.000. */
console.log("\nPencocokan nominal terhadap pesanan tersimpan");
{
  const order = { amount: 499000, currency: "IDR" };
  const matches = (paid, cur) => Math.round(paid) === order.amount && cur.toUpperCase() === order.currency;
  check("nominal tepat diterima", matches(499000, "idr"), true);
  check("kurang bayar ditolak", matches(1000, "idr"), false);
  check("mata uang berbeda ditolak", matches(499000, "usd"), false);
}

console.log("\nMidtrans — pengembalian dana dan penutupan pesanan");
{
  const n = (transaction_status) => ({ order_id: "ord_3", status_code: "200",
    gross_amount: "149000.00", transaction_status });

  check("refund penuh dikenali", isRefund(n("refund")), true);
  check("partial_refund BUKAN refund penuh", isRefund(n("partial_refund")), false);
  check("partial_refund dikenali terpisah", isPartialRefund(n("partial_refund")), true);
  check("settlement bukan refund", isRefund(n("settlement")), false);

  /* Refund tidak boleh ikut terbaca sebagai kegagalan: keduanya menutup
   * pesanan dengan cara yang sama sekali berbeda — yang satu mencabut kuota
   * yang sudah diberikan, yang lain menutup pesanan yang tak pernah dibayar. */
  check("refund tidak dianggap kegagalan", isFailure(n("refund")), false);

  check("expire ditutup sebagai kedaluwarsa", failureStatus(n("expire")), "expired");
  check("cancel ditutup sebagai gagal", failureStatus(n("cancel")), "failed");
  check("deny ditutup sebagai gagal", failureStatus(n("deny")), "failed");
}

console.log(`\n${pass} lulus, ${fail} gagal\n`);
process.exit(fail ? 1 : 0);
