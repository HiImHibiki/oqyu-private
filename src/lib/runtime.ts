/** Deteksi apakah kode berjalan di dalam shell Tauri (bukan tab browser biasa). */
export const inTauri: boolean =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export type WindowLabel = string

/** Label window aktif. Di browser, ?window=board dipakai untuk pratinjau. */
export function windowLabel(): WindowLabel {
  if (inTauri) {
    const meta = (window as unknown as {
      __TAURI_INTERNALS__: {
        metadata?: {
          currentWindow?: { label?: string }
          currentWebview?: { label?: string }
        }
      }
    }).__TAURI_INTERNALS__?.metadata
    return meta?.currentWindow?.label ?? meta?.currentWebview?.label ?? 'focus'
  }
  return new URLSearchParams(location.search).get('window') ?? 'focus'
}
