#!/usr/bin/env python3
"""Exact Worksheet Maker — satu instruksi, langsung jadi PDF.

Alurnya:
  foto        -> dibaca Vision di Mac (tanpa kirim ke mana pun)
  arsip       -> 6 soal asli diambil sebagai penuntun gaya
  Gemini      -> dikendalikan lewat Chrome, tanpa API
  penata      -> pengurai deterministik; model lokal hanya bila ia gagal total
  lembar      -> PDF A4 siap cetak, masuk bank soal
"""
import os, re, json, time, html, threading, subprocess, sqlite3, urllib.parse, urllib.request
import lokasi

AKAR = os.path.dirname(os.path.abspath(__file__))
DB = lokasi.data('exact.db')
# PDF mendarat langsung di Desktop supaya gampang ditemukan.
# Naskah mentahnya disimpan terpisah agar Desktop tidak penuh — berguna kalau
# lembar perlu disunting ulang lewat Exact Worksheet Maker.
KELUAR = os.path.expanduser(os.environ.get('EXACT_KELUAR') or '~/Desktop')
NASKAH = lokasi.data('naskah')
PORT = 7790

TUGAS = {}
KUNCI = threading.Lock()
HALAMAN_JAWAB = {}      # kode -> HTML lembar pembahasan, dibaca rute /lembar-jawab
# Hanya SATU lembar boleh dikerjakan pada satu waktu. Dua tugas bersamaan akan
# berebut tab Gemini yang sama: yang satu mengganti isi kotak perintah milik
# yang lain, dan keduanya gagal dengan gejala yang membingungkan.
#
# Dulu ini cuma threading.Lock(). Akibatnya "Menunggu lembar sebelumnya selesai…"
# tidak bisa menjawab satu pun pertanyaan yang wajar: nomor berapa saya, yang
# dikerjakan apa, sudah berapa lama, dan kapan kira-kira giliran saya. Lebih
# buruk lagi, tugas yang menggantung menahan kunci itu selamanya. Antrean di
# bawah ini menyimpan urutannya, memberi batas waktu, dan bisa dibatalkan.
BATAS_KERJA = 15 * 60          # tugas macet melepas giliran, bukan menahan selamanya


class Antrean:
    """Giliran tunggal yang bisa dilihat isinya."""

    def __init__(self):
        self._k = threading.Condition()
        self._tunggu = []                   # [{jid, nama, sejak}] menunggu giliran
        self._kerja = None                  # {jid, nama, sejak}
        self._batal = set()

    def _kedaluwarsa(self):
        """Bebaskan giliran yang sudah dipegang terlalu lama."""
        k = self._kerja
        if k and time.time() - k['sejak'] > BATAS_KERJA:
            self._kerja = None
            return True
        return False

    def masuk(self, jid, nama, lapor=None):
        """Antre sampai giliran tiba. False bila dibatalkan."""
        with self._k:
            self._tunggu.append({'jid': jid, 'nama': nama, 'sejak': time.time()})
            dilaporkan = None
            while True:
                self._kedaluwarsa()
                if jid in self._batal:
                    self._batal.discard(jid)
                    self._tunggu = [x for x in self._tunggu if x['jid'] != jid]
                    return False
                antre = [x['jid'] for x in self._tunggu]
                if self._kerja is None and antre and antre[0] == jid:
                    self._tunggu.pop(0)
                    self._kerja = {'jid': jid, 'nama': nama, 'sejak': time.time()}
                    return True
                if lapor:
                    posisi = antre.index(jid) + 1 if jid in antre else 1
                    if posisi != dilaporkan:
                        dilaporkan = posisi
                        k = self._kerja
                        ket = (f'sedang dikerjakan: {k["nama"]} '
                               f'({int(time.time() - k["sejak"])//60} menit)') if k else 'menyiapkan giliran'
                        lapor(f'Antrean nomor {posisi} — {ket}')
                self._k.wait(5)

    def keluar(self, jid):
        with self._k:
            if self._kerja and self._kerja['jid'] == jid:
                self._kerja = None
            self._k.notify_all()

    def batalkan(self, jid):
        with self._k:
            if any(x['jid'] == jid for x in self._tunggu):
                self._batal.add(jid)
                self._k.notify_all()
                return True
            return False

    def lihat(self):
        with self._k:
            self._kedaluwarsa()
            k = self._kerja
            return {
                'kerja': ({'jid': k['jid'], 'nama': k['nama'],
                           'detik': int(time.time() - k['sejak'])} if k else None),
                'tunggu': [{'jid': x['jid'], 'nama': x['nama'],
                            'detik': int(time.time() - x['sejak'])} for x in self._tunggu],
            }


ANTREAN = Antrean()

# Tugas yang diminta berhenti oleh pemakainya. Dibuat terpisah dari antrean
# karena sifatnya lain: antrean membatalkan yang BELUM mulai, sedangkan ini
# menghentikan yang SEDANG berjalan.
#
# Penghentiannya bekerja sama, bukan paksa: tugas memeriksa tanda ini di
# batas-batas langkah dan saat menunggu Gemini. Membunuh utasnya di tengah
# jalan akan meninggalkan tab Chrome dan berkas separuh jadi, dan itu justru
# merepotkan pemakaian berikutnya.
HENTI = set()


class Dihentikan(RuntimeError):
    """Pemakainya menekan tombol berhenti."""


def minta_henti(jid):
    """Tandai satu tugas untuk berhenti. True bila tugasnya memang ada."""
    if ANTREAN.batalkan(jid):
        return True
    with KUNCI:
        t = TUGAS.get(jid)
        if not t or t.get('selesai'):
            return False
    HENTI.add(jid)
    return True


def periksa_henti(jid):
    """Lempar Dihentikan bila tugas ini diminta berhenti."""
    if jid in HENTI:
        HENTI.discard(jid)
        raise Dihentikan('Dihentikan atas permintaan Anda.')

SINGKATAN = {'matematika': 'MATH', 'mathematics': 'MATH', 'math': 'MATH', 'mtk': 'MATH',
             'fisika': 'PHYS', 'physics': 'PHYS', 'kimia': 'CHEM', 'chemistry': 'CHEM',
             'biologi': 'BIO', 'biology': 'BIO', 'ipa': 'IPA', 'science': 'SCI',
             'sains': 'SCI', 'ips': 'IPS', 'bahasa inggris': 'ENG', 'english': 'ENG',
             'bahasa indonesia': 'BIND', 'ekonomi': 'EKO', 'economics': 'EKO',
             'sejarah': 'SEJ', 'history': 'SEJ', 'geografi': 'GEO', 'geography': 'GEO',
             'ppkn': 'PPKN', 'sosiologi': 'SOS', 'akuntansi': 'AKT'}

def nama_berkas(kop, kunci, folder):
    """Samakan dengan penamaan Exact Worksheet Maker sendiri.

    Berkas lama Rico bernama "SCIENCE ICAS-ST.LAURENSIA-7-1309-1.pdf" — itu kode
    Mapel/Sekolah/Kelas/TglBulan/Soal-ke milik aplikasinya, dengan "/" diganti
    "-". Memakai pola yang sama membuat lembar baru berbaur dengan yang lama,
    bukan jadi kelompok asing di Desktop yang sudah berisi ratusan PDF.
    """
    bagian = [str(kop.get(k) or '').strip()
              for k in ('mapel', 'sekolah', 'kelas', 'tanggal')]
    bagian = [b for b in bagian if b]
    dasar = '-'.join(bagian) or 'Lembar'
    # nomor urut: lanjutkan dari berkas hari ini yang berawalan sama
    n = 1
    try:
        import re as _re
        pola = _re.compile(_re.escape(dasar) + r'-(\d+)')
        ada = [int(m.group(1)) for f in os.listdir(folder)
               for m in [pola.match(f)] if m]
        if ada: n = max(ada) + 1
    except OSError:
        pass
    nama = f'{dasar}-{n}'
    if kunci: nama += ' - Soal+Jawaban'
    return nama

def kode_mapel(nama):
    """Kode pendek untuk kop, mis. MATH. Memotong mentah memberi "MATEMATI"."""
    n = (nama or '').strip().lower()
    if n in SINGKATAN: return SINGKATAN[n]
    for k, v in SINGKATAN.items():
        if k in n or n in k: return v
    kata = n.split()
    if len(kata) == 1:
        return kata[0][:4].upper()          # satu kata -> 4 huruf, bukan 1 inisial
    return ''.join(w[0] for w in kata[:4]).upper() or n[:4].upper()

def _catat(jid, pesan, maju=None, selesai=False, galat=None, pdf=None):
    with KUNCI:
        t = TUGAS.setdefault(jid, {'langkah': [], 'maju': 0, 'selesai': False})
        # Tiap langkah diberi cap detik sejak tugas dimulai. Tanpa ini,
        # "lama" tidak bisa ditunjuk bagiannya — dan bagian yang salah
        # dioptimalkan adalah waktu yang terbuang dua kali.
        t.setdefault('mulai', time.time())
        if pesan:
            pesan = f'[{int(time.time() - t["mulai"]):>3}s] {pesan}'
        if pesan: t['langkah'].append(pesan)
        if maju is not None: t['maju'] = maju
        if galat: t['galat'] = galat; t['selesai'] = True
        if pdf: t['pdf'] = pdf
        if selesai: t['selesai'] = True

