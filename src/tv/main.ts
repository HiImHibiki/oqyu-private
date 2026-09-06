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
import { dengarkanLangsung, mulaiSinkron, useSinkron, type PesanLangsung } from '@/lib/sinkron'
import { JARAK_HALAMAN, kertasDari, kotakHalaman } from '@/modules/canvas/kertas'
import {
  gambarCoretan,
  gambarTeks,
  gambarTempelan,
  muatGambar,
  warnaToken,
  type BerkasKanvas,
  type Coretan,
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

const modeMuat = new URLSearchParams(location.search).get('mode') === 'fit'

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
  const skala = Math.min(w / lw, h / lh)
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
    const teks = await api<string | object>(`/api/canvas/${encodeURIComponent(id)}`)
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
    return
  }
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
      const hapus = (p.hapus ?? {}) as { coretan?: string[]; objek?: string[]; teks?: string[] }
      const tambah = (p.tambah ?? {}) as { coretan?: Coretan[]; objek?: Objek[] }
      const hc = new Set(hapus.coretan ?? [])
      const ho = new Set(hapus.objek ?? [])
      const ht = new Set(hapus.teks ?? [])
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

  const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
  mulaiSinkron({ url: wsUrl, pin, peran: 'tv', nama: `${namaPerangkat()} (TV)` })
  dengarkanLangsung(terima)

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
    if (sumber && !s.klien.some((k) => k.id === sumber)) {
      // Editor yang diikuti pergi; siapa pun yang bergerak berikutnya diikuti.
      sumber = null
      kursor = null
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
