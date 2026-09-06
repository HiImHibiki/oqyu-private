import { useCallback, useEffect, useState } from 'react'
import { inTauri, windowLabel } from '@/lib/runtime'
import { pasangTema, useTema, type TemaId } from '@/lib/theme'
import { useApp } from '@/lib/appStore'
import { getSetting, lipatWal } from '@/lib/db'
import { dengarkan } from '@/lib/events'
import { bukaJendelaBaru } from '@/lib/layar'
import { adminAktif, api, namaPerangkat, pinAktif, setAlamatServer, simpanAdmin } from '@/lib/api'
import { hentikanSinkron, mulaiSinkron } from '@/lib/sinkron'
import { muatRuang, useKelas } from '@/lib/kelas'
import { Toast } from '@/components/Toast'
import { Pengaturan } from '@/components/Pengaturan'
import { IconButton } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { KanvasLayar } from '@/modules/canvas/KanvasLayar'
import { toast } from '@/lib/toast'

const label = windowLabel()

// Layar sentuh (tablet Android/iPad): panel dan tombol dibesarkan lewat CSS.
// Jari butuh sasaran yang lebih lapang daripada kursor, dan di tablet 11 inci
// panel seukuran desktop terasa seperti mainan.
if (typeof window !== 'undefined' && !inTauri) {
  const sentuh = window.matchMedia?.('(pointer: coarse)').matches || /Android|iPad|iPhone/.test(navigator.userAgent)
  if (sentuh) document.documentElement.classList.add('ex-sentuh')
}

export interface InfoBerbagi {
  url: string
  urlTv: string
  urlMurid: string
  urlLokal: string
  publik: string | null
  tokenApp: string
  adminDiset: boolean
  pin: string
  port: number
  ip: string
  klien: { id: string; nama: string; peran: string }[]
}

export default function App() {
  const [siap, setSiap] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  /** Di browser: editor butuh kata sandi admin (sandi admin sekaligus membuka kelas). */
  const [perluAdmin, setPerluAdmin] = useState(false)

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
    void api('/api/admin/cek')
      .then(() => setSiap(true))
      .catch((e: unknown) => {
        const status = (e as { status?: number }).status
        if (status === 401) setPerluAdmin(true)
        else setGalat(e instanceof Error ? e.message : String(e))
      })
  }, [])

  useAksi()
  usePenjagaWal()
  useBerbagi(siap)

  if (galat) return <LayarGalat pesan={galat} />
  if (!inTauri && perluAdmin) {
    return (
      <LayarAdmin
        onMasuk={async (sandi) => {
          simpanAdmin(sandi)
          try {
            await api('/api/admin/cek')
            setPerluAdmin(false)
            setSiap(true)
            return true
          } catch {
            simpanAdmin('')
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
      void muatRuang().then((ruang) =>
        mulaiSinkron({ url: ws, pin: pinAktif(), peran: 'editor', nama: namaPerangkat(), ruang, admin: adminAktif() }),
      )
      return () => hentikanSinkron()
    }
    const terapkan = async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const mau = (await getSetting('berbagi').catch(() => null)) === '1'
      // Alamat publik (Cloudflare) diberitahukan ke server sebelum tautan dibuat.
      const publik = await getSetting('alamat_publik').catch(() => null)
      await invoke('share_set_public', { alamat: publik || null }).catch(() => {})
      const sandi = await getSetting('sandi_admin').catch(() => null)
      await invoke('share_set_admin', { sandi: sandi || null }).catch(() => {})
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
      if (info) {
        setAlamatServer(`http://127.0.0.1:${info.port}`, info.pin, info.tokenApp)
        const ruang = await muatRuang()
        mulaiSinkron({ url: `ws://127.0.0.1:${info.port}/ws`, pin: info.pin, peran: 'editor', nama: 'Mac', ruang, admin: info.tokenApp })
      } else hentikanSinkron()
    }
    void terapkan()
    const lepas = dengarkan('settings', () => void terapkan())
    // Ruangan editor ini diumumkan lewat WS oleh setRuang; di sini cukup dijaga
    // agar penyambungan ulang memakai ruangan yang terakhir dipilih.
    const lepasRuang = useKelas.subscribe(() => {})
    return () => {
      lepas()
      lepasRuang()
    }
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

/** Gerbang kata sandi admin: editor hanya untuk guru, PIN saja tidak cukup. */
function LayarAdmin({ onMasuk }: { onMasuk: (sandi: string) => Promise<boolean> }) {
  const [sandi, setSandi] = useState('')
  const [salah, setSalah] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  return (
    <div className="grid h-full place-items-center p-8">
      <form
        className="ex-card flex w-full max-w-[380px] flex-col gap-3 p-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (!sandi) return
          setSibuk(true)
          void onMasuk(sandi).then((ok) => {
            setSibuk(false)
            if (!ok) setSalah(true)
          })
        }}
      >
        <h1 className="ex-module-title flex items-center gap-2">
          <Icon nama="gembok" ukuran={15} /> Teacher sign-in
        </h1>
        <p style={{ color: 'var(--ink-soft)' }}>
          The editor is for the teacher. Enter the admin password from Settings on the Mac — no PIN
          needed.
        </p>
        <input
          className="ex-input"
          type="password"
          autoFocus
          value={sandi}
          onChange={(e) => {
            setSalah(false)
            setSandi(e.target.value)
          }}
          aria-label="Admin password"
        />
        {salah && (
          <p className="ex-label" style={{ color: 'var(--down)' }}>
            Wrong password, or no admin password has been set yet on the Mac.
          </p>
        )}
        <button className="ex-btn" data-variant="accent" disabled={!sandi || sibuk} type="submit">
          Open the editor
        </button>
      </form>
    </div>
  )
}

