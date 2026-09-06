/**
 * Ketebalan, kepekatan, dan pola garis — tersendiri untuk tiap alat.
 *
 * Satu slider bersama memaksa orang menyetel ulang tiap kali berganti alat:
 * stabilo mau tebal, pena mau tipis, dan keduanya dipakai bergantian dalam satu
 * halaman yang sama. Nilainya disimpan supaya bertahan antar sesi.
 */

import { getSettingJSON, setSettingJSON } from '@/lib/db'
import { ALPHA_BAWAAN, type AlatTulis, type PolaGaris } from './strokes'

export const KUNCI_SETELAN_ALAT = 'setelan_alat_kanvas'

export interface SetelanAlat {
  size: number
  alpha: number
  pola: PolaGaris
}

/** Termasuk penghapus: ukurannya juga pantas diingat sendiri. */
export type KunciAlat = AlatTulis | 'penghapus'

const UKURAN_BAWAAN: Record<KunciAlat, number> = {
  pen: 5,
  pensil: 4,
  kaligrafi: 9,
  kuas: 12,
  spidol: 16,
  penghapus: 18,
}

export function setelanBawaan(a: KunciAlat): SetelanAlat {
  return {
    size: UKURAN_BAWAAN[a] ?? 5,
    alpha: a === 'penghapus' ? 1 : (ALPHA_BAWAAN[a as AlatTulis] ?? 1),
    pola: 'utuh',
  }
}

export type PetaSetelan = Partial<Record<KunciAlat, SetelanAlat>>

function rapikan(s: unknown): PetaSetelan {
  if (!s || typeof s !== 'object') return {}
  const keluar: PetaSetelan = {}
  for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
    if (!(k in UKURAN_BAWAAN) || !v || typeof v !== 'object') continue
    const o = v as Partial<SetelanAlat>
    const bawaan = setelanBawaan(k as KunciAlat)
    keluar[k as KunciAlat] = {
      size: Number.isFinite(o.size) ? Math.min(80, Math.max(1, o.size as number)) : bawaan.size,
      alpha: Number.isFinite(o.alpha) ? Math.min(1, Math.max(0.05, o.alpha as number)) : bawaan.alpha,
      pola: o.pola === 'putus' || o.pola === 'titik' ? o.pola : 'utuh',
    }
  }
  return keluar
}

export async function muatSetelanAlat(): Promise<PetaSetelan> {
  return rapikan(await getSettingJSON<PetaSetelan>(KUNCI_SETELAN_ALAT, {}))
}

export async function simpanSetelanAlat(peta: PetaSetelan): Promise<void> {
  await setSettingJSON(KUNCI_SETELAN_ALAT, rapikan(peta))
}

/* ── Mode penghapus ────────────────────────────────────────────────── */

export const KUNCI_MODE_PENGHAPUS = 'mode_penghapus_kanvas'

export type ModePenghapus = 'sebagian' | 'goresan'

/**
 * Bawaannya menghapus seluruh goresan, bukan sebagian.
 *
 * Penghapus sebagian lebih pintar dan lebih jarang dimaui. Yang dilakukan
 * tangan sembilan dari sepuluh kali adalah "huruf ini salah, buang" — dan
 * untuk itu penghapus sebagian menuntut menggosok bolak-balik sampai bersih,
 * meninggalkan serpihan goresan tiap kali kurang teliti. Satu sentuhan yang
 * membuang satu goresan utuh menyelesaikannya sekali jalan.
 *
 * Pilihannya tetap ada dan tetap diingat: yang menggambar arsiran memang butuh
 * memotong sebagian, dan ia tidak perlu memilihnya ulang tiap membuka sketsa.
 */
export const MODE_PENGHAPUS_BAWAAN: ModePenghapus = 'goresan'

export async function muatModePenghapus(): Promise<ModePenghapus> {
  const m = await getSettingJSON<string>(KUNCI_MODE_PENGHAPUS, MODE_PENGHAPUS_BAWAAN)
  return m === 'sebagian' || m === 'goresan' ? m : MODE_PENGHAPUS_BAWAAN
}

export async function simpanModePenghapus(m: ModePenghapus): Promise<void> {
  await setSettingJSON(KUNCI_MODE_PENGHAPUS, m)
}

/* ── Bentuk otomatis ───────────────────────────────────────────────── */

export const KUNCI_AUTO_BENTUK = 'auto_bentuk_kanvas'

/**
 * Kenali bentuk begitu pena diangkat, tanpa harus menahan.
 *
 * Mati secara bawaan: saat menulis huruf, "o" yang berubah jadi lingkaran
 * adalah gangguan. Saat mengajar geometri, menyalakannya berarti setiap
 * segitiga dan lingkaran langsung rapi tanpa jeda.
 */
export async function muatAutoBentuk(): Promise<boolean> {
  return (await getSettingJSON<boolean>(KUNCI_AUTO_BENTUK, false)) === true
}

export async function simpanAutoBentuk(on: boolean): Promise<void> {
  await setSettingJSON(KUNCI_AUTO_BENTUK, on)
}
