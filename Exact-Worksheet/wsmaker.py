#!/usr/bin/env python3
"""Suapi Exact Worksheet Maker FIXED, lalu ambil hasilnya sebagai PDF.

Aplikasi itu SUDAH bisa mengurai format naskah lengkap (bagian PG/B/I/E, bobot
nilai, sub-soal berjenjang) dan merender 39 jenis diagram [[...]]. Jadi jangan
dibangun ulang — cukup diisi naskahnya dan diambil hasil rendernya.
"""
import re, os, json, subprocess, time, tempfile, urllib.request

# Mesin Worksheet Maker kini ikut di dalam repo ini (folder wsm/) dan disajikan
# oleh server aplikasi sendiri — tidak ada lagi jalur luar yang dipaku, tidak ada
# server kedua di port 8420. Segarkan salinannya dengan ./perbarui-mesin.sh
APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wsm')
PORT_WS = 7790
ALAMAT = f'http://localhost:{PORT_WS}/wsm/index.html'

class GagalWS(Exception): pass

# prompt-builder.js mengenali mata pelajaran lewat KUNCI SLUG ('fisika',
# 'bahasa-indonesia'), bukan nama yang diketik guru. Apa pun yang tidak cocok
# diam-diam jatuh ke 'matematika' — perintahnya lalu berkata "Buatkan naskah
# soal Matematika" dan membawa daftar diagram matematika, padahal yang diminta
# Fisika. Nama yang diketik dipetakan dulu ke slugnya di sini.
SLUG_MAPEL = {
    'matematika': 'matematika', 'mathematics': 'matematika', 'math': 'matematika',
    'maths': 'matematika', 'mtk': 'matematika',
    'fisika': 'fisika', 'physics': 'fisika',
    'kimia': 'kimia', 'chemistry': 'kimia',
    'biologi': 'biologi', 'biology': 'biologi',
    'bahasa indonesia': 'bahasa-indonesia', 'bahasa-indonesia': 'bahasa-indonesia',
    'b indonesia': 'bahasa-indonesia', 'b. indonesia': 'bahasa-indonesia',
    'indonesia': 'bahasa-indonesia', 'bindo': 'bahasa-indonesia',
    'bahasa inggris': 'bahasa-inggris', 'bahasa-inggris': 'bahasa-inggris',
    'b inggris': 'bahasa-inggris', 'b. inggris': 'bahasa-inggris',
    'inggris': 'bahasa-inggris', 'english': 'bahasa-inggris',
}

def slug_mapel(nama):
    """Nama mapel yang diketik guru -> kunci SUBJECT_PRESETS prompt-builder.js.

    Yang tidak dikenali dikembalikan apa adanya: prompt-builder.js sendiri yang
    memutuskan (dan jatuh ke matematika), jadi perilaku lama tidak berubah.
    """
    k = re.sub(r'\s+', ' ', (nama or '').strip().lower())
    return SLUG_MAPEL.get(k, nama or 'matematika')

def perintah_baku(mapel='Matematika'):
    """Ambil perintah AI dari prompt-builder.js milik aplikasi itu sendiri,
    supaya tidak pernah kedaluwarsa terhadap versi aplikasinya."""
    r = subprocess.run(['node', 'default-prompt.js', slug_mapel(mapel)],
                       cwd=APP, capture_output=True, timeout=60)
    t = r.stdout.decode('utf-8', 'replace')
    if not t.strip():
        raise GagalWS('default-prompt.js tidak menghasilkan apa-apa')
    return t

def isi_blok(perintah, **nilai):
    """Isi blok 'ISI DULU SEBELUM MENGIRIM PESAN INI' di ekor perintah."""
    peta = {'topik': 'Topik:', 'jenjang': 'Kelas/Jenjang:', 'set': 'Jumlah set:',
            'jumlah': 'Jumlah soal per set:', 'sulit': 'Tingkat kesulitan:',
            'bahasa': 'Bahasa:', 'acuan': 'Contoh acuan:'}
    for k, label in peta.items():
        v = (nilai.get(k) or '').strip()
        if not v: continue
        perintah = re.sub(rf'^{re.escape(label)}\s*$', f'{label} {v}',
                          perintah, count=1, flags=re.M)
    return perintah

