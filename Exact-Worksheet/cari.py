#!/usr/bin/env python3
"""Mesin pencari lokal untuk arsip EXACT COURSE."""
import os, re, sqlite3, json, html, urllib.parse, mimetypes, subprocess
import lokasi
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

DB   = lokasi.data('exact.db')
AKAR = os.path.expanduser('~/Documents/EXACT COURSE')
PORT = 7790

def db():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row; return c

KOLOM_SOAL_BARU = (('kunci', 'TEXT'), ('bobot', 'INT'), ('jenis_soal', 'TEXT'),
                   ('pembahasan', 'TEXT'), ('bacaan', 'TEXT'))

def pastikan_kolom():
    """Kolom tabel soal yang ditambahkan belakangan (basis lama dibuat panen.py
    hanya dengan kolom hasil panen PDF).

    Dijalankan sekali saat server mulai. Tanpa ini, INSERT bank soal di
    lembar_dari_naskah() gagal diam-diam (tertangkap except) dan tab Susun
    Ulang gagal membaca s.jenis_soal — itulah yang terjadi di Mac yang basis
    datanya dibuat sebelum kolom-kolom ini ada. bacaan: teks bacaan lembar
    Bahasa Indonesia/Inggris, JSON {judul, isi}.
    """
    try:
        c = sqlite3.connect(DB)
        ada = {r[1] for r in c.execute('PRAGMA table_info(soal)')}
        if not ada:
            c.close(); return
        for kol, tipe in KOLOM_SOAL_BARU:
            if kol not in ada:
                c.execute(f'ALTER TABLE soal ADD COLUMN {kol} {tipe}')
                print(f'bank soal: kolom {kol} ditambahkan', flush=True)
        c.commit(); c.close()
    except sqlite3.Error as e:
        print(f'bank soal: kolom tidak bisa dipastikan ({e})', flush=True)

def _bacaan_baris(r):
    """{judul, isi} dari kolom bacaan (JSON) sebuah baris soal, atau None."""
    try:
        if 'bacaan' in r.keys() and r['bacaan']:
            b = json.loads(r['bacaan'])
            if isinstance(b, dict) and (b.get('isi') or '').strip(): return b
    except (ValueError, TypeError): pass
    return None

def bersih(q):
    q = re.sub(r'[^\w\s"*-]', ' ', q, flags=re.UNICODE).strip()
    if not q: return None
    if '"' in q: return q
    return ' '.join(f'{t}*' if len(t) > 3 and not t.endswith('*') else t for t in q.split())

def cari(q, filt, limit=60):
    m = bersih(q)
    if not m: return [], 0
    w, p = ['d.dup_dari IS NULL'], [m]
    for k in ('folder','jenjang','mapel','jenis','kelas','sekolah'):
        if filt.get(k): w.append(f'd.{k}=?'); p.append(filt[k])
    klausa = ' AND ' + ' AND '.join(w)
    c = db()
    n = c.execute(f"""SELECT COUNT(*) FROM halaman h JOIN dokumen d ON d.id=h.dok_id
                      WHERE halaman MATCH ?{klausa}""", p).fetchone()[0]
    rows = c.execute(f"""
        SELECT d.id, d.nama, d.rel, d.folder, d.jenjang, d.mapel, d.jenis, d.tahun,
               d.kelas, d.sekolah, d.asal_label,
               h.no_hal, snippet(halaman,0,'<mark>','</mark>','…',28) AS cuplik
        FROM halaman h JOIN dokumen d ON d.id=h.dok_id
        WHERE halaman MATCH ?{klausa} ORDER BY rank LIMIT {limit}""", p).fetchall()
    c.close(); return rows, n

def cari_soal(q, filt, limit=50):
    m = bersih(q)
    if not m: return [], 0
    w, p = ['s.dup=0'], [m]
    for k in ('jenjang','mapel','jenis','kelas','sekolah'):
        if filt.get(k): w.append(f'd.{k}=?'); p.append(filt[k])
    if filt.get('bentuk') == 'Pilihan ganda': w.append('s.mutu=2')
    elif filt.get('bentuk') == 'Uraian': w.append('s.mutu=1')
    if filt.get('folder'): w.append('d.folder=?'); p.append(filt['folder'])
    klausa = ' AND ' + ' AND '.join(w)
    c = db()
    n = c.execute(f"""SELECT COUNT(*) FROM soal_fts f JOIN soal s ON s.id=f.soal_id
                      JOIN dokumen d ON d.id=s.dok_id WHERE soal_fts MATCH ?{klausa}""", p).fetchone()[0]
    rows = c.execute(f"""SELECT s.id, s.batang, s.opsi, s.n_opsi, s.no_hal, s.no_soal, s.mutu,
                                d.id AS dok, d.nama, d.mapel, d.kelas, d.jenjang, d.jenis, d.tahun, d.sekolah
                         FROM soal_fts f JOIN soal s ON s.id=f.soal_id JOIN dokumen d ON d.id=s.dok_id
                         WHERE soal_fts MATCH ?{klausa} ORDER BY rank LIMIT {limit}""", p).fetchall()
    c.close(); return rows, n

def opsi(kolom):
    c = db()
    r = [x[0] for x in c.execute(f"SELECT {kolom} FROM dokumen WHERE {kolom} IS NOT NULL AND dup_dari IS NULL AND n_hal_teks>0 GROUP BY {kolom} ORDER BY COUNT(*) DESC LIMIT 25")]
    c.close(); return r

