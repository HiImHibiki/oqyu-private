/**
 * Bentuk geometri yang tetap hidup sebagai parameter, bukan sebagai goresan.
 *
 * Alat bentuk yang lama memanggang hasilnya jadi deretan titik: begitu dilepas,
 * sebuah segitiga tidak berbeda dari coretan tangan dan tidak bisa diperbaiki
 * lagi. Objek di sini menyimpan titik kendalinya, jadi sudut segitiga masih
 * bisa digeser seminggu kemudian, dan lingkaran tetap benar-benar bulat pada
 * zoom berapa pun.
 */

import type { NamaIkon } from '@/components/ui/Icon'

export type JenisObjek =
  | 'garis'
  | 'panah'
  | 'kotak'
  | 'elips'
  | 'lingkaran'
  | 'segitiga'
  | 'belahketupat'
  | 'layang'
  | 'trapesium'
  | 'parabola'
  | 'kubik'
  | 'kuartik'
  | 'kubus'
  | 'balok'
  | 'sumbu2d'
  | 'sumbu3d'

export interface Objek {
  id: string
  jenis: JenisObjek
  layer: number
  /** Nama token tema, sama seperti coretan. */
  color: string
  size: number
  /** Titik kendali dunia. Jumlahnya ditentukan `jumlahTitik`. */
  titik: [number, number][]
  /**
   * Sudut putar dalam radian, berporos di tengah titik kendalinya.
   *
   * Titik kendali sengaja disimpan tanpa putaran. Kalau keduanya dicampur —
   * titik yang sudah ikut berputar — maka memutar sekali lagi akan menumpuk
   * pembulatan di atas pembulatan, dan persegi berhenti jadi persegi setelah
   * beberapa kali diputar. Di sini bentuknya selalu didefinisikan lurus, lalu
   * diputar sekali saat digambar.
   */
  putar?: number
}

export const OBJEK: { id: JenisObjek; label: string; ikon: NamaIkon; pintasan: string }[] = [
  { id: 'garis', label: 'Line', ikon: 'garis', pintasan: '⌘6' },
  { id: 'kotak', label: 'Rectangle', ikon: 'kotakBentuk', pintasan: '⌘7' },
  { id: 'elips', label: 'Ellipse', ikon: 'elips', pintasan: '⌘8' },
  { id: 'lingkaran', label: 'Circle', ikon: 'lingkaran', pintasan: '' },
  { id: 'segitiga', label: 'Triangle', ikon: 'segitiga', pintasan: '' },
  { id: 'belahketupat', label: 'Rhombus', ikon: 'belahketupat', pintasan: '' },
  { id: 'layang', label: 'Kite', ikon: 'layang', pintasan: '' },
  { id: 'trapesium', label: 'Trapezium', ikon: 'trapesium', pintasan: '' },
  { id: 'parabola', label: 'Parabola', ikon: 'parabola', pintasan: '' },
  { id: 'kubik', label: 'Cubic curve', ikon: 'kubik', pintasan: '' },
  { id: 'kuartik', label: 'Quartic curve', ikon: 'kuartik', pintasan: '' },
  { id: 'panah', label: 'Arrow', ikon: 'panah', pintasan: '⌘9' },
  { id: 'kubus', label: 'Cube', ikon: 'kubus', pintasan: '' },
  { id: 'balok', label: 'Cuboid', ikon: 'balok', pintasan: '' },
  { id: 'sumbu2d', label: 'Cartesian axes (2D)', ikon: 'sumbu2d', pintasan: '' },
  { id: 'sumbu3d', label: 'Cartesian axes (3D)', ikon: 'sumbu3d', pintasan: '' },
]

/* ── Putaran ───────────────────────────────────────────────────────── */

/** Poros putar: tengah kotak pembatas titik kendalinya, tanpa putaran. */
export function porosObjek(o: Objek): [number, number] {
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const [x, y] of o.titik) {
    if (x < x1) x1 = x
    if (y < y1) y1 = y
    if (x > x2) x2 = x
    if (y > y2) y2 = y
  }
  return [(x1 + x2) / 2, (y1 + y2) / 2]
}

