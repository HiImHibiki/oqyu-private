/**
 * Instrumen gambar: penggaris, busur derajat, dan jangka.
 *
 * Ketiganya hidup di koordinat dunia, digambar di lapisan aktif kanvas, dan
 * bisa digeser, diputar, atau diubah ukurannya lewat pegangannya. Yang membuat
 * mereka berguna bukan gambarnya, melainkan kuncian goresan: pena yang mulai
 * menggores di dekat tepi penggaris dipaksa lurus di tepi itu, di dekat busur
 * dipaksa melengkung mengikuti busurnya, dan di ujung pensil jangka dipaksa
 * berputar di sekitar jarumnya. Sama seperti di atas kertas.
 */

import { warnaToken } from './strokes'

export type Titik = [number, number]

/** 96 dpi: 1 cm = 37,8 satuan dunia, jadi di kertas A4 angkanya benar-benar cm. */
export const PX_PER_CM = 96 / 2.54

export interface Penggaris {
  jenis: 'penggaris'
  /** Ujung kiri tepi ukur. */
  x: number
  y: number
  /** Radian, arah tepi ukur. */
  sudut: number
  panjang: number
}

export interface Busur {
  jenis: 'busur'
  /** Pusat busur, di tengah garis alasnya. */
  x: number
  y: number
  /** Radian, arah garis alas (0° ke kanan). */
  sudut: number
  r: number
}

export interface Jangka {
  jenis: 'jangka'
  /** Jarum. */
  x: number
  y: number
  r: number
  /** Arah ujung pensil dari jarum, radian. */
  sudut: number
}

export type Instrumen = Penggaris | Busur | Jangka
export type JenisInstrumen = Instrumen['jenis']

/** Lebar badan penggaris dan busur, dalam piksel layar. */
const LEBAR_BADAN = 64
/** Jarak tangkap pegangan dan kuncian, piksel layar. */
const TANGKAP = 14
const TANGKAP_KUNCI = 22

export const INSTRUMEN: { id: JenisInstrumen; label: string; ikon: 'penggaris' | 'busur' | 'jangka'; sub: string }[] = [
  { id: 'penggaris', label: 'Ruler', ikon: 'penggaris', sub: 'Start a stroke at its edge to draw a straight, measured line' },
  { id: 'busur', label: 'Protractor', ikon: 'busur', sub: 'Draw along the arc, or from the centre for an angle read-out' },
  { id: 'jangka', label: 'Compass', ikon: 'jangka', sub: 'Start at the pencil tip to draw an arc around the pin' },
]

/* ── Geometri kecil ────────────────────────────────────────────────── */

const arah = (sudut: number): Titik => [Math.cos(sudut), Math.sin(sudut)]

function proyeksiKeGaris(p: Titik, a: Titik, u: Titik, panjang: number): { t: number; q: Titik; d: number } {
  const t = (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1]
  const tj = Math.max(0, Math.min(panjang, t))
  const q: Titik = [a[0] + u[0] * tj, a[1] + u[1] * tj]
  return { t: tj, q, d: Math.hypot(p[0] - q[0], p[1] - q[1]) }
}

/** Sisi mana dari garis: positif = sisi normal (ke bawah layar untuk sudut 0). */
function sisi(p: Titik, a: Titik, u: Titik): number {
  return -(p[0] - a[0]) * u[1] + (p[1] - a[1]) * u[0]
}

/* ── Penempatan ────────────────────────────────────────────────────── */

/** Instrumen baru di tengah pandangan, dengan ukuran yang wajar untuk layar itu. */
export function buatInstrumen(
  jenis: JenisInstrumen,
  tengah: Titik,
  lebarDunia: number,
  tinggiDunia: number,
): Instrumen {
  if (jenis === 'penggaris') {
    const panjang = Math.max(120, lebarDunia * 0.55)
    return { jenis, x: tengah[0] - panjang / 2, y: tengah[1], sudut: 0, panjang }
  }
  if (jenis === 'busur') {
    const r = Math.max(80, Math.min(lebarDunia, tinggiDunia) * 0.28)
    return { jenis, x: tengah[0], y: tengah[1] + r * 0.35, sudut: 0, r }
  }
  const r = Math.max(60, Math.min(lebarDunia, tinggiDunia) * 0.18)
  return { jenis, x: tengah[0], y: tengah[1], r, sudut: -Math.PI / 4 }
}