def pastikan_server():
    """Mesin disajikan server aplikasi ini sendiri, jadi tidak ada yang perlu
    dinyalakan terpisah. Cukup dipastikan bisa diambil."""
    try:
        urllib.request.urlopen(ALAMAT, timeout=5).read(1)
        return False
    except Exception as e:
        raise GagalWS(f'Mesin Worksheet Maker tidak bisa diambil dari {ALAMAT}: {e}')

def _js_di_ws(kode):
    skrip = ('set t to missing value\n'
             'tell application "Google Chrome"\n'
             '  repeat with w in windows\n'
             '    repeat with tb in tabs of w\n'
             f'      if URL of tb contains "localhost:{PORT_WS}" then set t to tb\n'
             '    end repeat\n'
             '  end repeat\n'
             '  if t is missing value then\n'
             f'    set t to make new tab at end of tabs of front window with properties {{URL:"{ALAMAT}"}}\n'
             '    delay 3\n'
             '  end if\n'
             '  return execute t javascript ' + json.dumps(kode) + '\n'
             'end tell')
    r = subprocess.run(['osascript', '-e', skrip], capture_output=True, timeout=120)
    galat = r.stderr.decode('utf-8', 'replace')
    if 'Allow JavaScript from Apple Events' in galat:
        raise GagalWS('Izin JavaScript Chrome belum dinyalakan '
                      '(View > Developer > Allow JavaScript from Apple Events)')
    if galat.strip() and not r.stdout.strip():
        raise GagalWS(galat.strip()[:200])
    return r.stdout.decode('utf-8', 'replace').strip()

JS_ISI = r"""
(function(teks){
  const k = document.getElementById('rawInput');
  if(!k) return 'GAGAL:rawInput-tidak-ada';
  k.value = teks;
  k.dispatchEvent(new Event('input', {bubbles:true}));   // ini yang memicu render()
  return 'OK';
})(%s)
"""

JS_AMBIL = r"""
(function(){
  const h = document.getElementById('page');
  if(!h) return 'GAGAL:page-tidak-ada';
  const gaya = [...document.querySelectorAll('link[rel=stylesheet]')]
    .map(l => l.getAttribute('href')).filter(Boolean);
  return JSON.stringify({html: h.outerHTML, gaya: gaya});
})()
"""

def muat_naskah(teks):
    pastikan_server()
    h = _js_di_ws(JS_ISI % json.dumps(teks))
    if h.startswith('GAGAL'):
        raise GagalWS('Kotak naskah tidak ditemukan di Exact Worksheet Maker')
    return True

def ambil_pdf(tujuan, tunggu=3.0):
    """Ambil lembar yang sudah dirender, cetak jadi PDF lewat Chrome tanpa jendela."""
    time.sleep(tunggu)                      # beri waktu render + KaTeX + SVG
    mentah = _js_di_ws(JS_AMBIL)
    if mentah.startswith('GAGAL') or not mentah.strip():
        raise GagalWS('Lembar belum ter-render di Exact Worksheet Maker')
    d = json.loads(mentah)
    gaya = ''.join(f'<link rel=stylesheet href="{ALAMAT}{g.lstrip("./")}">' for g in d['gaya'])
    halaman = (f'<!doctype html><meta charset=utf-8><base href="{ALAMAT}">{gaya}'
               f'<style>body{{margin:0;background:#fff}}'
               f'@page{{size:A4;margin:12mm 11mm}}</style>{d["html"]}')
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False, encoding='utf-8') as f:
        f.write(halaman); sumber = f.name
    krom = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    try:
        subprocess.run([krom, '--headless', '--disable-gpu', '--no-pdf-header-footer',
                        f'--print-to-pdf={tujuan}', '--virtual-time-budget=10000',
                        'file://' + sumber], capture_output=True, timeout=180)
    finally:
        os.unlink(sumber)
    if not os.path.isfile(tujuan):
        raise GagalWS('Chrome gagal mencetak PDF')
    return tujuan

# Kosakata diagram memakan lebih dari separuh perintah: sekitar 30 baris, ±9.000
# karakter. Satu lembar tidak pernah memakai semuanya — naskah Pythagoras tidak
# perlu diberi tahu soal ogive atau diagram batang-daun. Perintah sepanjang itu
# membuat Gemini lebih sering membalas "saya hanya model bahasa", jadi jenis
# yang jelas tidak relevan dibuang sebelum dikirim.
#
# Yang dibuang hanya menghilangkan KEMUNGKINAN diagram itu dipakai; formatnya
# sendiri tidak berubah, jadi perendernya tetap mengerti hasilnya.
BARIS_DIAGRAM = re.compile(r'^   (\w[\w()]*)\s+— ')