export function putarSekitar(
  p: [number, number],
  poros: [number, number],
  sudut: number,
): [number, number] {
  if (!sudut) return [p[0], p[1]]
  const c = Math.cos(sudut)
  const s = Math.sin(sudut)
  const dx = p[0] - poros[0]
  const dy = p[1] - poros[1]
  return [poros[0] + dx * c - dy * s, poros[1] + dx * s + dy * c]
}

/** Titik kendali di posisi yang terlihat — sudah ikut berputar. */
export function titikTampak(o: Objek): [number, number][] {
  if (!o.putar) return o.titik.map((t) => [...t] as [number, number])
  const poros = porosObjek(o)
  return o.titik.map((t) => putarSekitar(t, poros, o.putar as number))
}

/** Kebalikan `titikTampak` untuk satu titik: dari layar kembali ke bentuk lurus. */
export function keLurus(o: Objek, p: [number, number]): [number, number] {
  if (!o.putar) return [p[0], p[1]]
  return putarSekitar(p, porosObjek(o), -o.putar)
}

/** Berapa titik kendali yang dipunyai satu jenis. */
export function jumlahTitik(jenis: JenisObjek): number {
  if (jenis === 'segitiga') return 3
  if (jenis === 'balok') return 3
  // Layang-layang dan trapesium sama-sama simetris terhadap satu sumbu: dua
  // titik menetapkan sumbunya, titik ketiga menetapkan lebar dan pinggangnya.
  if (jenis === 'layang') return 3
  if (jenis === 'trapesium') return 3
  return 2
}

/**
 * Titik kendali awal saat objek baru ditarik dari `a` ke `b`.
 *
 * Titik ketiga (segitiga, balok) diturunkan dari dua yang pertama supaya
 * menariknya tetap satu gerakan — sesudahnya barulah ia berdiri sendiri.
 */
export function titikAwal(
  jenis: JenisObjek,
  a: { x: number; y: number },
  b: { x: number; y: number },
): [number, number][] {
  if (jenis === 'segitiga') {
    // Segitiga sama kaki: puncak di tengah atas kotak yang ditarik.
    return [
      [(a.x + b.x) / 2, a.y],
      [b.x, b.y],
      [a.x, b.y],
    ]
  }
  if (jenis === 'layang') {
    // Pinggang sedikit di atas tengah — itu yang membedakan layang-layang
    // dari belah ketupat begitu ia muncul.
    return [
      [(a.x + b.x) / 2, a.y],
      [(a.x + b.x) / 2, b.y],
      [b.x, a.y + (b.y - a.y) * 0.38],
    ]
  }
  if (jenis === 'trapesium') {
    return [
      [a.x, b.y],
      [b.x, b.y],
      [a.x + (b.x - a.x) * 0.24, a.y],
    ]
  }
  if (jenis === 'balok') {
    const dalam = Math.min(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 0.45
    return [
      [a.x, a.y],
      [b.x, b.y],
      [b.x + dalam, a.y - dalam],
    ]
  }
  return [
    [a.x, a.y],
    [b.x, b.y],
  ]
}

/** Kunci proporsi saat Shift ditahan. */
export function kunciTitik(
  jenis: JenisObjek,
  titik: [number, number][],
  indeks: number,
): [number, number][] {
  const t = titik.map((p) => [...p] as [number, number])
  if (indeks !== 1) return t
  const [a, b] = t
  if (
    jenis === 'kotak' ||
    jenis === 'elips' ||
    jenis === 'belahketupat' ||
    jenis === 'kubus' ||
    jenis === 'balok'
  ) {
    const sisi = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
    t[1] = [a[0] + Math.sign(b[0] - a[0] || 1) * sisi, a[1] + Math.sign(b[1] - a[1] || 1) * sisi]
  } else if (jenis === 'garis' || jenis === 'panah' || jenis === 'sumbu2d' || jenis === 'sumbu3d') {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const jarak = Math.hypot(dx, dy)
    const sudut = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12)
    t[1] = [a[0] + Math.cos(sudut) * jarak, a[1] + Math.sin(sudut) * jarak]
  }
  return t
}

/* ── Geometri ──────────────────────────────────────────────────────── */

type Titik = [number, number]

/** Kemiringan sumbu kedalaman untuk gambar 3D: 30°, konvensi gambar teknik. */
const SUDUT_Z = -Math.PI / 6

function elipsPoli(cx: number, cy: number, rx: number, ry: number, n = 84): Titik[] {
  const out: Titik[] = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2
    out.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry])
  }
  return out
}