def _db():
    c = sqlite3.connect(DB, timeout=60); c.row_factory = sqlite3.Row; return c

def _simpan_naskah(nama, teks):
    """Simpan naskah mentah dari Gemini.

    Dulu hanya disimpan setelah pengurai berhasil. Justru pada saat GAGAL itulah
    naskahnya paling dibutuhkan — tanpa itu penyebabnya cuma bisa ditebak.
    """
    try:
        os.makedirs(NASKAH, exist_ok=True)
        cap = time.strftime('%Y-%m-%d %H%M')
        with open(os.path.join(NASKAH, f'{nama} — {cap}.txt'), 'w',
                  encoding='utf-8') as f:
            f.write(teks or '')
    except OSError:
        pass


def _simpan_sementara(gambar):
    """Tulis foto ke berkas sementara; pemanggil wajib menghapusnya."""
    import tempfile
    jalur = []
    for nama, isi in gambar or []:
        ext = os.path.splitext(nama)[1] or '.png'
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            f.write(isi); jalur.append(f.name)
    return jalur


def _baca_foto(jalur, lapor=None):
    """OCR Apple Vision: cepat, jalan di Mac, dan tidak mengirim foto ke mana pun."""
    import serupa
    alat = os.path.join(AKAR, 'ocr-mac', 'visionocr')
    teks = ''
    for pth in jalur:
        teks += serupa.baca_berkas(pth, alat) + '\n\n'
    return teks


# Dua cara membaca foto, dengan kekuatan yang berbeda:
#   vision — Apple Vision di Mac. Cepat, gratis, foto tidak keluar dari Mac,
#            dan sangat baik untuk teks cetak. Tapi gambar, diagram, dan
#            tulisan tangan hilang atau salah baca.
#   gemini — foto diunggah ke Gemini. Diagram, grafik, dan tulisan tangan ikut
#            terbaca karena Gemini melihat gambarnya sendiri. Lebih lambat.
#   dua    — teks hasil Vision dikirim SEKALIGUS dengan fotonya, jadi ejaan
#            teks cetak ikut terjaga sementara gambarnya tetap terlihat.
# Bawaannya mata AI, bukan Apple Vision. Vision cepat dan tidak mengirim foto
# ke mana pun, tapi ia kehilangan diagram, grafik, dan tulisan tangan tanpa
# memberi tanda apa pun — soal bergambar jadi terbaca setengah dan kesalahannya
# baru terasa di lembar yang sudah tercetak. Vision tetap bisa dipilih untuk
# soal yang murni ketikan.
MATA = ('gemini', 'vision', 'dua')

# Dua mesin, dua jalur yang sangat berbeda ongkos gagalnya:
#   gemini — lewat Chrome kendali. Tidak perlu langganan Claude, tapi harus
#            membuka menu unggah, mengklik tombol di koordinatnya, menunggu
#            selesai menulis, lalu memungut rumus dari atribut data-math.
#   claude — lewat CLI langganan Pro. Tidak ada satu pun lapisan di atas.
MESIN = ('gemini', 'claude')


def _baris(**medan):
    """Susun daftar 'Label: nilai', melewati yang kosong."""
    return '\n'.join(f'{k.replace("_", " ")}: {v}'
                     for k, v in medan.items() if str(v or '').strip())


def _isian_soal(mapel, jenjang, kelas, topik, jumlah, n_set, sulit, bahasa,
                instruksi, acuan):
    t = _baris(Mata_pelajaran=mapel, Topik=topik,
               Kelas=jenjang or (f'Kelas {kelas}' if kelas else ''),
               Jumlah_set=n_set, Jumlah_soal_per_set=jumlah,
               Tingkat_kesulitan=sulit, Bahasa=bahasa)
    if instruksi.strip(): t += '\nCatatan guru: ' + instruksi.strip()
    if acuan.strip():
        t += '\n\nSOAL ACUAN — buat soal SETARA, jangan menyalinnya:\n' + acuan.strip()[:2500]
    return t


def _isian_pembahasan(mapel, kelas, bahasa, instruksi, naskah):
    t = _baris(Mata_pelajaran=mapel, Kelas=kelas, Bahasa=bahasa)
    if instruksi.strip(): t += '\nCatatan guru: ' + instruksi.strip()
    if (naskah or '').strip():
        t += '\n\nNASKAH SOAL:\n' + naskah.strip()[:9000]
    return t


def _isian_rangkuman(mapel, kelas, bahasa, instruksi, topik, bagian, materi):
    t = _baris(Mata_pelajaran=mapel, Topik=topik, Kelas=kelas, Bahasa=bahasa,
               Jumlah_bagian=bagian)
    if instruksi.strip(): t += '\nCatatan guru: ' + instruksi.strip()
    if (materi or '').strip():
        t += '\n\nMATERI:\n' + materi.strip()[:12000]
    return t


def _tanya(mesin, perintah, lampiran=None, mode='flash', batas=300,
           format=None, isian=None, lapor=None, henti=None):
    """Kirim permintaan ke mesin yang dipilih, kembalikan naskah jawabannya.

    perintah : perintah lengkap berisi spesifikasi format — dipakai Gemini.
    isian    : ringkasan permintaan tanpa spesifikasi — dipakai Claude, yang
               sudah punya spesifikasinya sebagai berkas di claude-proyek/.
               Spesifikasi naskah soal saja 16.000 karakter; mengirimnya ulang
               tiap lembar itu pemborosan.
    lampiran : jalur foto. TIDAK pernah dikirim ke Claude — membaca gambar
               dengannya jauh lebih mahal daripada menyusun teks. Fotonya
               disalin jadi teks oleh Gemini Flash lebih dulu.
    """
    import otomasi
    if mesin == 'claude':
        import claudecli
        if not claudecli.tersedia():
            raise RuntimeError('Claude CLI belum terpasang di Mac ini. '
                               'Pilih mesin Gemini, atau pasang Claude Code dulu.')
        inti = isian or perintah
        if lampiran:
            if lapor: lapor('Menyalin foto dengan Gemini Flash…')
            salinan = otomasi.baca_foto(lampiran, mode='flash')
            inti = inti + '\n\nISI FOTO YANG DISALIN:\n' + salinan.strip()
        if lapor: lapor('Menyusun dengan Claude…')
        teks = claudecli.tanya(inti, batas=max(batas, 600), format=format)
        return otomasi.normalkan_rumus(otomasi.buang_pagar(teks))
    if lapor: lapor('Mengirim ke Gemini lewat Chrome kendali…')
    return otomasi.gemini_tanya(perintah, batas=batas, lampiran=lampiran, mode=mode)


def jalankan_jawab(jid, gambar, instruksi, mapel, kelas, judul, bahasa='Indonesia',
                   lembaga='', sekolah='', tanggal='', kolom='1',
                   kerapatan='Normal', garis='0.5', mata='gemini', mode='flash',
                   mesin='gemini'):
    """Foto soal anak -> kunci jawaban + pembahasan -> PDF.

    Soalnya TIDAK dikarang: disalin apa adanya dari foto, lalu diberi kunci dan
    pembahasan. Karena itu tidak ada langkah 'acuan gaya dari arsip'.
    """
    import serupa, otomasi, jawab as _jwb, lembar_jawab as _lj, uuid
    if not ANTREAN.masuk(jid, 'Kunci Jawaban', lambda m: _catat(jid, m, 4)):
        return _catat(jid, None, galat='Dibatalkan sebelum mulai.')
    try:
        mata = mata if mata in MATA else 'vision'
        jalur = _simpan_sementara(gambar)
        try:
            naskah_foto = ''
            if jalur and mata in ('vision', 'dua'):
                _catat(jid, f'Membaca {len(jalur)} foto dengan Apple Vision…', 12)
                naskah_foto = _baca_foto(jalur)
                _catat(jid, f'Terbaca {len(naskah_foto.split())} kata dari foto', 24)
            if mata == 'vision' and len(naskah_foto.strip()) < 40:
                return _catat(jid, None, galat='Tidak ada soal yang terbaca dari foto. '
                                               'Coba foto lebih dekat dan lebih terang, '
                                               'atau pilih "mata Gemini" jika soalnya '
                                               'tulisan tangan atau bergambar.')
            if mata != 'vision' and not jalur:
                return _catat(jid, None, galat='Tidak ada foto yang dikirim.')

            lampiran = jalur if mata in ('gemini', 'dua') else None
            perintah = _jwb.bangun(naskah_foto, bahasa, instruksi, mapel,
                                   str(kelas or ''), ada_lampiran=bool(lampiran))
            _catat(jid, 'Meminta kunci jawaban dan pembahasan…', 40)
            isian = _isian_pembahasan(mapel, kelas, bahasa, instruksi, naskah_foto)
            hasil_teks = _tanya(mesin, perintah, lampiran, mode,
                                format='pembahasan', isian=isian,
                                lapor=lambda m: _catat(jid, m, 45),
                                henti=lambda: periksa_henti(jid))
        finally:
            for x in jalur:
                try: os.unlink(x)
                except OSError: pass
        periksa_henti(jid)
        _catat(jid, f'Jawaban diterima ({len(hasil_teks)} karakter)', 70)

        judul_lbr, butir = _jwb.urai(hasil_teks)
        if not butir:
            _simpan_naskah('GAGAL-pembahasan', hasil_teks)
            raise RuntimeError('Jawaban Gemini tidak bisa diurai jadi pembahasan. '
                               'Naskah mentahnya disimpan di folder naskah/.')
        judul = judul.strip() or judul_lbr or 'Pembahasan Soal'
        _catat(jid, f'{len(butir)} soal beserta pembahasannya', 80)

        kop = dict(lembaga=lembaga or 'Exact Course', mapel=mapel or '',
                   kelas=(f'Kelas {kelas}' if kelas else ''))
        os.makedirs(KELUAR, exist_ok=True)
        kode_kop = dict(lembaga=lembaga or 'Exact Course', mapel=kode_mapel(mapel),
                        sekolah=sekolah, kelas=str(kelas or ''),
                        tanggal=tanggal or time.strftime('%d%m'))
        nama = nama_berkas(kode_kop, True, KELUAR)
        os.makedirs(NASKAH, exist_ok=True)
        open(os.path.join(NASKAH, f'{nama} — {time.strftime("%Y-%m-%d %H%M")}.txt'),
             'w', encoding='utf-8').write(hasil_teks)

        # Lembar pembahasan memakai tata letaknya sendiri — satu kolom, lapang,
        # soal menyatu dengan pembahasannya. Bukan format naskah ujian.
        _catat(jid, 'Menyusun lembar lalu mencetak PDF…', 90)
        kode = uuid.uuid4().hex[:10]
        HALAMAN_JAWAB[kode] = _lj.buat(judul, butir, kop)
        if len(HALAMAN_JAWAB) > 40:
            for k in list(HALAMAN_JAWAB)[:-40]: HALAMAN_JAWAB.pop(k, None)
        tuju = os.path.join(KELUAR, f'{nama}.pdf')
        otomasi.cetak_halaman(f'http://127.0.0.1:7790/lembar-jawab?k={kode}', tuju)
        subprocess.run(['open', tuju], capture_output=True)
        _catat(jid, f'Selesai — {os.path.basename(tuju)}', 100, selesai=True, pdf=tuju)
    except Dihentikan as e:
        _catat(jid, None, galat=str(e))
    except Exception as e:
        _catat(jid, None, galat=f'{type(e).__name__}: {e}')
    finally:
        HENTI.discard(jid)
        ANTREAN.keluar(jid)


