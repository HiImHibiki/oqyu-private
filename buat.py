#!/usr/bin/env python3
"""Exact Worksheet Maker — satu instruksi, langsung jadi PDF.

Alurnya:
  foto        -> dibaca Vision di Mac (tanpa kirim ke mana pun)
  arsip       -> 6 soal asli diambil sebagai penuntun gaya
  Gemini      -> dikendalikan lewat Chrome, tanpa API
  penata      -> pengurai deterministik; model lokal hanya bila ia gagal total
  lembar      -> PDF A4 siap cetak, masuk bank soal
"""
import os, re, json, time, html, threading, subprocess, sqlite3, urllib.parse, urllib.request

AKAR = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(AKAR, 'exact.db')
KELUAR = os.path.expanduser('~/Documents/Lembar Kerja')
PORT = 7790

TUGAS = {}
KUNCI = threading.Lock()

SINGKATAN = {'matematika': 'MATH', 'fisika': 'PHYS', 'kimia': 'CHEM',
             'biologi': 'BIO', 'ipa': 'IPA', 'ips': 'IPS',
             'bahasa inggris': 'ENG', 'bahasa indonesia': 'BIND',
             'ekonomi': 'EKO', 'sejarah': 'SEJ', 'geografi': 'GEO'}

def kode_mapel(nama):
    """Kode pendek untuk kop, mis. MATH. Memotong mentah memberi "MATEMATI"."""
    n = (nama or '').strip().lower()
    if n in SINGKATAN: return SINGKATAN[n]
    for k, v in SINGKATAN.items():
        if k in n or n in k: return v
    return ''.join(w[0] for w in n.split()[:4]).upper() or n[:4].upper()

def _catat(jid, pesan, maju=None, selesai=False, galat=None, pdf=None):
    with KUNCI:
        t = TUGAS.setdefault(jid, {'langkah': [], 'maju': 0, 'selesai': False})
        if pesan: t['langkah'].append(pesan)
        if maju is not None: t['maju'] = maju
        if galat: t['galat'] = galat; t['selesai'] = True
        if pdf: t['pdf'] = pdf
        if selesai: t['selesai'] = True

def _db():
    c = sqlite3.connect(DB, timeout=60); c.row_factory = sqlite3.Row; return c

