/**
 * Encoder PNG minimal — hanya butuh zlib bawaan Node.
 * Dipakai skrip ikon supaya proyek ini tidak menarik pustaka gambar apa pun.
 */
import { deflateSync } from 'node:zlib'

/** Kanvas RGBA sederhana dengan alpha blending, digambar pada resolusi ganda. */
export function buatKanvas(ukuran) {
  const buf = new Float32Array(ukuran * ukuran * 4)

  function px(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= ukuran || y >= ukuran || a <= 0) return
    const i = (y * ukuran + x) * 4
    const inv = 1 - a
    buf[i] = buf[i] * inv + r * a
    buf[i + 1] = buf[i + 1] * inv + g * a
    buf[i + 2] = buf[i + 2] * inv + b * a
    buf[i + 3] = buf[i + 3] * inv + a
  }

  /** Persegi bersudut bulat; `warna(x, y)` mengembalikan [r, g, b, a]. */
  function roundedRect(x0, y0, w, h, radius, warna) {
    const x1 = x0 + w
    const y1 = y0 + h
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
        const dx = Math.max(x0 + radius - x, 0, x - (x1 - radius))
        const dy = Math.max(y0 + radius - y, 0, y - (y1 - radius))
        if (Math.hypot(dx, dy) > radius) continue
        const [r, g, b, a] = warna(x, y)
        px(x, y, r, g, b, a)
      }
    }
  }

  return { buf, ukuran, px, roundedRect }
}

export const solid = (r, g, b, a = 1) => () => [r, g, b, a]

/** Turunkan resolusi (anti-alias) lalu keluarkan buffer RGBA 8-bit. */
export function turunkan(kanvas, keluaran) {
  const skala = kanvas.ukuran / keluaran
  const out = Buffer.alloc(keluaran * keluaran * 4)
  for (let y = 0; y < keluaran; y++) {
    for (let x = 0; x < keluaran; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < skala; sy++) {
        for (let sx = 0; sx < skala; sx++) {
          const i = ((y * skala + sy) * kanvas.ukuran + (x * skala + sx)) * 4
          r += kanvas.buf[i]; g += kanvas.buf[i + 1]; b += kanvas.buf[i + 2]; a += kanvas.buf[i + 3]
        }
      }
      const n = skala * skala
      const o = (y * keluaran + x) * 4
      out[o] = Math.round(r / n)
      out[o + 1] = Math.round(g / n)
      out[o + 2] = Math.round(b / n)
      out[o + 3] = Math.round((a / n) * 255)
    }
  }
  return out
}

function crc32(bytes) {
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })())
  let crc = -1
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

export function encodePng(rgba, ukuran) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ukuran, 0)
  ihdr.writeUInt32BE(ukuran, 4)
  ihdr[8] = 8 // kedalaman bit
  ihdr[9] = 6 // RGBA

  const baris = ukuran * 4 + 1
  const raw = Buffer.alloc(ukuran * baris)
  for (let y = 0; y < ukuran; y++) {
    raw[y * baris] = 0 // filter: none
    rgba.copy(raw, y * baris + 1, y * ukuran * 4, (y + 1) * ukuran * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
