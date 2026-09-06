/**
 * Sisipan yang dirender jadi gambar: grafik fungsi dan tabel.
 *
 * Keduanya masuk ke kanvas sebagai `Gambar` biasa — jadi bisa digeser, diputar,
 * diubah ukurannya, dikunci di lapisan, dicoret-coret, dan ikut ke setiap jalur
 * ekspor yang sudah ada tanpa satu pun kode ekspor perlu tahu tentangnya.
 * Definisinya ikut disimpan di gambar itu (`meta`), supaya masih bisa dibuka
 * dan disunting lagi, lalu dirender ulang.
 */

/* ── Definisi ──────────────────────────────────────────────────────── */

export interface Fungsi {
  ekspresi: string
  /** Hex. */
  warna: string
}

export interface DefinisiGrafik {
  fungsi: Fungsi[]
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  /** Skala y dihitung sendiri dari nilai fungsinya. */
  yOtomatis: boolean
  petak: boolean
  /** Ukuran di kanvas, satuan dunia. */
  w: number
  h: number
}

export interface DefinisiTabel {
  baris: number
  kolom: number
  /** sel[baris][kolom]; boleh kosong untuk diisi tulisan tangan. */
  sel: string[][]
  kepala: boolean
  lebarSel: number
  tinggiSel: number
}

export type MetaGambar =
  | { jenis: 'grafik'; data: DefinisiGrafik }
  | { jenis: 'tabel'; data: DefinisiTabel }

export const WARNA_FUNGSI = ['#1d4ed8', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2']

export function grafikBawaan(): DefinisiGrafik {
  return {
    fungsi: [{ ekspresi: 'x^2', warna: WARNA_FUNGSI[0] }],
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5,
    yOtomatis: false,
    petak: true,
    w: 560,
    h: 420,
  }
}

export function tabelBawaan(): DefinisiTabel {
  return {
    baris: 4,
    kolom: 3,
    sel: Array.from({ length: 4 }, () => Array.from({ length: 3 }, () => '')),
    kepala: true,
    lebarSel: 120,
    tinggiSel: 40,
  }
}

/* ── Parser ekspresi ───────────────────────────────────────────────── */

type Token =
  | { t: 'angka'; v: number }
  | { t: 'nama'; v: string }
  | { t: 'op'; v: string }
  | { t: '('; v: '(' }
  | { t: ')'; v: ')' }
  | { t: ','; v: ',' }

const FUNGSI_1: Record<string, (a: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
}
const FUNGSI_2: Record<string, (a: number, b: number) => number> = {
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  atan2: Math.atan2,
  mod: (a, b) => a - b * Math.floor(a / b),
}
const KONSTANTA: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 }

function tokenkan(s: string): Token[] {
  const out: Token[] = []
  let i = 0
  const src = s.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
  while (i < src.length) {
    const c = src[i]
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      const v = Number(src.slice(i, j))
      if (!Number.isFinite(v)) throw new Error(`Bad number "${src.slice(i, j)}"`)
      out.push({ t: 'angka', v })
      i = j
      continue
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i
      while (j < src.length && /[a-zA-Z_0-9]/.test(src[j])) j++
      out.push({ t: 'nama', v: src.slice(i, j) })
      i = j
      continue
    }
    if ('+-*/^'.includes(c)) {
      out.push({ t: 'op', v: c })
      i++
      continue
    }
    if (c === '(' || c === ')' || c === ',') {
      out.push({ t: c, v: c } as Token)
      i++
      continue
    }
    throw new Error(`Unexpected "${c}"`)
  }
  return out
}

/**
 * Pecah nama yang ditempel: "2x" sudah dua token, tapi "xsin" atau "xy" datang
 * sebagai satu nama. Yang dikenali dipisah jadi variabel/konstanta/fungsi.
 */
function pecahNama(nama: string): string[] {
  const dikenal = new Set([...Object.keys(FUNGSI_1), ...Object.keys(FUNGSI_2), ...Object.keys(KONSTANTA), 'x'])
  if (dikenal.has(nama)) return [nama]
  const hasil: string[] = []
  let sisa = nama
  while (sisa.length > 0) {
    let cocok = ''
    for (const k of dikenal) {
      if (sisa.startsWith(k) && k.length > cocok.length) cocok = k
    }
    if (!cocok) throw new Error(`Unknown name "${sisa}"`)
    hasil.push(cocok)
    sisa = sisa.slice(cocok.length)
  }
  return hasil
}

