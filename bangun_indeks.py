#!/usr/bin/env python3
"""Ekstrak teks dari arsip EXACT COURSE ke basis data pencarian SQLite FTS5."""
import os, re, sys, sqlite3, subprocess, unicodedata
from concurrent.futures import ProcessPoolExecutor

AKAR = os.path.expanduser('~/Documents/EXACT COURSE')
DB   = os.path.expanduser('~/Documents/PROJECT EXACT GROUP/Exact Worksheet/exact.db')

JENJANG = [(r'\b(sd|grade\s*[1-6]\b|kelas\s*[1-6]\b|primary)\b','SD'),
           (r'\b(smp|grade\s*[7-9]\b|kelas\s*[7-9]\b|junior|g0?[789]\b)\b','SMP'),
           (r'\b(sma|grade\s*1[0-2]\b|kelas\s*1[0-2]\b|senior|a-?level|ial|as-?level)\b','SMA'),
           (r'\b(sbmptn|snbt|utbk|ptn)\b','SBMPTN')]
MAPEL = [(r'\b(math|matematika|mat\b|mtk|calculus|algebra)\b','Matematika'),
         (r'\b(phys|fisika|fis\b)\b','Fisika'),
         (r'\b(chem|kimia|kim\b)\b','Kimia'),
         (r'\b(bio|biologi)\b','Biologi'),
         (r'\b(ipa|science|sains)\b','IPA'),
         (r'\b(ips|sosial|geograf|ekonomi|sejarah)\b','IPS'),
         (r'\b(english|bing|b\.?\s*inggris)\b','B. Inggris'),
         (r'\b(indo|bindo|b\.?\s*indonesia)\b','B. Indonesia')]
JENIS = [(r'\b(pts|uts|mid)\b','PTS/UTS'), (r'\b(pas|uas|final|semester)\b','PAS/UAS'),
         (r'\b(unbk|un\b|ujian\s*nasional)\b','UN/UNBK'), (r'\b(try\s*out|to\b|tryout)\b','Try Out'),
         (r'\b(olimp|wmi|osn|kangaroo|imso)\b','Olimpiade'), (r'\b(remedial|remed)\b','Remedial'),
         (r'\b(latihan|exercise|worksheet|ws\b|lks)\b','Latihan'),
         (r'\b(edexcel|cambridge|igcse|ib\b|sat\b|ial)\b','Internasional')]

def label(teks, aturan):
    t = teks.lower()
    return next((v for pola, v in aturan if re.search(pola, t)), None)

def tahun(teks):
    m = re.findall(r'\b(19[89]\d|20[0-2]\d)\b', teks)
    return int(m[0]) if m else None

def olah(path):
    try:
        r = subprocess.run(['pdftotext','-layout','-enc','UTF-8',path,'-'],
                           capture_output=True, timeout=180)
        if r.returncode != 0: return (path, None, [])
        teks = r.stdout.decode('utf-8','replace')
    except Exception:
        return (path, None, [])
    halaman = [unicodedata.normalize('NFKC', h).strip() for h in teks.split('\f')]
    isi = [(i+1, h) for i, h in enumerate(halaman) if len(h) > 120]
    rel = os.path.relpath(path, AKAR)
    nama = os.path.basename(path)
    petunjuk = rel.replace('/', ' ')
    meta = dict(rel=rel, nama=nama,
                folder=rel.split('/')[0] if '/' in rel else '(akar)',
                jenjang=label(petunjuk, JENJANG), mapel=label(petunjuk, MAPEL),
                jenis=label(petunjuk, JENIS), tahun=tahun(petunjuk),
                ukuran=os.path.getsize(path), n_hal=len(halaman))
    return (path, meta, isi)

def main():
    batas = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    berkas = []
    for dp, _, fn in os.walk(AKAR):
        berkas += [os.path.join(dp, f) for f in fn if f.lower().endswith('.pdf')]
    berkas.sort()
    if batas: berkas = berkas[:batas]
    print(f"memproses {len(berkas)} PDF...", flush=True)

    if os.path.exists(DB): os.remove(DB)
    db = sqlite3.connect(DB)
    db.executescript("""
      PRAGMA journal_mode=WAL;
      CREATE TABLE dokumen(id INTEGER PRIMARY KEY, rel TEXT UNIQUE, nama TEXT, folder TEXT,
        jenjang TEXT, mapel TEXT, jenis TEXT, tahun INT, ukuran INT, n_hal INT, n_hal_teks INT);
      CREATE VIRTUAL TABLE halaman USING fts5(teks, dok_id UNINDEXED, no_hal UNINDEXED,
        tokenize='unicode61 remove_diacritics 2');
    """)
    ok = kosong = 0; total_hal = 0
    with ProcessPoolExecutor(max_workers=8) as ex:
        for n, (path, meta, isi) in enumerate(ex.map(olah, berkas, chunksize=4), 1):
            if meta is None: kosong += 1
            else:
                cur = db.execute("INSERT OR IGNORE INTO dokumen(rel,nama,folder,jenjang,mapel,jenis,tahun,ukuran,n_hal,n_hal_teks) VALUES(?,?,?,?,?,?,?,?,?,?)",
                    (meta['rel'],meta['nama'],meta['folder'],meta['jenjang'],meta['mapel'],
                     meta['jenis'],meta['tahun'],meta['ukuran'],meta['n_hal'],len(isi)))
                did = cur.lastrowid
                if isi:
                    db.executemany("INSERT INTO halaman(teks,dok_id,no_hal) VALUES(?,?,?)",
                                   [(t, did, no) for no, t in isi])
                    ok += 1; total_hal += len(isi)
                else: kosong += 1
            if n % 500 == 0:
                db.commit(); print(f"  {n}/{len(berkas)}  berteks:{ok} kosong:{kosong} halaman:{total_hal}", flush=True)
    db.commit()
    db.execute("INSERT INTO halaman(halaman) VALUES('optimize')"); db.commit()
    print(f"\nSELESAI  dokumen berteks:{ok}  tanpa teks (perlu OCR):{kosong}  halaman terindeks:{total_hal}")
    print(f"basis data: {DB}  ({os.path.getsize(DB)/1048576:.0f} MB)")
    db.close()

if __name__ == '__main__': main()
