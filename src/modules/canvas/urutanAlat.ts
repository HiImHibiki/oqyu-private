/**
 * Urutan alat di bilah cepat, dan pintasan ⌘1–⌘9 yang mengikutinya.
 *
 * Pintasannya tidak menempel pada alat tertentu melainkan pada posisinya:
 * ⌘3 selalu berarti "alat ketiga dari kiri", apa pun yang ditaruh di sana.
 * Jari lebih cepat menghafal tempat daripada nama, dan tempatnya kelihatan.
 */

import { getSettingJSON, setSettingJSON } from '@/lib/db'
import type { NamaIkon } from '@/components/ui/Icon'
import { OBJEK } from './objek'
import type { Alat } from './strokes'

export const KUNCI_URUTAN_ALAT = 'urutan_alat_kanvas'

/** Sebanyak angka yang ada di baris tombol: ⌘1 sampai ⌘9. */
export const SLOT_ALAT = 9

const DASAR: { id: Alat; label: string; ikon: NamaIkon }[] = [
  { id: 'teks', label: 'Text', ikon: 'teks' },
  { id: 'pen', label: 'Pen', ikon: 'pena' },
  { id: 'pensil', label: 'Pencil', ikon: 'pensil' },
  { id: 'kaligrafi', label: 'Calligraphy', ikon: 'kaligrafi' },
  { id: 'kuas', label: 'Brush', ikon: 'kuas' },
  { id: 'spidol', label: 'Highlighter', ikon: 'spidol' },
  { id: 'penghapus', label: 'Eraser', ikon: 'penghapus' },
  { id: 'laso', label: 'Lasso', ikon: 'laso' },
  { id: 'lasoKotak', label: 'Square lasso', ikon: 'lasoKotak' },
]

/** Semua alat yang boleh ditaruh di bilah cepat. */
export const SEMUA_ALAT: { id: Alat; label: string; ikon: NamaIkon }[] = [
  ...DASAR,
  ...OBJEK.map((o) => ({ id: o.id as Alat, label: o.label, ikon: o.ikon })),
]

const PETA = new Map(SEMUA_ALAT.map((a) => [a.id, a]))

export function infoAlat(a: Alat) {
  return PETA.get(a) ?? DASAR[0]
}

export const URUTAN_BAWAAN: Alat[] = [
  'teks',
  'pen',
  'pensil',
  'kaligrafi',
  'kuas',
  'spidol',
  'penghapus',
  'lasoKotak',
  'laso',
]

/**
 * Bereskan urutan tersimpan jadi sembilan slot yang pasti sah.
 *
 * Berkas setelan bisa berasal dari versi lain, disunting tangan, atau memuat
 * alat yang sudah tidak ada. Sisa slotnya diisi dari urutan bawaan supaya
 * ⌘1–⌘9 tidak pernah menunjuk ke tempat kosong.
 */
export function rapikanUrutan(tersimpan: unknown): Alat[] {
  const masuk = Array.isArray(tersimpan) ? (tersimpan as Alat[]) : []
  const keluar: Alat[] = []
  for (const a of masuk) {
    if (PETA.has(a) && !keluar.includes(a)) keluar.push(a)
    if (keluar.length === SLOT_ALAT) break
  }
  for (const a of URUTAN_BAWAAN) {
    if (keluar.length === SLOT_ALAT) break
    if (!keluar.includes(a)) keluar.push(a)
  }
  return keluar
}

export async function muatUrutanAlat(): Promise<Alat[]> {
  return rapikanUrutan(await getSettingJSON<Alat[]>(KUNCI_URUTAN_ALAT, []))
}

export async function simpanUrutanAlat(urutan: Alat[]): Promise<void> {
  await setSettingJSON(KUNCI_URUTAN_ALAT, rapikanUrutan(urutan))
}

/**
 * Pindahkan alat ke slot `ke`.
 *
 * Kalau alatnya sudah ada di bilah, ia berpindah tempat dan yang lain bergeser
 * — bukan bertukar. Bertukar membuat dua tombol berpindah sekaligus padahal
 * yang diseret cuma satu, dan itu selalu terasa seperti salah jatuh.
 */
export function taruhAlat(urutan: Alat[], alat: Alat, ke: number): Alat[] {
  const hasil = urutan.slice()
  const dari = hasil.indexOf(alat)
  if (dari === ke) return hasil
  if (dari !== -1) {
    hasil.splice(dari, 1)
    hasil.splice(ke, 0, alat)
    return hasil
  }
  // Alat baru dari katalog bentuk: ia menggantikan isi slot yang dijatuhi.
  hasil[ke] = alat
  return hasil
}