def jalankan_rangkum(jid, gambar, instruksi, mapel, kelas, judul, topik='',
                     bahasa='Indonesia', lembaga='', sekolah='', tanggal='',
                     bagian='5', mata='gemini', mode='flash', mesin='gemini'):
    """Materi (foto/PDF atau sekadar topik) -> lembar rangkuman -> PDF.

    Bahannya boleh kosong: kalau hanya topik yang diisi, rangkumannya disusun
    dari materi baku. Itu membuat tab ini tetap berguna saat bukunya tidak ada
    di tangan.
    """
    import otomasi, rangkum as _rk, lembar_rangkum as _lr, uuid
    if not ANTREAN.masuk(jid, 'Rangkuman', lambda m: _catat(jid, m, 4)):
        return _catat(jid, None, galat='Dibatalkan sebelum mulai.')
    try:
        mata = mata if mata in MATA else 'vision'
        jalur = _simpan_sementara(gambar)
        try:
            if not jalur and not (topik or '').strip():
                return _catat(jid, None, galat='Beri foto/PDF materinya, '
                                               'atau tulis topiknya.')
            naskah_materi = ''
            if jalur and mata in ('vision', 'dua'):
                _catat(jid, f'Membaca {len(jalur)} berkas dengan Apple Vision…', 12)
                naskah_materi = _baca_foto(jalur)
                _catat(jid, f'Terbaca {len(naskah_materi.split())} kata', 24)
            if jalur and mata == 'vision' and len(naskah_materi.strip()) < 40:
                return _catat(jid, None, galat='Materinya tidak terbaca. Coba foto '
                                               'lebih terang, atau pilih "mata Gemini".')
            lampiran = jalur if (jalur and mata in ('gemini', 'dua')) else None

            try: n_bagian = max(2, min(12, int(str(bagian).strip() or 5)))
            except ValueError: n_bagian = 5
            perintah = _rk.bangun(naskah_materi, bahasa, instruksi, mapel,
                                  str(kelas or ''), bagian=n_bagian,
                                  topik=topik, ada_lampiran=bool(lampiran))
            _catat(jid, 'Menyusun rangkuman…', 40)
            isian = _isian_rangkuman(mapel, kelas, bahasa, instruksi, topik,
                                     n_bagian, naskah_materi)
            hasil_teks = _tanya(mesin, perintah, lampiran, mode,
                                format='rangkuman', isian=isian,
                                lapor=lambda m: _catat(jid, m, 45),
                                henti=lambda: periksa_henti(jid))
        finally:
            for x in jalur:
                try: os.unlink(x)
                except OSError: pass

        periksa_henti(jid)
        _catat(jid, f'Rangkuman diterima ({len(hasil_teks)} karakter)', 70)
        judul_lbr, inti, bagian_isi = _rk.urai(hasil_teks)
        if not bagian_isi:
            _simpan_naskah('GAGAL-rangkuman', hasil_teks)
            raise RuntimeError('Jawaban Gemini tidak bisa diurai jadi rangkuman. '
                               'Naskah mentahnya disimpan di folder naskah/.')
        judul = judul.strip() or judul_lbr or topik.strip() or 'Rangkuman'
        _catat(jid, f'{len(bagian_isi)} bagian rangkuman', 80)

        kop = dict(lembaga=lembaga or 'Exact Course', mapel=mapel or '',
                   kelas=(f'Kelas {kelas}' if kelas else ''))
        os.makedirs(KELUAR, exist_ok=True)
        kode_kop = dict(lembaga=lembaga or 'Exact Course', mapel=kode_mapel(mapel),
                        sekolah=sekolah, kelas=str(kelas or ''),
                        tanggal=tanggal or time.strftime('%d%m'))
        nama = nama_berkas(kode_kop, False, KELUAR) + ' - Rangkuman'
        os.makedirs(NASKAH, exist_ok=True)
        open(os.path.join(NASKAH, f'{nama} — {time.strftime("%Y-%m-%d %H%M")}.txt'),
             'w', encoding='utf-8').write(hasil_teks)

        _catat(jid, 'Menyusun lembar lalu mencetak PDF…', 90)
        kode = uuid.uuid4().hex[:10]
        HALAMAN_JAWAB[kode] = _lr.buat(judul, inti, bagian_isi, kop)
        if len(HALAMAN_JAWAB) > 40:
            for k in list(HALAMAN_JAWAB)[:-40]: HALAMAN_JAWAB.pop(k, None)
        tuju = os.path.join(KELUAR, f'{nama}.pdf')
        otomasi.cetak_halaman(f'http://127.0.0.1:{PORT}/lembar-jawab?k={kode}', tuju)
        subprocess.run(['open', tuju], capture_output=True)
        _catat(jid, f'Selesai — {os.path.basename(tuju)}', 100, selesai=True, pdf=tuju)
    except Dihentikan as e:
        _catat(jid, None, galat=str(e))
    except Exception as e:
        _catat(jid, None, galat=f'{type(e).__name__}: {e}')
    finally:
        HENTI.discard(jid)
        ANTREAN.keluar(jid)