# DAFTAR PUTIH — hanya jenis diagram di sini yang ditawarkan ke Gemini.
#
# Dari 28 jenis yang didukung mesinnya, sebagian besar hasilnya sering tidak
# akurat menurut pemakaiannya sehari-hari. Menawarkan jenis yang hasilnya
# meleset bukan cuma memboroskan perintah — Gemini jadi memakainya, dan lembar
# yang tercetak salah gambar. Yang tersisa di sini yang mekanismenya sederhana
# dan hasilnya bisa dipercaya.
#
# Menambah jenis: tulis namanya di sini. Catatan untuk 'bangun' dan
# 'bangunruang' — keduanya sempat tercetak selebar 12 piksel karena parameter
# 'lebar' salah diartikan (lihat patch di wsm/diagrams.js). Kalau dulu terlihat
# buruk gara-gara itu, sekarang layak dicoba lagi sebelum diputuskan.
DIPAKAI = {
    'tabel',          # tabel data
    'tabelkosong',    # tabel berheader, baris kosong untuk diisi siswa
    'kertasgrafik',   # kertas grafik kosong berskala untuk diplot siswa
    'garisjawab',     # garis bertitik sebagai ruang menulis jawaban
    'garisbilangan',  # garis bilangan dengan titik berlabel,
    'grafik',       # kurva fungsi jadi — dipakai bila soal menyuruh MEMBACA grafik
}

# Bukan jenis diagram, melainkan parameter tambahan — selalu ikut.
SELALU = {'anotasi', '(anotasi)'}

def ringkas_diagram(perintah, konteks=''):
    """Sisakan hanya jenis diagram yang dipakai.

    konteks tidak lagi dipakai untuk menyaring: daftar putihnya sudah pendek,
    dan menyaring lagi per topik hanya membuat lembar kehilangan tabel atau
    ruang jawab yang sebetulnya selalu berguna.
    """
    keluar, dibuang = [], 0
    for baris in perintah.split('\n'):
        m = BARIS_DIAGRAM.match(baris)
        if m:
            jenis = m.group(1).strip('()').lower()
            if jenis not in DIPAKAI and jenis not in SELALU:
                dibuang += 1
                continue
        keluar.append(baris)
    return '\n'.join(keluar), dibuang


# Dua blok panjang yang hanya berlaku pada keadaan tertentu. Kalau keadaannya
# tidak ada, kalimatnya cuma jadi beban: satu blok mengatur pembuatan BEBERAPA
# set, satu lagi mengatur cara memperlakukan lampiran contoh naskah.
_AWAL_SET = 'PENTING — KALAU "Jumlah set"'
_AWAL_LAMPIRAN = 'KALAU SAYA MELAMPIRKAN PDF/FOTO/TANGKAPAN LAYAR'


def _buang_blok(perintah, awal):
    """Buang satu alinea yang dimulai dengan penanda tertentu."""
    baris = perintah.split('\n')
    for i, b in enumerate(baris):
        if b.startswith(awal):
            j = i
            while j < len(baris) and baris[j].strip():
                j += 1
            # ikut buang baris contoh "SET 1 / SET 2 / ...dan seterusnya"
            while j < len(baris) and (not baris[j].strip()
                                      or baris[j].startswith(('SET ', '[naskah set', '...dan seterusnya'))):
                j += 1
            return '\n'.join(baris[:i] + baris[j:])
    return perintah