def jalankan(jid, gambar, instruksi, jumlah, mapel, kelas, judul, api,
             topik='', jenjang='', n_set='', sulit='', bahasa='Indonesia',
             lembaga='', sekolah='', tanggal='', kunci=True, pembahasan=True):
    """Alur penuh: foto -> arsip -> Gemini -> Exact Worksheet Maker -> PDF."""
    import serupa, wsmaker, otomasi
    try:
        # 1. baca foto di Mac
        acuan = ''
        if gambar:
            _catat(jid, f'Membaca {len(gambar)} gambar di Mac…', 8)
            alat = os.path.join(AKAR, 'ocr-mac', 'visionocr')
            import tempfile
            for nama, isi in gambar:
                ext = os.path.splitext(nama)[1] or '.png'
                with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
                    f.write(isi); pth = f.name
                try: acuan += serupa.baca_gambar(pth, alat) + '\n\n'
                finally: os.unlink(pth)
            _catat(jid, f'Terbaca {len(acuan.split())} kata dari gambar', 18)

        # 2. penuntun gaya dari arsip sendiri
        _catat(jid, 'Mencari soal serupa di arsip…', 26)
        mirip, c = [], None
        kata = serupa.kunci_cari(acuan or topik or instruksi)
        if kata:
            c = _db()
            try:
                mirip = c.execute("""SELECT s.batang, s.opsi, d.nama FROM soal_fts f
                                     JOIN soal s ON s.id=f.soal_id JOIN dokumen d ON d.id=s.dok_id
                                     WHERE soal_fts MATCH ? AND s.dup=0 AND s.mutu=2
                                     ORDER BY rank LIMIT 6""", (' OR '.join(kata),)).fetchall()
            except sqlite3.OperationalError: pass
            c.close()
        _catat(jid, f'{len(mirip)} soal arsip dipakai sebagai acuan gaya', 32)

        # 3. perintah diambil dari prompt-builder.js milik Exact Worksheet Maker,
        #    bukan disalin — supaya tidak pernah kedaluwarsa terhadap versinya.
        _catat(jid, 'Menyusun perintah dari format Exact Worksheet Maker…', 38)
        lampiran = ''
        if acuan.strip():
            lampiran += 'NASKAH ACUAN HASIL PEMINDAIAN FOTO:\n' + acuan.strip()[:2500] + '\n\n'
        if mirip:
            lampiran += ('CONTOH GAYA — soal asli yang dipakai di kelas kami, '
                         'tiru gaya bahasa dan kedalaman penalarannya:\n')
            for n, r in enumerate(mirip, 1):
                op = json.loads(r['opsi'] or '{}')
                lampiran += f"{n}. {r['batang'][:320]}\n"
                for k2, v in sorted(op.items()): lampiran += f"   {k2}. {v[:110]}\n"
        if instruksi.strip():
            lampiran += '\nCATATAN GURU: ' + instruksi.strip()
        perintah = wsmaker.isi_blok(
            wsmaker.perintah_baku(mapel or 'Matematika'),
            topik=topik, jenjang=jenjang or (f'Kelas {kelas}' if kelas else ''),
            set=n_set, jumlah=jumlah, sulit=sulit, bahasa=bahasa,
            acuan='lihat lampiran di bawah' if lampiran else '')
        if lampiran: perintah += '\n\n' + lampiran

        # 4. Gemini lewat Chrome
        _catat(jid, 'Mengirim ke Gemini lewat Chrome kendali…', 45)
        try:
            jawab = otomasi.gemini_tanya(perintah, batas=300)
        except RuntimeError as e:
            # Penolakan biasanya muncul saat lampirannya panjang atau mencampur
            # beberapa naskah bertopik beda. Coba sekali lagi tanpa lampiran.
            if 'menolak' not in str(e) or not lampiran:
                raise
            _catat(jid, 'Gemini menolak — mencoba ulang tanpa lampiran…', 50)
            ringkas = wsmaker.isi_blok(
                wsmaker.perintah_baku(mapel or 'Matematika'),
                topik=topik or (acuan.strip()[:120] if acuan.strip() else ''),
                jenjang=jenjang or (f'Kelas {kelas}' if kelas else ''),
                set=n_set, jumlah=jumlah, sulit=sulit, bahasa=bahasa)
            jawab = otomasi.gemini_tanya(ringkas, batas=300)
        _catat(jid, f'Gemini menjawab ({len(jawab)} karakter)', 68)

        # 5. serahkan ke perender asli
        if len(jawab.strip()) < 200 or jawab.count('\n') < 5:
            raise RuntimeError('Naskah dari Gemini terlalu pendek untuk jadi lembar kerja')
        _catat(jid, 'Memuat ke Exact Worksheet Maker…', 76)

        # 6. simpan salinan mentah + ambil PDF
        os.makedirs(KELUAR, exist_ok=True)
        judul = judul.strip() or (topik.strip() or f'Latihan {time.strftime("%d %b %H:%M")}')
        nama = re.sub(r'[^\w -]', '', judul).strip()[:60] or 'Lembar'
        cap = time.strftime('%Y-%m-%d %H%M')
        open(os.path.join(KELUAR, f'{nama} — {cap}.txt'), 'w', encoding='utf-8').write(jawab)
        _catat(jid, 'Merender lembar lalu mencetak PDF…', 88)
        tuju = os.path.join(KELUAR, f'{nama} — {cap}.pdf')
        otomasi.worksheet_pdf(jawab, tuju, kop=dict(
            lembaga=lembaga or 'Exact Course', mapel=kode_mapel(mapel),
            sekolah=sekolah, kelas=str(kelas or '') or (jenjang or ''),
            tanggal=tanggal or time.strftime('%d%m'),
            kunci=kunci, pembahasan=pembahasan))
        subprocess.run(['open', tuju], capture_output=True)
        _catat(jid, 'Selesai — PDF terbuka', 100, selesai=True, pdf=tuju)
    except Exception as e:
        _catat(jid, None, galat=f'{type(e).__name__}: {e}')

