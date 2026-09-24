// Uji akun murid & izin coret. Jalankan saat aplikasi menyala dengan berbagi
// aktif (PIN 1234, sandi admin dari settings). Data uji berawalan `uji_` dan
// dibersihkan di akhir.
//
//   ADMIN=exact2026 node scripts/uji/uji-akun.mjs
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const S = process.env.S ?? 'http://127.0.0.1:4747'
const PIN = process.env.PIN ?? '1234'
const ADMIN = process.env.ADMIN ?? 'exact2026'
const HP = `08${Date.now().toString().slice(-9)}`
let lulus = 0
let gagal = 0
const ok = (nama, kondisi, info = '') => {
  if (kondisi) lulus++
  else gagal++
  console.log(`${kondisi ? '✓' : '✗'} ${nama}${info ? ` — ${info}` : ''}`)
}
const req = async (path, { method = 'GET', json, headers = {} } = {}) => {
  const r = await fetch(S + path, {
    method,
    headers: { ...(json ? { 'content-type': 'application/json' } : {}), ...headers },
    body: json ? JSON.stringify(json) : undefined,
  })
  const teks = await r.text()
  let data = teks
  try {
    data = JSON.parse(teks)
  } catch {
    /* teks biasa */
  }
  return { status: r.status, data }
}
const admin = { 'x-exact-admin': ADMIN }

// ── Daftar ──────────────────────────────────────────────────────────
let r = await req('/api/akun/daftar', { method: 'POST', json: { nama: 'uji_Akun', hp: HP, sandi: 'rahasia1', kode: '0000' } })
ok('daftar dengan kode kelas salah ditolak', r.status === 401, `${r.status}`)
r = await req('/api/akun/daftar', { method: 'POST', json: { nama: 'uji_Akun', hp: HP, sandi: 'ab', kode: PIN } })
ok('sandi terlalu pendek ditolak', r.status === 400)
r = await req('/api/akun/daftar', { method: 'POST', json: { nama: 'uji_Akun', hp: HP, sandi: 'rahasia1', kode: PIN } })
ok('daftar berhasil', r.status === 200 && r.data.token && r.data.id, JSON.stringify(r.data).slice(0, 80))
const akun = r.data
const sesi = { 'x-exact-sesi': akun.token }
r = await req('/api/akun/daftar', { method: 'POST', json: { nama: 'uji_Lagi', hp: HP, sandi: 'rahasia1', kode: PIN } })
ok('nomor HP ganda ditolak', r.status === 409)

// ── Masuk ───────────────────────────────────────────────────────────
r = await req('/api/akun/masuk', { method: 'POST', json: { hp: HP, sandi: 'salah' } })
ok('sandi salah ditolak', r.status === 401)
r = await req('/api/akun/masuk', { method: 'POST', json: { hp: `+62${HP.slice(1)}`, sandi: 'rahasia1' } })
ok('masuk dengan format +62 diterima (nomor dinormalkan)', r.status === 200 && r.data.id === akun.id)
const token2 = r.data.token