function kepalaPanah(ax: number, ay: number, bx: number, by: number, ukuran: number): Titik[][] {
  const sudut = Math.atan2(by - ay, bx - ax)
  const p = Math.min(ukuran, Math.hypot(bx - ax, by - ay) * 0.3)
  const sayap = Math.PI / 7
  return [
    [
      [bx - Math.cos(sudut - sayap) * p, by - Math.sin(sudut - sayap) * p],
      [bx, by],
      [bx - Math.cos(sudut + sayap) * p, by - Math.sin(sudut + sayap) * p],
    ],
  ]
}

function kotakPoli(a: Titik, b: Titik): Titik[] {
  return [a, [b[0], a[1]], b, [a[0], b[1]], a]
}

/** Bayangan `p` terhadap garis melalui `a` dan `b`. */
function cermin(p: Titik, a: Titik, b: Titik): Titik {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dd = dx * dx + dy * dy
  if (dd === 0) return [p[0], p[1]]
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / dd
  return [2 * (a[0] + t * dx) - p[0], 2 * (a[1] + t * dy) - p[1]]
}

/**
 * Kurva y = k·xⁿ dengan puncak (atau titik belok) di `a` dan melewati `b`.
 *
 * `b` menetapkan dua hal sekaligus: seberapa lebar kurva digambar, dan
 * setajam apa lengkungnya — jadi satu titik kendali sudah cukup, dan kurvanya
 * selalu simetris terhadap `a` seperti grafik fungsi yang digambar di papan.
 */
function kurvaPangkat(a: Titik, b: Titik, pangkat: number, n = 72): Titik[] {
  const dx = b[0] - a[0]
  // Tanpa rentang mendatar tidak ada fungsi yang bisa digambar; garis tegak
  // lurus adalah jawaban yang paling tidak mengejutkan.
  if (Math.abs(dx) < 0.001) return [a, b]
  const k = (b[1] - a[1]) / Math.pow(dx, pangkat)
  const jangkau = Math.abs(dx)
  const out: Titik[] = []
  for (let i = 0; i <= n; i++) {
    const x = -jangkau + (2 * jangkau * i) / n
    out.push([a[0] + x, a[1] + k * Math.pow(x, pangkat)])
  }
  return out
}

/**
 * Objek → daftar polyline dalam koordinat dunia.
 *
 * Satu bentuk untuk tiga keperluan sekaligus: menggambar, mengetes sentuhan,
 * dan mengekspor ke SVG. Kalau ketiganya punya perhitungannya sendiri, cepat
 * atau lambat salah satunya akan menyimpang dari yang lain.
 */
export function segmenObjek(o: Objek): Titik[][] {
  const lurus = segmenLurus(o)
  if (!o.putar) return lurus
  const poros = porosObjek(o)
  return lurus.map((seg) => seg.map((p) => putarSekitar(p, poros, o.putar as number)))
}

