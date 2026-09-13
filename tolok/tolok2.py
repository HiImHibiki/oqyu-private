import sqlite3, subprocess, json, os, time, random
from concurrent.futures import ThreadPoolExecutor
AKAR = os.path.expanduser('~/Documents/EXACT COURSE')
db = sqlite3.connect(os.path.expanduser('~/Documents/PROJECT EXACT GROUP/Exact Worksheet/exact.db'))
rows = db.execute("SELECT rel FROM dokumen WHERE dup_dari IS NULL AND n_hal_teks=0 AND n_hal BETWEEN 2 AND 60").fetchall()
random.seed(9)
def jalan(rel):
    try:
        o = subprocess.run(['./visionocr', os.path.join(AKAR, rel), '1', '3', '200'],
                           capture_output=True, timeout=180)
        return len(o.stdout.decode('utf-8','replace').splitlines())
    except Exception: return 0
for n_pekerja in (1, 4, 8):
    sampel = [r[0] for r in random.sample(rows, 24)]
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=n_pekerja) as ex:
        hal = sum(ex.map(jalan, sampel))
    dt = time.time() - t0
    print(f"  {n_pekerja} proses: {hal} halaman / {dt:.1f}s = {hal/dt:.2f} hal/detik"
          f"   -> 62.000 halaman dalam {62000*dt/hal/3600:.1f} jam")
