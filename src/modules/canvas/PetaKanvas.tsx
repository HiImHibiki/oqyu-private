import { useEffect, useMemo, useRef } from 'react'
import type { Tampilan } from '@/lib/useViewport'
import { IconButton } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { warnaToken, type Kotak } from './strokes'

/**
 * Penunjuk arah di pojok kanvas.
 *
 * Dua mode kanvas tersesat dengan cara yang berbeda, jadi pertolongannya juga
 * berbeda: di mode halaman yang hilang adalah "halaman ke berapa ini", di
 * kanvas tak terbatas yang hilang adalah "saya sedang di sebelah mana". Satu
 * panel, dua isi, di sudut yang sama.
 */

const LEBAR = 176
const TEBAL_PRATINJAU = 30
const TINGGI_PRATINJAU = 42

/* ── Mode halaman ──────────────────────────────────────────────────── */

export function DaftarHalaman({
  jumlah,
  aktif,
  berisi,
  pratinjau,
  bolehTambah,
  onLompat,
  onSisip,
  onHapus,
  onTambah,
  onSembunyi,
}: {
  jumlah: number
  aktif: number
  /** Halaman mana yang sudah ada isinya — titik kecil di daftar. */
  berisi: boolean[]
  /** Data URL pratinjau tiap halaman; kosong sampai yang pertama selesai. */
  pratinjau: string[]
  bolehTambah: boolean
  onLompat: (i: number) => void
  onSisip: (i: number) => void
  onHapus: (i: number) => void
  onTambah: () => void
  /** Lipat panelnya; tombol kecil di pojok yang sama membukanya lagi. */
  onSembunyi: () => void
}) {
  const barisRef = useRef<HTMLDivElement | null>(null)

  // Halaman yang sedang dilihat dibawa ke dalam daftar; pada sketsa 30 halaman,
  // daftar yang tidak ikut bergulir sama saja dengan tidak ada.
  useEffect(() => {
    barisRef.current?.scrollIntoView({ block: 'nearest' })
  }, [aktif])

  return (
    <div className="ex-card ex-bilah absolute bottom-3 right-3 flex flex-col p-1" style={{ width: LEBAR }}>
      <div className="flex items-center justify-between pl-2">
        <p className="ex-label py-1" style={{ color: 'var(--ink-faint)' }}>
          {jumlah} page{jumlah > 1 ? 's' : ''}
        </p>
        <IconButton
          nama="bawah"
          label="Hide the page thumbnails"
          ukuran={13}
          onClick={onSembunyi}
        />
      </div>

      <div className="flex flex-col gap-px overflow-y-auto" style={{ maxHeight: 300 }}>
        {Array.from({ length: jumlah }, (_, i) => (
          <div
            key={i}
            ref={i === aktif ? barisRef : undefined}
            className="ex-btn justify-start"
            data-variant={i === aktif ? 'accent' : 'ghost'}
            style={{ cursor: 'pointer', padding: '4px 6px', gap: 7 }}
            onClick={() => onLompat(i)}
          >
            {/* Pratinjau lebih cepat dibaca daripada nomor, tapi nomornya tetap
                ada: "halaman 12" adalah cara orang menyebutnya ke orang lain. */}
            <span
              aria-hidden
              style={{
                width: TEBAL_PRATINJAU,
                height: TINGGI_PRATINJAU,
                flexShrink: 0,
                borderRadius: 1,
                border: '1px solid var(--line)',
                background: pratinjau[i]
                  ? `#fff center/contain no-repeat url("${pratinjau[i]}")`
                  : 'var(--paper)',
              }}
            />
            <span style={{ width: 18, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {i + 1}
            </span>
            <span
              aria-hidden
              title={berisi[i] ? 'Has drawings' : 'Empty'}
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: berisi[i] ? 'currentColor' : 'transparent',
                border: berisi[i] ? 'none' : '1px solid var(--ink-faint)',
                opacity: 0.7,
              }}
            />
            <span className="flex-1" />
            <IconButton
              nama="tambah"
              label={`Insert a page before page ${i + 1}`}
              ukuran={13}
              onClick={(e) => {
                e.stopPropagation()
                onSisip(i)
              }}
            />
            <IconButton
              nama="hapus"
              label={`Delete page ${i + 1} and everything on it`}
              ukuran={13}
              onClick={(e) => {
                e.stopPropagation()
                onHapus(i)
              }}
            />
          </div>
        ))}
      </div>

      <button
        className="ex-btn mt-1 justify-center"
        data-variant="ghost"
        disabled={!bolehTambah}
        title="Add a page at the end"
        onClick={onTambah}
      >
        <Icon nama="tambah" ukuran={14} /> Add page
      </button>
    </div>
  )
}

