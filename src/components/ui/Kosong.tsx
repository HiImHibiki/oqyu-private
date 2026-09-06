import type { ReactNode } from 'react'
import { Icon, type NamaIkon } from './Icon'

/** Keadaan kosong yang tenang — tanpa badge merah, tanpa tanda seru. */
export function Kosong({
  ikon,
  judul,
  sub,
  aksi,
}: {
  ikon: NamaIkon
  judul: string
  sub?: string
  /** Satu tombol untuk keluar dari keadaan kosong ini, kalau memang ada. */
  aksi?: ReactNode
}) {
  return (
    <div className="grid h-full place-content-center justify-items-center gap-2 py-8 text-center">
      <span style={{ color: 'var(--accent)', opacity: 0.8 }}>
        <Icon nama={ikon} ukuran={44} tebal={1.2} />
      </span>
      <p style={{ color: 'var(--ink-soft)' }}>{judul}</p>
      {sub && (
        <p className="ex-label" style={{ color: 'var(--ink-faint)', maxWidth: '34ch' }}>
          {sub}
        </p>
      )}
      {aksi && <div className="pt-1">{aksi}</div>}
    </div>
  )
}
