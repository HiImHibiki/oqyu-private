/* =========================================================================
 * Menutup pesanan yang menggantung.
 *
 * Pesanan berstatus `pending` yang tidak pernah dibayar akan tetap `pending`
 * selamanya kecuali gateway mengabarkan sebaliknya. Selama itu ia muncul di
 * dashboard peserta sebagai «pembayaran belum selesai», lengkap dengan tombol
 * yang mengajak menyelesaikannya.
 *
 * Dua jalur menutupnya, dan hanya yang pertama yang otomatis:
 *
 *   webhook — Midtrans mengirim `expire`/`cancel`/`deny`, Stripe mengirim
 *             `checkout.session.expired`. Ini KESIMPULAN: gateway sendiri
 *             yang menyatakan sesinya mati. Ditangani langsung oleh webhook.
 *
 *   skrip   — pesanan yang lebih tua dari N hari dan masih `pending`. Ini
 *             KEPUTUSAN, bukan kesimpulan, dan sengaja tidak otomatis.
 *             Alasannya: tombol «Lanjutkan pembayaran» di /paket membuat sesi
 *             gateway BARU setiap kali ditekan, jadi pesanan lama secara
 *             teknis masih bisa dibayar. Menutupnya adalah pilihan kerapian —
 *             yang berhak diambil pemilik toko, bukan oleh sebuah cron yang
 *             diam-diam berjalan.
 *
 *   node --experimental-strip-types --import ./scripts/alias-register.mjs \
 *     scripts/close-stale-orders.mjs                  # laporan saja
 *   … scripts/close-stale-orders.mjs --days 30        # laporan, ambang lain
 *   … scripts/close-stale-orders.mjs --days 30 --write
 * ========================================================================= */

import { getDb } from "@/lib/db";

const argv = process.argv.slice(2);
const WRITE = argv.includes("--write");
const daysIdx = argv.indexOf("--days");
const DAYS = daysIdx > -1 ? Number(argv[daysIdx + 1]) : 14;

if (!Number.isFinite(DAYS) || DAYS < 1) {
  console.error("--days harus berupa angka minimal 1");
  process.exit(2);
}

const db = getDb();
const orders = await db.listOrders(1000);
const now = Date.now();

const stale = orders
  .filter((o) => o.status === "pending")
  .map((o) => ({ o, days: Math.floor((now - new Date(o.createdAt).getTime()) / 864e5) }))
  .filter((x) => x.days >= DAYS)
  .sort((a, b) => b.days - a.days);

const pending = orders.filter((o) => o.status === "pending").length;
console.log(`pesanan pending : ${pending}`);
console.log(`lebih tua dari ${DAYS} hari : ${stale.length}`);

if (!stale.length) {
  console.log("\nTidak ada yang perlu ditutup.");
  process.exit(0);
}

console.log("");
for (const { o, days } of stale.slice(0, 20)) {
  console.log(`  ${String(days).padStart(4)} hari  ${o.provider.padEnd(11)} ${o.packageId.padEnd(16)} ${o.email ?? o.userId}`);
}
if (stale.length > 20) console.log(`  … dan ${stale.length - 20} lagi`);

if (!WRITE) {
  console.log("\nLaporan saja — jalankan dengan --write untuk menutupnya.");
  process.exit(0);
}

let closed = 0;
for (const { o } of stale) {
  const after = await db.setOrderStatus(o.id, "expired");
  if (after?.status === "expired") closed++;
}
console.log(`\n${closed} pesanan ditutup sebagai kedaluwarsa.`);