GAYA = """
:root{--bg:#fbfbfa;--kartu:#fff;--tepi:#e3e3e0;--teks:#1a1a19;--redup:#6b6b66;--aksen:#c4572a}
@media(prefers-color-scheme:dark){:root{--bg:#1a1a19;--kartu:#232322;--tepi:#37372f;--teks:#f0efea;--redup:#9a9a92}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--teks);
font:15px/1.55 ui-sans-serif,-apple-system,"Segoe UI",sans-serif}
.b{max-width:760px;margin:0 auto;padding:26px 18px 70px}
h1{font-size:21px;margin:0 0 3px}.s{color:var(--redup);font-size:13px;margin-bottom:18px}
.k{background:var(--kartu);border:1px solid var(--tepi);border-radius:12px;padding:16px;margin-bottom:12px}
.j{border:2px dashed var(--tepi);border-radius:11px;padding:26px;text-align:center;
color:var(--redup);font-size:13px;cursor:pointer}
.j.aktif{border-color:var(--aksen);color:var(--aksen)}
.j:focus{outline:2px solid var(--aksen);outline-offset:2px}
.kcl{font-size:11.5px;opacity:.7;margin-top:4px}
.gal{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}
.gal figure{position:relative;margin:0;width:92px}
.gal img,.gal .pdfkartu{width:92px;height:70px;border-radius:7px;
border:1px solid var(--tepi);display:block}
.gal img{object-fit:cover}
.gal .pdfkartu{background:var(--bg);color:var(--aksen);font-weight:700;font-size:15px;
display:flex;align-items:center;justify-content:center;letter-spacing:1px}
.gal figcaption{font-size:10.5px;color:var(--redup);margin-top:3px;
overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gal button{position:absolute;top:-7px;right:-7px;width:21px;height:21px;padding:0;
border-radius:50%;background:#c0392b;color:#fff;font-size:13px;line-height:19px;
border:2px solid var(--kartu);cursor:pointer}
.j:focus{outline:2px solid var(--aksen);outline-offset:2px}
.kcl{font-size:11.5px;opacity:.7;margin-top:4px}
.gal{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}
.gal figure{position:relative;margin:0;width:92px}
.gal img,.gal .pdfkartu{width:92px;height:70px;border-radius:7px;
border:1px solid var(--tepi);display:block}
.gal img{object-fit:cover}
.gal .pdfkartu{background:var(--bg);color:var(--aksen);font-weight:700;font-size:15px;
display:flex;align-items:center;justify-content:center;letter-spacing:1px}
.gal figcaption{font-size:10.5px;color:var(--redup);margin-top:3px;
overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gal button{position:absolute;top:-7px;right:-7px;width:21px;height:21px;padding:0;
border-radius:50%;background:#c0392b;color:#fff;font-size:13px;line-height:19px;
border:2px solid var(--kartu);cursor:pointer}
textarea{width:100%;padding:11px;border:1px solid var(--tepi);border-radius:9px;
background:var(--bg);color:var(--teks);font:14px/1.5 inherit;resize:vertical}
input,select{padding:9px 11px;border:1px solid var(--tepi);border-radius:8px;
background:var(--bg);color:var(--teks);font-size:13px}
.r{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:11px}
button{padding:11px 22px;border:0;border-radius:9px;background:var(--aksen);color:#fff;
font-weight:600;font-size:14px;cursor:pointer}
button:disabled{opacity:.5;cursor:default}
button.abu{background:var(--tepi);color:var(--teks);font-weight:600}
.bar{height:6px;background:var(--tepi);border-radius:3px;overflow:hidden;margin:12px 0 9px}
.bar i{display:block;height:100%;background:var(--aksen);width:0;transition:width .4s}
.lg{font-size:13px;color:var(--redup)}.lg div{padding:2px 0}
.lg div.now{color:var(--teks);font-weight:600}
.err{color:#c0392b;font-size:13.5px}
.pr{background:#fff8f0;border:1px solid #f0d8c0;border-radius:9px;padding:11px;font-size:13px;color:#8a5a2a}
@media(prefers-color-scheme:dark){.pr{background:#2a2118;border-color:#4a3a28;color:#d8a870}}
"""


