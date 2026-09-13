#!/usr/bin/env python3
"""Perintah dan pengurai untuk lembar pembahasan.

Formatnya sengaja BUKAN format naskah ujian: lembar ini untuk dibaca anak,
bukan dikerjakan. Jadi tiap soal langsung diikuti jawaban dan pembahasannya,
mengalir ke bawah, tanpa bagian kunci yang terpisah di belakang.
"""
import re

PERINTAH = """Kamu diberi {sumber}. Tugasmu BUKAN membuat soal baru.

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
- Kalau ada bagian yang tidak terbaca jelas, tulis apa adanya lalu
  tambahkan "(tidak terbaca jelas)" — JANGAN mengarang isinya
- Kalau soal punya gambar, tulis [GAMBAR: keterangan singkat] di posisinya
- Bahasa: {bahasa}
{catatan}{naskah}"""

TANYA = "<tulis ulang soalnya apa adanya, termasuk pilihan jawabannya bila ada>"

def bangun(naskah, bahasa='Indonesia', catatan='', mapel='', kelas='',
           ada_lampiran=False):
    """Susun perintah pembahasan.

    ada_lampiran menandai bahwa fotonya sendiri ikut diunggah ke Gemini. Itu
    mengubah sumber soal: tanpa lampiran Gemini hanya punya teks hasil OCR,
    dengan lampiran ia melihat gambar, diagram, dan tulisan tangannya langsung.
    """
    tambahan = []
    if mapel: tambahan.append(f'Mata pelajaran: {mapel}.')
    if catatan.strip(): tambahan.append(catatan.strip())
    ket = ('\n' + ' '.join(tambahan) + '\n') if tambahan else '\n'
    jenjang = f'kelas {kelas}' if kelas else 'seusia itu'
    naskah = (naskah or '').strip()[:9000]
    if ada_lampiran and naskah:
        sumber = ('foto naskah soal yang terlampir, beserta hasil pemindaian '
                  'teksnya sebagai pembanding ejaan')
        blok = ('\nBacalah soalnya dari FOTO. Hasil pemindaian di bawah ini hanya '
                'pembanding; bila keduanya berbeda, yang benar adalah foto.\n\n'
                'HASIL PEMINDAIAN:\n' + naskah)
    elif ada_lampiran:
        sumber = 'foto naskah soal yang terlampir'
        blok = ('\nBacalah soalnya langsung dari foto, termasuk gambar, diagram, '
                'grafik, dan tulisan tangan yang ada di dalamnya.')
    else:
        sumber = 'naskah soal hasil pemindaian foto'
        blok = '\nNASKAH HASIL PEMINDAIAN:\n' + naskah
    return PERINTAH.format(bahasa=bahasa, catatan=ket, naskah=blok,
                           jenjang=jenjang, tanya=TANYA, sumber=sumber)

AWAL = re.compile(r'^\s*SOAL\s+(\d{1,3})\s*$', re.I | re.M)
JAWAB = re.compile(r'^\s*JAWAB\s*:\s*(.*)$', re.I)
BAHAS = re.compile(r'^\s*BAHAS\s*:?\s*(.*)$', re.I)
JUDUL = re.compile(r'^\s*JUDUL\s*:\s*(.+)$', re.I)

def _blok_terlengkap(teks):
    """Ambil satu jawaban saja ketika Gemini menulis lebih dari sekali.

    Gemini kadang menampilkan draf singkat lebih dulu lalu menulis ulang versi
    lengkapnya, dan keduanya ikut terbaca dari halaman. Gejalanya di PDF: soal
    nomor 1 muncul dua kali, dan soal terakhir raib karena tertimpa. Tiap
    jawaban dimulai dengan barisnya sendiri "JUDUL:", jadi teks dipecah di
    situ lalu dipilih blok dengan soal terbanyak — draf selalu lebih pendek.
    """
    baris = (teks or '').replace('\r', '').split('\n')
    awal = [i for i, b in enumerate(baris) if JUDUL.match(b)]
    if len(awal) < 2:
        return teks or ''
    awal.append(len(baris))
    blok = ['\n'.join(baris[awal[i]:awal[i + 1]]) for i in range(len(awal) - 1)]
    return max(blok, key=lambda t: (len(AWAL.findall(t)), len(t)))


def urai(teks):
    """Kembalikan (judul, [{no, soal, jawab, bahas}])."""
    teks = _blok_terlengkap(teks)
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
