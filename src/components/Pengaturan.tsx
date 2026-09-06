import { useEffect, useState } from 'react'
import { Modal } from './ui/Modal'
import { Icon } from './ui/Icon'
import { useApp } from '@/lib/appStore'
import { TEMA, useTema } from '@/lib/theme'
import {
  GULIR_BAWAAN,
  GULIR_MAKS,
  GULIR_MIN,
  muatKecepatan,
  simpanKecepatan,
  ZOOM_BAWAAN,
} from '@/lib/gulir'
import { inTauri } from '@/lib/runtime'
import { bukaVault, vault } from '@/lib/vault'
import { toast, toastGalat } from '@/lib/toast'

/**
 * Pengaturan (⌘,): tema, kecepatan gulir/zoom kanvas, dan letak vault.
 */
export function Pengaturan() {
  const buka = useApp((s) => s.pengaturanTerbuka)
  const tutup = useApp((s) => s.setPengaturan)
  const tema = useTema((s) => s.tema)
  const gantiTema = useTema((s) => s.ganti)

  const [gulir, setGulir] = useState(GULIR_BAWAAN)
  const [zoom, setZoom] = useState(ZOOM_BAWAAN)
  const [root, setRoot] = useState<string>('')

  useEffect(() => {
    if (!buka) return
    void muatKecepatan().then((k) => {
      setGulir(k.gulir)
      setZoom(k.zoom)
    })
    if (inTauri) void vault.info().then((i) => setRoot(i.root)).catch(() => {})
  }, [buka])

  async function pindahVault() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const pilih = await open({ directory: true, multiple: false, title: 'Pick the vault folder' })
      if (!pilih || typeof pilih !== 'string') return
      await vault.pakai(pilih)
      toast('Vault folder changed. Restarting…')
      window.setTimeout(() => void vault.mulaiUlang(), 600)
    } catch (e) {
      toastGalat(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Modal buka={buka} judul="Settings" onTutup={() => tutup(false)} lebar={640}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h3 className="ex-module-title">Theme</h3>
          <div className="ex-palet-pilihan">
            {TEMA.map((t) => (
              <button
                key={t.id}
                className="ex-palet-kartu"
                data-terpilih={tema === t.id ? '' : undefined}
                onClick={() => void gantiTema(t.id)}
              >
                <span className="ex-palet-nama">{t.nama}</span>
                <span className="ex-palet-sub">{t.sub}</span>
              </button>
            ))}
          </div>
          <p className="ex-label" style={{ color: 'var(--ink-faint)' }}>
            ⌘⇧T cycles to the next theme.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="ex-module-title">Canvas</h3>
          <p className="ex-label" style={{ color: 'var(--ink-soft)' }}>
            How far the canvas moves per scroll. A trackpad and a wheel mouse rarely want the
            same number — try it with the input you actually use.
          </p>
          <Geser
            label="Scroll speed"
            nilai={gulir}
            onUbah={(v) => {
              setGulir(v)
              void simpanKecepatan({ gulir: v })
            }}
          />
          <Geser
            label="Zoom speed"
            nilai={zoom}
            onUbah={(v) => {
              setZoom(v)
              void simpanKecepatan({ zoom: v })
            }}
          />
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="ex-module-title">Vault</h3>
          <p className="ex-label" style={{ color: 'var(--ink-soft)' }}>
            Your sketches live as plain JSON files in this folder — outside the app, so they
            survive the app. Put the folder in iCloud Drive to share it between Macs.
          </p>
          <p className="ex-num ex-label break-all" style={{ color: 'var(--ink-faint)' }}>
            {root || '—'}
          </p>
          <div className="flex gap-2">
            <button className="ex-btn" data-variant="ghost" onClick={() => void bukaVault()}>
              <Icon nama="folder" ukuran={15} /> Reveal in Finder
            </button>
            <button className="ex-btn" data-variant="ghost" onClick={() => void pindahVault()}>
              <Icon nama="arsip" ukuran={15} /> Use another folder…
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-1">
          <h3 className="ex-module-title">Shortcuts</h3>
          <ul className="ex-label grid gap-1" style={{ color: 'var(--ink-soft)', gridTemplateColumns: '1fr 1fr' }}>
            <li>⌘N new sketch</li>
            <li>⌘P print</li>
            <li>⌘Z / ⇧⌘Z undo / redo</li>
            <li>⌘D duplicate selection</li>
            <li>⌘0 fit to sketch</li>
            <li>⌘1–⌘9 tool slots</li>
            <li>Esc or ⌘. hide / show panels</li>
            <li>⌘S save now</li>
            <li>Space + drag pan</li>
            <li>⌘ + scroll zoom</li>
            <li>Shift lock angle / square</li>
            <li>Hold pen still snap to shape</li>
          </ul>
        </section>
      </div>
    </Modal>
  )
}

function Geser({
  label,
  nilai,
  onUbah,
}: {
  label: string
  nilai: number
  onUbah: (v: number) => void
}) {
  return (
    <label className="flex flex-wrap items-center gap-3">
      <span className="ex-label" style={{ color: 'var(--ink-soft)', width: '11ch' }}>
        {label}
      </span>
      <input
        type="range"
        min={GULIR_MIN * 100}
        max={GULIR_MAKS * 100}
        step={5}
        value={Math.round(nilai * 100)}
        onChange={(e) => onUbah(Number(e.target.value) / 100)}
        style={{ accentColor: 'var(--accent)', width: 200 }}
      />
      <span className="ex-num ex-label" style={{ color: 'var(--ink-faint)', width: '5ch' }}>
        {nilai.toFixed(2)}×
      </span>
      {Math.abs(nilai - 1) > 0.001 && (
        <button className="ex-btn" data-variant="ghost" onClick={() => onUbah(1)}>
          Reset
        </button>
      )}
    </label>
  )
}
