/**
 * Pengenal bentuk untuk "hold to shape".
 *
 * Tahan pena diam sebentar di ujung goresan, dan coretan tangan tadi diganti
 * objek geometri betulan — bukan coretan yang dirapikan, melainkan `Objek`
 * dengan titik kendali, jadi hasilnya masih bisa digeser sudutnya nanti.
 *
 * Aturan mainnya: lebih baik tidak mengenali apa pun daripada salah menebak.
 * Coretan yang gagal dikenali dibiarkan apa adanya, dan tangan yang sedang
 * menulis huruf tidak akan pernah tiba-tiba berubah jadi elips.
 */

import { segmenObjek, type JenisObjek } from './objek'

type Titik = [number, number]
type Batas = { x1: number; y1: number; x2: number; y2: number }

export interface Tebakan {
  jenis: JenisObjek
  titik: Titik[]
  /** Radian; titiknya sendiri selalu lurus, sama seperti di `Objek`. */
  putar?: number
}

/** Berapa lama pena harus diam sebelum bentuk dikunci. */
export const JEDA_TAHAN = 550

/** Gerak di bawah ini (piksel layar) masih dihitung "diam". */
export const AMBANG_DIAM = 2.5

/* ── Alat bantu geometri ───────────────────────────────────────────── */

function jarak(a: Titik, b: Titik): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

function jarakKeRuas(p: Titik, a: Titik, b: Titik): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const panjang = dx * dx + dy * dy
  const t = panjang === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / panjang))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

function kotakDari(t: Titik[]): Batas {
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const [x, y] of t) {
    if (x < x1) x1 = x
    if (y < y1) y1 = y
    if (x > x2) x2 = x
    if (y > y2) y2 = y
  }
  return { x1, y1, x2, y2 }
}

function panjangJalur(t: Titik[]): number {
  let n = 0
  for (let i = 1; i < t.length; i++) n += jarak(t[i - 1], t[i])
  return n
}

/**
 * Sampel ulang jadi jarak yang seragam.
 *
 * Wacom mengirim sampel rapat saat tangan pelan dan renggang saat cepat; tanpa
 * disamakan dulu, sudut yang ditarik perlahan terlihat "lebih penting" bagi
 * penyederhana jalur daripada sudut yang ditarik cepat.
 */
function sampelUlang(t: Titik[], jumlah = 96): Titik[] {
  const total = panjangJalur(t)
  if (total === 0 || t.length < 2) return t.slice()
  const langkah = total / (jumlah - 1)
  const out: Titik[] = [t[0]]
  let sisa = langkah
  for (let i = 1; i < t.length; i++) {
    let a = t[i - 1]
    const b = t[i]
    let d = jarak(a, b)
    while (d >= sisa && out.length < jumlah - 1) {
      const r = sisa / d
      a = [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r]
      out.push(a)
      d -= sisa
      sisa = langkah
    }
    sisa -= d
  }
  out.push(t[t.length - 1])
  return out
}

/** Ramer–Douglas–Peucker: buang titik yang tidak mengubah bentuk. */
function sederhanakan(t: Titik[], eps: number): Titik[] {
  if (t.length < 3) return t.slice()
  let maks = 0
  let idx = 0
  const a = t[0]
  const b = t[t.length - 1]
  for (let i = 1; i < t.length - 1; i++) {
    const d = jarakKeRuas(t[i], a, b)
    if (d > maks) {
      maks = d
      idx = i
    }
  }
  if (maks <= eps) return [a, b]
  const kiri = sederhanakan(t.slice(0, idx + 1), eps)
  const kanan = sederhanakan(t.slice(idx), eps)
  return [...kiri.slice(0, -1), ...kanan]
}

/**
 * Buang simpul yang tidak benar-benar sudut, dengan poligon diperlakukan
 * melingkar.
 *
 * Penyederhana jalur menjangkarkan dirinya di titik awal goresan, dan titik
 * awal itu posisinya sembarang — di mana pun pena kebetulan mendarat. Kalau ia
 * mendarat di tengah sebuah sisi, jangkarnya sendiri terhitung sebagai sudut,
 * dan trapesium pun terbaca bersegi lima. Di sini tiap simpul dinilai terhadap
 * kedua tetangganya, jadi tidak ada titik yang istimewa hanya karena ia yang
 * pertama.
 */
function rapikanSudut(sudut: Titik[], eps: number): Titik[] {
  const t = sudut.slice()
  while (t.length > 3) {
    let indeks = -1
    let paling = Infinity
    for (let i = 0; i < t.length; i++) {
      const a = t[(i - 1 + t.length) % t.length]
      const b = t[(i + 1) % t.length]
      const d = jarakKeRuas(t[i], a, b)
      if (d < paling) {
        paling = d
        indeks = i
      }
    }
    if (paling > eps) break
    t.splice(indeks, 1)
  }
  return t
}

