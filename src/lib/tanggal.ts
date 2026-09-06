/** Format tanggal & jam yang dipakai kanvas. */

export const BULAN_PENDEK = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** "26 Aug" */
export function tanggalPendek(d: Date): string {
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}`
}

/** "20:14" — 24 jam dengan titik dua. */
export function jam(d: Date = new Date(), withSeconds = false): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const base = `${p(d.getHours())}:${p(d.getMinutes())}`
  return withSeconds ? `${base}:${p(d.getSeconds())}` : base
}

/** 'YYYY-MM-DD' waktu lokal — bukan toISOString(), itu geser ke UTC. */
export function kunciTanggal(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
