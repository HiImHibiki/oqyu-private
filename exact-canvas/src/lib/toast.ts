import { create } from 'zustand'

/**
 * Pemberitahuan sekilas di dalam aplikasi.
 *
 * Alasan utamanya bukan kabar baik, tapi jaring pengaman: setiap penghapusan
 * menawarkan "Urungkan" alih-alih memasang dialog konfirmasi. Dialog memaksa
 * berhenti di setiap penghapusan; urungkan hanya menyita waktu saat memang salah.
 */
export interface Pesan {
  id: number
  teks: string
  nada: 'biasa' | 'galat'
  aksi?: { label: string; jalankan: () => void | Promise<void> }
}

interface StoreToast {
  antrean: Pesan[]
  tampilkan: (p: Omit<Pesan, 'id'>) => number
  tutup: (id: number) => void
}

let urutan = 0

export const useToast = create<StoreToast>((set) => ({
  antrean: [],
  tampilkan(p) {
    const id = ++urutan
    // Maksimal tiga sekaligus; yang tertua mundur duluan.
    set((s) => ({ antrean: [...s.antrean.slice(-2), { ...p, id }] }))
    return id
  },
  tutup(id) {
    set((s) => ({ antrean: s.antrean.filter((p) => p.id !== id) }))
  },
}))

export function toast(teks: string, aksi?: Pesan['aksi']): number {
  return useToast.getState().tampilkan({ teks, nada: 'biasa', aksi })
}

export function toastGalat(teks: string): number {
  return useToast.getState().tampilkan({ teks, nada: 'galat' })
}

/**
 * Pola yang dipakai semua penghapusan: kerjakan, lalu tawarkan pemulihan.
 * `pulihkan` menerima apa pun yang dikembalikan `hapus`.
 */
export async function hapusDenganUrungkan<T>(
  teks: string,
  hapus: () => Promise<T>,
  pulihkan: (simpanan: T) => Promise<void>,
): Promise<void> {
  try {
    const simpanan = await hapus()
    toast(teks, {
      label: 'Undo',
      jalankan: async () => {
        try {
          await pulihkan(simpanan)
          toast('Restored.')
        } catch (e) {
          toastGalat(e instanceof Error ? e.message : 'Could not restore.')
        }
      },
    })
  } catch (e) {
    toastGalat(e instanceof Error ? e.message : 'Could not delete.')
  }
}