/* ── Mode kanvas tak terbatas ──────────────────────────────────────── */

const PETA_L = 176
const PETA_T = 116
const TEPI = 12

/**
 * Peta kecil isi kanvas.
 *
 * Digambar ke <canvas>, bukan sebagai elemen per coretan: satu sketsa bisa
 * berisi ribuan goresan, dan ribuan <span> di pojok layar akan memakan lebih
 * banyak tenaga daripada kanvas yang digambarnya.
 */
export function PetaBebas({
  kotak,
  tampilan,
  ukuranLayar,
  onLompat,
}: {
  kotak: Kotak[]
  tampilan: Tampilan
  ukuranLayar: { w: number; h: number }
  onLompat: (x: number, y: number) => void
}) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  const peta = useMemo(() => {
    if (kotak.length === 0 || ukuranLayar.w === 0) return null
    // Batas dunia mencakup isi sekaligus layar yang sedang terlihat, supaya
    // penanda posisi tidak pernah keluar dari petanya.
    const kiri = -tampilan.x / tampilan.skala
    const atas = -tampilan.y / tampilan.skala
    const kanan = kiri + ukuranLayar.w / tampilan.skala
    const bawah = atas + ukuranLayar.h / tampilan.skala

    const x1 = Math.min(kiri, ...kotak.map((k) => k.x1))
    const y1 = Math.min(atas, ...kotak.map((k) => k.y1))
    const x2 = Math.max(kanan, ...kotak.map((k) => k.x2))
    const y2 = Math.max(bawah, ...kotak.map((k) => k.y2))

    const skala = Math.min(
      (PETA_L - TEPI * 2) / Math.max(1, x2 - x1),
      (PETA_T - TEPI * 2) / Math.max(1, y2 - y1),
    )
    return { x1, y1, skala, layar: { kiri, atas, kanan, bawah } }
  }, [kotak, tampilan, ukuranLayar])

  useEffect(() => {
    const el = ref.current
    if (!el || !peta) return
    const dpr = window.devicePixelRatio || 1
    el.width = Math.round(PETA_L * dpr)
    el.height = Math.round(PETA_T * dpr)
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, PETA_L, PETA_T)

    const ke = (x: number, y: number): [number, number] => [
      (x - peta.x1) * peta.skala + TEPI,
      (y - peta.y1) * peta.skala + TEPI,
    ]

    ctx.fillStyle = warnaToken('ink')
    ctx.globalAlpha = 0.55
    for (const k of kotak) {
      const [px, py] = ke(k.x1, k.y1)
      ctx.fillRect(px, py, Math.max(1.5, (k.x2 - k.x1) * peta.skala), Math.max(1.5, (k.y2 - k.y1) * peta.skala))
    }

    ctx.globalAlpha = 1
    const [lx, ly] = ke(peta.layar.kiri, peta.layar.atas)
    const lw = (peta.layar.kanan - peta.layar.kiri) * peta.skala
    const lh = (peta.layar.bawah - peta.layar.atas) * peta.skala
    ctx.fillStyle = warnaToken('accent')
    ctx.globalAlpha = 0.12
    ctx.fillRect(lx, ly, lw, lh)
    ctx.globalAlpha = 1
    ctx.strokeStyle = warnaToken('accent')
    ctx.lineWidth = 1
    ctx.strokeRect(lx + 0.5, ly + 0.5, lw, lh)
  }, [kotak, peta])

  if (!peta) return null

  return (
    <canvas
      ref={ref}
      className="ex-card absolute bottom-3 right-3"
      style={{ width: PETA_L, height: PETA_T, cursor: 'pointer' }}
      title="Click to jump to that part of the canvas"
      onPointerDown={(e) => {
        const b = e.currentTarget.getBoundingClientRect()
        onLompat(
          peta.x1 + (e.clientX - b.left - TEPI) / peta.skala,
          peta.y1 + (e.clientY - b.top - TEPI) / peta.skala,
        )
      }}
    />
  )
}
