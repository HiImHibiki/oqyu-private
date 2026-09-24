// Uji halaman HP lewat Chrome headless: daftar akun dari formulir → pilih
// ruangan → Join → guru memberi izin coret → tombol ✏️ muncul → menggambar
// dengan mouse → goresan tersimpan server ke berkas kanvas murid.
//
//   ADMIN=exact2026 node scripts/uji/uji-hp-akun.mjs
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const B = process.env.S ?? 'http://127.0.0.1:4747'
const ADMIN = process.env.ADMIN ?? 'exact2026'
const PIN = process.env.PIN ?? '1234'
const H = { 'x-exact-admin': ADMIN, 'content-type': 'application/json' }
const HP = `08${Date.now().toString().slice(-9)}`
const tidur = (ms) => new Promise((r) => setTimeout(r, ms))
const j = async (p, init) => {
  const r = await fetch(B + p, init)
  const t = await r.text()
  return { status: r.status, body: t ? (() => { try { return JSON.parse(t) } catch { return t } })() : null }
}
let lulus = 0, gagal = 0
const cek = (nama, ok, info = '') => { ok ? lulus++ : gagal++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${nama}${info ? ' — ' + info : ''}`) }

const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', '--remote-debugging-port=9333', '--window-size=500,900', '--user-data-dir=/tmp/uji-chrome-' + Date.now(),
  '--user-agent=Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36', `${B}/tv?murid=1`], { stdio: 'ignore' })
let target = null
for (let i = 0; i < 40 && !target; i++) { await tidur(250); try { const l = await (await fetch('http://127.0.0.1:9333/json')).json(); target = l.find((t) => t.type === 'page' && t.url.includes('4747')) } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let seq = 0; const tunggu = new Map(); const log = []
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && tunggu.has(m.id)) { tunggu.get(m.id)(m); tunggu.delete(m.id) }
  if (m.method === 'Runtime.exceptionThrown') log.push('EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text))
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') log.push('error ' + m.params.args.map((a) => a.value ?? a.description).join(' ')) }
const cdp = (method, params = {}) => new Promise((r) => { const id = ++seq; tunggu.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
await cdp('Runtime.enable'); await cdp('Page.enable')
const ev = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const sampai = async (expr, n = 40) => { for (let i = 0; i < n; i++) { if (await ev(expr)) return true; await tidur(250) } return false }
const isi = (id, v) => ev(`(() => { const e = document.getElementById('${id}'); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)

try {
  cek('layar akun tampil', await sampai(`document.getElementById('akun')?.classList.contains('tampil')`))
  await ev(`document.getElementById('tab-daftar').click()`)
  cek('tab daftar membuka kolom nama/konfirmasi/kode', await ev(`!document.getElementById('akun-nama').hidden && !document.getElementById('akun-kode').hidden`))
  await isi('akun-nama', 'uji_Chrome'); await isi('akun-hp', HP); await isi('akun-sandi', 'sandi123'); await isi('akun-ulang', 'beda'); await isi('akun-kode', PIN)
  await ev(`document.getElementById('form-akun').requestSubmit()`); await tidur(400)
  cek('konfirmasi beda ditolak di HP', (await ev(`document.getElementById('akun-galat').textContent`)).includes('different'))
  await isi('akun-ulang', 'sandi123'); await isi('akun-kode', '9999')
  await ev(`document.getElementById('form-akun').requestSubmit()`)
  cek('kode kelas salah → pesan galat server', await sampai(`document.getElementById('akun-galat').textContent.includes('class code')`))
  await isi('akun-kode', PIN)
  await ev(`document.getElementById('form-akun').requestSubmit()`)
  cek('daftar sukses → layar menunggu persetujuan', await sampai(`document.getElementById('setuju')?.classList.contains('tampil')`))
  const calon = (await j('/api/akun', { headers: H })).body.find((a) => a.nama === 'uji_Chrome')
  cek('pendaftar tampil untuk guru (belum disetujui)', !!calon && calon.disetujui === false)
  await j('/api/akun/setujui', { method: 'POST', headers: H, body: JSON.stringify({ id: calon.id, setuju: true }) })
  cek('disetujui → layar ruangan (tanpa muat ulang)', await sampai(`document.getElementById('masuk')?.classList.contains('tampil')`, 40))
  cek('sapaan memakai nama akun', (await ev(`document.getElementById('masuk-siapa').textContent`)) === 'Hi, uji_Chrome')
  const sesi = await ev(`localStorage.getItem('exact-canvas-sesi')`)
  cek('sesi tersimpan di HP, PIN tidak', !!sesi && !(await ev(`localStorage.getItem('exact-canvas-pin')`)) && !(await ev('location.search.includes("pin")')))
  await ev(`document.querySelector('#ruangan-masuk input[value="2"]').checked = true`)
  await ev(`document.getElementById('form-masuk').requestSubmit()`)
  cek('Join → bilah murid tampil', await sampai(`document.getElementById('bilah')?.classList.contains('tampil')`))
  cek('tombol ruangan tampil "Room 2"', await sampai(`!document.getElementById('tombol-ruang').hidden && document.getElementById('tombol-ruang').textContent.startsWith('Room 2')`))
  await ev(`document.getElementById('tombol-ruang').click()`)
  cek('ganti ruangan → layar ruangan lagi', await sampai(`document.getElementById('masuk')?.classList.contains('tampil')`))
  await ev(`document.querySelector('#ruangan-masuk input[value="3"]').checked = true; document.getElementById('form-masuk').requestSubmit()`)
  cek('pindah ke ruangan 3', await sampai(`document.getElementById('tombol-ruang').textContent.startsWith('Room 3')`))
  const akun = (await j('/api/akun', { headers: H })).body.find((a) => a.nama === 'uji_Chrome')
  await tidur(400)
  cek('akun tercatat di server & murid masuk kelas dgn id akun, ruangan 3', !!akun && (await j('/api/sql', { method: 'POST', headers: H, body: JSON.stringify({ sql: 'SELECT room FROM students WHERE id = ?', params: [akun.id] }) })).body.rows[0]?.room === 3)
  {
    // Daftar klien dari hub: HP ini harus tercatat di ruangan 3.
    const daftar = await new Promise((res) => {
      const w = new WebSocket(`${B.replace('http', 'ws')}/ws?pin=${PIN}&id=uji_pengintai&name=Intai&role=tv&ruang=1`)
      const t = setTimeout(() => { w.close(); res([]) }, 3000)
      w.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'klien') { clearTimeout(t); w.close(); res(m.daftar) } }
    })
    cek('server memindahkan klien WS ke ruangan 3', daftar.some((k) => k.murid === akun.id && k.ruang === 3), JSON.stringify(daftar.filter((k) => k.murid === akun.id)))
  }
  cek('tombol ✏️ belum tampil', await ev(`document.getElementById('tombol-coret').hidden`))

  // Guru memberi izin.
  const iz = await j('/api/kelas/izin', { method: 'POST', headers: H, body: JSON.stringify({ murid: akun.id, boleh: true }) })
  const sketsa = iz.body?.sketsa
  cek('izin diberikan, kanvas dibuat', iz.status === 200 && typeof sketsa === 'string')
  cek('tombol ✏️ muncul lewat siaran', await sampai(`!document.getElementById('tombol-coret').hidden`))
  await ev(`document.getElementById('tombol-coret').click()`)
  cek('mode coret: alat tampil', await sampai(`document.getElementById('alat-coret').classList.contains('tampil')`))
  await tidur(600)
  // Warna merah, tebal, lalu gambar garis dengan mouse.
  await ev(`document.querySelector('#alat-coret [data-warna="down"]').click(); document.querySelector('#alat-coret [data-ukuran="9"]').click()`)
  const garis = async (x1, y1, x2, y2) => {
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1 })
    for (let i = 1; i <= 12; i++) await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1 + ((x2 - x1) * i) / 12, y: y1 + ((y2 - y1) * i) / 12, button: 'left' })
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1 })
  }
  await garis(120, 300, 320, 420); await tidur(150); await garis(120, 500, 320, 380)
  await tidur(2200)
  const berkas = join(homedir(), 'ExactCanvas', 'canvas', `${sketsa}.json`)
  let d = JSON.parse(readFileSync(berkas, 'utf8'))
  cek('dua goresan tersimpan server ke berkas murid', d.strokes.length === 2 && d.strokes[0].color === 'down' && d.strokes[0].size === 9, `${d.strokes.length} goresan`)
  await ev(`document.getElementById('coret-undo').click()`); await tidur(2000)
  d = JSON.parse(readFileSync(berkas, 'utf8'))
  cek('undo menghapus goresan terakhir di berkas', d.strokes.length === 1)
  await ev(`document.getElementById('coret-selesai').click()`)
  cek('Done menutup alat', !(await ev(`document.getElementById('alat-coret').classList.contains('tampil')`)))

  // Muat ulang: sesi dipakai, langsung ke layar ruangan (tanpa daftar/masuk lagi).
  await cdp('Page.reload'); await tidur(800)
  cek('muat ulang → langsung layar ruangan', await sampai(`document.getElementById('masuk')?.classList.contains('tampil')`))
  await ev(`document.getElementById('masuk-keluar').click()`); await tidur(1200)
  cek('sign out → layar akun lagi', await sampai(`document.getElementById('akun')?.classList.contains('tampil')`))
  cek('tanpa galat JS', log.length === 0, log.slice(0, 3).join(' | '))

  // Bersih-bersih.
  await j(`/api/akun/${akun.id}`, { method: 'DELETE', headers: H })
  await j('/api/sql', { method: 'POST', headers: H, body: JSON.stringify({ sql: 'DELETE FROM students WHERE id = ?', params: [akun.id] }) })
  await j('/api/sql', { method: 'POST', headers: H, body: JSON.stringify({ sql: 'DELETE FROM canvases WHERE id = ?', params: [sketsa] }) })
  await j(`/api/canvas/${sketsa}`, { method: 'DELETE', headers: H })
} finally {
  chrome.kill()
}
console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
