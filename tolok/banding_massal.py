import sys, os, re, json
from concurrent.futures import ProcessPoolExecutor
sys.path.insert(0, os.path.expanduser('~/ExactSearch'))
from pecah_soal import baris_halaman, urutkan, potong, urai_opsi
from kolom import urutkan_kolom
AKAR = os.path.expanduser('~/Documents/EXACT COURSE')
BOCOR = re.compile(r'\s\d{1,2}\.\s+[A-Z]')

def nilai_teks(teks):
    soal = potong(teks); rusak = 0; ok = 0
    for no, isi in soal:
        b, o = urai_opsi(isi)
        if len(o) < 3: continue
        if any(BOCOR.search(v) or len(v) > 90 for v in o.values()): rusak += 1
        else: ok += 1
    return len(soal), ok, rusak

def kerjakan(t):
    rel, hal = t
    try: hasil = baris_halaman(os.path.join(AKAR, rel), hal, hal)
    except Exception: return None
    if not hasil: return None
    _, W, baris = hasil[0]
    if not baris: return None
    lama = nilai_teks(urutkan(W, baris)[0])
    baru_t, nk = urutkan_kolom(W, baris)
    baru = nilai_teks(baru_t)
    return lama, baru, nk

if __name__ == '__main__':
    tugas = []
    for ln in open('/tmp/halaman_cacat.txt'):
        n, hal, rel = ln.rstrip('\n').split('\t', 2)
        tugas.append((rel, int(hal)))
    tugas = tugas[:250]
    with ProcessPoolExecutor(max_workers=8) as ex:
        hasil = [h for h in ex.map(kerjakan, tugas, chunksize=2) if h]
    L = [sum(x[0][i] for x in hasil) for i in range(3)]
    B = [sum(x[1][i] for x in hasil) for i in range(3)]
    from collections import Counter
    kol = Counter(x[2] for x in hasil)
    print(f"{len(hasil)} halaman bercacat diuji\n")
    print(f"{'':22s}{'LAMA':>10s}{'BARU':>10s}")
    print(f"{'soal terpotong':22s}{L[0]:>10d}{B[0]:>10d}")
    print(f"{'opsi BERSIH':22s}{L[1]:>10d}{B[1]:>10d}")
    print(f"{'opsi bocor':22s}{L[2]:>10d}{B[2]:>10d}")
    if L[1]+L[2]: print(f"{'% bersih':22s}{100*L[1]//max(1,L[1]+L[2]):>9d}%{100*B[1]//max(1,B[1]+B[2]):>9d}%")
    print(f"\nkolom terdeteksi versi baru: {dict(sorted(kol.items()))}")
