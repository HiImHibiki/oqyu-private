import sys, os, json
sys.path.insert(0, os.path.expanduser('~/Documents/PROJECT EXACT GROUP/Exact Worksheet'))
from pecah_soal import baris_halaman, urutkan, potong, urai_opsi
from kolom import urutkan_kolom, cari_kolom
p = sys.argv[1]; h = int(sys.argv[2])
for pno, W, baris in baris_halaman(p, h, h):
    print(f"halaman {pno} · lebar {W:.0f}pt · {len(baris)} baris")
    print(f"batas kolom terdeteksi: {[round(x) for x in cari_kolom(W, baris)]}")
    for nama, fn in (("LAMA (potong di tengah)", urutkan), ("BARU (jurang N-kolom)", urutkan_kolom)):
        teks, nk = fn(W, baris)
        soal = potong(teks)
        rusak = 0; contoh = None
        for no, isi in soal:
            b, o = urai_opsi(isi)
            for v in o.values():
                import re
                if re.search(r'\s\d{1,2}\.\s+[A-Z]', v) or len(v) > 90:
                    rusak += 1
                    if not contoh: contoh = f"{no}: {v[:78]}"
                    break
        print(f"\n  {nama}: {nk} kolom · {len(soal)} soal · {rusak} beropsi bocor")
        if contoh: print(f"    contoh bocor -> {contoh}")
        for no, isi in soal[:2]:
            b, o = urai_opsi(isi)
            print(f"    [{no}] {b[:70].replace(chr(10),' ')}")
            if o: print(f"        " + ' | '.join(f'{k}) {v[:20]}' for k,v in sorted(o.items())))
