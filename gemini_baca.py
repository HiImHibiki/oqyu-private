#!/usr/bin/env python3
"""Pembaca PDF Gemini yang memulihkan pangkat dan memisahkan kunci jawaban.

Dua masalah yang diselesaikan di sini:
  1. pdftotext meratakan x kuadrat jadi "x2". Ukuran dan posisi kata masih ada
     di koordinat, jadi pangkat/indeks bisa dikenali dan ditulis sebagai LaTeX.
  2. Gemini menaruh kunci jawaban di bagian bawah dokumen yang sama. Tanpa
     dipisah, ia tertelan ke soal terakhir dan merusak panen. Dipisah, ia justru
     menjadi kunci jawaban yang selama ini tidak kita punya.
"""
import re, subprocess, statistics as st
from xml.etree import ElementTree as ET

NS = '{http://www.w3.org/1999/xhtml}'
PISAH_KUNCI = re.compile(r'(answer\s*keys?|kunci\s*jawaban|jawaban\s*:|pembahasan)\b', re.I)
KUNCI_BARIS = re.compile(r'\b(?:A|Q|No\.?|Soal)?\s*(\d{1,3})\s*[.):]\s*([A-Ea-e])\b')

def _kata(path):
    r = subprocess.run(['pdftotext', '-bbox', '-enc', 'UTF-8', path, '-'],
                       capture_output=True, timeout=180)
    if r.returncode != 0:
        return []
    try:
        akar = ET.fromstring(r.stdout.decode('utf-8', 'replace'))
    except ET.ParseError:
        return []
    hasil = []
    for hal, page in enumerate(akar.iter(NS + 'page'), 1):
        for w in page.iter(NS + 'word'):
            t = w.text or ''
            if not t.strip() or t == '​':
                continue
            y0, y1 = float(w.get('yMin')), float(w.get('yMax'))
            hasil.append(dict(hal=hal, x0=float(w.get('xMin')), x1=float(w.get('xMax')),
                              y0=y0, y1=y1, yc=(y0 + y1) / 2, h=y1 - y0, t=t))
    return hasil

def _jadi_baris(kata, tinggi_baku):
    """Kelompokkan kata jadi baris menurut TITIK TENGAH vertikal.

    Angka pangkat duduk lebih tinggi dari huruf dasarnya; mengelompokkan menurut
    tepi atas melemparkannya ke awal baris dan merusak urutan baca.
    """
    kata.sort(key=lambda k: (k['hal'], k['yc']))
    baris, kini, acuan = [], [], None
    for k in kata:
        if kini and (k['hal'] != kini[-1]['hal'] or abs(k['yc'] - acuan) > tinggi_baku * 0.55):
            baris.append(kini)
            kini = []
        kini.append(k)
        biasa = [w for w in kini if w['h'] >= tinggi_baku * 0.88]
        acuan = st.median([w['yc'] for w in (biasa or kini)])
    if kini:
        baris.append(kini)
    for b in baris:
        b.sort(key=lambda w: w['x0'])
    return baris

def teks_berpangkat(path):
    """Rangkai ulang teks dengan pangkat/indeks ditulis sebagai LaTeX."""
    kata = _kata(path)
    if not kata:
        return ''
    tinggi_baku = st.median([k['h'] for k in kata]) or 1
    keluar = []
    for b in _jadi_baris(kata, tinggi_baku):
        biasa = [w for w in b if w['h'] >= tinggi_baku * 0.88]
        dasar = st.median([w['y1'] for w in (biasa or b)])
        hasil = []
        for w in b:
            kecil = w['h'] < tinggi_baku * 0.88
            naik = (dasar - w['y1']) > tinggi_baku * 0.18
            turun = (w['y1'] - dasar) > tinggi_baku * 0.18
            jenis = 'biasa'
            if kecil and naik and re.fullmatch(r'[0-9n\-+]{1,3}', w['t']):
                jenis = 'sup'
            elif kecil and turun and re.fullmatch(r'[0-9a-z]{1,3}', w['t']):
                jenis = 'sub'
            if jenis == 'biasa' or not hasil:
                hasil.append(w['t'])
                continue
            induk = hasil.pop()
            tanda = '^' if jenis == 'sup' else '_'
            if re.search(r'[A-Za-z0-9)\]]$', induk):
                inti, depan = induk[-1], induk[:-1]
            else:
                inti, depan = induk, ''
            hasil.append(f'{depan}${inti}{tanda}{{{w["t"]}}}$')
        keluar.append(' '.join(hasil))
    return '\n'.join(keluar)

def pisah_kunci(teks):
    """Kembalikan (bagian_soal, bagian_kunci)."""
    m = PISAH_KUNCI.search(teks)
    if not m:
        return teks, ''
    return teks[:m.start()], teks[m.start():]

def urai_kunci(bagian):
    """Ambil pemetaan nomor -> huruf jawaban dari bagian kunci."""
    kunci = {}
    for m in KUNCI_BARIS.finditer(bagian):
        kunci.setdefault(int(m.group(1)), m.group(2).upper())
    return kunci

def baca(path):
    """Kembalikan (teks_soal, kunci_jawaban)."""
    t = teks_berpangkat(path)
    soal, kunci = pisah_kunci(t)
    return soal, urai_kunci(kunci)
