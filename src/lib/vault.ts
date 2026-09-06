/**
 * Vault = data kamu, di luar aplikasi (default ~/ExactCanvas, atau folder
 * ExactCanvas di iCloud Drive kalau ada). Sketsa tetap berkas JSON biasa.
 */
import { inTauri } from './runtime'
import { vaultInfo } from './db'

async function inv<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!inTauri) throw new Error('The vault is only available inside the app.')
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

export const kanvas = {
  baca: (id: string) => inv<string | null>('canvas_read', { id }),
  tulis: (id: string, json: string) => inv<void>('canvas_write', { id, json }),
  daftar: () => inv<string[]>('canvas_list'),
  hapus: (id: string) => inv<void>('canvas_delete', { id }),
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
