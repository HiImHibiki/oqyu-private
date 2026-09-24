import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type NamaIkon } from './Icon'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  varian?: 'biasa' | 'accent' | 'ghost'
  ikon?: NamaIkon
  children?: ReactNode
}

export function Button({ varian = 'biasa', ikon, children, className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      data-variant={varian}
      className={`ex-btn inline-flex items-center gap-2 ${className}`}
      {...rest}
    >
      {ikon && <Icon nama={ikon} ukuran={16} />}
      {children}
    </button>
  )
}

interface IkonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  nama: NamaIkon
  label: string
  aktif?: boolean
  ukuran?: number
}

/** Tombol khusus ikon — selalu punya label untuk pembaca layar. */
export function IconButton({ nama, label, aktif, ukuran = 18, className = '', ...rest }: IkonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={aktif}
      className={`ex-btn grid place-items-center ${className}`}
      data-variant={aktif ? 'accent' : 'ghost'}
      style={{ padding: 7 }}
      {...rest}
    >
      <Icon nama={nama} ukuran={ukuran} />
    </button>
  )
}
