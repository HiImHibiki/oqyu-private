import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/Button'
import {
  WARNA_FUNGSI,
  grafikBawaan,
  renderGrafik,
  type DefinisiGrafik,
  type HasilGrafik,
} from './sisipan'

/**
 * Penyusun grafik fungsi: beberapa fungsi sekaligus, rentang sumbu, petak.
 * Pratinjaunya adalah gambar yang persis akan ditempel ke kanvas.
 */
export function PanelGrafik({
  buka,
  awal,
  onTutup,
  onSisip,
}: {
  buka: boolean
  awal: DefinisiGrafik | null
  onTutup: () => void
  onSisip: (d: DefinisiGrafik, hasil: HasilGrafik) => void
}) {
  const [d, setD] = useState<DefinisiGrafik>(grafikBawaan)
  const [hasil, setHasil] = useState<HasilGrafik | null>(null)

  useEffect(() => {
    if (buka) setD(awal ? structuredClone(awal) : grafikBawaan())
  }, [buka, awal])

  // Pratinjau dirender sejenak setelah ketikan berhenti, bukan tiap huruf.
  useEffect(() => {
    if (!buka) return
    const t = window.setTimeout(() => setHasil(renderGrafik(d, 1.5)), 140)
    return () => window.clearTimeout(t)
  }, [buka, d])

  const galat = useMemo(() => new Map(hasil?.galat.map((g) => [g.ekspresi, g.pesan]) ?? []), [hasil])

  const ubah = (u: Partial<DefinisiGrafik>) => setD((lama) => ({ ...lama, ...u }))
  const ubahFungsi = (i: number, ekspresi: string) =>
    setD((lama) => ({ ...lama, fungsi: lama.fungsi.map((f, j) => (j === i ? { ...f, ekspresi } : f)) }))
  const ubahWarna = (i: number, warna: string) =>
    setD((lama) => ({ ...lama, fungsi: lama.fungsi.map((f, j) => (j === i ? { ...f, warna } : f)) }))

  const angka = (label: string, kunci: 'xMin' | 'xMax' | 'yMin' | 'yMax', mati = false) => (
    <label className="ex-label flex items-center gap-1" style={{ color: 'var(--ink-soft)', opacity: mati ? 0.45 : 1 }}>
      {label}
      <input
        type="number"
        className="ex-input"
        disabled={mati}
        style={{ width: 74, padding: '4px 6px' }}
        value={d[kunci]}
        step="any"
        onChange={(e) => ubah({ [kunci]: Number(e.target.value) } as Partial<DefinisiGrafik>)}
      />
    </label>
  )

  return (
    <Modal buka={buka} judul={awal ? 'Edit graph' : 'Function graph'} onTutup={onTutup} lebar={760}>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.15fr)' }}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {d.fungsi.map((f, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <label
                    className="shrink-0"
                    title="Colour"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      background: f.warna,
                      border: '1px solid var(--line-strong)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="color"
                      value={f.warna}
                      onChange={(e) => ubahWarna(i, e.target.value)}
                      style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                      aria-label={`Colour of function ${i + 1}`}
                    />
                  </label>
                  <span className="ex-num ex-label shrink-0" style={{ color: 'var(--ink-faint)' }}>
                    y =
                  </span>
                  <input
                    className="ex-input ex-num"
                    style={{ padding: '6px 8px', borderColor: galat.has(f.ekspresi) ? 'var(--down)' : undefined }}
                    value={f.ekspresi}
                    placeholder="e.g. 2x + 1, sin(x), x^2 - 4"
                    spellCheck={false}
                    autoFocus={i === d.fungsi.length - 1 && !awal}
                    onChange={(e) => ubahFungsi(i, e.target.value)}
                  />
                  <IconButton
                    nama="silang"
                    label="Remove this function"
                    ukuran={14}
                    disabled={d.fungsi.length === 1}
                    onClick={() => ubah({ fungsi: d.fungsi.filter((_, j) => j !== i) })}
                  />
                </div>
                {galat.has(f.ekspresi) && f.ekspresi.trim() && (
                  <p className="ex-label pl-8" style={{ color: 'var(--down)', fontSize: 11 }}>
                    {galat.get(f.ekspresi)}
                  </p>
                )}
              </div>
            ))}
            <button
              className="ex-btn self-start"
              data-variant="ghost"
              disabled={d.fungsi.length >= 6}
              onClick={() =>
                ubah({
                  fungsi: [
                    ...d.fungsi,
                    { ekspresi: '', warna: WARNA_FUNGSI[d.fungsi.length % WARNA_FUNGSI.length] },
                  ],
                })
              }
            >
              <Icon nama="tambah" ukuran={14} /> Add function
            </button>
          </div>

          <p className="ex-label" style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
            Uses x. Supports + − × ÷ ^, sin cos tan, sqrt, abs, ln, log, exp, pi, e. Implicit
            products like 2x and 3sin(x) work.
          </p>

          <div className="flex flex-wrap gap-2">
            {angka('x from', 'xMin')}
            {angka('to', 'xMax')}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {angka('y from', 'yMin', d.yOtomatis)}
            {angka('to', 'yMax', d.yOtomatis)}
            <label className="ex-label flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
              <input
                type="checkbox"
                checked={d.yOtomatis}
                onChange={(e) => ubah({ yOtomatis: e.target.checked })}
                style={{ accentColor: 'var(--accent)' }}
              />
              auto
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="ex-label flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
              <input
                type="checkbox"
                checked={d.petak}
                onChange={(e) => ubah({ petak: e.target.checked })}
                style={{ accentColor: 'var(--accent)' }}
              />
              Grid
            </label>
            <label className="ex-label flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
              Size
              <select
                className="ex-input"
                style={{ width: 'auto', padding: '4px 6px' }}
                value={d.w}
                onChange={(e) => {
                  const w = Number(e.target.value)
                  ubah({ w, h: Math.round(w * 0.75) })
                }}
              >
                <option value={400}>Small</option>
                <option value={560}>Medium</option>
                <option value={720}>Large</option>
              </select>
            </label>
          </div>

          <div className="mt-auto flex justify-end gap-2 pt-2">
            <button className="ex-btn" data-variant="ghost" onClick={onTutup}>
              Cancel
            </button>
            <button
              className="ex-btn"
              data-variant="accent"
              disabled={!hasil || !hasil.src || d.fungsi.every((f) => !f.ekspresi.trim())}
              onClick={() => {
                const akhir = renderGrafik(d, 2)
                onSisip(d, akhir)
              }}
            >
              <Icon nama="grafik" ukuran={14} /> {awal ? 'Update graph' : 'Insert graph'}
            </button>
          </div>
        </div>

        <div
          className="ex-card grid place-items-center overflow-hidden p-2"
          style={{ background: '#fff', minHeight: 300 }}
        >
          {hasil?.src ? (
            <img src={hasil.src} alt="Graph preview" style={{ maxWidth: '100%', height: 'auto' }} />
          ) : (
            <span className="ex-label" style={{ color: '#999' }}>
              Preview
            </span>
          )}
        </div>
      </div>
    </Modal>
  )
}
