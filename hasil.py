#!/usr/bin/env python3
"""Tab Hasil: pratinjau lembar jadi, pilih halaman, cetak ke printer Mac.

Dirancang untuk dibuka dari tablet — kartu besar, sasaran sentuh lebar, dan
gambar halaman dikecilkan lebih dulu supaya ringan di jaringan.
"""
import os, re, html, subprocess, glob, time

AKAR = os.path.dirname(os.path.abspath(__file__))
THUMB = os.path.join(AKAR, 'thumb')

def folder_keluar():
    import buat
    return buat.KELUAR

def daftar_pdf(batas=60):
    p = sorted(glob.glob(os.path.join(folder_keluar(), '*.pdf')),
               key=os.path.getmtime, reverse=True)
    return p[:batas]

def n_halaman(path):
    try:
        r = subprocess.run(['pdfinfo', path], capture_output=True, timeout=30)
        m = re.search(rb'Pages:\s*(\d+)', r.stdout)
        return int(m.group(1)) if m else 0
    except Exception:
        return 0

def thumb(path, hal, lebar=300):
    """Kembalikan jalur PNG halaman ke-`hal`, dibuat sekali lalu disimpan."""
    os.makedirs(THUMB, exist_ok=True)
    cap = int(os.path.getmtime(path))
    kunci = re.sub(r'\W+', '_', os.path.basename(path))[:60]
    keluar = os.path.join(THUMB, f'{kunci}-{cap}-{hal}-{lebar}.png')
    if os.path.isfile(keluar):
        return keluar
    dasar = keluar[:-4]
    subprocess.run(['pdftoppm', '-png', '-scale-to-x', str(lebar), '-scale-to-y', '-1',
                    '-f', str(hal), '-l', str(hal), path, dasar],
                   capture_output=True, timeout=120)
    for k in (f'{dasar}-{hal}.png', f'{dasar}-{hal:02d}.png', f'{dasar}-{hal:03d}.png'):
        if os.path.isfile(k):
            os.replace(k, keluar); break
    return keluar if os.path.isfile(keluar) else None

def printer():
    """(daftar_printer, bawaan)"""
    daftar = []
    try:
        r = subprocess.run(['lpstat', '-p'], capture_output=True, timeout=15)
        daftar = re.findall(r'printer (\S+)', r.stdout.decode('utf-8', 'replace'))
    except Exception:
        pass
    bawaan = ''
    try:
        r = subprocess.run(['lpstat', '-d'], capture_output=True, timeout=15)
        m = re.search(r':\s*(\S+)', r.stdout.decode('utf-8', 'replace'))
        bawaan = m.group(1) if m else ''
    except Exception:
        pass
    return daftar, bawaan

def cetak(path, halaman, nama_printer='', salinan=1, lewat_gambar=True, dpi=300,
          bolak_balik='otomatis', sisi='semua'):
    """Cetak halaman terpilih.

    `lewat_gambar` (bawaan) mengubah tiap halaman jadi JPEG abu-abu lebih dulu,
    lalu mengirim gambarnya. Printer monokrom sering tersendat menafsirkan PDF
    langsung dari macOS — rumus, bayangan, dan SVG diagram adalah pemicu yang
    umum. Gambar tidak menyisakan apa pun untuk ditafsirkan printer.

    Semua gambar dikirim dalam SATU pekerjaan lp, jadi urutannya terjaga dan
    tidak muncul sebagai belasan pekerjaan terpisah di antrean.

    `bolak_balik`:
      'otomatis' — kirim sides=two-sided-long-edge; berhasil hanya bila
                   printernya memang punya duplex otomatis
      'manual'   — dicetak dua tahap; `sisi` memilih 'ganjil' lalu 'genap'
      'tidak'    — satu sisi saja
    """
    import tempfile, shutil, glob as _g
    if not halaman:
        halaman = list(range(1, (n_halaman(path) or 1) + 1))
    halaman = sorted(set(int(h) for h in halaman))

    if bolak_balik == 'manual':
        # Tahap pertama mencetak sisi depan, tahap kedua sisi belakang.
        # Urutan tahap kedua DIBALIK supaya cocok dengan tumpukan yang sudah
        # dibalik penggunanya.
        urut = list(halaman)
        if sisi == 'ganjil':
            halaman = urut[0::2]
        elif sisi == 'genap':
            halaman = urut[1::2][::-1]

    arg = ['lp']
    if nama_printer: arg += ['-d', nama_printer]
    try:
        n = int(salinan)
    except (TypeError, ValueError):
        n = 1
    if n > 1: arg += ['-n', str(n)]
    arg += ['-t', os.path.basename(path)[:60]]

    if bolak_balik == 'otomatis':
        arg += ['-o', 'sides=two-sided-long-edge']

    if not lewat_gambar:
        arg += ['-o', 'page-ranges=' + ','.join(str(h) for h in halaman), path]
        r = subprocess.run(arg, capture_output=True, timeout=120)
        keluar = (r.stdout + r.stderr).decode('utf-8', 'replace').strip()
        if r.returncode != 0: raise RuntimeError(keluar or 'perintah cetak gagal')
        return keluar

    tmp = tempfile.mkdtemp(prefix='cetak-')
    try:
        berkas = []
        for h in halaman:
            dasar = os.path.join(tmp, f'{h:04d}')
            subprocess.run(['pdftoppm', '-jpeg', '-gray', '-r', str(dpi),
                            '-f', str(h), '-l', str(h), path, dasar],
                           capture_output=True, timeout=180)
            cocok = sorted(_g.glob(dasar + '*.jpg'))
            if cocok: berkas.append(cocok[0])
        if not berkas:
            raise RuntimeError('gagal mengubah halaman jadi gambar')
        arg += ['-o', 'fit-to-page', '-o', 'media=A4'] + berkas
        r = subprocess.run(arg, capture_output=True, timeout=300)
        keluar = (r.stdout + r.stderr).decode('utf-8', 'replace').strip()
        if r.returncode != 0: raise RuntimeError(keluar or 'perintah cetak gagal')
        return keluar
    finally:
        # Antrean CUPS menyalin berkasnya sendiri, jadi aman dibersihkan.
        shutil.rmtree(tmp, ignore_errors=True)

