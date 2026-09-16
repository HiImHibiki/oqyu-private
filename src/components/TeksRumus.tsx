import { useMemo } from 'react'
import katex from 'katex'

/* Teks yang memuat rumus LaTeX di antara tanda $ … $ (atau $$ … $$ untuk rumus
 * yang berdiri sendiri), digambar dengan KaTeX.
 *
 * Dipakai kartu antrean pertanyaan: soal yang dikirim Exact Practice memakai
 * notasi yang sama dengan bank soalnya, jadi tanpa ini guru membaca
 * "$2^{x^2 - 3x} \le 16$" apa adanya — pertidaksamaan yang justru jadi inti
 * pertanyaannya malah paling sulit dibaca.
 *
 * Pemisah dan pilihan sengaja disamakan dengan RichText milik Exact Practice
 * supaya satu teks tergambar sama di kedua aplikasi.
 */

const RE_RUMUS = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g

interface Bagian {
  isi: string
  rumus: boolean
  blok: boolean
}

function pisah(teks: string): Bagian[] {
  const bagian: Bagian[] = []
  let akhir = 0
  for (const m of teks.matchAll(RE_RUMUS)) {
    const mulai = m.index ?? 0
    if (mulai > akhir) bagian.push({ isi: teks.slice(akhir, mulai), rumus: false, blok: false })
    const blok = m[1] !== undefined
    bagian.push({ isi: blok ? m[1] : m[2], rumus: true, blok })
    akhir = mulai + m[0].length
  }
  if (akhir < teks.length) bagian.push({ isi: teks.slice(akhir), rumus: false, blok: false })
  return bagian
}

function lolos(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Teks yang sama sebagai string HTML: teks biasa dilolos-escape, rumus lewat
 * KaTeX. Dipakai saat soal teks (mis. kiriman Exact Practice) harus jadi
 * gambar di kanvas — html2canvas butuh DOM sungguhan, bukan simpul React.
 */
export function htmlRumus(teks: string): string {
  return pisah(teks)
    .map((b) =>
      b.rumus
        ? katex.renderToString(b.isi, { displayMode: b.blok, throwOnError: false, output: 'html', strict: false })
        : lolos(b.isi),
    )
    .join('')
}

export function TeksRumus({ teks }: { teks: string }) {
  const bagian = useMemo(() => pisah(teks), [teks])
  return (
    <>
      {bagian.map((b, i) =>
        b.rumus ? (
          <span
            key={i}
            /* Hanya potongan rumus yang disisipkan sebagai HTML, dan isinya
               keluaran KaTeX sendiri (throwOnError mati, jadi LaTeX cacat
               kembali sebagai teks bertanda, bukan lemparan). Teks biasa tetap
               simpul teks React sehingga lolos-escape tidak mungkin terjadi. */
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(b.isi, {
                displayMode: b.blok,
                throwOnError: false,
                output: 'html',
                strict: false,
              }),
            }}
          />
        ) : (
          <span key={i}>{b.isi}</span>
        ),
      )}
    </>
  )
}
