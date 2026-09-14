#!/usr/bin/env python3
"""Urai naskah berformat Exact Worksheet Maker jadi soal terstruktur.

Berbeda dari gemini_impor (yang menangani keluaran Gemini apa adanya), modul ini
memahami format penuh: bagian (PG)/(B)/(I)/(E), bobot nilai [n], sub-soal
berjenjang, blok Kunci Jawaban, dan blok Pembahasan. Dipakai untuk memasukkan
soal hasil generate ke bank soal supaya bisa dicari dan disusun ulang tanpa AI.
"""
import re, json

BAGIAN = re.compile(r'^\s*Bagian\s+([^:]{2,60}):\s*\((PG|B|I|E|M|IB)\)\s*$', re.I)
BUTIR = re.compile(r'^\s*(PG|B|I|E|M|IB)(\d{1,3})\.\s*(.*)$')
OPSI = re.compile(r'^\s*\(?([A-Ea-e])\s*[.)]\s*(.+)$')
SUB = re.compile(r'^\s*\((?:([a-h])|((?:i{1,3}|iv|v|vi{1,3})))\)\s*(.*)$')
BOBOT = re.compile(r'\s*\[(\d{1,2})\]\s*$')
KEPALA_KUNCI = re.compile(r'^\s*Kunci\s*Jawaban\s*:?\s*$', re.I)
KEPALA_BAHAS = re.compile(r'^\s*Pembahasan\s*:?\s*$', re.I)
SET = re.compile(r'^\s*SET\s+(\d+)\s*$', re.I)
# "PG1-B, I1-18, E1a-5x+2" — kode, tanda hubung, jawaban sampai koma berikutnya
PASANG = re.compile(r'\b((?:PG|B|I|E|M|IB)\d{1,3}[a-h]?(?:\.(?:i{1,3}|iv|v|vi{1,3}))?)\s*-\s*'
                    r'([^,]+?)(?=\s*,\s*(?:PG|B|I|E|M|IB)\d|\s*$)', re.S)

JENIS = {'PG': 'Pilihan Ganda', 'B': 'Benar/Salah', 'I': 'Isian Singkat',
         'E': 'Uraian', 'M': 'Menjodohkan', 'IB': 'Isian Berpilihan'}

def _bersih(t):
    return re.sub(r'\s{2,}', ' ', (t or '').strip())

def urai(teks):
    """Kembalikan (daftar_soal, meta). Tiap soal punya kode, jenis, batang,
    opsi, bobot, sub-soal, dan kunci bila ada.

    Naskah bisa memuat beberapa set ("SET 1", "SET 2", …), masing-masing dengan
    blok Kunci Jawaban dan Pembahasan sendiri. Dulu seluruh naskah dibaca
    sebagai satu aliran: begitu "Kunci Jawaban" set 1 lewat, semua baris set 2
    dianggap pembahasan — soal set 2 hilang, dan kuncinya (kode yang sama,
    PG1…) menimpa kunci set 1. Sekarang tiap set diurai sendiri-sendiri.
    """
    baris = teks.replace('\r', '').split('\n')
    potongan, kini_set, kini_baris = [], 1, []
    for b in baris:
        m = SET.match(b)
        if m:
            potongan.append((kini_set, kini_baris)); kini_set, kini_baris = int(m.group(1)), []
        else:
            kini_baris.append(b)
    potongan.append((kini_set, kini_baris))
    potongan = [(n, br) for n, br in potongan if any(x.strip() for x in br)] or [(1, baris)]
    soal, judul, n_kunci = [], '', 0
    for n, br in potongan:
        s, j, k = _urai_set(br, n)
        soal += s; n_kunci += k; judul = judul or j
    return soal, {'judul': judul, 'n_kunci': n_kunci, 'n_set': max([s['set'] for s in soal] or [1])}