GAYA = """
:root{--bg:#fbfbfa;--kartu:#fff;--tepi:#e3e3e0;--teks:#1a1a19;--redup:#6b6b66;--aksen:#c4572a}
@media(prefers-color-scheme:dark){:root{--bg:#1a1a19;--kartu:#232322;--tepi:#37372f;--teks:#f0efea;--redup:#9a9a92}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--teks);
font:15px/1.5 ui-sans-serif,-apple-system,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%}
.b{max-width:1100px;margin:0 auto;padding:18px 16px 120px}
h1{font-size:19px;margin:0 0 3px}.s{color:var(--redup);font-size:13px;margin-bottom:16px}
a{color:var(--aksen);text-decoration:none}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(155px,1fr))}
.kartu{background:var(--kartu);border:1px solid var(--tepi);border-radius:12px;
padding:9px;text-align:center}
.kartu img{width:100%;border-radius:7px;border:1px solid var(--tepi);display:block}
.kartu .n{font-size:11.5px;color:var(--redup);margin-top:6px;word-break:break-word;
line-height:1.35}
.hal{position:relative;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent}
.hal input{position:absolute;opacity:0;pointer-events:none}
.hal img{transition:box-shadow .15s,border-color .15s}
.hal.on img{border-color:var(--aksen);box-shadow:0 0 0 3px var(--aksen)}
.hal .no{position:absolute;top:6px;left:6px;background:rgba(0,0,0,.62);color:#fff;
border-radius:20px;min-width:26px;height:26px;line-height:26px;font-size:12px;font-weight:700}
.hal.on .no{background:var(--aksen)}
.bar{position:fixed;left:0;right:0;bottom:0;background:var(--kartu);
border-top:1px solid var(--tepi);padding:11px 16px;display:flex;gap:9px;
align-items:center;flex-wrap:wrap;z-index:9}
.bar select,.bar input{padding:10px 12px;border:1px solid var(--tepi);border-radius:9px;
background:var(--bg);color:var(--teks);font-size:14px}
.bar button{padding:12px 22px;border:0;border-radius:9px;background:var(--aksen);
color:#fff;font-weight:700;font-size:15px;cursor:pointer}
.bar button.abu{background:var(--tepi);color:var(--teks);font-weight:600;padding:12px 16px}
.bar .info{color:var(--redup);font-size:13px;margin-left:auto}
.kosong{color:var(--redup);padding:40px 0;text-align:center}
</style>"""

def halaman_daftar():
    berkas = daftar_pdf()
    kartu = ''
    for p in berkas:
        nama = os.path.basename(p)
        n = n_halaman(p)
        kartu += (f'<a class=kartu href="/hasil?f={html.escape(nama, quote=True)}">'
                  f'<img src="/thumb?f={html.escape(nama, quote=True)}&p=1&w=300" alt="" loading=lazy>'
                  f'<div class=n>{html.escape(nama[:52])}<br>{n} halaman · '
                  f'{time.strftime("%d %b %H:%M", time.localtime(os.path.getmtime(p)))}</div></a>')
    if not kartu:
        kartu = '<div class=kosong>Belum ada lembar. Buat dulu di tab "Buat dengan AI".</div>'
    return f"""<!doctype html><meta charset=utf-8><title>Hasil</title>
<meta name=viewport content="width=device-width,initial-scale=1"><style>{GAYA}
<div class=b><h1>Lembar yang sudah jadi</h1>
<div class=s>Ketuk salah satu untuk melihat halamannya, memilih, dan mencetak.</div>
<div class=grid>{kartu}</div></div>"""