/* ── Pegangan & seretan ────────────────────────────────────────────── */

export type ModeSeret = 'geser' | 'putar' | 'ukur'

export interface Seretan {
  mode: ModeSeret
  /** Titik dunia saat pegangan ditekan. */
  awal: Titik
  asal: Instrumen
}

/** Pegangan yang tampak: [titik, mode]. */
export function pegangan(i: Instrumen): { p: Titik; mode: ModeSeret; label: string }[] {
  if (i.jenis === 'penggaris') {
    const u = arah(i.sudut)
    return [
      { p: [i.x + u[0] * i.panjang, i.y + u[1] * i.panjang], mode: 'putar', label: 'rotate' },
      { p: [i.x, i.y], mode: 'ukur', label: 'length' },
    ]
  }
  if (i.jenis === 'busur') {
    const u = arah(i.sudut)
    const n = arah(i.sudut - Math.PI / 2)
    return [
      { p: [i.x + u[0] * i.r, i.y + u[1] * i.r], mode: 'putar', label: 'rotate' },
      { p: [i.x + n[0] * i.r, i.y + n[1] * i.r], mode: 'ukur', label: 'size' },
    ]
  }
  const u = arah(i.sudut)
  return [
    { p: [i.x + u[0] * i.r, i.y + u[1] * i.r], mode: 'ukur', label: 'pencil' },
    { p: [i.x, i.y], mode: 'geser', label: 'pin' },
  ]
}

/** Apa yang ditekan: pegangan, badan (untuk digeser), atau bukan apa-apa. */
export function kenaInstrumen(i: Instrumen, p: Titik, skala: number): ModeSeret | null {
  const r = TANGKAP / skala
  for (const h of pegangan(i)) {
    if (Math.hypot(h.p[0] - p[0], h.p[1] - p[1]) <= r) return h.mode
  }
  const badan = LEBAR_BADAN / skala
  if (i.jenis === 'penggaris') {
    const u = arah(i.sudut)
    const { t, d } = proyeksiKeGaris(p, [i.x, i.y], u, i.panjang)
    const s = sisi(p, [i.x, i.y], u)
    // Badannya duduk di sisi normal tepi ukur; tepi ukur itu sendiri untuk pena.
    if (t > 0 && t < i.panjang && s > TANGKAP_KUNCI / skala && s < badan && d < badan) return 'geser'
    return null
  }
  if (i.jenis === 'busur') {
    const u = arah(i.sudut)
    const d = Math.hypot(p[0] - i.x, p[1] - i.y)
    const s = sisi(p, [i.x, i.y], u)
    // Setengah cakram di sisi −normal (di atas garis alas untuk sudut 0),
    // kecuali cincin luarnya yang dipakai pena dan lubang tengahnya.
    if (s < 0 && d < i.r - TANGKAP_KUNCI / skala && d > TANGKAP_KUNCI / skala) return 'geser'
    return null
  }
  return null
}

export function terapkanSeret(s: Seretan, p: Titik): Instrumen {
  const a = s.asal
  const dx = p[0] - s.awal[0]
  const dy = p[1] - s.awal[1]
  if (s.mode === 'geser') return { ...a, x: a.x + dx, y: a.y + dy }
  if (a.jenis === 'penggaris') {
    if (s.mode === 'putar') {
      let sudut = Math.atan2(p[1] - a.y, p[0] - a.x)
      sudut = kunciSudut(sudut)
      return { ...a, sudut, panjang: Math.max(60, Math.hypot(p[0] - a.x, p[1] - a.y)) }
    }
    // Ukur dari ujung kiri: ujung kanan tetap di tempat.
    const u = arah(a.sudut)
    const kanan: Titik = [a.x + u[0] * a.panjang, a.y + u[1] * a.panjang]
    const t = (kanan[0] - p[0]) * u[0] + (kanan[1] - p[1]) * u[1]
    const panjang = Math.max(60, t)
    return { ...a, x: kanan[0] - u[0] * panjang, y: kanan[1] - u[1] * panjang, panjang }
  }
  if (a.jenis === 'busur') {
    if (s.mode === 'putar') return { ...a, sudut: kunciSudut(Math.atan2(p[1] - a.y, p[0] - a.x)) }
    return { ...a, r: Math.max(50, Math.hypot(p[0] - a.x, p[1] - a.y)) }
  }
  // Jangka: pegangan pensil mengubah jari-jari dan arahnya sekaligus.
  return {
    ...a,
    r: Math.max(12, Math.hypot(p[0] - a.x, p[1] - a.y)),
    sudut: Math.atan2(p[1] - a.y, p[0] - a.x),
  }
}