// ── Sesi menggantikan PIN ───────────────────────────────────────────
r = await req('/api/vault')
ok('tanpa kredensial ditolak', r.status === 401)
r = await req('/api/vault', { headers: sesi })
ok('sebelum disetujui guru, sesi belum membuka kelas', r.status === 401, `${r.status}`)
r = await req('/api/akun/saya', { headers: sesi })
ok('saya: disetujui = false', r.status === 200 && r.data.disetujui === false)
r = await req('/api/akun', { headers: admin })
ok('guru melihat pendaftar menunggu', r.status === 200 && r.data.some((a) => a.id === akun.id && a.disetujui === false))
r = await req('/api/akun/setujui', { method: 'POST', json: { id: akun.id, setuju: true }, headers: sesi })
ok('murid tidak bisa menyetujui sendiri', r.status === 401)
r = await req('/api/akun/setujui', { method: 'POST', json: { id: akun.id, setuju: true }, headers: admin })
ok('guru menerima pendaftar', r.status === 204)
r = await req('/api/vault', { headers: sesi })
ok('sesi saja (tanpa PIN) membuka kelas', r.status === 200)
r = await req(`/api/vault?sesi=${akun.token}`)
ok('sesi lewat query juga diterima', r.status === 200)
r = await req('/api/akun/saya', { headers: sesi })
ok('saya = akun yang mendaftar', r.status === 200 && r.data.nama === 'uji_Akun' && r.data.hp.startsWith('62'))
r = await req('/api/admin/cek', { headers: admin })
ok('sandi admin saja (tanpa PIN) membuka editor', r.status === 200 || r.status === 204, `${r.status}`)
r = await req('/api/vault', { headers: { 'x-exact-sesi': 'token-palsu-panjang-sekali' } })
ok('sesi palsu ditolak', r.status === 401)
r = await req('/api/akun/keluar', { method: 'POST', headers: { 'x-exact-sesi': token2 } })
r = await req('/api/akun/saya', { headers: { 'x-exact-sesi': token2 } })
ok('sesi yang keluar tidak berlaku lagi', r.status === 401)
r = await req('/api/akun/saya', { headers: sesi })
ok('sesi lain di akun yang sama tetap hidup', r.status === 200)

// ── Masuk kelas dan izin coret ──────────────────────────────────────
r = await req('/api/kelas/masuk', { method: 'POST', json: { murid: akun.id, nama: akun.nama, ruang: 2 }, headers: sesi })
ok('masuk kelas dengan sesi', r.status === 200 || r.status === 204, `${r.status}`)
r = await req(`/api/kelas/saya?murid=${akun.id}`, { headers: sesi })
ok('belum boleh mencoret', r.status === 200 && r.data.boleh === false)
r = await req('/api/kelas/izin', { method: 'POST', json: { murid: akun.id, boleh: true }, headers: sesi })
ok('murid tidak bisa memberi izin sendiri', r.status === 401)
r = await req('/api/kelas/izin', { method: 'POST', json: { murid: akun.id, boleh: true }, headers: admin })
ok('guru memberi izin → kanvas dibuat', r.status === 200 && typeof r.data.sketsa === 'string', JSON.stringify(r.data))
const sketsa = r.data.sketsa
const berkas = join(homedir(), 'ExactCanvas', 'canvas', `${sketsa}.json`)
ok('berkas kanvas murid ada', existsSync(berkas), berkas)
r = await req(`/api/kelas/saya?murid=${akun.id}`, { headers: sesi })
ok('murid melihat izin & kanvasnya', r.data.boleh === true && r.data.sketsa === sketsa)

// ── Goresan lewat WebSocket ─────────────────────────────────────────
const buka = (q) =>
  new Promise((res, rej) => {
    const ws = new WebSocket(`${S.replace('http', 'ws')}/ws?${q}`)
    ws.onopen = () => res(ws)
    ws.onerror = (e) => rej(e)
  })
const pesanDari = (ws, saring, ms = 2500) =>
  new Promise((res) => {
    const t = setTimeout(() => res(null), ms)
    const h = (ev) => {
      const p = JSON.parse(ev.data)
      if (saring(p)) {
        clearTimeout(t)
        ws.removeEventListener('message', h)
        res(p)
      }
    }
    ws.addEventListener('message', h)
  })
const hp = await buka(`sesi=${akun.token}&id=uji_hp&name=uji_Akun&role=tv&ruang=2&murid=${akun.id}`)
const tv = await buka(`pin=${PIN}&id=uji_tv&name=TV&role=tv&ruang=2`)
ok('HP tersambung WS dengan sesi (tanpa PIN)', hp.readyState === 1)
const coretan = (id) => ({ id, tool: 'pen', color: 'ink', size: 5, layer: 0, alpha: 1, pola: 'utuh', points: [[10, 10, 0.5], [50, 60, 0.5], [90, 20, 0.5]] })