/** Sudut di titik `p`, antara ruas p→a dan p→b, dalam derajat. */
function sudutDi(p: Titik, a: Titik, b: Titik): number {
  const u = [a[0] - p[0], a[1] - p[1]]
  const w = [b[0] - p[0], b[1] - p[1]]
  const nu = Math.hypot(u[0], u[1])
  const nw = Math.hypot(w[0], w[1])
  if (nu === 0 || nw === 0) return 0
  const cos = Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (nu * nw)))
  return (Math.acos(cos) * 180) / Math.PI
}

/** Selisih terkecil sebuah ruas terhadap sumbu mendatar/tegak, dalam derajat. */
function miringDariSumbu(a: Titik, b: Titik): number {
  const sudut = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
  const m = ((sudut % 90) + 90) % 90
  return Math.min(m, 90 - m)
}

/** Luas poligon (rumus tali sepatu), selalu positif. */
function luasPoligon(t: Titik[]): number {
  let s = 0
  for (let i = 0, j = t.length - 1; i < t.length; j = i++) {
    s += t[j][0] * t[i][1] - t[i][0] * t[j][1]
  }
  return Math.abs(s) / 2
}

/**
 * Seberapa jauh goresan menyimpang dari bentuk yang diusulkan, relatif
 * terhadap ukurannya.
 *
 * Tiap penebak punya syaratnya sendiri, tapi syarat itu memeriksa sudut dan
 * panjang sisi — bukan hasil akhirnya. Ukuran ini memeriksa yang sebenarnya
 * ditanya: kalau bentuk usulan digambar, apakah ia lewat di dekat semua titik
 * yang benar-benar ditarik tangan? Satu jaring pengaman untuk semua bentuk,
 * termasuk yang ditambahkan nanti.
 */
function simpanganDari(tebakan: Tebakan, jalur: Titik[], diag: number): number {
  const seg = segmenObjek({
    id: '',
    jenis: tebakan.jenis,
    layer: 0,
    color: '',
    size: 0,
    titik: tebakan.titik,
    putar: tebakan.putar,
  })
  let maks = 0
  for (const p of jalur) {
    let dekat = Infinity
    for (const s of seg) {
      for (let i = 1; i < s.length; i++) {
        const d = jarakKeRuas(p, s[i - 1], s[i])
        if (d < dekat) dekat = d
      }
    }
    if (dekat > maks) maks = dekat
  }
  return maks / diag
}

function putar(p: Titik, poros: Titik, sudut: number): Titik {
  const c = Math.cos(sudut)
  const s = Math.sin(sudut)
  const dx = p[0] - poros[0]
  const dy = p[1] - poros[1]
  return [poros[0] + dx * c - dy * s, poros[1] + dx * s + dy * c]
}

function pusatMassa(t: Titik[]): Titik {
  let x = 0
  let y = 0
  for (const p of t) {
    x += p[0]
    y += p[1]
  }
  return [x / t.length, y / t.length]
}

/**
 * Kemiringan sebuah segi empat, dalam rentang −45°…45°.
 *
 * Keempat sisinya ikut menentukan, ditimbang panjangnya — sisi pendek yang
 * digambar buru-buru tidak boleh menarik seluruh bentuk ikut miring. Sudutnya
 * dikalikan empat sebelum dirata-rata karena kemiringan persegi berulang tiap
 * 90°: sisi 0° dan sisi 90° adalah kemiringan yang sama, dan merata-ratakannya
 * mentah-mentah akan menghasilkan 45° yang tidak dimaksudkan siapa pun.
 */
function sudutSegiEmpat(sudut: Titik[]): number {
  let sx = 0
  let sy = 0
  for (let i = 0; i < 4; i++) {
    const a = sudut[i]
    const b = sudut[(i + 1) % 4]
    const panjang = jarak(a, b)
    const th = Math.atan2(b[1] - a[1], b[0] - a[0]) * 4
    sx += Math.cos(th) * panjang
    sy += Math.sin(th) * panjang
  }
  return Math.atan2(sy, sx) / 4
}

/**
 * Arah memanjang sekumpulan titik (komponen utama).
 *
 * Dipakai menebak kemiringan elips: sumbu panjangnya adalah arah sebaran titik
 * yang paling lebar.
 */
function sumbuUtama(t: Titik[]): number {
  const [cx, cy] = pusatMassa(t)
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const [x, y] of t) {
    const dx = x - cx
    const dy = y - cy
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  return 0.5 * Math.atan2(2 * sxy, sxx - syy)
}

/* ── Uji per bentuk ────────────────────────────────────────────────── */

/**
 * Seberapa dekat titik-titik ini ke elips yang mengisi kotak pembatasnya.
 * Nilai kecil = makin bulat. Persegi hand-drawn mendarat di sekitar 0,15–0,2;
 * lingkaran hand-drawn di bawah 0,08 — celah itu yang dipakai memutuskan.
 */
