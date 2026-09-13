#!/usr/bin/env python3
"""Setelan yang diingat antar pemakaian.

Nilai yang terakhir dipakai jadi bawaan berikutnya. Yang dikosongkan tetap
kosong — tidak ada nilai yang dipaksakan.
"""
import json, os

BERKAS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'setelan.json')

# Yang diingat. Sengaja TIDAK termasuk topik, judul, dan tanggal: ketiganya
# berbeda tiap lembar, jadi mengingatnya justru merepotkan.
MEDAN = ('mapel', 'jenjang', 'kelas', 'jumlah', 'n_set', 'sulit', 'bahasa',
         'lembaga', 'sekolah', 'instruksi', 'kolom', 'kerapatan', 'garis')
CENTANG = ('kunci', 'pembahasan', 'dua_berkas')

def muat():
    try:
        with open(BERKAS, encoding='utf-8') as f:
            d = json.load(f)
    except Exception:
        d = {}
    keluar = {k: str(d.get(k, '')) for k in MEDAN}
    for k in CENTANG:
        keluar[k] = bool(d.get(k, True))          # kunci & pembahasan menyala bawaannya
    return keluar

def simpan(medan):
    d = {k: (medan.get(k) or '').strip() for k in MEDAN}
    for k in CENTANG:
        d[k] = k in medan
    tmp = BERKAS + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
    os.replace(tmp, BERKAS)                       # tulis atomik: jangan sampai rusak separuh
    return d
