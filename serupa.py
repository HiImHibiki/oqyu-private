#!/usr/bin/env python3
"""Satu halaman untuk seluruh alur: foto -> soal serupa dari arsip -> perintah
Gemini -> tempel balik -> lembar kerja.

Yang dipangkas dari alur lama: mengetik ulang soal dari foto, menyalin-tempel
bolak-balik, memberi nama berkas, dan membuat PDF secara terpisah.
Yang ditambahkan: contoh soal ASLI dari arsip sendiri ikut disertakan ke Gemini,
supaya soal barunya bergaya naskah yang benar-benar dipakai di kelas.
"""
import html, json, re, os, subprocess

HENTI = set("""yang dan di ke dari untuk pada dengan adalah ini itu atau tidak dalam akan
dapat oleh sebagai karena jika maka the of and to in a is for are be on as by with an at
or if then this that it from was were has have had not no be can will would could should
soal jawaban pilih berikut bawah benar salah adalah berapa nilai hasil tentukan""".split())

def kunci_cari(teks, maks=12):
    kata = re.findall(r'[A-Za-zÀ-ÿ][A-Za-z0-9À-ÿ\-]{3,}', teks.lower())
    urut, lihat = [], set()
    for w in kata:
        if w in HENTI or w in lihat: continue
        lihat.add(w); urut.append(w)
    return urut[:maks]

def baca_gambar(jalur, alat):
    try:
        o = subprocess.run([alat, jalur], capture_output=True, timeout=120)
        ln = o.stdout.decode('utf-8', 'replace').strip().splitlines()
        return json.loads(ln[0])['teks'] if ln else ''
    except Exception:
        return ''

PERINTAH = """Buatkan {n} soal BARU yang setara dengan soal berikut — topik dan tingkat kesulitan sama, tetapi angka, konteks, dan kalimatnya berbeda. Jangan menyalin ulang soal aslinya.

SOAL ACUAN:
{acuan}

{contoh}Tulis jawabanmu PERSIS dalam format ini, tanpa penjelasan tambahan:

Q1: <kalimat soal>
a) <pilihan>
b) <pilihan>
c) <pilihan>
d) <pilihan>

Q2: ...

Tulis rumus matematika dalam LaTeX di antara tanda $. Gunakan bahasa {bahasa}."""

def bangun_perintah(acuan, contoh, n=10, bahasa='Indonesia'):
    blok = ''
    if contoh:
        blok = ("CONTOH GAYA — soal asli yang dipakai di kelas kami. Ikuti gaya bahasa, "
                "panjang kalimat, dan cara menyusun pilihan seperti ini:\n\n")
        for i, c in enumerate(contoh, 1):
            op = json.loads(c['opsi'] or '{}')
            blok += f"{i}. {c['batang'][:400]}\n"
            for k, v in sorted(op.items()): blok += f"   {k}. {v[:120]}\n"
            blok += "\n"
    return PERINTAH.format(n=n, acuan=acuan.strip()[:1500], contoh=blok, bahasa=bahasa)

