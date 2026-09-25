/** Hanya path internal yang boleh dipakai sebagai tujuan kembali.
 *
 *  Parameter `next` datang dari URL, artinya datang dari siapa pun yang bisa
 *  mengirimi korban sebuah tautan. Menerimanya apa adanya berarti
 *  https://situs-kita/masuk?next=https://situs-penipu — pengguna melihat domain
 *  yang benar, masuk dengan benar, lalu mendarat di tempat yang salah. Diawali
 *  satu garis miring, dan bukan «//» yang dibaca peramban sebagai host lain. */
export function safePath(raw: string | null | undefined, fallback = "/latihan") {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

/** Basis URL aplikasi. NEXT_PUBLIC_SITE_URL yang menentukan bila diisi —
 *  di belakang proxy, origin permintaan bisa saja alamat internal. */
export const siteUrl = (req: Request) =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin).replace(/\/$/, "");
