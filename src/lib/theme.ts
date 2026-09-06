/**
 * Sistem tema. Ganti tema = ganti satu atribut data-theme di <html>.
 * Komponen tidak pernah tahu warna apa pun — semuanya var(--token).
 */
import { create } from 'zustand'
import { getSetting, setSetting } from './db'
import { dengarkan, pancarkan } from './events'
import { inTauri } from './runtime'

export const TEMA = [
  { id: 'kaca', nama: 'Glass', sub: 'Modern night — glass panels in a dark room' },
  { id: 'kertas', nama: 'Paper', sub: 'Daylight — white paper, burnt orange ink' },
  { id: 'klasik', nama: 'Classic', sub: 'Private library — ivory paper, wine ink' },
  { id: 'anggun', nama: 'Elegant', sub: 'After hours — neutral black, champagne' },
  { id: 'mutiara', nama: 'Pearl', sub: 'Elegant by daylight — ivory, warm grey, rose gold' },
  { id: 'tanah', nama: 'Terracotta', sub: 'Earthy — sun-dried clay, raw linen, olive' },
  { id: 'rimba', nama: 'Woodland', sub: 'Earthy dark — moss, bark, moonlight' },
  { id: 'mochi', nama: 'Mochi', sub: 'Cute and calm — cream, matcha, strawberry milk' },
  { id: 'piksel', nama: '8-Bit', sub: 'Console colour, hard pixels' },
  { id: 'grimoire', nama: 'Grimoire', sub: 'Magic academia — parchment, gold, candlelight' },
  { id: 'arsip', nama: 'Archive', sub: 'Vintage 1954 — manila folders, rubber stamps' },
  { id: 'batik', nama: 'Indigo Batik', sub: 'Indigo, gold leaf, kawung' },
  { id: 'fosfor', nama: 'Phosphor', sub: 'Green terminal — monospace' },
  { id: 'senja', nama: 'Dusk', sub: 'Neon at day’s end — magenta, cyan, orange' },
  { id: 'laut', nama: 'Seabed', sub: 'Cartoon underwater — bubbles, bold outlines' },
  { id: 'samudra', nama: 'High Seas', sub: 'Pirate adventure — treasure maps, waves' },
  { id: 'permen', nama: 'Candy', sub: 'Sweet pastels — all rounded, soft and bright' },
  { id: 'arena', nama: 'Arena', sub: 'Game interface — HUD panels, cut corners' },
] as const

export type TemaId = (typeof TEMA)[number]['id']

const DEFAULT: TemaId = 'kaca'

interface StoreTema {
  tema: TemaId
  siap: boolean
  muat: () => Promise<void>
  ganti: (t: TemaId) => Promise<void>
  siklus: () => Promise<void>
}

function terapkan(t: TemaId) {
  document.documentElement.dataset.theme = t
}

export const useTema = create<StoreTema>((set, get) => ({
  tema: DEFAULT,
  siap: false,

  async muat() {
    let tema: TemaId = DEFAULT
    if (inTauri) {
      try {
        const simpan = (await getSetting('theme')) as TemaId | null
        if (simpan && TEMA.some((t) => t.id === simpan)) tema = simpan
      } catch {
        /* database belum siap — pakai default */
      }
    }
    terapkan(tema)
    set({ tema, siap: true })
  },

  async ganti(t) {
    terapkan(t)
    set({ tema: t })
    if (inTauri) {
      await setSetting('theme', t).catch(() => {})
      await pancarkan('theme', t)
    }
  },

  async siklus() {
    const i = TEMA.findIndex((t) => t.id === get().tema)
    await get().ganti(TEMA[(i + 1) % TEMA.length].id)
  },
}))

/** Muat tema tersimpan dan sinkronkan antar window. */
export function pasangTema(): () => void {
  void useTema.getState().muat()
  return dengarkan('theme', (t) => {
    const tema = t as TemaId
    if (tema && tema !== useTema.getState().tema) {
      terapkan(tema)
      useTema.setState({ tema })
    }
  })
}
