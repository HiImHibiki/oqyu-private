#!/usr/bin/env python3
"""Lembar pembahasan siap cetak — dibuat untuk DIBACA, bukan dikerjakan.

Berbeda dari lembar ujian: satu kolom, jarak baris lapang, tiap soal langsung
diikuti jawaban dan pembahasannya, dan tidak ada bagian kunci terpisah di
belakang. Anak membacanya mengalir dari atas ke bawah.
"""
import html, re

def _rumus(t):
    """Biarkan $...$ utuh untuk KaTeX; sisanya di-escape."""
    keping, pos = [], 0
    for m in re.finditer(r'\$[^$\n]{1,400}\$', t or ''):
        keping.append(html.escape(t[pos:m.start()])); keping.append(m.group(0)); pos = m.end()
    keping.append(html.escape((t or '')[pos:]))
    return ''.join(keping)

GAYA = """
@page{size:A4;margin:16mm 15mm}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#14140f;
 font:12pt/1.75 "Times New Roman",Georgia,serif}
.bar{position:sticky;top:0;background:#1c1c1b;color:#fff;padding:10px 16px;
 display:flex;gap:12px;align-items:center;font:13px ui-sans-serif,-apple-system,sans-serif}
.bar button{background:#c4572a;color:#fff;border:0;border-radius:7px;padding:9px 18px;
 font-size:13px;font-weight:600;cursor:pointer}
.lembar{max-width:190mm;margin:0 auto;padding:10mm 4mm 20mm}
.kop{display:flex;align-items:center;gap:14px;border-bottom:2.5px solid #14140f;
 padding-bottom:10px;margin-bottom:6px}
.kop img{height:42px}
.kop h1{margin:0;font-size:16pt;letter-spacing:.2px}
.kop .sub{font-size:10pt;color:#6b6b62;margin-top:3px;
 font-family:ui-sans-serif,-apple-system,sans-serif}
.ident{display:flex;gap:22px;font-size:10pt;color:#6b6b62;margin-bottom:22px;
 font-family:ui-sans-serif,-apple-system,sans-serif}
.ident span{flex:1;border-bottom:1px dotted #aaa;padding-bottom:3px}

.butir{margin-bottom:26px;padding-bottom:22px;border-bottom:1px solid #e6e6df;
 break-inside:auto}
.butir:last-child{border-bottom:0}
.no{display:inline-block;background:#14140f;color:#fff;border-radius:50%;
 width:26px;height:26px;line-height:26px;text-align:center;font-size:11pt;
 font-weight:700;font-family:ui-sans-serif,-apple-system,sans-serif;
 margin-right:8px;vertical-align:2px}
.soal{display:inline;white-space:pre-wrap}
.kotakSoal{background:#faf9f4;border-left:4px solid #c4572a;padding:12px 15px;
 margin-bottom:16px;break-inside:avoid}
.jawab{font-size:12.5pt;margin:0 0 14px;padding:9px 14px;background:#f2f7f2;
 border-left:4px solid #3c7a4a;break-inside:avoid}
.jawab b{font-family:ui-sans-serif,-apple-system,sans-serif;font-size:10pt;
 letter-spacing:.5px;text-transform:uppercase;color:#3c7a4a;margin-right:8px}
.labelBahas{font-family:ui-sans-serif,-apple-system,sans-serif;font-size:10pt;
 letter-spacing:.5px;text-transform:uppercase;color:#6b6b62;margin-bottom:8px}
.bahas p{margin:0 0 13px;text-align:justify}
.bahas p:last-child{margin-bottom:0}
.kaki{margin-top:20px;padding-top:8px;border-top:1px solid #e6e6df;
 font-size:9pt;color:#8a8a80;display:flex;justify-content:space-between;
 font-family:ui-sans-serif,-apple-system,sans-serif}
@media print{.bar{display:none}.lembar{max-width:none;padding:0}}
"""

def buat(judul, butir, kop=None):
    kop = kop or {}
    sub = ' · '.join(x for x in (kop.get('lembaga') or 'Exact Course',
                                 kop.get('mapel'), kop.get('kelas')) if x)
    isi = ''
    for i, b in enumerate(butir, 1):
        alinea = ''.join(f'<p>{_rumus(a)}</p>' for a in b['bahas']) or \
                 '<p>(pembahasan tidak tersedia)</p>'
        jawab = (f'<div class=jawab><b>Jawaban</b>{_rumus(b["jawab"])}</div>'
                 if b.get('jawab') else '')
        isi += (f'<div class=butir>'
                f'<div class=kotakSoal><span class=no>{i}</span>'
                f'<span class=soal>{_rumus(b["soal"])}</span></div>'
                f'{jawab}'
                f'<div class=labelBahas>Pembahasan</div>'
                f'<div class=bahas>{alinea}</div></div>')
    return f"""<!doctype html><meta charset=utf-8><title>{html.escape(judul or 'Pembahasan')}</title>
<meta name=viewport content="width=device-width,initial-scale=1">
<link rel=stylesheet href="/statik/katex/katex.min.css">
<style>{GAYA}</style>
<div class="bar no-print"><button onclick="window.print()">Cetak</button>
<span>{len(butir)} soal · lembar pembahasan</span></div>
<div class=lembar>
  <div class=kop><img src="/statik/logo.png" alt=""><div>
    <h1>{html.escape(judul or 'Pembahasan Soal')}</h1>
    <div class=sub>{html.escape(sub)}</div></div></div>
  <div class=ident><span>Nama :</span><span>Kelas :</span><span>Tanggal :</span></div>
  {isi}
  <div class=kaki><span>{html.escape(kop.get('lembaga') or 'Exact Course')}</span>
  <span>{len(butir)} soal</span></div>
</div>
<script src="/statik/katex/katex.min.js"></script>
<script src="/statik/katex/auto-render.min.js"></script>
<script>renderMathInElement(document.body,{{delimiters:[
 {{left:'$',right:'$',display:false}}],throwOnError:false}});</script>"""
