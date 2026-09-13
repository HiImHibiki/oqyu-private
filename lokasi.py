#!/usr/bin/env python3
"""Dua tempat yang berbeda sifatnya: kode yang dibaca, dan data yang ditulis.

Dulu keduanya satu folder — basis data, profil Chrome, setelan, dan naskah
semuanya tinggal di sebelah kodenya. Itu praktis selama aplikasinya dijalankan
dari folder sumber, tapi runtuh begitu aplikasinya dipasang ke /Applications:
bundel aplikasi tidak boleh ditulisi, dan kalau ditulisi pun isinya akan hilang
tiap kali aplikasinya dipasang ulang.

KODE   — tempat berkas .py, wsm/, statik/, dan alat OCR berada. Hanya dibaca.
DATA   — tempat exact.db, chrome-otomatis/, setelan.json, naskah/, dan thumb/.
         Berada di luar bundel supaya selamat melewati pemasangan ulang, dan
         supaya satu data yang sama dipakai baik saat dijalankan dari folder
         sumber maupun dari /Applications.
"""
import os

KODE = os.path.dirname(os.path.abspath(__file__))

# EXACT_DATA menimpa semuanya — dipakai saat menguji, atau kalau Rico ingin
# datanya di disk lain.
DATA = os.environ.get('EXACT_DATA')
if not DATA:
    # Application Support tidak dilindungi TCC seperti Desktop dan Documents,
    # jadi layanan launchd selalu boleh menulis di situ tanpa izin tambahan.
    DATA = os.path.expanduser('~/Library/Application Support/Exact Worksheet')
DATA = os.path.abspath(os.path.expanduser(DATA))

try:
    os.makedirs(DATA, exist_ok=True)
except OSError:
    pass


def data(*bagian):
    """Jalur di dalam folder data."""
    return os.path.join(DATA, *bagian)


def kode(*bagian):
    """Jalur di dalam folder kode."""
    return os.path.join(KODE, *bagian)
