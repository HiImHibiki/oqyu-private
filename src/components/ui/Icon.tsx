/**
 * Ikon garis, digambar langsung sebagai SVG — tanpa pustaka ikon.
 * currentColor selalu dipakai supaya ikon ikut warna tema.
 */
export type NamaIkon = keyof typeof JALUR


const JALUR = {
  tambah: 'M12 5v14M5 12h14',
  centang: 'M4 12.5l5 5L20 6.5',
  silang: 'M6 6l12 12M18 6L6 18',
  hapus: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  catatan: 'M6 3h8l4 4v14H6zM14 3v4h4',
  papan: 'M3 4h18v14H3zM8 18l-1 3M16 18l1 3M12 9v5M12 9l-3 2M12 9l3 2',
  kanban: 'M4 4h4v16H4zM10 4h4v11h-4zM16 4h4v7h-4z',
  kalender: 'M3 6h18v15H3zM3 10h18M8 3v4M16 3v4',
  galeri: 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6M8.5 9.5a1 1 0 100-2 1 1 0 000 2z',
  saham: 'M3 20h18M5 16l4-5 3.5 3L20 6M20 6h-4M20 6v4',
  pena: 'M4 20l4-1 10-10-3-3L5 16zM14 6l3 3',
  penghapus: 'M7 19h13M15 5l5 5-8 8H8l-4-4z',
  spidol: 'M5 19h5l9-9-4-4-9 9zM4 21h16',
  mata: 'M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  mataCoret: 'M4 4l16 16M9.9 5.2A9.6 9.6 0 0112 5c6.4 0 10 6 10 6a15 15 0 01-3.3 3.7M6.5 7.3C3.6 8.9 2 11 2 11s3.6 6 10 6a9.9 9.9 0 003.7-.7',
  gembokBuka: 'M6 11h12v10H6zM9 11V8a3 3 0 015.7-1.3',
  lingkaran: 'M12 4a8 8 0 100 16 8 8 0 000-16z',
  segitiga: 'M12 4L21 20H3z',
  kubus: 'M4 8h11v11H4zM4 8l5-4h11v11l-5 4M15 8l5-4M15 19l5-4',
  balok: 'M3 10h13v8H3zM3 10l4-3h13v8l-4 3M16 10l4-3M16 18l4-3',
  sumbu2d: 'M4 20h17M4 20V3M4 20l-3 0M21 20l-3-3M21 20l-3 3M4 3L1 6M4 3l3 3',
  sumbu3d: 'M12 12h9M12 12V3M12 12L4 20M21 12l-3-3M21 12l-3 3M12 3l-3 3M12 3l3 3M4 20l1-4M4 20l4-1',
  halaman: 'M6 3h8l4 4v14H6zM14 3v4h4',
  pdf: 'M6 3h8l4 4v14H6zM14 3v4h4M9 13h1.5a1.5 1.5 0 010 3H9v-3zm0 0v5M14 13h2M14 18v-5h2',
  sembunyi: 'M15 5l-6 7 6 7',
  tampilkan: 'M9 5l6 7-6 7',
  garis: 'M4 20L20 4',
  kotakBentuk: 'M4 5h16v14H4z',
  elips: 'M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z',
  panah: 'M4 20L20 4M20 4h-7M20 4v7',
  jendela: 'M3 5h13v13H3zM8 8h13v13H8',
  teks: 'M5 7V5h14v2M12 5v14M9 19h6',
  pensil: 'M4 20l3-.8 11-11-2.2-2.2-11 11zM15 6.5l2.2 2.2M4 20l1.2-3',
  kaligrafi: 'M5 19l3.5-1L20 6.5 17.5 4 6 15.5zM15.5 6l2.5 2.5M5 19l1-3.5',
  kuas: 'M6 21c3 0 5-2 5-5l-4-4c-3 0-5 2-5 5zM11 16L20 7a2 2 0 00-3-3l-9 9',
  belahketupat: 'M12 3l9 9-9 9-9-9z',
  layang: 'M12 3l8 7-8 11-8-11z',
  trapesium: 'M3 19h18l-4-14H7z',
  parabola: 'M4 5C7 19 17 19 20 5',
  kubik: 'M4 20c4 0 4-8 8-8s4-8 8-8',
  kuartik: 'M5 5c1 15 13 15 14 0',
  petak: 'M3 9h18M3 15h18M9 3v18M15 3v18',
  laso: 'M12 4c5 0 8 2.5 8 5.5S17 15 12 15s-8-2.5-8-5.5S7 4 12 4zM9 15c0 3 1 5 3 5',
  lasoKotak: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M11 4h2M11 20h2M4 11v2M20 11v2',
  cari: 'M11 4a7 7 0 100 14 7 7 0 000-14zM16 16l4.5 4.5',
  atur: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19.4 13.5l1.7 1-2 3.4-1.9-.7a7 7 0 01-1.7 1l-.3 2h-4l-.3-2a7 7 0 01-1.7-1l-1.9.7-2-3.4 1.7-1a7 7 0 010-2l-1.7-1 2-3.4 1.9.7a7 7 0 011.7-1l.3-2h4l.3 2a7 7 0 011.7 1l1.9-.7 2 3.4-1.7 1a7 7 0 010 2z',
  lonceng: 'M12 3a5 5 0 00-5 5v4l-2 3h14l-2-3V8a5 5 0 00-5-5zM10 18a2 2 0 004 0',
  jam: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3.5 2',
  bintang: 'M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8z',
  palet: 'M12 3a9 9 0 000 18c1.5 0 2-1 1.4-2-.7-1.2 0-2.5 1.4-2.5H17a4 4 0 004-4c0-5-4-9.5-9-9.5zM7.5 11.5a1 1 0 100-2 1 1 0 000 2zM11 8a1 1 0 100-2 1 1 0 000 2zM15.5 9.5a1 1 0 100-2 1 1 0 000 2z',
  kiri: 'M15 5l-7 7 7 7',
  kanan: 'M9 5l7 7-7 7',
  atas: 'M5 15l7-7 7 7',
  bawah: 'M5 9l7 7 7-7',
  tautan: 'M10 13a4 4 0 005.7 0l2.6-2.6a4 4 0 10-5.7-5.7L11.5 6M14 11a4 4 0 00-5.7 0l-2.6 2.6a4 4 0 105.7 5.7L12.5 18',
  layar: 'M3 4h18v12H3zM8 20h8M12 16v4',
  arsip: 'M3 6h18v4H3zM5 10v10h14V10M9 14h6',
  urungkan: 'M9 8L4 12l5 4M4 12h9a6 6 0 010 12h-2',
  ulangi: 'M15 8l5 4-5 4M20 12h-9a6 6 0 000 12h2',
  lapisan: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  tarik: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
  pin: 'M12 3l4 4-1.5 1.5 2 4.5-4-2L8 15l-2-2 3.5-4.5-2-4L9.5 3zM8 16l-3 5',
  keluar: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h9',

  // ── Tempat & benda ──────────────────────────────────────────────
  rumah: 'M4 11l8-7 8 7M6 10v10h12V10M10 20v-6h4v6',
  buku: 'M5 4h9a3 3 0 013 3v13H8a3 3 0 01-3-3zM8 20a3 3 0 01-3-3M9 8h6M9 12h6',
  kopi: 'M4 8h13v6a5 5 0 01-5 5H9a5 5 0 01-5-5zM17 10h2a2 2 0 010 4h-2M6 5V3M10 5V3M14 5V3',
  dompet: 'M4 7h14a2 2 0 012 2v8a2 2 0 01-2 2H4zM4 7V5h11M17 13h.01',
  keranjang: 'M4 6h2l2 10h9l2-7H7M9 20h.01M17 20h.01',
  mobil: 'M4 15l1.6-5A2 2 0 017.5 8.6h9A2 2 0 0118.4 10L20 15v4h-3v-2H7v2H4zM7 15h.01M17 15h.01',
  pesawat: 'M4 13l16-6-5.5 12-2.5-4.5L4 13z',
  hadiah: 'M3 10h18v4H3zM5 14v6h14v-6M12 10v10M12 10c-3 0-4-1.5-4-3a2 2 0 014-.4 2 2 0 014 .4c0 1.5-1 3-4 3z',
  obat: 'M8 3h8v4H8zM6 7h12v14H6zM12 11v6M9 14h6',
  gunting: 'M7 5l10 12M17 5L7 17M6 19a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18 19a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  gembok: 'M6 11h12v10H6zM9 11V8a3 3 0 016 0v3M12 15v2',
  folder: 'M3 6h6l2 3h10v11H3z',
  terminal: 'M3 5h18v14H3zM7 10l3 2-3 2M13 14h4',
  kompas: 'M12 3a9 9 0 100 18 9 9 0 000-18zM15 9l-2 4-4 2 2-4z',
  amplop: 'M3 6h18v12H3zM3 7l9 6 9-6',
  obrolan: 'M4 5h16v11H9l-5 4z',
  orang: 'M12 4a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM5 20a7 7 0 0114 0',
  grup: 'M9 5a3 3 0 100 6 3 3 0 000-6zM3 19a6 6 0 0112 0M17 11a3 3 0 100-6M18 19a5.5 5.5 0 00-3-4.9',
  hati: 'M12 20s-7-4.4-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.6-7 9-7 9z',
  bohlam: 'M12 3a6 6 0 00-3.5 10.9V16h7v-2.1A6 6 0 0012 3zM10 19h4M10.5 21h3',
  roket: 'M14 4c3 1 5.5 3.5 6 6.5-2 3-5 6-9 8l-2.5-2.5C10.5 12 13 8 14 4zM9.5 16L7 13.5M6 15l-2 5 5-2',
  target: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11.5a.5.5 0 100 1 .5.5 0 000-1z',
  timer: 'M12 5a8 8 0 100 16 8 8 0 000-16zM12 9v4l2.5 2M9 3h6',
  filter: 'M4 5h16l-6 7v6l-4 2v-8z',
  pai: 'M12 3v9h9a9 9 0 11-9-9zM21 12a9 9 0 00-9-9',
  gelombang: 'M2 12h2l2-6 3 14 3-11 3 8 2-5h5',

  // ── Cuaca ───────────────────────────────────────────────────────
  matahari: 'M12 7a5 5 0 100 10 5 5 0 000-10zM12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  awan: 'M7 18h10a4 4 0 000-8 6 6 0 00-11.6 1.6A3.5 3.5 0 007 18z',
  hujan: 'M7 15h10a4 4 0 000-8 6 6 0 00-11.6 1.6A3.5 3.5 0 007 15zM8 18l-1 3M12 18l-1 3M16 18l-1 3',
  petir: 'M7 14h10a4 4 0 000-8 6 6 0 00-11.6 1.6A3.5 3.5 0 007 14zM13 16l-3 3h3l-1 3',
  kabut: 'M4 9h16M6 13h12M4 17h16',
  angin: 'M3 8h11a3 3 0 10-3-3M3 12h15a3 3 0 11-3 3M3 16h8a2.5 2.5 0 112.5 2.5',
  bulan: 'M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z',
  suhu: 'M12 4a2 2 0 012 2v7.2a4 4 0 11-4 0V6a2 2 0 012-2zM12 9v6',
} as const

export const NAMA_IKON = Object.keys(JALUR) as NamaIkon[]

interface Props {
  nama: NamaIkon
  ukuran?: number
  tebal?: number
  className?: string
}

export function Icon({ nama, ukuran = 18, tebal = 1.6, className }: Props) {
  return (
    <svg
      width={ukuran}
      height={ukuran}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={tebal}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={JALUR[nama]} />
    </svg>
  )
}
