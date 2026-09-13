#!/usr/bin/env python3
"""Tahap 3: panen soal satuan dari seluruh arsip ke tabel `soal`."""
import os, sys, re, json, sqlite3, hashlib
import lokasi
from concurrent.futures import ProcessPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pecah_soal import baris_halaman, urutkan, potong, urai_opsi, AKAR
DB = lokasi.data('exact.db')

ISYARAT = re.compile(r'\?|\.\.\.|…|\badalah\b|\bberapa\b|\bhitung|\btentukan\b|\bjelaskan\b|'
                     r'\bsebutkan\b|\btuliskan\b|\bmengapa\b|\bcarilah?\b|\bfind\b|\bcalculate\b|'
                     r'\bwhat\b|\bwhich\b|\bhow\b|\bwhy\b|\bdetermine\b|\bsolve\b|\bexplain\b', re.I)

def mutu(batang, n_opsi):
    """2 = pilihan ganda utuh, 1 = uraian yang masuk akal, 0 = serpihan."""
    kata = batang.split()
    if n_opsi >= 3: return 2 if len(kata) >= 3 else 0
    if len(kata) < 6: return 0
    huruf = sum(c.isalpha() for c in batang)
    if huruf < 0.45 * len(batang): return 0          # didominasi angka/simbol lepas
    return 1 if ISYARAT.search(batang) else 0

def bersih(t):
    t = re.sub(r'^\s*(Downloaded from|http\S+)\s*$', '', t, flags=re.M|re.I)
    return re.sub(r'[ \t]{2,}', ' ', t).strip()

def panen(arg):
    dok_id, rel = arg
    try: hal = baris_halaman(os.path.join(AKAR, rel))
    except Exception: return dok_id, []
    keluar = []
    for pno, W, baris in hal:
        teks, _ = urutkan(W, baris)
        for no, isi in potong(teks):
            batang, opsi = urai_opsi(isi)
            batang = bersih(batang)
            if not (15 <= len(batang) <= 3000): continue
            opsi = {k: bersih(v)[:600] for k, v in opsi.items() if v.strip()}
            m = mutu(batang, len(opsi))
            if m == 0: continue
            sidik = hashlib.sha1(re.sub(r'\W+','', batang.lower())[:300].encode()).hexdigest()
            keluar.append((pno, no, batang[:3000], json.dumps(opsi, ensure_ascii=False), len(opsi), sidik, m))
    return dok_id, keluar

if __name__ == '__main__':
    db = sqlite3.connect(DB)
    db.executescript("""
      DROP TABLE IF EXISTS soal; DROP TABLE IF EXISTS soal_fts;
      CREATE TABLE soal(id INTEGER PRIMARY KEY, dok_id INT, no_hal INT, no_soal INT,
        batang TEXT, opsi TEXT, n_opsi INT, sidik TEXT, mutu INT, dup INT DEFAULT 0);
      CREATE INDEX i_soal_dok ON soal(dok_id);
      CREATE INDEX i_soal_sidik ON soal(sidik);
    """)
    tugas = db.execute("SELECT id, rel FROM dokumen WHERE dup_dari IS NULL AND n_hal_teks>0").fetchall()
    print(f"memanen dari {len(tugas)} dokumen...", flush=True)
    n = 0
    with ProcessPoolExecutor(max_workers=8) as ex:
        for i, (dok_id, soal) in enumerate(ex.map(panen, tugas, chunksize=2), 1):
            if soal:
                db.executemany("INSERT INTO soal(dok_id,no_hal,no_soal,batang,opsi,n_opsi,sidik,mutu) VALUES(?,?,?,?,?,?,?,?)",
                               [(dok_id,)+s for s in soal])
                n += len(soal)
            if i % 400 == 0: db.commit(); print(f"  {i}/{len(tugas)}  soal:{n}", flush=True)
    db.commit()
    # tandai soal kembar (batang identik) — simpan yang pertama
    db.execute("""UPDATE soal SET dup=1 WHERE id NOT IN (SELECT MIN(id) FROM soal GROUP BY sidik)""")
    db.commit()
    db.executescript("""
      CREATE VIRTUAL TABLE soal_fts USING fts5(batang, opsi, soal_id UNINDEXED,
        tokenize='unicode61 remove_diacritics 2');
    """)
    db.execute("INSERT INTO soal_fts(batang,opsi,soal_id) SELECT batang,opsi,id FROM soal WHERE dup=0")
    db.commit()
    tot = db.execute("SELECT COUNT(*) FROM soal").fetchone()[0]
    unik = db.execute("SELECT COUNT(*) FROM soal WHERE dup=0").fetchone()[0]
    pg = db.execute("SELECT COUNT(*) FROM soal WHERE dup=0 AND mutu=2").fetchone()[0]
    ur = db.execute("SELECT COUNT(*) FROM soal WHERE dup=0 AND mutu=1").fetchone()[0]
    print(f"\nSELESAI  total:{tot}  unik:{unik}  pilihan ganda:{pg}  uraian:{ur}")
    db.close()