// Goresan di kanvas lain harus dibuang.
// Saring pesan milik uji ini saja: murid lain yang sedang aktif juga menyiarkan `ubah`.
const ubahSaya = (p) => p.t === 'ubah' && p.dariMurid === akun.id
let tunggu = pesanDari(tv, ubahSaya)
hp.send(JSON.stringify({ t: 'ubah', src: 'uji_hp', idKanvas: 'cnv_bukan_punyaku', hapus: { coretan: [], objek: [] }, tambah: { coretan: [coretan('uji_c0')], objek: [] } }))
ok('goresan di kanvas lain dibuang', (await tunggu) === null)

tunggu = pesanDari(tv, ubahSaya)
hp.send(JSON.stringify({ t: 'ubah', src: 'uji_hp', idKanvas: sketsa, hapus: { coretan: [], objek: [] }, tambah: { coretan: [coretan('uji_c1')], objek: [] } }))
let p = await tunggu
ok('goresan di kanvas sendiri diteruskan ke TV, bertanda dariMurid', p && p.dariMurid === akun.id && p.tambah.coretan[0].id === 'uji_c1')
tunggu = pesanDari(tv, (p) => p.t === 'titik' && p.id === 'uji_c2')
hp.send(JSON.stringify({ t: 'titik', src: 'uji_hp', idKanvas: sketsa, id: 'uji_c2', dari: 0, titik: [[1, 1, 0.5]], meta: { id: 'uji_c2', tool: 'pen', color: 'ink', size: 5, layer: 0 } }))
ok('titik langsung diteruskan', (await tunggu) !== null)
// Objek/teks dari murid dibuang walau di kanvas sendiri.
tunggu = pesanDari(tv, (p) => ubahSaya(p) && p.tambah?.objek?.length)
hp.send(JSON.stringify({ t: 'ubah', src: 'uji_hp', idKanvas: sketsa, hapus: { coretan: [], objek: [] }, tambah: { coretan: [], objek: [{ id: 'uji_o1' }] } }))
ok('objek dari murid dibuang', (await tunggu) === null)
// Hapus goresan orang lain ditolak, goresan sendiri boleh.
hp.send(JSON.stringify({ t: 'ubah', src: 'uji_hp', idKanvas: sketsa, hapus: { coretan: [], objek: [] }, tambah: { coretan: [coretan('uji_c3')], objek: [] } }))
await new Promise((r) => setTimeout(r, 1800))
let d = JSON.parse(readFileSync(berkas, 'utf8'))
ok('server menyimpan goresan murid ke berkas', d.strokes.some((c) => c.id === 'uji_c1') && d.strokes.some((c) => c.id === 'uji_c3'), `${d.strokes.length} goresan`)
tunggu = pesanDari(tv, (p) => ubahSaya(p) && p.hapus?.coretan?.length)
hp.send(JSON.stringify({ t: 'ubah', src: 'uji_hp', idKanvas: sketsa, hapus: { coretan: ['uji_c1', 'sk_milik_guru'], objek: [] }, tambah: { coretan: [], objek: [] } }))
p = await tunggu
ok('undo hanya menghapus goresan miliknya', p && p.hapus.coretan.length === 1 && p.hapus.coretan[0] === 'uji_c1')
await new Promise((r) => setTimeout(r, 1800))
d = JSON.parse(readFileSync(berkas, 'utf8'))
ok('hapusan tersimpan ke berkas', !d.strokes.some((c) => c.id === 'uji_c1') && d.strokes.some((c) => c.id === 'uji_c3'))
ok('goresan tersimpan bercap id murid', d.strokes.find((c) => c.id === 'uji_c3')?.murid === akun.id)

