import { useEffect, type ReactNode } from 'react'
import { IconButton } from './Button'

interface Props {
  buka: boolean
  judul: string
  onTutup: () => void
  children: ReactNode
  lebar?: number
}

export function Modal({ buka, judul, onTutup, children, lebar = 560 }: Props) {
  useEffect(() => {
    if (!buka) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onTutup()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [buka, onTutup])

  if (!buka) return null

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-6"
      style={{ background: 'color-mix(in srgb, var(--bg) 72%, transparent)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onTutup()
      }}
    >
      <div
        className="ex-card flex max-h-[85vh] w-full flex-col"
        style={{ maxWidth: lebar, boxShadow: 'var(--shadow-lift)' }}
        role="dialog"
        aria-modal="true"
        aria-label={judul}
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          <h2 className="ex-module-title">{judul}</h2>
          <IconButton nama="silang" label="Close" onClick={onTutup} />
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
      </div>
    </div>
  )
}