HAL = """<!doctype html><meta charset=utf-8><title>Cari Arsip Exact</title>
<meta name=viewport content="width=device-width,initial-scale=1">
<style>
:root{--bg:#fbfbfa;--kartu:#fff;--tepi:#e3e3e0;--teks:#1a1a19;--redup:#6b6b66;--aksen:#c4572a}
@media(prefers-color-scheme:dark){:root{--bg:#1a1a19;--kartu:#232322;--tepi:#37372f;--teks:#f0efea;--redup:#9a9a92}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--teks);
font:15px/1.55 ui-sans-serif,-apple-system,"Segoe UI",sans-serif}
.bungkus{max-width:1020px;margin:0 auto;padding:28px 18px 60px}
h1{font-size:20px;margin:0 0 4px}.sub{color:var(--redup);font-size:13px;margin-bottom:18px}
form{position:sticky;top:0;background:var(--bg);padding:10px 0 12px;z-index:5}
.baris{display:flex;gap:8px;flex-wrap:wrap}
input[type=search]{flex:1;min-width:240px;padding:11px 14px;font-size:15px;border:1px solid var(--tepi);
border-radius:9px;background:var(--kartu);color:var(--teks)}
select{padding:9px 10px;border:1px solid var(--tepi);border-radius:9px;background:var(--kartu);color:var(--teks);font-size:13px}
button{padding:11px 20px;border:0;border-radius:9px;background:var(--aksen);color:#fff;font-size:14px;font-weight:600;cursor:pointer}
.jml{color:var(--redup);font-size:13px;margin:14px 0 10px}
.h{background:var(--kartu);border:1px solid var(--tepi);border-radius:11px;padding:13px 15px;margin-bottom:9px}
.h a.jdl{color:var(--teks);font-weight:600;text-decoration:none;font-size:14.5px}
.h a.jdl:hover{color:var(--aksen)}
.meta{color:var(--redup);font-size:12px;margin:3px 0 7px;display:flex;gap:7px;flex-wrap:wrap}
.tag{background:var(--bg);border:1px solid var(--tepi);border-radius:5px;padding:1px 7px;margin-right:5px}
.duga{color:var(--aksen);font-weight:700;margin-left:3px;cursor:help}
.cuplik{font-size:13.5px;color:var(--redup);white-space:pre-wrap;word-break:break-word}
mark{background:#ffe08a;color:#1a1a19;border-radius:3px;padding:0 2px}
@media(prefers-color-scheme:dark){mark{background:#7a5c12;color:#fff}}
.kosong{color:var(--redup);padding:40px 0;text-align:center}
.tab{display:flex;gap:6px;margin-bottom:10px}
.tab a{padding:6px 14px;border:1px solid var(--tepi);border-radius:8px;text-decoration:none;
color:var(--redup);font-size:13px;background:var(--kartu)}
.tab a.aktif{background:var(--aksen);color:#fff;border-color:var(--aksen);font-weight:600}
.batang{white-space:pre-wrap;font-size:14px;margin-bottom:8px}
.opsi{font-size:13.5px;color:var(--redup);padding-left:10px}
.meta a{color:var(--redup)}
.pilih{float:right;font-size:12px;color:var(--redup);cursor:pointer;user-select:none}
.oto{background:var(--kartu);border:1px solid var(--tepi);border-radius:11px;
padding:12px 14px;margin-bottom:13px;font-size:13px;color:var(--redup)}
.oto b{color:var(--teks)}
.oto .r2{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
.oto input{padding:8px 11px;border:1px solid var(--tepi);border-radius:7px;
background:var(--bg);color:var(--teks);font-size:13px}
.oto input[name=topik]{flex:1;min-width:150px}
.oto button{padding:8px 16px;border:0;border-radius:7px;background:var(--aksen);
color:#fff;font-weight:600;font-size:13px;cursor:pointer}
.aksi{position:sticky;bottom:0;background:var(--kartu);border:1px solid var(--tepi);
border-radius:11px;padding:10px 13px;margin-top:14px;display:flex;gap:9px;align-items:center;flex-wrap:wrap}
.aksi input[name=judul]{flex:1;min-width:180px;padding:7px 10px;border:1px solid var(--tepi);
border-radius:7px;background:var(--bg);color:var(--teks);font-size:13px}
.aksi button{padding:8px 18px;border:0;border-radius:7px;background:var(--aksen);color:#fff;
font-weight:600;font-size:13px;cursor:pointer}
.aksi label,.aksi span{font-size:12.5px;color:var(--redup)}
</style>
<div class=bungkus>
<h1>Arsip Exact Course</h1>__TAB__
<div class=sub>__RINGKAS__</div>
<form action="/cari"><div class=baris>
<input type=search name=q placeholder="cari apa saja — mis. listrik dinamis, trigonometri, photosynthesis" value="__Q__" autofocus>
<button>Cari</button></div>
<div class=baris style="margin-top:8px">__FILTER__</div></form>
__HASIL__
</div>"""

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); qs = urllib.parse.parse_qs(u.query)
        if u.path == '/rangkum':
            import buat
            b = buat.halaman_rangkum((qs.get('titip') or [''])[0]).encode()
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/jawab':
            import buat
            b = buat.halaman_jawab((qs.get('titip') or [''])[0]).encode()
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/buat':
            import buat
            b = buat.halaman(titip=(qs.get('titip') or [''])[0]).encode()
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/manual':
            import buat
            b = buat.halaman_manual().encode()
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/api/perintah':
            # Perintah siap salin untuk AI mana pun. Dibangun dari format Exact
            # Worksheet Maker yang sama dengan jalur otomatis, jadi naskah yang
            # kembali pasti bisa dirender mesin yang sama.
            import buat
            g = lambda k: (qs.get(k) or [''])[0]
            try:
                teks = buat.perintah_manual(
                    mapel=g('mapel'), topik=g('topik'), jenjang=g('jenjang'),
                    jumlah=g('jumlah'), n_set=g('n_set'), sulit=g('sulit'),
                    bahasa=g('bahasa') or 'Indonesia', instruksi=g('instruksi'),
                    acuan=g('acuan'), jenis=g('jenis') or 'soal',
                    kelas=g('kelas'), bagian=g('bagian'))
                d = {'perintah': teks, 'panjang': len(teks)}
            except Exception as e:
                d = {'galat': f'{type(e).__name__}: {e}'}
            b = json.dumps(d, ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/diag':
            # Hanya dari Mac ini: isinya membocorkan daftar berkas Desktop.
            if self.client_address[0] not in ('127.0.0.1', '::1'):
                return self.send_error(403)
            import hasil as _h, glob as _g
            f = _h.folder_keluar()
            try: isi = os.listdir(f)
            except Exception as e: isi = [f'GALAT: {e}']
            try:
                n_daftar = _h.daftar_pdf()[1]
                galat_daftar = None
            except Exception as e:
                n_daftar, galat_daftar = -1, f'{type(e).__name__}: {e}'
            d = {'daftar_pdf': n_daftar, 'galat_daftar': galat_daftar,
                 'folder': f, 'ada': os.path.isdir(f),
                 'HOME': os.environ.get('HOME'),
                 'jumlah_item': len(isi), 'pdf_glob': len(_g.glob(os.path.join(f, '*.pdf'))),
                 'contoh': isi[:5]}
            b = json.dumps(d, ensure_ascii=False).encode()
            self.send_response(200); self.send_header('Content-Type','application/json')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/hasil':
            import hasil as _h
            f = (qs.get('f') or [''])[0]
            isi = (_h.halaman_berkas(f) if f
                   else _h.halaman_daftar(
                       (qs.get('cari') or [''])[0],
                       max(6, min(400, int((qs.get('jumlah') or ['24'])[0] or 24)))))
            if isi is None: return self.send_error(404, 'berkas tidak ada')
            b = isi.encode()
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/lembar-jawab':
            import buat as _b
            k = (qs.get('k') or [''])[0]
            h = _b.HALAMAN_JAWAB.get(k)
            if not h: return self.send_error(404)
            b = h.encode()
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/titipan':
            import titipan
            kode = (qs.get('k') or [''])[0]
            urut = int((qs.get('n') or ['0'])[0] or 0)
            b = titipan.berkas_ke(kode, urut)
            if not b: return self.send_error(404)
            nama, isi = b
            tipe = mimetypes.guess_type(nama)[0] or 'application/octet-stream'
            self.send_response(200); self.send_header('Content-Type', tipe)
            self.send_header('Content-Disposition', f'inline; filename="{nama}"')
            self.send_header('Content-Length', str(len(isi))); self.end_headers()
            self.wfile.write(isi); return

        if u.path == '/apk':
            # Unduh aplikasi Android dari tablet: buka http://<alamat>:7790/apk
            fp = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                              'android', 'ExactWorksheet.apk')
            if not os.path.isfile(fp):
                return self.send_error(404, 'APK belum dibangun (android/bangun.sh)')
            d = open(fp, 'rb').read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/vnd.android.package-archive')
            self.send_header('Content-Disposition', 'attachment; filename="ExactWorksheet.apk"')
            self.send_header('Content-Length', str(len(d))); self.end_headers()
            self.wfile.write(d); return

        if u.path == '/thumb':
            import hasil as _h
            f = (qs.get('f') or [''])[0]
            if '/' in f or '..' in f: return self.send_error(403)
            pth = os.path.join(_h.folder_keluar(), f)
            if not os.path.isfile(pth): return self.send_error(404)
            hal = int((qs.get('p') or ['1'])[0] or 1)
            lbr = int((qs.get('w') or ['300'])[0] or 300)
            g = _h.thumb(pth, hal, max(80, min(900, lbr)))
            if not g: return self.send_error(500, 'gagal membuat pratinjau')
            d = open(g, 'rb').read()
            self.send_response(200); self.send_header('Content-Type','image/png')
            self.send_header('Cache-Control','max-age=86400')
            self.send_header('Content-Length',str(len(d))); self.end_headers()
            self.wfile.write(d); return

        if u.path == '/berkas':
            import hasil as _h
            f = (qs.get('f') or [''])[0]
            if '/' in f or '..' in f: return self.send_error(403)
            pth = os.path.join(_h.folder_keluar(), f)
            if not os.path.isfile(pth): return self.send_error(404)
            d = open(pth, 'rb').read()
            self.send_response(200); self.send_header('Content-Type','application/pdf')
            # unduh=1 memaksa berkas tersimpan di perangkat, bukan dibuka di tab.
            # Itu satu-satunya jalan membagikannya ke WhatsApp dari Android:
            # halaman ini diakses lewat HTTP biasa, jadi navigator.share tidak ada.
            if (qs.get('unduh') or [''])[0]:
                self.send_header('Content-Disposition',
                                 'attachment; filename="%s"' % f.replace('"', ''))
            self.send_header('Content-Length',str(len(d))); self.end_headers()
            self.wfile.write(d); return

        if u.path == '/otomatis':
            # Pilihkan soal paling sesuai lalu langsung susun — tanpa mencentang
            # satu per satu, tanpa AI.
            import pilih as _p, naskah as _nsk, buat as _b, otomasi as _o, setelan as _st, time as _t
            topik = (qs.get('topik') or [''])[0]
            komposisi = (qs.get('komposisi') or [''])[0]
            mapel = (qs.get('mapel') or [''])[0]
            kls = (qs.get('kelas') or [''])[0]
            c = db()
            terpilih, catatan = _p.pilih(c, topik=topik, mapel=mapel,
                                         kelas=int(kls) if kls.isdigit() else None,
                                         komposisi=komposisi)
            c.close()
            if not terpilih:
                return self.balas_teks('Bank soal belum punya soal yang cocok. '
                                       'Buat dulu lewat tab "Buat Soal".', 404)
            butir = [{'jenis': r['jenis_soal'] or 'PG', 'batang': r['batang'],
                      'opsi': json.loads(r['opsi'] or '{}'), 'kunci': r['kunci'] or '',
                      'bobot': r['bobot'], 'sub': [], 'bacaan': _bacaan_baris(r)}
                     for r in terpilih]
            judul = (qs.get('judul') or [''])[0] or (topik.title() if topik else 'Latihan')
            teks = _nsk.ke_naskah(butir, judul)
            st = _st.muat()
            kop = dict(lembaga=st.get('lembaga') or 'Exact Course',
                       mapel=_b.kode_mapel(mapel or st.get('mapel','')),
                       sekolah=st.get('sekolah',''), kelas=kls or st.get('kelas',''),
                       tanggal=_t.strftime('%d%m'), kunci=True, pembahasan=False,
                       kolom=st.get('kolom','2'), kerapatan=st.get('kerapatan','Normal'),
                       garis_per_nilai=st.get('garis','1.5'))
            os.makedirs(_b.KELUAR, exist_ok=True)
            nama = _b.nama_berkas(kop, True, _b.KELUAR)
            tuju = os.path.join(_b.KELUAR, f'{nama}.pdf')
            try:
                _o.worksheet_pdf(teks, tuju, kop=kop)
            except Exception as e:
                return self.balas_teks(f'Gagal menyusun: {e}', 500)
            subprocess.run(['open', tuju], capture_output=True)
            rinci = ' · '.join(f"{k}: {v['didapat']}/{v['diminta']}" for k, v in catatan.items())
            return self.balas_teks(
                f'{len(butir)} soal dipilih otomatis ({rinci}) → '
                f'{os.path.basename(tuju)} (terbuka)')

        if u.path == '/susun':
            # Susun lembar dari soal yang SUDAH ada di bank — tanpa Gemini,
            # tanpa AI. Inilah gunanya menyimpan soal hasil generate.
            import naskah as _nsk, buat as _b, otomasi as _o, time as _t
            ids = [int(x) for x in qs.get('id', []) if x.isdigit()][:120]
            if not ids: return self.send_error(400, 'tidak ada soal dipilih')
            judul = (qs.get('judul') or ['Latihan'])[0]
            c = db(); tanda = ','.join('?' * len(ids))
            rows = c.execute(f"""SELECT s.*, d.mapel, d.kelas
                                FROM soal s JOIN dokumen d ON d.id=s.dok_id
                                WHERE s.id IN ({tanda})""", ids).fetchall()
            c.close()
            butir = []
            for r in rows:
                jenis = r['jenis_soal'] or ('PG' if (r['n_opsi'] or 0) >= 3 else 'E')
                butir.append({'jenis': jenis, 'batang': r['batang'],
                              'opsi': json.loads(r['opsi'] or '{}'),
                              'kunci': r['kunci'] or '', 'bobot': r['bobot'], 'sub': [],
                              'bacaan': _bacaan_baris(r)})
            teks = _nsk.ke_naskah(butir, judul)
            mapel = next((r['mapel'] for r in rows if r['mapel']), '') or ''
            kelas = next((str(r['kelas']) for r in rows if r['kelas']), '') or ''
            import setelan as _st
            st = _st.muat()
            kop = dict(lembaga=st.get('lembaga') or 'Exact Course',
                       mapel=_b.kode_mapel(mapel), sekolah=st.get('sekolah',''),
                       kelas=kelas, tanggal=_t.strftime('%d%m'),
                       kunci=True, pembahasan=False, kolom=st.get('kolom','2'))
            os.makedirs(_b.KELUAR, exist_ok=True)
            nama = _b.nama_berkas(kop, True, _b.KELUAR)
            tuju = os.path.join(_b.KELUAR, f'{nama}.pdf')
            try:
                _o.worksheet_pdf(teks, tuju, kop=kop)
            except Exception as e:
                return self.balas_teks(f'Gagal menyusun: {e}', 500)
            subprocess.run(['open', tuju], capture_output=True)
            return self.balas_teks(
                f'{len(butir)} soal disusun tanpa AI → {os.path.basename(tuju)} (terbuka)')

        if u.path == '/cepat':
            # Dipanggil dari menu bar: ambil gambar papan klip, pakai setelan
            # tersimpan, langsung jalankan. Tidak perlu membuka halaman.
            import klip, setelan, buat, threading, uuid
            d = klip.ambil_png()
            if not d:
                b = json.dumps({'galat': 'Papan klip tidak berisi gambar'}).encode()
                self.send_response(400); self.send_header('Content-Type','application/json')
                self.send_header('Content-Length',str(len(b))); self.end_headers()
                self.wfile.write(b); return
            st = setelan.muat()
            jid = uuid.uuid4().hex[:12]
            buat.TUGAS[jid] = {'langkah': ['Mulai dari papan klip…'], 'maju': 3, 'selesai': False}
            kls = (st.get('kelas') or '').strip()
            threading.Thread(target=buat.jalankan, kwargs=dict(
                jid=jid, gambar=[('klip.png', d)], instruksi=st.get('instruksi',''),
                jumlah=st.get('jumlah',''), mapel=st.get('mapel') or None,
                kelas=int(kls) if kls.isdigit() else None, judul='',
                api=os.environ.get('EXACT_API'), topik='', jenjang=st.get('jenjang',''),
                n_set=st.get('n_set',''), sulit=st.get('sulit',''),
                bahasa=st.get('bahasa') or 'Indonesia', lembaga=st.get('lembaga',''),
                sekolah=st.get('sekolah',''), tanggal='',
                kunci=st.get('kunci', True), pembahasan=st.get('pembahasan', True),
                kolom=st.get('kolom','2'), dua_berkas=st.get('dua_berkas', False),
                mata=st.get('mata') or 'gemini', mode=st.get('mode') or 'flash',
                mesin=st.get('mesin') or 'gemini'),
                daemon=True).start()
            b = json.dumps({'jid': jid}).encode()
            self.send_response(200); self.send_header('Content-Type','application/json')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/klip':
            import klip
            d = klip.ambil_png()
            if not d:
                return self.send_error(404, 'Tidak ada gambar di papan klip')
            self.send_response(200); self.send_header('Content-Type','image/png')
            self.send_header('Content-Length',str(len(d))); self.end_headers()
            self.wfile.write(d); return

        if u.path == '/status':
            import buat
            jid = (qs.get('jid') or [''])[0]
            if not jid:
                with buat.KUNCI:
                    d = [{'jid': k, 'maju': v.get('maju'), 'selesai': v.get('selesai'),
                          'galat': v.get('galat'),
                          'terakhir': (v.get('langkah') or ['-'])[-1]}
                         for k, v in buat.TUGAS.items()]
                b = json.dumps(d).encode()
                self.send_response(200); self.send_header('Content-Type','application/json')
                self.send_header('Content-Length',str(len(b))); self.end_headers()
                self.wfile.write(b); return
            with buat.KUNCI:
                d = dict(buat.TUGAS.get(jid, {'langkah': [], 'maju': 0, 'selesai': True,
                                              'galat': 'tugas tidak dikenal'}))
            # Naskahnya sendiri tidak ikut (bisa puluhan KB tiap 1,5 detik);
            # cukup penanda bahwa lembar ini bisa diterbitkan ke Exact Practice.
            d['bisa_terbit'] = bool(d.pop('naskah', None)); d.pop('isian', None)
            # Ikutkan keadaan antrean supaya "menunggu" bisa menyebut nomor,
            # apa yang sedang dikerjakan, dan sudah berapa lama.
            if not d.get('selesai'):
                a = buat.ANTREAN.lihat()
                urut = [x['jid'] for x in a['tunggu']]
                d['antre'] = {
                    'nomor': urut.index(jid) + 1 if jid in urut else 0,
                    'panjang': len(urut),
                    'kerja': a['kerja'],
                }
            b = json.dumps(d).encode()
            self.send_response(200); self.send_header('Content-Type','application/json')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/api/soal':
            # Soal yang sudah terurai dari sebuah pekerjaan /buat, untuk Exact
            # Practice. Kunci jawaban ikut - ini antarmuka guru, bukan murid.
            import buat, naskah as _nsk
            jid = (qs.get('jid') or [''])[0]
            with buat.KUNCI:
                d = dict(buat.TUGAS.get(jid) or {})
            if not d:
                return self.send_error(404, 'tugas tidak dikenal')
            teks = d.get('naskah') or ''
            butir, meta = (_nsk.urai(teks) if teks else ([], {}))
            b = json.dumps({'jid': jid, 'selesai': d.get('selesai'), 'galat': d.get('galat'),
                            'pdf': os.path.basename(d['pdf']) if d.get('pdf') else None,
                            'judul': meta.get('judul'), 'butir': butir},
                           ensure_ascii=False).encode()
            self.send_response(200); self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/aplikasi/ulang':
            # Tombol darurat tingkat aplikasi: semua tugas dihentikan, antrean
            # dikosongkan, Chrome kendali ditutup, lalu layanan dimulai ulang
            # LEWAT launchd (mulai-ulang.sh: kickstart, dan bootout+bootstrap
            # bila izin Desktop ikut hilang). Jawaban dikirim dulu, baru
            # dimulai ulang, supaya halaman di HP tahu apa yang terjadi.
            import buat, cdp as _cdp, subprocess as _sp, sys as _sys
            with buat.KUNCI:
                jids = list(buat.TUGAS.keys())
            for jid in jids:
                try: buat.minta_henti(jid)
                except Exception: pass
            try:
                for x in list(buat.ANTREAN.lihat().get('tunggu', [])):
                    buat.ANTREAN.batalkan(x['jid'])
            except Exception: pass
            with buat.KUNCI:
                n = len(buat.TUGAS); buat.TUGAS.clear()
            try: _cdp.matikan(tunggu=4)
            except Exception: pass
            skrip = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mulai-ulang.sh')
            b = json.dumps({'ok': True, 'pesan': f'{n} tugas dibersihkan. Aplikasi dimulai ulang…'}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
            try: self.wfile.flush()
            except Exception: pass
            # Sesi baru (setsid): launchd membunuh process group layanan saat
            # kickstart, tapi anak bersesi sendiri selamat dan menyelesaikan
            # pemulaian ulang.
            _sp.Popen(['/usr/bin/nohup', '/bin/bash', skrip], start_new_session=True,
                      stdout=open('/tmp/exact-worksheet-ulang.log', 'ab'),
                      stderr=_sp.STDOUT, stdin=_sp.DEVNULL,
                      env={**os.environ, 'PATH': '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
                           'HOME': os.path.expanduser('~')})
            return

        if u.path == '/chrome/ulang':
            # Tombol darurat: Chrome kendali ditutup lalu dinyalakan lagi dari
            # keadaan bersih (menu macet, dialog nyangkut, Gemini menolak terus).
            # Tugas yang sedang berjalan akan gagal dan harus diulang.
            import cdp as _cdp, buat as _b
            sedang = any(not t.get('selesai') for t in _b.TUGAS.values())
            try:
                _cdp.nyalakan_ulang()
                pesan = 'Chrome dinyalakan ulang.' + (' Tugas yang tadi berjalan perlu diulang.' if sedang else '')
                b = json.dumps({'ok': True, 'pesan': pesan}).encode()
            except Exception as e:
                b = json.dumps({'galat': f'{type(e).__name__}: {e}'}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b); return

        if u.path == '/api/prompt':
            # Perintah AI siap salin untuk naskah yang disusun manual: guru
            # menyalinnya dari menu bar, menempelkannya ke AI mana pun, lalu
            # naskah balasannya dipakai lewat "Buat dari papan klip" — tanpa
            # membuka aplikasi dan tanpa lewat Chrome kendali sama sekali.
            # Sumbernya prompt-builder.js milik aplikasi itu sendiri, jadi
            # tidak mungkin kedaluwarsa terhadap format naskah yang berlaku.
            import wsmaker as _ws
            mapel = (urllib.parse.parse_qs(u.query).get('mapel') or ['Matematika'])[0]
            try:
                b = json.dumps({'prompt': _ws.perintah_baku(mapel)}).encode()
            except Exception as e:
                b = json.dumps({'galat': f'{type(e).__name__}: {e}'}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b); return

        if u.path == '/layar':
            # Potret tab kendali. Chrome-nya tanpa jendela, jadi ini satu-satunya
            # cara melihat apa yang sedang terjadi di sana saat sebuah lembar
            # dibuat — atau saat ia macet.
            import otomasi as _o
            mana = (qs.get('tab') or ['gemini'])[0]
            try:
                d = _o.potret('gemini.google.com/app' if mana != 'wsm' else '/wsm/')
            except Exception as e:
                pesan = f'Tidak bisa memotret: {type(e).__name__}'.encode()
                self.send_response(503); self.send_header('Content-Type','text/plain; charset=utf-8')
                self.send_header('Content-Length',str(len(pesan))); self.end_headers()
                self.wfile.write(pesan); return
            self.send_response(200); self.send_header('Content-Type','image/jpeg')
            self.send_header('Cache-Control','no-store')
            self.send_header('Content-Length',str(len(d))); self.end_headers()
            self.wfile.write(d); return

        if u.path == '/batal':
            import buat
            jid = (qs.get('jid') or [''])[0]
            # minta_henti menangani dua keadaan: masih mengantre (dibatalkan)
            # dan sedang berjalan (ditandai supaya berhenti di titik aman).
            ok = buat.minta_henti(jid)
            b = json.dumps({'batal': ok}).encode()
            self.send_response(200); self.send_header('Content-Type','application/json')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/serupa':
            import serupa
            b = serupa.halaman_awal().encode()
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/impor':
            b = HAL_IMPOR.encode()
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/wsm' or u.path == '/wsm/':
            self.send_response(302); self.send_header('Location', '/wsm/index.html')
            self.end_headers(); return

        if u.path.startswith('/wsm/'):
            # Mesin Exact Worksheet Maker disajikan dari dalam aplikasi ini,
            # jadi tidak perlu server terpisah di port 8420 maupun jalur luar.
            rel = urllib.parse.unquote(u.path[len('/wsm/'):])
            if '..' in rel: return self.send_error(403)
            fp = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wsm', rel)
            if not os.path.isfile(fp): return self.send_error(404)
            tipe = mimetypes.guess_type(fp)[0] or 'application/octet-stream'
            d = open(fp, 'rb').read()
            self.send_response(200); self.send_header('Content-Type', tipe)
            # Tanpa aturan ini peramban menebak sendiri berapa lama berkas mesin
            # boleh disimpan, dan tab yang sudah lama terbuka tetap memakai
            # versi lama setelah wsm/ disunting — perbaikan terlihat "tidak
            # berpengaruh" padahal sudah benar. Di localhost, memeriksa ulang
            # tiap kali tidak ada ongkosnya.
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Content-Length', str(len(d))); self.end_headers()
            self.wfile.write(d); return

        if u.path.startswith('/statik/'):
            rel = u.path[len('/statik/'):]
            if '..' in rel: return self.send_error(403)
            fp = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'statik', rel)
            if not os.path.isfile(fp): return self.send_error(404)
            tipe = mimetypes.guess_type(fp)[0] or 'application/octet-stream'
            d = open(fp,'rb').read()
            self.send_response(200); self.send_header('Content-Type', tipe)
            self.send_header('Cache-Control','max-age=86400')
            self.send_header('Content-Length',str(len(d))); self.end_headers()
            self.wfile.write(d); return

        if u.path == '/lembar.pdf':
            # Render lewat Chrome tanpa jendela. Alternatifnya dialog cetak peramban,
            # yang tetap tersedia sebagai tombol di halaman lembar.
            import tempfile, shutil
            krom = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            if not os.path.isfile(krom):
                return self.send_error(501, 'Chrome tidak ditemukan; pakai tombol Cetak di halaman lembar')
            tmp = tempfile.mkdtemp()
            keluar = os.path.join(tmp, 'lembar.pdf')
            asal = f'http://127.0.0.1:{PORT}/lembar?' + u.query
            try:
                subprocess.run([krom, '--headless', '--disable-gpu', '--no-pdf-header-footer',
                                f'--print-to-pdf={keluar}', '--virtual-time-budget=8000', asal],
                               capture_output=True, timeout=120)
                if not os.path.isfile(keluar): return self.send_error(500, 'gagal membuat PDF')
                d = open(keluar,'rb').read()
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
            nama = (urllib.parse.parse_qs(u.query).get('judul') or ['lembar'])[0]
            nama = re.sub(r'[^\w -]', '', nama).strip() or 'lembar'
            self.send_response(200); self.send_header('Content-Type','application/pdf')
            self.send_header('Content-Disposition', f'attachment; filename="{nama}.pdf"')
            self.send_header('Content-Length',str(len(d))); self.end_headers()
            self.wfile.write(d); return

        if u.path == '/lembar':
            ids = [int(x) for x in qs.get('id', []) if x.isdigit()][:200]
            if not ids:
                return self.send_error(400, 'tidak ada soal dipilih')
            c = db()
            tanda = ','.join('?' * len(ids))
            rows = c.execute(f"""SELECT s.batang, s.opsi, s.no_soal, s.no_hal, d.nama,
                                       d.mapel, d.kelas, d.jenis
                                FROM soal s JOIN dokumen d ON d.id=s.dok_id
                                WHERE s.id IN ({tanda})""", ids).fetchall()
            c.close()
            import lembar
            o = {k: (qs.get(k) or [''])[0] for k in ('judul','mapel','kelas','jenis','arahan','kolom','per_hal','footer')}
            o['kunci'] = bool(qs.get('kunci'))
            if not o['mapel'] and rows: o['mapel'] = rows[0]['mapel'] or ''
            if not o['kelas'] and rows and rows[0]['kelas']: o['kelas'] = f"Kelas {rows[0]['kelas']}"
            b = lembar.buat(rows, o).encode()
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path.startswith('/pdf/'):
            c = db(); r = c.execute("SELECT rel FROM dokumen WHERE id=?", (u.path[5:],)).fetchone(); c.close()
            if not r: return self.send_error(404)
            p = os.path.join(AKAR, r['rel'])
            if not os.path.isfile(p): return self.send_error(404)
            d = open(p,'rb').read()
            self.send_response(200); self.send_header('Content-Type','application/pdf')
            self.send_header('Content-Length',str(len(d))); self.end_headers(); self.wfile.write(d); return
        if u.path == '/':
            import titipan
            kode = (qs.get('titip') or [''])[0]
            awal = '/buat'
            if kode:
                d = titipan.lihat(kode)
                if d:
                    awal = ('/jawab' if d['mode'] == 'jawab' else '/buat') + f'?titip={kode}'
            b = KERANGKA.replace('src="/buat"', f'src="{html.escape(awal, quote=True)}"') \
                        .replace("data-u=\"/buat\" class=aktif",
                                 f'data-u="{html.escape(awal, quote=True)}" class=aktif'
                                 if awal.startswith('/buat') else 'data-u="/buat"') \
                        .replace('<button data-u="/jawab">',
                                 f'<button data-u="{html.escape(awal, quote=True)}" class=aktif>'
                                 if awal.startswith('/jawab') else '<button data-u="/jawab">')
            b = b.encode()
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return
        if u.path != '/cari': return self.send_error(404)

        q = (qs.get('q') or [''])[0]
        mode = (qs.get('mode') or ['halaman'])[0]
        filt = {k:(qs.get(k) or [''])[0] for k in ('folder','jenjang','mapel','jenis','kelas','sekolah','bentuk')}
        c = db()
        nd, nh = c.execute("SELECT COUNT(*), SUM(n_hal_teks) FROM dokumen WHERE n_hal_teks>0 AND dup_dari IS NULL").fetchone()
        n_dibuat = c.execute("""SELECT COUNT(*) FROM soal s JOIN dokumen d ON d.id=s.dok_id
                                WHERE d.folder='DIBUAT' AND s.dup=0""").fetchone()[0]
        c.close()
        fil = ''
        for k, lbl in (('mapel','semua mapel'),('jenjang','semua jenjang'),('kelas','semua kelas'),
                       ('jenis','semua jenis'),('sekolah','semua sekolah'),('folder','semua folder')):
            o = ''.join(f'<option{" selected" if filt[k]==v else ""}>{html.escape(str(v))}</option>' for v in opsi(k))
            fil += f'<select name={k}><option value="">{lbl}</option>{o}</select>'
        c = db()
        ns = c.execute("SELECT COUNT(*) FROM soal WHERE dup=0").fetchone()[0]; c.close()
        sel = lambda v: ' class=aktif' if mode == v else ''
        tab = (f'<div class=tab>'
               f'<a href="/cari?mode=halaman&q={urllib.parse.quote(q)}"{sel("halaman")}>Halaman</a>'
               f'<a href="/cari?mode=soal&q={urllib.parse.quote(q)}"{sel("soal")}>Soal satuan ({ns:,})</a>'
               '</div>')
        fil = f'<input type=hidden name=mode value="{html.escape(mode)}">' + fil
        if mode == 'soal':
            b2 = ''.join(f'<option{" selected" if filt["bentuk"]==v else ""}>{v}</option>' for v in ('Pilihan ganda','Uraian'))
            fil += f'<select name=bentuk><option value="">semua bentuk</option>{b2}</select>'
        badan = ''
        if q and mode == 'soal':
            rows, n = cari_soal(q, filt)
            badan = ('<form action="/otomatis" method=get class=oto>'
                     '<b>Pilih otomatis</b> — sebutkan topik dan komposisinya, '
                     'soal dipilihkan sendiri:'
                     '<div class=r2>'
                     f'<input name=topik placeholder="topik" value="{html.escape(q)}">'
                     '<input name=komposisi placeholder="10 PG + 2 Esai" size=16>'
                     '<input name=mapel placeholder="mapel" size=9>'
                     '<input name=kelas placeholder="kls" size=4>'
                     '<button type=submit>Susun Otomatis</button>'
                     '</div></form>'
                     '<form action="/susun" method=get id=fLembar>'
                     f'<div class=jml>{n:,} soal cocok · menampilkan {len(rows)}</div>')
            if not rows: badan += '<div class=kosong>tidak ada soal cocok</div>'
            for r in rows:
                import json as _j
                o = _j.loads(r['opsi'] or '{}')
                ops = ''.join(f'<div class=opsi><b>{k}.</b> {html.escape(v[:200])}</div>' for k, v in sorted(o.items()))
                tag = ''
                for k in ('mapel','jenis','sekolah','tahun'):
                    if r[k]: tag += f'<span class=tag>{html.escape(str(r[k]))}</span>'
                if r['kelas']: tag += f'<span class=tag>kelas {r["kelas"]}</span>'
                elif r['jenjang']: tag += f'<span class=tag>{html.escape(r["jenjang"])}</span>'
                badan += (f'<div class=h><label class=pilih>'
                          f'<input type=checkbox name=id value="{r["id"]}"> pilih</label>'
                          f'<div class=batang>{html.escape(r["batang"][:900])}</div>{ops}'
                          f'<div class=meta>{tag}<span class=tag>'
                          f'<a href="/pdf/{r["dok"]}#page={r["no_hal"]}" target=_blank>'
                          f'{html.escape(r["nama"][:52])} · no.{r["no_soal"]} hal.{r["no_hal"]}</a></span></div></div>')
            badan += ('<div class="aksi no-print">'
                      '<input name=judul placeholder="judul lembar kerja" value="LEMBAR KERJA">'
                      '<select name=kolom><option value=2>2 kolom</option><option value=1>1 kolom</option></select>'
                      '<label><input type=checkbox name=kunci checked> sertakan rujukan sumber</label>'
                      '<button type=submit>Susun Lembar (tanpa AI)</button>'
                      '<span id=nPilih>0 dipilih</span></div></form>'
                      '<script>const f=document.getElementById("fLembar");'
                      'f.addEventListener("change",()=>{document.getElementById("nPilih").textContent='
                      'f.querySelectorAll("input[name=id]:checked").length+" dipilih"});</script>')
        elif q:
            rows, n = cari(q, filt)
            badan = f'<div class=jml>{n:,} halaman cocok · menampilkan {len(rows)}</div>'
            if not rows: badan += '<div class=kosong>tidak ada hasil</div>'
            for r in rows:
                duga = '<span class=duga title="label hasil tebakan mesin, akurasi ~85%">?</span>' if r['asal_label']=='duga' else ''
                tag = ''
                if r['mapel']:   tag += f'<span class=tag>{html.escape(r["mapel"])}{duga}</span>'
                if r['kelas']:   tag += f'<span class=tag>kelas {r["kelas"]}</span>'
                elif r['jenjang']: tag += f'<span class=tag>{html.escape(r["jenjang"])}{duga}</span>'
                for k in ('jenis','sekolah','tahun'):
                    if r[k]: tag += f'<span class=tag>{html.escape(str(r[k]))}</span>'
                badan += (f'<div class=h><a class=jdl href="/pdf/{r["id"]}#page={r["no_hal"]}" target=_blank>'
                          f'{html.escape(r["nama"])}</a>'
                          f'<div class=meta><span>hal. {r["no_hal"]}</span>{tag}'
                          f'<span class=tag>{html.escape(r["folder"])}</span></div>'
                          f'<div class=cuplik>{r["cuplik"]}</div></div>')
        else:
            badan = '<div class=kosong>ketik kata kunci untuk mulai mencari</div>'
        out = (HAL.replace('__RINGKAS__', f'{nd:,} dokumen · {nh:,} halaman terindeks · seluruhnya lokal')
                  .replace('__Q__', html.escape(q)).replace('__FILTER__', fil)
                  .replace('__TAB__', tab).replace('__HASIL__', badan))
        b = out.encode(); self.send_response(200)
        self.send_header('Content-Type','text/html; charset=utf-8')
        self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path == '/aplikasi/ulang':
            return self.do_GET()          # aksi yang sama untuk GET dan POST
        u = urllib.parse.urlparse(self.path)
        print(f'[POST] {u.path} dari {self.client_address[0]} '
              f'({self.headers.get("Content-Length","?")} byte)', flush=True)
        if u.path == '/api/render':
            # Daftar soal (bentuk keluaran naskah.urai) -> naskah -> PDF lewat
            # Exact Worksheet Maker. Dipakai Exact Practice untuk mencetak paket
            # yang disusun dari bank tanpa AI. Chrome kendali dipakai bersama,
            # jadi ikut antrean yang sama dengan pekerjaan Gemini.
            import buat, naskah as _nsk, otomasi as _o, uuid as _uuid, time as _tm
            panjang = int(self.headers.get('Content-Length') or 0)
            try:
                d = json.loads(self.rfile.read(panjang).decode('utf-8') if panjang else '{}')
            except Exception:
                return self.send_error(400, 'JSON tidak sah')
            butir = d.get('butir') or []
            if not butir: return self.send_error(400, 'butir kosong')
            judul = (d.get('judul') or 'Latihan').strip()
            kop = d.get('kop') or {}
            teks = _nsk.ke_naskah(butir, judul)
            jid = 'render-' + _uuid.uuid4().hex[:8]
            if not buat.ANTREAN.masuk(jid, 'Cetak paket'):
                return self.send_error(503, 'antrean sibuk')
            try:
                os.makedirs(buat.KELUAR, exist_ok=True)
                nama = buat.nama_berkas(dict(mapel=buat.kode_mapel(kop.get('mapel') or ''),
                                             sekolah=kop.get('sekolah') or '',
                                             kelas=str(kop.get('kelas') or ''),
                                             tanggal=_tm.strftime('%d%m')),
                                        bool(d.get('kunci')), buat.KELUAR)
                tuju = os.path.join(buat.KELUAR, f'{nama}.pdf')
                _o.worksheet_pdf(teks, tuju, kop=dict(
                    lembaga=kop.get('lembaga') or 'Exact Course', mapel=buat.kode_mapel(kop.get('mapel') or ''),
                    sekolah=kop.get('sekolah') or '', kelas=str(kop.get('kelas') or ''),
                    tanggal=_tm.strftime('%d%m'), kunci=bool(d.get('kunci')),
                    pembahasan=bool(d.get('pembahasan')), kolom=str(d.get('kolom') or '1'),
                    kerapatan='Normal', garis_per_nilai='1.5'))
            except Exception as e:
                buat.ANTREAN.keluar(jid)
                b = json.dumps({'galat': f'{type(e).__name__}: {e}'}).encode()
                self.send_response(500); self.send_header('Content-Type','application/json')
                self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b); return
            buat.ANTREAN.keluar(jid)
            b = json.dumps({'pdf': os.path.basename(tuju), 'unduh': f'/berkas?unduh=1&f={urllib.parse.quote(os.path.basename(tuju))}'}).encode()
            self.send_response(200); self.send_header('Content-Type','application/json')
            self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b); return

        if u.path == '/api/potret-html':
            # HTML -> PNG lewat Chrome kendali. Exact Practice memakainya untuk
            # menggambar satu soal (dengan rumus KaTeX) sebagai foto yang
            # dikirim ke antrean pertanyaan Exact Canvas.
            import buat, cdp as _cdp, uuid as _uuid, base64 as _b64, time as _tm
            panjang = int(self.headers.get('Content-Length') or 0)
            try:
                d = json.loads(self.rfile.read(panjang).decode('utf-8') if panjang else '{}')
            except Exception:
                return self.send_error(400, 'JSON tidak sah')
            html = d.get('html') or ''
            if not html: return self.send_error(400, 'html kosong')
            lebar = int(d.get('lebar') or 900); tinggi = int(d.get('tinggi') or 600)
            jid = 'potret-' + _uuid.uuid4().hex[:8]
            if not buat.ANTREAN.masuk(jid, 'Potret soal'):
                return self.send_error(503, 'antrean sibuk')
            try:
                _cdp.nyalakan()
                tab = _cdp.buka_tab('data:text/html;charset=utf-8,' + urllib.parse.quote(html), paksa_baru=True)
                s = _cdp.Sesi(tab); s.ukuran(lebar, tinggi, paksa=True); _tm.sleep(1.6)
                # tinggi mengikuti isi supaya soal panjang tidak terpotong
                h = int(s.evaluasi('Math.min(2200, Math.max(document.body.scrollHeight, 200))') or tinggi)
                s.ukuran(lebar, h, paksa=True); _tm.sleep(0.4)
                png = _b64.b64decode(s.perintah('Page.captureScreenshot', format='png')['data'])
                s.tutup()
                try: urllib.request.urlopen(f'http://127.0.0.1:{_cdp.PORT}/json/close/{tab["id"]}', timeout=5).read()
                except Exception: pass
            except Exception as e:
                buat.ANTREAN.keluar(jid)
                return self.send_error(500, f'{type(e).__name__}: {e}')
            buat.ANTREAN.keluar(jid)
            self.send_response(200); self.send_header('Content-Type','image/png')
            self.send_header('Content-Length',str(len(png))); self.end_headers(); self.wfile.write(png); return

        if u.path == '/api/periksa':
            # Hitung apa yang terbaca dari naskah tempelan sebelum dirender.
            import buat
            panjang = int(self.headers.get('Content-Length') or 0)
            teks = self.rfile.read(panjang).decode('utf-8', 'replace') if panjang else ''
            jenis = (urllib.parse.parse_qs(u.query).get('jenis') or ['soal'])[0]
            try:
                d = buat.periksa_naskah(teks, jenis)
            except Exception as e:
                d = {'jumlah': 0, 'pesan': f'{type(e).__name__}: {e}'}
            b = json.dumps(d, ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/terbitkan':
            # Kirim lembar ke Exact Practice sebagai paket latihan online.
            # Form biasa (urlencoded): jid (tugas baru) ATAU f (nama PDF di
            # Desktop), plus judul/durasi opsional.
            import buat, terbit as _tb
            panjang = int(self.headers.get('Content-Length') or 0)
            medan = {k: v[0] for k, v in urllib.parse.parse_qs(self.rfile.read(panjang).decode('utf-8', 'replace')).items()}
            jid = medan.get('jid', ''); nama_pdf = medan.get('f', '')
            teks = None; isian = {}
            if jid:
                t = buat.TUGAS.get(jid) or {}
                teks = t.get('naskah'); nama_pdf = nama_pdf or os.path.basename(t.get('pdf') or '')
                isian = t.get('isian') or {}
            if not teks and nama_pdf:
                teks = _tb.naskah_untuk(nama_pdf)
            if not teks:
                b = json.dumps({'galat': 'Naskah lembar ini tidak ditemukan — hanya lembar yang dibuat lewat Exact Worksheet yang bisa diterbitkan.'}).encode()
            else:
                b = json.dumps(_tb.terbitkan(teks, nama_pdf=nama_pdf, judul=medan.get('judul', ''),
                                             durasi=medan.get('durasi'), mapel=isian.get('mapel', ''),
                                             kelas=isian.get('kelas', ''), topik=isian.get('topik', ''),
                                             set_ke=medan.get('set', ''))).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b); return
        if u.path == '/cetak':
            panjang = int(self.headers.get('Content-Length') or 0)
            mentah = self.rfile.read(panjang) if panjang else b''
            jenis = self.headers.get('Content-Type', '')
            medan = {}
            halaman = []
            if jenis.startswith('multipart/form-data'):
                batas = jenis.split('boundary=')[-1].strip('"').encode()
                for bagian in mentah.split(b'--' + batas):
                    if b'\r\n\r\n' not in bagian: continue
                    kepala, _, nilai = bagian.partition(b'\r\n\r\n')
                    mn = re.search(rb'name="([^"]+)"', kepala)
                    if not mn: continue
                    nama = mn.group(1).decode()
                    isi = nilai.rstrip(b'\r\n-').decode('utf-8','replace')
                    if nama == 'h': halaman.append(isi)
                    else: medan[nama] = isi
            else:
                d = urllib.parse.parse_qs(mentah.decode('utf-8','replace'))
                halaman = d.get('h', [])
                medan = {k: v[0] for k, v in d.items()}
            import hasil as _h, setelan as _st
            # Cetak cepat dari daftar hasil hanya mengirim nama berkas. Setelan
            # cetak yang tersimpan dipakai apa adanya dan TIDAK ditimpa, supaya
            # satu ketukan cepat tidak diam-diam mengubah pilihan printer,
            # bolak-balik, dan jumlah salinan milik halaman cetak penuh.
            if medan.get('semua'):
                st = _st.muat()
                medan.setdefault('printer', st.get('printer', ''))
                medan['salinan'] = st.get('salinan') or '1'
                # Cetak cepat selalu lewat gambar dan selalu bolak-balik. Printer
                # Rico monokrom dan sering menolak PDF berwarna langsung; setelan
                # tersimpan bisa saja ikut mati karena satu borang dikirim tanpa
                # centangnya, dan kegagalan itu baru ketahuan di depan printer.
                medan['gambar'] = '1'
                medan['bolak'] = st.get('bolak') or 'otomatis'
                f0 = medan.get('f', '')
                p0 = os.path.join(_h.folder_keluar(), f0)
                if '/' not in f0 and '..' not in f0 and os.path.isfile(p0):
                    halaman = [str(i) for i in range(1, _h.n_halaman(p0) + 1)]
            # ingat pilihan cetak untuk berikutnya
            try:
                if medan.get('semua'): raise StopIteration
                lama = _st.muat()
                lama.update({'printer': medan.get('printer',''),
                             'bolak': medan.get('bolak','otomatis'),
                             'salinan': medan.get('salinan','1')})
                if 'gambar' in medan: lama['gambar'] = True
                else: lama.pop('gambar', None)
                _st.simpan(lama)
            except StopIteration:
                pass
            except Exception:
                pass
            f = medan.get('f', '')
            pth = os.path.join(_h.folder_keluar(), f)
            jawab = {}
            if '/' in f or '..' in f or not os.path.isfile(pth):
                jawab = {'galat': 'berkas tidak ditemukan'}
            else:
                try:
                    pesan = _h.cetak(pth, [int(x) for x in halaman if x.isdigit()],
                                     medan.get('printer',''), medan.get('salinan','1'),
                                     lewat_gambar=('gambar' in medan),
                                     bolak_balik=medan.get('bolak', 'otomatis'),
                                     sisi=medan.get('sisi', 'semua'))
                    cara = 'lewat gambar' if 'gambar' in medan else 'PDF langsung'
                    jawab = {'pesan': f'{len(halaman)} halaman dikirim ke printer '
                                      f'({cara}) · {pesan[:60]}'}
                except Exception as e:
                    jawab = {'galat': str(e)[:160]}
            b = json.dumps(jawab).encode()
            self.send_response(200); self.send_header('Content-Type','application/json')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/terima':
            # Dipanggil aplikasi Android: satu berkas masuk, langsung dikerjakan
            # memakai setelan tersimpan. Jawabannya ringkas supaya mudah dibaca
            # di layar ponsel.
            # Terima juga kiriman tanpa Content-Length (transfer chunked):
            # BaseHTTPRequestHandler tidak menguraikannya sendiri.
            panjang = int(self.headers.get('Content-Length') or 0)
            if panjang:
                mentah = self.rfile.read(panjang)
            elif (self.headers.get('Transfer-Encoding') or '').lower() == 'chunked':
                potong = []
                while True:
                    baris = self.rfile.readline().strip()
                    try: n = int(baris.split(b';')[0], 16)
                    except ValueError: break
                    if n == 0:
                        self.rfile.readline(); break
                    potong.append(self.rfile.read(n)); self.rfile.read(2)
                mentah = b''.join(potong)
            else:
                mentah = b''
            jenis = self.headers.get('Content-Type', '')
            # Kumpulkan SEMUA berkas, bukan hanya yang terakhir: satu kiriman
            # bisa berisi beberapa foto yang dipilih sekaligus.
            semua, medan = [], {}
            if jenis.startswith('multipart/form-data'):
                batas = jenis.split('boundary=')[-1].strip('"').encode()
                for bagian in mentah.split(b'--' + batas):
                    if b'\r\n\r\n' not in bagian: continue
                    kepala, _, nilai = bagian.partition(b'\r\n\r\n')
                    mn = re.search(rb'name="([^"]+)"', kepala)
                    if not mn: continue
                    k = mn.group(1).decode()
                    nilai = nilai.rstrip(b'\r\n-')
                    if b'filename="' in kepala:
                        fn = re.search(rb'filename="([^"]*)"', kepala).group(1).decode()
                        if nilai: semua.append((fn or f'kiriman-{len(semua)+1}', nilai))
                    else:
                        medan[k] = nilai.decode('utf-8','replace')
            else:
                if mentah:
                    semua.append((self.headers.get('X-Nama-Berkas') or 'kiriman.pdf', mentah))
            nama = semua[0][0] if semua else 'kiriman'
            isi = semua[0][1] if semua else b''
            if not semua:
                b = json.dumps({'galat': 'tidak ada berkas'}).encode()
                self.send_response(400)
            else:
                import buat, setelan, threading, uuid, titipan
                mode0 = medan.get('mode') or 'buat'
                if mode0 == 'titip':
                    kode = titipan.titip(semua, medan.get('sasaran') or 'buat')
                    b = json.dumps({'titip': kode, 'jumlah': len(semua),
                                    'buka': f'/?titip={kode}'}).encode()
                    self.send_response(200)
                    self.send_header('Content-Type','application/json')
                    self.send_header('Content-Length',str(len(b))); self.end_headers()
                    self.wfile.write(b); return
                st = setelan.muat()
                jid = uuid.uuid4().hex[:12]
                buat.TUGAS[jid] = {'langkah': [f'Menerima {nama[:40]}…'], 'maju': 3,
                                   'selesai': False}
                kls = (st.get('kelas') or '').strip()
                mode = medan.get('mode') or 'buat'
                if mode == 'rangkum':
                    sasaran, kw = buat.jalankan_rangkum, dict(
                        jid=jid, gambar=semua, instruksi='',
                        mapel=st.get('mapel') or None,
                        kelas=int(kls) if kls.isdigit() else None, judul='',
                        bahasa=st.get('bahasa') or 'Indonesia',
                        lembaga=st.get('lembaga',''), sekolah=st.get('sekolah',''),
                        tanggal='', mata=st.get('mata') or 'gemini',
                        mode=st.get('mode') or 'flash',
                        mesin=st.get('mesin') or 'gemini')
                elif mode == 'jawab':
                    sasaran, kw = buat.jalankan_jawab, dict(
                        jid=jid, gambar=semua, instruksi='',
                        mapel=st.get('mapel') or None,
                        kelas=int(kls) if kls.isdigit() else None, judul='',
                        bahasa=st.get('bahasa') or 'Indonesia',
                        lembaga=st.get('lembaga',''), sekolah=st.get('sekolah',''),
                        tanggal='', kolom='1', mata=st.get('mata') or 'gemini',
                        mode=st.get('mode') or 'flash',
                        mesin=st.get('mesin') or 'gemini')
                else:
                    sasaran, kw = buat.jalankan, dict(
                        jid=jid, gambar=semua, instruksi=st.get('instruksi',''),
                        jumlah=st.get('jumlah',''), mapel=st.get('mapel') or None,
                        kelas=int(kls) if kls.isdigit() else None, judul='',
                        api=os.environ.get('EXACT_API'), topik='',
                        jenjang=st.get('jenjang',''), n_set=st.get('n_set',''),
                        sulit=st.get('sulit',''), bahasa=st.get('bahasa') or 'Indonesia',
                        lembaga=st.get('lembaga',''), sekolah=st.get('sekolah',''),
                        tanggal='', kunci=st.get('kunci', True),
                        pembahasan=st.get('pembahasan', True), kolom=st.get('kolom','2'),
                        dua_berkas=st.get('dua_berkas', False),
                        kerapatan=st.get('kerapatan','Normal'), garis=st.get('garis','1.5'))
                threading.Thread(target=sasaran, kwargs=kw, daemon=True).start()
                b = json.dumps({'jid': jid,
                                'pesan': f'{len(semua)} berkas diterima, sedang dikerjakan'}).encode()
                self.send_response(200)
            self.send_header('Content-Type','application/json')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path not in ('/impor', '/serupa', '/buat', '/jawab', '/rangkum', '/manual'): return self.send_error(404)
        panjang = int(self.headers.get('Content-Length') or 0)
        mentah = self.rfile.read(panjang) if panjang else b''
        jenis = self.headers.get('Content-Type', '')
        medan, berkas, semua_berkas = {}, None, []
        if jenis.startswith('multipart/form-data'):
            batas = jenis.split('boundary=')[-1].strip('"').encode()
            for bagian in mentah.split(b'--' + batas):
                if b'\r\n\r\n' not in bagian: continue
                kepala, _, isi = bagian.partition(b'\r\n\r\n')
                isi = isi.rstrip(b'\r\n-')
                mn = re.search(rb'name="([^"]+)"', kepala)
                if not mn: continue
                nama = mn.group(1).decode()
                if b'filename="' in kepala:
                    fn = re.search(rb'filename="([^"]*)"', kepala).group(1).decode()
                    if fn and isi:
                        berkas = (fn, isi); semua_berkas.append((fn, isi))
                else:
                    medan[nama] = isi.decode('utf-8', 'replace')
        else:
            for k, v in urllib.parse.parse_qs(mentah.decode('utf-8','replace')).items():
                medan[k] = v[0]

        import gemini_impor, tempfile, time
        if u.path == '/buat': return self.mulai_buat(medan, semua_berkas)
        if u.path == '/manual': return self.mulai_manual(medan)
        if u.path == '/jawab': return self.mulai_jawab(medan, semua_berkas)
        if u.path == '/rangkum': return self.mulai_rangkum(medan, semua_berkas)
        if u.path == '/serupa': return self.olah_serupa(medan, berkas)
        if berkas:
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
                f.write(berkas[1]); jalur = f.name
            try: soal, catatan = gemini_impor.dari_pdf(jalur)
            finally: os.unlink(jalur)
            asal = berkas[0]
        else:
            soal, catatan = gemini_impor.urai(medan.get('teks',''))
            asal = 'tempelan'
        if not soal:
            return self.balas_teks('Tidak ada soal yang bisa diurai. Periksa formatnya, '
                                   'atau kirim naskahnya ke AI lokal untuk dirapikan dulu.', 422)

        judul = (medan.get('judul') or '').strip() or f'Impor Gemini {time.strftime("%d %b %H:%M")}'
        c = db()
        rel = f'IMPOR/{int(time.time())}-{re.sub(chr(92)+"W+","-",judul)[:40]}'
        cur = c.execute("""INSERT INTO dokumen(rel,nama,folder,mapel,kelas,jenis,n_hal,n_hal_teks)
                           VALUES(?,?,'IMPOR',?,?,'Impor Gemini',1,1)""",
                        (rel, judul, (medan.get('mapel') or '').strip() or None,
                         int(medan['kelas']) if (medan.get('kelas') or '').strip().isdigit() else None))
        dok = cur.lastrowid
        ids = []
        for i, s_ in enumerate(soal, 1):
            cc = c.execute("""INSERT INTO soal(dok_id,no_hal,no_soal,batang,opsi,n_opsi,sidik,mutu,dup)
                              VALUES(?,1,?,?,?,?,NULL,?,0)""",
                           (dok, s_['no'] or i, s_['batang'],
                            json.dumps(s_['opsi'], ensure_ascii=False), len(s_['opsi']),
                            2 if len(s_['opsi']) >= 3 else 1))
            ids.append(cc.lastrowid)
        c.executemany("INSERT INTO soal_fts(batang,opsi,soal_id) SELECT batang,opsi,id FROM soal WHERE id=?",
                      [(i,) for i in ids])
        c.commit(); c.close()
        tuju = ('/lembar?' + '&'.join(f'id={i}' for i in ids)
                + '&judul=' + urllib.parse.quote(judul) + '&kunci=1')
        self.send_response(303); self.send_header('Location', tuju); self.end_headers()

    def mulai_buat(self, medan, berkas):
        import buat, threading, uuid, setelan, titipan
        k = (medan.get('titip') or '').strip()
        if k:
            d = titipan.ambil(k)
            if d: berkas = list(d['berkas']) + list(berkas or [])
        setelan.simpan(medan)          # apa pun yang dipakai sekarang jadi bawaan berikutnya
        jid = uuid.uuid4().hex[:12]
        buat.TUGAS[jid] = {'langkah': ['Mulai…'], 'maju': 3, 'selesai': False}
        kelas = medan.get('kelas', '').strip()
        t = threading.Thread(target=buat.jalankan, kwargs=dict(
            jid=jid, gambar=berkas, instruksi=medan.get('instruksi', ''),
            jumlah=medan.get('jumlah', ''), mapel=(medan.get('mapel') or '').strip() or None,
            kelas=int(kelas) if kelas.isdigit() else None,
            judul=medan.get('judul', ''), api=os.environ.get('EXACT_API'),
            topik=medan.get('topik', ''), jenjang=medan.get('jenjang', ''),
            n_set=medan.get('n_set', ''), sulit=medan.get('sulit', ''),
            bahasa=medan.get('bahasa', 'Indonesia'),
            lembaga=medan.get('lembaga', ''), sekolah=medan.get('sekolah', ''),
            tanggal=medan.get('tanggal', ''),
            kunci='kunci' in medan, pembahasan='pembahasan' in medan,
            kolom=medan.get('kolom', '2'), dua_berkas='dua_berkas' in medan,
            kerapatan=medan.get('kerapatan', 'Normal'), garis=medan.get('garis', '1.5'),
            diagram=medan.get('diagram', ''),
            mata=medan.get('mata') or 'gemini',
            mode=medan.get('mode') or 'flash',
            mesin=medan.get('mesin') or 'gemini',
            kode=buat.kode_dari_medan(medan)), daemon=True)
        t.start()
        b = json.dumps({'jid': jid}).encode()
        self.send_response(200); self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(b))); self.end_headers()
        self.wfile.write(b)

    def mulai_manual(self, medan):
        """Naskah tempelan -> PDF. Tanpa AI, tapi tetap lewat antrean karena
        perenderannya memakai Chrome kendali yang sama."""
        import buat, threading, uuid, setelan
        try: setelan.simpan(medan)
        except Exception: pass
        jid = uuid.uuid4().hex[:12]
        buat.TUGAS[jid] = {'langkah': ['Mulai…'], 'maju': 3, 'selesai': False}
        kls = (medan.get('kelas') or '').strip()
        threading.Thread(target=buat.jalankan_manual, kwargs=dict(
            jid=jid, naskah_teks=medan.get('naskah', ''),
            judul=medan.get('judul', ''), topik=medan.get('topik', ''),
            mapel=(medan.get('mapel') or '').strip() or None,
            kelas=int(kls) if kls.isdigit() else None,
            jenjang=medan.get('jenjang', ''),
            lembaga=medan.get('lembaga', ''), sekolah=medan.get('sekolah', ''),
            tanggal=medan.get('tanggal', ''),
            kunci='kunci' in medan, pembahasan='pembahasan' in medan,
            kolom=medan.get('kolom', '2'), dua_berkas='dua_berkas' in medan,
            kerapatan=medan.get('kerapatan', 'Normal'), garis=medan.get('garis', '1.5'),
            diagram=medan.get('diagram', ''),
            ke_practice='ke_practice' in medan,
            kode=buat.kode_dari_medan(medan),
            set_ke=(medan.get('set') or '').strip(),
            jenis=(medan.get('jenis') or 'soal').strip()), daemon=True).start()
        b = json.dumps({'jid': jid}).encode()
        self.send_response(200); self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(b))); self.end_headers()
        self.wfile.write(b)

    def mulai_rangkum(self, medan, berkas):
        import buat, threading, uuid, setelan, titipan
        k = (medan.get('titip') or '').strip()
        if k:
            d = titipan.ambil(k)
            if d: berkas = list(d['berkas']) + list(berkas or [])
        try: setelan.simpan(medan)
        except Exception: pass
        jid = uuid.uuid4().hex[:12]
        buat.TUGAS[jid] = {'langkah': ['Mulai…'], 'maju': 3, 'selesai': False}
        kls = (medan.get('kelas') or '').strip()
        st = setelan.muat()
        threading.Thread(target=buat.jalankan_rangkum, kwargs=dict(
            jid=jid, gambar=berkas, instruksi=medan.get('instruksi',''),
            mapel=(medan.get('mapel') or '').strip() or None,
            kelas=int(kls) if kls.isdigit() else None, judul=medan.get('judul',''),
            topik=medan.get('topik',''), bahasa=medan.get('bahasa','Indonesia'),
            lembaga=st.get('lembaga',''), sekolah=st.get('sekolah',''), tanggal='',
            bagian=medan.get('bagian','5'),
            mata=medan.get('mata') or 'gemini',
            mode=medan.get('mode') or 'flash',
            mesin=medan.get('mesin') or 'gemini',
            kode=buat.kode_dari_medan(medan)), daemon=True).start()
        b = json.dumps({'jid': jid}).encode()
        self.send_response(200); self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(b))); self.end_headers()
        self.wfile.write(b)

    def mulai_jawab(self, medan, berkas):
        import buat, threading, uuid, setelan, titipan
        k = (medan.get('titip') or '').strip()
        if k:
            d = titipan.ambil(k)
            if d: berkas = list(d['berkas']) + list(berkas or [])
        try: setelan.simpan(medan)
        except Exception: pass
        jid = uuid.uuid4().hex[:12]
        buat.TUGAS[jid] = {'langkah': ['Mulai…'], 'maju': 3, 'selesai': False}
        kls = (medan.get('kelas') or '').strip()
        st = setelan.muat()
        threading.Thread(target=buat.jalankan_jawab, kwargs=dict(
            jid=jid, gambar=berkas, instruksi=medan.get('instruksi',''),
            mapel=(medan.get('mapel') or '').strip() or None,
            kelas=int(kls) if kls.isdigit() else None, judul=medan.get('judul',''),
            bahasa=medan.get('bahasa','Indonesia'), lembaga=st.get('lembaga',''),
            sekolah=st.get('sekolah',''), tanggal='',
            kolom=medan.get('kolom','1'),
            mata=medan.get('mata') or 'gemini',
            mode=medan.get('mode') or 'flash',
            mesin=medan.get('mesin') or 'gemini',
            kode=buat.kode_dari_medan(medan)), daemon=True).start()
        b = json.dumps({'jid': jid}).encode()
        self.send_response(200); self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(b))); self.end_headers()
        self.wfile.write(b)

    def olah_serupa(self, medan, berkas):
        import serupa, tempfile, time
        if not berkas: return self.balas_teks('Tidak ada berkas yang diunggah.', 400)
        ext = os.path.splitext(berkas[0])[1] or '.png'
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            f.write(berkas[1]); jalur = f.name
        alat = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ocr-mac', 'visionocr')
        try:
            acuan = serupa.baca_gambar(jalur, alat)
        finally:
            os.unlink(jalur)
        if not acuan.strip():
            return self.balas_teks('Tidak ada teks yang terbaca dari berkas itu. '
                                   'Coba foto yang lebih tajam atau tangkapan layar.', 422)
        kunci = serupa.kunci_cari(acuan)
        mirip = []
        if kunci:
            c = db()
            m = ' OR '.join(kunci)
            try:
                mirip = c.execute("""SELECT s.id, s.batang, s.opsi, d.nama, d.mapel, d.kelas
                                     FROM soal_fts f JOIN soal s ON s.id=f.soal_id
                                     JOIN dokumen d ON d.id=s.dok_id
                                     WHERE soal_fts MATCH ? AND s.dup=0 AND s.mutu=2
                                     ORDER BY rank LIMIT 6""", (m,)).fetchall()
            except sqlite3.OperationalError:
                mirip = []
            c.close()
        n = int(medan.get('n') or 10)
        bahasa = medan.get('bahasa') or 'Indonesia'
        perintah = serupa.bangun_perintah(acuan, mirip, n, bahasa)
        pokok = next((k for k in kunci if len(k) > 4), 'Soal')
        judul = f"Latihan {pokok.title()} {time.strftime('%d %b')}"
        b = serupa.halaman_kerja(acuan, mirip, perintah, judul, n, bahasa).encode()
        self.send_response(200)
        self.send_header('Content-Type','text/html; charset=utf-8')
        self.send_header('Content-Length',str(len(b))); self.end_headers()
        self.wfile.write(b)

    def balas_teks(self, pesan, kode=200):
        b = f'<meta charset=utf-8><body style="font:15px system-ui;padding:40px">{html.escape(pesan)}<p><a href="/impor">kembali</a>'.encode()
        self.send_response(kode); self.send_header('Content-Type','text/html; charset=utf-8')
        self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)