def jalankan(jid, gambar, instruksi, jumlah, mapel, kelas, judul, api,
             topik='', jenjang='', n_set='', sulit='', bahasa='Indonesia',
             lembaga='', sekolah='', tanggal='', kunci=True, pembahasan=True,
             kolom='2', dua_berkas=False, kerapatan='Normal', garis='1.5',
             mata='gemini', mode='flash', mesin='gemini'):
    """Alur penuh: foto atau deskripsi -> Gemini -> Exact Worksheet Maker -> PDF.

    Arsip tidak lagi ikut. Dulu enam soal lama dilampirkan sebagai "contoh gaya",
    tapi soal acuannya datang dari foto milik Rico sendiri — gaya yang mau ditiru
    sudah ada di situ. Contoh tambahan dari naskah bertopik lain justru menarik
    hasilnya menjauh, dan memperpanjang perintah tanpa menambah apa pun.
    """
    import wsmaker, otomasi
    if not ANTREAN.masuk(jid, 'Buat Soal', lambda m: _catat(jid, m, 4)):
        return _catat(jid, None, galat='Dibatalkan sebelum mulai.')
    try:
        mata = mata if mata in MATA else 'vision'
        jalur = _simpan_sementara(gambar)
        try:
            # 1. bahan: foto, atau kalau tidak ada, deskripsi yang ditulis sendiri
            acuan = ''
            if jalur and mata in ('vision', 'dua'):
                _catat(jid, f'Membaca {len(jalur)} gambar dengan Apple Vision…', 8)
                acuan = _baca_foto(jalur)
                _catat(jid, f'Terbaca {len(acuan.split())} kata dari gambar', 18)
            if not jalur and not (topik or '').strip() and not instruksi.strip():
                return _catat(jid, None, galat='Beri foto soalnya, atau tulis '
                                               'topik/deskripsi soal yang diinginkan.')
            lampiran_foto = jalur if (jalur and mata in ('gemini', 'dua')) else None

            # 2. perintah diambil dari prompt-builder.js milik Exact Worksheet
            #    Maker, bukan disalin — supaya tidak kedaluwarsa terhadap versinya.
            _catat(jid, 'Menyusun perintah dari format Exact Worksheet Maker…', 30)
            lampiran = ''
            if acuan.strip():
                lampiran += 'NASKAH ACUAN HASIL PEMINDAIAN FOTO:\n' + acuan.strip()[:2500] + '\n\n'
            elif lampiran_foto:
                lampiran += ('Soal acuannya ada pada foto yang terlampir. Baca '
                             'langsung dari foto, termasuk gambar dan diagramnya.\n\n')
            if instruksi.strip():
                lampiran += '\nCATATAN GURU: ' + instruksi.strip()
            # Perintah baku ±16.000 karakter; separuhnya menjelaskan kemungkinan
            # yang tidak sedang terjadi. Dipangkas dulu — perintah yang lebih
            # pendek jauh lebih jarang dibalas penolakan oleh Gemini.
            # Tanpa bahan acuan, "ikuti bahasa soal" tidak punya yang diikuti —
            # jatuhkan ke Indonesia supaya Gemini tidak menebak sendiri.
            if str(bahasa).strip().lower() in ('ikut', 'auto', ''):
                bahasa = 'ikuti bahasa soal acuan' if (acuan.strip() or lampiran_foto) else 'Indonesia'
            banyak = str(n_set or '').strip() not in ('', '0', '1')
            perintah = wsmaker.isi_blok(
                wsmaker.ringkas(wsmaker.perintah_baku(mapel or 'Matematika'),
                                konteks=' '.join([topik or '', mapel or '',
                                                  instruksi or '', acuan[:600]]),
                                banyak_set=banyak,
                                ada_lampiran=bool(lampiran_foto)),
                topik=topik, jenjang=jenjang or (f'Kelas {kelas}' if kelas else ''),
                set=n_set, jumlah=jumlah, sulit=sulit, bahasa=bahasa,
                acuan='lihat lampiran di bawah' if lampiran else '')
            if lampiran: perintah += '\n\n' + lampiran
        except Exception:
            for x in jalur:
                try: os.unlink(x)
                except OSError: pass
            raise

        # 3. Gemini lewat Chrome
        _catat(jid, 'Menyusun soal…', 45)
        try:
            try:
                jawab = _tanya(mesin, perintah, lampiran_foto, mode,
                               format='soal',
                               isian=_isian_soal(mapel, jenjang, kelas, topik,
                                                 jumlah, n_set, sulit, bahasa,
                                                 instruksi, acuan),
                               lapor=lambda m: _catat(jid, m, 45),
                                henti=lambda: periksa_henti(jid))
            except RuntimeError as e:
                # Penolakan biasanya muncul saat naskah acuannya panjang. Coba
                # sekali lagi dengan perintah polos tanpa naskah acuan.
                if 'menolak' not in str(e) or not lampiran:
                    raise
                _catat(jid, 'Ditolak — mencoba ulang tanpa naskah acuan…', 50)
                ringkas = wsmaker.isi_blok(
                    wsmaker.ringkas(wsmaker.perintah_baku(mapel or 'Matematika'),
                                    konteks=' '.join([topik or '', mapel or ''])),
                    topik=topik or (acuan.strip()[:120] if acuan.strip() else ''),
                    jenjang=jenjang or (f'Kelas {kelas}' if kelas else ''),
                    set=n_set, jumlah=jumlah, sulit=sulit, bahasa=bahasa)
                jawab = _tanya(mesin, ringkas, None, mode, format='soal',
                               isian=_isian_soal(mapel, jenjang, kelas, topik,
                                                 jumlah, n_set, sulit, bahasa,
                                                 '', ''))
        finally:
            for x in jalur:
                try: os.unlink(x)
                except OSError: pass
        # Draf ganda dibuang SEBELUM apa pun memakainya: berkas naskah, bank
        # soal, dan perenderan harus melihat naskah yang sama. Kalau hanya
        # perenderannya yang dibersihkan, bank soal ikut menyimpan draf yang
        # cuma berisi satu soal.
        utuh = otomasi.buang_draf(jawab)
        if len(utuh) != len(jawab):
            _catat(jid, 'Gemini menulis dua kali — draf pendeknya dibuang', 66)
            jawab = utuh
        periksa_henti(jid)
        _catat(jid, f'Naskah diterima ({len(jawab)} karakter)', 68)

        # 4. serahkan ke perender asli
        if len(jawab.strip()) < 200 or jawab.count('\n') < 5:
            raise RuntimeError('Naskah dari Gemini terlalu pendek untuk jadi lembar kerja')
        _catat(jid, 'Memuat ke Exact Worksheet Maker…', 76)

        # 5. simpan salinan mentah + ambil PDF
        judul = judul.strip() or (topik.strip() or f'Latihan {time.strftime("%d %b %H:%M")}')
        kop = dict(lembaga=lembaga or 'Exact Course', mapel=kode_mapel(mapel),
                   sekolah=sekolah, kelas=str(kelas or '') or (jenjang or ''),
                   tanggal=tanggal or time.strftime('%d%m'),
                   kunci=kunci, pembahasan=pembahasan, kolom=str(kolom or '2'),
                   kerapatan=kerapatan or 'Normal', garis_per_nilai=garis or '1.5')
        os.makedirs(KELUAR, exist_ok=True)
        nama = nama_berkas(kop, kunci and not dua_berkas, KELUAR)
        cap = time.strftime('%Y-%m-%d %H%M')
        os.makedirs(NASKAH, exist_ok=True)
        open(os.path.join(NASKAH, f'{nama} — {cap}.txt'), 'w', encoding='utf-8').write(jawab)
        # Simpan ke bank soal supaya bisa dicari dan disusun ulang TANPA AI.
        try:
            import naskah as _nsk
            butir, meta = _nsk.urai(jawab)
            if butir:
                c = _db()
                potongan = re.sub(r'\W+', '-', judul)[:40]
                cur = c.execute("""INSERT INTO dokumen(rel,nama,folder,mapel,kelas,jenis,n_hal,n_hal_teks)
                                   VALUES(?,?,'DIBUAT',?,?,'Worksheet Maker',1,1)""",
                                (f'DIBUAT/{int(time.time())}-{potongan}',
                                 meta.get('judul') or judul, mapel or None, kelas or None))
                dok = cur.lastrowid; ids = []
                for i, b in enumerate(butir, 1):
                    cc = c.execute("""INSERT INTO soal(dok_id,no_hal,no_soal,batang,opsi,n_opsi,
                                        sidik,mutu,dup,kunci,bobot,jenis_soal,pembahasan)
                                      VALUES(?,1,?,?,?,?,NULL,?,0,?,?,?,?)""",
                                   (dok, b['no'], b['batang'],
                                    json.dumps(b['opsi'], ensure_ascii=False), len(b['opsi']),
                                    2 if len(b['opsi']) >= 3 else 1,
                                    b.get('kunci') or None, b.get('bobot'),
                                    b.get('jenis'), b.get('pembahasan') or None))
                    ids.append(cc.lastrowid)
                c.executemany("INSERT INTO soal_fts(batang,opsi,soal_id) SELECT batang,opsi,id FROM soal WHERE id=?",
                              [(i,) for i in ids])
                c.commit(); c.close()
                _catat(jid, f'{len(butir)} soal masuk bank soal '
                            f'({sum(1 for b in butir if b.get("kunci"))} berkunci)', 86)
        except Exception as e:
            _catat(jid, f'Bank soal dilewati ({type(e).__name__})', 86)

        _catat(jid, 'Merender lembar lalu mencetak PDF…', 88)
        tuju = os.path.join(KELUAR, f'{nama}.pdf')
        if dua_berkas:
            # Dirender dua kali dari naskah yang SAMA: lembar siswa tanpa kunci,
            # lembar guru dengan kunci. Meminta Gemini dua kali akan menghasilkan
            # soal yang berbeda — itu bukan yang diinginkan.
            tuju_kunci = os.path.join(KELUAR, f'{nama} - Soal+Jawaban.pdf')
            otomasi.worksheet_pdf(jawab, tuju, kop=kop, tujuan_kunci=tuju_kunci)
            subprocess.run(['open', tuju], capture_output=True)
            _catat(jid, f'Selesai — 2 berkas: {os.path.basename(tuju)} '
                        f'dan {os.path.basename(tuju_kunci)}',
                   100, selesai=True, pdf=tuju)
        else:
            otomasi.worksheet_pdf(jawab, tuju, kop=kop)
            subprocess.run(['open', tuju], capture_output=True)
            _catat(jid, 'Selesai — PDF terbuka', 100, selesai=True, pdf=tuju)
    except Dihentikan as e:
        _catat(jid, None, galat=str(e))
    except Exception as e:
        _catat(jid, None, galat=f'{type(e).__name__}: {e}')
    finally:
        HENTI.discard(jid)
        ANTREAN.keluar(jid)

