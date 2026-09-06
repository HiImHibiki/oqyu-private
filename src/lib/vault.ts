/**
 * Vault = data kamu, di luar aplikasi (default ~/ExactCanvas, atau folder
 * ExactCanvas di iCloud Drive kalau ada). Sketsa tetap berkas JSON biasa.
 */
import { inTauri } from './runtime'
import { vaultInfo } from './db'
import { api } from './api'

async function inv<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!inTauri) throw new Error('The vault is only available inside the app.')
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

export const kanvas = {
  baca: async (id: string) => {
    if (inTauri) return inv<string | null>('canvas_read', { id })
    try {
      const isi = await api<string | object>(`/api/canvas/${encodeURIComponent(id)}`)
      return typeof isi === 'string' ? isi : JSON.stringify(isi)
    } catch (e) {
      if ((e as { status?: number }).status === 404) return null
      throw e
    }
  },
  tulis: (id: string, json: string) =>
    inTauri
      ? inv<void>('canvas_write', { id, json })
      : api<void>(`/api/canvas/${encodeURIComponent(id)}`, { method: 'PUT', body: json }),
  daftar: () => (inTauri ? inv<string[]>('canvas_list') : api<string[]>('/api/canvas')),
  hapus: (id: string) =>
    inTauri
      ? inv<void>('canvas_delete', { id })
      : api<void>(`/api/canvas/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}

export const vault = {
  info: () => vaultInfo(),
  /** Pakai folder lain sebagai vault (berlaku setelah aplikasi dimulai ulang). */
  pakai: (path: string) => inv<string>('vault_set_root', { path }),
  mulaiUlang: () => inv<void>('app_restart'),
}

/** Buka folder vault di Finder. */
export async function bukaVault(): Promise<void> {
  const { root } = await vaultInfo()
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
  await revealItemInDir(root)
}
