/**
 * Menyimpan hasil ekspor: di Mac lewat dialog simpan, di browser lewat unduhan.
 *
 * Kanvas yang sama berjalan di dua tempat, dan "simpan PDF" harus berarti
 * sesuatu di keduanya. Di tablet tidak ada disk Mac yang bisa dituju, jadi
 * berkasnya diserahkan ke browser — yang lalu menawarkan menyimpan atau
 * membagikannya ke WhatsApp.
 */

import { inTauri } from './runtime'

/** Tanya tujuan penyimpanan. `null` berarti dibatalkan. Di web selalu 'web'. */
export async function pilihTujuan(namaBawaan: string, ext: string, label = ext.toUpperCase()): Promise<string | null> {
  if (!inTauri) return 'web'
  const { save } = await import('@tauri-apps/plugin-dialog')
  return save({ defaultPath: namaBawaan, filters: [{ name: label, extensions: [ext] }] })
}

/**
 * Tulis byte ke tujuan dari `pilihTujuan`.
 *
 * `buka` meminta berkasnya langsung dibuka: di Mac lewat penampil bawaan
 * (tempat dialog cetak berada), di browser di tab baru.
 */
export async function tulisBerkas(
  tujuan: string,
  bytes: Uint8Array,
  mime: string,
  nama: string,
  opsi: { buka?: boolean } = {},
): Promise<void> {
  if (inTauri) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('write_bytes', { path: tujuan, bytes: Array.from(bytes) })
    if (opsi.buka) await invoke('print_pdf', { path: tujuan })
    return
  }
  const blob = new Blob([bytes as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  if (opsi.buka) {
    const tab = window.open(url, '_blank')
    if (!tab) unduh(url, nama)
  } else {
    unduh(url, nama)
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function unduh(url: string, nama: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = nama
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
