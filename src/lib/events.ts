/**
 * Bus event antar window. Semua window membaca database yang sama; setelah
 * menulis, pancarkan event agar window lain menyegarkan tampilannya.
 */
import { inTauri } from './runtime'
import { dengarkanLangsung, kirim } from './sinkron'

export type Kanal = 'canvas' | 'settings' | 'tampilan' | 'theme'

const LOKAL = 'exact-canvas://data'
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(LOKAL) : null
const lokal = new EventTarget()

type Handler = (payload?: unknown) => void

/** Beri tahu semua window bahwa `kanal` berubah. */
export async function pancarkan(kanal: Kanal, payload?: unknown): Promise<void> {
  // Layar lain di jaringan (TV, tablet, atau Mac dari sisi tablet) ikut diberi
  // tahu lewat hub; kalau tidak sedang berbagi, pesannya cuma dibuang.
  kirim({ t: 'data', kanal, payload: payload ?? null })
  if (inTauri) {
    // emit Tauri kembali juga ke window pengirim, jadi jangan dispatch lokal.
    const { emit } = await import('@tauri-apps/api/event')
    await emit(`data:${kanal}`, payload ?? null)
  } else {
    lokal.dispatchEvent(new CustomEvent(kanal, { detail: payload }))
    bc?.postMessage({ kanal, payload })
  }
}

/** Dengarkan perubahan `kanal`. Mengembalikan fungsi untuk berhenti mendengar. */
export function dengarkan(kanal: Kanal, handler: Handler): () => void {
  const onLokal = (e: Event) => handler((e as CustomEvent).detail)
  lokal.addEventListener(kanal, onLokal)

  let lepasTauri: (() => void) | null = null
  let dibatalkan = false

  if (inTauri) {
    void import('@tauri-apps/api/event').then(async ({ listen }) => {
      const un = await listen(`data:${kanal}`, (e) => handler(e.payload))
      if (dibatalkan) un()
      else lepasTauri = un
    })
  } else if (bc) {
    const onBc = (e: MessageEvent) => {
      if (e.data?.kanal === kanal) handler(e.data.payload)
    }
    bc.addEventListener('message', onBc)
    lepasTauri = () => bc.removeEventListener('message', onBc)
  }

  const lepasJaringan = dengarkanLangsung((p) => {
    if (p.t === 'data' && p.kanal === kanal) handler(p.payload)
  })

  return () => {
    dibatalkan = true
    lokal.removeEventListener(kanal, onLokal)
    lepasTauri?.()
    lepasJaringan()
  }
}