function simpanganElips(t: Titik[], k: Batas): number {
  const rx = (k.x2 - k.x1) / 2
  const ry = (k.y2 - k.y1) / 2
  if (rx < 1 || ry < 1) return Infinity
  const cx = (k.x1 + k.x2) / 2
  const cy = (k.y1 + k.y2) / 2
  const r = t.map(([x, y]) => Math.hypot((x - cx) / rx, (y - cy) / ry))
  const rata = r.reduce((a, b) => a + b, 0) / r.length
  if (rata < 0.86 || rata > 1.14) return Infinity
  const varian = r.reduce((a, b) => a + (b - rata) ** 2, 0) / r.length
  return Math.sqrt(varian) / rata
}

function sebagaiGaris(t: Titik[]): Tebakan | null {
  const a = t[0]
  const b = t[t.length - 1]
  const rentang = jarak(a, b)
  if (rentang < 1) return null
  let maks = 0
  for (const p of t) maks = Math.max(maks, jarakKeRuas(p, a, b))
  // Garis tangan yang jujur menyimpang < 4% dari talinya. Lebih dari itu
  // biasanya memang kurva yang disengaja.
  if (maks / rentang > 0.04) return null
  // Jalurnya juga tidak boleh jauh lebih panjang dari talinya — coretan
  // bolak-balik di tempat yang sama juga "lurus" menurut ukuran di atas.
  if (panjangJalur(t) / rentang > 1.12) return null
  return { jenis: 'garis', titik: rapikanGaris(a, b) }
}

/**
 * Garis yang hampir mendatar, tegak, atau 45° dibuat tepat begitu.
 *
 * Diputar di sekitar titik tengahnya dengan panjang yang sama, jadi ujung-
 * ujungnya hanya bergeser sepersekian milimeter — cukup untuk terlihat rapi,
 * tidak cukup untuk terasa berpindah. Di luar 4° dari sumbu dibiarkan: garis
 * miring 30° memang dimaksudkan miring.
 */
function rapikanGaris(a: Titik, b: Titik): Titik[] {
  const sudut = Math.atan2(b[1] - a[1], b[0] - a[0])
  const langkah = Math.PI / 4
  const dekat = Math.round(sudut / langkah) * langkah
  if (Math.abs(dekat - sudut) > (4 * Math.PI) / 180) return [a, b]
  const panjang = jarak(a, b)
  const tengah: Titik = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const dx = (Math.cos(dekat) * panjang) / 2
  const dy = (Math.sin(dekat) * panjang) / 2
  return [
    [tengah[0] - dx, tengah[1] - dy],
    [tengah[0] + dx, tengah[1] + dy],
  ]
}

/**
 * Panah yang digambar satu tarikan: batang, lalu satu atau dua sirip di ujung.
 *
 * Ujungnya adalah titik terjauh dari pangkal. Semua yang ditarik sebelum ujung
 * harus lurus; semua yang ditarik sesudahnya harus pendek dan tinggal di dekat
 * ujung — itulah kepala panahnya. Panah yang kepalanya digambar sebagai
 * goresan terpisah tidak dikenali di sini; itu dua goresan, bukan satu.
 */
function sebagaiPanah(t: Titik[]): Tebakan | null {
  const a = t[0]
  let iUjung = 0
  let jauh = 0
  for (let i = 1; i < t.length; i++) {
    const d = jarak(a, t[i])
    if (d > jauh) {
      jauh = d
      iUjung = i
    }
  }
  if (jauh < 1 || iUjung < 4 || iUjung > t.length - 3) return null
  const ujung = t[iUjung]
  const batang = t.slice(0, iUjung + 1)
  let maks = 0
  for (const p of batang) maks = Math.max(maks, jarakKeRuas(p, a, ujung))
  if (maks / jauh > 0.05) return null
  const kepala = t.slice(iUjung)
  const panjangKepala = panjangJalur(kepala)
  if (panjangKepala < jauh * 0.08 || panjangKepala > jauh * 0.9) return null
  for (const p of kepala) if (jarak(p, ujung) > jauh * 0.45) return null
  // Sirip harus benar-benar menyimpang dari batang: goresan yang cuma sedikit
  // mundur di garis yang sama hanyalah garis yang ditarik kelewat.
  const ekor = kepala[kepala.length - 1]
  const sudutSirip = sudutDi(ujung, a, ekor)
  if (sudutSirip < 15 || sudutSirip > 80) return null
  const [p, q] = rapikanGaris(a, ujung)
  return { jenis: 'panah', titik: [p, q] }
}

function sebagaiSegitiga(sudut: Titik[], luasKotak: number): Tebakan | null {
  const keliling = panjangJalur([...sudut, sudut[0]])
  for (let i = 0; i < 3; i++) {
    if (jarak(sudut[i], sudut[(i + 1) % 3]) / keliling < 0.15) return null
  }
  if (luasPoligon(sudut) / luasKotak < 0.28) return null
  return { jenis: 'segitiga', titik: rapikanSegitiga(sudut) }
}

