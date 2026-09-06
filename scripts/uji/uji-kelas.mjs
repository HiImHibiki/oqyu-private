const B = 'http://127.0.0.1:4747', H = { 'x-exact-pin': '1234', 'content-type': 'application/json' }
const j = async (path, init) => { const r = await fetch(B + path, init); const t = await r.text(); return { status: r.status, body: t ? (() => { try { return JSON.parse(t) } catch { return t } })() : null } }
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8DwHwyBFJgFAE0HBf0hM7bJAAAAAElFTkSuQmCC'
const murid = 'uji_m1'
// 1. HP murid tersambung sebagai pengikut ruangan 2
const ws = new WebSocket(`ws://127.0.0.1:4747/ws?pin=1234&id=hp_uji&name=Dina&role=tv&ruang=2&murid=${murid}`)
const pesan = []
ws.onmessage = (e) => pesan.push(JSON.parse(e.data))
await new Promise((r) => (ws.onopen = r))
console.log('masuk:', (await j('/api/kelas/masuk', { method: 'POST', headers: H, body: JSON.stringify({ murid, nama: 'Dina', ruang: 2 }) })).status)
const tanya = await j('/api/kelas/tanya', { method: 'POST', headers: H, body: JSON.stringify({ murid, nama: 'Dina', ruang: 2, teks: 'Pak, nomor 5 gimana?', foto: PNG }) })
console.log('tanya:', tanya.status, tanya.body)
const saya = await j(`/api/kelas/saya?murid=${murid}`, { headers: H })
console.log('saya:', JSON.stringify(saya.body))
// 2. lampu fokus
ws.send(JSON.stringify({ t: 'fokus', aktif: false, src: 'hp_uji' }))
await new Promise((r) => setTimeout(r, 300))
const klien = pesan.filter((p) => p.t === 'klien').pop()
console.log('klien Dina:', JSON.stringify(klien?.daftar.find((k) => k.murid === murid)))
// 3. guru membahas → HP harus menerima 'bahas'
pesan.length = 0
const ubah = await j('/api/kelas/ubah', { method: 'POST', headers: H, body: JSON.stringify({ id: tanya.body.id, status: 'dibahas' }) })
console.log('ubah:', ubah.status, JSON.stringify(ubah.body))
await new Promise((r) => setTimeout(r, 300))
console.log('HP menerima bahas:', JSON.stringify(pesan.find((p) => p.t === 'bahas')?.tanya ?? null))
console.log('HP menerima data:kelas:', pesan.some((p) => p.t === 'data' && p.kanal === 'kelas'))
const saya2 = await j(`/api/kelas/saya?murid=${murid}`, { headers: H })
console.log('status sekarang:', saya2.body.tanya?.status)
// 4. foto terlayani
const daftar = await j('/api/sql', { method: 'POST', headers: H, body: JSON.stringify({ sql: 'SELECT photo FROM questions WHERE id = ?', params: [tanya.body.id] }) })
const foto = daftar.body.rows[0].photo
const rf = await fetch(`${B}/api/kelas/foto/${foto}?pin=1234`)
console.log('foto:', rf.status, rf.headers.get('content-type'))
// 5. selesai & bersih-bersih data uji
console.log('selesai:', (await j('/api/kelas/ubah', { method: 'POST', headers: H, body: JSON.stringify({ id: tanya.body.id, status: 'selesai' }) })).status)
await j('/api/sql', { method: 'POST', headers: H, body: JSON.stringify({ sql: "DELETE FROM questions WHERE student_id = 'uji_m1'", params: [] }) })
await j('/api/sql', { method: 'POST', headers: H, body: JSON.stringify({ sql: "DELETE FROM students WHERE id = 'uji_m1'", params: [] }) })
console.log('foto uji dihapus:', foto)
ws.close(); process.exit(0)
