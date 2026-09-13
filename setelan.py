#!/usr/bin/env python3
"""Setelan yang diingat antar pemakaian.

Nilai yang terakhir dipakai jadi bawaan berikutnya. Yang dikosongkan tetap
kosong — tidak ada nilai yang dipaksakan.
"""
import json, os
import lokasi

BERKAS = lokasi.data('setelan.json')

# Yang diingat. Sengaja TIDAK termasuk topik, judul, dan tanggal: ketiganya
# berbeda tiap lembar, jadi mengingatnya justru merepotkan.
# mapel, jenjang, dan kelas sengaja TIDAK diingat. Ketiganya berganti tiap
# lembar — satu lembar Fisika kelas 10 membuat lembar Matematika kelas 7
# berikutnya terisi salah diam-diam, dan salahnya baru ketahuan di kop PDF.
# Lebih aman kosong: Rico mengisinya sendiri kalau memang perlu.
MEDAN = ('jumlah', 'n_set', 'sulit', 'bahasa',
         'lembaga', 'sekolah', 'instruksi', 'kolom', 'kerapatan', 'garis',
         'printer', 'bolak', 'salinan', 'mata', 'mode', 'mesin')
# kunci dan pembahasan TIDAK diingat: keduanya selalu menyala saat halaman
# dibuka. Sekali dimatikan untuk satu lembar, dulu ia tetap mati diam-diam di
# lembar-lembar berikutnya — dan hilangnya kunci jawaban baru ketahuan setelah
# PDF-nya dicetak. Mematikannya untuk satu lembar tetap bisa; yang tidak lagi
# terjadi adalah mematikannya untuk selamanya tanpa disadari.
CENTANG = ('dua_berkas', 'gambar')

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