SKRIP = """
const MAKS = 10;
const j = document.getElementById('j'), fi = document.getElementById('file'),
      gal = document.getElementById('gal');
let berkas = [];

function gambarkan(){
  gal.innerHTML = '';
  berkas.forEach((f, i) => {
    const fig = document.createElement('figure');
    const pdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
    let img;
    if (pdf) {
      img = document.createElement('div');
      img.className = 'pdfkartu';
      img.textContent = 'PDF';
    } else {
      img = document.createElement('img');
      img.src = URL.createObjectURL(f);
    }
    const cap = document.createElement('figcaption');
    cap.textContent = f.name || ('tempelan ' + (i+1));
    const x = document.createElement('button');
    x.type = 'button'; x.textContent = '\\u00d7'; x.title = 'hapus';
    x.onclick = () => { berkas.splice(i,1); gambarkan(); };
    fig.append(img, x, cap); gal.appendChild(fig);
  });
  const sisa = MAKS - berkas.length;
  j.firstChild.textContent = berkas.length
    ? berkas.length + ' berkas dipilih' + (sisa ? ' \\u00b7 bisa tambah ' + sisa + ' lagi' : ' \\u00b7 penuh')
    : 'tempel tangkapan layar (\\u2318V), jatuhkan foto atau PDF, atau klik untuk memilih';
  j.classList.toggle('aktif', berkas.length > 0);
}

function tambah(daftar){
  let ditolak = 0;
  for (const f of daftar) {
    const pdf = f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name || ''));
    if (!f || !(f.type.startsWith('image/') || pdf)) continue;
    if (berkas.length >= MAKS) { ditolak++; continue; }
    berkas.push(f);
  }
  gambarkan();
  if (ditolak) alert('Maksimal ' + MAKS + ' berkas. ' + ditolak + ' berkas terakhir diabaikan.');
}

// Jalur paling andal di Mac: server membaca papan klip sendiri, jadi tidak
// bergantung pada fokus halaman maupun dukungan tempel peramban.
document.getElementById('btnKlip').onclick = async () => {
  const kabar = document.getElementById('kabarKlip');
  kabar.textContent = 'mengambil…';
  try {
    const r = await fetch('/klip?t=' + Date.now());
    if (!r.ok) { kabar.textContent = 'papan klip tidak berisi gambar'; return; }
    const b = await r.blob();
    const cap = new Date().toISOString().slice(11,19).replace(/:/g,'');
    tambah([new File([b], 'klip-' + cap + '.png', {type:'image/png'})]);
    kabar.textContent = '';
  } catch (e) { kabar.textContent = 'gagal: ' + e.message; }
};

const preset = document.getElementById('preset');
if (preset) preset.onchange = () => {
  if (!preset.value) return;
  document.querySelector('[name=jumlah]').value = preset.value;
  preset.selectedIndex = 0;          // kembali ke label, nilainya sudah pindah
};

j.onclick = () => fi.click();
fi.onchange = () => { tambah(fi.files); fi.value = ''; };

// Tempel dari papan klip: tangkapan layar Cmd+Shift+4 masuk langsung tanpa perlu
// disimpan jadi berkas dulu. Sebagian sumber menaruhnya sebagai Blob tanpa nama,
// jadi namanya dibuatkan di sini supaya unggahannya tetap sah.
document.addEventListener('paste', e => {
  const d = e.clipboardData; if (!d) return;
  const item = [].slice.call(d.items || []).filter(x => x.type.indexOf('image/') === 0);
  if (!item.length) return;
  e.preventDefault();
  const cap = new Date().toISOString().slice(11,19).replace(/:/g,'');
  const hasil = [];
  item.forEach((x, n) => {
    const b = x.getAsFile(); if (!b) return;
    const ext = (b.type.split('/')[1] || 'png').replace('jpeg','jpg');
    hasil.push(new File([b], b.name || ('tempel-' + cap + '-' + (n+1) + '.' + ext), {type: b.type}));
  });
  tambah(hasil);
});

['dragenter','dragover'].forEach(e => j.addEventListener(e, v => { v.preventDefault(); j.classList.add('aktif'); }));
j.addEventListener('dragleave', v => { v.preventDefault(); });
j.addEventListener('drop', v => { v.preventDefault(); tambah(v.dataTransfer.files); });

document.getElementById('f').onsubmit = async e => {
  e.preventDefault();
  const panel = document.getElementById('panel'), log = document.getElementById('log');
  if (!berkas.length && !document.querySelector('[name=topik]').value.trim()) {
    panel.style.display = 'block';
    log.innerHTML = '<div class=err>Belum bisa dimulai: isi <b>topik</b>, '
      + 'atau tempel minimal satu gambar soal (\u2318V).</div>';
    return;
  }
  document.getElementById('go').disabled = true;
  document.getElementById('panel').style.display = 'block';
  const fd = new FormData(e.target);
  fd.delete('gambar');
  berkas.forEach(f => fd.append('gambar', f, f.name));
  const r = await fetch('/buat', {method:'POST', body: fd});
  const jid = (await r.json()).jid;
  const isi = document.getElementById('isi');
  const timer = setInterval(async () => {
    const s = await (await fetch('/status?jid=' + jid)).json();
    isi.style.width = (s.maju || 0) + '%';
    log.innerHTML = (s.langkah || []).map((x, i, a) =>
      '<div class="' + (i === a.length-1 && !s.selesai ? 'now' : '') + '">' + x + '</div>').join('');
    if (s.galat) log.innerHTML += '<div class=err>' + s.galat + '</div>';
    if (s.selesai) { clearInterval(timer); document.getElementById('go').disabled = false;
      if (s.pdf) log.innerHTML += '<div><b>PDF terbuka otomatis</b></div>'; }
  }, 1200);
};
"""