/** Sisipkan perkalian tersirat: 2x, 3(x+1), x(x-1), )(, 2sin(x), x^2y. */
function normalkan(tokens: Token[]): Token[] {
  const pecah: Token[] = []
  for (const t of tokens) {
    if (t.t === 'nama') for (const n of pecahNama(t.v)) pecah.push({ t: 'nama', v: n })
    else pecah.push(t)
  }
  const out: Token[] = []
  for (let i = 0; i < pecah.length; i++) {
    const t = pecah[i]
    const sebelum = out[out.length - 1]
    const nilaiKiri = sebelum && (sebelum.t === 'angka' || sebelum.t === ')' || (sebelum.t === 'nama' && !(sebelum.v in FUNGSI_1) && !(sebelum.v in FUNGSI_2)))
    const mulaiKanan = t.t === 'angka' || t.t === 'nama' || t.t === '('
    if (nilaiKiri && mulaiKanan) out.push({ t: 'op', v: '*' })
    out.push(t)
  }
  return out
}

type Rpn = Token | { t: 'neg' } | { t: 'panggil'; v: string; n: number }

function keRpn(tokens: Token[]): Rpn[] {
  const out: Rpn[] = []
  const tumpuk: (Token | { t: 'neg' } | { t: 'fungsi'; v: string })[] = []
  const prio: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 }
  let harapNilai = true
  for (const t of tokens) {
    if (t.t === 'angka') {
      out.push(t)
      harapNilai = false
    } else if (t.t === 'nama') {
      if (t.v in FUNGSI_1 || t.v in FUNGSI_2) {
        tumpuk.push({ t: 'fungsi', v: t.v })
        harapNilai = true
      } else {
        out.push(t)
        harapNilai = false
      }
    } else if (t.t === 'op') {
      if (t.v === '-' && harapNilai) {
        tumpuk.push({ t: 'neg' })
        continue
      }
      if (t.v === '+' && harapNilai) continue
      while (tumpuk.length > 0) {
        const atas = tumpuk[tumpuk.length - 1]
        if (atas.t === 'neg') {
          // Negasi mengikat lebih erat dari segalanya kecuali pangkat: -x^2 = -(x^2).
          if (t.v === '^') break
          out.push(tumpuk.pop() as Rpn)
          continue
        }
        if (atas.t !== 'op') break
        const pa = prio[atas.v]
        const pt = prio[t.v]
        if (pa > pt || (pa === pt && t.v !== '^')) out.push(tumpuk.pop() as Rpn)
        else break
      }
      tumpuk.push(t)
      harapNilai = true
    } else if (t.t === '(') {
      tumpuk.push(t)
      harapNilai = true
    } else if (t.t === ',') {
      while (tumpuk.length > 0 && tumpuk[tumpuk.length - 1].t !== '(') out.push(tumpuk.pop() as Rpn)
      harapNilai = true
    } else if (t.t === ')') {
      while (tumpuk.length > 0 && tumpuk[tumpuk.length - 1].t !== '(') out.push(tumpuk.pop() as Rpn)
      if (tumpuk.length === 0) throw new Error('Unbalanced parentheses')
      tumpuk.pop()
      const atas = tumpuk[tumpuk.length - 1]
      if (atas && atas.t === 'fungsi') {
        tumpuk.pop()
        out.push({ t: 'panggil', v: atas.v, n: atas.v in FUNGSI_2 ? 2 : 1 })
      }
      harapNilai = false
    }
  }
  while (tumpuk.length > 0) {
    const t = tumpuk.pop() as Rpn | { t: 'fungsi'; v: string }
    if (t.t === '(') throw new Error('Unbalanced parentheses')
    if (t.t === 'fungsi') throw new Error(`${t.v} needs parentheses`)
    out.push(t)
  }
  return out
}

