#!/usr/bin/env python3
"""Pilih soal paling sesuai dari bank soal secara otomatis.

Menggantikan mencentang satu per satu: sebutkan topik dan komposisinya, lalu
soal dipilihkan berdasarkan kecocokan teks, kelengkapan kunci jawaban, dan
kesesuaian mapel/kelas.
"""
import re, json, sqlite3

KOMPOSISI = re.compile(r'(\d{1,3})\s*(PG|B|I|E|Esai|Essay|Uraian|Isian|Benar)', re.I)
PETA = {'pg': 'PG', 'b': 'B', 'benar': 'B', 'i': 'I', 'isian': 'I',
        'e': 'E', 'esai': 'E', 'essay': 'E', 'uraian': 'E'}

def urai_komposisi(teks, bawaan=10):
    """'10 PG + 2 Esai' -> {'PG': 10, 'E': 2}. Kosong -> {'PG': bawaan}."""
    hasil = {}
    for n, jenis in KOMPOSISI.findall(teks or ''):
        k = PETA.get(jenis.lower())
        if k: hasil[k] = hasil.get(k, 0) + int(n)
    return hasil or {'PG': bawaan}

HENTI = set("""yang dan di ke dari untuk pada dengan adalah ini itu atau tidak dalam
the of and to in a is for are be on as by with an at soal""".split())

def _kunci_cari(teks, maks=10):
    kata = re.findall(r'[A-Za-zÀ-ÿ][A-Za-z0-9À-ÿ\-]{3,}', (teks or '').lower())
    urut, lihat = [], set()
    for w in kata:
        if w in HENTI or w in lihat: continue
        lihat.add(w); urut.append(w)
    return urut[:maks]

def pilih(db, topik='', mapel='', kelas=None, komposisi='', bawaan=10):
    """Kembalikan (daftar_soal, catatan). Soal berkunci lebih diutamakan."""
    db.row_factory = sqlite3.Row
    mau = urai_komposisi(komposisi, bawaan)
    kata = _kunci_cari(topik or mapel)
    terpilih, catatan = [], {}
    dipakai = set()

    for jenis, n in mau.items():
        baris = []
        # 1) cocok topik lewat pencarian teks
        if kata:
            try:
                baris = db.execute("""
                    SELECT s.* FROM soal_fts f JOIN soal s ON s.id=f.soal_id
                    JOIN dokumen d ON d.id=s.dok_id
                    WHERE soal_fts MATCH ? AND s.dup=0 AND s.jenis_soal=?
                      AND (? = '' OR d.mapel = ?) AND (? IS NULL OR d.kelas = ?)
                    ORDER BY (s.kunci IS NOT NULL) DESC, rank LIMIT ?""",
                    (' OR '.join(kata), jenis, mapel or '', mapel or '',
                     kelas, kelas, n * 3)).fetchall()
            except sqlite3.OperationalError:
                baris = []
        # 2) kalau kurang, longgarkan: abaikan topik, tetap hormati mapel/kelas
        if len(baris) < n:
            tambahan = db.execute("""
                SELECT s.* FROM soal s JOIN dokumen d ON d.id=s.dok_id
                WHERE s.dup=0 AND s.jenis_soal=?
                  AND (? = '' OR d.mapel = ?) AND (? IS NULL OR d.kelas = ?)
                ORDER BY (s.kunci IS NOT NULL) DESC, s.id DESC LIMIT ?""",
                (jenis, mapel or '', mapel or '', kelas, kelas, n * 4)).fetchall()
            baris = list(baris) + [b for b in tambahan]
        # 3) masih kurang juga: lepaskan saringan mapel/kelas
        if len(baris) < n:
            baris += db.execute("""
                SELECT s.* FROM soal s WHERE s.dup=0 AND s.jenis_soal=?
                ORDER BY (s.kunci IS NOT NULL) DESC, s.id DESC LIMIT ?""",
                (jenis, n * 4)).fetchall()

        ambil = []
        for b in baris:
            if b['id'] in dipakai: continue
            dipakai.add(b['id']); ambil.append(b)
            if len(ambil) >= n: break
        catatan[jenis] = {'diminta': n, 'didapat': len(ambil)}
        terpilih += ambil

    return terpilih, catatan
