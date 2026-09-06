import { useCallback, useEffect, useState } from 'react'
import { inTauri, windowLabel } from '@/lib/runtime'
import { pasangTema, useTema, type TemaId } from '@/lib/theme'
import { useApp } from '@/lib/appStore'
import { getSetting, lipatWal } from '@/lib/db'
import { bukaJendelaBaru } from '@/lib/layar'
import { Toast } from '@/components/Toast'
import { Pengaturan } from '@/components/Pengaturan'
import { IconButton } from '@/components/ui/Button'
import { KanvasLayar } from '@/modules/canvas/KanvasLayar'
import { toast } from '@/lib/toast'

const label = windowLabel()

export default function App() {
  const [siap, setSiap] = useState(!inTauri)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => pasangTema(), [])

  // Pastikan database terbuka sebelum kanvas mencoba membacanya.
  useEffect(() => {
    if (!inTauri) return
    void getSetting('theme')
      .then(() => setSiap(true))
      .catch((e: unknown) => setGalat(e instanceof Error ? e.message : String(e)))
  }, [])

  useAksi()
  usePenjagaWal()

  if (!inTauri) return <LayarBrowser />
  if (galat) return <LayarGalat pesan={galat} />
  if (!siap) return <LayarMemuat />

  return (
    <>
      <div className="ex-texture relative h-full w-full">
        <KanvasLayar />
        <IconButton
          nama="atur"
          label="Settings (⌘,)"
          className="ex-card absolute right-3 top-3 z-10"
          onClick={() => useApp.getState().setPengaturan(true)}
        />
      </div>
      <Pengaturan />
      <Toast />
    </>
  )
}

/**
 * Rapikan database tiap kali jendela ditinggalkan, dan sebelum berhenti —
 * supaya salinan yang disinkron iCloud selalu satu berkas yang utuh.
 */
function usePenjagaWal() {
  useEffect(() => {
    if (label !== 'focus') return
    const rapikan = () => void lipatWal()
    const saatSembunyi = () => {
      if (document.hidden) rapikan()
    }
    window.addEventListener('blur', rapikan)
    window.addEventListener('beforeunload', rapikan)
    document.addEventListener('visibilitychange', saatSembunyi)
    return () => {
      window.removeEventListener('blur', rapikan)
      window.removeEventListener('beforeunload', rapikan)
      document.removeEventListener('visibilitychange', saatSembunyi)
    }
  }, [])
}

/* ── Perintah menu & pintasan ──────────────────────────────────────── */

/** Pintasan cadangan, hanya dipakai saat aplikasi dibuka di browser. */
const PINTASAN: Record<string, string | undefined> = {
  n: 'aksi:sketsa-baru',
  ',': 'aksi:pengaturan',
}
const PINTASAN_SHIFT: Record<string, string | undefined> = {
  t: 'tema:siklus',
  n: 'window:baru',
}

function useAksi() {
  const mintaSketsaBaru = useApp((s) => s.mintaSketsaBaru)
  const mintaCetak = useApp((s) => s.mintaCetak)
  const setPengaturan = useApp((s) => s.setPengaturan)
  const gantiTema = useTema((s) => s.ganti)
  const siklusTema = useTema((s) => s.siklus)

  const jalankan = useCallback(
    async (id: string) => {
      if (id.startsWith('tema:')) {
        const t = id.slice(5)
        if (t === 'siklus') await siklusTema()
        else await gantiTema(t as TemaId)
        return
      }
      switch (id) {
        case 'aksi:sketsa-baru':
          mintaSketsaBaru()
          break
        case 'aksi:cetak':
          mintaCetak()
          break
        case 'aksi:pengaturan':
          setPengaturan(true)
          break
        case 'window:baru': {
          const l = await bukaJendelaBaru('kanvas')
          if (!l) toast('All canvas windows are already open.')
          break
        }
      }
    },
    [mintaSketsaBaru, mintaCetak, setPengaturan, gantiTema, siklusTema],
  )

  // Menu bar macOS meneruskan kliknya ke sini.
  useEffect(() => {
    if (!inTauri) return
    let lepas: (() => void) | null = null
    let batal = false
    void import('@tauri-apps/api/event').then(async ({ listen }) => {
      const un = await listen<string>('ui:menu', (e) => void jalankan(String(e.payload)))
      if (batal) un()
      else lepas = un
    })
    return () => {
      batal = true
      lepas?.()
    }
  }, [jalankan])

  // Di dalam aplikasi, pintasan dipegang menu asli macOS — kalau ditangani di
  // sini juga, satu tekanan tombol menjalankan aksinya dua kali.
  useEffect(() => {
    if (inTauri) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const k = e.key.toLowerCase()
      const id = e.shiftKey ? PINTASAN_SHIFT[k] : PINTASAN[k]
      if (!id) return
      e.preventDefault()
      void jalankan(id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [jalankan])
}

/* ── Layar keadaan ─────────────────────────────────────────────────── */

function LayarMemuat() {
  return (
    <div className="grid h-full place-items-center" style={{ color: 'var(--ink-faint)' }}>
      Preparing vault…
    </div>
  )
}

function LayarGalat({ pesan }: { pesan: string }) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="ex-card max-w-[560px] p-6">
        <h1 className="ex-module-title mb-2">Cannot open the database</h1>
        <p style={{ color: 'var(--ink-soft)' }}>{pesan}</p>
        <p className="ex-label mt-3" style={{ color: 'var(--ink-faint)' }}>
          Check the vault folder (~/ExactCanvas) and its permissions, then restart the app.
        </p>
      </div>
    </div>
  )
}

function LayarBrowser() {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="ex-card max-w-[560px] p-6">
        <h1 className="ex-module-title mb-2">Run it as an app</h1>
        <p style={{ color: 'var(--ink-soft)' }}>
          Exact Canvas is local-first: sketches live as files in your own vault folder, and that
          is only reachable from the app shell.
        </p>
        <p className="ex-num ex-label mt-4" style={{ color: 'var(--accent)' }}>
          npm run app
        </p>
      </div>
    </div>
  )
}