/** Susun fungsi x ↦ y dari teks. Melempar galat kalau teksnya tidak terbaca. */
export function susunFungsi(teks: string): (x: number) => number {
  let s = teks.trim()
  // "y = ..." dan "f(x) = ..." boleh ditulis; hanya sisi kanannya yang dihitung.
  s = s.replace(/^[a-zA-Z]\w*\s*(\(\s*x\s*\))?\s*=\s*/, '')
  if (!s) throw new Error('Empty expression')
  const rpn = keRpn(normalkan(tokenkan(s)))
  // Coba sekali untuk menangkap tumpukan yang tidak seimbang.
  const uji = (x: number) => {
    const st: number[] = []
    for (const r of rpn) {
      if (r.t === 'angka') st.push(r.v)
      else if (r.t === 'nama') {
        if (r.v === 'x') st.push(x)
        else if (r.v in KONSTANTA) st.push(KONSTANTA[r.v])
        else throw new Error(`Unknown name "${r.v}"`)
      } else if (r.t === 'neg') st.push(-(st.pop() as number))
      else if (r.t === 'panggil') {
        if (r.n === 2) {
          const b = st.pop() as number
          const a = st.pop() as number
          st.push(FUNGSI_2[r.v](a, b))
        } else st.push(FUNGSI_1[r.v](st.pop() as number))
      } else if (r.t === 'op') {
        const b = st.pop() as number
        const a = st.pop() as number
        if (a === undefined || b === undefined) throw new Error('Incomplete expression')
        st.push(r.v === '+' ? a + b : r.v === '-' ? a - b : r.v === '*' ? a * b : r.v === '/' ? a / b : Math.pow(a, b))
      }
    }
    if (st.length !== 1) throw new Error('Incomplete expression')
    return st[0]
  }
  uji(1)
  return uji
}

/* ── Render grafik ─────────────────────────────────────────────────── */

/** Langkah sumbu yang enak dibaca: 1, 2, 5 × 10ⁿ, kira-kira `target` bagian. */
function langkahRapi(rentang: number, target = 8): number {
  const kasar = rentang / target
  const pangkat = Math.pow(10, Math.floor(Math.log10(kasar)))
  const sisa = kasar / pangkat
  const m = sisa < 1.5 ? 1 : sisa < 3.5 ? 2 : sisa < 7.5 ? 5 : 10
  return m * pangkat
}

function angkaRapi(n: number): string {
  const s = Number(n.toPrecision(6))
  return Math.abs(s) < 1e-9 ? '0' : String(s)
}

export interface HasilGrafik {
  src: string
  w: number
  h: number
  /** Ekspresi yang gagal diurai, beserta pesannya. */
  galat: { ekspresi: string; pesan: string }[]
}

/**
 * Gambar grafik ke PNG. Latar putih dan tinta gelap dengan sengaja: yang
 * disisipkan adalah gambar tetap, dan gambar tetap harus tetap terbaca kalau
 * tema berganti atau halaman dicetak.
 */
