import { create } from 'zustand'

/**
 * Keadaan aplikasi yang dibagi antara menu asli macOS dan layar kanvas.
 *
 * ⌘N dan ⌘P dipegang menu asli, jadi kanvas tidak pernah melihat tombolnya
 * sendiri. Aksinya masuk lewat penghitung di sini: yang menaikkan angka adalah
 * penangan menu, yang menyimaknya adalah layar kanvas.
 */
export interface TempelanTertunda {
  /** Sketsa tujuan; dikerjakan begitu kanvas itu selesai dimuat. */
  idKanvas: string
  /** Kosong/tidak ada berarti tidak ada lampiran baru — cuma penanda "kanvas
   *  ini baru dibuka untuk dibahas", supaya layar tetap dibawa ke halaman
   *  terakhirnya. Satu PDF datang sebagai array berisi satu url. */
  urls?: string[]
  nama: string
}

interface StoreApp {
  /** Sketsa yang diminta dibuka (mis. kanvas khusus murid saat pertanyaannya dibahas). */
  sketsaDiminta: { id: string; judul: string } | null
  /** Foto/PDF yang harus ditempel setelah sketsa tujuan terbuka. */
  tempelanTertunda: TempelanTertunda | null
  mintaBukaSketsa: (id: string, judul: string) => void
  setTempelanTertunda: (t: TempelanTertunda | null) => void
  /** Penghitung permintaan "sketsa baru". */
  sketsaBaru: number
  /** Penghitung permintaan cetak. */
  cetakSketsa: number
  pengaturanTerbuka: boolean
  mintaSketsaBaru: () => void
  mintaCetak: () => void
  setPengaturan: (buka: boolean) => void
}

export const useApp = create<StoreApp>((set) => ({
  sketsaDiminta: null,
  tempelanTertunda: null,
  mintaBukaSketsa: (id, judul) => set({ sketsaDiminta: { id, judul } }),
  setTempelanTertunda: (t) => set({ tempelanTertunda: t }),
  sketsaBaru: 0,
  cetakSketsa: 0,
  pengaturanTerbuka: false,
  mintaSketsaBaru: () => set((s) => ({ sketsaBaru: s.sketsaBaru + 1 })),
  mintaCetak: () => set((s) => ({ cetakSketsa: s.cetakSketsa + 1 })),
  setPengaturan: (buka) => set({ pengaturanTerbuka: buka }),
}))
