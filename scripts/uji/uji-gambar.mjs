// Menggambar di editor web lewat DevTools (Input.dispatchMouseEvent) → pengikut menerima goresan langsung, berkas tersimpan.
import { spawn } from 'node:child_process'
const B = 'http://127.0.0.1:4747', H = { 'x-exact-pin': '1234', 'x-exact-admin': process.env.ADMIN ?? 'exact2026', 'content-type': 'application/json' }
const j = async (p, init) => { const r = await fetch(B + p, init); const t = await r.text(); return { status: r.status, body: t ? (() => { try { return JSON.parse(t) } catch { return t } })() : null } }
const sql = (q, params = []) => j('/api/sql', { method: 'POST', headers: H, body: JSON.stringify({ sql: q, params }) })
const tidur = (ms) => new Promise((r) => setTimeout(r, ms))
const idS = 'cnv_ujigambar'; const kini = Date.now()
await j(`/api/canvas/${idS}`, { method: 'PUT', headers: H, body: JSON.stringify({ id: idS, title: 'UJI GAMBAR', strokes: [], images: [], objects: [], texts: [], paper: 'a4', pages: 1, updated_at: kini }) })
await sql('INSERT OR REPLACE INTO canvases (id,title,updated_at) VALUES (?,?,?)', [idS, 'UJI GAMBAR', kini])
const pengikut = new WebSocket('ws://127.0.0.1:4747/ws?pin=1234&id=p_uji&name=TV%20uji&role=tv&ruang=1'); const masuk = []
pengikut.onmessage = (e) => masuk.push(JSON.parse(e.data)); await new Promise((r) => (pengikut.onopen = r))
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9333', '--window-size=1200,800', '--user-data-dir=/tmp/uji-chrome-' + Date.now(), 'http://192.168.51.61:4747/?pin=1234'], { stdio: 'ignore' })
let target = null
for (let i = 0; i < 40 && !target; i++) { await tidur(250); try { const l = await (await fetch('http://127.0.0.1:9333/json')).json(); target = l.find((x) => x.type === 'page' && x.url.includes('4747')) } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let seq = 0; const tunggu = new Map(); const log = []
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && tunggu.has(m.id)) { tunggu.get(m.id)(m); tunggu.delete(m.id) } if (m.method === 'Runtime.exceptionThrown') log.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text) }
const cdp = (method, params = {}) => new Promise((r) => { const id = ++seq; tunggu.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
const ev = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
await cdp('Runtime.enable')
// Editor web dijaga kata sandi admin: simpan ke localStorage lalu muat ulang.
await ev(`localStorage.setItem('exact-canvas-admin', ${JSON.stringify(H['x-exact-admin'])}); location.reload(); true`); await tidur(1500)
for (let i = 0; i < 40; i++) { if ((await ev(`document.querySelector('select[aria-label="Pick a sketch"]')?.selectedOptions[0]?.textContent`)) === 'UJI GAMBAR') break; await tidur(300) }
console.log('sketsa terbuka:', await ev(`document.querySelector('select[aria-label="Pick a sketch"]')?.selectedOptions[0]?.textContent`))
await tidur(1200)
// gambar satu goresan zigzag di tengah halaman
const titik = []; for (let i = 0; i <= 30; i++) titik.push({ x: 500 + i * 6, y: 400 + (i % 2 ? 40 : -40) })
await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: titik[0].x, y: titik[0].y, button: 'left', clickCount: 1 })
for (const p of titik) { await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: 'left', buttons: 1 }); await tidur(12) }
await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: titik.at(-1).x, y: titik.at(-1).y, button: 'left', clickCount: 1 })
await tidur(1800)
const goresan = masuk.filter((p) => p.t === 'goresan' && p.idKanvas === idS)
const titikMsg = masuk.filter((p) => p.t === 'titik' && p.idKanvas === idS)
const selesai = masuk.filter((p) => p.t === 'goresan-selesai' && p.idKanvas === idS)
console.log('pengikut menerima: goresan', goresan.length, '| paket titik', titikMsg.length, '(total titik', titikMsg.reduce((a, p) => a + p.titik.length, 0) + ')', '| selesai', selesai.length)
const berkas = await j(`/api/canvas/${idS}`, { headers: H })
console.log('tersimpan: strokes', berkas.body.strokes.length, '| titik', berkas.body.strokes[0]?.points.length, '| data:canvas ke pengikut:', masuk.some((p) => p.t === 'data' && p.kanal === 'canvas' && p.payload?.id === idS))
console.log('galat konsol:', log.length ? log.join(' | ') : '(bersih)')
ws.close(); chrome.kill(); pengikut.close()
await j(`/api/canvas/${idS}`, { method: 'DELETE', headers: H }); await sql('DELETE FROM canvases WHERE id=?', [idS])
process.exit(0)