export function renderGrafik(d: DefinisiGrafik, dpr = 2): HasilGrafik {
  const W = Math.round(d.w * dpr)
  const H = Math.round(d.h * dpr)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  const galat: HasilGrafik['galat'] = []
  if (!ctx) return { src: '', w: d.w, h: d.h, galat }
  ctx.scale(dpr, dpr)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, d.w, d.h)

  const fs = d.fungsi
    .map((f) => {
      try {
        return { ...f, hitung: susunFungsi(f.ekspresi) }
      } catch (e) {
        galat.push({ ekspresi: f.ekspresi, pesan: e instanceof Error ? e.message : String(e) })
        return null
      }
    })
    .filter((f): f is Fungsi & { hitung: (x: number) => number } => f !== null)

  const xMin = Math.min(d.xMin, d.xMax)
  const xMax = Math.max(d.xMin, d.xMax)
  let yMin = Math.min(d.yMin, d.yMax)
  let yMax = Math.max(d.yMin, d.yMax)
  if (d.yOtomatis && fs.length > 0) {
    let lo = Infinity
    let hi = -Infinity
    const N = 400
    for (const f of fs) {
      for (let i = 0; i <= N; i++) {
        const y = f.hitung(xMin + ((xMax - xMin) * i) / N)
        if (Number.isFinite(y)) {
          if (y < lo) lo = y
          if (y > hi) hi = y
        }
      }
    }
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      // Pangkas nilai ekstrem (asimtot) dengan membatasi ke ±50× rentang x.
      const batas = (xMax - xMin) * 50
      lo = Math.max(lo, -batas)
      hi = Math.min(hi, batas)
      const pad = (hi - lo || 1) * 0.1
      yMin = lo - pad
      yMax = hi + pad
      if (yMin > 0) yMin = 0
      if (yMax < 0) yMax = 0
    }
  }
  if (xMax - xMin < 1e-9 || yMax - yMin < 1e-9) return { src: c.toDataURL('image/png'), w: d.w, h: d.h, galat }

  const tepi = { kiri: 34, kanan: 16, atas: 16, bawah: 28 }
  const pw = d.w - tepi.kiri - tepi.kanan
  const ph = d.h - tepi.atas - tepi.bawah
  const keX = (x: number) => tepi.kiri + ((x - xMin) / (xMax - xMin)) * pw
  const keY = (y: number) => tepi.atas + ((yMax - y) / (yMax - yMin)) * ph

  const dx = langkahRapi(xMax - xMin)
  const dy = langkahRapi(yMax - yMin, 6)

  // Petak
  ctx.lineWidth = 1
  ctx.font = '11px ui-sans-serif, -apple-system, system-ui, sans-serif'
  ctx.fillStyle = '#6b7280'
  if (d.petak) {
    ctx.strokeStyle = '#e5e7eb'
    ctx.beginPath()
    for (let x = Math.ceil(xMin / dx) * dx; x <= xMax + 1e-9; x += dx) {
      const px = Math.round(keX(x)) + 0.5
      ctx.moveTo(px, tepi.atas)
      ctx.lineTo(px, tepi.atas + ph)
    }
    for (let y = Math.ceil(yMin / dy) * dy; y <= yMax + 1e-9; y += dy) {
      const py = Math.round(keY(y)) + 0.5
      ctx.moveTo(tepi.kiri, py)
      ctx.lineTo(tepi.kiri + pw, py)
    }
    ctx.stroke()
  }

  // Sumbu (di 0 kalau 0 terlihat, kalau tidak di tepi)
  const x0 = xMin <= 0 && xMax >= 0 ? keX(0) : tepi.kiri
  const y0 = yMin <= 0 && yMax >= 0 ? keY(0) : tepi.atas + ph
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(tepi.kiri, y0)
  ctx.lineTo(tepi.kiri + pw + 8, y0)
  ctx.moveTo(x0, tepi.atas + ph)
  ctx.lineTo(x0, tepi.atas - 8)
  ctx.stroke()
  // Mata panah
  ctx.fillStyle = '#111827'
  ctx.beginPath()
  ctx.moveTo(tepi.kiri + pw + 12, y0)
  ctx.lineTo(tepi.kiri + pw + 4, y0 - 4)
  ctx.lineTo(tepi.kiri + pw + 4, y0 + 4)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x0, tepi.atas - 12)
  ctx.lineTo(x0 - 4, tepi.atas - 4)
  ctx.lineTo(x0 + 4, tepi.atas - 4)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#374151'
  ctx.font = 'italic 12px ui-serif, Georgia, serif'
  ctx.fillText('x', tepi.kiri + pw + 4, y0 + 14)
  ctx.fillText('y', x0 + 6, tepi.atas - 2)

  // Angka sumbu
  ctx.font = '10px ui-sans-serif, -apple-system, system-ui, sans-serif'
  ctx.fillStyle = '#4b5563'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let x = Math.ceil(xMin / dx) * dx; x <= xMax + 1e-9; x += dx) {
    if (Math.abs(x) < 1e-9 && xMin < 0) continue
    const px = keX(x)
    ctx.beginPath()
    ctx.moveTo(px, y0 - 3)
    ctx.lineTo(px, y0 + 3)
    ctx.stroke()
    ctx.fillText(angkaRapi(x), px, Math.min(y0 + 5, d.h - 12))
  }
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let y = Math.ceil(yMin / dy) * dy; y <= yMax + 1e-9; y += dy) {
    if (Math.abs(y) < 1e-9) continue
    const py = keY(y)
    ctx.beginPath()
    ctx.moveTo(x0 - 3, py)
    ctx.lineTo(x0 + 3, py)
    ctx.stroke()
    ctx.fillText(angkaRapi(y), Math.max(x0 - 5, 26), py)
  }

  // Kurva — dipotong di wilayah plot supaya asimtot tidak menembus tepi.
  ctx.save()
  ctx.beginPath()
  ctx.rect(tepi.kiri, tepi.atas, pw, ph)
  ctx.clip()
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  const N = Math.max(400, Math.round(pw * 2))
  for (const f of fs) {
    ctx.strokeStyle = f.warna
    ctx.beginPath()
    let putus = true
    let yLalu = NaN
    for (let i = 0; i <= N; i++) {
      const x = xMin + ((xMax - xMin) * i) / N
      const y = f.hitung(x)
      if (!Number.isFinite(y)) {
        putus = true
        yLalu = NaN
        continue
      }
      const py = keY(y)
      // Lompatan tegak lebih dari dua tinggi plot: itu asimtot, bukan garis.
      if (Number.isFinite(yLalu) && Math.abs(py - yLalu) > ph * 2) putus = true
      if (putus) ctx.moveTo(keX(x), py)
      else ctx.lineTo(keX(x), py)
      putus = false
      yLalu = py
    }
    ctx.stroke()
  }
  ctx.restore()

  // Legenda
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = '12px ui-sans-serif, -apple-system, system-ui, sans-serif'
  let ly = tepi.atas + 10
  for (const f of fs) {
    const label = `y = ${f.ekspresi.trim().replace(/^[a-zA-Z]\w*\s*(\(\s*x\s*\))?\s*=\s*/, '')}`
    const lebar = ctx.measureText(label).width + 30
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillRect(tepi.kiri + pw - lebar - 4, ly - 9, lebar + 4, 18)
    ctx.strokeStyle = f.warna
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(tepi.kiri + pw - lebar, ly)
    ctx.lineTo(tepi.kiri + pw - lebar + 18, ly)
    ctx.stroke()
    ctx.fillStyle = '#111827'
    ctx.fillText(label, tepi.kiri + pw - lebar + 24, ly)
    ly += 18
  }

  return { src: c.toDataURL('image/png'), w: d.w, h: d.h, galat }
}