/** Sudut yang dekat kelipatan 15° menempel ke sana; sisanya bebas. */
function kunciSudut(sudut: number): number {
  const langkah = Math.PI / 12
  const dekat = Math.round(sudut / langkah) * langkah
  return Math.abs(dekat - sudut) < (1.2 * Math.PI) / 180 ? dekat : sudut
}

/* ── Kuncian goresan ───────────────────────────────────────────────── */

export type Kuncian =
  | { jenis: 'garis'; a: Titik; u: Titik; panjang: number }
  | { jenis: 'lingkaran'; c: Titik; r: number }
  | { jenis: 'radial'; c: Titik; sudutAlas: number }

/** Kuncian yang berlaku untuk goresan yang dimulai di `p`, kalau ada. */
export function kuncianDi(i: Instrumen, p: Titik, skala: number): Kuncian | null {
  const tangkap = TANGKAP_KUNCI / skala
  if (i.jenis === 'penggaris') {
    const u = arah(i.sudut)
    const { d, t } = proyeksiKeGaris(p, [i.x, i.y], u, i.panjang)
    const s = sisi(p, [i.x, i.y], u)
    // Hanya di sisi pena (bukan di atas badannya) dan di sepanjang tepinya.
    if (d <= tangkap && s <= tangkap * 0.6 && t >= 0 && t <= i.panjang) {
      return { jenis: 'garis', a: [i.x, i.y], u, panjang: i.panjang }
    }
    return null
  }
  if (i.jenis === 'busur') {
    const d = Math.hypot(p[0] - i.x, p[1] - i.y)
    if (d <= tangkap) return { jenis: 'radial', c: [i.x, i.y], sudutAlas: i.sudut }
    if (Math.abs(d - i.r) <= tangkap) return { jenis: 'lingkaran', c: [i.x, i.y], r: i.r }
    return null
  }
  const d = Math.hypot(p[0] - i.x, p[1] - i.y)
  if (Math.abs(d - i.r) <= tangkap * 1.4) return { jenis: 'lingkaran', c: [i.x, i.y], r: i.r }
  return null
}

/** Paksa titik ke kunciannya; kembalikan juga bacaan (panjang / sudut). */
export function kunciTitik(k: Kuncian, p: Titik): { q: Titik; bacaan: string } {
  if (k.jenis === 'garis') {
    const { q, t } = proyeksiKeGaris(p, k.a, k.u, k.panjang)
    return { q, bacaan: `${(t / PX_PER_CM).toFixed(1)} cm` }
  }
  if (k.jenis === 'lingkaran') {
    const th = Math.atan2(p[1] - k.c[1], p[0] - k.c[0])
    return {
      q: [k.c[0] + Math.cos(th) * k.r, k.c[1] + Math.sin(th) * k.r],
      bacaan: `r = ${(k.r / PX_PER_CM).toFixed(1)} cm`,
    }
  }
  // Radial: sinar dari pusat, sudutnya dibulatkan ke 1° relatif garis alas.
  const d = Math.hypot(p[0] - k.c[0], p[1] - k.c[1])
  let rel = Math.atan2(p[1] - k.c[1], p[0] - k.c[0]) - k.sudutAlas
  rel = Math.round((rel * 180) / Math.PI)
  // Ditampilkan sebagaimana busur membacanya: 0° di kanan, naik berlawanan jarum jam.
  let tampil = ((-rel % 360) + 360) % 360
  if (tampil > 180) tampil = 360 - tampil
  const th = k.sudutAlas + (rel * Math.PI) / 180
  return {
    q: [k.c[0] + Math.cos(th) * d, k.c[1] + Math.sin(th) * d],
    bacaan: `${tampil}°`,
  }
}

