/* Tipe untuk diagrams.js — penggambar diagram milik Exact Worksheet Maker.
 *
 * SALINAN, BUKAN TULISAN SENDIRI. diagrams.js di sebelah berkas ini disalin
 * apa adanya (byte-identik) dari:
 *
 *     Exact Worksheet/wsm/diagrams.js
 *
 * Sengaja tidak diubah sedikit pun — termasuk tidak diberi komentar kepala —
 * supaya menyinkronkan ulang cukup dengan menyalin berkasnya lagi:
 *
 *     cp "…/Exact Worksheet/wsm/diagrams.js" src/lib/practice/diagrams.js
 *
 * Kenapa disalin, bukan dipanggil lewat HTTP seperti jembatan lain di
 * worksheet.ts: diagram harus tergambar di peramban murid saat mengerjakan
 * soal. Memanggil Worksheet per soal berarti ruang ujian mati begitu Mac
 * Worksheet mati, dan menambah bolak-balik jaringan di tengah ujian.
 * Berkasnya sendiri murni penghasil string SVG — tanpa DOM, tanpa jaringan —
 * jadi aman dijalankan di mana saja.
 *
 * Yang dideklarasikan di sini hanya yang benar-benar dipakai Practice.
 * diagrams.js mengekspor jauh lebih banyak (lihat module.exports di ujungnya).
 */

/** Gambar satu tag diagram. Masukannya ISI tag tanpa kurung siku, mis.
 *  "grafik: f1=2^x; xmin=-3; xmax=4". Mengembalikan HTML (SVG atau tabel)
 *  yang sudah dibungkus div. Tag yang tidak dikenal mengembalikan string
 *  kosong; tag yang dikenal tapi parameternya cacat mengembalikan pesan
 *  galat kecil berwarna merah — tidak pernah melempar. */
export function renderDiagramTag(inner: string): string;