GAYA = """
:root{--bg:#fbfbfa;--kartu:#fff;--tepi:#e3e3e0;--teks:#1a1a19;--redup:#6b6b66;--aksen:#c4572a}
@media(prefers-color-scheme:dark){:root{--bg:#1a1a19;--kartu:#232322;--tepi:#37372f;--teks:#f0efea;--redup:#9a9a92}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--teks);
font:15px/1.55 ui-sans-serif,-apple-system,"Segoe UI",sans-serif}
.b{max-width:760px;margin:0 auto;padding:26px 18px 70px}
h1{font-size:21px;margin:0 0 3px}
.kopApp{display:flex;align-items:center;gap:12px;margin-bottom:14px;
padding-bottom:12px;border-bottom:2px solid var(--teks)}
.kopApp img{height:40px;width:auto}.s{color:var(--redup);font-size:13px;margin-bottom:18px}
.k{background:var(--kartu);border:1px solid var(--tepi);border-radius:12px;padding:16px;margin-bottom:12px}
.j{border:2px dashed var(--tepi);border-radius:11px;padding:26px;text-align:center;
color:var(--redup);font-size:13px;cursor:pointer}
.j.aktif{border-color:var(--aksen);color:var(--aksen)}
.j:focus{outline:2px solid var(--aksen);outline-offset:2px}
.kcl{font-size:11.5px;opacity:.7;margin-top:4px}
.nav{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px}
.nav a,.nav span{padding:7px 13px;border:1px solid var(--tepi);border-radius:8px;
font-size:12.5px;text-decoration:none;color:var(--redup);background:var(--kartu)}
.nav .aktif{background:var(--aksen);color:#fff;border-color:var(--aksen);font-weight:600}
.gal{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}
.gal figure{position:relative;margin:0;width:92px}
.gal img,.gal .pdfkartu{width:92px;height:70px;border-radius:7px;
border:1px solid var(--tepi);display:block}
.gal img{object-fit:cover}
.gal .pdfkartu{background:var(--bg);color:var(--aksen);font-weight:700;font-size:15px;
display:flex;align-items:center;justify-content:center;letter-spacing:1px}
.gal figcaption{font-size:10.5px;color:var(--redup);margin-top:3px;
overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gal button{position:absolute;top:-7px;right:-7px;width:21px;height:21px;padding:0;
border-radius:50%;background:#c0392b;color:#fff;font-size:13px;line-height:19px;
border:2px solid var(--kartu);cursor:pointer}
.j:focus{outline:2px solid var(--aksen);outline-offset:2px}
.kcl{font-size:11.5px;opacity:.7;margin-top:4px}
.nav{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px}
.nav a,.nav span{padding:7px 13px;border:1px solid var(--tepi);border-radius:8px;
font-size:12.5px;text-decoration:none;color:var(--redup);background:var(--kartu)}
.nav .aktif{background:var(--aksen);color:#fff;border-color:var(--aksen);font-weight:600}
.gal{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}
.gal figure{position:relative;margin:0;width:92px}
.gal img,.gal .pdfkartu{width:92px;height:70px;border-radius:7px;
border:1px solid var(--tepi);display:block}
.gal img{object-fit:cover}
.gal .pdfkartu{background:var(--bg);color:var(--aksen);font-weight:700;font-size:15px;
display:flex;align-items:center;justify-content:center;letter-spacing:1px}
.gal figcaption{font-size:10.5px;color:var(--redup);margin-top:3px;
overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gal button{position:absolute;top:-7px;right:-7px;width:21px;height:21px;padding:0;
border-radius:50%;background:#c0392b;color:#fff;font-size:13px;line-height:19px;
border:2px solid var(--kartu);cursor:pointer}
textarea{width:100%;padding:11px;border:1px solid var(--tepi);border-radius:9px;
background:var(--bg);color:var(--teks);font:14px/1.5 inherit;resize:vertical}
input,select{padding:9px 11px;border:1px solid var(--tepi);border-radius:8px;
background:var(--bg);color:var(--teks);font-size:13px}
.r{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:11px}
button{padding:11px 22px;border:0;border-radius:9px;background:var(--aksen);color:#fff;
font-weight:600;font-size:14px;cursor:pointer}
button:disabled{opacity:.5;cursor:default}
@media (max-width:620px){
  /* Menempel-di-bawah TIDAK dipakai: tinggi bingkai mengikuti isinya, jadi yang
     menggulir adalah halaman luar dan position:sticky di dalam tak berpengaruh.
     Yang dilakukan hanya memperbesar sasaran sentuh. */
  .r.kirim button{flex:1;min-width:150px;padding:15px 20px;font-size:16px}
  input,select,textarea{font-size:16px}   /* cegah peramban ponsel memperbesar */
}
button.abu{background:var(--tepi);color:var(--teks);font-weight:600}
.bar{height:6px;background:var(--tepi);border-radius:3px;overflow:hidden;margin:12px 0 9px}
.bar i{display:block;height:100%;background:var(--aksen);width:0;transition:width .4s}
.lg{font-size:13px;color:var(--redup)}.lg div{padding:2px 0}
.lg div.now{color:var(--teks);font-weight:600}
.tombolCetak{display:inline-block;padding:11px 22px;border-radius:9px;
background:var(--aksen);color:#fff;font-weight:700;font-size:14px;text-decoration:none}
.err{color:#c0392b;font-size:13.5px}
.tugas{border:1px solid var(--tepi);border-radius:10px;padding:10px 12px;margin-bottom:9px;
 background:var(--kartu)}
.tugas .bar{height:4px;background:var(--tepi);border-radius:3px;overflow:hidden;margin-bottom:8px}
.tugas .bar i{display:block;height:100%;background:var(--aksen);transition:width .4s}
.tugasIsi{display:flex;gap:10px;align-items:center;justify-content:space-between;
 flex-wrap:wrap;font-size:13px}
.tugasIsi b{font-weight:600}
button.mini.henti{flex:none;padding:5px 12px;border:1px solid var(--tepi);border-radius:7px;
 background:var(--bg);color:var(--redup);font-size:12px;cursor:pointer}
button.mini.henti:disabled{opacity:.5}
.antre{margin-top:9px;padding:10px 12px;border:1px solid var(--tepi);border-radius:9px;
 background:var(--bg);font-size:13px;line-height:1.6}
.antre b{color:var(--aksen)}
button.batal{margin-top:8px;background:var(--tepi);color:var(--teks);font-size:12.5px;padding:6px 12px}
.pr{background:#fff8f0;border:1px solid #f0d8c0;border-radius:9px;padding:11px;font-size:13px;color:#8a5a2a}
@media(prefers-color-scheme:dark){.pr{background:#2a2118;border-color:#4a3a28;color:#d8a870}}
"""