/**
 * Segitiga yang hampir siku-siku dijadikan siku-siku betul.
 *
 * Sisi yang miring kurang dari 6° dari mendatar atau tegak diluruskan dengan
 * menggeser kedua ujungnya ke rata-ratanya. Segitiga siku-siku dengan alas
 * mendatar adalah yang paling sering digambar saat mengajar, dan alas yang
 * miring dua derajat membuat seluruh gambar tampak sembrono.
 */
function rapikanSegitiga(sudut: Titik[]): Titik[] {
  const t = sudut.map((p) => [p[0], p[1]] as Titik)
  const batas = 6
  for (let i = 0; i < 3; i++) {
    const p = t[i]
    const q = t[(i + 1) % 3]
    const deg = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI
    const m = ((deg % 180) + 180) % 180
    if (Math.min(m, 180 - m) < batas) {
      const y = (p[1] + q[1]) / 2
      p[1] = y
      q[1] = y
    } else if (Math.abs(m - 90) < batas) {
      const x = (p[0] + q[0]) / 2
      p[0] = x
      q[0] = x
    }
  }
  return t
}

function sebagaiKotak(sudut: Titik[], k: Batas, luasKotak: number): Tebakan | null {
  for (let i = 0; i < 4; i++) {
    const p = sudut[i]
    const a = sudut[(i + 3) % 4]
    const b = sudut[(i + 1) % 4]
    if (Math.abs(sudutDi(p, a, b) - 90) > 20) return null
    // Objek kotak selalu sejajar sumbu, jadi persegi yang ditarik miring
    // sengaja tidak dikenali — meluruskannya diam-diam akan terasa salah.
    if (miringDariSumbu(p, b) > 15) return null
  }
  if (luasPoligon(sudut) / luasKotak < 0.72) return null
  return {
    jenis: 'kotak',
    titik: [
      [k.x1, k.y1],
      [k.x2, k.y2],
    ],
  }
}

/** Keempat sudut duduk di tengah sisi kotak pembatas — diagonalnya sejajar sumbu. */
function sebagaiBelahKetupat(sudut: Titik[], k: Batas, diag: number): Tebakan | null {
  const mx = (k.x1 + k.x2) / 2
  const my = (k.y1 + k.y2) / 2
  const tengah: Titik[] = [
    [mx, k.y1],
    [k.x2, my],
    [mx, k.y2],
    [k.x1, my],
  ]
  // Longgar sedikit saja dan bujur sangkar yang ditarik miring 30° ikut lolos:
  // keempat sudutnya kebetulan berjarak ~0,095·diagonal dari tengah sisi.
  const tol = diag * 0.06
  const dipakai = new Set<number>()
  for (const t of tengah) {
    const i = sudut.findIndex((p, idx) => !dipakai.has(idx) && jarak(p, t) <= tol)
    if (i === -1) return null
    dipakai.add(i)
  }
  return {
    jenis: 'belahketupat',
    titik: [
      [k.x1, k.y1],
      [k.x2, k.y2],
    ],
  }
}

/**
 * Layang-layang: satu sumbu tegak, dua sayap sejajar mendatar, pinggangnya
 * tidak di tengah. Pinggang yang tepat di tengah berarti belah ketupat, dan
 * itu sudah diuji lebih dulu.
 */
function sebagaiLayang(sudut: Titik[], k: Batas, diag: number): Tebakan | null {
  const mx = (k.x1 + k.x2) / 2
  const tinggi = k.y2 - k.y1
  const tol = diag * 0.1
  const urut = [...sudut].sort((a, b) => a[1] - b[1])
  const atas = urut[0]
  const bawah = urut[3]
  if (Math.abs(atas[0] - mx) > tol || Math.abs(bawah[0] - mx) > tol) return null

  const sayapKiri = urut[1][0] < urut[2][0] ? urut[1] : urut[2]
  const sayapKanan = urut[1][0] < urut[2][0] ? urut[2] : urut[1]
  if (Math.abs(sayapKiri[1] - sayapKanan[1]) > tol) return null
  if (Math.abs(sayapKiri[0] - k.x1) > tol || Math.abs(sayapKanan[0] - k.x2) > tol) return null

  const pinggang = (sayapKiri[1] + sayapKanan[1]) / 2
  if (Math.abs(pinggang - (k.y1 + k.y2) / 2) < tinggi * 0.12) return null
  return {
    jenis: 'layang',
    titik: [
      [mx, k.y1],
      [mx, k.y2],
      [k.x2, pinggang],
    ],
  }
}

