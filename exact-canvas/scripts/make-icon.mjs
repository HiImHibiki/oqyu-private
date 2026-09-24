/**
 * Ikon aplikasi Exact Canvas, tanpa dependensi apa pun.
 * Latar indigo malam khas keluarga Exact, dengan satu goresan pena emas.
 *
 *   node scripts/make-icon.mjs && npx tauri icon src-tauri/icons/source.png
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buatKanvas, encodePng, turunkan } from './lib-png.mjs'

const ikonDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src-tauri/icons')
mkdirSync(ikonDir, { recursive: true })

const SS = 2048
const k = buatKanvas(SS)

// Latar: indigo malam, sedikit lebih terang di atas.
k.roundedRect(112, 112, SS - 224, SS - 224, 400, (_, y) => {
  const t = (y - 112) / (SS - 224)
  return [Math.round(30 - 12 * t), Math.round(46 - 22 * t), Math.round(78 - 36 * t), 1]
})

/** Garis tebal berujung bulat dari (x0,y0) ke (x1,y1); tebal boleh berubah sepanjang garis. */
function goresan(x0, y0, x1, y1, tebal0, tebal1, warna) {
  const r = Math.max(tebal0, tebal1) / 2 + 2
  const minX = Math.floor(Math.min(x0, x1) - r)
  const maxX = Math.ceil(Math.max(x0, x1) + r)
  const minY = Math.floor(Math.min(y0, y1) - r)
  const maxY = Math.ceil(Math.max(y0, y1) + r)
  const dx = x1 - x0
  const dy = y1 - y0
  const len2 = dx * dx + dy * dy || 1
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2))
      const px = x0 + t * dx
      const py = y0 + t * dy
      const d = Math.hypot(x - px, y - py)
      const setengah = (tebal0 + (tebal1 - tebal0) * t) / 2
      const a = Math.max(0, Math.min(1, setengah - d + 0.5))
      if (a > 0) k.px(x, y, warna[0], warna[1], warna[2], a * warna[3])
    }
  }
}

const emas = [201, 162, 75, 1]
const emasRedup = [201, 162, 75, 0.55]
const krem = [239, 231, 216, 0.92]

// Goresan pena utama: tipis di pangkal, menebal ke ujung — tekanan pena.
goresan(520, 1440, 1420, 560, 70, 210, emas)
// Goresan kedua yang lebih ringan di bawahnya, seperti sapuan stabilo.
goresan(560, 1640, 1240, 1100, 150, 150, emasRedup)
// Titik aksen: pena yang baru diangkat.
k.roundedRect(1380, 400, 150, 150, 75, () => krem)

const png = encodePng(turunkan(k, 1024), 1024)
const tujuan = resolve(ikonDir, 'source.png')
writeFileSync(tujuan, png)
console.log(`source.png  1024×1024  ${png.length} bytes`)