/* ── Render tabel ──────────────────────────────────────────────────── */

export function ukuranTabel(d: DefinisiTabel): { w: number; h: number } {
  return { w: d.kolom * d.lebarSel + 2, h: d.baris * d.tinggiSel + 2 }
}

export function renderTabel(d: DefinisiTabel, dpr = 2): { src: string; w: number; h: number } {
  const { w, h } = ukuranTabel(d)
  const c = document.createElement('canvas')
  c.width = Math.round(w * dpr)
  c.height = Math.round(h * dpr)
  const ctx = c.getContext('2d')
  if (!ctx) return { src: '', w, h }
  ctx.scale(dpr, dpr)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  if (d.kepala) {
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(1, 1, w - 2, d.tinggiSel)
  }
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 0; i <= d.kolom; i++) {
    const x = Math.round(1 + i * d.lebarSel) + 0.5
    ctx.moveTo(x, 1)
    ctx.lineTo(x, h - 1)
  }
  for (let j = 0; j <= d.baris; j++) {
    const y = Math.round(1 + j * d.tinggiSel) + 0.5
    ctx.moveTo(1, y)
    ctx.lineTo(w - 1, y)
  }
  ctx.stroke()
  ctx.fillStyle = '#111827'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const fs = Math.max(11, Math.min(18, d.tinggiSel * 0.42))
  for (let r = 0; r < d.baris; r++) {
    for (let k = 0; k < d.kolom; k++) {
      const isi = d.sel[r]?.[k] ?? ''
      if (!isi) continue
      ctx.font = `${d.kepala && r === 0 ? '600 ' : ''}${fs}px ui-sans-serif, -apple-system, system-ui, sans-serif`
      const cx = 1 + k * d.lebarSel + d.lebarSel / 2
      const cy = 1 + r * d.tinggiSel + d.tinggiSel / 2
      // Potong teks yang kepanjangan dengan elipsis, jangan tembus ke sel sebelah.
      let teks = isi
      while (teks.length > 1 && ctx.measureText(teks).width > d.lebarSel - 10) teks = teks.slice(0, -2) + '…'
      ctx.fillText(teks, cx, cy)
    }
  }
  return { src: c.toDataURL('image/png'), w, h }
}