/** Tepat satu pasang sisi sejajar, dan panjangnya berbeda. */
function sebagaiTrapesium(sudut: Titik[]): Tebakan | null {
  const arah = (a: Titik, b: Titik) => {
    const s = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
    return ((s % 180) + 180) % 180
  }
  const beda = (p: number, q: number) => {
    const d = Math.abs(p - q) % 180
    return Math.min(d, 180 - d)
  }
  const sisiArah = [0, 1, 2, 3].map((i) => arah(sudut[i], sudut[(i + 1) % 4]))
  const sisiPanjang = [0, 1, 2, 3].map((i) => jarak(sudut[i], sudut[(i + 1) % 4]))

  for (const p of [0, 1]) {
    if (beda(sisiArah[p], sisiArah[p + 2]) > 9) continue
    // Dua pasang yang sejajar itu jajar genjang; bentuknya belum ada di sini.
    if (beda(sisiArah[(p + 1) % 4], sisiArah[(p + 3) % 4]) < 14) continue
    const panjang = Math.max(sisiPanjang[p], sisiPanjang[p + 2])
    const pendek = Math.min(sisiPanjang[p], sisiPanjang[p + 2])
    // Sisi sejajar yang sama panjang berarti jajar genjang juga.
    if (panjang / pendek < 1.18) continue
    const alas = sisiPanjang[p] >= sisiPanjang[p + 2] ? p : p + 2
    return {
      jenis: 'trapesium',
      titik: [sudut[alas], sudut[(alas + 1) % 4], sudut[(alas + 3) % 4]],
    }
  }
  return null
}

/**
 * Persegi yang dicocokkan langsung, tanpa lewat pencarian sudut.
 *
 * Penebak lain menuntut penyederhana jalur menghasilkan tepat empat simpul.
 * Tangan yang menggambar cepat menghasilkan lima atau enam — sisi yang
 * bergelombang terbaca sebagai sudut — dan seluruh rantainya gagal sebelum
 * sempat menguji apa pun. Di sini tidak ada sudut yang dicari sama sekali:
 * kemiringan disapu satu derajat demi satu derajat, dan yang menang adalah
 * yang membuat semua titik paling menempel ke tepi kotaknya.
 *
 * Ukurannya juga yang membedakannya dari lingkaran tanpa syarat tambahan:
 * titik-titik lingkaran menyimpang rata-rata 3,5% dari tepi kotak pembatasnya,
 * sedangkan persegi yang digambar buru-buru pun tinggal sepertiganya.
 */
function sebagaiKotakCocok(t: Titik[], diag: number): Tebakan | null {
  const poros = pusatMassa(t)
  let terbaik: { theta: number; k: Batas } | null = null
  let galatTerbaik = Infinity

  for (let derajat = -45; derajat < 45; derajat += 1) {
    const theta = (derajat * Math.PI) / 180
    const lurus = t.map((p) => putar(p, poros, -theta))
    const k = kotakDari(lurus)
    if (k.x2 - k.x1 < diag * 0.15 || k.y2 - k.y1 < diag * 0.15) continue
    let jumlah = 0
    for (const [x, y] of lurus) {
      jumlah += Math.min(
        Math.abs(x - k.x1),
        Math.abs(x - k.x2),
        Math.abs(y - k.y1),
        Math.abs(y - k.y2),
      )
    }
    const galat = jumlah / lurus.length
    if (galat < galatTerbaik) {
      galatTerbaik = galat
      terbaik = { theta, k }
    }
  }

  if (!terbaik || galatTerbaik > diag * 0.022) return null
  const { theta, k } = terbaik
  return {
    jenis: 'kotak',
    titik: [
      [k.x1, k.y1],
      [k.x2, k.y2],
    ],
    // Hampir lurus dibiarkan lurus: menyimpan miring 0,4° hanya membuat bentuk
    // yang seharusnya rapi terlihat sedikit meleset.
    putar: Math.abs(theta) < 0.035 ? undefined : theta,
  }
}

/**
 * Persegi yang ditarik miring.
 *
 * Bentuknya diluruskan dulu — titik-titiknya diputar balik sebesar kemiringan
 * yang terukur — lalu diuji dengan syarat yang sama seperti persegi tegak. Yang
 * disimpan tetap bentuk lurusnya beserta sudutnya, bukan empat sudut miring:
 * persegi harus tetap persegi kalau nanti diputar lagi.
 */
