/**
 * Kursor yang mengikuti alat.
 *
 * Kursor silang yang sama untuk semua alat memaksa mata melirik ke bilah alat
 * tiap kali ragu "ini pena atau stabilo". Di sini ujung kursornya adalah
 * ikon alatnya sendiri, dan penghapus memperlihatkan seberapa besar bidang
 * yang akan dihapus. Digambar sebagai SVG dengan tepi putih supaya tetap
 * terlihat di atas tinta gelap maupun kertas terang.
 */

import type { Alat } from './strokes'
import { OBJEK } from './objek'

/** Jalur ikon 24×24, disalin dari komponen Icon supaya rupanya sama persis. */
const JALUR: Record<string, string> = {
  pen: 'M4 20l4-1 10-10-3-3L5 16zM14 6l3 3',
  pensil: 'M4 20l3-.8 11-11-2.2-2.2-11 11zM15 6.5l2.2 2.2M4 20l1.2-3',
  kaligrafi: 'M5 19l3.5-1L20 6.5 17.5 4 6 15.5zM15.5 6l2.5 2.5M5 19l1-3.5',
  kuas: 'M6 21c3 0 5-2 5-5l-4-4c-3 0-5 2-5 5zM11 16L20 7a2 2 0 00-3-3l-9 9',
  spidol: 'M5 19h5l9-9-4-4-9 9zM4 21h16',
  laso: 'M12 4c5 0 8 2.5 8 5.5S17 15 12 15s-8-2.5-8-5.5S7 4 12 4zM9 15c0 3 1 5 3 5',
  lasoKotak: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M11 4h2M11 20h2M4 11v2M20 11v2',
  garis: 'M4 20L20 4',
  kotakBentuk: 'M4 5h16v14H4z',
  elips: 'M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z',
  panah: 'M4 20L20 4M20 4h-7M20 4v7',
  lingkaran: 'M12 4a8 8 0 100 16 8 8 0 000-16z',
  segitiga: 'M12 4L21 20H3z',
  kubus: 'M4 8h11v11H4zM4 8l5-4h11v11l-5 4M15 8l5-4M15 19l5-4',
  balok: 'M3 10h13v8H3zM3 10l4-3h13v8l-4 3M16 10l4-3M16 18l4-3',
  sumbu2d: 'M4 20h17M4 20V3M4 20l-3 0M21 20l-3-3M21 20l-3 3M4 3L1 6M4 3l3 3',
  sumbu3d: 'M12 12h9M12 12V3M12 12L4 20M21 12l-3-3M21 12l-3 3M12 3l-3 3M12 3l3 3M4 20l1-4M4 20l4-1',
  belahketupat: 'M12 3l9 9-9 9-9-9z',
  layang: 'M12 3l8 7-8 11-8-11z',
  trapesium: 'M3 19h18l-4-14H7z',
  parabola: 'M4 5C7 19 17 19 20 5',
  kubik: 'M4 20c4 0 4-8 8-8s4-8 8-8',
  kuartik: 'M5 5c1 15 13 15 14 0',
}

/** Alat gambar tangan: ujung ikon di kiri bawah, di situlah titik panasnya. */
const UJUNG_TULIS: Record<string, [number, number]> = {
  pen: [4, 20],
  pensil: [4, 20],
  kaligrafi: [5, 19],
  kuas: [4, 20],
  spidol: [5, 19],
}

const cache = new Map<string, string>()

function svgKursor(isi: string, lebar: number, tinggi: number, hx: number, hy: number, cadangan: string): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${lebar}' height='${tinggi}' viewBox='0 0 ${lebar} ${tinggi}'>` +
    isi +
    `</svg>`
  const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg).replace(/'/g, '%27')}") ${hx} ${hy}, ${cadangan}`
  return url
}

/** Jalur dengan tepi putih di bawahnya. */
function jalurBerhalo(d: string, transform = '', tebal = 1.7): string {
  return (
    `<g transform='${transform}' fill='none' stroke-linecap='round' stroke-linejoin='round'>` +
    `<path d='${d}' stroke='#fff' stroke-width='${tebal + 2.4}'/>` +
    `<path d='${d}' stroke='#111' stroke-width='${tebal}'/>` +
    `</g>`
  )
}

/** Silang kecil sebagai titik panas, dengan halo putih. */
function silang(cx: number, cy: number): string {
  return (
    `<g stroke-linecap='round'>` +
    `<path d='M${cx - 6} ${cy}h12M${cx} ${cy - 6}v12' stroke='#fff' stroke-width='3.4'/>` +
    `<path d='M${cx - 6} ${cy}h12M${cx} ${cy - 6}v12' stroke='#111' stroke-width='1.4'/>` +
    `</g>`
  )
}

/**
 * Kursor CSS untuk alat yang aktif.
 *
 * `diameterHapus` dalam piksel layar: penghapus memperlihatkan bidangnya.
 */
export function kursorAlat(alat: Alat, diameterHapus = 18): string {
  const kunci = alat === 'penghapus' ? `penghapus:${Math.round(diameterHapus)}` : alat
  const ada = cache.get(kunci)
  if (ada) return ada

  let hasil: string
  if (alat === 'teks') {
    hasil = 'text'
  } else if (alat === 'penghapus') {
    const d = Math.max(8, Math.min(96, Math.round(diameterHapus)))
    const s = d + 6
    const c = s / 2
    const r = d / 2
    hasil = svgKursor(
      `<circle cx='${c}' cy='${c}' r='${r}' fill='rgba(255,255,255,0.35)' stroke='#fff' stroke-width='3'/>` +
        `<circle cx='${c}' cy='${c}' r='${r}' fill='none' stroke='#111' stroke-width='1.2'/>` +
        `<circle cx='${c}' cy='${c}' r='1.2' fill='#111'/>`,
      s,
      s,
      c,
      c,
      'cell',
    )
  } else if (alat in UJUNG_TULIS) {
    const [hx, hy] = UJUNG_TULIS[alat]
    hasil = svgKursor(jalurBerhalo(JALUR[alat]), 28, 28, hx, hy, 'crosshair')
  } else {
    // Laso dan bentuk: silang sebagai titik panas, lambang alat di kanan bawah.
    const nama = alat === 'laso' || alat === 'lasoKotak' ? alat : OBJEK.find((o) => o.id === alat)?.ikon ?? 'garis'
    const d = JALUR[nama] ?? JALUR.garis
    hasil = svgKursor(
      silang(9, 9) + jalurBerhalo(d, 'translate(15 15) scale(0.62)', 1.9),
      32,
      32,
      9,
      9,
      'crosshair',
    )
  }
  cache.set(kunci, hasil)
  return hasil
}
