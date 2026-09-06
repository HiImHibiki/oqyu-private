/**
 * Akses SQLite lewat tauri-plugin-sql.
 * Migrasi dijalankan di sisi Rust (src-tauri/src/db.rs) saat plugin dimuat,
 * jadi di sini kita cukup membuka koneksi ke berkas di dalam vault.
 */
import type Database from '@tauri-apps/plugin-sql'
import { inTauri } from './runtime'
import { api } from './api'

export interface VaultInfo {
  root: string
  dbUrl: string
  canvasDir: string
}

let vaultCache: VaultInfo | null = null

export async function vaultInfo(): Promise<VaultInfo> {
  if (vaultCache) return vaultCache
  if (!inTauri) {
    vaultCache = await api<VaultInfo>('/api/vault')
    return vaultCache
  }
  const { invoke } = await import('@tauri-apps/api/core')
  vaultCache = await invoke<VaultInfo>('vault_info')
  return vaultCache
}

let koneksi: Promise<Database> | null = null

const jeda = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function terkunci(e: unknown): boolean {
  const pesan = e instanceof Error ? e.message : String(e)
  return /database is locked|code: 5|busy/i.test(pesan)
}

export function db(): Promise<Database> {
  if (!koneksi) {
    koneksi = (async () => {
      if (!inTauri) {
        throw new Error(
          'The database is only available inside the app. Run "npm run app", not "npm run dev".',
        )
      }
      const { default: Database } = await import('@tauri-apps/plugin-sql')
      const { dbUrl } = await vaultInfo()

      // Beberapa window membuka database yang sama. Yang pertama menjalankan
      // migrasi dan sempat memegang kunci tulis; yang lain menunggu giliran.
      let d: Database | null = null
      for (let percobaan = 0; percobaan < 12; percobaan++) {
        try {
          d = await Database.load(dbUrl)
          break
        } catch (e) {
          if (!terkunci(e) || percobaan === 11) throw e
          await jeda(200 + percobaan * 150)
        }
      }
      if (!d) throw new Error('The database could not be opened.')

      await d.execute('PRAGMA journal_mode = WAL').catch(() => {})
      await d.execute('PRAGMA wal_autocheckpoint = 256').catch(() => {})
      await d.execute('PRAGMA journal_size_limit = 0').catch(() => {})
      await d.execute('PRAGMA busy_timeout = 15000').catch(() => {})
      return d
    })().catch((e) => {
      koneksi = null
      throw e
    })
  }
  return koneksi
}

/** SELECT. */
export async function q<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!inTauri) {
    const r = await api<{ rows: T[] }>('/api/sql', { method: 'POST', json: { sql, params } })
    return r.rows
  }
  const d = await db()
  return d.select<T[]>(sql, params)
}

/** SELECT satu baris. */
export async function q1<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params)
  return rows[0] ?? null
}

/** INSERT / UPDATE / DELETE. */
export async function x(sql: string, params: unknown[] = []): Promise<void> {
  if (!inTauri) {
    await api('/api/sql', { method: 'POST', json: { sql, params } })
    return
  }
  const d = await db()
  await d.execute(sql, params)
}

/* ── settings: key/value sederhana ─────────────────────────────────── */

export async function getSetting(key: string): Promise<string | null> {
  const row = await q1<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])
  return row?.value ?? null
}

export async function getSettingJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await getSetting(key)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  await x(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  )
}

export async function setSettingJSON(key: string, value: unknown): Promise<void> {
  await setSetting(key, JSON.stringify(value))
}

/** Lipat isi WAL kembali ke berkas database utama (aman untuk iCloud). */
export async function lipatWal(): Promise<void> {
  if (!inTauri) return
  try {
    await x('PRAGMA wal_checkpoint(TRUNCATE)')
  } catch {
    // Percobaan berikutnya akan mengejar.
  }
}
