// Uji: pertanyaan Sari (foto) → kanvas "Tanya · Sari" dibuat & foto di halaman 1;
// pertanyaan kedua Sari (PDF) → kembali ke kanvas yang sama, halaman berikutnya.
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const B = 'http://127.0.0.1:4747', H = { 'x-exact-pin': '1234', 'x-exact-admin': process.env.ADMIN ?? 'exact2026', 'content-type': 'application/json' }
const j = async (p, init) => { const r = await fetch(B + p, init); const t = await r.text(); return { status: r.status, body: t ? (() => { try { return JSON.parse(t) } catch { return t } })() : null } }
const tidur = (ms) => new Promise((r) => setTimeout(r, ms))
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAAQ0lEQVR42u3PQQkAAAgEsItjCPtjLCv4FQYrsEzXaxEQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQuFoOKBDTXECg5QAAAABJRU5ErkJggg=='
// PDF satu halaman minimal
const pdfSrc = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n160\n%%EOF`
const PDF = 'data:application/pdf;base64,' + Buffer.from(pdfSrc).toString('base64')
const sql = (q, params = []) => j('/api/sql', { method: 'POST', headers: H, body: JSON.stringify({ sql: q, params }) })
await j('/api/kelas/masuk', { method: 'POST', headers: H, body: JSON.stringify({ murid: 'uji_m4', nama: 'Sari', ruang: 2 }) })
const t1 = await j('/api/kelas/tanya', { method: 'POST', headers: H, body: JSON.stringify({ murid: 'uji_m4', nama: 'Sari', ruang: 2, teks: 'foto', foto: PNG }) })
console.log('tanya foto:', t1.status)
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9333', '--window-size=1400,900', '--user-data-dir=/tmp/uji-chrome-' + Date.now(),
  '--user-agent=Mozilla/5.0 (Linux; Android 15; SM-X920) AppleWebKit/537.36 Chrome/128.0 Safari/537.36', 'http://192.168.51.61:4747/?pin=1234'], { stdio: 'ignore' })
let target = null
for (let i = 0; i < 40 && !target; i++) { await tidur(250); try { const l = await (await fetch('http://127.0.0.1:9333/json')).json(); target = l.find((t) => t.type === 'page' && t.url.includes('4747')) } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let seq = 0; const tunggu = new Map(); const log = []
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && tunggu.has(m.id)) { tunggu.get(m.id)(m); tunggu.delete(m.id) }
  if (m.method === 'Runtime.exceptionThrown') log.push('EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text))
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || (m.params.args[0]?.value ?? '').toString().startsWith('[JEJAK]'))) log.push('error ' + m.params.args.map((a) => a.value ?? a.description).join(' ')) }
const cdp = (method, params = {}) => new Promise((r) => { const id = ++seq; tunggu.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
await cdp('Runtime.enable'); await cdp('Page.enable')
const ev = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
// Editor web dijaga kata sandi admin: simpan ke localStorage lalu muat ulang.
await ev(`localStorage.setItem('exact-canvas-admin', ${JSON.stringify(H['x-exact-admin'])}); location.reload(); true`); await tidur(1500)
const klikBukaSari = async () => {
  // Panel bisa sedang terlipat sesudah pertanyaan sebelumnya dibuka: buka dulu.
  await ev(`document.querySelector('.ex-tampilkan')?.click()`); await tidur(300)
  await ev(`(() => { const b = document.querySelector('[aria-label="Class: queue, students, groups"]'); if (b && b.getAttribute('aria-pressed') !== 'true') b.click() })()`); await tidur(700)
  return ev(`(() => { const kartu = [...document.querySelectorAll('.ex-card')].find(c => !c.querySelector('.ex-card') && c.textContent.includes('Sari') && [...c.querySelectorAll('button')].some(b => /Open/.test(b.textContent))); if (!kartu) return false; [...kartu.querySelectorAll('button')].find(b => /Open/.test(b.textContent)).click(); return true })()`)
}
for (let i = 0; i < 40; i++) { if (await ev(`!!document.querySelector('[aria-label="Class: queue, students, groups"]')`)) break; await tidur(250) }
console.log('klik Open (foto):', await klikBukaSari()); await tidur(1500); console.log('petunjuk:', await ev(`document.querySelector('.ex-masuk')?.textContent ?? '(tidak ada)'`))
{ // pantau berkas kanvas Sari tiap 500 ms
  const idS = (await sql("SELECT sketch_id FROM students WHERE id='uji_m4'")).body.rows[0]?.sketch_id
  const jejak = []
  for (let i = 0; i < 14; i++) { const b = await j(`/api/canvas/${idS}`, { headers: H }); jejak.push(b.body?.images?.length ?? 'x'); await tidur(500) }
  console.log('jumlah gambar di berkas tiap 0,5 dtk:', jejak.join(' '))
}
const sketsaAktif = () => ev(`document.querySelector('select[aria-label="Pick a sketch"]')?.selectedOptions[0]?.textContent`)
console.log('sketsa terbuka:', await sketsaAktif(), '| panel tersembunyi:', await ev(`getComputedStyle(document.querySelector('.ex-rel')).display === 'none'`))
const m = (await sql("SELECT sketch_id FROM students WHERE id='uji_m4'")).body.rows[0]
console.log('sketch_id murid:', m?.sketch_id)
let berkas = await j(`/api/canvas/${m.sketch_id}`, { headers: H })
console.log('gambar di kanvas Sari:', berkas.body.images?.length, '| judul:', berkas.body.title)
// pertanyaan kedua: PDF — mundurkan waktu pertanyaan pertama supaya lolos jeda anti-spam 20 dtk.
await sql("UPDATE questions SET created_at = created_at - 30000 WHERE student_id = 'uji_m4'")
const t2 = await j('/api/kelas/tanya', { method: 'POST', headers: H, body: JSON.stringify({ murid: 'uji_m4', nama: 'Sari', ruang: 2, teks: 'pdf', foto: PDF }) })
console.log('tanya pdf:', t2.status, '| berkas pdf mime:', (await fetch(`${B}/api/kelas/foto/${t2.body.id}.pdf?pin=1234&admin=${encodeURIComponent(H['x-exact-admin'])}`)).headers.get('content-type'))
await tidur(800)
console.log('klik Open (pdf):', await klikBukaSari()); await tidur(7000)
berkas = await j(`/api/canvas/${m.sketch_id}`, { headers: H })
console.log('sketsa terbuka:', await sketsaAktif(), '| gambar sekarang:', berkas.body.images?.length, '| halaman:', berkas.body.pages, '| posisi y gambar:', berkas.body.images?.map((g) => Math.round(g.y)).join(','))
// Klik Open lagi pada pertanyaan yang sudah dibahas: kembali ke kanvas, tanpa halaman/gambar baru.
{ const sebelum = { gambar: berkas.body.images?.length, halaman: berkas.body.pages }
  console.log('klik Open ulang (sudah dibahas):', await klikBukaSari()); await tidur(4000)
  const lagi = await j(`/api/canvas/${m.sketch_id}`, { headers: H })
  const sama = lagi.body.images?.length === sebelum.gambar && lagi.body.pages === sebelum.halaman
  console.log(sama ? 'ok  ' : 'FAIL', 'buka ulang tidak menempel duplikat — gambar', lagi.body.images?.length, '| halaman', lagi.body.pages) }
const shot = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(process.env.S + '/kanvas-sari.png', Buffer.from(shot.result.data, 'base64'))
console.log('log:\n  ' + log.join('\n  '))
ws.close(); chrome.kill()
// bersih-bersih
await j(`/api/canvas/${m.sketch_id}`, { method: 'DELETE', headers: H })
await sql('DELETE FROM canvases WHERE id=?', [m.sketch_id]); await sql("DELETE FROM questions WHERE student_id='uji_m4'"); await sql("DELETE FROM students WHERE id='uji_m4'")
process.exit(0)
