import { create } from 'zustand'

/**
 * Keadaan aplikasi yang dibagi antara menu asli macOS dan layar kanvas.
 *
 * ⌘N dan ⌘P dipegang menu asli, jadi kanvas tidak pernah melihat tombolnya
 * sendiri. Aksinya masuk lewat penghitung di sini: yang menaikkan angka adalah
 * penangan menu, yang menyimaknya adalah layar kanvas.
 */
interface StoreApp {
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
  sketsaBaru: 0,
  cetakSketsa: 0,
  pengaturanTerbuka: false,
  mintaSketsaBaru: () => set((s) => ({ sketsaBaru: s.sketsaBaru + 1 })),
  mintaCetak: () => set((s) => ({ cetakSketsa: s.cetakSketsa + 1 })),
  setPengaturan: (buka) => set({ pengaturanTerbuka: buka }),
}))
