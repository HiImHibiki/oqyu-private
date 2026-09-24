#!/usr/bin/env python3
"""Ukur berapa persen dokumen yang bisa dipecah jadi soal satuan."""
import os, sys, sqlite3, random, re
from concurrent.futures import ProcessPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pecah_soal import baris_halaman, urutkan, potong, urai_opsi, AKAR

def nilai(rel):
    p = os.path.join(AKAR, rel)
    try: hal = baris_halaman(p, 1, 8)
    except Exception: return (rel, 0, 0, 0)
    n_soal = n_lengkap = 0; kolom2 = 0
    for pno, W, baris in hal:
        teks, nk = urutkan(W, baris)
        if nk == 2: kolom2 += 1
        for no, isi in potong(teks):
            batang, opsi = urai_opsi(isi)
            if len(batang) < 8: continue
            n_soal += 1
            if len(opsi) >= 3 and all(len(v) > 0 for v in opsi.values()): n_lengkap += 1
    return (rel, n_soal, n_lengkap, kolom2)

if __name__ == '__main__':
    db = sqlite3.connect(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'exact.db'))
    rows = [r[0] for r in db.execute("""SELECT rel FROM dokumen WHERE dup_dari IS NULL AND n_hal_teks>1
            AND (jenis IN ('PAS/UAS','PTS/UTS','UN/UNBK','Try Out','Ulangan','Olimpiade','Internasional','SBMPTN/UTBK')
                 OR jenis IS NULL)""")]
    random.seed(11); sampel = random.sample(rows, min(300, len(rows)))
    print(f"menguji {len(sampel)} dokumen...", flush=True)
    hasil = []
    with ProcessPoolExecutor(max_workers=8) as ex:
        for i, h in enumerate(ex.map(nilai, sampel, chunksize=3), 1):
            hasil.append(h)
            if i % 100 == 0: print(f"  {i}/{len(sampel)}", flush=True)
    baik   = [h for h in hasil if h[2] >= 5]
    sedang = [h for h in hasil if 1 <= h[2] < 5]
    nol    = [h for h in hasil if h[2] == 0]
    n = len(hasil)
    print(f"\n─── hasil atas 6 halaman pertama tiap dokumen ───")
    print(f"  panen bagus (≥5 soal berooptions) : {len(baik):3d}  ({100*len(baik)//n}%)")
    print(f"  sebagian     (1-4 soal)           : {len(sedang):3d}  ({100*len(sedang)//n}%)")
    print(f"  gagal total  (0 soal)             : {len(nol):3d}  ({100*len(nol)//n}%)")
    tot = sum(h[2] for h in hasil)
    print(f"  total soal lengkap terpanen       : {tot}  (rata-rata {tot/n:.1f}/dokumen)")
    print(f"  halaman dua kolom                 : {sum(h[3] for h in hasil)}")
    print(f"\n  contoh panen terbaik:")
    for rel, s, l, k in sorted(hasil, key=lambda h:-h[2])[:5]:
        print(f"    {l:3d} soal  {os.path.basename(rel)[:58]}")
