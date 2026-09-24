import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { renderTabel, tabelBawaan, type DefinisiTabel } from './sisipan'

/** Ubah jumlah baris/kolom sambil mempertahankan isi sel yang sudah ada. */
function ukurUlang(d: DefinisiTabel, baris: number, kolom: number): DefinisiTabel {
  const sel = Array.from({ length: baris }, (_, r) =>
    Array.from({ length: kolom }, (_, k) => d.sel[r]?.[k] ?? ''),
  )
  return { ...d, baris, kolom, sel }
}

/**
 * Penyusun tabel. Sel boleh dikosongkan: yang ditempel hanya garisnya, untuk
 * diisi tulisan tangan di kanvas — itu cara paling cepat membuat tabel nilai
 * di tengah menjelaskan.
 */
export function PanelTabel({
  buka,
  awal,
  onTutup,
  onSisip,
}: {
  buka: boolean
  awal: DefinisiTabel | null
  onTutup: () => void
  onSisip: (d: DefinisiTabel, hasil: { src: string; w: number; h: number }) => void
}) {
  const [d, setD] = useState<DefinisiTabel>(tabelBawaan)

  useEffect(() => {
    if (buka) setD(awal ? structuredClone(awal) : tabelBawaan())
  }, [buka, awal])

  const ubah = (u: Partial<DefinisiTabel>) => setD((lama) => ({ ...lama, ...u }))

  const langkah = (label: string, kunci: 'baris' | 'kolom', min: number, maks: number) => (
    <label className="ex-label flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
      {label}
      <input
        type="number"
        className="ex-input ex-num"
        style={{ width: 64, padding: '4px 6px' }}
        min={min}
        max={maks}
        value={d[kunci]}
        onChange={(e) => {
          const n = Math.max(min, Math.min(maks, Math.round(Number(e.target.value) || min)))
          setD((lama) => ukurUlang(lama, kunci === 'baris' ? n : lama.baris, kunci === 'kolom' ? n : lama.kolom))
        }}
      />
    </label>
  )

  return (
    <Modal buka={buka} judul={awal ? 'Edit table' : 'Table'} onTutup={onTutup} lebar={720}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {langkah('Rows', 'baris', 1, 30)}
          {langkah('Columns', 'kolom', 1, 12)}
          <label className="ex-label flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
            <input
              type="checkbox"
              checked={d.kepala}
              onChange={(e) => ubah({ kepala: e.target.checked })}
              style={{ accentColor: 'var(--accent)' }}
            />
            Header row
          </label>
          <label className="ex-label flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
            Cell width
            <input
              type="range"
              min={60}
              max={260}
              step={10}
              value={d.lebarSel}
              onChange={(e) => ubah({ lebarSel: Number(e.target.value) })}
              style={{ width: 90, accentColor: 'var(--accent)' }}
            />
          </label>
          <label className="ex-label flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
            height
            <input
              type="range"
              min={28}
              max={120}
              step={4}
              value={d.tinggiSel}
              onChange={(e) => ubah({ tinggiSel: Number(e.target.value) })}
              style={{ width: 90, accentColor: 'var(--accent)' }}
            />
          </label>
        </div>

        <p className="ex-label" style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
          Type into the cells, or leave them empty and write by hand on the canvas. Tab moves to the
          next cell.
        </p>

        <div className="overflow-auto" style={{ maxHeight: '48vh' }}>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {d.sel.map((baris, r) => (
                <tr key={r}>
                  {baris.map((isi, k) => (
                    <td key={k} style={{ padding: 2 }}>
                      <input
                        className="ex-input"
                        style={{
                          width: Math.max(80, Math.min(180, d.lebarSel)),
                          padding: '5px 7px',
                          fontWeight: d.kepala && r === 0 ? 600 : 400,
                          background: d.kepala && r === 0 ? 'var(--surface)' : undefined,
                        }}
                        value={isi}
                        placeholder={d.kepala && r === 0 ? `Header ${k + 1}` : ''}
                        onChange={(e) => {
                          const v = e.target.value
                          setD((lama) => ({
                            ...lama,
                            sel: lama.sel.map((b, i) => (i === r ? b.map((s, j) => (j === k ? v : s)) : b)),
                          }))
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            className="ex-btn"
            data-variant="ghost"
            onClick={() => setD((lama) => ({ ...lama, sel: lama.sel.map((b) => b.map(() => '')) }))}
          >
            Clear cells
          </button>
          <span className="flex-1" />
          <button className="ex-btn" data-variant="ghost" onClick={onTutup}>
            Cancel
          </button>
          <button className="ex-btn" data-variant="accent" onClick={() => onSisip(d, renderTabel(d, 2))}>
            <Icon nama="tabel" ukuran={14} /> {awal ? 'Update table' : 'Insert table'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
