#!/usr/bin/env python3
"""Suapi Exact Worksheet Maker FIXED, lalu ambil hasilnya sebagai PDF.

Aplikasi itu SUDAH bisa mengurai format naskah lengkap (bagian PG/B/I/E, bobot
nilai, sub-soal berjenjang) dan merender 39 jenis diagram [[...]]. Jadi jangan
dibangun ulang — cukup diisi naskahnya dan diambil hasil rendernya.
"""
import os, json, re, subprocess, time, tempfile, urllib.request

# Mesin Worksheet Maker kini ikut di dalam repo ini (folder wsm/) dan disajikan
# oleh server aplikasi sendiri — tidak ada lagi jalur luar yang dipaku, tidak ada
# server kedua di port 8420. Segarkan salinannya dengan ./perbarui-mesin.sh
APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wsm')
PORT_WS = 7790
ALAMAT = f'http://localhost:{PORT_WS}/wsm/index.html'

class GagalWS(Exception): pass

def perintah_baku(mapel='Matematika'):
    """Ambil perintah AI dari prompt-builder.js milik aplikasi itu sendiri,
    supaya tidak pernah kedaluwarsa terhadap versi aplikasinya."""
    r = subprocess.run(['node', 'default-prompt.js', mapel],
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
