/**
 * Halaman TV: layar pengikut tanpa React.
 *
 * Browser smart TV adalah bagian terlemah dari rantai ini, jadi halaman ini
 * hanya membawa yang perlu: dua <canvas>, satu WebSocket, dan fungsi gambar
 * yang sama persis dengan aplikasi utama — supaya yang tampil di TV adalah
 * goresan yang sama, bukan tiruannya. Ia mengikuti editor yang terakhir aktif:
 * Mac di depan kelas, atau tablet yang dibawa berkeliling.
 */

import { api, pinTersimpan, namaPerangkat } from '@/lib/api'
import { dengarkanLangsung, kirim, mulaiSinkron, useSinkron, type PesanLangsung } from '@/lib/sinkron'
import { bunyi } from '@/lib/kelas'
import { JARAK_HALAMAN, kertasDari, kotakHalaman } from '@/modules/canvas/kertas'
import {
  gambarCoretan,
  gambarTeks,
  gambarTempelan,
  muatGambar,
  warnaToken,
  type BerkasKanvas,
  type Coretan,
  type Gambar,
  type Lapisan,
} from '@/modules/canvas/strokes'
import { gambarObjek, type Objek } from '@/modules/canvas/objek'
import { gambarInstrumen, type Instrumen } from '@/modules/canvas/instrumen'

interface Tampilan {
  skala: number
  x: number
  y: number
}

const dasar = document.getElementById('dasar') as HTMLCanvasElement
const aktif = document.getElementById('aktif') as HTMLCanvasElement
const statusEl = document.getElementById('status') as HTMLDivElement
const pesanEl = document.getElementById('pesan') as HTMLDivElement

const params = new URLSearchParams(location.search)
const paramMode = params.get('mode')
/**
 * HP murid atau TV? TV: layar lebar tanpa sentuh, atau `?tv=1`. HP murid masuk
 * dengan nama, punya bilah tanya, dan lampunya diawasi guru.
 */
