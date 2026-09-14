"""Terbitkan lembar ke Exact Practice.

Guru membuat lembar seperti biasa di Exact Worksheet; satu tombol mengirim
butir soalnya (naskah yang sama dengan yang dicetak) ke Exact Practice, yang
menjadikannya paket latihan online. Naskah tiap lembar sudah tersimpan di
folder naskah/ dengan nama "<nama pdf> — <cap>.txt", jadi lembar lama pun bisa
diterbitkan dari tab Hasil — tanpa memanggil Gemini lagi.
"""
import glob, json, os, re, urllib.request, urllib.error
import lokasi

# Berkas sendiri, BUKAN setelan.json: setelan.simpan() menulis ulang berkas
# itu hanya dengan medan borang, jadi kunci yang dititipkan di sana hilang
# begitu pemakai menyimpan pengaturan — itulah yang terjadi 2026-09-14.
BERKAS = lokasi.data('practice.json')


def _setelan():
    """{'url': ..., 'kunci': ...} dari practice.json (fallback: setelan.json lama)."""
    for jalur, peta in ((BERKAS, {'url': 'url', 'kunci': 'kunci'}),
                        (lokasi.data('setelan.json'), {'url': 'practice_url', 'kunci': 'practice_kunci'})):
        try:
            with open(jalur, encoding='utf-8') as f:
                d = json.load(f)
            if d.get(peta['kunci']):
                return {'practice_url': d.get(peta['url']), 'practice_kunci': d.get(peta['kunci'])}
        except (OSError, ValueError):
            continue
    return {}


def _dasar(nama_pdf):
    """'MATH-7-1409-2 - Soal+Jawaban.pdf' -> 'MATH-7-1409-2'."""
    d = os.path.basename(nama_pdf or '')
    d = re.sub(r'\.pdf$', '', d, flags=re.I)
    return re.sub(r' - Soal\+Jawaban$', '', d)


def naskah_untuk(nama_pdf):
    """Naskah terbaru yang cocok dengan nama PDF, atau None."""
    import buat
    dasar = _dasar(nama_pdf)
    if not dasar: return None
    # Lembar berkunci disimpan dengan akhiran ' - Soal+Jawaban' di namanya.
    calon = (glob.glob(os.path.join(buat.NASKAH, glob.escape(dasar) + ' — *.txt'))
             + glob.glob(os.path.join(buat.NASKAH, glob.escape(dasar) + ' - Soal+Jawaban — *.txt')))
    if not calon: return None
    calon.sort(key=os.path.getmtime)
    with open(calon[-1], encoding='utf-8') as f:
        return f.read()


def _mapel_dari_kode(kode):
    import buat
    balik = {}
    for nama, k in getattr(buat, 'SINGKATAN', {}).items():
        balik.setdefault(k, nama.title())
    return balik.get((kode or '').upper(), kode or '')


def meta_dari_nama(dasar):
    """Balikan nama_berkas(): MAPEL[-SEKOLAH]-KELAS-TGL-N."""
    bagian = dasar.split('-')
    # Hanya nama berpola kode (MATH-7-1409-2) yang dibaca; judul bebas seperti
    # "Uji Dua PDF Lagi" bukan mata pelajaran.
    if len(bagian) >= 4 and bagian[-1].isdigit() and bagian[-2].isdigit() and ' ' not in bagian[0]:
        return _mapel_dari_kode(bagian[0]), bagian[-3]
    return '', ''


def terbitkan(teks, nama_pdf='', judul='', durasi=None, mapel='', kelas='', topik=''):
    """Urai naskah lalu kirim ke Exact Practice. Mengembalikan dict jawaban."""
    import buat, naskah
    s = _setelan()
    url = (s.get('practice_url') or os.environ.get('EXACT_PRACTICE_URL') or 'http://127.0.0.1:8770').rstrip('/')
    kunci = s.get('practice_kunci') or os.environ.get('EXACT_PRACTICE_KUNCI') or ''
    if not kunci:
        return {'galat': 'Kunci Exact Practice belum diatur — isi "kunci" di practice.json (folder data Exact Worksheet).'}
    butir, meta = naskah.urai(teks or '')
    if not butir:
        return {'galat': 'Naskah tidak berisi soal yang bisa diurai.'}
    dasar = _dasar(nama_pdf)
    m2, k2 = meta_dari_nama(dasar) if dasar else ('', '')
    pdf = f'{dasar}.pdf' if dasar and os.path.exists(os.path.join(buat.KELUAR, f'{dasar}.pdf')) else None
    pdf_kunci = f'{dasar} - Soal+Jawaban.pdf' if dasar and os.path.exists(os.path.join(buat.KELUAR, f'{dasar} - Soal+Jawaban.pdf')) else None
    if pdf is None and pdf_kunci is not None: pdf = pdf_kunci   # satu berkas berkunci saja
    kiriman = {
        'judul': (judul or meta.get('judul') or dasar or 'Lembar latihan').strip(),
        'mapel': mapel or m2, 'kelas': kelas or k2, 'topik': topik or judul or meta.get('judul') or '',
        # Kosong = Practice menghitung sendiri per set (2 menit x jumlah soal set itu).
        'durasiMenit': int(durasi) if str(durasi or '').isdigit() else None,
        'butir': butir, 'pdf': pdf, 'pdfKunci': pdf_kunci,
    }
    req = urllib.request.Request(f'{url}/api/latihan/terbit', data=json.dumps(kiriman).encode(),
                                 headers={'Content-Type': 'application/json', 'x-exact-kunci': kunci}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read().decode())
        except ValueError: return {'galat': f'Exact Practice menjawab HTTP {e.code}'}
    except (urllib.error.URLError, OSError) as e:
        return {'galat': f'Exact Practice tidak bisa dihubungi ({e}). Pastikan layanannya jalan di port 8770.'}
