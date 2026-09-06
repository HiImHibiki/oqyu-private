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
import { setSetting } from '@/lib/db'
import { pancarkan } from '@/lib/events'
import { useSinkron } from '@/lib/sinkron'
import type { InfoBerbagi } from '@/App'

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

        {inTauri && <BagianBerbagi buka={buka} />}

        {inTauri && (
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
        )}

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
            <li>S Pen side button / Wacom back end erase</li>
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

/**
 * Berbagi di jaringan: TV membuka tautan TV sebagai layar pengikut, tablet
 * membuka tautan editor. Keduanya membawa PIN, jadi tinggal dipindai.
 */
function BagianBerbagi({ buka }: { buka: boolean }) {
  const [info, setInfo] = useState<InfoBerbagi | null>(null)
  const [qr, setQr] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const klien = useSinkron((s) => s.klien)
  const status = useSinkron((s) => s.status)

  useEffect(() => {
    if (!buka) return
    void import('@tauri-apps/api/core').then(({ invoke }) =>
      invoke<InfoBerbagi | null>('share_status').then(setInfo).catch(() => setInfo(null)),
    )
  }, [buka])

  useEffect(() => {
    if (!info) {
      setQr('')
      return
    }
    void import('@tauri-apps/api/core').then(({ invoke }) =>
      invoke<string>('share_qr', { text: info.url }).then(setQr).catch(() => setQr('')),
    )
  }, [info])

  async function nyalakan(pinBaru: string | null) {
    setSibuk(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const i = await invoke<InfoBerbagi>('share_start', { pin: pinBaru })
      await setSetting('berbagi', '1')
      await setSetting('berbagi_pin', i.pin)
      setInfo(i)
      await pancarkan('settings')
    } catch (e) {
      toastGalat(e instanceof Error ? e.message : String(e))
    } finally {
      setSibuk(false)
    }
  }

  async function matikan() {
    setSibuk(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('share_stop')
      await setSetting('berbagi', '0')
      setInfo(null)
      await pancarkan('settings')
    } finally {
      setSibuk(false)
    }
  }

  async function pinBaru() {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('share_stop')
    await nyalakan(null)
    toast('New PIN. Devices will need the new link.')
  }

  const salin = (teks: string) =>
    navigator.clipboard
      .writeText(teks)
      .then(() => toast('Link copied.'))
      .catch(() => toastGalat('Could not copy.'))

  const bukaDiBrowser = async (url: string) => {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url).catch(() => toastGalat('Could not open the browser.'))
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="ex-module-title">Share on this network</h3>
        <label className="ex-label flex items-center gap-2" style={{ color: 'var(--ink-soft)' }}>
          <input
            type="checkbox"
            checked={info !== null}
            disabled={sibuk}
            onChange={(e) => (e.target.checked ? void nyalakan(null) : void matikan())}
            style={{ accentColor: 'var(--accent)' }}
          />
          {info ? 'On' : 'Off'}
        </label>
      </div>
      <p className="ex-label" style={{ color: 'var(--ink-soft)' }}>
        TVs and tablets on the same Wi-Fi open the canvas in their browser. TVs follow whoever is
        drawing; a tablet with a pen edits the same sketches. Nothing leaves this Mac.
      </p>

      {info && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'auto 1fr' }}>
          <div
            className="ex-card overflow-hidden"
            style={{ width: 150, height: 150, background: '#fff', padding: 4 }}
            dangerouslySetInnerHTML={{ __html: qr.replace(/<svg /, '<svg style="width:100%;height:100%" ') }}
          />
          <div className="flex min-w-0 flex-col gap-2">
            <Tautan label="Tablet (edit)" url={info.url} onSalin={salin} onBuka={bukaDiBrowser} />
            <Tautan label="TV (follow)" url={info.urlTv} onSalin={salin} onBuka={bukaDiBrowser} />
            <p className="ex-label" style={{ color: 'var(--ink-faint)' }}>
              PIN <span className="ex-num" style={{ color: 'var(--ink)', letterSpacing: '0.2em' }}>{info.pin}</span>
              {' · '}
              <button className="underline" onClick={() => void pinBaru()}>
                new PIN
              </button>
              {' · '}
              <span>{status === 'tersambung' ? 'this window connected' : 'this window connecting…'}</span>
            </p>
            <p className="ex-label" style={{ color: 'var(--ink-faint)' }}>
              Connected:{' '}
              {klien.filter((k) => k.nama !== 'Mac').length === 0
                ? 'no other devices yet'
                : klien
                    .filter((k) => k.nama !== 'Mac')
                    .map((k) => `${k.nama}${k.peran === 'tv' ? ' (TV)' : ''}`)
                    .join(', ')}
            </p>
            <p className="ex-label" style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
              Add <span className="ex-num">&amp;mode=fit</span> to the TV link to always show the whole
              page instead of following the zoom. Keep the Mac awake while teaching.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

function Tautan({
  label,
  url,
  onSalin,
  onBuka,
}: {
  label: string
  url: string
  onSalin: (u: string) => void
  onBuka: (u: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="ex-label shrink-0" style={{ color: 'var(--ink-soft)', width: '10ch' }}>
        {label}
      </span>
      <span className="ex-num ex-label min-w-0 flex-1 truncate" style={{ color: 'var(--ink)' }} title={url}>
        {url}
      </span>
      <button className="ex-btn" data-variant="ghost" style={{ padding: '3px 8px' }} onClick={() => onSalin(url)}>
        Copy
      </button>
      <button className="ex-btn" data-variant="ghost" style={{ padding: '3px 8px' }} onClick={() => onBuka(url)}>
        Open
      </button>
    </div>
  )
}