# Soal koordinat: sediakan kertas grafiknya, jangan gambarkan grafiknya.
#
# Menggambar grafik jadi sering meleset — titiknya bergeser, skalanya tidak
# cocok dengan angka di soal. Kertas grafik kosong tidak punya masalah itu
# karena tidak ada yang bisa salah digambar, dan justru lebih berguna: murid
# memplot sendiri, yang memang keterampilan yang sedang diuji.
ATURAN_KOORDINAT = """
Soal yang butuh grafik atau gambar: tolong jangan membuat, menggambar, atau
melampirkan gambar apa pun — cukup tulis TAG-nya dalam teks, nanti aplikasi
(graph generator) yang menggambarkannya. Dua pilihan:
- murid yang harus memplot/menggambar sendiri (koordinat, garis lurus, bidang
  kartesius, tabel pengamatan): [[kertasgrafik: ...]] atau [[tabelkosong: ...]],
  sebutkan rentang sumbu yang cukup untuk semua titiknya serta nama dan satuan
  tiap sumbu;
- soal yang menyuruh MEMBACA grafik yang sudah jadi ("perhatikan grafik
  berikut"): [[grafik: f1=...; xmin=...; xmax=...; ymin=...; ymax=...]].
Selain tag itu, semuanya teks biasa.
"""


def _lunak(perintah):
    """Lunakkan nada 'sistem override' pada perintah engine tanpa mengubah
    spesifikasi format. Frasa keras (PERSIS/wajib diikuti persis/"apa pun yang
    saya tulis... mengalahkan...") oleh filter Gemini kadang dikira upaya
    membajak sistem, lalu dibalas penolakan. Diperbaiki di sini (bukan di
    default-prompt.js) supaya tidak hilang saat mesin disinkron ulang.
    """
    ganti = [
        (', PERSIS termasuk tanda baca dan spasinya (',
         ', termasuk tanda baca dan spasinya (usahakan sama persis) ('),
        ('apa pun yang saya tulis di situ berlaku dan mengalahkan contoh apa pun di dalam pesan ini.',
         'yang saya isi di situ itulah yang dipakai, bukan contoh di dalam pesan ini.'),
        ('Baris yang KOSONG bukan berarti kurang informasi: pakai standarnya langsung, dan JANGAN bertanya balik atau menunda membuat soal.',
         'Kalau ada yang saya kosongkan, pakai standarnya saja dan langsung dibuat tanpa bertanya balik.'),
        ('FORMAT (wajib diikuti persis, berlaku untuk setiap SET):',
         'FORMAT (tolong diikuti supaya bisa dibaca aplikasi; sama untuk setiap SET):'),
        ('SETIAP gambar, grafik, atau tabel pada lampiran WAJIB dibuat ulang memakai tag [[...]] di bawah',
         'setiap gambar, grafik, atau tabel pada lampiran sebaiknya dibuat ulang memakai tag [[...]] di bawah'),
    ]
    for a, b in ganti:
        perintah = perintah.replace(a, b)
    # Kurangi kata-kata yang "berteriak" (huruf kapital) yang bukan penanda format.
    for kata in (' JANGAN ', ' WAJIB ', ' PERSIS ', ' PENTING', ' HARUS '):
        perintah = perintah.replace(kata, kata.lower())
    perintah = perintah.replace('PENTING —', 'Catatan —').replace('PENTING:', 'Catatan:')
    return perintah


def ringkas(perintah, konteks='', banyak_set=False, ada_lampiran=False):
    """Persingkat perintah sesuai permintaan yang sedang dikirim.

    Formatnya tidak diubah sedikit pun — yang dibuang hanya penjelasan tentang
    kemungkinan yang tidak sedang terjadi. Perintah yang lebih pendek lebih
    jarang dibalas penolakan oleh Gemini.
    """
    perintah = _lunak(perintah)
    hasil, _ = ringkas_diagram(perintah, konteks)
    # Disisipkan SEBELUM blok "ISI DULU", bukan di paling bawah. Perintahnya
    # sendiri menyuruh Gemini membaca blok isian di bagian PALING BAWAH pesan;
    # menempelkan aturan sesudahnya menimbun isian itu, dan Gemini menjawab
    # "Topik dan rincian soal belum tercantum" padahal topiknya sudah diisi.
    tanda = '\nISI DULU SEBELUM MENGIRIM PESAN INI'
    i = hasil.rfind(tanda)
    if i > 0:
        hasil = hasil[:i].rstrip() + '\n' + ATURAN_KOORDINAT + hasil[i:]
    else:
        hasil = hasil.rstrip() + '\n' + ATURAN_KOORDINAT
    if not banyak_set:
        hasil = _buang_blok(hasil, _AWAL_SET)
    if not ada_lampiran:
        hasil = _buang_blok(hasil, _AWAL_LAMPIRAN)
    return hasil
