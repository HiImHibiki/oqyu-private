import os, sys, sqlite3, random
from concurrent.futures import ProcessPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pecah_soal import baris_halaman, urutkan, potong, urai_opsi, AKAR

def nilai(rel):
    try: hal = baris_halaman(os.path.join(AKAR, rel), 1, 8)
    except Exception: return (rel, 0, 0)
    pg = pl = 0
    for _, W, b in hal:
        teks, _ = urutkan(W, b)
        for no, isi in potong(teks):
            batang, opsi = urai_opsi(isi)
            if len(batang) < 15: continue
            pg += 1
            if len(opsi) >= 3: pl += 1
    return (rel, pg, pl)

if __name__ == '__main__':
    db = sqlite3.connect(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'exact.db'))
    rows = [r[0] for r in db.execute("""SELECT rel FROM dokumen WHERE dup_dari IS NULL AND n_hal_teks>1
            AND (jenis IN ('PAS/UAS','PTS/UTS','UN/UNBK','Try Out','Ulangan','Olimpiade','Internasional','SBMPTN/UTBK') OR jenis IS NULL)""")]
    random.seed(11); sampel = random.sample(rows, 300)
    with ProcessPoolExecutor(max_workers=8) as ex:
        h = list(ex.map(nilai, sampel, chunksize=3))
    n = len(h)
    ada = [x for x in h if x[1] >= 5]; nol = [x for x in h if x[1] == 0]
    print(f"  dokumen dengan >=5 soal (opsi ATAU uraian) : {len(ada):3d}  ({100*len(ada)//n}%)")
    print(f"  dokumen tanpa soal sama sekali             : {len(nol):3d}  ({100*len(nol)//n}%)")
    print(f"  total soal terpanen : {sum(x[1] for x in h)}   (ber-opsi: {sum(x[2] for x in h)})")
    print(f"  rata-rata/dokumen   : {sum(x[1] for x in h)/n:.1f}")