function sebagaiKotakMiring(sudut: Titik[]): Tebakan | null {
  const theta = sudutSegiEmpat(sudut)
  // Nyaris lurus sudah ditangani penebak sebelumnya; menyimpan sudut sekecil
  // ini hanya membuat bentuk yang seharusnya rapi jadi miring sepersekian derajat.
  if (Math.abs(theta) < 0.035) return null
  const poros = pusatMassa(sudut)
  const lurus = sudut.map((p) => putar(p, poros, -theta))
  const k = kotakDari(lurus)

  for (let i = 0; i < 4; i++) {
    const p = lurus[i]
    const a = lurus[(i + 3) % 4]
    const b = lurus[(i + 1) % 4]
    if (Math.abs(sudutDi(p, a, b) - 90) > 20) return null
    if (miringDariSumbu(p, b) > 9) return null
  }
  // Rasio luasnya dihitung terhadap kotak pembatas bentuk yang *sudah*
  // diluruskan. Membandingkannya dengan kotak pembatas bentuk miring akan
  // selalu meleset: kotak pembatas persegi miring 30° hampir dua kali luas
  // perseginya sendiri, jadi persegi yang sempurna pun akan tertolak.
  const luasLurus = Math.max(1, (k.x2 - k.x1) * (k.y2 - k.y1))
  if (luasPoligon(lurus) / luasLurus < 0.68) return null

  return {
    jenis: 'kotak',
    titik: [
      [k.x1, k.y1],
      [k.x2, k.y2],
    ],
    putar: theta,
  }
}

/**
 * Elips yang sumbunya tidak mendatar.
 *
 * Kemiringannya ditaksir dari arah sebaran titiknya, bukan dicoba satu per satu.
 */
function sebagaiBulatMiring(t: Titik[], diag: number): Tebakan | null {
  const theta = sumbuUtama(t)
  if (Math.abs(theta) < 0.05) return null
  const poros = pusatMassa(t)
  const lurus = t.map((p) => putar(p, poros, -theta))
  const k = kotakDari(lurus)
  if (Math.hypot(k.x2 - k.x1, k.y2 - k.y1) < diag * 0.7) return null
  const tebakan = sebagaiBulat(lurus, k)
  if (!tebakan) return null
  // Lingkaran tidak punya kemiringan yang berarti — memutarnya hanya menambah
  // angka yang tidak mengubah apa pun.
  if (tebakan.jenis === 'lingkaran') return null
  return { ...tebakan, putar: theta }
}

function sebagaiBulat(t: Titik[], k: Batas): Tebakan | null {
  const rx = (k.x2 - k.x1) / 2
  const ry = (k.y2 - k.y1) / 2
  if (rx < 1 || ry < 1) return null
  // Elips yang terlalu gepeng lebih mungkin sebenarnya garis melengkung.
  if (Math.max(rx, ry) / Math.min(rx, ry) > 5) return null
  if (simpanganElips(t, k) > 0.12) return null
  const cx = (k.x1 + k.x2) / 2
  const cy = (k.y1 + k.y2) / 2
  if (Math.abs(rx - ry) / Math.max(rx, ry) <= 0.14) {
    const r = (rx + ry) / 2
    return { jenis: 'lingkaran', titik: [[cx, cy], [cx + r, cy]] }
  }
  return {
    jenis: 'elips',
    titik: [
      [k.x1, k.y1],
      [k.x2, k.y2],
    ],
  }
}

const PANGKAT: Record<number, JenisObjek> = { 2: 'parabola', 3: 'kubik', 4: 'kuartik' }

/**
 * Cocokkan y = v + k·((x − h)/s)ⁿ untuk h dan n yang diberikan.
 *
 * v dan k dicari dengan kuadrat terkecil dari *semua* titik, bukan dipaksa
 * lewat satu titik ujung. Itu bedanya besar untuk pangkat tinggi: ujung
 * kurva pangkat 4 begitu curam sehingga getaran satu piksel di sana menggeser
 * koefisiennya cukup jauh untuk merusak seluruh kurva.
 *
 * Jarak dinormalkan dengan `s` supaya (x − h)⁴ tidak membengkak jadi angka
 * milyaran yang menggerus ketelitian saat dikuadratkan lagi.
 */
function cocokPangkat(
  t: Titik[],
  hx: number,
  pangkat: number,
  s: number,
): { hy: number; k: number; simpangan: number } | null {
  let n = 0
  let su = 0
  let suu = 0
  let sy = 0
  let suy = 0
  for (const [x, y] of t) {
    const u = Math.pow((x - hx) / s, pangkat)
    n++
    su += u
    suu += u * u
    sy += y
    suy += u * y
  }
  const det = n * suu - su * su
  if (n < 8 || Math.abs(det) < 1e-9) return null
  const k = (n * suy - su * sy) / det
  const hy = (sy - k * su) / n

  // Simpangan tegak dibagi kemiringan setempat — mendekati jarak tegak lurus
  // ke kurva. Di bagian yang curam, getaran mendatar satu piksel muncul sebagai
  // selisih tegak sepuluh piksel; tanpa pembagian ini kurva pangkat 4 yang
  // sempit selalu terlihat "meleset jauh" padahal tintanya menempel rapat.
  let maks = 0
  for (const [x, y] of t) {
    const u = (x - hx) / s
    const beda = Math.abs(y - (hy + k * Math.pow(u, pangkat)))
    const miring = (k * pangkat * Math.pow(u, pangkat - 1)) / s
    // Pembagiannya dibatasi: tanpa batas, bagian yang hampir tegak jadi gratis,
    // dan setengah lingkaran — yang ujungnya memang tegak — lolos jadi kurva
    // pangkat yang tidak pernah dimaksudkan.
    const d = beda / Math.min(Math.hypot(1, miring), 4)
    if (d > maks) maks = d
  }
  return { hy, k, simpangan: maks }
}

