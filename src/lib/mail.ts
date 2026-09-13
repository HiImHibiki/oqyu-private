/* Pengiriman email.
 * - Kalau RESEND_API_KEY diisi  -> kirim lewat Resend.
 * - Kalau tidak                 -> tulis ke console dan kembalikan kodenya
 *   supaya alur OTP tetap bisa diuji saat pengembangan. */

import { translate, type Locale } from "@/lib/i18n/dictionaries";

const FROM = process.env.EMAIL_FROM || "Exact Try Out <onboarding@resend.dev>";

/* Surat transaksional mengikuti bahasa yang dipilih pembeli, bukan bahasa
 * pemilik toko. Aplikasi ini menjual SAT ke Nigeria dan CSCA ke Kazakhstan;
 * struk berbahasa Indonesia yang dikirim ke sana adalah pesan bahwa
 * pembelinya tidak benar-benar diperhitungkan.
 *
 * Surat OTP tidak ada di sini: di produksi ia dikirim Supabase dengan
 * templatenya sendiri, dan bahasanya diatur di dasbor Supabase. */
const shell = (title: string, inner: string) => `
  <div style="font-family:Inter,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1c1a">
    <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#6b6f6b;margin:0 0 6px">Exact Try Out</p>
    <h1 style="font-size:22px;margin:0 0 14px">${escapeHtml(title)}</h1>
    ${inner}
  </div>`;

const para = (text: string, muted = false) =>
  `<p style="line-height:1.6${muted ? ";color:#6b6f6b" : ""}">${escapeHtml(text)}</p>`;

/** Ganti setiap rentetan 4 angka atau lebih dengan tanda bintang. Dipakai
 *  sebelum menulis apa pun ke log: kode OTP, nomor pesanan, dan nominal tidak
 *  perlu tersimpan di sana untuk membuat pesannya berguna. */
const redactDigits = (text: string) => text.replace(/\d{4,}/g, "****");

export async function sendMail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    /* Di produksi ini bukan lagi kenyamanan pengembangan melainkan kegagalan
     * diam: kuitansi, kode aktivasi, dan pemberitahuan refund tidak pernah
     * sampai, sementara log biasa mudah terlewat. Karena itu dicatat sebagai
     * error, bukan info — dan isi surelnya TIDAK ikut dicetak, sebab kode OTP
     * yang tertulis di log server sama saja dengan kunci yang tergeletak. */
    if (process.env.NODE_ENV === "production") {
      /* Subjeknya disensor lebih dulu: subjek OTP memuat kodenya sendiri
       * ("Kode aktivasi Exact Try Out: 680392"), sehingga mencetaknya utuh
       * memindahkan kebocoran dari respons HTTP ke berkas log — tempat yang
       * lebih sering dibagikan daripada disadari. */
      console.error(
        `[MAIL] RESEND_API_KEY belum diisi - surel "${redactDigits(subject)}" untuk ${to} TIDAK terkirim.`,
      );
      return { delivered: false as const };
    }
    console.log(`\n[MAIL:dev] to=${to}\n  subject=${subject}\n  ${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}\n`);
    return { delivered: false as const };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend gagal: ${res.status} ${await res.text()}`);
  return { delivered: true as const };
}

export const mailSubject = (locale: Locale, kind: "receipt" | "refund") =>
  translate(locale, kind === "receipt" ? "mail.receipt.subject" : "mail.refund.subject");

export function receiptEmail(
  locale: Locale, name: string, pkg: string, amount: string, examName: string,
) {
  return shell(
    translate(locale, "mail.receipt.title"),
    para(translate(locale, "mail.receipt.body", { name, pkg, amount, exam: examName })) +
    para(translate(locale, "mail.receipt.note"), true),
  );
}

export function refundEmail(
  locale: Locale, name: string, pkg: string, amount: string, examName: string, attemptsRevoked: number,
) {
  /* Pembeli yang uangnya dikembalikan lalu mendapati kuotanya hilang tanpa
   * keterangan akan mengira ada yang rusak; satu paragraf yang menyebutkan
   * keduanya menutup kebingungan itu sebelum ia menjadi tiket dukungan. */
  const kuota = attemptsRevoked > 0
    ? translate(locale, "mail.refund.quota", { n: attemptsRevoked })
    : translate(locale, "mail.refund.quotaNone");

  return shell(
    translate(locale, "mail.refund.title"),
    para(translate(locale, "mail.refund.body", { name, pkg, amount, exam: examName })) +
    para(kuota) +
    para(translate(locale, "mail.refund.note"), true),
  );
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