function segmenLurus(o: Objek): Titik[][] {
  const [a, b, c] = o.titik
  switch (o.jenis) {
    case 'garis':
      return [[a, b]]

    case 'panah':
      return [[a, b], ...kepalaPanah(a[0], a[1], b[0], b[1], 24)]

    case 'kotak':
      return [kotakPoli(a, b)]

    case 'elips':
      return [
        elipsPoli((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2),
      ]

    case 'lingkaran': {
      const r = Math.hypot(b[0] - a[0], b[1] - a[1])
      return [elipsPoli(a[0], a[1], r, r)]
    }

    case 'segitiga':
      return [[a, b, c, a]]

    case 'belahketupat': {
      // Titik sudutnya di tengah tiap sisi kotak pembatas: kedua diagonalnya
      // sejajar sumbu, dan itu yang membedakannya dari layang-layang.
      const mx = (a[0] + b[0]) / 2
      const my = (a[1] + b[1]) / 2
      return [[[mx, a[1]], [b[0], my], [mx, b[1]], [a[0], my], [mx, a[1]]]]
    }

    case 'layang': {
      if (!c) return [[a, b]]
      return [[a, c, b, cermin(c, a, b), a]]
    }

    case 'trapesium': {
      if (!c) return [[a, b]]
      const ux = b[0] - a[0]
      const uy = b[1] - a[1]
      const dd = ux * ux + uy * uy
      if (dd === 0) return [[a, b]]
      // Sisi atas sejajar alas dan simetris: ujung yang satu lagi adalah `c`
      // yang digeser sepanjang alas ke jarak cermin dari ujung seberang.
      const t = ((c[0] - a[0]) * ux + (c[1] - a[1]) * uy) / dd
      const d2: Titik = [c[0] + (1 - 2 * t) * ux, c[1] + (1 - 2 * t) * uy]
      return [[a, b, d2, c, a]]
    }

    case 'parabola':
      return [kurvaPangkat(a, b, 2)]

    case 'kubik':
      return [kurvaPangkat(a, b, 3)]

    case 'kuartik':
      return [kurvaPangkat(a, b, 4)]

    case 'kubus':
    case 'balok': {
      // Kubus memakai sisi terpanjang supaya mukanya tetap bujur sangkar;
      // balok membiarkan mukanya sesuai tarikan, dengan kedalaman sendiri.
      let muka: Titik = b
      if (o.jenis === 'kubus') {
        const sisi = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
        muka = [a[0] + Math.sign(b[0] - a[0] || 1) * sisi, a[1] + Math.sign(b[1] - a[1] || 1) * sisi]
      }
      const dalam =
        o.jenis === 'balok' && c
          ? ([c[0] - muka[0], c[1] - a[1]] as Titik)
          : ([
              Math.abs(muka[0] - a[0]) * 0.45 * Math.cos(SUDUT_Z) * 1,
              Math.abs(muka[0] - a[0]) * 0.45 * Math.sin(SUDUT_Z),
            ] as Titik)

      const geser = (p: Titik): Titik => [p[0] + dalam[0], p[1] + dalam[1]]
      const depan: Titik[] = [a, [muka[0], a[1]], muka, [a[0], muka[1]]]
      const belakang = depan.map(geser)
      return [
        [...depan, a],
        [...belakang, belakang[0]],
        [depan[0], belakang[0]],
        [depan[1], belakang[1]],
        [depan[2], belakang[2]],
        [depan[3], belakang[3]],
      ]
    }

    case 'sumbu2d': {
      const w = Math.abs(b[0] - a[0])
      const h = Math.abs(b[1] - a[1])
      const seg: Titik[][] = [
        [[a[0] - w, a[1]], [a[0] + w, a[1]]],
        [[a[0], a[1] + h], [a[0], a[1] - h]],
        ...kepalaPanah(a[0], a[1], a[0] + w, a[1], 12),
        ...kepalaPanah(a[0], a[1], a[0], a[1] - h, 12),
      ]
      // Garis skala kecil tiap sepersepuluh rentang — cukup untuk membaca
      // proporsi tanpa membuat sumbu terlihat seperti kertas milimeter.
      const langkahX = w / 5
      const langkahY = h / 5
      for (let i = 1; i <= 5; i++) {
        for (const s of [-1, 1]) {
          seg.push([
            [a[0] + s * langkahX * i, a[1] - 4],
            [a[0] + s * langkahX * i, a[1] + 4],
          ])
          seg.push([
            [a[0] - 4, a[1] + s * langkahY * i],
            [a[0] + 4, a[1] + s * langkahY * i],
          ])
        }
      }
      return seg
    }

    case 'sumbu3d': {
      const w = Math.abs(b[0] - a[0])
      const h = Math.abs(b[1] - a[1])
      const z = Math.min(w, h) * 0.8
      const zx = a[0] + Math.cos(Math.PI - SUDUT_Z) * z
      const zy = a[1] + Math.sin(Math.PI - SUDUT_Z) * z
      return [
        [a, [a[0] + w, a[1]]],
        [a, [a[0], a[1] - h]],
        [a, [zx, zy]],
        ...kepalaPanah(a[0], a[1], a[0] + w, a[1], 12),
        ...kepalaPanah(a[0], a[1], a[0], a[1] - h, 12),
        ...kepalaPanah(a[0], a[1], zx, zy, 12),
      ]
    }
  }
}

/** Label sumbu, digambar terpisah karena butuh teks, bukan garis. */
export function labelObjek(o: Objek): { teks: string; x: number; y: number }[] {
  const kasar = labelLurus(o)
  if (!o.putar) return kasar
  const poros = porosObjek(o)
  return kasar.map((l) => {
    const [x, y] = putarSekitar([l.x, l.y], poros, o.putar as number)
    return { ...l, x, y }
  })
}

function labelLurus(o: Objek): { teks: string; x: number; y: number }[] {
  const [a, b] = o.titik
  const w = Math.abs(b[0] - a[0])
  const h = Math.abs(b[1] - a[1])
  if (o.jenis === 'sumbu2d') {
    return [
      { teks: 'x', x: a[0] + w + 12, y: a[1] + 4 },
      { teks: 'y', x: a[0] - 12, y: a[1] - h - 6 },
      { teks: 'O', x: a[0] - 14, y: a[1] + 16 },
    ]
  }
  if (o.jenis === 'sumbu3d') {
    const z = Math.min(w, h) * 0.8
    return [
      { teks: 'x', x: a[0] + w + 12, y: a[1] + 4 },
      { teks: 'y', x: a[0] - 12, y: a[1] - h - 6 },
      { teks: 'z', x: a[0] + Math.cos(Math.PI - SUDUT_Z) * z - 16, y: a[1] + Math.sin(Math.PI - SUDUT_Z) * z + 14 },
      { teks: 'O', x: a[0] + 8, y: a[1] + 18 },
    ]
  }
  return []
}

export interface KotakObjek {
  x1: number
  y1: number
  x2: number
  y2: number
}

export function kotakObjek(o: Objek): KotakObjek {
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const seg of segmenObjek(o)) {
    for (const [x, y] of seg) {
      if (x < x1) x1 = x
      if (y < y1) y1 = y
      if (x > x2) x2 = x
      if (y > y2) y2 = y
    }
  }
  const pad = o.size
  return { x1: x1 - pad, y1: y1 - pad, x2: x2 + pad, y2: y2 + pad }
}

