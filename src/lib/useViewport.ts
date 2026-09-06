import { useCallback, useEffect, useRef, useState } from 'react'
import { dengarkan } from './events'
import { kecepatanGulir, kecepatanZoom, muatKecepatan } from './gulir'

export interface Tampilan {
  skala: number
  x: number
  y: number
}

const SKALA_MIN = 0.12
const SKALA_MAX = 4

/**
 * Kanvas tak terbatas: pan & zoom yang sama untuk papan sticky dan kanvas coret.
 *
 *   Trackpad: dua jari menggeser, pinch (wheel + ctrlKey) memperbesar.
 *   Papan tik: Spasi + drag menggeser, ⌘/Ctrl + scroll memperbesar.
 */
export function useViewport(awal: Partial<Tampilan> = {}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [tampilan, setTampilan] = useState<Tampilan>({
    skala: awal.skala ?? 1,
    x: awal.x ?? 0,
    y: awal.y ?? 0,
  })
  const [spasiDitekan, setSpasi] = useState(false)
  const [sedangGeser, setSedangGeser] = useState(false)
  const geser = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)

  useEffect(() => {
    const turun = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t.tagName))) return
      e.preventDefault()
      setSpasi(true)
    }
    const naik = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpasi(false)
    }
    const lepasFokus = () => setSpasi(false)
    window.addEventListener('keydown', turun)
    window.addEventListener('keyup', naik)
    window.addEventListener('blur', lepasFokus)
    return () => {
      window.removeEventListener('keydown', turun)
      window.removeEventListener('keyup', naik)
      window.removeEventListener('blur', lepasFokus)
    }
  }, [])

  /** Koordinat layar → koordinat dunia (kanvas). */
  const keDunia = useCallback(
    (clientX: number, clientY: number) => {
      const kotak = ref.current?.getBoundingClientRect()
      const ox = clientX - (kotak?.left ?? 0)
      const oy = clientY - (kotak?.top ?? 0)
      return {
        x: (ox - tampilan.x) / tampilan.skala,
        y: (oy - tampilan.y) / tampilan.skala,
      }
    },
    [tampilan],
  )

  const zoomDiTitik = useCallback((faktor: number, clientX: number, clientY: number) => {
    setTampilan((t) => {
      const kotak = ref.current?.getBoundingClientRect()
      const ox = clientX - (kotak?.left ?? 0)
      const oy = clientY - (kotak?.top ?? 0)
      const skala = Math.min(SKALA_MAX, Math.max(SKALA_MIN, t.skala * faktor))
      const rasio = skala / t.skala
      return {
        skala,
        x: ox - (ox - t.x) * rasio,
        y: oy - (oy - t.y) * rasio,
      }
    })
  }, [])

  // Kecepatan gulir dibaca sekali ke memori, lalu disegarkan kalau panel
  // pengaturan mengubahnya. Penangan wheel di bawah berjalan puluhan kali
  // sedetik dan tidak boleh menunggu database di tengah gerakan tangan.
  useEffect(() => {
    void muatKecepatan()
    return dengarkan('tampilan', () => void muatKecepatan())
  }, [])

  // Wheel dipasang manual karena React memasang listener pasif — preventDefault
  // tidak akan berpengaruh pada pinch-zoom trackpad kalau lewat props.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        zoomDiTitik(Math.exp(-e.deltaY * 0.01 * kecepatanZoom()), e.clientX, e.clientY)
      } else {
        const k = kecepatanGulir()
        setTampilan((t) => ({ ...t, x: t.x - e.deltaX * k, y: t.y - e.deltaY * k }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomDiTitik])

  const mulaiGeser = useCallback(
    (e: React.PointerEvent) => {
      geser.current = { x: e.clientX, y: e.clientY, tx: tampilan.x, ty: tampilan.y }
      setSedangGeser(true)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [tampilan],
  )

  const lanjutGeser = useCallback((e: React.PointerEvent) => {
    const g = geser.current
    if (!g) return
    setTampilan((t) => ({ ...t, x: g.tx + (e.clientX - g.x), y: g.ty + (e.clientY - g.y) }))
  }, [])

  const selesaiGeser = useCallback(() => {
    geser.current = null
    setSedangGeser(false)
  }, [])

  const reset = useCallback(() => setTampilan({ skala: 1, x: 0, y: 0 }), [])

  const zoom = useCallback(
    (faktor: number) => {
      const kotak = ref.current?.getBoundingClientRect()
      zoomDiTitik(
        faktor,
        (kotak?.left ?? 0) + (kotak?.width ?? 0) / 2,
        (kotak?.top ?? 0) + (kotak?.height ?? 0) / 2,
      )
    },
    [zoomDiTitik],
  )

  return {
    ref,
    tampilan,
    setTampilan,
    keDunia,
    zoom,
    reset,
    spasiDitekan,
    sedangGeser,
    mulaiGeser,
    lanjutGeser,
    selesaiGeser,
  }
}
