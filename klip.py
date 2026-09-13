#!/usr/bin/env python3
"""Ambil gambar dari papan klip macOS.

Tempel di peramban bisa gagal karena halaman tidak sedang fokus, atau karena
versi halaman yang lama masih tersimpan. Server ini jalan di Mac yang sama,
jadi papan klipnya bisa dibaca langsung — jauh lebih andal.
"""
import subprocess, binascii

def ambil_png():
    """Kembalikan byte PNG dari papan klip, atau None."""
    for kelas in ('«class PNGf»', '«class TIFF»'):
        r = subprocess.run(
            ['osascript', '-e', f'the clipboard as {kelas}'],
            capture_output=True, timeout=30)
        keluar = r.stdout.decode('utf-8', 'replace').strip()
        if not keluar.startswith('«data '): continue
        hexs = keluar[keluar.index('«data ') + 6:].rstrip('»')[4:]   # buang kode jenis 4 huruf (PNGf / TIFF)
        try: mentah = binascii.unhexlify(hexs)
        except Exception: continue
        if kelas.startswith('«class PNG'): return mentah
        # TIFF -> PNG lewat sips supaya peramban bisa menampilkannya
        import tempfile, os
        with tempfile.NamedTemporaryFile(suffix='.tiff', delete=False) as f:
            f.write(mentah); asal = f.name
        tujuan = asal + '.png'
        try:
            subprocess.run(['sips', '-s', 'format', 'png', asal, '--out', tujuan],
                           capture_output=True, timeout=60)
            if os.path.isfile(tujuan): return open(tujuan, 'rb').read()
        finally:
            for x in (asal, tujuan):
                try: os.unlink(x)
                except OSError: pass
    return None