function jarakKeRuas(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const panjang = dx * dx + dy * dy
  const t = panjang === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / panjang))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Sentuhan dihitung ke garisnya, bukan ke kotak pembatasnya — bagian dalam
 *  sebuah lingkaran besar bukan milik lingkaran itu. */
export function objekKena(o: Objek, x: number, y: number, toleransi: number): boolean {
  const k = kotakObjek(o)
  const r = toleransi + o.size
  if (x < k.x1 - r || x > k.x2 + r || y < k.y1 - r || y > k.y2 + r) return false
  for (const seg of segmenObjek(o)) {
    for (let i = 1; i < seg.length; i++) {
      if (jarakKeRuas(x, y, seg[i - 1][0], seg[i - 1][1], seg[i][0], seg[i][1]) <= r) return true
    }
  }
  return false
}

export function geserObjek(o: Objek, dx: number, dy: number): Objek {
  return { ...o, titik: o.titik.map(([x, y]) => [x + dx, y + dy] as Titik) }
}

/* ── Menggambar ────────────────────────────────────────────────────── */

export function gambarObjek(
  ctx: CanvasRenderingContext2D,
  o: Objek,
  warna: string,
  fontLabel: string,
): void {
  ctx.save()
  ctx.strokeStyle = warna
  ctx.lineWidth = o.size
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const seg of segmenObjek(o)) {
    if (seg.length < 2) continue
    ctx.beginPath()
    ctx.moveTo(seg[0][0], seg[0][1])
    for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i][0], seg[i][1])
    ctx.stroke()
  }
  const label = labelObjek(o)
  if (label.length > 0) {
    ctx.fillStyle = warna
    ctx.font = fontLabel
    ctx.textBaseline = 'alphabetic'
    for (const l of label) ctx.fillText(l.teks, l.x, l.y)
  }
  ctx.restore()
}

export function objekKeSvg(o: Objek, warna: string): string {
  const garis = segmenObjek(o)
    .filter((s) => s.length > 1)
    .map((s) => {
      const d = s.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ')
      return `<path d="${d}" fill="none" stroke="${warna}" stroke-width="${o.size}" stroke-linejoin="round" stroke-linecap="round" />`
    })
  const teks = labelObjek(o).map(
    (l) =>
      `<text x="${l.x.toFixed(2)}" y="${l.y.toFixed(2)}" fill="${warna}" font-size="${Math.max(12, o.size * 3)}" font-family="monospace">${l.teks}</text>`,
  )
  return [...garis, ...teks].join('\n  ')
}