HAL_IMPOR = """<!doctype html><meta charset=utf-8><title>Impor dari Gemini</title>
<meta name=viewport content="width=device-width,initial-scale=1">
<style>
:root{--bg:#fbfbfa;--kartu:#fff;--tepi:#e3e3e0;--teks:#1a1a19;--redup:#6b6b66;--aksen:#c4572a}
@media(prefers-color-scheme:dark){:root{--bg:#1a1a19;--kartu:#232322;--tepi:#37372f;--teks:#f0efea;--redup:#9a9a92}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--teks);
font:15px/1.55 ui-sans-serif,-apple-system,"Segoe UI",sans-serif}
.b{max-width:860px;margin:0 auto;padding:28px 18px 60px}
h1{font-size:20px;margin:0 0 4px}.s{color:var(--redup);font-size:13px;margin-bottom:20px}
textarea{width:100%;min-height:230px;padding:12px;border:1px solid var(--tepi);border-radius:10px;
background:var(--kartu);color:var(--teks);font:13px/1.5 ui-monospace,Menlo,monospace;resize:vertical}
.r{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px;align-items:center}
input[type=text]{padding:9px 12px;border:1px solid var(--tepi);border-radius:8px;
background:var(--kartu);color:var(--teks);font-size:13px}
input[type=text].l{flex:1;min-width:200px}
button{padding:10px 20px;border:0;border-radius:8px;background:var(--aksen);color:#fff;
font-weight:600;font-size:14px;cursor:pointer}
.j{border:2px dashed var(--tepi);border-radius:11px;padding:22px;text-align:center;
color:var(--redup);font-size:13px;margin-top:14px;background:var(--kartu)}
.j.aktif{border-color:var(--aksen);color:var(--aksen)}
a{color:var(--redup);font-size:13px}
</style>
<div class=b>
<h1>Impor soal dari Gemini</h1>
<div class=s>Tempel keluaran Gemini, atau jatuhkan berkas PDF hasil ekspornya.
Soal akan diurai, masuk ke bank soal, lalu langsung jadi lembar kerja.</div>
<form method=post action="/impor" enctype="multipart/form-data" id=f>
<textarea name=teks placeholder="Tempel di sini...

Contoh yang dikenali:
Q1: Apa ibu kota Indonesia?
a) Bandung
b) Jakarta

atau  1.  /  PG1.  /  Soal 1"></textarea>
<div class=j id=j>jatuhkan PDF di sini &mdash; atau klik untuk memilih
<input type=file name=berkas accept=".pdf" id=file hidden></div>
<div class=r>
  <input type=text name=judul class=l placeholder="judul (mis. Latihan Aljabar Kelas 8)">
  <input type=text name=mapel placeholder="mapel" size=12>
  <input type=text name=kelas placeholder="kelas" size=6>
  <button type=submit>Urai &amp; Buat Lembar</button>
</div>
</form>
<div class=r><a href="/?mode=soal">&larr; kembali ke pencarian</a></div>
</div>
<script>
const j=document.getElementById('j'),fi=document.getElementById('file');
j.onclick=()=>fi.click();
fi.onchange=()=>{if(fi.files[0]){j.textContent=fi.files[0].name;j.classList.add('aktif');}};
['dragenter','dragover'].forEach(e=>j.addEventListener(e,ev=>{ev.preventDefault();j.classList.add('aktif')}));
['dragleave','drop'].forEach(e=>j.addEventListener(e,ev=>{ev.preventDefault();j.classList.remove('aktif')}));
j.addEventListener('drop',ev=>{fi.files=ev.dataTransfer.files;
 if(fi.files[0]){j.textContent=fi.files[0].name;j.classList.add('aktif')}});
</script>"""