// Sambung ulang (HP dimuat ulang): goresan lama yang bercap namanya tetap bisa dihapus (penghapus/undo),
// dan hapusan bisa dikembalikan lagi lewat undo.
{
  const hp2 = await buka(`sesi=${akun.token}&id=uji_hp2&name=uji_Akun&role=tv&ruang=2&murid=${akun.id}`)
  await new Promise((r) => setTimeout(r, 300))
  tunggu = pesanDari(tv, (p) => ubahSaya(p) && p.hapus?.coretan?.length)
  hp2.send(JSON.stringify({ t: 'ubah', src: 'uji_hp2', idKanvas: sketsa, hapus: { coretan: ['uji_c3'], objek: [] }, tambah: { coretan: [], objek: [] } }))
  p = await tunggu
  ok('koneksi baru boleh menghapus goresan lamanya sendiri', p && p.hapus.coretan[0] === 'uji_c3')
  tunggu = pesanDari(tv, (p) => ubahSaya(p) && p.tambah?.coretan?.length)
  hp2.send(JSON.stringify({ t: 'ubah', src: 'uji_hp2', idKanvas: sketsa, hapus: { coretan: [], objek: [] }, tambah: { coretan: [coretan('uji_c3')], objek: [] } }))
  p = await tunggu
  ok('undo hapusan: goresan dikembalikan', p && p.tambah.coretan[0].id === 'uji_c3')
  hp2.close()
  await new Promise((r) => setTimeout(r, 1800))
  d = JSON.parse(readFileSync(berkas, 'utf8'))
  ok('goresan yang dikembalikan tersimpan lagi', d.strokes.some((c) => c.id === 'uji_c3'))
}

// Cabut izin: goresan berikutnya dibuang.
tunggu = pesanDari(hp, (p) => p.t === 'izin' && p.murid === akun.id)
r = await req('/api/kelas/izin', { method: 'POST', json: { murid: akun.id, boleh: false }, headers: admin })
p = await tunggu
ok('HP menerima pencabutan izin', p && p.boleh === false)
await new Promise((r) => setTimeout(r, 200))
tunggu = pesanDari(tv, ubahSaya)
hp.send(JSON.stringify({ t: 'ubah', src: 'uji_hp', idKanvas: sketsa, hapus: { coretan: [], objek: [] }, tambah: { coretan: [coretan('uji_c9')], objek: [] } }))
ok('setelah dicabut, goresan dibuang', (await tunggu) === null)

// ── Admin: daftar & reset ──────────────────────────────────────────
r = await req('/api/akun', { headers: admin })
ok('guru melihat daftar akun', r.status === 200 && r.data.some((a) => a.id === akun.id))
r = await req('/api/akun/reset', { method: 'POST', json: { id: akun.id, sandi: 'baru1234' }, headers: admin })
ok('reset sandi', r.status === 204)
r = await req('/api/akun/saya', { headers: sesi })
ok('sesi lama dicabut setelah reset', r.status === 401)
r = await req('/api/akun/masuk', { method: 'POST', json: { hp: HP, sandi: 'baru1234' } })
ok('masuk dengan sandi baru, tetap disetujui', r.status === 200 && r.data.disetujui === true)
// Tolak pendaftar lain: akunnya hilang.
r = await req('/api/akun/daftar', { method: 'POST', json: { nama: 'uji_Tolak', hp: `${HP}1`, sandi: 'rahasia1', kode: PIN } })
const tolak = r.data
r = await req('/api/akun/setujui', { method: 'POST', json: { id: tolak.id, setuju: false }, headers: admin })
ok('guru menolak pendaftar', r.status === 204)
r = await req('/api/akun/saya', { headers: { 'x-exact-sesi': tolak.token } })
ok('akun yang ditolak lenyap', r.status === 401)

// ── Bersih-bersih ──────────────────────────────────────────────────
hp.close()
tv.close()
r = await req(`/api/akun/${akun.id}`, { method: 'DELETE', headers: admin })
ok('hapus akun uji', r.status === 204)
await req('/api/sql', { method: 'POST', json: { sql: 'DELETE FROM students WHERE id = ?', params: [akun.id] }, headers: admin })
await req('/api/sql', { method: 'POST', json: { sql: 'DELETE FROM canvases WHERE id = ?', params: [sketsa] }, headers: admin })
r = await req(`/api/canvas/${sketsa}`, { method: 'DELETE', headers: admin })
ok('hapus kanvas uji', r.status === 200 || r.status === 204, `${r.status}`)

console.log(`\n${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