SKRIP = """
const MAKS = 10;
const j = document.getElementById('j'), fi = document.getElementById('file'),
      gal = document.getElementById('gal');
let berkas = [];

function gambarkan(){
  gal.innerHTML = '';
  berkas.forEach((f, i) => {
    const fig = document.createElement('figure');
    const pdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
    let img;
    if (pdf) {
      img = document.createElement('div');
      img.className = 'pdfkartu';
      img.textContent = 'PDF';
    } else {
      img = document.createElement('img');
      img.src = URL.createObjectURL(f);
    }
    const cap = document.createElement('figcaption');
    cap.textContent = f.name || ('tempelan ' + (i+1));
    const x = document.createElement('button');
    x.type = 'button'; x.textContent = '\\u00d7'; x.title = 'hapus';
    x.onclick = () => { berkas.splice(i,1); gambarkan(); };
    fig.append(img, x, cap); gal.appendChild(fig);
  });
  const sisa = MAKS - berkas.length;
  j.firstChild.textContent = berkas.length
    ? berkas.length + ' berkas dipilih' + (sisa ? ' \\u00b7 bisa tambah ' + sisa + ' lagi' : ' \\u00b7 penuh')
    : 'tempel tangkapan layar (\\u2318V), jatuhkan foto atau PDF, atau klik untuk memilih';
  j.classList.toggle('aktif', berkas.length > 0);
}

function tambah(daftar){
  let ditolak = 0;
  for (const f of daftar) {
    const pdf = f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name || ''));
    if (!f || !(f.type.startsWith('image/') || pdf)) continue;
    if (berkas.length >= MAKS) { ditolak++; continue; }
    berkas.push(f);
  }
  gambarkan();
  if (ditolak) alert('Maksimal ' + MAKS + ' berkas. ' + ditolak + ' berkas terakhir diabaikan.');
}

// Jalur paling andal di Mac: server membaca papan klip sendiri, jadi tidak
// bergantung pada fokus halaman maupun dukungan tempel peramban.
document.getElementById('btnKlip').onclick = async () => {
  const kabar = document.getElementById('kabarKlip');
  kabar.textContent = 'mengambil…';
  try {
    const r = await fetch('/klip?t=' + Date.now());
    if (!r.ok) { kabar.textContent = 'papan klip tidak berisi gambar'; return; }
    const b = await r.blob();
    const cap = new Date().toISOString().slice(11,19).replace(/:/g,'');
    tambah([new File([b], 'klip-' + cap + '.png', {type:'image/png'})]);
    kabar.textContent = '';
  } catch (e) { kabar.textContent = 'gagal: ' + e.message; }
};

const preset = document.getElementById('preset');
if (preset) preset.onchange = () => {
  if (!preset.value) return;
  document.querySelector('[name=jumlah]').value = preset.value;
  preset.selectedIndex = 0;          // kembali ke label, nilainya sudah pindah
};

// Berkas yang dititipkan aplikasi Android ditarik balik jadi bagian galeri,
// supaya terlihat dan bisa dihapus seperti berkas lain.
if (typeof TITIP !== 'undefined' && TITIP) {
  (async () => {
    for (let i = 0; i < 10; i++) {
      const r = await fetch('/titipan?k=' + TITIP + '&n=' + i);
      if (!r.ok) break;
      const b = await r.blob();
      const cd = r.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename="([^"]*)"/);
      tambah([new File([b], m ? m[1] : ('titipan-' + (i+1)), {type: b.type})]);
    }
  })();
}

j.onclick = () => fi.click();
fi.onchange = () => { tambah(fi.files); fi.value = ''; };

// Kamera dipisah dari pemilih berkas: atribut capture membuat Android/iPad
// membuka kamera langsung, bukan galeri. Boleh beberapa jepretan sekaligus.
const kam = document.getElementById('kamera');
const bf = document.getElementById('btnFoto');
if (bf && kam) {
  bf.onclick = () => kam.click();
  kam.onchange = () => { tambah(kam.files); kam.value = ''; };
}

// Tempel dari papan klip: tangkapan layar Cmd+Shift+4 masuk langsung tanpa perlu
// disimpan jadi berkas dulu. Sebagian sumber menaruhnya sebagai Blob tanpa nama,
// jadi namanya dibuatkan di sini supaya unggahannya tetap sah.
document.addEventListener('paste', e => {
  const d = e.clipboardData; if (!d) return;
  const item = [].slice.call(d.items || []).filter(x => x.type.indexOf('image/') === 0);
  if (!item.length) return;
  e.preventDefault();
  const cap = new Date().toISOString().slice(11,19).replace(/:/g,'');
  const hasil = [];
  item.forEach((x, n) => {
    const b = x.getAsFile(); if (!b) return;
    const ext = (b.type.split('/')[1] || 'png').replace('jpeg','jpg');
    hasil.push(new File([b], b.name || ('tempel-' + cap + '-' + (n+1) + '.' + ext), {type: b.type}));
  });
  tambah(hasil);
});

['dragenter','dragover'].forEach(e => j.addEventListener(e, v => { v.preventDefault(); j.classList.add('aktif'); }));
j.addEventListener('dragleave', v => { v.preventDefault(); });
j.addEventListener('drop', v => { v.preventDefault(); tambah(v.dataTransfer.files); });

// Beberapa lembar boleh diantre sekaligus. Tombol kirim TIDAK dikunci selama
// satu tugas berjalan: server sudah punya antrean bergiliran, jadi yang perlu
// di sini hanyalah menampilkan tiap tugas pada barisnya sendiri. Dulu halaman
// ini langsung berpindah ke pratinjau begitu satu lembar jadi — itu memutus
// antrean, karena borangnya ikut hilang sebelum lembar berikutnya dikirim.
const TUGAS = [];

function barisTugas(t) {
  const hal = document.getElementById('antrean');
  let el = document.getElementById('t-' + t.jid);
  if (!el) {
    el = document.createElement('div');
    el.className = 'tugas'; el.id = 't-' + t.jid;
    hal.prepend(el);
  }
  const s = t.s || {};
  const q = s.antre;
  let kanan = '';
  if (s.galat) kanan = '<span class=err>' + s.galat + '</span>';
  else if (s.pdf) {
    const nama = s.pdf.split('/').pop();
    kanan = '<a class=tombolCetak href="/hasil?f=' + encodeURIComponent(nama)
          + '" target=_top>Lihat &amp; Cetak</a>';
  } else if (q && q.nomor) {
    kanan = '<span class=kcl>antrean ke-' + q.nomor
          + (q.kerja ? ' &middot; ' + q.kerja.nama + ' ' + Math.floor(q.kerja.detik/60) + ' mnt' : '')
          + '</span>';
  } else {
    kanan = '<span class=kcl>' + ((s.langkah || ['Mulai…']).slice(-1)[0]) + '</span>';
  }
  const bisaHenti = !s.selesai && !s.galat;
  el.innerHTML = '<div class=bar><i style="width:' + (s.maju || 0) + '%"></i></div>'
    + '<div class=tugasIsi><b>' + t.judul + '</b>' + kanan
    + (bisaHenti ? '<button type=button class="mini henti" data-jid="' + t.jid + '">Hentikan</button>' : '')
    + '</div>';
  const bh = el.querySelector('.henti');
  if (bh) bh.onclick = async () => {
    bh.disabled = true; bh.textContent = 'menghentikan…';
    try { await fetch('/batal?jid=' + t.jid); } catch (e) {}
  };
}

async function pantau(t) {
  let gagal = 0;
  const timer = setInterval(async () => {
    try {
      t.s = await (await fetch('/status?jid=' + t.jid)).json();
      gagal = 0;
    } catch (err) {
      if (++gagal < 8) return;
      clearInterval(timer);
      t.s = {galat: 'Sambungan ke server terputus.', selesai: true};
    }
    barisTugas(t);
    if (t.s.selesai) clearInterval(timer);
  }, 1500);
}

document.getElementById('f').onsubmit = async e => {
  e.preventDefault();
  const panel = document.getElementById('panel'), log = document.getElementById('log');
  if (!berkas.length && !document.querySelector('[name=topik]').value.trim()) {
    panel.style.display = 'block';
    log.innerHTML = '<div class=err>Belum bisa dimulai: isi <b>topik</b>, '
      + 'atau tempel minimal satu gambar soal (\u2318V).</div>';
    return;
  }
  log.innerHTML = '';
  panel.style.display = 'block';
  const go = document.getElementById('go');
  const fd = new FormData(e.target);
  fd.delete('gambar');
  berkas.forEach(f => fd.append('gambar', f, f.name));
  const judul = (fd.get('judul') || '').toString().trim()
             || (fd.get('topik') || '').toString().trim()
             || (berkas.length ? berkas.length + ' foto' : 'Lembar');
  go.disabled = true;                       // hanya selama kiriman berlangsung
  let jid;
  try {
    const r = await fetch('/buat', {method:'POST', body: fd});
    jid = (await r.json()).jid;
  } catch (err) {
    log.innerHTML = '<div class=err>Tidak bisa menghubungi server. '
      + 'Pastikan aplikasinya masih menyala, lalu coba lagi.</div>';
    go.disabled = false; return;
  } finally {
    go.disabled = false;
  }
  if (!jid) { log.innerHTML = '<div class=err>Server tidak memulai tugas. Coba lagi.</div>'; return; }
  const t = {jid: jid, judul: judul, s: {maju: 3, langkah: ['Mulai…']}};
  TUGAS.push(t); barisTugas(t); pantau(t);
  // Foto dikosongkan supaya lembar berikutnya tidak diam-diam memakai foto yang
  // sama; isian lain sengaja dibiarkan agar tinggal diubah sedikit lalu kirim.
  berkas.length = 0; gambarkan();
};
"""


SULIT_BAWAAN = 'sama dengan naskah acuan'

KET_MATA = """
// Mode Gemini (Flash/Pro/Extended) tidak berlaku untuk Claude, jadi barisnya
// disembunyikan supaya tidak terlihat seperti pilihan yang diabaikan.
(() => {
  const m = document.getElementById('mesin'), baris = document.getElementById('barisMode');
  if (!m || !baris) return;
  const atur = () => { baris.hidden = (m.value !== 'gemini'); };
  m.onchange = atur; atur();
})();

// Keterangan singkat tiap pilihan baca foto.
(() => {
  const KET = {
    vision: 'Foto dibaca di Mac dan tidak dikirim ke mana pun. Paling cepat, dan paling tepat untuk soal ketikan. Gambar, diagram, dan tulisan tangan tidak ikut terbaca.',
    gemini: 'Foto diunggah ke Gemini, jadi diagram, grafik, dan tulisan tangan ikut terbaca. Lebih lambat, dan fotonya keluar dari Mac.',
    dua: 'Teks hasil Apple Vision dikirim bersama fotonya. Ejaan teks cetak terjaga sekaligus gambarnya tetap terlihat.'
  };
  const s = document.getElementById('mata'), k = document.getElementById('ketMata');
  if (!s || !k) return;
  const gambar = () => k.textContent = KET[s.value] || '';
  s.onchange = gambar; gambar();
})();
"""

SKRIP_JAWAB = SKRIP.replace("fetch('/buat'", "fetch('/jawab'").replace(
    "!berkas.length && !document.querySelector('[name=topik]').value.trim()",
    "!berkas.length") + """
// Keterangan singkat tiap pilihan: bedanya nyata, jadi jangan dibiarkan ditebak.
(() => {
  const KET = {
    vision: 'Foto dibaca di Mac dan tidak dikirim ke mana pun. Paling cepat, dan paling tepat untuk soal ketikan. Gambar, diagram, dan tulisan tangan tidak ikut terbaca.',
    gemini: 'Foto diunggah ke Gemini, jadi diagram, grafik, dan tulisan tangan ikut terbaca. Lebih lambat, dan fotonya keluar dari Mac.',
    dua: 'Teks hasil Apple Vision dikirim bersama fotonya. Ejaan teks cetak terjaga sekaligus gambarnya tetap terlihat.'
  };
  const s = document.getElementById('mata'), k = document.getElementById('ketMata');
  if (!s || !k) return;
  const gambar = () => k.textContent = KET[s.value] || '';
  s.onchange = gambar; gambar();
})();
"""