GAYA = """
:root{--bg:#fbfbfa;--kartu:#fff;--tepi:#e3e3e0;--teks:#1a1a19;--redup:#6b6b66;--aksen:#c4572a}
@media(prefers-color-scheme:dark){:root{--bg:#1a1a19;--kartu:#232322;--tepi:#37372f;--teks:#f0efea;--redup:#9a9a92}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--teks);
font:15px/1.55 ui-sans-serif,-apple-system,"Segoe UI",sans-serif}
.b{max-width:940px;margin:0 auto;padding:24px 18px 70px}
h1{font-size:20px;margin:0 0 3px}.s{color:var(--redup);font-size:13px;margin-bottom:18px}
.lk{background:var(--kartu);border:1px solid var(--tepi);border-radius:12px;padding:15px;margin-bottom:13px}
.lk h2{font-size:13px;margin:0 0 9px;text-transform:uppercase;letter-spacing:.5px;color:var(--redup)}
.lk h2 b{color:var(--aksen);margin-right:6px}
textarea{width:100%;padding:11px;border:1px solid var(--tepi);border-radius:9px;
background:var(--bg);color:var(--teks);font:13px/1.5 ui-monospace,Menlo,monospace;resize:vertical}
.j{border:2px dashed var(--tepi);border-radius:11px;padding:26px;text-align:center;
color:var(--redup);font-size:13px;cursor:pointer;background:var(--bg)}
.j.aktif{border-color:var(--aksen);color:var(--aksen)}
button,.btn{padding:9px 17px;border:0;border-radius:8px;background:var(--aksen);color:#fff;
font-weight:600;font-size:13px;cursor:pointer;text-decoration:none;display:inline-block}
button.abu{background:var(--tepi);color:var(--teks)}
.r{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}
input[type=text],input[type=number],select{padding:8px 11px;border:1px solid var(--tepi);
border-radius:8px;background:var(--bg);color:var(--teks);font-size:13px}
.c{border:1px solid var(--tepi);border-radius:9px;padding:9px 11px;margin-bottom:7px;font-size:13px}
.c label{display:flex;gap:8px;cursor:pointer}
.c .op{color:var(--redup);font-size:12px;margin-top:4px;padding-left:22px}
.c .sm{color:var(--redup);font-size:11.5px;margin-top:4px;padding-left:22px}
.kosong{color:var(--redup);font-size:13px;padding:8px 0}
a.kmb{color:var(--redup);font-size:13px}
"""

def halaman_awal():
    return f"""<!doctype html><meta charset=utf-8><title>Buat Soal Serupa</title>
<meta name=viewport content="width=device-width,initial-scale=1"><style>{GAYA}</style>
<div class=b>
<h1>Buat soal serupa dari foto</h1>
<div class=s>Foto dibaca di Mac ini (tanpa kirim ke mana pun), dicarikan padanannya
di arsip Anda, lalu disusunkan perintah siap tempel untuk Gemini.</div>
<form method=post action="/serupa" enctype="multipart/form-data">
  <div class=lk><h2><b>1</b> Foto soal acuan</h2>
    <div class=j id=j>jatuhkan foto atau tangkapan layar &mdash; atau klik untuk memilih
      <input type=file name=berkas accept="image/*,.pdf" id=file hidden></div>
    <div class=r>
      <input type=number name=n value=10 min=1 max=40 style=width:75px title="jumlah soal">
      <select name=bahasa><option>Indonesia</option><option>Inggris</option></select>
      <button type=submit>Baca &amp; Cari Padanan</button>
    </div>
  </div>
</form>
<a class=kmb href="/?mode=soal">&larr; kembali ke pencarian</a>
</div>
<script>
const j=document.getElementById('j'),fi=document.getElementById('file');
j.onclick=()=>fi.click();
fi.onchange=()=>{{if(fi.files[0]){{j.textContent=fi.files[0].name;j.classList.add('aktif')}}}};
['dragenter','dragover'].forEach(e=>j.addEventListener(e,v=>{{v.preventDefault();j.classList.add('aktif')}}));
['dragleave','drop'].forEach(e=>j.addEventListener(e,v=>{{v.preventDefault();j.classList.remove('aktif')}}));
j.addEventListener('drop',v=>{{fi.files=v.dataTransfer.files;
 if(fi.files[0]){{j.textContent=fi.files[0].name;j.classList.add('aktif')}}}});
</script>"""

