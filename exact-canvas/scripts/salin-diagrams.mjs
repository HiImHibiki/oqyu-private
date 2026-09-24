/* Salin penggambar diagram dari Exact Worksheet Maker ke Canvas.
 *
 *     node scripts/salin-diagrams.mjs
 *
 * Sumbernya wsm/diagrams.js di repo Exact Worksheet (satu-satunya tempat
 * berkas itu disunting). Exact Practice menyalinnya byte-identik karena
 * bundler-nya paham CommonJS; Vite tidak mengubah berkas sumber CommonJS,
 * jadi salinan di sini diberi satu baris `export` di ekornya supaya bisa
 * di-import sebagai modul ES. Selain baris itu isinya sama persis. */
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const sumber = process.argv[2] ?? join(homedir(), 'Documents/PROJECT EXACT GROUP/Exact Worksheet/wsm/diagrams.js')
const tujuan = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'diagrams.js')
const EKOR = '\n// --- ditambahkan scripts/salin-diagrams.mjs (Exact Canvas) ---\nexport { renderDiagramTag };\n'

const isi = readFileSync(sumber, 'utf8')
if (!/^function renderDiagramTag\(/m.test(isi)) throw new Error('renderDiagramTag tidak ditemukan di ' + sumber)
writeFileSync(tujuan, isi + EKOR)
console.log(`disalin: ${sumber} -> ${tujuan} (${isi.length} byte + ekor export)`)