def _urai_set(baris, set_ini=1):
    """Urai SATU set: soal, lalu blok Kunci Jawaban dan Pembahasan miliknya."""
    judul = next((b.strip() for b in baris[:4] if b.strip()), '')
    bagian_kunci, bagian_bahas = [], []
    isi, mode = [], 'soal'
    for b in baris:
        if KEPALA_KUNCI.match(b): mode = 'kunci'; continue
        if KEPALA_BAHAS.match(b): mode = 'bahas'; continue
        (isi if mode == 'soal' else bagian_kunci if mode == 'kunci' else bagian_bahas).append(b)

    kunci = {k.upper(): _bersih(v) for k, v in PASANG.findall('\n'.join(bagian_kunci))}
    bahas = {k.upper(): _bersih(v) for k, v in PASANG.findall('\n'.join(bagian_bahas))}

    soal, kini, huruf = [], None, None
    def tutup():
        nonlocal kini
        if kini:
            kini['batang'] = _bersih(kini['batang'])
            if len(kini['batang']) >= 5: soal.append(kini)
        kini = None

    for b in isi:
        if BAGIAN.match(b): tutup(); continue
        m = BUTIR.match(b)
        if m:
            tutup()
            sisa, bobot = m.group(3), None
            mb = BOBOT.search(sisa)
            if mb: bobot = int(mb.group(1)); sisa = sisa[:mb.start()]
            kini = {'kode': f'{m.group(1).upper()}{m.group(2)}', 'jenis': m.group(1).upper(),
                    'no': int(m.group(2)), 'batang': sisa, 'opsi': {}, 'bobot': bobot,
                    'sub': [], 'set': set_ini}
            huruf = None
            continue
        if kini is None: continue
        m = SUB.match(b)
        if m:
            sisa, bobot = m.group(3), None
            mb = BOBOT.search(sisa)
            if mb: bobot = int(mb.group(1)); sisa = sisa[:mb.start()]
            if m.group(1):
                huruf = m.group(1)
                kini['sub'].append({'label': huruf, 'teks': _bersih(sisa), 'bobot': bobot})
            else:
                kini['sub'].append({'label': f'{huruf or "a"}.{m.group(2)}',
                                    'teks': _bersih(sisa), 'bobot': bobot})
            continue
        m = OPSI.match(b)
        if m and kini['jenis'] in ('PG', 'IB'):
            kini['opsi'][m.group(1).upper()] = _bersih(m.group(2)); continue
        if kini['sub']: kini['sub'][-1]['teks'] += ' ' + b.strip()
        elif kini['opsi']:
            akhir = sorted(kini['opsi'])[-1]; kini['opsi'][akhir] += ' ' + b.strip()
        else: kini['batang'] += ' ' + b.strip()
    tutup()

    for s in soal:
        s['kunci'] = kunci.get(s['kode'], '')
        s['pembahasan'] = bahas.get(s['kode'], '')
        for sub in s['sub']:
            k = s['kode'] + sub['label'].replace('.', '.')
            if k.upper() in kunci: sub['kunci'] = kunci[k.upper()]
    return soal, judul, len(kunci)

def ke_naskah(daftar, judul='LEMBAR KERJA'):
    """Kebalikannya: susun soal terpilih jadi naskah siap ditempel ke
    Exact Worksheet Maker — inilah yang membuat penyusunan ulang tanpa AI."""
    per_jenis = {}
    for s in daftar: per_jenis.setdefault(s.get('jenis') or 'PG', []).append(s)
    baris = [judul, '']
    kunci = []
    for kode in ('PG', 'B', 'I', 'E', 'M', 'IB'):
        if kode not in per_jenis: continue
        baris.append(f'Bagian {JENIS[kode]}: ({kode})')
        for i, s in enumerate(per_jenis[kode], 1):
            bobot = f" [{s['bobot']}]" if s.get('bobot') else ''
            baris.append(f"{kode}{i}. {s['batang']}{bobot}")
            for h, v in sorted((s.get('opsi') or {}).items()):
                baris.append(f'{h}. {v}')
            for sub in (s.get('sub') or []):
                b2 = f" [{sub['bobot']}]" if sub.get('bobot') else ''
                baris.append(f"({sub['label']}) {sub['teks']}{b2}")
            if s.get('kunci'): kunci.append(f"{kode}{i}-{s['kunci']}")
        baris.append('')
    if kunci:
        baris += ['Kunci Jawaban', ', '.join(kunci)]
    return '\n'.join(baris)
