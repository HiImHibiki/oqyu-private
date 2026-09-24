import { useEffect } from 'react'
import { useToast, type Pesan } from '@/lib/toast'
import { Icon } from './ui/Icon'

/** Pesan tanpa tombol hilang lebih cepat; yang menawarkan urungkan diberi waktu. */
const JEDA_BIASA = 4000
const JEDA_AKSI = 9000

export function Toast() {
  const antrean = useToast((s) => s.antrean)

  if (antrean.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed bottom-5 left-1/2 z-[9000] flex flex-col items-center gap-2"
      style={{ transform: 'translateX(-50%)' }}
      role="status"
      aria-live="polite"
    >
      {antrean.map((p) => (
        <Baris key={p.id} pesan={p} />
      ))}
    </div>
  )
}

function Baris({ pesan }: { pesan: Pesan }) {
  const tutup = useToast((s) => s.tutup)

  useEffect(() => {
    const t = window.setTimeout(() => tutup(pesan.id), pesan.aksi ? JEDA_AKSI : JEDA_BIASA)
    return () => window.clearTimeout(t)
  }, [pesan.id, pesan.aksi, tutup])

  return (
    <div
      className="ex-card ex-masuk pointer-events-auto flex items-center gap-3 py-2 pl-4 pr-2"
      style={{
        boxShadow: 'var(--shadow-lift)',
        background: 'color-mix(in srgb, var(--surface) 96%, var(--bg))',
        backdropFilter: 'var(--blur-surface)',
        borderColor: pesan.nada === 'galat' ? 'var(--down)' : 'var(--line-strong)',
        maxWidth: '68ch',
      }}
    >
      {pesan.nada === 'galat' && (
        <span style={{ color: 'var(--down)' }}>
          <Icon nama="silang" ukuran={15} />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate" style={{ fontSize: 'var(--fs-label)' }}>
        {pesan.teks}
      </span>

      {pesan.aksi && (
        <button
          className="ex-btn shrink-0"
          data-variant="accent"
          onClick={() => {
            void pesan.aksi?.jalankan()
            tutup(pesan.id)
          }}
        >
          {pesan.aksi.label}
        </button>
      )}

      <button
        className="ex-btn shrink-0"
        data-variant="ghost"
        style={{ padding: 4 }}
        aria-label="Dismiss notification"
        onClick={() => tutup(pesan.id)}
      >
        <Icon nama="silang" ukuran={13} />
      </button>
    </div>
  )
}
