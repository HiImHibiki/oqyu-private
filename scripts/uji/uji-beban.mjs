// Simulasi beban: 40 HP murid di 3 ruangan, 4 grup, semua mengantri bersamaan, guru menulis terus.
import { execSync } from 'node:child_process'
import zlib from 'node:zlib'
const B = 'http://127.0.0.1:4747', H = { 'x-exact-pin': '1234', 'content-type': 'application/json' }
const j = async (p, init) => { const t0 = performance.now(); const r = await fetch(B + p, init); const t = await r.text(); return { status: r.status, ms: performance.now() - t0, body: t ? (() => { try { return JSON.parse(t) } catch { return t } })() : null } }
const sql = (q, params = []) => j('/api/sql', { method: 'POST', headers: H, body: JSON.stringify({ sql: q, params }) })
const tidur = (ms) => new Promise((r) => setTimeout(r, ms))
const N = 40, DURASI = 40_000
function pngValid(w, h) { const rows = []; for (let y = 0; y < h; y++) { const b = Buffer.alloc(1 + w * 3); for (let x = 0; x < w; x++) { b[1 + x * 3] = (x * 7 + y) & 255; b[2 + x * 3] = (x ^ y) & 255; b[3 + x * 3] = (y * 3) & 255 } rows.push(b) } const raw = Buffer.concat(rows); const crc = (b) => { let c = -1; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1 } return (c ^ -1) >>> 0 }; const ch = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }; const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ch('IHDR', ihdr), ch('IDAT', zlib.deflateSync(raw, { level: 1 })), ch('IEND', Buffer.alloc(0))]) }
const FOTO = 'data:image/png;base64,' + pngValid(320, 240).toString('base64')
console.log('foto uji', (FOTO.length / 1024).toFixed(0), 'KB')
const pid = execSync('pgrep -f "Exact Canvas.app/Contents/MacOS/exact-canvas" | head -1').toString().trim()
const sampel = []
const pantau = setInterval(() => { try { const [cpu, rss] = execSync(`ps -o %cpu=,rss= -p ${pid}`).toString().trim().split(/\s+/).map(Number); sampel.push({ cpu, rss }) } catch {} }, 1000)
// ── grup
const grup = ['g1', 'g2', 'g3', 'g4'].map((g, i) => ({ id: 'grp_uji_' + g, nama: 'Grup Uji ' + (i + 1) }))
for (const g of grup) await sql('INSERT OR REPLACE INTO groups (id,name,color,target,sort_order) VALUES (?,?,?,NULL,?)', [g.id, g.nama, '#888', Date.now()])
// ── murid
const murid = Array.from({ length: N }, (_, i) => ({ id: `uji_b${String(i + 1).padStart(2, '0')}`, nama: `Murid ${i + 1}`, ruang: (i % 3) + 1, grup: i < 30 ? grup[i % 4].id : null }))
const t0 = performance.now()
await Promise.all(murid.map((m) => j('/api/kelas/masuk', { method: 'POST', headers: H, body: JSON.stringify({ murid: m.id, nama: m.nama, ruang: m.ruang }) })))
for (const m of murid) if (m.grup) await sql('INSERT OR REPLACE INTO group_members (group_id, student_id) VALUES (?,?)', [m.grup, m.id])
console.log(`40 murid masuk & grup: ${(performance.now() - t0).toFixed(0)} ms`)
// ── 40 HP menyambung
const latensi = []; const diterima = new Map(); let bahasDiterima = 0
const klien = await Promise.all(murid.map((m) => new Promise((res) => { const ws = new WebSocket(`ws://127.0.0.1:4747/ws?pin=1234&id=ws_${m.id}&name=${encodeURIComponent(m.nama)}&role=tv&ruang=${m.ruang}&murid=${m.id}`); diterima.set(m.id, 0)
  ws.onmessage = (e) => { const p = JSON.parse(e.data); if (p.ts) { latensi.push(Date.now() - p.ts); diterima.set(m.id, diterima.get(m.id) + 1) } if (p.t === 'bahas') bahasDiterima++ }
  ws.onopen = () => res(ws) })))