def halaman_jawab(titip=''):
    """Tab Jawaban: foto soal anak -> kunci + pembahasan."""
    import setelan as _s
    st = _s.muat()
    n = lambda k: html.escape(st.get(k, '') or '')
    return f"""<!doctype html><meta charset=utf-8><title>Kunci Jawaban</title>
<meta name=viewport content="width=device-width,initial-scale=1"><style>{GAYA}</style>
<div class=b>
<div class=kopApp><img src="/statik/logo.png" alt=""><div>
  <h1>Kunci Jawaban &amp; Pembahasan</h1>
  <div class=s style="margin:0">Exact Course &middot; Worksheet Maker</div></div></div>
<div class=s>Foto soal anak, lalu jadi PDF berisi soalnya beserta kunci dan
pembahasan langkah demi langkah. Soalnya disalin apa adanya &mdash; tidak dikarang.</div>
<form id=f>
<div class=k>
  <div class=j id=j tabindex=0>foto soal atau jatuhkan gambar/PDF
    <div class=kcl>sampai 10 berkas</div>
    <input type=file name=gambar id=file accept="image/*,.pdf,application/pdf" multiple hidden>
    <input type=file id=kamera accept="image/*" capture="environment" multiple hidden></div>
  <div class=r style="margin-top:9px">
    <button type=button id=btnFoto class=abu>Foto soal</button>
    <button type=button id=btnKlip class=abu>Ambil dari papan klip</button>
    <span class=kcl id=kabarKlip style="margin:0"></span>
  </div>
  <div class=gal id=gal></div>
  <div class=r>
    <input name=mapel placeholder="mapel" style="flex:1;min-width:140px">
    <input name=kelas placeholder="kelas" size=6>
    <select name=bahasa title="bahasa jawaban">
      <option value=ikut{" selected" if st.get("bahasa","ikut") not in ("Indonesia","Inggris") else ""}>ikuti bahasa soal</option>
      <option value=Indonesia{" selected" if st.get("bahasa")=="Indonesia" else ""}>Indonesia</option>
      <option value=Inggris{" selected" if st.get("bahasa")=="Inggris" else ""}>Inggris</option>
    </select>
    <select name=kolom><option value=1>1 kolom</option><option value=2>2 kolom</option></select>
  </div>
  <div class=r>
    <select name=mesin id=mesin style="flex:1;min-width:220px">
      <option value=gemini{" selected" if st.get("mesin","gemini")!="claude" else ""}>Gemini Flash &mdash; murah, untuk jumlah banyak</option>
      <option value=claude{" selected" if st.get("mesin")=="claude" else ""}>Claude &mdash; cepat &amp; jarang gagal, tapi boros kuota</option>
    </select>
  </div>
  <div class=r>
    <select name=mata id=mata style="flex:1;min-width:220px">
      <option value=gemini{" selected" if st.get("mata","gemini")!="vision" and st.get("mata")!="dua" else ""}>Mata AI &mdash; tulisan tangan, diagram &amp; grafik</option>
      <option value=vision{" selected" if st.get("mata")=="vision" else ""}>Apple Vision di Mac &mdash; cepat, hanya teks ketikan</option>
      <option value=dua{" selected" if st.get("mata")=="dua" else ""}>Keduanya &mdash; paling teliti, paling lama</option>
    </select>
  </div>
  <div class=kcl id=ketMata style="margin-top:5px"></div>
  <div class=r id=barisMode>
    <select name=mode style="flex:1;min-width:220px">
      <option value=flash{" selected" if st.get("mode","flash")!="pro" and st.get("mode")!="panjang" else ""}>Gemini Flash &mdash; hemat, untuk sehari-hari</option>
      <option value=pro{" selected" if st.get("mode")=="pro" else ""}>Gemini Pro &mdash; lebih jarang menolak, lebih boros</option>
      <option value=panjang{" selected" if st.get("mode")=="panjang" else ""}>Extended thinking &mdash; naskah berat, paling lambat</option>
    </select>
  </div>
  <textarea name=instruksi rows=2 style="margin-top:11px"
    placeholder="Catatan (mis. 'jelaskan sampai langkah hitungannya', 'pakai cara kelas 8')"></textarea>
  <div class="r kirim">
    <input name=judul placeholder="judul (opsional)" style="flex:1;min-width:150px">
    <button id=go type=submit>Buat Kunci &amp; Pembahasan</button>
  </div>
</div>
</form>
<div class=k id=panel style=display:none>
  <div class=lg id=log></div>
  <div id=antrean></div>
</div>
</div>
<input type=hidden name=titip value="{html.escape(titip, quote=True)}">
<script>const TITIP={json.dumps(titip)};{SKRIP_JAWAB}</script>"""


def halaman(izin_chrome=True, setel=None, titip=''):
    import setelan as _s
    st = setel or _s.muat()
    n = lambda k: html.escape(st.get(k, '') or '')
    tgl_ini = time.strftime('%d%m')
    try:
        import sqlite3 as _sq
        _c = _sq.connect(DB); n_bank = _c.execute(
            'SELECT COUNT(*) FROM soal WHERE dup=0').fetchone()[0]; _c.close()
    except Exception:
        n_bank = 0
    c = lambda k: ' checked' if st.get(k) else ''
    peringatan = ''
    return f"""<!doctype html><meta charset=utf-8><title>Exact Worksheet Maker</title>
<meta name=viewport content="width=device-width,initial-scale=1"><style>{GAYA}</style>
<div class=b>
<div class=kopApp><img src="/statik/logo.png" alt=""><div>
  <h1>Buat Soal Baru</h1>
  <div class=s style="margin:0">Exact Course &middot; Worksheet Maker</div></div></div>
<div class=s>Tempel tangkapan layar soal dan isi kriteria. Gemini mengarang,
Mac ini menata, PDF terbuka sendiri.</div>
<div class=s style="margin-top:-10px">Bank soal: {n_bank:,} soal tersimpan &mdash;
bisa disusun tanpa AI lewat tab <b>Bank Soal</b> di atas.</div>
{peringatan}
<form id=f>
<div class=k>
  <div class=j id=j tabindex=0>tempel tangkapan layar (&#8984;V), jatuhkan foto atau PDF, atau klik untuk memilih
    <div class=kcl>sampai 10 berkas</div>
    <input type=file name=gambar id=file accept="image/*,.pdf,application/pdf" multiple hidden>
    <input type=file id=kamera accept="image/*" capture="environment" multiple hidden></div>
  <div class=r style="margin-top:9px">
    <button type=button id=btnFoto class=abu>Foto soal</button>
    <button type=button id=btnKlip class=abu>Ambil dari papan klip</button>
    <span class=kcl id=kabarKlip style="margin:0"></span>
  </div>
  <div class=gal id=gal></div>
  <div class=r>
    <input name=mapel placeholder="mapel" style="flex:1;min-width:150px">
    <input name=topik placeholder="topik (kosongkan jika pakai gambar)" style="flex:2;min-width:190px">
  </div>
  <div class=r>
    <input name=jenjang placeholder="kelas/jenjang" size=12>
    <select id=preset title="komposisi siap pakai" style="min-width:150px">
      <option value="">komposisi…</option>
      <option>10 PG + 5 Esai</option>
      <option>10 Esai</option>
      <option>20 PG</option>
      <option>30 PG</option>
      <option>5 PG + 2 B + 2 I + 1 E</option>
      <option>15 PG + 5 Isian</option>
    </select>
    <input name=jumlah placeholder="atau tulis sendiri" value="{n('jumlah')}" style="flex:1;min-width:150px">
    <input name=n_set placeholder="set" value="{n('n_set') or '2'}" size=4 title="jumlah set">
    <input name=sulit placeholder="kesulitan" value="{n('sulit') or SULIT_BAWAAN}" style="min-width:170px">
    <select name=bahasa title="bahasa jawaban">
      <option value=ikut{" selected" if st.get("bahasa","ikut") not in ("Indonesia","Inggris") else ""}>ikuti bahasa soal</option>
      <option value=Indonesia{" selected" if st.get("bahasa")=="Indonesia" else ""}>Indonesia</option>
      <option value=Inggris{" selected" if st.get("bahasa")=="Inggris" else ""}>Inggris</option>
    </select>
  </div>
  <textarea name=instruksi rows=2 style="margin-top:11px"
    placeholder="Catatan tambahan untuk Gemini (opsional)">{n('instruksi')}</textarea>
  <div class=r>
    <input name=lembaga placeholder="nama lembaga" value="{n('lembaga') or 'Exact Course'}" style="flex:1;min-width:150px">
    <input name=sekolah placeholder="kode sekolah" value="{n('sekolah')}" size=10>
    <input name=tanggal placeholder="tgl" value="{tgl_ini}" size=7>
  </div>
  <div class=r>
    <select name=kerapatan title="kerapatan tata letak">
      <option value=Normal{" selected" if st.get('kerapatan','Normal')=='Normal' else ""}>kerapatan normal</option>
      <option value=Padat{" selected" if st.get('kerapatan')=='Padat' else ""}>padat (hemat kertas)</option>
      <option value=Lega{" selected" if st.get('kerapatan')=='Lega' else ""}>lega</option>
    </select>
    <select name=garis title="ruang jawab per nilai">
      <option value=1.5{" selected" if st.get('garis','1.5')=='1.5' else ""}>ruang jawab sedang</option>
      <option value=0.5{" selected" if st.get('garis')=='0.5' else ""}>ruang jawab sempit</option>
      <option value=2.5{" selected" if st.get('garis')=='2.5' else ""}>ruang jawab luas</option>
    </select>
    <select name=kolom title="tata letak">
      <option value=2{" selected" if st.get('kolom','2')!='1' else ""}>2 kolom (hemat)</option>
      <option value=1{" selected" if st.get('kolom')=='1' else ""}>1 kolom penuh</option>
    </select>
    <label class=kcl><input type=checkbox name=dua_berkas{c('dua_berkas')}> dua berkas: soal &amp; soal+jawaban</label>
    <label class=kcl><input type=checkbox name=kunci checked> kunci jawaban</label>
    <label class=kcl><input type=checkbox name=pembahasan checked> pembahasan</label>
  </div>
  <div class=r>
    <select name=mesin id=mesin style="flex:1;min-width:220px">
      <option value=gemini{" selected" if st.get("mesin","gemini")!="claude" else ""}>Gemini Flash &mdash; murah, untuk jumlah banyak</option>
      <option value=claude{" selected" if st.get("mesin")=="claude" else ""}>Claude &mdash; cepat &amp; jarang gagal, tapi boros kuota</option>
    </select>
  </div>
  <div class=r>
    <select name=mata id=mata style="flex:1;min-width:220px">
      <option value=gemini{" selected" if st.get("mata","gemini")!="vision" and st.get("mata")!="dua" else ""}>Mata AI &mdash; tulisan tangan, diagram &amp; grafik</option>
      <option value=vision{" selected" if st.get("mata")=="vision" else ""}>Apple Vision di Mac &mdash; cepat, hanya teks ketikan</option>
      <option value=dua{" selected" if st.get("mata")=="dua" else ""}>Keduanya &mdash; paling teliti, paling lama</option>
    </select>
  </div>
  <div class=kcl id=ketMata style="margin-top:5px"></div>
  <div class=r id=barisMode>
    <select name=mode style="flex:1;min-width:220px">
      <option value=flash{" selected" if st.get("mode","flash")!="pro" and st.get("mode")!="panjang" else ""}>Gemini Flash &mdash; hemat, untuk sehari-hari</option>
      <option value=pro{" selected" if st.get("mode")=="pro" else ""}>Gemini Pro &mdash; lebih jarang menolak, lebih boros</option>
      <option value=panjang{" selected" if st.get("mode")=="panjang" else ""}>Extended thinking &mdash; naskah berat, paling lambat</option>
    </select>
  </div>
  <div class="r kirim">
    <input name=judul placeholder="judul berkas (opsional)" style="flex:1;min-width:150px">
    <button id=go type=submit>Buat PDF</button>
  </div>
</div>
</form>
<div class=k id=panel style=display:none>
  <div class=lg id=log></div>
  <div id=antrean></div>
</div>
</div>
<input type=hidden name=titip value="{html.escape(titip, quote=True)}">
<script>const TITIP={json.dumps(titip)};{SKRIP}{KET_MATA}</script>"""


