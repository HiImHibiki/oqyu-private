/**
 * Kecepatan menggulir kanvas tak terbatas.
 *
 * Satu angka untuk kanvas coret, papan gabus, dan peta catatan — ketiganya
 * memakai viewport yang sama, dan tangan yang sama pula. Trackpad Apple
 * mengirim delta yang halus sementara mouse roda mengirim lompatan 100 piksel
 * sekali putar; yang nyaman untuk satu di antaranya hampir selalu salah untuk
 * yang lain, dan tidak ada angka bawaan yang benar untuk keduanya.
 */

import { getSetting, setSetting } from './db'
import { pancarkan } from './events'
import { inTauri } from './runtime'

export const KUNCI_GULIR = 'kecepatan_gulir'
export const KUNCI_ZOOM = 'kecepatan_zoom'

export const GULIR_BAWAAN = 1
export const ZOOM_BAWAAN = 1

/** Batasnya sengaja lebar: 0,25× untuk mouse roda, 3× untuk trackpad yang berat. */
export const GULIR_MIN = 0.25
export const GULIR_MAKS = 3

function jepit(n: unknown, bawaan: number): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return bawaan
  return Math.min(GULIR_MAKS, Math.max(GULIR_MIN, v))
}

/**
 * Nilai yang dipegang di memori.
 *
 * Penangan `wheel` berjalan puluhan kali sedetik dan tidak boleh menunggu
 * database; ia membaca angka ini apa adanya. Yang menyegarkannya adalah
 * pemuatan sekali di awal dan siaran perubahan dari panel pengaturan.
 */
let gulir = GULIR_BAWAAN
let zoom = ZOOM_BAWAAN

export function kecepatanGulir(): number {
  return gulir
}

export function kecepatanZoom(): number {
  return zoom
}

export async function muatKecepatan(): Promise<{ gulir: number; zoom: number }> {
  if (!inTauri) return { gulir, zoom }
  const [g, z] = await Promise.all([
    getSetting(KUNCI_GULIR).catch(() => null),
    getSetting(KUNCI_ZOOM).catch(() => null),
  ])
  gulir = jepit(g, GULIR_BAWAAN)
  zoom = jepit(z, ZOOM_BAWAAN)
  return { gulir, zoom }
}

export async function simpanKecepatan(n: { gulir?: number; zoom?: number }): Promise<void> {
  if (n.gulir != null) {
    gulir = jepit(n.gulir, GULIR_BAWAAN)
    await setSetting(KUNCI_GULIR, String(gulir))
  }
  if (n.zoom != null) {
    zoom = jepit(n.zoom, ZOOM_BAWAAN)
    await setSetting(KUNCI_ZOOM, String(zoom))
  }
  await pancarkan('tampilan')
}
