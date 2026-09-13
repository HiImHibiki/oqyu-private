#!/usr/bin/env python3
"""Tahap 2: baca label dari isi dokumen + tandai duplikat."""
import os, re, sqlite3, hashlib, unicodedata
DB = os.path.expanduser('~/ExactSearch/exact.db')

ROMAWI = {'i':1,'ii':2,'iii':3,'iv':4,'v':5,'vi':6,'vii':7,'viii':8,'ix':9,'x':10,'xi':11,'xii':12}
EJAAN  = {'satu':1,'dua':2,'tiga':3,'empat':4,'lima':5,'enam':6,'tujuh':7,'delapan':8,
          'sembilan':9,'sepuluh':10,'sebelas':11,'duabelas':12,'dua belas':12}

MAPEL_KATA = {
 'Matematika': r'matematika|mathematic|\bmath\b|\bmtk\b|aljabar|trigonometri|kalkulus|geometri|bilangan bulat|persamaan kuadrat',
 'Fisika':     r'\bfisika\b|\bphysic|gaya gesek|energi kinetik|hukum newton|listrik dinamis|\bmomentum\b|gelombang bunyi',
 'Kimia':      r'\bkimia\b|\bchemistr|ikatan ion|stoikiometri|larutan elektrolit|tabel periodik|reaksi redoks',
 'Biologi':    r'\bbiologi\b|\bbiolog|fotosintesis|photosynthes|sel tumbuhan|ekosistem|jaringan epitel|mitosis',
 'IPA':        r'ilmu pengetahuan alam|\bipa\b|\bscience\b|\bsains\b',
 'IPS':        r'ilmu pengetahuan sosial|\bips\b|geografi|ekonomi|sejarah|sosiologi',
 'B. Inggris': r'bahasa inggris|\benglish\b|reading comprehension|the following text|choose the correct',
 'B. Indonesia': r'bahasa indonesia|kalimat efektif|teks eksposisi|majas|paragraf',
}
JENIS_KATA = [
 ('PAS/UAS',      r'penilaian akhir semester|ulangan akhir semester|\bpas\b|\buas\b|final exam|akhir tahun'),
 ('PTS/UTS',      r'penilaian tengah semester|ulangan tengah semester|\bpts\b|\buts\b|mid[- ]?term'),
 ('UN/UNBK',      r'ujian nasional|\bunbk\b|\busbn\b|ujian sekolah'),
 ('SBMPTN/UTBK',  r'\bsbmptn\b|\butbk\b|\bsnbt\b|seleksi bersama'),
 ('Olimpiade',    r'olimpiade|\bosn\b|\bwmi\b|kangaroo|\bimso\b|world mathematics|olympiad'),
 ('Internasional',r'edexcel|cambridge|igcse|\bib\b diploma|international a[- ]?level|\bial\b|pearson'),
 ('Try Out',      r'try[ -]?out|\bto\b ke|simulasi ujian'),
 ('Ulangan',      r'ulangan harian|\buh\b|quiz|kuis'),
 ('Latihan',      r'latihan soal|lembar kerja|worksheet|exercise|\blks\b'),
 ('Buku',         r'buku siswa|buku guru|kurikulum|daftar isi|bab \d|kata pengantar'),
]
SEKOLAH = r'penabur|laurensia|narada|josephina|tarakanita|pelita harapan|santa ursula|kolese|bpk|al[- ]azhar|regina pacis'

def norm(s): return unicodedata.normalize('NFKC', s or '').lower()

def dari_kepala(t):
    """Ambil label dari kepala dokumen: 'Mata Pelajaran : X', 'Kelas : IX'."""
    hasil = {}
    m = re.search(r'mata\s*pelajaran\s*[:.]?\s*([A-Za-z .\-]{3,40})', t, re.I)
    if m:
        v = norm(m.group(1))
        for nama, pola in MAPEL_KATA.items():
            if re.search(pola, v): hasil['mapel'] = nama; break
    m = re.search(r'\b(?:kelas|grade|tingkat)\s*[:.]?\s*([IVXivx]{1,4}|\d{1,2}|[a-z ]{3,12})\b', t, re.I)
    if m:
        v = norm(m.group(1)).strip()
        k = ROMAWI.get(v) or EJAAN.get(v) or (int(v) if v.isdigit() and 1 <= int(v) <= 12 else None)
        if k: hasil['kelas'] = k
    return hasil

