/* =========================================================================
 * Transfer bank manual.
 *
 * Jalur pembayaran paling sederhana yang ada: pembeli mentransfer ke rekening
 * Exact, menyebut kode pesanannya, lalu mengabari admin lewat WhatsApp. Admin
 * mencocokkan mutasi rekening dengan kode itu dan menekan «Tandai lunas» di
 * /admin/pesanan — dari sana alurnya sama persis dengan pembayaran gateway,
 * karena keduanya berakhir di fulfillOrder().
 *
 * Nomor rekening dan kontak admin diambil dari environment, bukan ditulis di
 * kode: ganti bank atau ganti nomor WhatsApp tidak boleh menuntut deploy ulang
 * yang mengubah kode. Semuanya NEXT_PUBLIC_ karena memang harus tampil di
 * layar pembeli — tidak ada rahasia di sini.
 * ========================================================================= */

export interface ManualPaymentConfig {
  bank: string;
  accountNumber: string;
  accountHolder: string;
  /** Nomor WhatsApp admin dalam format bebas; dinormalkan saat membuat tautan. */
  whatsapp: string;
  email: string;
}

export const MANUAL_PAYMENT: ManualPaymentConfig = {
  bank: process.env.NEXT_PUBLIC_BANK_NAME ?? "",
  accountNumber: process.env.NEXT_PUBLIC_BANK_ACCOUNT ?? "",
  accountHolder: process.env.NEXT_PUBLIC_BANK_HOLDER ?? "",
  whatsapp: process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ?? "",
  email: process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "",
};

/** Transfer manual hanya ditawarkan bila rekeningnya benar-benar diisi —
 *  menampilkan kolom rekening kosong lebih buruk daripada tidak menampilkannya. */
export const manualPaymentEnabled = () =>
  Boolean(MANUAL_PAYMENT.bank && MANUAL_PAYMENT.accountNumber);

/** Ada cara menghubungi admin? Dipakai untuk memutuskan apakah tombol
 *  «Hubungi admin» pantas ditampilkan. */
export const adminContactEnabled = () =>
  Boolean(MANUAL_PAYMENT.whatsapp || MANUAL_PAYMENT.email);

/* Kode pesanan yang disebut pembeli saat transfer.
 *
 * UUID penuh terlalu panjang untuk ditulis di berita transfer — bank Indonesia
 * umumnya membatasi beritanya sekitar 20 karakter. Delapan karakter pertama
 * dari UUID sudah cukup unik untuk dicocokkan manual, dan admin selalu bisa
 * memastikan lewat nominal serta nama pengirim. */
export const orderRef = (orderId: string) =>
  `EX-${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

/** Mencocokkan kode yang diketik admin dengan sebuah pesanan. */
export const matchesOrderRef = (orderId: string, typed: string) =>
  orderRef(orderId) === `EX-${typed.trim().replace(/^EX-/i, "").replace(/-/g, "").slice(0, 8).toUpperCase()}`;

/** wa.me menuntut nomor tanpa +, spasi, atau tanda hubung. */
const waDigits = (raw: string) => raw.replace(/\D/g, "");

export function whatsappUrl(message: string) {
  const n = waDigits(MANUAL_PAYMENT.whatsapp);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

export function mailtoUrl(subject: string, body: string) {
  if (!MANUAL_PAYMENT.email) return null;
  return `mailto:${MANUAL_PAYMENT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Pesan siap-kirim untuk admin. Berisi persis yang dibutuhkan untuk
 *  mencocokkan: kode pesanan, paket, dan nominal. */
export function confirmationMessage(input: {
  ref: string; packageName: string; amount: string; name?: string;
}) {
  return [
    "Halo Admin Exact Practice,",
    "",
    `Saya sudah transfer untuk pesanan ${input.ref}.`,
    `Paket : ${input.packageName}`,
    `Nominal: ${input.amount}`,
    input.name ? `Nama  : ${input.name}` : "",
    "",
    "Bukti transfer saya lampirkan di chat ini. Mohon diaktifkan, terima kasih.",
  ].filter(Boolean).join("\n");
}