SULIT_BAWAAN = 'sama dengan naskah acuan'

def halaman(izin_chrome=True, setel=None):
    import setelan as _s
    st = setel or _s.muat()
    n = lambda k: html.escape(st.get(k, '') or '')
    tgl_ini = time.strftime('%d%m')
    c = lambda k: ' checked' if st.get(k) else ''
    peringatan = ''
    return f"""<!doctype html><meta charset=utf-8><title>Exact Worksheet Maker</title>
<meta name=viewport content="width=device-width,initial-scale=1"><style>{GAYA}</style>
<div class=b>
<h1>Exact Worksheet Maker</h1>
<div class=s>Tempel tangkapan layar soal dan isi kriteria. Gemini mengarang,
Mac ini menata, PDF terbuka sendiri.</div>
{peringatan}
<form id=f>
<div class=k>
  <div class=j id=j tabindex=0>tempel tangkapan layar (&#8984;V), jatuhkan foto atau PDF, atau klik untuk memilih
    <div class=kcl>sampai 10 berkas</div>
    <input type=file name=gambar id=file accept="image/*,.pdf,application/pdf" multiple hidden></div>
  <div class=r style="margin-top:9px">
    <button type=button id=btnKlip class=abu>Ambil dari papan klip</button>
    <span class=kcl id=kabarKlip style="margin:0"></span>
  </div>
  <div class=gal id=gal></div>
  <div class=r>
    <input name=mapel placeholder="mapel" value="{n('mapel')}" style="flex:1;min-width:150px">
    <input name=topik placeholder="topik (kosongkan jika pakai gambar)" style="flex:2;min-width:190px">
  </div>
  <div class=r>
    <input name=jenjang placeholder="kelas/jenjang" value="{n('jenjang')}" size=12>
    <select id=preset title="komposisi siap pakai" style="min-width:150px">
      <option value="">komposisi…</option>
      <option>10 PG + 5 Esai</option>
      <option>10 Esai</option>
      <option>20 PG</option>
      <option>30 PG</option>
      <option>5 PG + 2 B + 2 I + 1 E</option>
      <option>15 PG + 5 Isian</option>
    </select>
    <input name=jumlah placeholder="atau tulis sendiri" value="{n('jumlah')}" style="flex:1;min-width:150px">
    <input name=n_set placeholder="set" value="{n('n_set') or '2'}" size=4 title="jumlah set">
    <input name=sulit placeholder="kesulitan" value="{n('sulit') or SULIT_BAWAAN}" style="min-width:170px">
    <select name=bahasa><option{" selected" if st.get("bahasa")!="Inggris" else ""}>Indonesia</option><option{" selected" if st.get("bahasa")=="Inggris" else ""}>Inggris</option></select>
  </div>
  <textarea name=instruksi rows=2 style="margin-top:11px"
    placeholder="Catatan tambahan untuk Gemini (opsional)">{n('instruksi')}</textarea>
  <div class=r>
    <input name=lembaga placeholder="nama lembaga" value="{n('lembaga')}" style="flex:1;min-width:150px">
    <input name=sekolah placeholder="kode sekolah" value="{n('sekolah')}" size=10>
    <input name=tanggal placeholder="tgl" value="{tgl_ini}" size=7>
  </div>
  <div class=r>
    <label class=kcl><input type=checkbox name=kunci{c('kunci')}> kunci jawaban</label>
    <label class=kcl><input type=checkbox name=pembahasan{c('pembahasan')}> pembahasan</label>
  </div>
  <div class=r>
    <input name=judul placeholder="judul berkas (opsional)" style="flex:1;min-width:190px">
    <button id=go type=submit>Buat PDF</button>
  </div>
</div>
</form>
<div class=k id=panel style=display:none>
  <div class=bar><i id=isi></i></div>
  <div class=lg id=log></div>
</div>
</div>
<script>{SKRIP}</script>"""
