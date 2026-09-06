import { useCallback, useEffect, useRef, useState } from 'react'
import { dengarkan, type Kanal } from './events'

interface Hasil<T> {
  data: T
  memuat: boolean
  galat: string | null
  muatUlang: () => void
}

/**
 * Muat data dari database, lalu segarkan otomatis setiap kali kanal terkait
 * berubah — termasuk perubahan yang datang dari window lain.
 */
export function useData<T>(
  kanal: Kanal | Kanal[],
  pemuat: () => Promise<T>,
  awal: T,
  deps: unknown[] = [],
): Hasil<T> {
  const [data, setData] = useState<T>(awal)
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  const pemuatRef = useRef(pemuat)
  pemuatRef.current = pemuat

  /**
   * Nomor urut pemuatan.
   *
   * Dulu tiap pemuatan membawa penanda batalnya sendiri, dan penanda itu
   * dibuang begitu saja oleh pendengar event — dua pemuatan yang berjalan
   * bersamaan sama-sama menulis hasilnya, dan yang mendarat terakhir belum
   * tentu yang paling baru. Nomor ini membuat hanya pemuatan termuda yang
   * boleh berbicara; sisanya diam.
   */
  const generasi = useRef(0)

  const jalankan = useCallback(() => {
    const gen = ++generasi.current
    pemuatRef
      .current()
      .then((d) => {
        if (gen !== generasi.current) return
        setData(d)
        setGalat(null)
      })
      .catch((e: unknown) => {
        if (gen !== generasi.current) return
        setGalat(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (gen === generasi.current) setMemuat(false)
      })
  }, [])

  /**
   * Kumpulkan permintaan muat ulang yang datang berdesakan jadi satu.
   *
   * Satu tindakan kecil sering menyiarkan lebih dari satu kanal, dan satu
   * halaman bisa punya sepuluh langganan pada kanal yang sama. Tanpa ini,
   * mencentang satu baris memicu belasan kueri dan belasan penggambaran ulang
   * dalam satu hela napas — dan itulah yang terasa sebagai klik yang berat.
   */
  const tunda = useRef<number | null>(null)
  const jadwalkan = useCallback(() => {
    if (tunda.current != null) return
    tunda.current = window.requestAnimationFrame(() => {
      tunda.current = null
      jalankan()
    })
  }, [jalankan])

  useEffect(() => {
    jalankan()
    const kanalArr = Array.isArray(kanal) ? kanal : [kanal]
    const lepas = kanalArr.map((k) => dengarkan(k, jadwalkan))
    return () => {
      // Naikkan generasinya: hasil yang mendarat setelah komponen pergi tidak
      // boleh menyentuh state-nya lagi.
      generasi.current++
      if (tunda.current != null) window.cancelAnimationFrame(tunda.current)
      tunda.current = null
      lepas.forEach((f) => f())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, memuat, galat, muatUlang: jalankan }
}

/**
 * Kotak isian yang menulis ke database setelah mengetik berhenti sejenak.
 *
 * Tanpa ini, tiap ketukan tombol memicu tulis + siar perubahan, dan komponen
 * yang sedang kamu ketik itu dimuat ulang — kursornya lompat keluar.
 */
export function useSimpanTertunda<T>(
  nilaiAwal: T,
  simpan: (nilai: T) => void | Promise<void>,
  jeda = 500,
): [T, (nilai: T) => void] {
  const [nilai, setNilai] = useState(nilaiAwal)
  const timer = useRef<number | null>(null)
  const simpanRef = useRef(simpan)
  simpanRef.current = simpan

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  const ubah = useCallback(
    (berikut: T) => {
      setNilai(berikut)
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void simpanRef.current(berikut), jeda)
    },
    [jeda],
  )

  return [nilai, ubah]
}