KERANGKA = """<!doctype html><meta charset=utf-8><title>Exact Worksheet</title>
<meta name=viewport content="width=device-width,initial-scale=1">
<style>
:root{--bg:#fbfbfa;--kartu:#fff;--tepi:#e3e3e0;--teks:#1a1a19;--redup:#6b6b66;--aksen:#c4572a}
@media(prefers-color-scheme:dark){:root{--bg:#1a1a19;--kartu:#232322;--tepi:#37372f;--teks:#f0efea;--redup:#9a9a92}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--teks);
font:15px/1.5 ui-sans-serif,-apple-system,"Segoe UI",sans-serif}
header{display:flex;align-items:center;gap:8px;padding:9px 14px;
background:var(--kartu);border-bottom:1px solid var(--tepi);
position:sticky;top:0;z-index:20}
header .logo{height:30px;width:auto}
header .merek{display:flex;flex-direction:column;line-height:1.15;margin-right:10px}
header .merek b{font-size:14px;letter-spacing:.2px}
header .merek span{font-size:10.5px;color:var(--redup);letter-spacing:.4px;
text-transform:uppercase}
nav{display:flex;gap:6px;flex-wrap:wrap}
nav button{padding:7px 14px;border:1px solid var(--tepi);border-radius:8px;
background:var(--bg);color:var(--redup);font-size:12.5px;cursor:pointer;font-weight:600}
nav button.aktif{background:var(--aksen);color:#fff;border-color:var(--aksen)}
/* Tinggi bingkai mengikuti isinya, bukan dipatok setinggi layar: gulir di
   DALAM iframe tidak andal di peramban ponsel, sehingga tombol di bagian bawah
   formulir tidak pernah terjangkau. Dengan tinggi mengikuti isi, yang menggulir
   adalah halaman luar — dan itu selalu bekerja. */
iframe{border:0;width:100%;min-height:calc(100vh - 47px);display:block;background:var(--bg)}
</style>
<header>
  <img src="/statik/logo.png" alt="" class=logo>
  <div class=merek><b>Exact Course</b><span>Worksheet Maker</span></div>
  <nav>
    <button data-u="/manual" class=aktif>Naskah Manual</button>
    <button data-u="/buat">Buat Soal</button>
    <button data-u="/jawab">Kunci Jawaban</button>
    <button data-u="/rangkum">Rangkuman</button>
    <button data-u="/hasil">Hasil &amp; Cetak</button>
  </nav>
</header>
<iframe id=bingkai src="/manual"></iframe>
<script>
const bingkai = document.getElementById('bingkai');

// Samakan tinggi bingkai dengan tinggi isinya (sama-asal, jadi boleh dibaca).
function samakanTinggi() {
  try {
    const d = bingkai.contentDocument;
    if (!d || !d.body) return;
    const t = Math.max(d.body.scrollHeight, d.documentElement.scrollHeight);
    if (t > 0) bingkai.style.height = (t + 4) + 'px';
  } catch (e) { /* halaman beda asal: biarkan tinggi bawaan */ }
}
bingkai.addEventListener('load', () => {
  samakanTinggi();
  try {
    const d = bingkai.contentDocument;
    new ResizeObserver(samakanTinggi).observe(d.body);
  } catch (e) { setInterval(samakanTinggi, 1000); }
});
setInterval(samakanTinggi, 1500);

document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.remove('aktif'));
  b.classList.add('aktif');
  bingkai.style.height = '';
  bingkai.src = b.dataset.u;
  window.scrollTo(0, 0);
});
</script>"""


