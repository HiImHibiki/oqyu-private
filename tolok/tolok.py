import sqlite3, subprocess, json, os, time, random
AKAR = os.path.expanduser('~/Documents/EXACT COURSE')
db = sqlite3.connect(os.path.expanduser('~/ExactSearch/exact.db'))
rows = db.execute("SELECT rel, n_hal FROM dokumen WHERE dup_dari IS NULL AND n_hal_teks=0 AND n_hal BETWEEN 2 AND 60").fetchall()
random.seed(5); sampel = random.sample(rows, 25)
t0 = time.time(); hal = 0; kosong = 0; yakin = []; huruf = 0
for rel, n in sampel:
    p = os.path.join(AKAR, rel)
    try:
        out = subprocess.run(['./visionocr', p, '1', '3', '200'], capture_output=True, timeout=180)
    except subprocess.TimeoutExpired:
        continue
    for ln in out.stdout.decode('utf-8','replace').splitlines():
        try: d = json.loads(ln)
        except Exception: continue
        hal += 1; yakin.append(d['yakin']); huruf += len(d['teks'])
        if len(d['teks'].strip()) < 40: kosong += 1
dt = time.time() - t0
print(f"{hal} halaman dari {len(sampel)} dokumen dalam {dt:.1f} detik")
print(f"  laju          : {hal/dt:.2f} halaman/detik  ({dt/hal:.2f} detik/halaman)")
print(f"  keyakinan rata: {sum(yakin)/len(yakin):.3f}")
print(f"  halaman kosong: {kosong} ({100*kosong//hal}%)")
print(f"  huruf/halaman : {huruf//hal:,}")
print(f"\n  perkiraan 62.000 halaman: {62000*dt/hal/3600:.1f} jam")
