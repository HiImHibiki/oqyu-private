/**
 * Memadatkan satu halaman kanvas jadi gambar yang muat anggaran byte-nya —
 * dipakai bersama oleh ekspor PDF di app guru dan di HP murid, supaya
 * keduanya menghasilkan berkas dengan aturan ukuran yang sama persis.
 */

export const ANGGARAN_PDF = 10 * 1024 * 1024

type RupaGambar = 'PNG' | 'JPEG'

/** Ukuran byte sebenarnya dari sebuah data URL base64. */
export function byteDataUrl(url: string): number {
  const isi = url.slice(url.indexOf(',') + 1)
  const bantalan = isi.endsWith('==') ? 2 : isi.endsWith('=') ? 1 : 0
  return Math.floor((isi.length * 3) / 4) - bantalan
}

function kecilkanKanvas(c: HTMLCanvasElement, faktor: number): HTMLCanvasElement {
  if (faktor >= 1) return c
  const k = document.createElement('canvas')
  k.width = Math.max(1, Math.round(c.width * faktor))
  k.height = Math.max(1, Math.round(c.height * faktor))
  const ctx = k.getContext('2d')
  if (!ctx) return c
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(c, 0, 0, k.width, k.height)
  return k
}

/**
 * Padatkan satu halaman sampai muat anggarannya, sekecil mungkin kerugiannya.
 *
 * PNG dicoba lebih dulu: garis hitam di atas putih sering justru lebih kecil
 * sekaligus utuh sepenuhnya. Kalau tidak muat, mutu JPEG diturunkan bertahap,
 * dan baru sesudah mutu habis ukuran pikselnya yang dikecilkan — menurunkan
 * mutu lebih dulu menjaga garis tetap tajam, sedangkan mengecilkan piksel
 * lebih dulu membuatnya kabur pada mutu berapa pun.
 */
export function padatkanHalaman(
  c: HTMLCanvasElement,
  sasaran: number,
): { data: string; rupa: RupaGambar; byte: number } {
  const png = c.toDataURL('image/png')
  let terkecil = { data: png, rupa: 'PNG' as RupaGambar, byte: byteDataUrl(png) }
  if (terkecil.byte <= sasaran) return terkecil

  for (const faktor of [1, 0.8, 0.65, 0.5, 0.4]) {
    const kecil = kecilkanKanvas(c, faktor)
    for (const mutu of [0.92, 0.85, 0.78, 0.7]) {
      const jpg = kecil.toDataURL('image/jpeg', mutu)
      const byte = byteDataUrl(jpg)
      if (byte <= sasaran) return { data: jpg, rupa: 'JPEG', byte }
      if (byte < terkecil.byte) terkecil = { data: jpg, rupa: 'JPEG', byte }
    }
  }
  // Tidak ada yang muat: kembalikan yang paling kecil dan biarkan pemanggil
  // memberitahu bahwa anggarannya terlampaui, bukan diam-diam mengira berhasil.
  return terkecil
}