/**
 * Grafik fungsi pangkat: y = v + k·(x − h)ⁿ dengan n = 2, 3, atau 4.
 *
 * Pangkatnya tidak ditebak dari rupa kurvanya, melainkan dipertandingkan:
 * ketiganya dicocokkan pada tiap calon pusat, dan yang menang adalah yang
 * simpangan tegaknya paling kecil — dengan syarat menangnya meyakinkan. Kalau
 * pangkat 3 dan 4 sama-sama cocok, goresan itu memang belum menentukan yang
 * mana, dan menebak salah satu hanya akan salah separuh waktu.
 */
function sebagaiKurva(jalur: Titik[], k: Batas, diag: number): Tebakan | null {
  const lebar = k.x2 - k.x1
  const tinggi = k.y2 - k.y1
  if (lebar < diag * 0.25 || tinggi < diag * 0.1) return null

  // Harus berupa fungsi: satu nilai y untuk tiap x. Goresan yang berbalik arah
  // mendatar bukan grafik, dan memaksakannya jadi kurva selalu salah.
  const arah = Math.sign(jalur[jalur.length - 1][0] - jalur[0][0])
  if (arah === 0) return null
  let mundur = 0
  for (let i = 1; i < jalur.length; i++) {
    if (Math.sign(jalur[i][0] - jalur[i - 1][0]) === -arah) mundur++
  }
  if (mundur / jalur.length > 0.06) return null
  const t = arah > 0 ? jalur : [...jalur].reverse()
  const skala = lebar / 2

  let terbaik: { jenis: JenisObjek; hx: number; hy: number; k: number; pangkat: number } | null =
    null
  let simpanganTerbaik = Infinity
  let sainganTerbaik = Infinity

  // Pusatnya disapu di 70% bagian tengah: puncak atau titik belok yang jatuh
  // tepat di ujung goresan tidak bisa dipastikan dari data yang ada.
  const LANGKAH = 160
  for (let i = Math.round(LANGKAH * 0.15); i <= Math.round(LANGKAH * 0.85); i++) {
    const hx = k.x1 + (lebar * i) / LANGKAH
    let juara: { pangkat: number; hy: number; k: number; simpangan: number } | null = null
    let sainganDiSini = Infinity
    for (const pangkat of [2, 3, 4]) {
      const f = cocokPangkat(t, hx, pangkat, skala)
      if (!f) continue
      if (!juara || f.simpangan < juara.simpangan) {
        if (juara) sainganDiSini = Math.min(sainganDiSini, juara.simpangan)
        juara = { pangkat, ...f }
      } else {
        sainganDiSini = Math.min(sainganDiSini, f.simpangan)
      }
    }
    if (!juara || juara.simpangan >= simpanganTerbaik) continue
    simpanganTerbaik = juara.simpangan
    sainganTerbaik = sainganDiSini
    terbaik = {
      jenis: PANGKAT[juara.pangkat],
      hx,
      hy: juara.hy,
      k: juara.k,
      pangkat: juara.pangkat,
    }
  }

  if (!terbaik) return null
  if (simpanganTerbaik > diag * 0.04) return null
  // Menang tipis atas pangkat lain berarti goresannya belum menentukan pilihan.
  if (sainganTerbaik < simpanganTerbaik * 1.4) return null

  // Titik kendali kedua diturunkan dari kurva yang sudah dicocokkan, bukan
  // diambil mentah dari goresan — supaya bentuk yang muncul benar-benar kurva
  // yang dihitung, bukan kurva yang lewat satu titik yang kebetulan bergetar.
  const awal = t[0]
  const akhir = t[t.length - 1]
  const xJauh = Math.abs(awal[0] - terbaik.hx) > Math.abs(akhir[0] - terbaik.hx) ? awal[0] : akhir[0]
  const yJauh = terbaik.hy + terbaik.k * Math.pow((xJauh - terbaik.hx) / skala, terbaik.pangkat)
  return { jenis: terbaik.jenis, titik: [[terbaik.hx, terbaik.hy], [xJauh, yJauh]] }
}

/* ── Pintu masuk ───────────────────────────────────────────────────── */

/** Batas simpangan goresan dari bentuk usulan, relatif terhadap ukurannya. */
const SIMPANGAN_MAKS = 0.06

function sahkan(tebakan: Tebakan | null, jalur: Titik[], diag: number): Tebakan | null {
  if (!tebakan) return null
  return simpanganDari(tebakan, jalur, diag) <= SIMPANGAN_MAKS ? tebakan : null
}

