import Link from "next/link";

/* Tombol masuk lewat Google.
 *
 * Sebuah tautan biasa, bukan tombol ber-JavaScript: seluruh alurnya adalah
 * rangkaian redirect di sisi server, jadi tidak ada yang perlu ditunggu di
 * peramban dan tombolnya sudah bisa ditekan sebelum React sempat terpasang.
 *
 * Logonya digambar langsung di sini alih-alih diambil dari CDN Google —
 * satu berkas kurang untuk dimuat, dan tombol masuk yang logonya gagal
 * termuat terlihat seperti situs yang rusak. */
export function GoogleSignIn({
  label,
  next,
  refCode,
}: {
  label: string;
  next?: string;
  refCode?: string;
}) {
  const qs = new URLSearchParams();
  if (next) qs.set("next", next);
  if (refCode) qs.set("ref", refCode);
  const query = qs.toString();
  const href = `/api/auth/google${query ? `?${query}` : ""}`;

  return (
    <Link href={href} prefetch={false}
      className="btn w-full justify-center gap-2.5 !py-3 text-[15px] font-medium"
      style={{ background: "var(--bg-elev)", border: "1px solid var(--border-strong)", color: "var(--fg)" }}>
      <GoogleMark />
      {label}
    </Link>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden focusable="false" className="shrink-0">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.8-2.1 5.1-4.4 6.7v5.6h7.1c4.2-3.8 6.6-9.5 6.6-16.5z" />
      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.6c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.8C7.9 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.6 28c-.4-1.3-.7-2.6-.7-4s.3-2.7.7-4v-5.8H4.3A22 22 0 0 0 2 24c0 3.5.8 6.9 2.3 9.8l7.3-5.8z" />
      <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.2 30 2 24 2 15.4 2 7.9 6.9 4.3 14.2l7.3 5.8c1.7-5.2 6.6-9.2 12.4-9.2z" />
    </svg>
  );
}
