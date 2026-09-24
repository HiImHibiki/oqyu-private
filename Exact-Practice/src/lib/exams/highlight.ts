/* Menyisipkan sorotan peserta ke dalam HTML bacaan.
 *
 * Berkas terpisah dan bebas JSX supaya bisa diuji langsung dengan Node —
 * inilah bagian yang paling mudah salah, dan justru itu yang sebelumnya
 * tidak ada satu pun ujinya.
 */

/** Rentang karakter di dalam teks yang TERBACA — bukan di dalam sumber HTML. */
export type Span = { start: number; end: number };

/* Menyisipkan <mark> ke dalam HTML hasil render.
 *
 * Sorotan sengaja dipasang di sini, sebagai string, bukan dengan menyunting
 * DOM setelah React selesai merender. Versi sebelumnya memecah simpul teks
 * lalu menyisipkan <mark> langsung ke dalam pohon yang dikelola React —
 * sorotannya muncul, lalu lenyap pada render berikutnya, karena bagi React
 * bagian itu masih persis seperti terakhir kali ia menuliskannya. Dengan
 * menaruh <mark> di dalam HTML-nya, React yang memiliki sorotan itu, dan tidak
 * ada render yang bisa menghapusnya.
 *
 * Penghitungan dilakukan pada teks yang terbaca: tag dilewati, dan entitas
 * seperti &amp; dihitung sebagai satu karakter — supaya cocok dengan offset
 * yang diukur dari seleksi peserta di layar. */
export function applyHighlights(html: string, spans: Span[]): string {
  if (!spans.length) return html;
  const urut = [...spans].sort((a, b) => a.start - b.start);

  let out = "";
  let teks = 0;            // posisi dalam teks yang terbaca
  let i = 0;               // posisi dalam sumber HTML
  let buka = false;        // sedang di dalam <mark>?

  const batas = (pos: number) => urut.some((s) => s.start === pos) || urut.some((s) => s.end === pos);
  const disorot = (pos: number) => urut.some((s) => s.start <= pos && pos < s.end);

  while (i < html.length) {
    if (html[i] === "<") {
      const tutup = html.indexOf(">", i);
      const tag = html.slice(i, tutup < 0 ? html.length : tutup + 1);
      /* Sorotan tidak boleh melintasi batas tag: tutup sebelum tag, buka lagi
       * sesudahnya. Tanpa ini, <mark> yang membentang melewati </p> akan
       * menghasilkan HTML yang tidak sah dan peramban akan membetulkannya
       * sendiri dengan cara yang tak terduga. */
      if (buka) { out += "</mark>"; buka = false; }
      out += tag;
      i += tag.length;
      continue;
    }

    // satu karakter terbaca: entitas dihitung satu
    let potong = 1;
    if (html[i] === "&") {
      const titik = html.indexOf(";", i);
      if (titik > i && titik - i <= 10) potong = titik - i + 1;
    }

    if (!buka && disorot(teks)) { out += '<mark class="hl-yellow">'; buka = true; }
    else if (buka && !disorot(teks)) { out += "</mark>"; buka = false; }
    void batas;

    out += html.slice(i, i + potong);
    i += potong;
    teks += 1;
  }
  if (buka) out += "</mark>";
  return out;
}
