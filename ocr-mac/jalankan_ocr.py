#!/usr/bin/env python3
"""OCR seluruh dokumen pindaian memakai framework Vision macOS.
Bisa dihentikan dan dilanjutkan — kemajuan tercatat di tabel halaman_ocr."""
import os, sys, json, sqlite3, subprocess, time, argparse
from concurrent.futures import ThreadPoolExecutor
AKAR = os.environ.get('EXACT_AKAR') or os.path.expanduser('~/Documents/EXACT COURSE')
DB   = os.environ.get('EXACT_DB')   or os.path.expanduser('~/Documents/PROJECT EXACT GROUP/Exact Worksheet/exact.db')
ALAT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'visionocr')

def olah(tugas):
    dok_id, rel, dpi = tugas
    p = os.path.join(AKAR, rel)
    if not os.path.isfile(p): return dok_id, []
    try:
        o = subprocess.run([ALAT, p, '1', '9999', str(dpi)], capture_output=True, timeout=1800)
    except Exception: return dok_id, []
    keluar = []
    for ln in o.stdout.decode('utf-8', 'replace').splitlines():
        try: d = json.loads(ln)
        except Exception: continue
        if len(d.get('teks','').strip()) >= 25:
            keluar.append((dok_id, d['hal'], d['teks'], d['yakin'], d['detik']))
    return dok_id, keluar

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pekerja', type=int, default=8)
    ap.add_argument('--dpi', type=int, default=200)
    ap.add_argument('--batas', type=int, default=0, help='0 = semua dokumen')
    a = ap.parse_args()

    db = sqlite3.connect(DB, timeout=60)
    db.executescript("""
      CREATE TABLE IF NOT EXISTS halaman_ocr(
        dok_id INT, no_hal INT, teks TEXT, yakin REAL, detik REAL,
        PRIMARY KEY(dok_id, no_hal));
      CREATE TABLE IF NOT EXISTS ocr_selesai(dok_id INT PRIMARY KEY, n_hal INT, kapan TEXT);
    """); db.commit()

    sudah = {r[0] for r in db.execute("SELECT dok_id FROM ocr_selesai")}
    tugas = [(r[0], r[1], a.dpi) for r in db.execute(
        "SELECT id, rel FROM dokumen WHERE dup_dari IS NULL AND n_hal_teks=0 ORDER BY n_hal ASC")
        if r[0] not in sudah]
    if a.batas: tugas = tugas[:a.batas]
    print(f"{len(tugas):,} dokumen menunggu ({len(sudah):,} sudah selesai) · "
          f"{a.pekerja} proses · {a.dpi} dpi", flush=True)

    t0 = time.time(); n_hal = 0
    with ThreadPoolExecutor(max_workers=a.pekerja) as ex:
        for i, (dok_id, hal) in enumerate(ex.map(olah, tugas), 1):
            if hal:
                db.executemany("INSERT OR REPLACE INTO halaman_ocr VALUES(?,?,?,?,?)", hal)
                n_hal += len(hal)
            db.execute("INSERT OR REPLACE INTO ocr_selesai VALUES(?,?,datetime('now'))",
                       (dok_id, len(hal)))
            db.commit()                     # simpan tiap dokumen: buku tebal
            if i % 100 == 0:                    # bisa makan puluhan menit sendiri
                dt = time.time()-t0
                sisa = (len(tugas)-i) * dt/i
                print(f"  {i}/{len(tugas)} dokumen · {n_hal:,} halaman · "
                      f"{n_hal/dt:.1f} hal/detik · sisa ~{sisa/60:.0f} menit", flush=True)
    db.commit()
    print(f"\nSELESAI {n_hal:,} halaman di-OCR dalam {(time.time()-t0)/60:.1f} menit")
    db.close()

if __name__ == '__main__': main()
