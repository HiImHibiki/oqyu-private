#!/usr/bin/env python3
"""Perintah dan pengurai untuk lembar pembahasan.

Formatnya sengaja BUKAN format naskah ujian: lembar ini untuk dibaca anak,
bukan dikerjakan. Jadi tiap soal langsung diikuti jawaban dan pembahasannya,
mengalir ke bawah, tanpa bagian kunci yang terpisah di belakang.
"""
import re


def aturan_bahasa(pilihan):
    """Kalimat aturan bahasa untuk disisipkan ke perintah.

    'ikut' berarti mengikuti bahasa bahannya. Itu yang benar untuk lembar yang
    dibuat DARI soal anak: soal berbahasa Inggris yang dijawab dalam Bahasa
    Indonesia tidak bisa dipakai di kelas, dan kesalahannya baru terasa setelah
    lembarnya tercetak.
    """
    p = (pilihan or '').strip().lower()
    if p in ('', 'ikut', 'auto', 'ikuti soal', 'ikuti bahasa soal'):
        return ('Bahasa: IKUTI bahasa bahannya. Kalau soalnya berbahasa Inggris, '
                'seluruh jawaban dan pembahasan juga berbahasa Inggris; kalau '
                'berbahasa Indonesia, jawablah dalam Bahasa Indonesia. Jangan '
                'menerjemahkan.')
    return f'Bahasa: {pilihan}'


PERINTAH = """Kamu diberi {sumber}. Tugasmu BUKAN membuat soal baru.

Untuk SETIAP soal: tulis ulang soalnya, beri jawabannya, lalu tunjukkan
cara menghitungnya secara RINGKAS untuk anak {jenjang} — rumus dan angka,
bukan paragraf penjelasan.

Tulis PERSIS dengan susunan ini, diulang untuk tiap soal:

JUDUL: <judul singkat seluruh lembar, cukup sekali di paling atas>

SOAL 1
{tanya}
JAWAB: <jawaban singkat dan tegas>
BAHAS:
<pembahasan SINGKAT. Tulis rumus dan hitungannya, bukan cerita.
Satu langkah satu baris, urut begini:
Diketahui: <daftar singkat, dipisah koma>
<rumus yang dipakai, dalam $...$>
<baris-baris perhitungan, tiap baris satu langkah, dalam $...$>
Jadi <simpulan satu kalimat pendek>

Jangan menulis kalimat pengantar seperti "Pertama, mari kita perhatikan".
Jangan menjelaskan kembali apa itu rumusnya. Langsung angka dan hitungan.>

SOAL 2
...dan seterusnya.

Aturan:
- Rumus matematika, fisika, atau kimia dibungkus tanda dolar $...$
- Jangan memakai markdown: tanpa **tebal**, tanpa #, tanpa daftar bertanda -
- Jawab langsung dengan teks pada susunan di atas. JANGAN menulis kode program
  (Python atau lainnya), jangan menjalankan kode, dan jangan menampilkan
  keluaran kode — hitung sendiri lalu tulis hasilnya
- Kalau ada bagian yang tidak terbaca jelas, tulis apa adanya lalu
  tambahkan "(tidak terbaca jelas)" — JANGAN mengarang isinya
- Kalau soal punya gambar, tulis [GAMBAR: keterangan singkat] di posisinya
- {bahasa}
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
    bahasa = aturan_bahasa(bahasa)
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

# Gemini tidak selalu menuliskan penanda persis seperti yang diminta: kadang
# ditebalkan (**SOAL 1**), diberi titik dua, diberi tanda pagar, atau dinomori
# "Soal 1." Semua ragam itu tetap satu penanda yang sama, jadi hiasannya
# dilonggarkan di pola — bukan diserahkan pada kepatuhan Gemini, karena satu
# variasi saja membuat seluruh lembar gagal terurai.
_HIAS = r'[\s*#_>`-]*'
AWAL = re.compile(rf'^{_HIAS}SOAL{_HIAS}(\d{{1,3}}){_HIAS}[.:)]?{_HIAS}$', re.I | re.M)
JAWAB = re.compile(rf'^{_HIAS}JAWAB(?:AN)?{_HIAS}[:.]{_HIAS}(.*)$', re.I)
BAHAS = re.compile(rf'^{_HIAS}(?:BAHAS|PEMBAHASAN|PENYELESAIAN){_HIAS}[:.]?{_HIAS}(.*)$', re.I)
JUDUL = re.compile(rf'^{_HIAS}JUDUL{_HIAS}[:.]{_HIAS}(.+)$', re.I)
# Baris yang tidak boleh disambung ke baris lain: ada rumusnya, atau memang
# baris pembuka/penutup langkah hitung.
SENDIRI = re.compile(r'\$.+\$|^\s*(Diketahui|Ditanya|Jadi|Maka)\b', re.I)

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
        # Pembahasan sekarang berupa langkah hitung, satu langkah satu baris.
        # Baris berisi rumus atau angka harus berdiri sendiri — kalau disambung
        # jadi satu alinea, urutan hitungannya hilang dan justru sulit diikuti.
        # Kalimat biasa yang berurutan tetap digabung agar tidak terpotong-potong.
        alinea, kini_p = [], []
        def tutup():
            if kini_p: alinea.append(' '.join(kini_p)); kini_p.clear()
        for b in x['bahas']:
            b = b.strip()
            if not b:
                tutup(); continue
            if SENDIRI.search(b):
                tutup(); alinea.append(b)
            else:
                kini_p.append(b)
        tutup()
        x['bahas'] = [a for a in alinea if a]
    return judul, [x for x in butir if x['soal'] or x['bahas']]
