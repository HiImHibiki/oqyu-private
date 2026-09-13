#!/usr/bin/env python3
"""Perintah dan pengurai untuk lembar pembahasan.

Formatnya sengaja BUKAN format naskah ujian: lembar ini untuk dibaca anak,
bukan dikerjakan. Jadi tiap soal langsung diikuti jawaban dan pembahasannya,
mengalir ke bawah, tanpa bagian kunci yang terpisah di belakang.
"""
import re

PERINTAH = """Kamu diberi naskah soal hasil pemindaian foto. Tugasmu BUKAN membuat soal baru.

Untuk SETIAP soal: tulis ulang soalnya, beri jawabannya, lalu jelaskan
langkah demi langkah dengan bahasa yang mudah dipahami anak {jenjang}.

Tulis PERSIS dengan susunan ini, diulang untuk tiap soal:

JUDUL: <judul singkat seluruh lembar, cukup sekali di paling atas>

SOAL 1
{tanya}
JAWAB: <jawaban singkat dan tegas>
BAHAS:
<penjelasan langkah demi langkah. Satu langkah satu paragraf. Mulai dari apa
yang diketahui, lalu rumus yang dipakai, lalu perhitungannya, lalu simpulannya.
Tulis seperti sedang menerangkan ke anak, bukan seperti catatan singkat.>

SOAL 2
...dan seterusnya.

Aturan:
- Rumus matematika, fisika, atau kimia dibungkus tanda dolar $...$
- Jangan memakai markdown: tanpa **tebal**, tanpa #, tanpa daftar bertanda -
- Kalau ada bagian foto yang tidak terbaca jelas, tulis apa adanya lalu
  tambahkan "(tidak terbaca jelas)" — JANGAN mengarang isinya
- Kalau soal punya gambar, tulis [GAMBAR: keterangan singkat] di posisinya
- Bahasa: {bahasa}
{catatan}
NASKAH HASIL PEMINDAIAN:
{naskah}"""

TANYA = "<tulis ulang soalnya apa adanya, termasuk pilihan jawabannya bila ada>"

def bangun(naskah, bahasa='Indonesia', catatan='', mapel='', kelas=''):
    tambahan = []
    if mapel: tambahan.append(f'Mata pelajaran: {mapel}.')
    if catatan.strip(): tambahan.append(catatan.strip())
    ket = ('\n' + ' '.join(tambahan) + '\n') if tambahan else '\n'
    jenjang = f'kelas {kelas}' if kelas else 'seusia itu'
    return PERINTAH.format(bahasa=bahasa, catatan=ket, naskah=naskah.strip()[:9000],
                           jenjang=jenjang, tanya=TANYA)

AWAL = re.compile(r'^\s*SOAL\s+(\d{1,3})\s*$', re.I)
JAWAB = re.compile(r'^\s*JAWAB\s*:\s*(.*)$', re.I)
BAHAS = re.compile(r'^\s*BAHAS\s*:?\s*(.*)$', re.I)
JUDUL = re.compile(r'^\s*JUDUL\s*:\s*(.+)$', re.I)

def urai(teks):
    """Kembalikan (judul, [{no, soal, jawab, bahas}])."""
    judul, butir, kini, bagian = '', [], None, None
    for b in (teks or '').replace('\r', '').split('\n'):
        m = JUDUL.match(b)
        if m and not judul:
            judul = m.group(1).strip(); continue
        m = AWAL.match(b)
        if m:
            if kini: butir.append(kini)
            kini = {'no': int(m.group(1)), 'soal': [], 'jawab': '', 'bahas': []}
            bagian = 'soal'; continue
        if kini is None: continue
        m = JAWAB.match(b)
        if m:
            kini['jawab'] = m.group(1).strip(); bagian = 'jawab'; continue
        m = BAHAS.match(b)
        if m:
            bagian = 'bahas'
            if m.group(1).strip(): kini['bahas'].append(m.group(1).strip())
            continue
        if bagian == 'soal': kini['soal'].append(b)
        elif bagian == 'bahas': kini['bahas'].append(b)
        elif bagian == 'jawab' and b.strip(): kini['jawab'] += ' ' + b.strip()
    if kini: butir.append(kini)
    for x in butir:
        x['soal'] = '\n'.join(x['soal']).strip()
        # paragraf dipisah baris kosong; baris tunggal disambung jadi satu alinea
        alinea, kini_p = [], []
        for b in x['bahas']:
            if b.strip(): kini_p.append(b.strip())
            elif kini_p: alinea.append(' '.join(kini_p)); kini_p = []
        if kini_p: alinea.append(' '.join(kini_p))
        x['bahas'] = [a for a in alinea if a]
    return judul, [x for x in butir if x['soal'] or x['bahas']]
