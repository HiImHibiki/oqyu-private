/**
 * Kelas langsung di sisi guru: ruangan editor ini, antrian pertanyaan, murid
 * yang masuk, dan grup. Data tinggal di SQLite vault; aksi yang harus
 * mengabari HP (membahas pertanyaan) lewat endpoint server supaya HP murid
 * yang bersangkutan berbunyi.
 */

import { create } from 'zustand'
import { api } from './api'
import { getSetting, q, setSetting, x } from './db'
import { pancarkan } from './events'
import { newId } from './id'
import { inTauri } from './runtime'
import { setRuangSinkron } from './sinkron'

export const RUANGAN = [1, 2, 3] as const

export interface Tanya {
  id: string
  student_id: string
  name: string
  room: number
  text: string | null
  photo: string | null
  status: 'menunggu' | 'dibahas' | 'selesai'
  created_at: number
  handled_at: number | null
}

export interface Murid {
  id: string
  name: string
  room: number
  first_seen: number
  last_seen: number
}

export interface Grup {
  id: string
  name: string
  color: string | null
  /** null = ruangannya sendiri; 'ruang:2' | 'editor:<id>' | 'sketsa:<id>' */
  target: string | null
  sort_order: number | null
}

/* ── Ruangan editor ini ────────────────────────────────────────────── */

const KUNCI_RUANG = 'ruang_editor'

interface StoreKelas {
  ruang: number
  setRuang: (r: number) => void
}

export const useKelas = create<StoreKelas>((set) => ({
  ruang: 1,
  setRuang: (r) => {
    set({ ruang: r })
    setRuangSinkron(r)
    if (inTauri) void setSetting(KUNCI_RUANG, String(r)).catch(() => {})
    else {
      try {
        localStorage.setItem(KUNCI_RUANG, String(r))
      } catch {
        /* abaikan */
      }
    }
  },
}))

/** Ruangan yang terakhir dipilih editor ini. Mac bawaannya 1, tablet ingat sendiri. */
export async function muatRuang(): Promise<number> {
  let v: string | null = null
  if (inTauri) v = await getSetting(KUNCI_RUANG).catch(() => null)
  else {
    try {
      v = localStorage.getItem(KUNCI_RUANG)
    } catch {
      v = null
    }
  }
  const r = Number(v)
  const ruang = Number.isInteger(r) && r >= 1 && r <= 9 ? r : 1
  useKelas.setState({ ruang })
  return ruang
}

/* ── Antrian ───────────────────────────────────────────────────────── */

export async function daftarTanya(): Promise<Tanya[]> {
  return q<Tanya>(
    "SELECT * FROM questions WHERE status != 'selesai' ORDER BY CASE status WHEN 'dibahas' THEN 0 ELSE 1 END, created_at ASC",
  )
}

export async function riwayatTanya(batas = 30): Promise<Tanya[]> {
  return q<Tanya>("SELECT * FROM questions WHERE status = 'selesai' ORDER BY handled_at DESC LIMIT ?", [batas])
}

/** Lewat server, bukan SQL langsung: HP murid (dan grupnya) harus dikabari. */
export async function ubahTanya(id: string, status: 'dibahas' | 'selesai'): Promise<void> {
  await api('/api/kelas/ubah', { method: 'POST', json: { id, status } })
}

/* ── Murid & grup ──────────────────────────────────────────────────── */

/** Murid yang terlihat dalam 10 jam terakhir — satu hari mengajar. */
export async function daftarMurid(): Promise<Murid[]> {
  return q<Murid>('SELECT * FROM students WHERE last_seen > ? ORDER BY room, name COLLATE NOCASE', [
    Date.now() - 10 * 3600_000,
  ])
}

export async function daftarGrup(): Promise<Grup[]> {
  return q<Grup>('SELECT * FROM groups ORDER BY sort_order, name COLLATE NOCASE')
}

export async function anggotaGrup(): Promise<{ group_id: string; student_id: string }[]> {
  return q('SELECT group_id, student_id FROM group_members')
}

const WARNA_GRUP = ['#b4531a', '#1f6f5c', '#1d4ed8', '#7c3aed', '#d97706', '#0891b2']

export async function buatGrup(nama: string): Promise<string> {
  const id = newId('grp')
  const semua = await daftarGrup()
  await x('INSERT INTO groups (id, name, color, target, sort_order) VALUES (?, ?, ?, NULL, ?)', [
    id,
    nama.trim() || 'Group',
    WARNA_GRUP[semua.length % WARNA_GRUP.length],
    Date.now(),
  ])
  await pancarkan('kelas', { apa: 'grup' })
  return id
}

export async function ubahGrup(id: string, ubah: { name?: string; target?: string | null }): Promise<void> {
  if (ubah.name !== undefined) await x('UPDATE groups SET name = ? WHERE id = ?', [ubah.name, id])
  if (ubah.target !== undefined) await x('UPDATE groups SET target = ? WHERE id = ?', [ubah.target, id])
  await pancarkan('kelas', { apa: 'grup' })
}

export async function hapusGrup(id: string): Promise<void> {
  await x('DELETE FROM group_members WHERE group_id = ?', [id])
  await x('DELETE FROM groups WHERE id = ?', [id])
  await pancarkan('kelas', { apa: 'grup' })
}

/** Satu murid hanya di satu grup; null mengeluarkannya dari grup mana pun. */
export async function tetapkanGrup(muridId: string, grupId: string | null): Promise<void> {
  await x('DELETE FROM group_members WHERE student_id = ?', [muridId])
  if (grupId) await x('INSERT OR IGNORE INTO group_members (group_id, student_id) VALUES (?, ?)', [grupId, muridId])
  await pancarkan('kelas', { apa: 'grup' })
}

/* ── Bunyi ─────────────────────────────────────────────────────────── */

let audio: AudioContext | null = null

/**
 * Dua nada pendek. AudioContext dibuat saat pertama dipanggil; di browser
 * ia baru boleh berbunyi setelah ada ketukan pengguna, jadi pemanggil di HP
 * memanggilnya sekali (tanpa bunyi) saat tombol Masuk ditekan.
 */
export function bunyi(jenis: 'tanya' | 'bahas' | 'diam' = 'tanya'): void {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    if (jenis === 'diam') return
    const nada = jenis === 'tanya' ? [880, 1174] : [659, 880, 1046]
    nada.forEach((f, i) => {
      const o = audio!.createOscillator()
      const g = audio!.createGain()
      o.type = 'sine'
      o.frequency.value = f
      g.gain.value = 0.0001
      o.connect(g).connect(audio!.destination)
      const t0 = audio!.currentTime + i * 0.16
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15)
      o.start(t0)
      o.stop(t0 + 0.16)
    })
  } catch {
    /* tanpa audio */
  }
}

/** "3 min", "just now" */
export function lamaMenunggu(sejak: number): string {
  const m = Math.round((Date.now() - sejak) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${m % 60} m`
}