if __name__ == '__main__':
    print(f"Mesin pencari jalan di  http://localhost:{PORT}")
    pastikan_kolom()
    # WAJIB berutas banyak: rute /lembar.pdf memanggil Chrome yang lalu
    # meminta /lembar ke server ini juga. Server satu utas membeku.
    # Bawaannya hanya melayani Mac ini. Untuk membukanya ke tablet/HP di
    # jaringan yang sama, jalankan dengan EXACT_LAN=1 — atau EXACT_LAN=<alamat>
    # untuk mengikat ke satu antarmuka saja, misalnya alamat Tailscale.
    # Python menyalakan SO_REUSEADDR, sehingga BEBERAPA proses bisa mengikat
    # port yang sama tanpa galat — permintaan lalu tersebar acak di antaranya.
    # Kalau salah satunya memakai kode lama, gejalanya membingungkan: halaman
    # kadang benar kadang kosong. Jadi: satu saja.
    try:
        import urllib.request as _u
        _u.urlopen(f'http://127.0.0.1:{PORT}/status', timeout=2).read(1)
        print(f'Sudah ada server di port {PORT}. Berhenti agar tidak bentrok.', flush=True)
        raise SystemExit(0)
    except SystemExit:
        raise
    except Exception:
        pass

    lan = os.environ.get('EXACT_LAN', '')
    ikat = '0.0.0.0' if lan in ('1', 'ya', 'true') else (lan or '127.0.0.1')
    if ikat != '127.0.0.1':
        print(f'  PERHATIAN: dapat diakses dari jaringan ({ikat}:{PORT}).', flush=True)
    ThreadingHTTPServer((ikat, PORT), H).serve_forever()
