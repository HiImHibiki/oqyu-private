#!/usr/bin/env python3
"""Gabungkan hasil OCR ke indeks utama supaya ikut tercari dan ikut terpanen.

Dijalankan SETELAH jalankan_ocr.py selesai. Aman diulang.
"""
import os, sqlite3, sys
DB = os.path.expanduser('~/ExactSearch/exact.db')

def main(kering=False):
    db = sqlite3.connect(DB, timeout=60)
    db.execute("CREATE TABLE IF NOT EXISTS halaman_sumber(dok_id INT, no_hal INT, sumber TEXT, PRIMARY KEY(dok_id,no_hal))")
    sudah = {(d, h) for d, h in db.execute("SELECT dok_id, no_hal FROM halaman_sumber WHERE sumber='ocr'")}
    baris = db.execute("""SELECT o.dok_id, o.no_hal, o.teks FROM halaman_ocr o
                          JOIN dokumen d ON d.id=o.dok_id
                          WHERE d.dup_dari IS NULL AND length(trim(o.teks)) >= 120""").fetchall()
    baru = [r for r in baris if (r[0], r[1]) not in sudah]
    dok = sorted({r[0] for r in baru})
    print(f"halaman OCR layak    : {len(baris):,}")
    print(f"belum tergabung      : {len(baru):,}  dari {len(dok):,} dokumen")
    if kering: return
    db.executemany("INSERT INTO halaman(teks,dok_id,no_hal) VALUES(?,?,?)",
                   [(t, d, h) for d, h, t in baru])
    db.executemany("INSERT OR REPLACE INTO halaman_sumber VALUES(?,?,'ocr')",
                   [(d, h) for d, h, _ in baru])
    db.executemany("UPDATE dokumen SET n_hal_teks=(SELECT COUNT(*) FROM halaman_ocr o WHERE o.dok_id=?) WHERE id=?",
                   [(d, d) for d in dok])
    db.commit()
    db.execute("INSERT INTO halaman(halaman) VALUES('optimize')")
    db.commit()
    n = db.execute("SELECT COUNT(*) FROM dokumen WHERE dup_dari IS NULL AND n_hal_teks>0").fetchone()[0]
    h = db.execute("SELECT SUM(n_hal_teks) FROM dokumen WHERE dup_dari IS NULL").fetchone()[0]
    print(f"\nSELESAI · dokumen berteks kini {n:,} · total halaman {h:,}")
    db.close()

if __name__ == '__main__':
    main(kering='--kering' in sys.argv)
