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
# Teks bacaan (lembar Bahasa Indonesia / Inggris): baris "Bacaan" sendirian
# sesudah judul lembar, lalu judul teks (opsional), lalu paragraf-paragrafnya,
# sampai bagian soal pertama. Ejaan yang diterima sama dengan wsm/app.js.
KEPALA_BACAAN = re.compile(r'^\s*(?:Reading\s*Passage|Reading\s*Text|Passage|Bacaan|'
                           r'Teks\s*Bacaan|Wacana)\s*(?:\d{1,2})?\s*:?\s*$', re.I)
# Batas akhir bacaan: kepala bagian apa pun (termasuk "Bagian A: (PG)" yang
# namanya satu huruf — BAGIAN di atas minta 2 huruf) atau butir soal pertama.
BATAS_BACAAN = re.compile(r'^\s*(?:Bagian|Section)\s+[^\n]{1,80}?:\s*(?:\([A-Za-z]{1,4}\))?\s*$', re.I)
KEPALA_BAHAS = re.compile(r'^\s*Pembahasan\s*:?\s*$', re.I)
SET = re.compile(r'^\s*SET\s+(\d+)\s*$', re.I)
# "PG1-B, I1-18, E1a-5x+2" — kode, tanda hubung, lalu isinya sampai PENANDA
# KODE BERIKUTNYA (atau habis). Dulu isinya dibatasi koma: cocok untuk kunci
# yang pendek, tapi blok Pembahasan dari Gemini datang tanpa pemisah sama
# sekali ("E1a-$...$E1b-$...$") dan kalimatnya penuh koma — hasilnya
# pembahasan terpotong di koma pertama, sisanya hilang, dan Exact Practice
# menerima "0 berpembahasan". Pemecah ini disamakan dengan pbRe/akRe milik
# Worksheet Maker (wsm/app.js), jadi PDF dan Practice membaca blok yang sama
# dengan cara yang sama. Koma pemisah di akhir isi dibuang di _pasang().
_KODE = r'(?:PG|IB|B|I|E|M)\d{1,3}[a-h]?(?:\.(?:i{1,3}|iv|v|vi{1,3}))?'
PASANG = re.compile(r'(?<![A-Za-z])(' + _KODE + r')\s*-\s*([\s\S]*?)(?=\s*,?\s*(?<![A-Za-z])'
                    + _KODE + r'\s*-|\s*$)')

def _pasang(teks):
    """{KODE: isi} dari blok Kunci Jawaban / Pembahasan."""
    return {k.upper(): _bersih(v).rstrip(',').strip() for k, v in PASANG.findall(teks)}

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
    bacaan = next((s.get('bacaan') for s in soal if s.get('bacaan')), None)
    return soal, {'judul': judul, 'n_kunci': n_kunci, 'n_set': max([s['set'] for s in soal] or [1]),
                  'bacaan': bacaan}

def _ambil_bacaan(isi):
    """Pisahkan blok teks bacaan dari baris-baris soal.

    Kembalikan (isi_tanpa_bacaan, bacaan|None); bacaan = {'judul', 'isi'}.
    Judul teks = paragraf pertama kalau pendek, satu baris, dan masih ada
    paragraf lain sesudahnya — aturan yang sama dengan wsm/app.js supaya PDF
    dan Practice membaca judul yang sama.
    """
    awal = next((i for i, b in enumerate(isi) if KEPALA_BACAAN.match(b)), None)
    if awal is None: return isi, None
    batas = next((i for i, b in enumerate(isi) if BATAS_BACAAN.match(b) or BUTIR.match(b)), len(isi))
    if awal >= batas: return isi, None
    blok = '\n'.join(isi[awal + 1:batas]).strip()
    para = [p.strip() for p in re.split(r'\n[ \t]*\n', blok) if p.strip()]
    judul = ''
    if len(para) > 1 and len(para[0]) <= 120 and '\n' not in para[0]:
        judul = para.pop(0)
    if not para: return isi[:awal] + isi[batas:], None
    return isi[:awal] + isi[batas:], {'judul': judul, 'isi': '\n\n'.join(para)}


