#!/usr/bin/env python3
"""Tentukan halaman mana yang benar-benar perlu dibaca ulang model penglihatan.

Mengirim SEMUA halaman matematika ke VLM itu pemborosan: banyak yang teksnya
sudah utuh. Yang perlu hanya halaman dengan ciri rumus RUSAK.
"""
import os, re, sqlite3, sys
DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'exact.db')

AKAR_RUSAK = re.compile(r'\bV\d|\bV[a-z]\b|√\s')          # √ jadi V, atau √ menggantung
PECAHAN_RUSAK = re.compile(r'\b\d{1,3}\s+\d{1,3}\b')       # "30 1" = 1/30
PANGKAT_RATA = re.compile(r'[a-zA-Z]\s+[²³⁴]|[a-zA-Z]\s+\d\s')
SIMBOL = re.compile(r'[=+\-×÷<>≤≥∫∑√π°]')

def skor(teks):
    """0 = teksnya utuh, makin tinggi makin rusak."""
    if len(teks) < 60: return 0, {}
    kata = teks.split()
    if not kata: return 0, {}
    huruf = sum(c.isalpha() for c in teks)
    rasio_huruf = huruf / len(teks)
    pendek = sum(1 for w in kata if len(w) <= 2) / len(kata)
    n_simbol = len(SIMBOL.findall(teks)) / max(1, len(kata))
    tanda = {
        'akar_rusak':    len(AKAR_RUSAK.findall(teks)),
        'pecahan_rusak': len(PECAHAN_RUSAK.findall(teks)),
        'pangkat_rata':  len(PANGKAT_RATA.findall(teks)),
    }
    s = 0
    if rasio_huruf < 0.45: s += 2
    elif rasio_huruf < 0.55: s += 1
    if pendek > 0.45: s += 2
    elif pendek > 0.35: s += 1
    if n_simbol > 0.25: s += 2
    elif n_simbol > 0.12: s += 1
    if tanda['akar_rusak'] >= 2: s += 2
    if tanda['pecahan_rusak'] >= 4: s += 1
    if tanda['pangkat_rata'] >= 3: s += 1
    return s, tanda

if __name__ == '__main__':
    db = sqlite3.connect(DB)
    MAPEL_RUMUS = ('Matematika','Fisika','Kimia')
    print("memeriksa halaman berteks pada mapel berumus...", flush=True)
    q = """SELECT h.dok_id, h.no_hal, h.teks FROM halaman h JOIN dokumen d ON d.id=h.dok_id
           WHERE d.dup_dari IS NULL AND d.mapel IN (?,?,?)"""
    total = perlu = 0
    sebaran = {}
    perlu_list = []
    for dok_id, no_hal, teks in db.execute(q, MAPEL_RUMUS):
        total += 1
        s, _ = skor(teks)
        sebaran[s] = sebaran.get(s, 0) + 1
        if s >= 4:
            perlu += 1; perlu_list.append((dok_id, no_hal, s))
    print(f"\nhalaman mapel berumus (sudah berteks): {total:,}")
    print(f"sebaran skor kerusakan: {dict(sorted(sebaran.items()))}")
    print(f"\nperlu dibaca ulang VLM (skor >= 4): {perlu:,}  ({100*perlu//max(1,total)}%)")
    print(f"cukup pakai teks yang ada            : {total-perlu:,}")
    db.execute("CREATE TABLE IF NOT EXISTS antrean_vlm(dok_id INT, no_hal INT, skor INT, PRIMARY KEY(dok_id,no_hal))")
    db.executemany("INSERT OR REPLACE INTO antrean_vlm VALUES(?,?,?)", perlu_list)
    db.commit()
    for detik in (1.8, 4.0, 11.0):
        print(f"  @ {detik:4.1f} dtk/hal -> {perlu*detik/3600:5.1f} jam")
    db.close()