/* ── Gambar ────────────────────────────────────────────────────────── */

/** Gambar instrumen ke konteks yang sudah di-translate/scale ke dunia. */
export function gambarInstrumen(ctx: CanvasRenderingContext2D, i: Instrumen, skala: number): void {
  const px = (n: number) => n / skala
  const ink = warnaToken('ink')
  const aksen = warnaToken('accent')
  const badan = LEBAR_BADAN / skala
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  const isiBadan = () => {
    ctx.fillStyle = 'rgba(255, 244, 200, 0.62)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(120, 90, 20, 0.7)'
    ctx.lineWidth = px(1)
    ctx.stroke()
  }
  const teks = (s: string, x: number, y: number, ukuran = 10, align: CanvasTextAlign = 'center') => {
    ctx.font = `${px(ukuran)}px ui-sans-serif, -apple-system, system-ui, sans-serif`
    ctx.textAlign = align
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(60, 40, 10, 0.95)'
    ctx.fillText(s, x, y)
  }
  const bulatPegangan = (p: Titik, r = 6) => {
    ctx.beginPath()
    ctx.arc(p[0], p[1], px(r), 0, Math.PI * 2)
    ctx.fillStyle = aksen
    ctx.fill()
    ctx.lineWidth = px(1.6)
    ctx.strokeStyle = warnaToken('bg')
    ctx.stroke()
  }

  if (i.jenis === 'penggaris') {
    ctx.translate(i.x, i.y)
    ctx.rotate(i.sudut)
    ctx.beginPath()
    ctx.rect(0, 0, i.panjang, badan)
    isiBadan()
    // Tepi ukur ditegaskan.
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(i.panjang, 0)
    ctx.strokeStyle = 'rgba(120, 90, 20, 0.95)'
    ctx.lineWidth = px(1.4)
    ctx.stroke()
    // Skala mm/cm; mm dilewati kalau terlalu rapat di layar.
    const mm = PX_PER_CM / 10
    const tampilMm = mm * skala >= 3.2
    ctx.strokeStyle = 'rgba(60, 40, 10, 0.9)'
    ctx.lineWidth = px(1)
    ctx.beginPath()
    for (let t = 0, n = 0; t <= i.panjang + 0.01; t += mm, n++) {
      const cm = n % 10 === 0
      const setengah = n % 5 === 0
      if (!cm && !setengah && !tampilMm) continue
      const tinggi = cm ? px(18) : setengah ? px(12) : px(7)
      ctx.moveTo(t, 0)
      ctx.lineTo(t, tinggi)
    }
    ctx.stroke()
    for (let n = 0; n * PX_PER_CM <= i.panjang + 0.01; n++) {
      teks(String(n), n * PX_PER_CM, px(28), 10)
    }
    teks(`${(i.panjang / PX_PER_CM).toFixed(1)} cm · ${Math.round((((-i.sudut * 180) / Math.PI) % 360 + 360) % 360)}°`, i.panjang / 2, badan - px(14), 10)
    ctx.restore()
    ctx.save()
    for (const h of pegangan(i)) bulatPegangan(h.p)
    ctx.restore()
    return
  }

  if (i.jenis === 'busur') {
    ctx.translate(i.x, i.y)
    ctx.rotate(i.sudut)
    const rDalam = i.r * 0.42
    ctx.beginPath()
    ctx.arc(0, 0, i.r, Math.PI, 0)
    ctx.lineTo(rDalam, 0)
    ctx.arc(0, 0, rDalam, 0, Math.PI, true)
    ctx.closePath()
    isiBadan()
    // Garis alas dan pusat.
    ctx.beginPath()
    ctx.moveTo(-i.r, 0)
    ctx.lineTo(i.r, 0)
    ctx.moveTo(0, -px(8))
    ctx.lineTo(0, px(8))
    ctx.strokeStyle = 'rgba(120, 90, 20, 0.95)'
    ctx.lineWidth = px(1.2)
    ctx.stroke()
    // Skala derajat: tiap 1° kalau cukup renggang, label tiap 10°.
    const rapat = ((i.r * skala * Math.PI) / 180) >= 2.6
    ctx.strokeStyle = 'rgba(60, 40, 10, 0.9)'
    ctx.lineWidth = px(1)
    ctx.beginPath()
    for (let d = 0; d <= 180; d++) {
      const sepuluh = d % 10 === 0
      const lima = d % 5 === 0
      if (!sepuluh && !lima && !rapat) continue
      const panjang = sepuluh ? px(16) : lima ? px(11) : px(6)
      const th = -(d * Math.PI) / 180
      ctx.moveTo(Math.cos(th) * i.r, Math.sin(th) * i.r)
      ctx.lineTo(Math.cos(th) * (i.r - panjang), Math.sin(th) * (i.r - panjang))
    }
    ctx.stroke()
    // Jarak antar label 10° di layar; kalau sempit, cukup tiap 30° — angka
    // yang saling menimpa tidak bisa dibaca sama sekali.
    const jarakLabel = (i.r * skala * Math.PI) / 18
    const langkahLabel = jarakLabel >= 22 ? 10 : jarakLabel >= 8 ? 30 : 90
    for (let d = 0; d <= 180; d += langkahLabel) {
      const th = -(d * Math.PI) / 180
      const rr = i.r - px(26)
      ctx.save()
      ctx.translate(Math.cos(th) * rr, Math.sin(th) * rr)
      ctx.rotate(th + Math.PI / 2)
      teks(String(d), 0, 0, 9)
      ctx.restore()
    }
    ctx.restore()
    ctx.save()
    for (const h of pegangan(i)) bulatPegangan(h.p)
    ctx.restore()
    return
  }

  // Jangka: jarum, dua kaki, dan lingkaran pemandu tipis.
  const u = arah(i.sudut)
  const pensil: Titik = [i.x + u[0] * i.r, i.y + u[1] * i.r]
  ctx.setLineDash([px(4), px(4)])
  ctx.strokeStyle = 'rgba(120, 90, 20, 0.55)'
  ctx.lineWidth = px(1)
  ctx.beginPath()
  ctx.arc(i.x, i.y, i.r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  // Engsel di atas titik tengah, kaki-kaki turun ke jarum dan ke pensil.
  const tinggi = Math.max(px(40), i.r * 0.9)
  const tengah: Titik = [(i.x + pensil[0]) / 2, (i.y + pensil[1]) / 2]
  const n: Titik = [-u[1], u[0]]
  const engsel: Titik = [tengah[0] - n[0] * tinggi, tengah[1] - n[1] * tinggi]
  ctx.strokeStyle = 'rgba(70, 70, 80, 0.9)'
  ctx.lineWidth = px(3)
  ctx.beginPath()
  ctx.moveTo(engsel[0], engsel[1])
  ctx.lineTo(i.x, i.y)
  ctx.moveTo(engsel[0], engsel[1])
  ctx.lineTo(pensil[0], pensil[1])
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(engsel[0], engsel[1], px(5), 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(70, 70, 80, 0.95)'
  ctx.fill()
  // Ujung pensil berwarna aksen: di sinilah goresan dimulai.
  ctx.beginPath()
  ctx.arc(pensil[0], pensil[1], px(4), 0, Math.PI * 2)
  ctx.fillStyle = aksen
  ctx.fill()
  ctx.fillStyle = ink
  teks(`r = ${(i.r / PX_PER_CM).toFixed(1)} cm`, engsel[0], engsel[1] - px(14), 10)
  ctx.restore()
  ctx.save()
  for (const h of pegangan(i)) bulatPegangan(h.p, h.mode === 'geser' ? 5 : 6)
  ctx.restore()
}