SKRIP_RANGKUM = SKRIP.replace("fetch('/buat'", "fetch('/rangkum'").replace(
    "!berkas.length && !document.querySelector('[name=topik]').value.trim()",
    "!berkas.length && !document.querySelector('[name=topik]').value.trim()") + """
// Keterangan pilihan mata, sama seperti di tab Kunci Jawaban.
(() => {
  const KET = {
    vision: 'Materi dibaca di Mac dan tidak dikirim ke mana pun. Paling cepat, dan paling tepat untuk teks ketikan.',
    gemini: 'Materi diunggah ke Gemini, jadi diagram, grafik, dan tulisan tangan ikut terbaca. Lebih lambat.',
    dua: 'Teks hasil Apple Vision dikirim bersama berkasnya. Ejaan terjaga sekaligus gambarnya tetap terlihat.'
  };
  const s = document.getElementById('mata'), k = document.getElementById('ketMata');
  if (!s || !k) return;
  const gambar = () => k.textContent = KET[s.value] || '';
  s.onchange = gambar; gambar();
})();
"""


def halaman_rangkum(titip=''):
    """Tab Rangkuman: materi -> lembar rangkuman untuk dibaca ulang."""
    import setelan as _s
    st = _s.muat()
    n = lambda k: html.escape(st.get(k, '') or '')
    return f"""<!doctype html><meta charset=utf-8><title>Rangkuman</title>
<meta name=viewport content="width=device-width,initial-scale=1"><style>{GAYA}</style>
<div class=b>
<div class=kopApp><img src="/statik/logo.png" alt=""><div>
  <h1>Rangkuman &amp; Ringkasan</h1>
  <div class=s style="margin:0">Exact Course &middot; Worksheet Maker</div></div></div>
<div class=s>Foto atau PDF materinya, lalu jadi lembar rangkuman: inti materi,
poin per sub-bab, rumus, contoh, dan hal yang mudah keliru. Tanpa bahan pun bisa
&mdash; cukup tulis topiknya.</div>
<form id=f>
<div class=k>
  <div class=j id=j tabindex=0>foto materi atau jatuhkan gambar/PDF
    <div class=kcl>boleh dikosongkan kalau hanya mengisi topik</div>
    <input type=file name=gambar id=file accept="image/*,.pdf,application/pdf" multiple hidden>
    <input type=file id=kamera accept="image/*" capture="environment" multiple hidden></div>
  <div class=r style="margin-top:9px">
    <button type=button id=btnFoto class=abu>Foto materi</button>
    <button type=button id=btnKlip class=abu>Ambil dari papan klip</button>
    <span class=kcl id=kabarKlip style="margin:0"></span>
  </div>
  <div class=gal id=gal></div>
  <div class=r>
    <input name=topik placeholder="topik (mis. 'Teorema Pythagoras')" style="flex:2;min-width:190px">
  </div>
  <div class=r>
    <input name=mapel placeholder="mapel" style="flex:1;min-width:140px">
    <input name=kelas placeholder="kelas" size=6>
    <input name=bagian placeholder="bagian" value="5" size=6 title="berapa sub-bab">
    <select name=bahasa title="bahasa jawaban">
      <option value=ikut{" selected" if st.get("bahasa","ikut") not in ("Indonesia","Inggris") else ""}>ikuti bahasa soal</option>
      <option value=Indonesia{" selected" if st.get("bahasa")=="Indonesia" else ""}>Indonesia</option>
      <option value=Inggris{" selected" if st.get("bahasa")=="Inggris" else ""}>Inggris</option>
    </select>
  </div>
  <div class=r>
    <select name=mesin id=mesin style="flex:1;min-width:220px">
      <option value=gemini{" selected" if st.get("mesin","gemini")!="claude" else ""}>Gemini Flash &mdash; murah, untuk jumlah banyak</option>
      <option value=claude{" selected" if st.get("mesin")=="claude" else ""}>Claude &mdash; cepat &amp; jarang gagal, tapi boros kuota</option>
    </select>
  </div>
  <div class=r>
    <select name=mata id=mata style="flex:1;min-width:220px">
      <option value=gemini{" selected" if st.get("mata","gemini")!="vision" and st.get("mata")!="dua" else ""}>Mata AI &mdash; tulisan tangan, diagram &amp; grafik</option>
      <option value=vision{" selected" if st.get("mata")=="vision" else ""}>Apple Vision di Mac &mdash; cepat, hanya teks ketikan</option>
      <option value=dua{" selected" if st.get("mata")=="dua" else ""}>Keduanya &mdash; paling teliti, paling lama</option>
    </select>
  </div>
  <div class=kcl id=ketMata style="margin-top:5px"></div>
  <div class=r id=barisMode>
    <select name=mode style="flex:1;min-width:220px">
      <option value=flash{" selected" if st.get("mode","flash")!="pro" and st.get("mode")!="panjang" else ""}>Gemini Flash &mdash; hemat, untuk sehari-hari</option>
      <option value=pro{" selected" if st.get("mode")=="pro" else ""}>Gemini Pro &mdash; lebih jarang menolak, lebih boros</option>
      <option value=panjang{" selected" if st.get("mode")=="panjang" else ""}>Extended thinking &mdash; naskah berat, paling lambat</option>
    </select>
  </div>
  <textarea name=instruksi rows=2 style="margin-top:11px"
    placeholder="Catatan (mis. 'fokus ke rumus saja', 'sertakan contoh soal UN')"></textarea>
  <div class="r kirim">
    <input name=judul placeholder="judul (opsional)" style="flex:1;min-width:150px">
    <button id=go type=submit>Buat Rangkuman</button>
  </div>
</div>
</form>
<div class=k id=panel style=display:none>
  <div class=lg id=log></div>
  <div id=antrean></div>
</div>
</div>
<input type=hidden name=titip value="{html.escape(titip, quote=True)}">
<script>const TITIP={json.dumps(titip)};{SKRIP_RANGKUM}</script>"""