console.log('40 HP tersambung')
// ── beban awal: 40 HP memuat sketsa besar (ringan) bersamaan
const besar = (await sql('SELECT id, title FROM canvases ORDER BY updated_at DESC LIMIT 1')).body.rows[0]
const t1 = performance.now()
const muat = await Promise.all(murid.map(() => j(`/api/canvas/${besar.id}/ringan`, { headers: H })))
const gambarUrl = muat[0].body?.images?.map((g) => g.src) ?? []
const t2 = performance.now()
const unduh = await Promise.all(murid.flatMap(() => gambarUrl.slice(0, 5).map((u) => fetch(B + u).then((r) => r.arrayBuffer()))))
console.log(`muat sketsa "${besar.title}" ×40: ${(t2 - t1).toFixed(0)} ms | ${gambarUrl.length} gambar; 40×5 unduhan gambar (${(unduh.reduce((a, b) => a + b.byteLength, 0) / 1e6).toFixed(1)} MB): ${(performance.now() - t2).toFixed(0)} ms`)
// ── guru menulis: 60 paket titik/dtk + kursor 25/dtk + pandangan tiap 2 dtk
const guru = await new Promise((res) => { const ws = new WebSocket('ws://127.0.0.1:4747/ws?pin=1234&id=guru_uji&name=Guru&role=editor&ruang=1'); ws.onopen = () => res(ws) })
let dikirim = 0; let n = 0
const kirim = (p) => { guru.send(JSON.stringify({ ...p, src: 'guru_uji', ts: Date.now() })); dikirim++ }
const tulis = setInterval(() => { const titik = []; for (let i = 0; i < 6; i++, n++) titik.push([200 + (n % 400), 300 + Math.sin(n / 9) * 60, 0.5]); kirim({ t: 'titik', idKanvas: besar.id, id: 'sk_beban', dari: n - 6, titik, meta: { id: 'sk_beban', tool: 'pen', color: 'ink', size: 4, layer: 0 } }) }, 1000 / 60)
const kursor = setInterval(() => kirim({ t: 'kursor', idKanvas: besar.id, x: n % 400, y: 300 }), 40)
const pandang = setInterval(() => kirim({ t: 'pandangan', idKanvas: besar.id, tampilan: { skala: 0.8, x: 40, y: 20 }, layar: { w: 1400, h: 900 } }), 2000)
// ── 40 anak mengantri dalam 3 detik, lalu polling /saya tiap 5 dtk
const tanyaMs = []; const idTanya = []
await Promise.all(murid.map(async (m, i) => { await tidur(Math.random() * 3000); const r = await j('/api/kelas/tanya', { method: 'POST', headers: H, body: JSON.stringify({ murid: m.id, nama: m.nama, ruang: m.ruang, teks: `Soal ${i + 1}`, foto: FOTO }) }); tanyaMs.push(r.ms); idTanya.push(r.body.id) }))
console.log(`40 pertanyaan berfoto: rata ${(tanyaMs.reduce((a, b) => a + b, 0) / N).toFixed(0)} ms, maks ${Math.max(...tanyaMs).toFixed(0)} ms`)
const sayaMs = []
const poll = setInterval(() => murid.forEach((m) => j(`/api/kelas/saya?murid=${m.id}`, { headers: H }).then((r) => sayaMs.push(r.ms))), 5000)
// guru membahas 10 pertanyaan berturut-turut
const bahasMs = []
for (let i = 0; i < 10; i++) { const r = await j('/api/kelas/ubah', { method: 'POST', headers: H, body: JSON.stringify({ id: idTanya[i], status: 'dibahas', editor: 'guru_uji' }) }); bahasMs.push(r.ms); await tidur(400) }
await tidur(DURASI - 12_000)
clearInterval(tulis); clearInterval(kursor); clearInterval(pandang); clearInterval(poll); clearInterval(pantau)
await tidur(800)
// ── laporan
latensi.sort((a, b) => a - b); const pct = (p) => latensi[Math.min(latensi.length - 1, Math.floor(latensi.length * p))]
const hilang = [...diterima.values()].map((v) => dikirim - v)
console.log(`\nguru mengirim ${dikirim} pesan langsung; tiap HP menerima rata ${([...diterima.values()].reduce((a, b) => a + b, 0) / N).toFixed(0)}; pesan hilang per HP: maks ${Math.max(...hilang)}`)
console.log(`latensi hub → HP: p50 ${pct(0.5)} ms, p95 ${pct(0.95)} ms, p99 ${pct(0.99)} ms, maks ${latensi.at(-1)} ms (${latensi.length} pengukuran)`)
console.log(`bahas: ${bahasMs.length} kali, rata ${(bahasMs.reduce((a, b) => a + b, 0) / bahasMs.length).toFixed(0)} ms; kabar 'bahas' sampai ke HP: ${bahasDiterima} kali (murid + anggota grup)`)
console.log(`/saya polling: ${sayaMs.length} permintaan, rata ${(sayaMs.reduce((a, b) => a + b, 0) / Math.max(1, sayaMs.length)).toFixed(0)} ms, maks ${Math.max(0, ...sayaMs).toFixed(0)} ms`)
const cpu = sampel.map((s) => s.cpu), rss = sampel.map((s) => s.rss)
console.log(`Mac — proses Exact Canvas: CPU rata ${(cpu.reduce((a, b) => a + b, 0) / cpu.length).toFixed(1)}%, puncak ${Math.max(...cpu).toFixed(1)}% (dari 100% = 1 inti); memori puncak ${(Math.max(...rss) / 1024).toFixed(0)} MB`)
// ── bersih-bersih
for (const ws of klien) ws.close(); guru.close()
await sql("DELETE FROM questions WHERE student_id LIKE 'uji_b%'"); await sql("DELETE FROM group_members WHERE group_id LIKE 'grp_uji_%'"); await sql("DELETE FROM groups WHERE id LIKE 'grp_uji_%'"); await sql("DELETE FROM students WHERE id LIKE 'uji_b%'")
console.log('data uji dibersihkan')
process.exit(0)