def skor(t, aturan):
    best, bs = None, 0
    for nama, pola in (aturan.items() if isinstance(aturan, dict) else aturan):
        n = len(re.findall(pola, t, re.I))
        if n > bs: best, bs = nama, n
    return best if bs >= 2 else None

def main():
    db = sqlite3.connect(DB); db.row_factory = sqlite3.Row
    for kol, tipe in (('kelas','INT'),('sekolah','TEXT'),('sidik','TEXT'),('dup_dari','INT'),('asal_label','TEXT')):
        try: db.execute(f'ALTER TABLE dokumen ADD COLUMN {kol} {tipe}')
        except sqlite3.OperationalError: pass
    db.commit()

    docs = db.execute("SELECT id, rel, nama, jenjang, mapel, jenis, tahun FROM dokumen").fetchall()
    print(f"melabeli {len(docs)} dokumen...", flush=True)

    # SATU lintasan atas seluruh halaman; dok_id tak terindeks di FTS5,
    # jadi query per-dokumen akan memindai ulang seisi tabel (lambat sekali).
    print("  membaca seluruh halaman sekali jalan...", flush=True)
    kepala_teks, sidik_dok = {}, {}
    sisa = {}
    for dok_id, no_hal, teks in db.execute("SELECT dok_id, no_hal, teks FROM halaman"):
        h = sisa.get(dok_id)
        if h is None: h = sisa[dok_id] = hashlib.sha1()
        h.update(re.sub(r'\s+', ' ', teks).strip().encode())
        if no_hal <= 4:
            kepala_teks.setdefault(dok_id, []).append((no_hal, teks))
    sidik_dok = {k: v.hexdigest() for k, v in sisa.items()}
    print(f"  {len(sidik_dok)} dokumen punya teks", flush=True)

    sidik_ke_id = {}
    upd, n_dup, n_mapel, n_kelas = [], 0, 0, 0
    for i, d in enumerate(docs, 1):
        teks = '\n'.join(t for _, t in sorted(kepala_teks.get(d['id'], [])))
        sidik = sidik_dok.get(d['id'])
        dup = None
        if sidik:
            if sidik in sidik_ke_id: dup = sidik_ke_id[sidik]; n_dup += 1
            else: sidik_ke_id[sidik] = d['id']
        tl = norm(teks); petunjuk = norm(d['rel'] + ' ' + teks[:3000])
        kepala = dari_kepala(teks)
        mapel = kepala.get('mapel') or d['mapel'] or skor(tl, MAPEL_KATA)
        kelas = kepala.get('kelas')
        jenis = d['jenis'] or skor(petunjuk, JENIS_KATA)
        jenjang = d['jenjang'] or (('SD' if kelas <= 6 else 'SMP' if kelas <= 9 else 'SMA') if kelas else None)
        ms = re.search(SEKOLAH, petunjuk); sek = ms.group(0).title() if ms else None
        th = d['tahun']
        if not th:
            mt = re.search(r'\b(20[0-2]\d)\s*[/-]\s*20[0-2]\d\b|\b(20[0-2]\d)\b', teks[:1500])
            if mt: th = int(mt.group(1) or mt.group(2))
        asal = 'kepala' if kepala else ('nama' if d['mapel'] else 'isi')
        if mapel and not d['mapel']: n_mapel += 1
        if kelas: n_kelas += 1
        upd.append((jenjang, mapel, jenis, th, kelas, sek, sidik, dup, asal, d['id']))
        if i % 4000 == 0: print(f"  {i}/{len(docs)}", flush=True)
    db.executemany("""UPDATE dokumen SET jenjang=?,mapel=?,jenis=?,tahun=?,kelas=?,sekolah=?,
                      sidik=?,dup_dari=?,asal_label=? WHERE id=?""", upd)
    db.commit()
    print(f"\nSELESAI")
    print(f"  duplikat isi identik ditandai : {n_dup}")
    print(f"  mapel baru terdeteksi         : {n_mapel}")
    print(f"  kelas terbaca dari kepala     : {n_kelas}")
    db.close()

if __name__ == '__main__': main()
