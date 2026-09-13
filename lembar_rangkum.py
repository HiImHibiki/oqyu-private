#!/usr/bin/env python3
"""Lembar rangkuman siap cetak — untuk dibaca ulang menjelang ujian.

Bedanya dengan lembar pembahasan: di sini tidak ada soal, dan mata pembaca
tidak membaca lurus dari atas ke bawah melainkan melompat mencari satu hal.
Karena itu rumus, contoh, dan hal yang mudah keliru masing-masing diberi
kotak sendiri yang bisa dikenali sekilas, bukan dibiarkan menyatu jadi teks.
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
@page{size:A4;margin:15mm 14mm}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#14140f;
 font:11.5pt/1.7 "Times New Roman",Georgia,serif}
.bar{position:sticky;top:0;background:#1c1c1b;color:#fff;padding:10px 16px;
 display:flex;gap:12px;align-items:center;font:13px ui-sans-serif,-apple-system,sans-serif}
.bar button{background:#c4572a;color:#fff;border:0;border-radius:7px;padding:9px 18px;
 font-size:13px;font-weight:600;cursor:pointer}
.lembar{max-width:190mm;margin:0 auto;padding:10mm 4mm 20mm}
.kop{display:flex;align-items:center;gap:14px;border-bottom:2.5px solid #14140f;
 padding-bottom:10px;margin-bottom:14px}
.kop img{height:42px}
.kop h1{margin:0;font-size:16pt;letter-spacing:.2px}
.kop .sub{font-size:10pt;color:#6b6b62;margin-top:3px;
 font-family:ui-sans-serif,-apple-system,sans-serif}

.inti{background:#faf7f2;border-left:4px solid #c4572a;padding:12px 15px;
 margin-bottom:24px;font-size:11.5pt;line-height:1.75}
.inti b{display:block;font:600 9pt ui-sans-serif,-apple-system,sans-serif;
 letter-spacing:1.1px;text-transform:uppercase;color:#c4572a;margin-bottom:5px}

/* Bagian boleh terbelah antar halaman: melarangnya membuat satu bagian pendek
   pun melompat utuh ke halaman berikut, dan empat bagian memakan tiga halaman.
   Yang benar-benar tidak boleh terbelah hanya kotak rumus/contoh dan judul yang
   terpisah dari isinya. */
.bagian{margin-bottom:24px}
.bagian h2{break-after:avoid}
.kotak{break-inside:avoid}
.poin li{break-inside:avoid}
.bagian h2{font-size:12.5pt;margin:0 0 9px;padding-bottom:5px;
 border-bottom:1.5px solid #14140f;display:flex;align-items:baseline;gap:9px}
.bagian h2 .no{font:600 9pt ui-sans-serif,-apple-system,sans-serif;color:#fff;
 background:#c4572a;border-radius:50%;width:19px;height:19px;flex:none;
 display:inline-flex;align-items:center;justify-content:center}
.poin{margin:0 0 11px;padding-left:19px}
.poin li{margin-bottom:5px}

.kotak{border:1px solid #e0e0d8;border-radius:8px;padding:10px 13px;margin-bottom:10px}
.kotak .cap{font:600 8.5pt ui-sans-serif,-apple-system,sans-serif;letter-spacing:1.1px;
 text-transform:uppercase;color:#8a8a80;margin-bottom:6px}
.rumus{background:#fbfbf8}
.rumus ul{margin:0;padding-left:17px}
.rumus li{margin-bottom:5px}
.contoh{background:#f7faf7;border-color:#d8e6d8}
.contoh .cap{color:#3f7a4a}
.ingat{background:#fdf7f2;border-color:#eddcc9}
.ingat .cap{color:#b0651f}

.kaki{margin-top:26px;border-top:1px solid #d8d8cf;padding-top:7px;
 font-size:9pt;color:#8a8a80;display:flex;justify-content:space-between;
 font-family:ui-sans-serif,-apple-system,sans-serif}
@media print{.bar{display:none}.lembar{max-width:none;padding:0}}
"""


def buat(judul, inti, bagian, kop=None):
    kop = kop or {}
    sub = ' · '.join(x for x in (kop.get('lembaga') or 'Exact Course',
                                 kop.get('mapel'), kop.get('kelas')) if x)
    isi = ''
    for i, b in enumerate(bagian, 1):
        blok = f'<h2><span class=no>{i}</span>{_rumus(b["nama"])}</h2>'
        if b['poin']:
            blok += '<ul class=poin>' + ''.join(
                f'<li>{_rumus(x)}</li>' for x in b['poin']) + '</ul>'
        if b['rumus']:
            blok += ('<div class="kotak rumus"><div class=cap>Rumus</div><ul>'
                     + ''.join(f'<li>{_rumus(x)}</li>' for x in b['rumus'])
                     + '</ul></div>')
        if b['contoh']:
            blok += (f'<div class="kotak contoh"><div class=cap>Contoh</div>'
                     f'{_rumus(b["contoh"])}</div>')
        if b['ingat']:
            blok += (f'<div class="kotak ingat"><div class=cap>Mudah keliru</div>'
                     f'{_rumus(b["ingat"])}</div>')
        isi += f'<div class=bagian>{blok}</div>'

    blok_inti = (f'<div class=inti><b>Inti materi</b>{_rumus(inti)}</div>'
                 if inti else '')
    return f"""<!doctype html><meta charset=utf-8><title>{html.escape(judul or 'Rangkuman')}</title>
<meta name=viewport content="width=device-width,initial-scale=1">
<link rel=stylesheet href="/statik/katex/katex.min.css">
<style>{GAYA}</style>
<div class="bar no-print"><button onclick="window.print()">Cetak</button>
<span>{len(bagian)} bagian · lembar rangkuman</span></div>
<div class=lembar>
  <div class=kop><img src="/statik/logo.png" alt=""><div>
    <h1>{html.escape(judul or 'Rangkuman')}</h1>
    <div class=sub>{html.escape(sub)}</div></div></div>
  {blok_inti}
  {isi}
  <div class=kaki><span>{html.escape(kop.get('lembaga') or 'Exact Course')}</span>
  <span>{len(bagian)} bagian</span></div>
</div>
<script src="/statik/katex/katex.min.js"></script>
<script src="/statik/katex/auto-render.min.js"></script>
<script>renderMathInElement(document.body,{{delimiters:[
 {{left:'$',right:'$',display:false}}],throwOnError:false}});</script>"""
