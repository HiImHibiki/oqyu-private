#!/usr/bin/env python3
"""Tahap 3: susun ulang halaman dua kolom, lalu potong jadi soal satuan."""
import os, re, sys, subprocess, sqlite3
from xml.etree import ElementTree as ET
AKAR = os.path.expanduser('~/Documents/EXACT COURSE')
NS = '{http://www.w3.org/1999/xhtml}'

def baris_halaman(path, f=None, l=None):
    cmd = ['pdftotext','-bbox-layout','-enc','UTF-8']
    if f: cmd += ['-f',str(f),'-l',str(l or f)]
    r = subprocess.run(cmd + [path,'-'], capture_output=True, timeout=180)
    if r.returncode != 0: return []
    try: akar = ET.fromstring(r.stdout.decode('utf-8','replace'))
    except ET.ParseError: return []
    keluar = []
    for pno, page in enumerate(akar.iter(NS+'page'), start=(f or 1)):
        W = float(page.get('width', 595)); baris = []
        for ln in page.iter(NS+'line'):
            kata = [w.text or '' for w in ln.iter(NS+'word')]
            if not kata: continue
            baris.append(dict(x0=float(ln.get('xMin')), x1=float(ln.get('xMax')),
                              y=float(ln.get('yMin')), t=' '.join(kata)))
        keluar.append((pno, W, baris))
    return keluar

def urutkan(W, baris):
    """Susun baris jadi urutan baca yang benar.

    Versi lama memotong halaman SEKALI di tengah — benar untuk dua kolom, runtuh
    pada naskah tiga sampai lima kolom, yang membuat opsi beberapa soal berbeda
    menempel jadi satu. Sekarang didelegasikan ke deteksi jurang N-kolom.
    Diukur pada 250 halaman terburuk: opsi bocor 797 -> 613, bersih 29% -> 39%.
    """
    from kolom import urutkan_kolom
    return urutkan_kolom(W, baris)

AWAL_SOAL = re.compile(r'^\s*(\d{1,2})\s*[.)]\s*(.*)$')
OPSI      = re.compile(r'^\s*\(?([A-Ea-e])\s*[.)]\s*(.*)$')
# opsi lain yang menyelinap di TENGAH baris — akibat naskah opsi dua kolom
OPSI_SISIP = re.compile(r'\s+\(?([B-Ea-e])\s*[.)]\s+(?=\S)')

def potong(baris_teks, min_rantai=4):
    """Potong aliran baris jadi soal.

    Nomor soal boleh berdiri sendiri di barisnya (isi menyusul di baris
    berikutnya) — pola ini umum dan versi pertama melewatkannya semua.
    Batas soal ditentukan dari RANTAI TERPANJANG nomor berurutan, bukan
    dari asumsi bahwa soal pertama ada di awal halaman (banyak naskah
    punya halaman sampul).
    """
    kandidat = []
    for i, t in enumerate(baris_teks):
        m = AWAL_SOAL.match(t)
        if m: kandidat.append((i, int(m.group(1)), m.end(1) + 1))
    if not kandidat: return []
    # rantai terpanjang dengan nomor menaik +1
    terbaik, rantai = [], []
    for k in kandidat:
        if rantai and k[1] == rantai[-1][1] + 1: rantai.append(k)
        else:
            if len(rantai) > len(terbaik): terbaik = rantai
            rantai = [k]
    if len(rantai) > len(terbaik): terbaik = rantai
    if len(terbaik) < min_rantai: return []
    soal = []
    for j, (i, no, off) in enumerate(terbaik):
        akhir = terbaik[j+1][0] if j+1 < len(terbaik) else len(baris_teks)
        isi = [baris_teks[i][off:].strip()] + [x for x in baris_teks[i+1:akhir]]
        soal.append((no, '\n'.join(x for x in isi if x.strip())))
    return soal

def urai_opsi(teks):
    """Pisahkan batang soal dari opsi A-E.

    Menangani dua hal yang sempat salah: format berkurung "(A)", dan naskah
    opsi dua kolom yang membuat opsi berikutnya menempel di tengah baris
    ("0,5 mol   D. 2,0 mol") sehingga satu opsi menelan opsi lain.
    """
    baris, batang, opsi, kini = teks.split('\n'), [], {}, None
    def taruh(huruf, isi):
        nonlocal kini
        huruf = huruf.upper()
        if huruf not in opsi: opsi[huruf] = isi.strip()
        else: opsi[huruf] += ' ' + isi.strip()
        kini = huruf
    for b in baris:
        m = OPSI.match(b)
        sisa = None
        if m: huruf, sisa = m.group(1), m.group(2)
        elif kini: huruf, sisa = kini, b
        else: batang.append(b); continue
        # pecah opsi yang menempel di tengah baris
        potongan, pos, hrf = [], 0, huruf
        for mm in OPSI_SISIP.finditer(sisa):
            potongan.append((hrf, sisa[pos:mm.start()])); hrf = mm.group(1); pos = mm.end()
        potongan.append((hrf, sisa[pos:]))
        for h, isi in potongan:
            if isi.strip() or h not in opsi: taruh(h, isi)
    return '\n'.join(batang).strip(), opsi

if __name__ == '__main__':
    p = os.path.join(AKAR, sys.argv[1]) if not os.path.isabs(sys.argv[1]) else sys.argv[1]
    hal = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    for pno, W, baris in baris_halaman(p, hal, hal):
        teks, nkol = urutkan(W, baris)
        print(f"=== halaman {pno} · terdeteksi {nkol} kolom · {len(baris)} baris ===\n")
        for no, isi in potong(teks):
            batang, opsi = urai_opsi(isi)
            print(f"[soal {no}] {re.sub(chr(10),' ',batang)[:150]}")
            if opsi: print("   opsi: " + ' | '.join(f"{k}) {v[:32]}" for k,v in sorted(opsi.items())))
            print()