def _urai_set(baris, set_ini=1):
    """Urai SATU set: soal, lalu blok Kunci Jawaban dan Pembahasan miliknya."""
    bagian_kunci, bagian_bahas = [], []
    isi, mode = [], 'soal'
    for b in baris:
        if KEPALA_KUNCI.match(b): mode = 'kunci'; continue
        if KEPALA_BAHAS.match(b): mode = 'bahas'; continue
        (isi if mode == 'soal' else bagian_kunci if mode == 'kunci' else bagian_bahas).append(b)
    isi, bacaan = _ambil_bacaan(isi)
    # Judul lembar = baris pertama yang berisi, dibaca SESUDAH bacaan dipisah
    # — kalau tidak, lembar tanpa judul yang langsung "Bacaan" berjudul "Bacaan".
    judul = next((b.strip() for b in isi[:4] if b.strip()), '')
    if BATAS_BACAAN.match(judul) or BUTIR.match(judul): judul = ''   # naskah tanpa judul

    kunci = _pasang('\n'.join(bagian_kunci))
    bahas = _pasang('\n'.join(bagian_bahas))

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
        # Bacaan menempel di tiap soal (bukan hanya di meta): Exact Practice
        # menyimpan soal satu per satu sebagai stimulus, dan bank soal juga.
        s['bacaan'] = bacaan
        for sub in s['sub']:
            k = (s['kode'] + sub['label']).upper()
            if k in kunci: sub['kunci'] = kunci[k]
            if k in bahas: sub['pembahasan'] = bahas[k]
        # Soal uraian berbagian: kunci dan pembahasannya per bagian (E1a-, E1b-).
        # Induknya ikut diisi gabungannya supaya tetap terbaca "berkunci" /
        # "berpembahasan" dan ikut ke Practice/bank soal sebagai satu teks.
        if not s['kunci'] and any(sub.get('kunci') for sub in s['sub']):
            s['kunci'] = '; '.join(f"({sub['label']}) {sub['kunci']}" for sub in s['sub'] if sub.get('kunci'))
        if not s['pembahasan'] and any(sub.get('pembahasan') for sub in s['sub']):
            s['pembahasan'] = '\n'.join(f"({sub['label']}) {sub['pembahasan']}" for sub in s['sub'] if sub.get('pembahasan'))
    return soal, judul, len(kunci)

def ke_naskah(daftar, judul='LEMBAR KERJA'):
    """Kebalikannya: susun soal terpilih jadi naskah siap ditempel ke
    Exact Worksheet Maker — inilah yang membuat penyusunan ulang tanpa AI."""
    per_jenis = {}
    for s in daftar: per_jenis.setdefault(s.get('jenis') or 'PG', []).append(s)
    baris = [judul, '']
    # Teks bacaan ikut ditulis ulang supaya paket dari Practice / bank soal
    # yang dicetak ulang tetap membawa bacaannya. Satu bacaan per naskah:
    # kalau soal-soalnya membawa bacaan berbeda, yang pertama yang dipakai.
    bacaan = next((s.get('bacaan') for s in daftar
                   if isinstance(s.get('bacaan'), dict) and (s['bacaan'].get('isi') or '').strip()), None)
    if bacaan:
        baris.append('Bacaan')
        # Judul teks dan paragraf pertama dipisah baris kosong — begitulah
        # pengurai (dan wsm/app.js) membedakan judul dari isi.
        if (bacaan.get('judul') or '').strip(): baris += [bacaan['judul'].strip(), '']
        baris += [bacaan['isi'].strip(), '']
    kunci = []
    bahas = []
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
            if s.get('pembahasan'): bahas.append(f"{kode}{i}-{s['pembahasan']}")
        baris.append('')
    if kunci:
        baris += ['Kunci Jawaban', ', '.join(kunci)]
    # Pembahasan dulu hilang di sini: soal membawa pembahasannya, tapi naskah
    # yang disusun tidak pernah menuliskannya, jadi PDF "kunci & pembahasan"
    # yang dicetak lewat /api/render keluar tanpa satu pun pembahasan. Satu
    # entri per baris -- pemecah di Worksheet Maker mencari penanda kode
    # berikutnya, bukan koma, jadi kalimat pembahasan boleh memuat koma.
    if bahas:
        baris += ['', 'Pembahasan'] + bahas
    return '\n'.join(baris)