/**
 * Pilih bentuk tertutup dari daftar sudut yang sudah disederhanakan.
 *
 * Urutannya dari syarat paling ketat ke paling longgar, dan tiap penebak
 * menolak bentuk milik tetangganya: persegi menuntut sisi sejajar sumbu, belah
 * ketupat menuntut sudut di tengah sisi, layang-layang menuntut pinggang yang
 * bergeser dari tengah, trapesium menuntut tepat satu pasang sisi sejajar.
 */
function tebakTertutup(
  sudut: Titik[],
  halus: Titik[],
  kotak: Batas,
  luasKotak: number,
  diag: number,
): Tebakan | null {
  if (sudut.length === 3) return sebagaiSegitiga(sudut, luasKotak)
  if (sudut.length === 4) {
    // Bentuk tegak diuji lebih dulu. Belah ketupat adalah persegi yang diputar
    // 45°, jadi kalau penebak miring jalan duluan, tiap wajik akan tercatat
    // sebagai persegi miring — benar secara geometri, tapi bukan yang dimaksud
    // orang yang menggambar wajik.
    return (
      sebagaiKotak(sudut, kotak, luasKotak) ??
      sebagaiBelahKetupat(sudut, kotak, diag) ??
      sebagaiLayang(sudut, kotak, diag) ??
      sebagaiKotakMiring(sudut) ??
      sebagaiTrapesium(sudut) ??
      sebagaiBulat(halus, kotak) ??
      sebagaiBulatMiring(halus, diag) ??
      sebagaiKotakCocok(halus, diag)
    )
  }
  // Lebih dari empat simpul biasanya berarti bulat — atau persegi yang
  // sisinya bergelombang, dan itu yang ditangkap pencocok langsung di akhir.
  if (sudut.length >= 5) {
    return (
      sebagaiBulat(halus, kotak) ??
      sebagaiBulatMiring(halus, diag) ??
      sebagaiKotakCocok(halus, diag)
    )
  }
  return sebagaiKotakCocok(halus, diag)
}

/**
 * Tebak bentuk dari titik-titik satu coretan.
 *
 * `minDiag` dalam satuan dunia: pemanggil mengubah ambang piksel layar jadi
 * satuan dunia lewat skala zoom, supaya coretan kecil di layar tetap dianggap
 * kecil walau angka dunianya besar saat sedang di-zoom.
 */
export function kenaliBentuk(
  titik: [number, number, number][] | Titik[],
  minDiag = 24,
): Tebakan | null {
  if (titik.length < 8) return null
  const p: Titik[] = titik.map((t) => [t[0], t[1]])
  const kotak = kotakDari(p)
  const diag = Math.hypot(kotak.x2 - kotak.x1, kotak.y2 - kotak.y1)
  if (diag < minDiag) return null

  const halus = sampelUlang(p)
  const keliling = panjangJalur(halus)
  if (keliling < minDiag) return null

  const celah = jarak(halus[0], halus[halus.length - 1])
  // Tertutup kalau ujungnya bertemu kembali *dan* jalurnya memang berkeliling —
  // goresan lurus pendek juga punya ujung yang berdekatan.
  // Ambangnya longgar: orang jarang menutup persegi tepat di titik mulainya,
  // dan celah selebar sepertiga diagonal masih jelas dimaksudkan tertutup.
  const tertutup = celah < Math.max(diag * 0.38, 12) && keliling > diag * 1.55

  if (!tertutup) {
    // Panah diuji sebelum garis: batangnya sendiri lolos sebagai garis, tapi
    // sirip di ujungnya membuat simpangan garis membengkak, dan urutan
    // sebaliknya hanya akan menolak keduanya.
    const panah = sebagaiPanah(halus)
    if (panah) return panah
    return sahkan(sebagaiGaris(halus) ?? sebagaiKurva(halus, kotak, diag), halus, diag)
  }

  const luasKotak = Math.max(1, (kotak.x2 - kotak.x1) * (kotak.y2 - kotak.y1))

  // Rapatkan ujungnya dulu supaya sudut terakhir tidak terbaca dua kali.
  const tutup = [...halus, halus[0]]

  // Satu tingkat penyederhanaan saja tidak cukup: tangan yang bergetar membuat
  // sisi lurus pecah jadi dua, dan trapesium terbaca bersudut lima. Naikkan
  // ambangnya bertahap dan biarkan `sahkan` yang menolak gabungan yang salah —
  // lebih jujur daripada melonggarkan syarat tiap bentuk satu per satu.
  for (const eps of [0.045, 0.065, 0.09]) {
    const ambang = Math.max(3, diag * eps)
    const sudut = rapikanSudut(sederhanakan(tutup, ambang).slice(0, -1), ambang)
    const sah = sahkan(tebakTertutup(sudut, halus, kotak, luasKotak, diag), halus, diag)
    if (sah) return sah
  }
  return null
}