def halaman_berkas(nama):
    p = os.path.join(folder_keluar(), nama)
    if not os.path.isfile(p): return None
    n = n_halaman(p)
    daftar_p, bawaan = printer()
    try:
        import setelan as _s
        st = _s.muat()
    except Exception:
        st = {}
    if st.get('printer') in daftar_p: bawaan = st['printer']
    bolak_pilih = st.get('bolak') or 'otomatis'
    gambar_pilih = st.get('gambar', True)
    salinan_pilih = st.get('salinan') or '1'
    kartu = ''
    for i in range(1, n + 1):
        kartu += (f'<label class="kartu hal" data-h="{i}">'
                  f'<input type=checkbox name=h value="{i}" checked>'
                  f'<span class=no>{i}</span>'
                  f'<img src="/thumb?f={html.escape(nama, quote=True)}&p={i}&w=300" '
                  f'alt="halaman {i}" loading=lazy></label>')
    opsi = ''.join(f'<option{" selected" if d == bawaan else ""}>{html.escape(d)}</option>'
                   for d in daftar_p) or '<option value="">(tidak ada printer)</option>'
    bl = lambda v: ' selected' if bolak_pilih == v else ''
    return f"""<!doctype html><meta charset=utf-8><title>{html.escape(nama[:40])}</title>
<meta name=viewport content="width=device-width,initial-scale=1"><style>{GAYA}
<div class=b>
<h1>{html.escape(nama[:60])}</h1>
<div class=s><a href="/hasil">&larr; semua lembar</a> &middot; {n} halaman &middot;
ketuk halaman untuk memilih &middot; <a href="/berkas?f={html.escape(nama, quote=True)}"
target=_blank>buka PDF</a></div>
<form id=f method=post action="/cetak">
<input type=hidden name=f value="{html.escape(nama, quote=True)}">
<div class=grid>{kartu}</div>
<div class=bar>
  <button type=button class=abu id=semua>Semua</button>
  <button type=button class=abu id=takada>Kosongkan</button>
  <select name=printer>{opsi}</select>
  <input type=number name=salinan value={html.escape(str(salinan_pilih))} min=1 max=20 style=width:74px title=salinan>
  <select name=bolak title="bolak-balik">
    <option value=otomatis{bl('otomatis')}>bolak-balik otomatis</option>
    <option value=manual{bl('manual')}>bolak-balik 2 tahap</option>
    <option value=tidak{bl('tidak')}>satu sisi</option>
  </select>
  <label style="font-size:12.5px;color:var(--redup);display:flex;gap:6px;align-items:center">
    <input type=checkbox name=gambar{' checked' if gambar_pilih else ''}> lewat gambar</label>
  <button type=submit id=go>Cetak</button>
  <button type=button id=sisi2 class=abu style=display:none>Cetak sisi kedua</button>
  <span class=info id=info></span>
</div>
</form></div>
<script>
const kotak = () => [...document.querySelectorAll('.hal input')];
function segar() {{
  kotak().forEach(k => k.closest('.hal').classList.toggle('on', k.checked));
  const n = kotak().filter(k => k.checked).length;
  document.getElementById('info').textContent = n + ' dari ' + kotak().length + ' halaman';
}}
document.querySelectorAll('.hal').forEach(l => l.addEventListener('click', e => {{
  e.preventDefault();
  const k = l.querySelector('input'); k.checked = !k.checked; segar();
}}));
document.getElementById('semua').onclick = () => {{ kotak().forEach(k => k.checked = true); segar(); }};
document.getElementById('takada').onclick = () => {{ kotak().forEach(k => k.checked = false); segar(); }};
async function kirimCetak(sisi) {{
  const go = document.getElementById('go'), info = document.getElementById('info');
  const s2 = document.getElementById('sisi2');
  const fd = new FormData(document.getElementById('f'));
  if (sisi) fd.set('sisi', sisi);
  go.disabled = true; s2.disabled = true; info.textContent = 'mengirim ke printer…';
  const r = await fetch('/cetak', {{method:'POST', body: fd}});
  const j = await r.json();
  info.textContent = j.pesan || j.galat || 'selesai';
  go.disabled = false; s2.disabled = false;
  const manual = document.querySelector('[name=bolak]').value === 'manual';
  if (manual && sisi !== 'genap' && !j.galat) {{
    s2.style.display = '';
    info.textContent = 'Sisi pertama tercetak. Balik tumpukan kertasnya, '
      + 'lalu tekan "Cetak sisi kedua".';
  }} else {{
    s2.style.display = 'none';
  }}
}}
document.getElementById('sisi2').onclick = () => kirimCetak('genap');
document.getElementById('f').onsubmit = async e => {{
  e.preventDefault();
  const go = document.getElementById('go'), info = document.getElementById('info');
  if (!kotak().some(k => k.checked)) {{ info.textContent = 'pilih dulu halamannya'; return; }}
  go.disabled = true; info.textContent = 'mengirim ke printer…';
  const manual = document.querySelector('[name=bolak]').value === 'manual';
  await kirimCetak(manual ? 'ganjil' : '');
}};
segar();
</script>"""
