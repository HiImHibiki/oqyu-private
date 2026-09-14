#!/usr/bin/env python3
"""Perintah dan pengurai untuk lembar rangkuman.

Rangkuman bukan pembahasan yang dipendekkan. Yang dicari anak saat membaca
ulang sebelum ujian selalu sama: apa intinya, rumus mana yang dipakai, contoh
sekali jalan, dan hal yang gampang tertukar. Keempatnya diberi tempat sendiri
supaya bisa ditemukan sekilas, bukan dicari di tengah paragraf.
"""
import re

PERINTAH = """Tolong bantu buatkan rangkuman yang enak dibaca dan enak dipelajari ulang
dari {sumber}, untuk anak {jenjang} — dipadatkan intinya, bukan disalin ulang.

Susunannya kira-kira begini:

JUDUL: <judul rangkuman, singkat>
INTI: <2-3 kalimat gambaran besar seluruh materi>

BAGIAN: <nama sub-bab pertama>
POIN:
- <satu gagasan per baris, kalimat pendek>
- <...>
RUMUS:
- $<rumus>$ = <arti lambangnya, singkat>
CONTOH: <satu contoh singkat beserta hitungannya, langsung angka>
INGAT: <satu hal yang paling sering keliru atau tertukar>

BAGIAN: <sub-bab berikutnya>, dan seterusnya.

Beberapa hal kecil:
- Sekitar {bagian} bagian saja; kalau materinya sedikit, lebih sedikit pun tidak apa
- Tiap POIN satu baris pendek (sekitar 15 kata), bukan paragraf
- RUMUS, CONTOH, dan INGAT boleh dilewati kalau bagian itu memang tidak punya
- Rumus di antara tanda dolar $...$
- Ditulis biasa saja, tanpa markdown (tanpa **tebal**, #, atau tabel)
- Cukup tulis hasilnya, kodenya tidak usah ditampilkan
- Isinya dari bahannya saja, tidak usah ditambah-tambahi
- Tidak perlu membuat atau melampirkan gambar/grafik; kalau perlu, cukup tulis
  [GAMBAR: keterangan singkat] dalam teks
- {bahasa}
{catatan}{naskah}"""


def bangun(naskah, bahasa='Indonesia', catatan='', mapel='', kelas='',
           bagian=5, topik='', ada_lampiran=False):
    """Susun perintah rangkuman.

    Bahannya bisa berupa foto/PDF materi, atau hanya sebuah topik. Keduanya
    memakai kerangka yang sama supaya lembarnya tetap seragam.
    """
    tambahan = []
    if mapel: tambahan.append(f'Mata pelajaran: {mapel}.')
    if catatan.strip(): tambahan.append(catatan.strip())
    ket = ('\n' + ' '.join(tambahan) + '\n') if tambahan else '\n'
    jenjang = f'kelas {kelas}' if kelas else 'seusia itu'
    import jawab as _jwb
    bahasa = _jwb.aturan_bahasa(bahasa)
    naskah = (naskah or '').strip()[:12000]
    topik = (topik or '').strip()
    if ada_lampiran and naskah:
        sumber = ('foto atau berkas materi yang terlampir, beserta hasil '
                  'pemindaian teksnya sebagai pembanding ejaan')
        blok = ('\nBacalah materinya dari LAMPIRAN. Hasil pemindaian di bawah hanya '
                'pembanding; bila berbeda, yang benar adalah lampirannya.\n\n'
                'HASIL PEMINDAIAN:\n' + naskah)
    elif ada_lampiran:
        sumber = 'foto atau berkas materi yang terlampir'
        blok = ('\nBacalah materinya langsung dari lampiran, termasuk gambar, '
                'diagram, grafik, dan tulisan tangan di dalamnya.')
    elif naskah:
        sumber = 'materi hasil pemindaian'
        blok = '\nMATERI:\n' + naskah
    else:
        sumber = f'sebuah topik: "{topik}"'
        blok = ('\nTidak ada bahan yang dilampirkan. Susun rangkumannya dari '
                'materi baku yang lazim diajarkan untuk topik itu.')
    return PERINTAH.format(bahasa=bahasa, catatan=ket, naskah=blok, jenjang=jenjang,
                           sumber=sumber, bagian=bagian)


JUDUL = re.compile(r'^\s*JUDUL\s*:\s*(.+)$', re.I)
INTI = re.compile(r'^\s*INTI\s*:\s*(.*)$', re.I)
BAGIAN = re.compile(r'^\s*BAGIAN\s*(?:\d{1,2})?\s*:\s*(.+)$', re.I)
POIN = re.compile(r'^\s*POIN\s*:?\s*(.*)$', re.I)
RUMUS = re.compile(r'^\s*RUMUS\s*:?\s*(.*)$', re.I)
CONTOH = re.compile(r'^\s*CONTOH\s*:?\s*(.*)$', re.I)
INGAT = re.compile(r'^\s*INGAT\s*:?\s*(.*)$', re.I)
BUTIR = re.compile(r'^\s*[-*•]\s*(.+)$')


def _blok_terlengkap(teks):
    """Ambil satu jawaban saja ketika Gemini menulis lebih dari sekali.

    Sama sebabnya dengan lembar pembahasan: draf singkat lalu versi lengkap,
    keduanya terbaca dari halaman. Blok dipilih yang bagiannya paling banyak.
    """
    baris = (teks or '').replace('\r', '').split('\n')
    awal = [i for i, b in enumerate(baris) if JUDUL.match(b)]
    if len(awal) < 2:
        return teks or ''
    awal.append(len(baris))
    blok = ['\n'.join(baris[awal[i]:awal[i + 1]]) for i in range(len(awal) - 1)]
    return max(blok, key=lambda t: (len(BAGIAN.findall(t)), len(t)))


def urai(teks):
    """Kembalikan (judul, inti, [{nama, poin[], rumus[], contoh, ingat}])."""
    teks = _blok_terlengkap(teks)
    judul, inti, bagian, kini, medan = '', [], [], None, None

    def simpan():
        if kini and (kini['poin'] or kini['rumus'] or kini['contoh'] or kini['ingat']):
            bagian.append(kini)

    for b in (teks or '').replace('\r', '').split('\n'):
        m = JUDUL.match(b)
        if m and not judul:
            judul = m.group(1).strip(); medan = None; continue
        m = BAGIAN.match(b)
        if m:
            simpan()
            kini = {'nama': m.group(1).strip(), 'poin': [], 'rumus': [],
                    'contoh': '', 'ingat': ''}
            medan = 'poin'; continue
        m = INTI.match(b)
        if m:
            medan = 'inti'
            if m.group(1).strip(): inti.append(m.group(1).strip())
            continue
        if kini is not None:
            for pola, nama in ((POIN, 'poin'), (RUMUS, 'rumus'),
                               (CONTOH, 'contoh'), (INGAT, 'ingat')):
                m = pola.match(b)
                if m:
                    medan = nama
                    sisa = m.group(1).strip()
                    if sisa:
                        if nama in ('poin', 'rumus'): kini[nama].append(sisa)
                        else: kini[nama] = sisa
                    break
            else:
                t = b.strip()
                if not t: continue
                mb = BUTIR.match(b)
                if medan in ('poin', 'rumus'):
                    kini[medan].append(mb.group(1).strip() if mb else t)
                elif medan in ('contoh', 'ingat'):
                    kini[medan] = (kini[medan] + ' ' + t).strip()
            continue
        if medan == 'inti' and b.strip():
            inti.append(b.strip())

    simpan()
    return judul, ' '.join(inti).strip(), bagian
