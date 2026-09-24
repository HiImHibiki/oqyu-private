import { inTauri } from './runtime'

export type HalamanId = 'kanvas'

/**
 * Buka satu jendela kanvas lagi, di label yang masih kosong.
 *
 * Jendela dikenali lewat label tetap (`layar-2` … `layar-9`) supaya plugin
 * window-state bisa mengingat posisi dan ukurannya antar sesi.
 */
export async function bukaJendelaBaru(_halaman: HalamanId = 'kanvas'): Promise<string | null> {
  if (!inTauri) return null
  const { invoke } = await import('@tauri-apps/api/core')
  const terbuka = await invoke<string[]>('window_list').catch(() => [] as string[])
  const calon = ['layar-2', 'layar-3', 'layar-4', 'layar-5', 'layar-6', 'layar-7', 'layar-8', 'layar-9']
  const label = calon.find((l) => !terbuka.includes(l))
  if (!label) return null
  await invoke('open_window', { label, title: 'Exact Canvas' })
  return label
}
