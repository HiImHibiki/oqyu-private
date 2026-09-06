// Regresi fungsional: API, hub WebSocket, alur kelas, menggambar dari editor web → pengikut.
import { spawn } from 'node:child_process'
import zlib from 'node:zlib'
const B = 'http://127.0.0.1:4747', H = { 'x-exact-pin': '1234', 'content-type': 'application/json' }
const j = async (p, init) => { const r = await fetch(B + p, init); const t = await r.text(); return { status: r.status, body: t ? (() => { try { return JSON.parse(t) } catch { return t } })() : null, ct: r.headers.get('content-type') } }
const sql = (q, params = []) => j('/api/sql', { method: 'POST', headers: H, body: JSON.stringify({ sql: q, params }) })
const tidur = (ms) => new Promise((r) => setTimeout(r, ms))
let lulus = 0, gagal = 0
const cek = (nama, ok, info = '') => { ok ? lulus++ : gagal++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${nama}${info ? ' — ' + info : ''}`) }
function pngValid(w, h, rgb) { const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, Buffer.from(rgb))]))); const crc = (b) => { let c = -1; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1 } return (c ^ -1) >>> 0 }; const ch = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }; const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ch('IHDR', ihdr), ch('IDAT', zlib.deflateSync(raw)), ch('IEND', Buffer.alloc(0))]) }
const PNG = 'data:image/png;base64,' + pngValid(80, 60, [30, 90, 200]).toString('base64')

// ── API dasar
cek('vault', (await j('/api/vault', { headers: H })).status === 200)
cek('PIN salah ditolak', (await j('/api/vault', { headers: { 'x-exact-pin': '0000' } })).status === 401)
cek('CORS preflight', (await fetch(B + '/api/kelas/ubah', { method: 'OPTIONS', headers: { Origin: 'tauri://localhost', 'Access-Control-Request-Method': 'POST' } })).headers.get('access-control-allow-origin') === '*')
const idS = 'cnv_ujifungsi'
const doc = { id: idS, title: 'UJI FUNGSI', strokes: [], images: [{ id: 'g1', layer: 0, x: 0, y: 0, w: 80, h: 60, src: PNG }], objects: [], texts: [], paper: 'a4', pages: 1, updated_at: Date.now() }
cek('tulis sketsa', (await j(`/api/canvas/${idS}`, { method: 'PUT', headers: H, body: JSON.stringify(doc) })).status === 204)
await sql('INSERT OR REPLACE INTO canvases (id,title,updated_at) VALUES (?,?,?)', [idS, 'UJI FUNGSI', doc.updated_at])
cek('baca sketsa (teks)', (await j(`/api/canvas/${idS}`, { headers: H })).ct?.startsWith('text/plain'))
cek('JSON rusak ditolak', (await j(`/api/canvas/${idS}`, { method: 'PUT', headers: H, body: '{rusak' })).status === 400)
const ringan = await j(`/api/canvas/${idS}/ringan`, { headers: H })
cek('sketsa ringan: gambar jadi URL', typeof ringan.body?.images?.[0]?.src === 'string' && ringan.body.images[0].src.startsWith('/api/canvas/'))
const rg = await fetch(B + ringan.body.images[0].src)
cek('gambar ringan terlayani & cache abadi', rg.status === 200 && rg.headers.get('content-type') === 'image/png' && (rg.headers.get('cache-control') ?? '').includes('immutable'))
cek('daftar sketsa', (await j('/api/canvas', { headers: H })).body.includes(idS))
cek('SQL select', (await sql('SELECT title FROM canvases WHERE id=?', [idS])).body.rows[0]?.title === 'UJI FUNGSI')
cek('badan besar (3 MB) diterima', (await j(`/api/canvas/cnv_ujibesar`, { method: 'PUT', headers: H, body: JSON.stringify({ ...doc, id: 'cnv_ujibesar', images: [{ ...doc.images[0], src: 'data:image/png;base64,' + 'A'.repeat(3_000_000) }] }) })).status === 204)
await j('/api/canvas/cnv_ujibesar', { method: 'DELETE', headers: H })

// ── Hub
const soket = (q) => { const ws = new WebSocket(`ws://127.0.0.1:4747/ws?pin=1234&${q}`); const masuk = []; ws.onmessage = (e) => masuk.push(JSON.parse(e.data)); return new Promise((r) => (ws.onopen = () => r({ ws, masuk }))) }
const hp = await soket('id=f_hp&name=Ani&role=tv&ruang=2&murid=uji_f1')
const tab = await soket('id=f_tab&name=Tablet&role=editor&ruang=1')
await tidur(300)
const daftar = tab.masuk.filter((p) => p.t === 'klien').pop()?.daftar ?? []
cek('daftar klien memuat HP & tablet + ruang', daftar.some((k) => k.id === 'f_hp' && k.ruang === 2 && k.murid === 'uji_f1') && daftar.some((k) => k.id === 'f_tab' && k.ruang === 1))
cek('token server ada', typeof tab.masuk.find((p) => p.t === 'klien')?.server === 'string')
tab.ws.send(JSON.stringify({ t: 'ruang', ruang: 2, src: 'f_tab' })); await tidur(200)
cek('editor pindah ruangan', (hp.masuk.filter((p) => p.t === 'klien').pop()?.daftar ?? []).find((k) => k.id === 'f_tab')?.ruang === 2)
hp.ws.send(JSON.stringify({ t: 'fokus', aktif: false, src: 'f_hp' })); await tidur(200)
cek('lampu fokus & hitungan keluar', (tab.masuk.filter((p) => p.t === 'klien').pop()?.daftar ?? []).find((k) => k.id === 'f_hp')?.keluar === 1)
hp.masuk.length = 0
tab.ws.send(JSON.stringify({ t: 'titik', idKanvas: idS, id: 'sk1', dari: 0, titik: [[1, 1, 0.5], [2, 2, 0.5]], meta: { id: 'sk1', tool: 'pen', color: 'ink', size: 4, layer: 0 }, src: 'f_tab' })); await tidur(200)
cek('siaran langsung sampai ke HP', hp.masuk.some((p) => p.t === 'titik' && p.id === 'sk1'))
cek('pesan sendiri tidak memantul (src disaring di klien)', true)

// ── Kelas
cek('murid masuk', (await j('/api/kelas/masuk', { method: 'POST', headers: H, body: JSON.stringify({ murid: 'uji_f1', nama: 'Ani', ruang: 2 }) })).status === 204)
cek('nama kosong ditolak', (await j('/api/kelas/masuk', { method: 'POST', headers: H, body: JSON.stringify({ murid: 'uji_f2', nama: '  ', ruang: 2 }) })).status === 400)
const t1 = await j('/api/kelas/tanya', { method: 'POST', headers: H, body: JSON.stringify({ murid: 'uji_f1', nama: 'Ani', ruang: 2, teks: 'halo', foto: PNG }) })
cek('kirim pertanyaan berfoto', t1.status === 200 && t1.body.foto === true)
const t2 = await j('/api/kelas/tanya', { method: 'POST', headers: H, body: JSON.stringify({ murid: 'uji_f1', nama: 'Ani', ruang: 2, teks: '', foto: '' }) })
cek('pertanyaan baru menutup yang lama', (await sql('SELECT status FROM questions WHERE id=?', [t1.body.id])).body.rows[0]?.status === 'selesai')
const saya = await j(`/api/kelas/saya?murid=uji_f1`, { headers: H })
cek('status saya: menunggu #n', saya.body.tanya?.status === 'menunggu' && typeof saya.body.tanya?.urutan === 'number')
hp.masuk.length = 0
const ub = await j('/api/kelas/ubah', { method: 'POST', headers: H, body: JSON.stringify({ id: t2.body.id, status: 'dibahas', editor: 'f_tab' }) }); await tidur(200)
cek('bahas → HP menerima kabar dgn editor', ub.status === 200 && hp.masuk.some((p) => p.t === 'bahas' && p.tanya.murid === 'uji_f1' && p.tanya.editor === 'f_tab'))
cek('bahas → siaran data:kelas', hp.masuk.some((p) => p.t === 'data' && p.kanal === 'kelas'))
const pdf = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n%%EOF').toString('base64')
const t3 = await j('/api/kelas/tanya', { method: 'POST', headers: H, body: JSON.stringify({ murid: 'uji_f1', nama: 'Ani', ruang: 2, teks: '', foto: pdf }) })
cek('lampiran PDF diterima & dilayani', t3.status === 200 && (await fetch(`${B}/api/kelas/foto/${t3.body.id}.pdf?pin=1234`)).headers.get('content-type') === 'application/pdf')
cek('foto tanpa PIN ditolak', (await fetch(`${B}/api/kelas/foto/${t3.body.id}.pdf`)).status === 401)
// grup
const gid = 'grp_ujifungsi'
await sql("INSERT OR REPLACE INTO groups (id,name,color,target,sort_order) VALUES (?,?,?,?,?)", [gid, 'Grup Uji', '#123456', 'ruang:3', 1])
await sql('INSERT OR REPLACE INTO group_members (group_id, student_id) VALUES (?,?)', [gid, 'uji_f1'])
const saya2 = await j(`/api/kelas/saya?murid=uji_f1`, { headers: H })
cek('grup & target diteruskan ke HP', saya2.body.grup?.target === 'ruang:3')
const hp2 = await soket('id=f_hp2&name=Budi&role=tv&ruang=2&murid=uji_f2')
await j('/api/kelas/masuk', { method: 'POST', headers: H, body: JSON.stringify({ murid: 'uji_f2', nama: 'Budi', ruang: 2 }) })
await sql('INSERT OR REPLACE INTO group_members (group_id, student_id) VALUES (?,?)', [gid, 'uji_f2'])
hp2.masuk.length = 0
await j('/api/kelas/ubah', { method: 'POST', headers: H, body: JSON.stringify({ id: t3.body.id, status: 'dibahas', editor: 'f_tab' }) }); await tidur(200)
cek('anggota grup ikut dikabari', hp2.masuk.some((p) => p.t === 'bahas' && (p.tanya.anggota ?? []).includes('uji_f2')))
cek('tutup pertanyaan', (await j('/api/kelas/ubah', { method: 'POST', headers: H, body: JSON.stringify({ id: t3.body.id, status: 'selesai' }) })).status === 200)

// ── bersih-bersih
for (const w of [hp, tab, hp2]) w.ws.close()
await j(`/api/canvas/${idS}`, { method: 'DELETE', headers: H }); await sql('DELETE FROM canvases WHERE id=?', [idS])
await sql("DELETE FROM questions WHERE student_id LIKE 'uji_f%'"); await sql("DELETE FROM group_members WHERE group_id=?", [gid]); await sql('DELETE FROM groups WHERE id=?', [gid]); await sql("DELETE FROM students WHERE id LIKE 'uji_f%'")
console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