def halaman_kerja(acuan, mirip, perintah, judul, n, bahasa):
    kartu = ''
    for r in mirip:
        op = json.loads(r['opsi'] or '{}')
        ops = ' · '.join(f'{k}) {html.escape(v[:34])}' for k, v in sorted(op.items()))
        kartu += (f'<div class=c><label><input type=checkbox class=ct value="{r["id"]}" checked>'
                  f'<span>{html.escape(r["batang"][:210])}</span></label>'
                  f'{f"<div class=op>{ops}</div>" if ops else ""}'
                  f'<div class=sm>{html.escape(r["nama"][:46])}'
                  f'{" · " + html.escape(str(r["mapel"])) if r["mapel"] else ""}'
                  f'{" · kelas " + str(r["kelas"]) if r["kelas"] else ""}</div></div>')
    if not kartu: kartu = '<div class=kosong>tidak ada padanan di arsip — perintah tetap bisa dipakai</div>'
    return f"""<!doctype html><meta charset=utf-8><title>Buat Soal Serupa</title>
<meta name=viewport content="width=device-width,initial-scale=1"><style>{GAYA}</style>
<div class=b>
<h1>Buat soal serupa</h1>
<div class=s>Periksa hasil bacaan, pilih contoh gaya, salin perintahnya ke Gemini,
lalu tempel jawabannya di langkah 4.</div>

<div class=lk><h2><b>1</b> Soal acuan &mdash; hasil baca foto, boleh disunting</h2>
  <textarea id=acuan rows=6>{html.escape(acuan)}</textarea></div>

<div class=lk><h2><b>2</b> Contoh gaya dari arsip Anda ({len(mirip)} padanan)</h2>
  {kartu}
  <div class=r><button class=abu type=button onclick="susun()">Susun ulang perintah</button>
  <span class=s style="margin:0">mencentang lebih banyak contoh membuat gaya soal lebih mirip naskah Anda</span></div></div>

<div class=lk><h2><b>3</b> Perintah untuk Gemini</h2>
  <textarea id=perintah rows=11>{html.escape(perintah)}</textarea>
  <div class=r><button type=button onclick="salin()">Salin perintah</button>
  <a class=btn href="https://gemini.google.com/app" target=_blank rel=noopener>Buka Gemini</a>
  <span id=st class=s style="margin:0"></span></div></div>

<div class=lk><h2><b>4</b> Tempel jawaban Gemini &rarr; lembar kerja</h2>
  <form method=post action="/impor" enctype="multipart/form-data">
    <textarea name=teks rows=8 placeholder="Tempel jawaban Gemini di sini..."></textarea>
    <div class=r>
      <input type=text name=judul value="{html.escape(judul)}" style="flex:1;min-width:220px">
      <input type=text name=mapel placeholder="mapel" size=11>
      <input type=text name=kelas placeholder="kelas" size=5>
      <button type=submit>Buat Lembar Kerja</button>
    </div>
  </form></div>
<a class=kmb href="/serupa">&larr; mulai dari foto lain</a>
</div>
<script>
const N={n}, BAHASA={json.dumps(bahasa)};
const CONTOH={json.dumps([{'id': r['id'], 'batang': r['batang'][:400],
                           'opsi': json.loads(r['opsi'] or '{{}}')} for r in mirip])};
function susun(){{
  const pilih=new Set([...document.querySelectorAll('.ct:checked')].map(x=>+x.value));
  let blok='';
  const dipakai=CONTOH.filter(c=>pilih.has(c.id));
  if(dipakai.length){{
    blok='CONTOH GAYA — soal asli yang dipakai di kelas kami. Ikuti gaya bahasa, '+
         'panjang kalimat, dan cara menyusun pilihan seperti ini:\\n\\n';
    dipakai.forEach((c,i)=>{{blok+=(i+1)+'. '+c.batang+'\\n';
      Object.keys(c.opsi).sort().forEach(k=>blok+='   '+k+'. '+c.opsi[k].slice(0,120)+'\\n');
      blok+='\\n';}});
  }}
  const acuan=document.getElementById('acuan').value.trim().slice(0,1500);
  document.getElementById('perintah').value=
`Buatkan ${{N}} soal BARU yang setara dengan soal berikut — topik dan tingkat kesulitan sama, tetapi angka, konteks, dan kalimatnya berbeda. Jangan menyalin ulang soal aslinya.

SOAL ACUAN:
${{acuan}}

${{blok}}Tulis jawabanmu PERSIS dalam format ini, tanpa penjelasan tambahan:

Q1: <kalimat soal>
a) <pilihan>
b) <pilihan>
c) <pilihan>
d) <pilihan>

Q2: ...

Tulis rumus matematika dalam LaTeX di antara tanda $. Gunakan bahasa ${{BAHASA}}.`;
}}
function salin(){{
  navigator.clipboard.writeText(document.getElementById('perintah').value)
   .then(()=>{{document.getElementById('st').textContent='tersalin — tempel di Gemini';}})
   .catch(()=>{{document.getElementById('st').textContent='gagal menyalin, pilih manual';}});
}}
document.querySelectorAll('.ct').forEach(x=>x.addEventListener('change',susun));
</script>"""
