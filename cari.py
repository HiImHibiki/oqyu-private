#!/usr/bin/env python3
"""Mesin pencari lokal untuk arsip EXACT COURSE."""
import os, re, sqlite3, json, html, urllib.parse, mimetypes, subprocess
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

DB   = os.path.expanduser('~/ExactSearch/exact.db')
AKAR = os.path.expanduser('~/Documents/EXACT COURSE')
PORT = 7790

def db():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row; return c

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
<form><div class=baris>
<input type=search name=q placeholder="cari apa saja — mis. listrik dinamis, trigonometri, photosynthesis" value="__Q__" autofocus>
<button>Cari</button></div>
<div class=baris style="margin-top:8px">__FILTER__</div></form>
__HASIL__
</div>"""

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); qs = urllib.parse.parse_qs(u.query)
        if u.path == '/buat':
            import buat
            b = buat.halaman().encode()
            self.send_response(200)
            self.send_header('Content-Type','text/html; charset=utf-8')
            self.send_header('Content-Length',str(len(b))); self.end_headers()
            self.wfile.write(b); return

        if u.path == '/susun':
            # Susun lembar dari soal yang SUDAH ada di bank — tanpa Gemini,
            # tanpa AI. Inilah gunanya menyimpan soal hasil generate.
            import naskah as _nsk, buat as _b, otomasi as _o, time as _t
            ids = [int(x) for x in qs.get('id', []) if x.isdigit()][:120]
            if not ids: return self.send_error(400, 'tidak ada soal dipilih')
            judul = (qs.get('judul') or ['Latihan'])[0]
            c = db(); tanda = ','.join('?' * len(ids))
            rows = c.execute(f"""SELECT s.batang, s.opsi, s.kunci, s.bobot, s.jenis_soal,
                                       s.n_opsi, d.mapel, d.kelas
                                FROM soal s JOIN dokumen d ON d.id=s.dok_id
                                WHERE s.id IN ({tanda})""", ids).fetchall()
            c.close()
            butir = []
            for r in rows:
                jenis = r['jenis_soal'] or ('PG' if (r['n_opsi'] or 0) >= 3 else 'E')
                butir.append({'jenis': jenis, 'batang': r['batang'],
                              'opsi': json.loads(r['opsi'] or '{}'),
                              'kunci': r['kunci'] or '', 'bobot': r['bobot'], 'sub': []})
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
                kolom=st.get('kolom','2'), dua_berkas=st.get('dua_berkas', False)),
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
            b = json.dumps(d).encode()
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
        q = (qs.get('q') or [''])[0]
        mode = (qs.get('mode') or ['halaman'])[0]
        filt = {k:(qs.get(k) or [''])[0] for k in ('folder','jenjang','mapel','jenis','kelas','sekolah','bentuk')}
        c = db()
        nd, nh = c.execute("SELECT COUNT(*), SUM(n_hal_teks) FROM dokumen WHERE n_hal_teks>0 AND dup_dari IS NULL").fetchone()
        c.close()
        fil = ''
        for k, lbl in (('mapel','semua mapel'),('jenjang','semua jenjang'),('kelas','semua kelas'),
                       ('jenis','semua jenis'),('sekolah','semua sekolah'),('folder','semua folder')):
            o = ''.join(f'<option{" selected" if filt[k]==v else ""}>{html.escape(str(v))}</option>' for v in opsi(k))
            fil += f'<select name={k}><option value="">{lbl}</option>{o}</select>'
        c = db()
        ns = c.execute("SELECT COUNT(*) FROM soal WHERE dup=0").fetchone()[0]; c.close()
        sel = lambda v: ' class=aktif' if mode == v else ''
        tab = (f'<div class=tab><a href="?mode=halaman&q={urllib.parse.quote(q)}"{sel("halaman")}>Halaman</a>'
               f'<a href="?mode=soal&q={urllib.parse.quote(q)}"{sel("soal")}>Soal satuan ({ns:,})</a>'
               f'<a href="/buat" style="margin-left:auto">Worksheet Maker</a>'
               f'<a href="/serupa">Foto &rarr; Serupa</a>'
               f'<a href="/impor">Impor Gemini</a></div>')
        fil = f'<input type=hidden name=mode value="{html.escape(mode)}">' + fil
        if mode == 'soal':
            b2 = ''.join(f'<option{" selected" if filt["bentuk"]==v else ""}>{v}</option>' for v in ('Pilihan ganda','Uraian'))
            fil += f'<select name=bentuk><option value="">semua bentuk</option>{b2}</select>'
        badan = ''
        if q and mode == 'soal':
            rows, n = cari_soal(q, filt)
            badan = ('<form action="/susun" method=get id=fLembar>'
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
        u = urllib.parse.urlparse(self.path)
        print(f'[POST] {u.path} dari {self.client_address[0]} '
              f'({self.headers.get("Content-Length","?")} byte)', flush=True)
        if u.path not in ('/impor', '/serupa', '/buat'): return self.send_error(404)
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
        import buat, threading, uuid, setelan
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
            kolom=medan.get('kolom', '2'), dua_berkas='dua_berkas' in medan), daemon=True)
        t.start()
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

if __name__ == '__main__':
    print(f"Mesin pencari jalan di  http://localhost:{PORT}")
    # WAJIB berutas banyak: rute /lembar.pdf memanggil Chrome yang lalu
    # meminta /lembar ke server ini juga. Server satu utas membeku.
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
