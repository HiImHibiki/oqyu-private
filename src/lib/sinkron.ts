/**
 * Sinkronisasi langsung antar layar lewat hub WebSocket di aplikasi Mac.
 *
 * Yang lewat sini bukan data tersimpan — itu urusan vault — melainkan yang
 * sedang terjadi *sekarang*: pandangan yang digeser, goresan yang baru
 * setengah jalan, penggaris yang dipindah, ujung pena yang melayang. TV
 * mengikutinya tanpa jeda karena yang dikirim hanya angka koordinat. Servernya
 * tidak menafsirkan apa pun; ia menyiarkan tiap pesan ke semua klien lain.
 */

import { create } from 'zustand'

export interface Klien {
  id: string
  nama: string
  peran: string
  ruang: number
  murid: string
  fokus: boolean
  keluar: number
  tunggu: boolean
}

export interface PesanLangsung {
  t: string
  src?: string
  [k: string]: unknown
}

export interface OpsiSinkron {
  /** ws://host:port/ws */
  url: string
  pin: string
  peran: 'editor' | 'tv'
  nama: string
  /** Ruangan tempat perangkat ini berada. */
  ruang?: number
  /** Id murid, untuk HP yang masuk dengan nama. */
  murid?: string
  /** Token/sandi admin — wajib untuk peran editor. */
  admin?: string
}

/** Id jendela/browser ini; pesan yang memantul balik dari server dikenali darinya. */
export const idKlien = `k${Math.random().toString(36).slice(2, 9)}`

type Handler = (p: PesanLangsung) => void
const pendengar = new Set<Handler>()

interface StoreSinkron {
  status: 'mati' | 'menyambung' | 'tersambung'
  klien: Klien[]
  /** Server berhenti dari sisi Mac; jangan mencoba menyambung lagi. */
  serverMati: boolean
  /** Penanda proses server; berganti tiap aplikasi Mac dibuka ulang. */
  server: string | null
}

export const useSinkron = create<StoreSinkron>(() => ({ status: 'mati', klien: [], serverMati: false, server: null }))

let ws: WebSocket | null = null
let opsi: OpsiSinkron | null = null
let timerUlang: number | null = null

function sambung() {
  if (!opsi) return
  const u = new URL(opsi.url)
  u.searchParams.set('pin', opsi.pin)
  u.searchParams.set('id', idKlien)
  u.searchParams.set('name', opsi.nama)
  u.searchParams.set('role', opsi.peran)
  u.searchParams.set('ruang', String(opsi.ruang ?? 1))
  if (opsi.murid) u.searchParams.set('murid', opsi.murid)
  if (opsi.admin) u.searchParams.set('admin', opsi.admin)
  useSinkron.setState({ status: 'menyambung' })
  const soket = new WebSocket(u.toString())
  ws = soket
  soket.onopen = () => {
    if (ws !== soket) return
    useSinkron.setState({ status: 'tersambung', serverMati: false })
  }
  soket.onmessage = (e) => {
    let p: PesanLangsung
    try {
      p = JSON.parse(String(e.data)) as PesanLangsung
    } catch {
      return
    }
    if (p.t === 'klien') {
      useSinkron.setState({ klien: (p.daftar as Klien[]) ?? [], server: (p.server as string | undefined) ?? null })
      return
    }
    if (p.t === 'server-mati') {
      useSinkron.setState({ serverMati: true })
      hentikanSinkron()
      return
    }
    if (p.src === idKlien) return
    pendengar.forEach((h) => h(p))
  }
  soket.onclose = () => {
    if (ws !== soket) return
    ws = null
    if (!opsi) {
      useSinkron.setState({ status: 'mati', klien: [] })
      return
    }
    // Wi-Fi putus sebentar tidak boleh mematikan layar TV sampai malam:
    // coba lagi tiap dua detik selama masih diminta tersambung.
    useSinkron.setState({ status: 'menyambung' })
    timerUlang = window.setTimeout(sambung, 2000)
  }
  soket.onerror = () => {
    // onclose menyusul dan yang menangani penyambungan ulang.
  }
}

export function mulaiSinkron(o: OpsiSinkron): void {
  if (opsi && opsi.url === o.url && opsi.pin === o.pin && ws && ws.readyState <= 1) {
    // Hanya ruangannya yang berubah: cukup kabari server, tanpa menyambung ulang.
    if (o.ruang !== undefined && o.ruang !== opsi.ruang) {
      opsi = { ...opsi, ruang: o.ruang }
      kirim({ t: 'ruang', ruang: o.ruang })
    }
    return
  }
  hentikanSinkron()
  opsi = o
  sambung()
}

export function hentikanSinkron(): void {
  opsi = null
  if (timerUlang) window.clearTimeout(timerUlang)
  timerUlang = null
  const s = ws
  ws = null
  s?.close()
  useSinkron.setState({ status: 'mati', klien: [] })
}

/** Editor berpindah ruangan: server dikabari, dan penyambungan ulang memakai ruangan baru. */
export function setRuangSinkron(ruang: number): void {
  if (opsi) opsi = { ...opsi, ruang }
  kirim({ t: 'ruang', ruang })
}

export function tersambung(): boolean {
  return ws?.readyState === WebSocket.OPEN
}

/** Kirim ke semua layar lain. Diam-diam dibuang kalau sedang tidak tersambung. */
export function kirim(p: Record<string, unknown>): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ ...p, src: idKlien }))
}

/** Dengarkan pesan dari layar lain (pesan sendiri sudah disaring). */
export function dengarkanLangsung(h: Handler): () => void {
  pendengar.add(h)
  return () => {
    pendengar.delete(h)
  }
}