const sebagaiMurid = params.get('tv') !== '1' && (params.get('murid') === '1' || window.matchMedia('(pointer: coarse)').matches)
/** Ruangan perangkat ini: dari tautan untuk TV, dari layar masuk untuk HP. */
let ruangSaya = Number(params.get('ruang')) || 1
/** Id murid, dibuat sekali per HP dan diingat. */
const muridId = (() => {
  if (!sebagaiMurid) return ''
  try {
    let id = localStorage.getItem('exact-murid-id')
    if (!id) {
      id = `m${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem('exact-murid-id', id)
    }
    return id
  } catch {
    return `m${Math.random().toString(36).slice(2, 10)}`
  }
})()
let namaSaya = ''
/** Apa yang diikuti: null = ruangan sendiri, 'ruang:N' | 'editor:id' | 'sketsa:id'. */
let arah: string | null = null
let tanyaSaya: { id: string; status: string; urutan?: number } | null = null
/** ?mode=fit: selalu satu halaman penuh, apa pun zoom guru. */
const modeMuat = paramMode === 'fit'
/**
 * Layar sempit (HP) mengikuti zoom guru tapi *memenuhi* layarnya: wilayah yang
 * dilihat guru di monitor lebar dipas ke tinggi HP, sisi kiri-kanan yang tidak
 * muat dipotong. Memuat seluruh wilayah itu ke HP tegak hanya menyisakan pita
 * kecil di tengah layar. ?mode=follow memaksa cara TV (muat seluruhnya).
 */
const modePenuh = paramMode !== 'follow' && !modeMuat && window.innerWidth < 700

/* ── Keadaan ───────────────────────────────────────────────────────── */

let sketsa: BerkasKanvas | null = null
let idSketsa: string | null = null
let sumber: string | null = null
let namaSumber = ''
/** Pandangan sumber: cukup untuk menurunkan wilayah dunia yang ia lihat. */
let pandanganSumber: { tampilan: Tampilan; layar: { w: number; h: number } } | null = null
let tampilan: Tampilan = { skala: 1, x: 0, y: 0 }
const goresanHidup = new Map<string, Coretan>()
let objekPratinjau: Objek | null = null
let instrumen: Instrumen | null = null
let kursor: { x: number; y: number } | null = null
let kotorDasar = true
let kotorAktif = true
let timerMuat: number | null = null
let timerStatus: number | null = null

function ukuran() {
  return { w: window.innerWidth, h: window.innerHeight }
}

function tampilkanStatus(teks: string, tahan = false) {
  statusEl.textContent = teks
  statusEl.classList.add('tampil')
  if (timerStatus) window.clearTimeout(timerStatus)
  if (!tahan) timerStatus = window.setTimeout(() => statusEl.classList.remove('tampil'), 3500)
}

function tampilkanPesan(html: string | null) {
  pesanEl.innerHTML = html ?? ''
  pesanEl.classList.toggle('tampil', html !== null)
}

/* ── Pandangan ─────────────────────────────────────────────────────── */

/**
 * Turunkan pandangan TV dari pandangan sumber.
 *
 * Mode ikut: wilayah dunia yang terlihat di layar sumber dimuat utuh di TV,
 * apa pun perbandingan layarnya — yang dilihat murid persis yang dilihat guru.
 * Mode muat (?mode=fit): halaman tempat guru bekerja selalu tampil penuh,
 * sementara guru boleh memperbesar sesukanya di monitornya sendiri.
 */
function hitungTampilan() {
  const { w, h } = ukuran()
  if (!pandanganSumber) return
  const s = pandanganSumber
  let x1 = -s.tampilan.x / s.tampilan.skala
  let y1 = -s.tampilan.y / s.tampilan.skala
  let lw = s.layar.w / s.tampilan.skala
  let lh = s.layar.h / s.tampilan.skala

  const kertas = kertasDari(sketsa?.paper)
  if (modeMuat && kertas.w > 0) {
    const tengahY = y1 + lh / 2
    const i = Math.max(0, Math.min((sketsa?.pages ?? 1) - 1, Math.floor(tengahY / (kertas.h + JARAK_HALAMAN))))
    const k = kotakHalaman(kertas, i)
    const tepi = 24
    x1 = k.x1 - tepi
    y1 = k.y1 - tepi
    lw = kertas.w + tepi * 2
    lh = kertas.h + tepi * 2
  }
  const skala = modePenuh && !modeMuat ? Math.max(w / lw, h / lh) : Math.min(w / lw, h / lh)
  tampilan = {
    skala,
    x: (w - lw * skala) / 2 - x1 * skala,
    y: (h - lh * skala) / 2 - y1 * skala,
  }
  kotorDasar = true
  kotorAktif = true
}

/* ── Gambar ────────────────────────────────────────────────────────── */

function siapkan(el: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const { w, h } = ukuran()
  const pw = Math.round(w * dpr)
  const ph = Math.round(h * dpr)
  if (el.width !== pw || el.height !== ph) {
    el.width = pw
    el.height = ph
  }
  const ctx = el.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  return ctx
}

const tampak = (lapisan: Lapisan[] | undefined, layer: number) => lapisan?.[layer]?.tampak ?? true

function gambarDasar() {
  const ctx = siapkan(dasar)
  if (!ctx) return
  const { w, h } = ukuran()
  ctx.fillStyle = warnaToken('bg')
  ctx.fillRect(0, 0, w, h)
  if (!sketsa) return
  const { skala, x, y } = tampilan
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(skala, skala)

  const kertas = kertasDari(sketsa.paper)
  if (kertas.w > 0) {
    ctx.lineWidth = 1 / skala
    for (let i = 0; i < (sketsa.pages ?? 1); i++) {
      const k = kotakHalaman(kertas, i)
      if (k.y2 * skala + y < -20 || k.y1 * skala + y > h + 20) continue
      ctx.fillStyle = warnaToken('paper')
      ctx.fillRect(k.x1, k.y1, kertas.w, kertas.h)
      ctx.strokeStyle = warnaToken('line-strong')
      ctx.strokeRect(k.x1, k.y1, kertas.w, kertas.h)
    }
  }

  const lapisan = sketsa.layers
  for (const g of sketsa.images ?? []) {
    if (!tampak(lapisan, g.layer)) continue
    gambarTempelan(ctx, g, () => {
      kotorDasar = true
    })
  }
  for (const c of sketsa.strokes) if (tampak(lapisan, c.layer)) gambarCoretan(ctx, c)
  const fontLabel = `${Math.max(13, 14 / skala)}px ui-monospace, monospace`
  for (const o of sketsa.objects ?? []) if (tampak(lapisan, o.layer)) gambarObjek(ctx, o, warnaToken(o.color), fontLabel)
  for (const t of sketsa.texts ?? []) if (tampak(lapisan, t.layer)) gambarTeks(ctx, t)
  ctx.restore()
}

function gambarAktif() {
  const ctx = siapkan(aktif)
  if (!ctx) return
  const { skala, x, y } = tampilan
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(skala, skala)
  for (const c of goresanHidup.values()) if (c.points.length > 1) gambarCoretan(ctx, c)
  if (objekPratinjau) {
    gambarObjek(ctx, objekPratinjau, warnaToken(objekPratinjau.color), `${Math.max(13, 14 / skala)}px ui-monospace, monospace`)
  }
  if (instrumen) gambarInstrumen(ctx, instrumen, skala)
  if (kursor) {
    // Titik pena sebagai penunjuk: murid melihat ke mana guru menunjuk,
    // bukan hanya apa yang sudah ditulis.
    ctx.beginPath()
    ctx.arc(kursor.x, kursor.y, 5 / skala, 0, Math.PI * 2)
    ctx.fillStyle = warnaToken('accent')
    ctx.globalAlpha = 0.85
    ctx.fill()
    ctx.globalAlpha = 0.25
    ctx.beginPath()
    ctx.arc(kursor.x, kursor.y, 14 / skala, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

function bingkai() {
  if (kotorDasar) {
    kotorDasar = false
    gambarDasar()
  }
  if (kotorAktif) {
    kotorAktif = false
    gambarAktif()
  }
  requestAnimationFrame(bingkai)
}

/* ── Data ──────────────────────────────────────────────────────────── */

async function muatSketsa(id: string) {
  try {
    // Versi ringan: gambar tempelan diganti URL yang di-cache browser, jadi
    // yang lewat Wi-Fi tiap muat ulang hanya goresannya — bukan puluhan MB PDF.
    const teks = await api<string | object>(`/api/canvas/${encodeURIComponent(id)}/ringan`)
    const data = (typeof teks === 'string' ? JSON.parse(teks) : teks) as BerkasKanvas
    sketsa = {
      ...data,
      strokes: data.strokes ?? [],
      images: data.images ?? [],
      objects: data.objects ?? [],
      texts: data.texts ?? [],
    }
    idSketsa = id
    // Goresan hidup yang sudah masuk berkas tidak perlu digambar dua kali.
    const ada = new Set(sketsa.strokes.map((c) => c.id))
    for (const k of Array.from(goresanHidup.keys())) if (ada.has(k)) goresanHidup.delete(k)
    // Gambar tempelan dimuat dulu supaya bingkai pertama tidak bolong.
    for (const g of sketsa.images ?? []) muatGambar(g.src, () => (kotorDasar = true))
    hitungTampilan()
    kotorDasar = true
    kotorAktif = true
  } catch (e) {
    tampilkanStatus(`Could not load the sketch: ${e instanceof Error ? e.message : String(e)}`, true)
  }
}

function jadwalkanMuatUlang() {
  if (timerMuat) window.clearTimeout(timerMuat)
  // Perubahan yang terlihat sudah datang lewat pesan 'ubah'; muat ulang
  // berkas penuh cukup menyusul sedikit lebih santai — pada sketsa 20 MB,
  // memuatnya tiap jeda tulis justru yang membuat TV tersendat.
  timerMuat = window.setTimeout(() => {
    timerMuat = null
    if (idSketsa) void muatSketsa(idSketsa)
  }, 1200)
}

async function sketsaTerbaru(): Promise<string | null> {
  try {
    const r = await api<{ rows: { id: string }[] }>('/api/sql', {
      method: 'POST',
      json: { sql: 'SELECT id FROM canvases ORDER BY updated_at DESC LIMIT 1', params: [] },
    })
    return r.rows[0]?.id ?? null
  } catch {
    return null
  }
}

/* ── Pesan langsung ────────────────────────────────────────────────── */

/**
 * Bolehkah pesan dari `src` diikuti layar ini?
 *
 * Pengikut hanya mengikuti editor di ruangannya — guru yang menulis di tablet
 * di ruangan 2 tidak menggeser layar ruangan 1. Grup boleh mengesampingkan:
 * mengikuti ruangan lain, satu editor tertentu, atau tidak mengikuti siapa pun
 * karena dipaku ke satu sketsa. Sebelum daftar klien datang, semua diterima
 * supaya layar tidak kosong menunggu.
 */
/** Editor yang baru saja membuka pertanyaan saya/grup saya: diikuti apa pun ruangannya. */
let sumberPaksa: string | null = null

function bolehIkuti(src: string | undefined): boolean {
  if (!src) return false
  if (src === sumberPaksa) return true
  if (arah?.startsWith('sketsa:')) return false
  if (arah?.startsWith('editor:')) return src === arah.slice(7)
  const daftar = useSinkron.getState().klien
  if (daftar.length === 0) return true
  const k = daftar.find((x) => x.id === src)
  if (!k) return false
  const ruangTarget = arah?.startsWith('ruang:') ? Number(arah.slice(6)) : ruangSaya
  return k.ruang === ruangTarget
}

function gantiSumber(p: PesanLangsung) {
  if (p.src && p.src !== sumber) {
    sumber = p.src
    const k = useSinkron.getState().klien.find((x) => x.id === sumber)
    namaSumber = k?.nama ?? 'editor'
    tampilkanStatus(`Following ${namaSumber}`)
    goresanHidup.clear()
    objekPratinjau = null
    instrumen = null
    kursor = null
  }
}

function terima(p: PesanLangsung) {
  if (p.t === 'data') {
    if (p.kanal === 'canvas') jadwalkanMuatUlang()
    if (p.kanal === 'kelas') void segarkanSaya()
    return
  }
  if (p.t === 'bahas') {
    terimaBahas(p.tanya as { murid: string; nama: string; anggota?: string[]; grup?: string | null })
    return
  }
  if (!bolehIkuti(p.src)) return
  // Editor yang sedang bekerja diikuti; denyut dari editor yang diam tidak
  // merebut layar. Sumber pertama diambil dari siapa pun yang bersuara.
  const aktifDariPengirim = p.aktif !== false
  if (p.src !== sumber && !(aktifDariPengirim || sumber === null)) return
  // Menghapus dan mengubah bentuk juga aktivitas: guru yang pindah dari tablet
  // ke Mac lalu langsung menghapus harus tetap diikuti.
  if (['pandangan', 'goresan', 'titik', 'instrumen', 'objek', 'ubah'].includes(p.t) && aktifDariPengirim) gantiSumber(p)
  else if (sumber === null) gantiSumber(p)
  if (p.src !== sumber) return

  switch (p.t) {
    case 'pandangan': {
      pandanganSumber = { tampilan: p.tampilan as Tampilan, layar: p.layar as { w: number; h: number } }
      const id = p.idKanvas as string | null
      if (id && id !== idSketsa) void muatSketsa(id)
      else hitungTampilan()
      break
    }
    case 'goresan': {
      const c = p.c as Coretan
      goresanHidup.set(c.id, { ...c, points: [...c.points] })
      kotorAktif = true
      break
    }
    case 'titik': {
      let c = goresanHidup.get(p.id as string)
      if (!c && p.meta) {
        c = { ...(p.meta as Omit<Coretan, 'points'>), points: [] }
        goresanHidup.set(c.id, c)
      }
      if (!c) break
      const titik = p.titik as [number, number, number][]
      const dari = p.dari as number
      c.points.length = Math.min(c.points.length, dari)
      c.points.push(...titik)
      kotorAktif = true
      break
    }
    case 'goresan-selesai': {
      const c = goresanHidup.get(p.id as string)
      if (c && p.batal) goresanHidup.delete(c.id)
      kotorAktif = true
      break
    }
    case 'objek':
      objekPratinjau = (p.o as Objek | null) ?? null
      kotorAktif = true
      break
    case 'instrumen':
      instrumen = (p.i as Instrumen | null) ?? null
      kotorAktif = true
      break
    case 'kursor':
      kursor = typeof p.x === 'number' ? { x: p.x as number, y: p.y as number } : null
      kotorAktif = true
      break
    case 'ubah': {
      // Hapusan dan perubahan diterapkan seketika; berkas penuh menyusul.
      if (!sketsa) break
      const hapus = (p.hapus ?? {}) as { coretan?: string[]; objek?: string[]; teks?: string[]; gambar?: string[] }
      const tambah = (p.tambah ?? {}) as { coretan?: Coretan[]; objek?: Objek[]; gambar?: Gambar[] }
      const hc = new Set(hapus.coretan ?? [])
      const ho = new Set(hapus.objek ?? [])
      const ht = new Set(hapus.teks ?? [])
      const hg = new Set(hapus.gambar ?? [])
      if (hg.size || tambah.gambar?.length) {
        sketsa.images = (sketsa.images ?? []).filter((g) => !hg.has(g.id))
        for (const g of tambah.gambar ?? []) {
          if (!sketsa.images.some((x) => x.id === g.id)) {
            sketsa.images.push(g)
            muatGambar(g.src, () => (kotorDasar = true))
          }
        }
      }
      for (const id of hc) goresanHidup.delete(id)
      const upsert = <T extends { id: string }>(lama: T[], buang: Set<string>, baru: T[]): T[] => {
        const petaBaru = new Map(baru.map((x) => [x.id, x]))
        const hasil = lama.filter((x) => !buang.has(x.id)).map((x) => petaBaru.get(x.id) ?? x)
        const ada = new Set(hasil.map((x) => x.id))
        for (const x of baru) if (!ada.has(x.id)) hasil.push(x)
        return hasil
      }
      sketsa.strokes = upsert(sketsa.strokes, hc, tambah.coretan ?? [])
      sketsa.objects = upsert(sketsa.objects ?? [], ho, tambah.objek ?? [])
      if (ht.size) sketsa.texts = (sketsa.texts ?? []).filter((t) => !ht.has(t.id))
      kotorDasar = true
      kotorAktif = true
      break
    }
  }
}

/* ── Mulai ─────────────────────────────────────────────────────────── */

async function mulai() {
  const pin = pinTersimpan()
  if (!pin) {
    tampilkanPesan('Open this page from the link or QR code shown in Exact Canvas on the Mac.<small>The link carries the PIN.</small>')
    return
  }
  try {
    await api('/api/vault')
  } catch {
    tampilkanPesan('This PIN is no longer valid.<small>Scan the QR code in Exact Canvas again.</small>')
    return
  }

  if (sebagaiMurid) {
    document.documentElement.classList.add('hp')
    await layarMasuk()
  }

  const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
  mulaiSinkron({
    url: wsUrl,
    pin,
    peran: 'tv',
    nama: sebagaiMurid ? namaSaya : `${namaPerangkat()} (TV)`,
    ruang: ruangSaya,
    murid: muridId || undefined,
  })
  dengarkanLangsung(terima)
  if (sebagaiMurid) {
    pasangBilahMurid()
    void segarkanSaya()
    window.setInterval(() => void segarkanSaya(), 20_000)
  }

  let serverDikenal: string | null = null
  useSinkron.subscribe((s) => {
    // Aplikasi Mac dibuka ulang: halaman ini memuat ulang supaya selalu
    // menjalankan versi yang sama dengan Mac-nya. TV tidak punya tombol reload
    // yang gampang dijangkau, jadi ia mengurus dirinya sendiri.
    if (s.server) {
      if (serverDikenal && serverDikenal !== s.server) {
        location.reload()
        return
      }
      serverDikenal = s.server
    }
    if (s.serverMati) tampilkanPesan('Sharing was turned off on the Mac.<small>Turn it on again in Settings → Share on this network.</small>')
    else if (s.status === 'menyambung') tampilkanStatus('Reconnecting…', true)
    else if (s.status === 'tersambung') {
      tampilkanPesan(null)
      tampilkanStatus(namaSumber ? `Following ${namaSumber}` : 'Connected — waiting for the teacher')
    }
    if (sumber && (!s.klien.some((k) => k.id === sumber) || !bolehIkuti(sumber))) {
      // Editor yang diikuti pergi atau pindah ruangan; siapa pun yang bergerak
      // berikutnya di ruangan ini yang diikuti.
      sumber = null
      kursor = null
      goresanHidup.clear()
      kotorAktif = true
    }
  })

  const awal = await sketsaTerbaru()
  if (awal) {
    await muatSketsa(awal)
    // Belum ada sumber: muat satu halaman penuh supaya layar tidak kosong.
    const k = kertasDari(sketsa?.paper)
    const { w, h } = ukuran()
    const lw = k.w > 0 ? k.w + 48 : 1200
    const lh = k.w > 0 ? k.h + 48 : 800
    const skala = Math.min(w / lw, h / lh)
    tampilan = { skala, x: (w - (lw - 48) * skala) / 2, y: 24 * skala }
    kotorDasar = true
  }

  window.addEventListener('resize', () => {
    hitungTampilan()
    kotorDasar = true
    kotorAktif = true
  })

  // Layar TV tidak boleh tidur di tengah pelajaran.
  try {
    const n = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<unknown> } }
    await n.wakeLock?.request('screen')
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void n.wakeLock?.request('screen')
    })
  } catch {
    /* tidak didukung — pengaturan hemat daya TV yang menentukan */
  }

  requestAnimationFrame(bingkai)
}

void mulai()

/* ── Murid (HP) ────────────────────────────────────────────────────── */

const el = (id: string) => document.getElementById(id) as HTMLElement

/** Layar masuk: nama dan ruangan; selesai saat server mencatatnya. */
function layarMasuk(): Promise<void> {
  return new Promise((selesai) => {
    const masuk = el('masuk')
    const form = el('form-masuk') as HTMLFormElement
    const nama = el('nama-masuk') as HTMLInputElement
    const ruangan = el('ruangan-masuk')
    let namaLama = ''
    let ruangLama = ruangSaya
    try {
      namaLama = localStorage.getItem('exact-murid-nama') ?? ''
      ruangLama = Number(localStorage.getItem('exact-murid-ruang')) || ruangSaya
    } catch {
      /* abaikan */
    }
    nama.value = namaLama
    ruangan.innerHTML = [1, 2, 3]
      .map(
        (r) =>
          `<label><input type="radio" name="ruang" value="${r}" ${r === ruangLama ? 'checked' : ''}/><span>Room ${r}</span></label>`,
      )
      .join('')
    masuk.classList.add('tampil')
    form.onsubmit = async (e) => {
      e.preventDefault()
      const n = nama.value.trim()
      if (!n) return
      const r = Number((form.querySelector('input[name=ruang]:checked') as HTMLInputElement | null)?.value) || 1
      // Ketukan ini sekaligus membuka izin audio (untuk bunyi "dibahas") dan
      // meminta layar penuh — dua hal yang browser hanya izinkan dari ketukan.
      bunyi('diam')
      void document.documentElement.requestFullscreen?.().catch(() => {})
      try {
        await api('/api/kelas/masuk', { method: 'POST', json: { murid: muridId, nama: n, ruang: r } })
      } catch (err) {
        tampilkanStatus(`Could not join: ${err instanceof Error ? err.message : String(err)}`, true)
        return
      }
      namaSaya = n
      ruangSaya = r
      try {
        localStorage.setItem('exact-murid-nama', n)
        localStorage.setItem('exact-murid-ruang', String(r))
      } catch {
        /* abaikan */
      }
      masuk.classList.remove('tampil')
      selesai()
    }
  })
}

/** Ambil grup/arah dan status pertanyaan sendiri dari server. */
async function segarkanSaya() {
  if (!sebagaiMurid) return
  try {
    const r = await api<{ grup: { id: string; nama: string; target: string | null } | null; tanya: { id: string; status: string; urutan?: number } | null }>(
      `/api/kelas/saya?murid=${encodeURIComponent(muridId)}`,
    )
    const arahBaru = r.grup?.target ?? null
    if (arahBaru !== arah) {
      arah = arahBaru
      sumber = null
      goresanHidup.clear()
      kursor = null
      if (arah?.startsWith('sketsa:')) {
        await muatSketsa(arah.slice(7))
        pandanganSumber = null
        muatSatuHalaman()
      }
      kotorAktif = true
    }
    tanyaSaya = r.tanya
    perbaruiStatusSaya()
  } catch {
    /* jaringan sedang putus — coba lagi di siklus berikutnya */
  }
}

/** Sketsa yang dipaku: tampilkan halaman pertama penuh. */
function muatSatuHalaman() {
  const k = kertasDari(sketsa?.paper)
  const { w, h } = ukuran()
  const lw = k.w > 0 ? k.w + 48 : 1200
  const lh = k.w > 0 ? k.h + 48 : 800
  const skala = Math.min(w / lw, h / lh)
  tampilan = { skala, x: (w - (lw - 48) * skala) / 2, y: 24 * skala }
  kotorDasar = true
  kotorAktif = true
}

function perbaruiStatusSaya() {
  const st = el('status-saya')
  const paham = el('tombol-paham') as HTMLButtonElement
  if (!tanyaSaya) {
    st.innerHTML = ''
    paham.disabled = true
    return
  }
  paham.disabled = false
  st.innerHTML =
    tanyaSaya.status === 'dibahas'
      ? '<b>Your question is being discussed</b> — look at the board'
      : `Waiting · <b>#${tanyaSaya.urutan ?? '?'}</b> in the queue`
}

let fotoData = ''

function pasangBilahMurid() {
  el('bilah').classList.add('tampil')
  const lembar = el('lembar')
  const teks = el('teks-tanya') as HTMLTextAreaElement
  const pratinjau = el('pratinjau-foto') as HTMLImageElement
  const berkas = el('berkas-foto') as HTMLInputElement

  el('tombol-tangan').onclick = () => void kirimTanya('', '')
  el('tombol-tanya').onclick = () => {
    teks.value = ''
    fotoData = ''
    pratinjau.hidden = true
    lembar.classList.add('tampil')
  }
  el('tombol-batal').onclick = () => lembar.classList.remove('tampil')
  el('tombol-foto').onclick = () => berkas.click()
  berkas.onchange = async () => {
    const f = berkas.files?.[0]
    berkas.value = ''
    if (!f) return
    fotoData = await perkecilFoto(f)
    pratinjau.src = fotoData
    pratinjau.hidden = false
  }
  el('tombol-kirim').onclick = () => {
    lembar.classList.remove('tampil')
    void kirimTanya(teks.value, fotoData)
  }
  el('tombol-paham').onclick = () => {
    if (!tanyaSaya) return
    void api('/api/kelas/ubah', { method: 'POST', json: { id: tanyaSaya.id, status: 'selesai' } })
      .then(() => {
        tanyaSaya = null
        perbaruiStatusSaya()
        tampilkanStatus('Marked as understood.')
      })
      .catch(() => tampilkanStatus('Could not send that.', true))
  }

  // Lampu pengawasan: halaman disembunyikan (pindah aplikasi, layar dikunci)
  // atau kehilangan fokus dilaporkan ke guru. Hanya sinyal, bukan kunci.
  const lapor = () => kirim({ t: 'fokus', aktif: document.visibilityState === 'visible' && document.hasFocus() })
  document.addEventListener('visibilitychange', lapor)
  window.addEventListener('blur', lapor)
  window.addEventListener('focus', lapor)
}

async function kirimTanya(teks: string, foto: string) {
  try {
    await api('/api/kelas/tanya', { method: 'POST', json: { murid: muridId, nama: namaSaya, ruang: ruangSaya, teks, foto } })
    tampilkanStatus(foto || teks ? 'Question sent.' : 'Hand raised.')
    await segarkanSaya()
  } catch (e) {
    tampilkanStatus(`Could not send: ${e instanceof Error ? e.message : String(e)}`, true)
  }
}

/**
 * Foto dari kamera HP berukuran 3–8 MB; yang dibutuhkan guru cukup 1280 px.
 * Diperkecil di HP sebelum diunggah supaya Wi-Fi dan vault tetap ringan.
 */
async function perkecilFoto(f: File): Promise<string> {
  const bitmap = await createImageBitmap(f).catch(() => null)
  if (!bitmap) return ''
  const skala = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bitmap.width * skala)
  c.height = Math.round(bitmap.height * skala)
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(bitmap, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.72)
}

let timerKabar: number | null = null

function terimaBahas(t: { murid: string; nama: string; anggota?: string[]; grup?: string | null; editor?: string | null }) {
  if (!sebagaiMurid) return
  const punyaku = t.murid === muridId
  const segrup = !punyaku && (t.anggota ?? []).includes(muridId)
  if (!punyaku && !segrup) return
  // Langsung ikuti perangkat guru yang membahas — tidak menunggu ia bergerak.
  if (t.editor) {
    sumberPaksa = t.editor
    if (sumber !== t.editor) {
      sumber = t.editor
      goresanHidup.clear()
      kursor = null
      kotorAktif = true
    }
    window.setTimeout(() => {
      if (sumberPaksa === t.editor) sumberPaksa = null
    }, 15 * 60_000)
  }
  bunyi('bahas')
  try {
    navigator.vibrate?.([120, 60, 120])
  } catch {
    /* tidak didukung */
  }
  const kabar = el('kabar')
  kabar.textContent = punyaku
    ? 'Your question is being discussed — look at the board'
    : `${t.nama}'s question is being discussed${t.grup ? ` (${t.grup})` : ''} — look at the board`
  kabar.classList.add('tampil')
  if (timerKabar) window.clearTimeout(timerKabar)
  timerKabar = window.setTimeout(() => kabar.classList.remove('tampil'), 6000)
  if (punyaku) void segarkanSaya()
}
