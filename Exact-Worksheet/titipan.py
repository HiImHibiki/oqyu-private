#!/usr/bin/env python3
"""Titipan berkas sementara.

Kiriman dari aplikasi Android tidak langsung dikerjakan: berkasnya dititipkan
dulu, lalu halaman aplikasi dibuka dengan berkas itu sudah terpasang. Dengan
begitu kriteria dan acuan masih bisa dilengkapi sebelum lembar dibuat.
"""
import threading, time, uuid

_KUNCI = threading.Lock()
_ISI = {}          # id -> {'berkas': [(nama, bytes)], 'mode': str, 'kapan': float}
UMUR = 3600        # titipan lebih tua dari sejam dibuang

def _bersihkan():
    batas = time.time() - UMUR
    for k in [k for k, v in _ISI.items() if v['kapan'] < batas]:
        _ISI.pop(k, None)

def titip(berkas, mode='buat'):
    with _KUNCI:
        _bersihkan()
        kode = uuid.uuid4().hex[:10]
        _ISI[kode] = {'berkas': list(berkas), 'mode': mode, 'kapan': time.time()}
        return kode

def lihat(kode):
    with _KUNCI:
        d = _ISI.get(kode)
        return dict(d) if d else None

def ambil(kode):
    """Ambil sekaligus hapus — dipakai saat lembarnya benar-benar dibuat."""
    with _KUNCI:
        return _ISI.pop(kode, None)

def berkas_ke(kode, urutan):
    d = lihat(kode)
    if not d or urutan >= len(d['berkas']): return None
    return d['berkas'][urutan]
