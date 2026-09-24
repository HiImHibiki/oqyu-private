/* Tipe untuk diagrams.js — penggambar diagram milik Exact Worksheet Maker.
 *
 * SALINAN, BUKAN TULISAN SENDIRI. Jangan sunting diagrams.js di sini;
 * suntingannya di Exact Worksheet/wsm/diagrams.js, lalu salin ulang dengan
 *
 *     node scripts/salin-diagrams.mjs
 *
 * Skrip itu menyalin berkasnya apa adanya dan menambahkan satu baris
 * `export { renderDiagramTag }` di ekor, karena Vite tidak menerjemahkan
 * `module.exports` pada berkas sumber (hanya pada paket di node_modules).
 * Exact Practice memakai berkas yang sama byte-identik.
 *
 * Dipakai supaya soal kiriman Exact Practice yang memuat tag diagram
 * "[[grafik: …]]", "[[gerak: …]]", dst. tergambar di kartu antrean dan saat
 * ditempel ke kanvas — bukan tampil sebagai teks mentah. Berkasnya murni
 * penghasil string SVG: tanpa DOM, tanpa jaringan.
 */

/** Gambar satu tag diagram. Masukannya ISI tag tanpa kurung siku, mis.
 *  "gerak: titik=0:0,2:10,5:10,8:0". Mengembalikan HTML (SVG atau tabel)
 *  yang sudah dibungkus div. Tag yang tidak dikenal mengembalikan string
 *  kosong; tag yang dikenal tapi parameternya cacat mengembalikan pesan
 *  galat kecil berwarna merah — tidak pernah melempar. */
export function renderDiagramTag(inner: string): string
