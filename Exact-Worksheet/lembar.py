#!/usr/bin/env python3
"""Pembuat lembar kerja siap cetak dari soal hasil panen.

Mengikuti format Exact Worksheet Maker: A4, margin 12mm 11mm, blok .sheet
dengan pemisah halaman, kelas .no-print, dan rumus dirender KaTeX.
Cetak lewat peramban (Cmd+P) lalu simpan sebagai PDF.
"""
import html, json, re

GAYA = """
:root{--tinta:#111;--redup:#666;--garis:#d8d8d4}
*{box-sizing:border-box}
body{margin:0;background:#e9e9e6;color:var(--tinta);
 font:12.5px/1.5 "Times New Roman",Georgia,serif}
.bar{position:sticky;top:0;background:#1c1c1b;color:#fff;padding:10px 16px;
 display:flex;gap:12px;align-items:center;font:13px/1.4 ui-sans-serif,-apple-system,sans-serif;z-index:9}
.bar button{background:#c4572a;color:#fff;border:0;border-radius:7px;padding:8px 16px;
 font-size:13px;font-weight:600;cursor:pointer}
.bar a{color:#bbb;text-decoration:none}
.sheet{width:210mm;min-height:297mm;margin:16px auto;background:#fff;
 padding:12mm 11mm;box-shadow:0 2px 14px rgba(0,0,0,.16)}
.kop{display:flex;align-items:center;gap:12px;border-bottom:2px solid var(--tinta);
 padding-bottom:8px;margin-bottom:10px}
.kop img{height:38px}
.kop .t{flex:1}
.kop h1{margin:0;font-size:15px;letter-spacing:.3px;text-transform:uppercase}
.kop .sub{font-size:11px;color:var(--redup);margin-top:2px}
.isian{display:flex;gap:18px;font-size:11.5px;margin-bottom:10px}
.isian span{flex:1;border-bottom:1px dotted #999;padding-bottom:2px}
.arahan{font-size:11.5px;font-style:italic;margin-bottom:10px;padding:6px 9px;
 background:#f4f4f1;border-left:3px solid var(--tinta)}
.kolom{column-gap:9mm;column-rule:1px solid var(--garis)}
.soal{break-inside:avoid;page-break-inside:avoid;margin-bottom:9px;display:flex;gap:6px}
.no{font-weight:700;min-width:17px}
.batang{flex:1;white-space:pre-wrap;word-break:break-word}
.opsi{margin-top:3px;display:grid;gap:1px}
.opsi div{display:flex;gap:5px}
.opsi b{font-weight:600;min-width:14px}
.kaki{margin-top:12px;border-top:1px solid var(--garis);padding-top:5px;
 font-size:9.5px;color:var(--redup);display:flex;justify-content:space-between}
.kunci{font-size:11px}
.kunci td{border-bottom:1px solid var(--garis);padding:3px 5px;vertical-align:top}
.kunci td.n{font-weight:700;width:26px}
@media print{
  .no-print{display:none!important}
  body{background:#fff}
  .sheet{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}
  .sheet+.sheet{break-before:page}
  @page{size:A4;margin:12mm 11mm}
}
"""

def _rumus(t):
    """Biarkan $...$ dan \\( \\) utuh untuk KaTeX; sisanya di-escape."""
    keping, sisa = [], t
    pola = re.compile(r'(\$[^$\n]{1,300}\$|\\\([^\n]{1,300}?\\\)|\\\[[^\n]{1,400}?\\\])')
    pos = 0
    for m in pola.finditer(t):
        keping.append(html.escape(t[pos:m.start()])); keping.append(m.group(0)); pos = m.end()
    keping.append(html.escape(t[pos:]))
    return ''.join(keping)

def buat(rows, o):
    judul = o.get('judul') or 'LEMBAR KERJA'
    sub = ' · '.join(x for x in (o.get('mapel'), o.get('kelas'), o.get('jenis')) if x)
    arahan = o.get('arahan') or 'Kerjakan soal berikut dengan teliti. Pilih jawaban yang paling tepat.'
    n_kol = int(o.get('kolom') or 2)
    per_hal = int(o.get('per_hal') or 14)

    def kop(hal, total):
        return (f'<div class=kop><img src="/statik/logo.png" alt=""><div class=t>'
                f'<h1>{html.escape(judul)}</h1>'
                f'<div class=sub>{html.escape(sub)}</div></div>'
                f'<div class=sub>Hal {hal}/{total}</div></div>')

    lembar, i = [], 0
    halaman = [rows[k:k+per_hal] for k in range(0, len(rows), per_hal)] or [[]]
    for hal, kelompok in enumerate(halaman, 1):
        badan = ''
        if hal == 1:
            badan += ('<div class=isian><span>Nama : </span><span>Kelas : </span>'
                      '<span>Tanggal : </span><span>Nilai : </span></div>')
            badan += f'<div class=arahan>{html.escape(arahan)}</div>'
        butir = ''
        for r in kelompok:
            i += 1
            op = json.loads(r['opsi'] or '{}')
            ops = ''.join(f'<div><b>{k}.</b><span>{_rumus(v)}</span></div>'
                          for k, v in sorted(op.items())) if op else ''
            butir += (f'<div class=soal><div class=no>{i}.</div><div class=batang>'
                      f'{_rumus(r["batang"])}'
                      f'{f"<div class=opsi>{ops}</div>" if ops else ""}</div></div>')
        badan += f'<div class=kolom style="column-count:{n_kol}">{butir}</div>'
        lembar.append(f'<div class=sheet>{kop(hal, len(halaman))}{badan}'
                      f'<div class=kaki><span>{html.escape(o.get("footer") or "Exact Course")}</span>'
                      f'<span>{len(rows)} soal</span></div></div>')

    if o.get('kunci'):
        baris = ''
        for n, r in enumerate(rows, 1):
            op = json.loads(r['opsi'] or '{}')
            baris += (f'<tr><td class=n>{n}</td><td>{html.escape(r["nama"][:52])} '
                      f'· no.{r["no_soal"]} hal.{r["no_hal"]}</td>'
                      f'<td>{"/".join(sorted(op)) if op else "uraian"}</td></tr>')
        lembar.append(f'<div class=sheet>{kop("K", len(halaman))}'
                      f'<div class=arahan>Rujukan sumber tiap soal. '
                      f'Kunci jawaban belum tersedia di basis data — kolom terakhir '
                      f'hanya menunjukkan pilihan yang ada.</div>'
                      f'<table class=kunci style="width:100%;border-collapse:collapse">{baris}</table></div>')

    return f"""<!doctype html><meta charset=utf-8><title>{html.escape(judul)}</title>
<meta name=viewport content="width=device-width,initial-scale=1">
<link rel=stylesheet href="/statik/katex/katex.min.css">
<style>{GAYA}</style>
<div class="bar no-print">
  <button onclick="window.print()">Cetak</button>
  <button onclick="location.href='/lembar.pdf'+location.search">Unduh PDF</button>
  <span>{len(rows)} soal · {len(halaman)} halaman{' + kunci' if o.get('kunci') else ''}</span>
  <a href="javascript:history.back()">kembali</a>
</div>
{''.join(lembar)}
<script src="/statik/katex/katex.min.js"></script>
<script src="/statik/katex/auto-render.min.js"></script>
<script>renderMathInElement(document.body,{{delimiters:[
 {{left:'$',right:'$',display:false}},
 {{left:'\\\\(',right:'\\\\)',display:false}},
 {{left:'\\\\[',right:'\\\\]',display:true}}],throwOnError:false}});</script>"""
