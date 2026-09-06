import { useCallback, useEffect, useState } from 'react'
import { inTauri, windowLabel } from '@/lib/runtime'
import { pasangTema, useTema, type TemaId } from '@/lib/theme'
import { useApp } from '@/lib/appStore'
import { getSetting, lipatWal } from '@/lib/db'
import { dengarkan } from '@/lib/events'
import { bukaJendelaBaru } from '@/lib/layar'
import { api, namaPerangkat, pinAktif, simpanPin } from '@/lib/api'
import { hentikanSinkron, mulaiSinkron } from '@/lib/sinkron'
import { Toast } from '@/components/Toast'
import { Pengaturan } from '@/components/Pengaturan'
import { IconButton } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { KanvasLayar } from '@/modules/canvas/KanvasLayar'
import { toast } from '@/lib/toast'

const label = windowLabel()

export interface InfoBerbagi {
  url: string
  urlTv: string
  pin: string
  port: number
  ip: string
  klien: { id: string; nama: string; peran: string }[]
}

export default function App() {
  const [siap, setSiap] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  /** Di browser: PIN belum ada atau ditolak server. */
  const [perluPin, setPerluPin] = useState(false)

  useEffect(() => pasangTema(), [])

  // Pastikan database (atau server, di browser) bisa dijangkau sebelum kanvas
  // mencoba membacanya.
  useEffect(() => {
    if (inTauri) {
      void getSetting('theme')
        .then(() => setSiap(true))
        .catch((e: unknown) => setGalat(e instanceof Error ? e.message : String(e)))
      return
    }
    void api('/api/vault')
      .then(() => setSiap(true))
      .catch((e: unknown) => {
        if ((e as { status?: number }).status === 401) setPerluPin(true)
        else setGalat(e instanceof Error ? e.message : String(e))
      })
  }, [])

  useAksi()
  usePenjagaWal()
  useBerbagi(siap)

  if (galat) return <LayarGalat pesan={galat} />
  if (!inTauri && perluPin) {
    return (
      <LayarPin
        onMasuk={async (pin) => {
          simpanPin(pin)
          try {
            await api('/api/vault')
            setPerluPin(false)
            setSiap(true)
            return true
          } catch {
            return false
          }
        }}
      />
    )
  }
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
 * Berbagi di jaringan.
 *
 * Di Mac: kalau sakelarnya menyala di Pengaturan, servernya dinyalakan saat
 * aplikasi dibuka dan jendela ini menyambung ke hub-nya sendiri supaya ikut
 * menyiarkan goresan. Di browser (tablet): langsung menyambung ke server yang
 * menyajikan halaman ini.
 */
function useBerbagi(siap: boolean) {
  useEffect(() => {
    if (!siap) return
    if (!inTauri) {
      const ws = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
      mulaiSinkron({ url: ws, pin: pinAktif(), peran: 'editor', nama: namaPerangkat() })
      return () => hentikanSinkron()
    }
    const terapkan = async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const mau = (await getSetting('berbagi').catch(() => null)) === '1'
      let info = await invoke<InfoBerbagi | null>('share_status').catch(() => null)
      if (mau && !info) {
        const pin = await getSetting('berbagi_pin').catch(() => null)
        info = await invoke<InfoBerbagi>('share_start', { pin }).catch((e: unknown) => {
          toast(`Could not start sharing: ${e instanceof Error ? e.message : String(e)}`)
          return null
        })
      }
      if (!mau && info) {
        await invoke('share_stop').catch(() => {})
        info = null
      }
      if (info) mulaiSinkron({ url: `ws://127.0.0.1:${info.port}/ws`, pin: info.pin, peran: 'editor', nama: 'Mac' })
      else hentikanSinkron()
    }
    void terapkan()
    return dengarkan('settings', () => void terapkan())
  }, [siap])
}

/**
 * Rapikan database tiap kali jendela ditinggalkan, dan sebelum berhenti —
 * supaya salinan yang disinkron iCloud selalu satu berkas yang utuh.
 */
function usePenjagaWal() {
  useEffect(() => {
    if (!inTauri || label !== 'focus') return
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
  p: 'aksi:cetak',
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
      {inTauri ? 'Preparing vault…' : 'Connecting to the Mac…'}
    </div>
  )
}

function LayarGalat({ pesan }: { pesan: string }) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="ex-card max-w-[560px] p-6">
        <h1 className="ex-module-title mb-2">{inTauri ? 'Cannot open the database' : 'Cannot reach the Mac'}</h1>
        <p style={{ color: 'var(--ink-soft)' }}>{pesan}</p>
        <p className="ex-label mt-3" style={{ color: 'var(--ink-faint)' }}>
          {inTauri
            ? 'Check the vault folder (~/ExactCanvas) and its permissions, then restart the app.'
            : 'Make sure Exact Canvas is open on the Mac with sharing turned on, and that this device is on the same Wi-Fi.'}
        </p>
      </div>
    </div>
  )
}

/** Gerbang PIN untuk tablet. Tautan dari QR sudah membawa PIN-nya, jadi ini jarang terlihat. */
function LayarPin({ onMasuk }: { onMasuk: (pin: string) => Promise<boolean> }) {
  const [pin, setPin] = useState('')
  const [salah, setSalah] = useState(false)
  const [sibuk, setSibuk] = useState(false)

  const kirimPin = async () => {
    if (pin.length !== 4) return
    setSibuk(true)
    const ok = await onMasuk(pin)
    setSibuk(false)
    if (!ok) setSalah(true)
  }

  return (
    <div className="grid h-full place-items-center p-8">
      <form
        className="ex-card flex w-full max-w-[380px] flex-col gap-3 p-6"
        onSubmit={(e) => {
          e.preventDefault()
          void kirimPin()
        }}
      >
        <h1 className="ex-module-title flex items-center gap-2">
          <Icon nama="pena" ukuran={15} /> Exact Canvas
        </h1>
        <p style={{ color: 'var(--ink-soft)' }}>Enter the 4-digit PIN shown in Settings on the Mac.</p>
        <input
          className="ex-input ex-num"
          style={{ fontSize: 28, letterSpacing: '0.4em', textAlign: 'center' }}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoFocus
          value={pin}
          onChange={(e) => {
            setSalah(false)
            setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
          }}
          aria-label="PIN"
        />
        {salah && (
          <p className="ex-label" style={{ color: 'var(--down)' }}>
            That PIN was not accepted.
          </p>
        )}
        <button className="ex-btn" data-variant="accent" disabled={pin.length !== 4 || sibuk} type="submit">
          Open the canvas
        </button>
      </form>
    </div>
  )
}
