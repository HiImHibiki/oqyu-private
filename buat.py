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
# Satu lembar paling lama sekitar dua menit. Enam menit berarti benar-benar
# macet — dan yang macet harus DITANDAI GAGAL, bukan cuma melepas gilirannya.
# Sebelumnya gilirannya dilepas tapi tugasnya tetap tercatat 'sedang berjalan'
# selamanya, jadi halaman menampilkan bilah yang tidak pernah bergerak dan
# pemakainya menunggu sesuatu yang tidak akan datang.
BATAS_KERJA = 6 * 60


class Antrean:
    """Giliran tunggal yang bisa dilihat isinya."""

    def __init__(self):
        self._k = threading.Condition()
        self._tunggu = []                   # [{jid, nama, sejak}] menunggu giliran
        self._kerja = None                  # {jid, nama, sejak}
        self._batal = set()

    def _kedaluwarsa(self):
        """Bebaskan giliran yang sudah dipegang terlalu lama, dan tandai gagal."""
        k = self._kerja
        if k and time.time() - k['sejak'] > BATAS_KERJA:
            self._kerja = None
            menit = int(BATAS_KERJA // 60)
            _catat(k['jid'], None,
                   galat=f'Berhenti sendiri: tidak ada kemajuan selama {menit} menit. '
                         f'Coba lagi — kalau berulang, periksa jendela Chrome kendali.')
            HENTI.add(k['jid'])      # supaya utasnya ikut berhenti di titik aman
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

# Penomoran nama berkas yang aman dari balapan antar-thread (lihat nama_berkas).
_KUNCI_NAMA = threading.Lock()
_NOMOR_DIPESAN = set()

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

    # Nomor urut, AMAN-THREAD. Job dari HP jalan di thread masing-masing (bukan
    # lewat antrean), jadi dua job bersamaan bisa membaca nomor terakhir yang
    # sama lalu menulis nama identik — yang kedua menimpa yang pertama. Di bawah
    # kunci: ambil nomor tertinggi dari disk, lewati yang sudah ada SEBAGAI
    # BERKAS (varian soal/kunci/rangkuman) maupun yang baru DIPESAN thread lain,
    # lalu pesan nomor itu. Nomor -n itu sendiri jadi pembeda di belakang nama.
    with _KUNCI_NAMA:
        n = 1
        try:
            import re as _re
            pola = _re.compile(_re.escape(dasar) + r'-(\d+)')
            ada = [int(m.group(1)) for f in os.listdir(folder)
                   for m in [pola.match(f)] if m]
            if ada: n = max(ada) + 1
        except OSError:
            pass

        def _terpakai(k):
            if (dasar, k) in _NOMOR_DIPESAN:
                return True
            for ekor in ('.pdf', ' - Soal+Jawaban.pdf', ' - Rangkuman.pdf'):
                if os.path.exists(os.path.join(folder, f'{dasar}-{k}{ekor}')):
                    return True
            return False

        while _terpakai(n):
            n += 1
        _NOMOR_DIPESAN.add((dasar, n))

    nama = f'{dasar}-{n}'
    if kunci: nama += ' - Soal+Jawaban'
    return nama

def kode_mapel(nama):
    """Kode pendek untuk kop, mis. MATH. Memotong mentah memberi "MATEMATI"."""
    n = (nama or '').strip().lower()
    if not n: return 'MATH'                 # mapel kosong: bawaan Rico, dulu kebetulan lewat '' in 'matematika'
    if n in SINGKATAN: return SINGKATAN[n]
    for k, v in SINGKATAN.items():
        if k in n or n in k: return v
    kata = n.split()
    if len(kata) == 1:
        return kata[0][:4].upper()          # satu kata -> 4 huruf, bukan 1 inisial
    return ''.join(w[0] for w in kata[:4]).upper() or n[:4].upper()

# Pilihan kode depan kop (bagian "MATH" pada MATH/NRD/7/1609). Diturunkan
# dari SINGKATAN supaya daftar pilihan dan tebakan otomatis tidak berbeda.
KODE_PILIHAN = list(dict.fromkeys(SINGKATAN.values()))

def kode_kop(mapel, kode=''):
    """Kode depan kop: yang dipilih/diketik pemakai menang; kosong = tebak dari mapel."""
    k = (kode or '').strip().upper()
    return k or kode_mapel(mapel)

def kode_dari_medan(medan):
    """Baca kode kop dari isian form: kotak ketik dulu, lalu pilihan select."""
    k = (medan.get('kode_kop') or '').strip()
    if k: return k
    p = (medan.get('kode_kop_pilih') or '').strip()
    return '' if p == '__ketik' else p

def medan_kode_kop():
    """Select kode kop + kotak "ketik sendiri". Sengaja TIDAK diingat antar lembar,
    alasannya sama dengan mapel di setelan.py: kode yang tertinggal dari lembar
    sebelumnya baru ketahuan salah setelah PDF-nya dicetak."""
    opsi = ''.join(f'<option value="{k}">{k}</option>' for k in KODE_PILIHAN)
    js = ("var t=this.form.kode_kop;"
          "if(this.value=='__ketik'){t.hidden=false;t.value='';t.focus()}"
          "else{t.hidden=true;t.value=this.value}")
    return (f'<select name=kode_kop_pilih title="Kode depan judul di kop (mis. MATH pada MATH/NRD/7/1609). '
            f'Kosong = ditebak dari nama mapel" onchange="{js}">'
            f'<option value="">kode depan: otomatis (MATH)</option>{opsi}'
            f'<option value="__ketik">ketik sendiri&hellip;</option></select>'
            f'<input name=kode_kop placeholder="kode kop" size=8 maxlength=12 '
            f'style="text-transform:uppercase" hidden>')

def _segarkan_chrome():
    """Seusai tugas, Chrome kendali ditutup dan dinyalakan lagi di latar supaya
    tugas berikutnya langsung dapat Chrome bersih (permintaan Rico: "setiap
    selesai buat soal restart chrome agar siap dipakai berikutnya"). Kalau
    masih ada tugas mengantre, dilewati — tugas itu sendiri yang menyalakan."""
    try:
        if ANTREAN.lihat()['tunggu']: return
    except Exception:
        pass
    def kerja():
        try:
            import cdp
            cdp.nyalakan_ulang(); cdp.SEGAR = True
        except Exception:
            pass
    threading.Thread(target=kerja, daemon=True).start()

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
                   mesin='gemini', kode=''):
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
        lembar_pembahasan_dari_naskah(jid, hasil_teks, judul=judul, mapel=mapel,
                                      kelas=kelas, lembaga=lembaga, sekolah=sekolah,
                                      tanggal=tanggal, kode=kode, sumber='dari Gemini')
    except Dihentikan as e:
        _catat(jid, None, galat=str(e))
    except Exception as e:
        _catat(jid, None, galat=f'{type(e).__name__}: {e}')
    finally:
        HENTI.discard(jid)
        ANTREAN.keluar(jid)
        _segarkan_chrome()


def jalankan_rangkum(jid, gambar, instruksi, mapel, kelas, judul, topik='',
                     bahasa='Indonesia', lembaga='', sekolah='', tanggal='',
                     bagian='5', mata='gemini', mode='flash', mesin='gemini',
                     kode=''):
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

        lembar_rangkuman_dari_naskah(jid, hasil_teks, judul=judul, topik=topik,
                                     mapel=mapel, kelas=kelas, lembaga=lembaga,
                                     sekolah=sekolah, tanggal=tanggal, kode=kode,
                                     sumber='dari Gemini')
    except Dihentikan as e:
        _catat(jid, None, galat=str(e))
    except Exception as e:
        _catat(jid, None, galat=f'{type(e).__name__}: {e}')
    finally:
        HENTI.discard(jid)
        ANTREAN.keluar(jid)
        _segarkan_chrome()


def _cetak_lembar_baca(jid, html_lembar, nama):
    """Simpan halaman lembar-baca (pembahasan/rangkuman) lalu cetak ke PDF."""
    import otomasi, uuid
    _catat(jid, 'Menyusun lembar lalu mencetak PDF…', 90)
    kode = uuid.uuid4().hex[:10]
    HALAMAN_JAWAB[kode] = html_lembar
    if len(HALAMAN_JAWAB) > 40:
        for k in list(HALAMAN_JAWAB)[:-40]: HALAMAN_JAWAB.pop(k, None)
    tuju = os.path.join(KELUAR, f'{nama}.pdf')
    otomasi.cetak_halaman(f'http://127.0.0.1:{PORT}/lembar-jawab?k={kode}', tuju)
    subprocess.run(['open', tuju], capture_output=True)
    _catat(jid, f'Selesai — {os.path.basename(tuju)}', 100, selesai=True, pdf=tuju)
    return tuju


def _simpan_naskah_jadi(nama, teks):
    os.makedirs(NASKAH, exist_ok=True)
    open(os.path.join(NASKAH, f'{nama} — {time.strftime("%Y-%m-%d %H%M")}.txt'),
         'w', encoding='utf-8').write(teks)


def lembar_pembahasan_dari_naskah(jid, hasil_teks, judul='', mapel=None, kelas=None,
                                  lembaga='', sekolah='', tanggal='', kode='',
                                  sumber='dari Gemini'):
    """Naskah pembahasan jadi -> salinan naskah + PDF.

    Paruh kedua alur Kunci Jawaban, dipisah supaya jalur manual (naskah
    ditempel dari AI mana pun) menempuh jalan yang sama: nama berkas, salinan
    naskah, tata letak, dan pencetakan tidak boleh berbeda. Lembar pembahasan
    memakai tata letaknya sendiri — satu kolom, lapang, soal menyatu dengan
    pembahasannya. Bukan format naskah ujian.
    """
    import jawab as _jwb, lembar_jawab as _lj
    periksa_henti(jid)
    _catat(jid, f'Naskah pembahasan {sumber} diterima ({len(hasil_teks)} karakter)', 70)
    judul_lbr, butir = _jwb.urai(hasil_teks)
    if not butir:
        _simpan_naskah('GAGAL-pembahasan', hasil_teks)
        raise RuntimeError(f'Naskah {sumber} tidak bisa diurai jadi pembahasan. '
                           'Tiap soal harus diawali baris "SOAL 1", lalu "JAWAB:" '
                           'dan "BAHAS:". Naskah mentahnya disimpan di folder naskah/.')
    judul = (judul or '').strip() or judul_lbr or 'Pembahasan Soal'
    _catat(jid, f'{len(butir)} soal beserta pembahasannya', 80)

    kop = dict(lembaga=lembaga or 'Exact Course', mapel=mapel or '',
               kelas=(f'Kelas {kelas}' if kelas else ''))
    os.makedirs(KELUAR, exist_ok=True)
    kop_kode = dict(lembaga=lembaga or 'Exact Course', mapel=kode_kop(mapel, kode),
                    sekolah=sekolah, kelas=str(kelas or ''),
                    tanggal=tanggal or time.strftime('%d%m'))
    nama = nama_berkas(kop_kode, True, KELUAR)
    _simpan_naskah_jadi(nama, hasil_teks)
    return _cetak_lembar_baca(jid, _lj.buat(judul, butir, kop), nama)


def lembar_rangkuman_dari_naskah(jid, hasil_teks, judul='', topik='', mapel=None,
                                 kelas=None, lembaga='', sekolah='', tanggal='',
                                 kode='', sumber='dari Gemini'):
    """Naskah rangkuman jadi -> salinan naskah + PDF. Pasangan
    lembar_pembahasan_dari_naskah untuk tab Rangkuman."""
    import rangkum as _rk, lembar_rangkum as _lr
    periksa_henti(jid)
    _catat(jid, f'Naskah rangkuman {sumber} diterima ({len(hasil_teks)} karakter)', 70)
    judul_lbr, inti, bagian_isi = _rk.urai(hasil_teks)
    if not bagian_isi:
        _simpan_naskah('GAGAL-rangkuman', hasil_teks)
        raise RuntimeError(f'Naskah {sumber} tidak bisa diurai jadi rangkuman. '
                           'Tiap sub-bab harus diawali baris "BAGIAN: …" lalu '
                           '"POIN:". Naskah mentahnya disimpan di folder naskah/.')
    judul = (judul or '').strip() or judul_lbr or (topik or '').strip() or 'Rangkuman'
    _catat(jid, f'{len(bagian_isi)} bagian rangkuman', 80)

    kop = dict(lembaga=lembaga or 'Exact Course', mapel=mapel or '',
               kelas=(f'Kelas {kelas}' if kelas else ''))
    os.makedirs(KELUAR, exist_ok=True)
    kop_kode = dict(lembaga=lembaga or 'Exact Course', mapel=kode_kop(mapel, kode),
                    sekolah=sekolah, kelas=str(kelas or ''),
                    tanggal=tanggal or time.strftime('%d%m'))
    nama = nama_berkas(kop_kode, False, KELUAR) + ' - Rangkuman'
    _simpan_naskah_jadi(nama, hasil_teks)
    return _cetak_lembar_baca(jid, _lr.buat(judul, inti, bagian_isi, kop), nama)


def lembar_dari_naskah(jid, jawab, judul='', topik='', mapel=None, kelas=None,
                       jenjang='', lembaga='', sekolah='', tanggal='',
                       kunci=True, pembahasan=True, kolom='2', dua_berkas=False,
                       kerapatan='Normal', garis='1.5', sumber='dari Gemini',
                       kode='', set_ke=''):
    """Naskah jadi -> berkas naskah + bank soal + PDF.

    Paruh kedua alur /buat, dipisah supaya jalur manual (naskah ditempel
    sendiri dari AI mana pun) menempuh jalan yang PERSIS sama: nama berkas,
    salinan naskah, entri bank soal, dan perenderan tidak boleh berbeda —
    kalau berbeda, tombol "Ke Practice" dan tab Hasil tidak menemukan
    naskahnya.
    """
    import otomasi
    # Draf ganda dibuang SEBELUM apa pun memakainya: berkas naskah, bank
    # soal, dan perenderan harus melihat naskah yang sama. Kalau hanya
    # perenderannya yang dibersihkan, bank soal ikut menyimpan draf yang
    # cuma berisi satu soal.
    utuh = otomasi.buang_draf(jawab)
    if len(utuh) != len(jawab):
        _catat(jid, 'Naskah tertulis dua kali — draf pendeknya dibuang', 66)
        jawab = utuh
    periksa_henti(jid)
    _catat(jid, f'Naskah diterima ({len(jawab)} karakter)', 68)
    # Naskahnya ikut disimpan di catatan tugas supaya aplikasi lain (Exact
    # Practice) bisa mengambil soalnya yang sudah terurai lewat /api/soal,
    # tanpa harus menebak nama berkas di folder naskah.
    with KUNCI:
        TUGAS.setdefault(jid, {})['naskah'] = jawab

    # 4. serahkan ke perender asli
    if len(jawab.strip()) < 200 or jawab.count('\n') < 5:
        raise RuntimeError(f'Naskah {sumber} terlalu pendek untuk jadi lembar kerja')
    _catat(jid, 'Memuat ke Exact Worksheet Maker…', 76)

    # 5. simpan salinan mentah + ambil PDF
    judul = judul.strip() or (topik.strip() or f'Latihan {time.strftime("%d %b %H:%M")}')
    with KUNCI:
        TUGAS.setdefault(jid, {})['isian'] = {'mapel': mapel or '', 'kelas': str(kelas or ''), 'topik': (topik or '').strip() or judul}
    # "Set ke-" mengisi slot Soal-ke di kode kop (MATH/NRD/7/1609/3), jadi
    # yang tercetak di kertas sama dengan judul paketnya di Exact Practice.
    kop = dict(lembaga=lembaga or 'Exact Course', mapel=kode_kop(mapel, kode),
               nomor=str(set_ke or '').strip(),
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


def jalankan(jid, gambar, instruksi, jumlah, mapel, kelas, judul, api,
             topik='', jenjang='', n_set='', sulit='', bahasa='Indonesia',
             lembaga='', sekolah='', tanggal='', kunci=True, pembahasan=True,
             kolom='2', dua_berkas=False, kerapatan='Normal', garis='1.5',
             mata='gemini', mode='flash', mesin='gemini', kode=''):
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
        lembar_dari_naskah(jid, jawab, judul=judul, topik=topik, mapel=mapel,
                           kelas=kelas, jenjang=jenjang, lembaga=lembaga,
                           sekolah=sekolah, tanggal=tanggal, kunci=kunci,
                           pembahasan=pembahasan, kolom=kolom,
                           dua_berkas=dua_berkas, kerapatan=kerapatan,
                           garis=garis, sumber='dari Gemini', kode=kode)
    except Dihentikan as e:
        _catat(jid, None, galat=str(e))
    except Exception as e:
        _catat(jid, None, galat=f'{type(e).__name__}: {e}')
    finally:
        HENTI.discard(jid)
        ANTREAN.keluar(jid)
        _segarkan_chrome()

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
.layar{margin-top:10px;border:1px solid var(--tepi);border-radius:10px;overflow:hidden;
 background:var(--kartu)}
.layar img{display:block;width:100%;height:auto}
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
          + '" target=_top>Lihat &amp; Cetak</a>'
          + (t.terbit ? '<a class=tombolCetak href="' + t.terbit + '" target=_blank>Di Practice ✓</a>'
             : s.bisa_terbit ? '<button type=button class="mini terbit" data-jid="' + t.jid + '" data-pdf="' + encodeURIComponent(nama) + '">Ke Practice</button>' : '');
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
  const bt = el.querySelector('.terbit');
  if (bt) bt.onclick = async () => {
    const set = prompt('Lembar ini set ke berapa? (kosongkan kalau bukan seri)', '');
    if (set === null) return;
    bt.disabled = true; bt.textContent = 'mengirim…';
    try {
      const r = await fetch('/terbitkan', {method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({jid: t.jid, f: decodeURIComponent(bt.dataset.pdf || ''), set: set.trim()})});
      const j = await r.json();
      if (j.ok) { t.terbit = j.admin || j.url; barisTugas(t); }
      else { bt.textContent = 'gagal'; bt.title = j.galat || ''; alert(j.galat || 'Gagal menerbitkan'); bt.disabled = false; }
    } catch (e) { bt.textContent = 'gagal'; bt.disabled = false; }
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

LAYAR = """
// Chrome kendali berjalan tanpa jendela, jadi kalau sebuah lembar macet yang
// terlihat hanya bilah yang diam. Potret berkala ini menunjukkan penyebabnya
// langsung: Gemini sedang menulis, menolak, meminta login, atau ada dialog yang
// menghalangi. Hanya disegarkan saat panelnya dibuka — memotret itu menyalin
// seluruh layar, jadi jangan dijalankan diam-diam.
(() => {
  const tb = document.getElementById('btnLayar');
  const kotak = document.getElementById('layar');
  const img = document.getElementById('imgLayar');
  const kabar = document.getElementById('kabarLayar');
  if (!tb || !kotak || !img) return;
  let timer = null;

  const segarkan = () => {
    const u = '/layar?tab=gemini&t=' + Date.now();
    const baru = new Image();
    baru.onload = () => { img.src = u; kabar.textContent = ''; };
    baru.onerror = () => { kabar.textContent = 'layar belum bisa dibaca'; };
    baru.src = u;
  };

  tb.onclick = () => {
    const buka = kotak.hidden;
    kotak.hidden = !buka;
    tb.textContent = buka ? 'Sembunyikan layar Gemini' : 'Lihat layar Gemini';
    if (buka) { segarkan(); timer = setInterval(segarkan, 2500); }
    else { clearInterval(timer); timer = null; kabar.textContent = ''; }
  };
  const ba = document.getElementById('btnApp');
  if (ba) ba.onclick = async () => {
    if (!confirm('Mulai ulang aplikasi? SEMUA tugas yang sedang berjalan dan mengantre akan dihapus.')) return;
    ba.disabled = true; ba.textContent = 'Memulai ulang…';
    try { await fetch('/aplikasi/ulang', {method: 'POST'}); } catch (e) {}
    // Tunggu layanan hidup lagi (kickstart butuh beberapa detik), lalu muat ulang halaman.
    const mulai = Date.now();
    await new Promise(r => setTimeout(r, 3000));
    for (;;) {
      try {
        const r = await fetch('/status', {cache: 'no-store'});
        if (r.ok) break;
      } catch (e) {}
      if (Date.now() - mulai > 60000) { ba.textContent = 'Belum hidup — coba muat ulang halaman'; ba.disabled = false; return; }
      await new Promise(r => setTimeout(r, 1500));
    }
    location.reload();
  };
  const bc = document.getElementById('btnChrome');
  if (bc) bc.onclick = async () => {
    if (!confirm('Nyalakan ulang Chrome kendali? Tugas yang sedang berjalan akan gagal dan perlu diulang.')) return;
    bc.disabled = true; bc.textContent = 'Menyalakan ulang\u2026';
    try {
      const j = await (await fetch('/chrome/ulang')).json();
      bc.textContent = j.ok ? 'Chrome siap' : 'Gagal';
      if (j.galat) alert(j.galat); else if (j.pesan) console.log(j.pesan);
    } catch (e) { bc.textContent = 'Gagal'; }
    setTimeout(() => { bc.disabled = false; bc.textContent = 'Restart Chrome'; }, 4000);
  };
})();
"""

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

SKRIP_JAWAB = LAYAR + SKRIP.replace("fetch('/buat'", "fetch('/jawab'").replace(
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
    {medan_kode_kop()}
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
  <div class=r style="margin-top:10px">
    <button type=button id=btnLayar class=abu>Lihat layar Gemini</button>
    <button type=button id=btnChrome class=abu title="Tutup dan nyalakan lagi Chrome kendali — pakai kalau Gemini macet/menolak terus">Restart Chrome</button>
    <button type=button id=btnApp class=abu title="Hentikan semua tugas, kosongkan antrean, lalu mulai ulang aplikasi dari awal">Restart aplikasi</button>
    <span class=kcl id=kabarLayar style="margin:0"></span>
  </div>
  <div id=layar class=layar hidden><img id=imgLayar alt="layar Gemini"></div>
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
    {medan_kode_kop()}
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
  <div class=r style="margin-top:10px">
    <button type=button id=btnLayar class=abu>Lihat layar Gemini</button>
    <button type=button id=btnChrome class=abu title="Tutup dan nyalakan lagi Chrome kendali — pakai kalau Gemini macet/menolak terus">Restart Chrome</button>
    <button type=button id=btnApp class=abu title="Hentikan semua tugas, kosongkan antrean, lalu mulai ulang aplikasi dari awal">Restart aplikasi</button>
    <span class=kcl id=kabarLayar style="margin:0"></span>
  </div>
  <div id=layar class=layar hidden><img id=imgLayar alt="layar Gemini"></div>
</div>
</div>
<input type=hidden name=titip value="{html.escape(titip, quote=True)}">
<script>const TITIP={json.dumps(titip)};{SKRIP}{KET_MATA}{LAYAR}</script>"""


SKRIP_RANGKUM = LAYAR + SKRIP.replace("fetch('/buat'", "fetch('/rangkum'").replace(
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
    {medan_kode_kop()}
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
  <div class=r style="margin-top:10px">
    <button type=button id=btnLayar class=abu>Lihat layar Gemini</button>
    <button type=button id=btnChrome class=abu title="Tutup dan nyalakan lagi Chrome kendali — pakai kalau Gemini macet/menolak terus">Restart Chrome</button>
    <button type=button id=btnApp class=abu title="Hentikan semua tugas, kosongkan antrean, lalu mulai ulang aplikasi dari awal">Restart aplikasi</button>
    <span class=kcl id=kabarLayar style="margin:0"></span>
  </div>
  <div id=layar class=layar hidden><img id=imgLayar alt="layar Gemini"></div>
</div>
</div>
<input type=hidden name=titip value="{html.escape(titip, quote=True)}">
<script>const TITIP={json.dumps(titip)};{SKRIP_RANGKUM}</script>"""


# ---------------------------------------------------------------- naskah manual
# Tab "Naskah Manual": perintahnya disalin ke AI mana pun (Gemini, ChatGPT,
# Claude, atau AI lokal), jawabannya ditempel balik ke sini. Sesudah itu jalannya
# sama persis dengan lembar buatan otomatis — berkas naskah, bank soal, PDF, dan
# tombol ke Exact Practice. Jadi satu-satunya yang berbeda adalah dari mana
# naskahnya datang.

JENIS_MANUAL = ('soal', 'pembahasan', 'rangkuman')


def perintah_manual(mapel='', topik='', jenjang='', jumlah='', n_set='',
                    sulit='', bahasa='Indonesia', instruksi='', acuan='',
                    jenis='soal', kelas='', bagian='5'):
    """Perintah siap salin, dibangun dari format Exact Worksheet Maker sendiri.

    jenis 'soal'       : sumbernya prompt-builder.js milik mesin perender (lewat
                         wsmaker), bukan salinan yang diketik ulang — supaya
                         perintah yang disalin ke AI luar tidak pernah beda
                         format dengan yang dipakai jalur otomatis.
    jenis 'pembahasan' : perintah tab Kunci Jawaban (jawab.py); `acuan` berisi
                         naskah soal yang mau dibahas.
    jenis 'rangkuman'  : perintah tab Rangkuman (rangkum.py); `acuan` berisi
                         materinya, atau kosong kalau cukup topiknya.
    Ketiganya memakai pembangun perintah yang sama dengan jalur Gemini, jadi
    pengurainya pun sama.
    """
    import wsmaker
    kelas = str(kelas or '').strip()
    if jenis not in JENIS_MANUAL: jenis = 'soal'
    if jenis == 'soal' and (bahasa or '').strip().lower() in ('', 'ikut'):
        bahasa = 'Indonesia'
    if jenis == 'pembahasan':
        import jawab as _jwb
        return _jwb.bangun(acuan or '', bahasa or 'ikut', instruksi or '',
                           mapel or '', kelas, ada_lampiran=False, manual=True)
    if jenis == 'rangkuman':
        import rangkum as _rk
        try: n_bagian = max(2, min(12, int(str(bagian).strip() or 5)))
        except ValueError: n_bagian = 5
        return _rk.bangun(acuan or '', bahasa or 'ikut', instruksi or '',
                          mapel or '', kelas, bagian=n_bagian, topik=topik or '',
                          ada_lampiran=False)
    banyak = str(n_set or '').strip() not in ('', '0', '1')
    p = wsmaker.isi_blok(
        wsmaker.ringkas(wsmaker.perintah_baku(mapel or 'Matematika'),
                        konteks=' '.join([topik or '', mapel or '',
                                          instruksi or '', (acuan or '')[:600]]),
                        banyak_set=banyak),
        topik=topik, jenjang=jenjang, set=n_set, jumlah=jumlah, sulit=sulit,
        bahasa=bahasa or 'Indonesia',
        acuan='lihat lampiran di bawah' if (acuan or '').strip() else '')
    if (acuan or '').strip():
        p += '\n\nNASKAH ACUAN:\n' + acuan.strip()[:2500]
    if (instruksi or '').strip():
        p += '\n\nCATATAN GURU: ' + instruksi.strip()
    return p


def periksa_naskah(teks, jenis='soal'):
    """Hitung apa yang terbaca dari naskah tempelan, tanpa merender apa pun.

    Dipakai tombol "Periksa naskah": salah format baru ketahuan sesudah PDF
    jadi itu mahal — perenderan memakai Chrome dan ikut antrean. Pengurainya
    yang dipakai jalur Gemini juga, jadi hitungannya sama dengan yang akan
    dirender.
    """
    import naskah as _nsk, otomasi
    teks = (teks or '').strip()
    if not teks:
        return {'jumlah': 0, 'pesan': 'Naskahnya masih kosong.'}
    if jenis == 'pembahasan':
        import jawab as _jwb
        judul, butir = _jwb.urai(otomasi.normalkan_rumus(otomasi.buang_pagar(teks)))
        if not butir:
            return {'jumlah': 0, 'judul': judul,
                    'pesan': 'Tidak ada soal yang terbaca. Tiap soal harus diawali '
                             'baris "SOAL 1", lalu "JAWAB:" dan "BAHAS:".'}
        berjawab = sum(1 for b in butir if b.get('jawab'))
        berbahas = sum(1 for b in butir if b.get('bahas'))
        return {'jumlah': len(butir), 'judul': judul, 'kunci': berjawab,
                'pembahasan': berbahas,
                'pesan': f'{len(butir)} soal terbaca · {berjawab} berjawab · '
                         f'{berbahas} berpembahasan'}
    if jenis == 'rangkuman':
        import rangkum as _rk
        judul, inti, bagian = _rk.urai(otomasi.normalkan_rumus(otomasi.buang_pagar(teks)))
        if not bagian:
            return {'jumlah': 0, 'judul': judul,
                    'pesan': 'Tidak ada bagian yang terbaca. Tiap sub-bab harus '
                             'diawali baris "BAGIAN: …" lalu "POIN:".'}
        poin = sum(len(b['poin']) for b in bagian)
        rumus = sum(len(b['rumus']) for b in bagian)
        return {'jumlah': len(bagian), 'judul': judul, 'poin': poin, 'rumus': rumus,
                'pesan': f'{len(bagian)} bagian terbaca · {poin} poin · {rumus} rumus'
                         + ('' if inti else ' · INTI belum ada')}
    butir, meta = _nsk.urai(teks)
    if not butir:
        return {'jumlah': 0, 'judul': meta.get('judul') or '',
                'pesan': 'Tidak ada soal yang terbaca. Pastikan tiap soal '
                         'diawali penanda seperti PG1. / B1. / I1. / E1.'}
    jenis = {}
    for b in butir:
        jenis[b.get('jenis') or 'PG'] = jenis.get(b.get('jenis') or 'PG', 0) + 1
    berkunci = sum(1 for b in butir if b.get('kunci'))
    berbahas = sum(1 for b in butir if b.get('pembahasan'))
    return {'jumlah': len(butir), 'judul': meta.get('judul') or '',
            'jenis': jenis, 'kunci': berkunci, 'pembahasan': berbahas,
            'pesan': f'{len(butir)} soal terbaca ('
                     + ', '.join(f'{v} {k}' for k, v in sorted(jenis.items()))
                     + f') · {berkunci} berkunci · {berbahas} berpembahasan'}


def jalankan_manual(jid, naskah_teks, judul='', topik='', mapel=None, kelas=None,
                    jenjang='', lembaga='', sekolah='', tanggal='',
                    kunci=True, pembahasan=True, kolom='2', dua_berkas=False,
                    kerapatan='Normal', garis='1.5', ke_practice=False, kode='',
                    set_ke='', jenis='soal'):
    """Naskah tempelan -> PDF (dan, bila diminta, langsung ke Exact Practice).

    jenis 'soal' menempuh lembar_dari_naskah seperti tab Buat Soal;
    'pembahasan' dan 'rangkuman' menempuh paruh kedua tab Kunci Jawaban dan
    Rangkuman. Tetap lewat antrean walau tidak memakai AI: perenderannya
    memakai Chrome kendali yang sama dengan pekerjaan Gemini, dan dua render
    sekaligus saling menimpa isi tab Worksheet Maker.
    """
    import otomasi
    nama_antrean = {'pembahasan': 'Pembahasan manual',
                    'rangkuman': 'Rangkuman manual'}.get(jenis, 'Naskah manual')
    if not ANTREAN.masuk(jid, nama_antrean, lambda m: _catat(jid, m, 4)):
        return _catat(jid, None, galat='Dibatalkan sebelum mulai.')
    try:
        teks = (naskah_teks or '').strip()
        if not teks:
            raise RuntimeError('Naskahnya masih kosong — tempel dulu jawaban AI-nya.')
        _catat(jid, f'Naskah ditempel ({len(teks)} karakter)', 30)
        if jenis in ('pembahasan', 'rangkuman'):
            # Sama seperti jalur Claude: pagar ``` dan pembatas \( \) yang
            # sering ikut dari ChatGPT/Claude dirapikan dulu.
            teks = otomasi.normalkan_rumus(otomasi.buang_pagar(teks))
            if jenis == 'pembahasan':
                lembar_pembahasan_dari_naskah(
                    jid, teks, judul=judul, mapel=mapel, kelas=kelas,
                    lembaga=lembaga, sekolah=sekolah, tanggal=tanggal, kode=kode,
                    sumber='yang ditempel')
            else:
                lembar_rangkuman_dari_naskah(
                    jid, teks, judul=judul, topik=topik, mapel=mapel, kelas=kelas,
                    lembaga=lembaga, sekolah=sekolah, tanggal=tanggal, kode=kode,
                    sumber='yang ditempel')
            return
        lembar_dari_naskah(jid, teks, judul=judul, topik=topik, mapel=mapel,
                           kelas=kelas, jenjang=jenjang, lembaga=lembaga,
                           sekolah=sekolah, tanggal=tanggal, kunci=kunci,
                           pembahasan=pembahasan, kolom=kolom,
                           dua_berkas=dua_berkas, kerapatan=kerapatan,
                           garis=garis, sumber='yang ditempel', kode=kode,
                           set_ke=set_ke)
        if ke_practice:
            # Diterbitkan di server, bukan lewat tombol di halaman: kalau tab
            # ditutup sebelum PDF selesai, paket latihannya tetap terbit.
            _catat(jid, 'Menerbitkan ke Exact Practice…', 96)
            import terbit as _tb
            with KUNCI:
                t = dict(TUGAS.get(jid) or {})
            j = _tb.terbitkan(t.get('naskah') or teks,
                              nama_pdf=os.path.basename(t.get('pdf') or ''),
                              judul=judul, mapel=mapel or '',
                              kelas=str(kelas or ''), topik=topik or judul,
                              set_ke=set_ke)
            if j.get('ok'):
                with KUNCI:
                    TUGAS.setdefault(jid, {})['terbit'] = j.get('admin') or j.get('url')
                _catat(jid, 'Terbit di Exact Practice', 100, selesai=True)
            else:
                _catat(jid, 'PDF jadi, tapi Practice menolak: '
                            + (j.get('galat') or 'sebab tidak disebutkan'), 100,
                       selesai=True)
    except Dihentikan as e:
        _catat(jid, None, galat=str(e))
    except Exception as e:
        _catat(jid, None, galat=f'{type(e).__name__}: {e}')
    finally:
        HENTI.discard(jid)
        ANTREAN.keluar(jid)


SKRIP_MANUAL = r"""
const qs = s => document.querySelector(s);
const ambilMedan = () => {
  const f = new FormData(qs('#f')), o = {};
  ['jenis','mapel','topik','jenjang','jumlah','n_set','sulit','bahasa','instruksi',
   'acuan','kelas','bagian'].forEach(k => o[k] = (f.get(k) || '').toString());
  return o;
};

// Tiga jenis naskah, tiga format. Contohnya ditaruh di placeholder supaya guru
// yang mengetik sendiri (tanpa AI) tahu penandanya — pengurainya sama persis
// dengan yang dipakai jalur Gemini di tab Buat Soal / Kunci Jawaban / Rangkuman.
const JENIS = {
  soal: {
    judul: 'Naskah soal',
    ket: 'jadi lembar kerja, masuk bank soal, bisa terbit ke Exact Practice',
    acuan: 'Soal acuan / materi yang mau ditiru gayanya (opsional)',
    contoh: `Contoh format — kode bagian di dalam kurung SESUDAH titik dua, kunci pakai tanda hubung:

Latihan Trigonometri Dasar

Bagian Pilihan Ganda: (PG)
PG1. Nilai $\\sin 30^\\circ$ adalah ... [2]
A. $\\frac{1}{2}$
B. $\\frac{1}{3}$
C. $\\frac{\\sqrt{3}}{2}$
D. $1$

Bagian Uraian: (E)
E1. Buktikan $\\sin^2 x + \\cos^2 x = 1$. [5]

Kunci Jawaban
PG1-A, E1-pakai teorema Pythagoras pada lingkaran satuan

Pembahasan
PG1-Sudut istimewa: $\\sin 30^\\circ=\\frac{1}{2}$.E1-Titik pada lingkaran satuan berjarak 1 dari pusat.`},
  pembahasan: {
    judul: 'Naskah kunci & pembahasan',
    ket: 'jadi lembar baca satu kolom: tiap soal langsung diikuti kunci dan pembahasannya',
    acuan: 'Naskah soal yang mau dibahas — tempel di sini supaya ikut di perintah',
    contoh: `Contoh format — tiap soal diawali baris SOAL n, lalu JAWAB: dan BAHAS:

JUDUL: Pembahasan GLB

SOAL 1
Sebuah mobil menempuh 120 m dalam 6 s. Berapa kecepatannya?
JAWAB: 20 m/s
BAHAS:
Diketahui: $s = 120$ m, $t = 6$ s
$v = \\frac{s}{t}$
$v = \\frac{120}{6} = 20$ m/s
Jadi kecepatan mobil 20 m/s.

SOAL 2
...`},
  rangkuman: {
    judul: 'Naskah rangkuman',
    ket: 'jadi lembar rangkuman: inti, poin per sub-bab, rumus, contoh, dan hal yang mudah keliru',
    acuan: 'Materi yang mau dirangkum (opsional — boleh cukup topiknya di atas)',
    contoh: `Contoh format — tiap sub-bab diawali BAGIAN:, isinya POIN / RUMUS / CONTOH / INGAT

JUDUL: Gerak Lurus Beraturan
INTI: GLB adalah gerak dengan kecepatan tetap, sehingga jarak sebanding dengan waktu.

BAGIAN: Pengertian
POIN:
- Kecepatan tetap, percepatan nol
- Grafik $v$-$t$ berupa garis mendatar
RUMUS:
- $s = v \\cdot t$ = jarak sama dengan kecepatan kali waktu
CONTOH: $v = 4$ m/s selama $5$ s, maka $s = 4 \\cdot 5 = 20$ m
INGAT: Satuan harus sama dulu — km/jam diubah ke m/s (bagi 3,6).

BAGIAN: ...`},
};
const pilihJenis = document.getElementById('jenis');
function terapkanJenis() {
  const j = JENIS[pilihJenis.value] ? pilihJenis.value : 'soal';
  document.querySelectorAll('[data-jenis]').forEach(el => {
    el.hidden = !el.dataset.jenis.split(' ').includes(j);
  });
  const ikut = qs('#bahasa option[value=ikut]');
  ikut.disabled = j === 'soal';
  if (ikut.disabled && qs('#bahasa').value === 'ikut') qs('#bahasa').value = 'Indonesia';
  document.getElementById('judulNaskah').textContent = JENIS[j].judul;
  document.getElementById('ketJenis').textContent = JENIS[j].ket;
  qs('#acuan').placeholder = JENIS[j].acuan;
  qs('#naskah').placeholder = JENIS[j].contoh;
  hasilPeriksa.textContent = '';
  kotakPerintah.value = ''; perintahTerakhir = ''; kabarP.textContent = '';
  try { localStorage.setItem('naskahManual.jenis', j); } catch (e) {}
}

// Komposisi siap pakai, sama seperti di tab Buat Soal.
const preset = document.getElementById('preset');
if (preset) preset.onchange = () => {
  if (!preset.value) return;
  qs('[name=jumlah]').value = preset.value;
  preset.selectedIndex = 0;
};

const kotakPerintah = document.getElementById('perintah');
const kabarP = document.getElementById('kabarPerintah');
let perintahTerakhir = '';
const hasilPeriksa = document.getElementById('hasilPeriksa');
pilihJenis.onchange = terapkanJenis;
try {
  const j = localStorage.getItem('naskahManual.jenis');
  if (j && JENIS[j]) pilihJenis.value = j;
} catch (e) {}
terapkanJenis();

async function susunPerintah() {
  kabarP.textContent = 'menyusun…';
  const r = await fetch('/api/perintah?' + new URLSearchParams(ambilMedan()));
  if (!r.ok) { kabarP.textContent = 'gagal menyusun perintah'; return ''; }
  const j = await r.json();
  if (j.galat) { kabarP.textContent = j.galat; return ''; }
  perintahTerakhir = j.perintah || '';
  kotakPerintah.value = perintahTerakhir;
  kabarP.textContent = perintahTerakhir.length.toLocaleString('id') + ' karakter';
  return perintahTerakhir;
}

document.getElementById('btnLihat').onclick = async () => {
  const bungkus = document.getElementById('bungkusPerintah');
  if (bungkus.hidden) {
    bungkus.hidden = false;
    document.getElementById('btnLihat').textContent = 'Sembunyikan perintah';
    if (!kotakPerintah.value.trim()) await susunPerintah();
  } else {
    bungkus.hidden = true;
    document.getElementById('btnLihat').textContent = 'Lihat perintah';
  }
};

document.getElementById('btnSusun').onclick = () => susunPerintah();

document.getElementById('btnSalin').onclick = async () => {
  const b = document.getElementById('btnSalin');
  // Selalu disusun ulang lebih dulu: kalau medannya baru diubah, yang tersalin
  // harus yang sekarang — bukan perintah yang tampil dari klik sebelumnya.
  const teks = (kotakPerintah.value.trim() && kotakPerintah.value === perintahTerakhir)
             ? kotakPerintah.value : await susunPerintah();
  if (!teks) return;
  try {
    await navigator.clipboard.writeText(teks);
    b.textContent = 'Tersalin ✓';
  } catch (e) {
    // Peramban tanpa izin papan klip (halaman dibuka lewat http dari tablet):
    // perintahnya ditampilkan supaya bisa disalin tangan.
    document.getElementById('bungkusPerintah').hidden = false;
    kotakPerintah.select();
    b.textContent = 'Salin sendiri ↑';
  }
  setTimeout(() => { b.textContent = 'Salin perintah'; }, 2500);
};

// Periksa naskah sebelum dirender: perenderan ikut antrean dan memakai Chrome,
// jadi salah format yang baru ketahuan sesudah PDF jadi itu mahal.
async function periksa(diam) {
  const teks = qs('[name=naskah]').value;
  if (!teks.trim()) { hasilPeriksa.textContent = ''; return null; }
  if (!diam) hasilPeriksa.textContent = 'memeriksa…';
  try {
    const r = await fetch('/api/periksa?jenis=' + encodeURIComponent(pilihJenis.value), {method: 'POST',
      headers: {'Content-Type': 'text/plain; charset=utf-8'}, body: teks});
    const j = await r.json();
    hasilPeriksa.className = j.jumlah ? 'kcl' : 'err';
    hasilPeriksa.textContent = j.pesan || '';
    return j;
  } catch (e) { hasilPeriksa.textContent = ''; return null; }
}
document.getElementById('btnPeriksa').onclick = () => periksa(false);
let jedaPeriksa = null;
qs('[name=naskah]').addEventListener('input', () => {
  clearTimeout(jedaPeriksa);
  jedaPeriksa = setTimeout(() => periksa(true), 900);
});

document.getElementById('btnTempel').onclick = async () => {
  const k = qs('[name=naskah]');
  try {
    const t = await navigator.clipboard.readText();
    if (t) { k.value = t; periksa(true); }
  } catch (e) { k.focus(); hasilPeriksa.textContent = 'Peramban tidak mengizinkan baca papan klip — tempel manual dengan ⌘V.'; }
};

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
  let kanan = '';
  if (s.galat) kanan = '<span class=err>' + s.galat + '</span>';
  else if (s.pdf) {
    const nama = s.pdf.split('/').pop();
    kanan = '<a class=tombolCetak href="/hasil?f=' + encodeURIComponent(nama)
          + '" target=_top>Lihat &amp; Cetak</a>'
          + ((t.terbit || s.terbit)
             ? '<a class=tombolCetak href="' + (t.terbit || s.terbit) + '" target=_blank>Di Practice ✓</a>'
             : s.bisa_terbit
               ? '<button type=button class="mini terbit" data-jid="' + t.jid + '" data-pdf="' + encodeURIComponent(nama) + '">Ke Practice</button>'
               : '');
  } else if (s.antre && s.antre.nomor) {
    kanan = '<span class=kcl>antrean ke-' + s.antre.nomor
          + (s.antre.kerja ? ' · ' + s.antre.kerja.nama + ' ' + Math.floor(s.antre.kerja.detik/60) + ' mnt' : '')
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
  const bt = el.querySelector('.terbit');
  if (bt) bt.onclick = async () => {
    const set = prompt('Lembar ini set ke berapa? (kosongkan kalau bukan seri)', '');
    if (set === null) return;
    bt.disabled = true; bt.textContent = 'mengirim…';
    try {
      const r = await fetch('/terbitkan', {method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({jid: t.jid, f: decodeURIComponent(bt.dataset.pdf || ''), set: set.trim()})});
      const j = await r.json();
      if (j.ok) { t.terbit = j.admin || j.url; barisTugas(t); }
      else { bt.textContent = 'gagal'; alert(j.galat || 'Gagal menerbitkan'); bt.disabled = false; }
    } catch (e) { bt.textContent = 'gagal'; bt.disabled = false; }
  };
}

function pantau(t) {
  let gagal = 0;
  const timer = setInterval(async () => {
    try { t.s = await (await fetch('/status?jid=' + t.jid)).json(); gagal = 0; }
    catch (err) {
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
  const naskah = qs('[name=naskah]').value.trim();
  panel.style.display = 'block';
  if (!naskah) {
    log.innerHTML = '<div class=err>Belum ada naskah. Salin perintah di langkah 1, '
      + 'jalankan di AI mana pun, lalu tempel jawabannya di langkah 2.</div>';
    return;
  }
  const cek = await periksa(true);
  if (cek && !cek.jumlah &&
      !confirm((pilihJenis.value === 'rangkuman' ? 'Tidak ada bagian' : 'Tidak ada soal')
               + ' yang terbaca dari naskah ini. Tetap coba render?')) return;
  log.innerHTML = '';
  const go = document.getElementById('go');
  const fd = new FormData(e.target);
  const judul = (fd.get('judul') || '').toString().trim()
             || (fd.get('topik') || '').toString().trim()
             || (cek && cek.judul) || (JENIS[pilihJenis.value] || JENIS.soal).judul;
  go.disabled = true;
  let jid;
  try {
    const r = await fetch('/manual', {method: 'POST', body: new URLSearchParams(fd)});
    jid = (await r.json()).jid;
  } catch (err) {
    log.innerHTML = '<div class=err>Tidak bisa menghubungi server.</div>';
    return;
  } finally { go.disabled = false; }
  if (!jid) { log.innerHTML = '<div class=err>Server tidak memulai tugas. Coba lagi.</div>'; return; }
  const t = {jid: jid, judul: judul, s: {maju: 3, langkah: ['Mulai…']}};
  TUGAS.push(t); barisTugas(t); pantau(t);
};
"""


def halaman_manual(setel=None):
    import setelan as _s
    st = setel or _s.muat()
    n = lambda k: html.escape(st.get(k, '') or '')
    tgl_ini = time.strftime('%d%m')
    c = lambda k: ' checked' if st.get(k) else ''
    return f"""<!doctype html><meta charset=utf-8><title>Naskah Manual</title>
<meta name=viewport content="width=device-width,initial-scale=1"><style>{GAYA}
h2{{font-size:14px;margin:0 0 10px;display:flex;align-items:center;gap:8px}}
h2 b{{display:inline-flex;width:22px;height:22px;border-radius:50%;background:var(--aksen);
color:#fff;align-items:center;justify-content:center;font-size:12px;flex:none}}
</style>
<div class=b>
<div class=kopApp><img src="/statik/logo.png" alt=""><div>
  <h1>Naskah Manual</h1>
  <div class=s style="margin:0">Exact Course &middot; Worksheet Maker</div></div></div>
<div class=s>Untuk naskah yang Anda tulis sendiri, atau yang dikarang AI mana pun
(Gemini, ChatGPT, Claude, AI lokal): soal latihan, kunci &amp; pembahasan, atau
rangkuman materi. Salin perintahnya, tempel jawabannya di sini, lalu lembarnya
dicetak seperti lembar otomatis.</div>

<form id=f>
<div class=k>
  <div class=r style="margin-top:0">
    <select name=jenis id=jenis title="jenis naskah" style="flex:1;min-width:240px">
      <option value=soal>Soal latihan &mdash; lembar kerja &amp; Exact Practice</option>
      <option value=pembahasan>Kunci jawaban &amp; pembahasan &mdash; lembar baca</option>
      <option value=rangkuman>Rangkuman / catatan materi &mdash; lembar baca</option>
    </select>
    <span class=kcl id=ketJenis style="margin:0"></span>
  </div>
</div>

<div class=k>
  <h2><b>1</b> Perintah untuk AI &mdash; opsional, lewati kalau menulis naskahnya sendiri</h2>
  <div class=r style="margin-top:0">
    <input name=mapel placeholder="mapel" style="flex:1;min-width:150px">
    <input name=topik placeholder="topik" style="flex:2;min-width:190px" data-jenis="soal rangkuman">
    <input name=bagian placeholder="bagian" value="5" size=6 title="berapa sub-bab" data-jenis="rangkuman">
  </div>
  <div class=r data-jenis="soal">
    <input name=jenjang placeholder="kelas/jenjang" size=12>
    <select id=preset title="komposisi siap pakai" style="min-width:150px">
      <option value="">komposisi&hellip;</option>
      <option>10 PG + 5 Esai</option>
      <option>10 Esai</option>
      <option>20 PG</option>
      <option>30 PG</option>
      <option>5 PG + 2 B + 2 I + 1 E</option>
      <option>15 PG + 5 Isian</option>
    </select>
    <input name=jumlah placeholder="atau tulis sendiri" value="{n('jumlah')}" style="flex:1;min-width:150px">
    <input name=n_set placeholder="set" value="{n('n_set') or '1'}" size=4 title="jumlah set">
    <input name=sulit placeholder="kesulitan" value="{n('sulit') or 'sedang'}" style="min-width:170px">
  </div>
  <div class=r>
    <select name=bahasa id=bahasa title="bahasa naskah">
      <option value=Indonesia{" selected" if st.get("bahasa")!="Inggris" else ""}>Indonesia</option>
      <option value=Inggris{" selected" if st.get("bahasa")=="Inggris" else ""}>Inggris</option>
      <option value=ikut>ikuti bahasa soal / materi</option>
    </select>
  </div>
  <textarea name=instruksi rows=2 style="margin-top:11px"
    placeholder="Catatan tambahan untuk AI (opsional)">{n('instruksi')}</textarea>
  <textarea name=acuan id=acuan rows=3 style="margin-top:9px"
    placeholder="Soal acuan / materi yang mau ditiru gayanya (opsional)"></textarea>
  <div class=r>
    <button type=button id=btnSalin>Salin perintah</button>
    <button type=button id=btnLihat class=abu>Lihat perintah</button>
    <button type=button id=btnSusun class=abu title="Susun ulang setelah medan di atas diubah">Susun ulang</button>
    <span class=kcl id=kabarPerintah style="margin:0"></span>
  </div>
  <div class=r style="margin-top:6px">
    <a class=kcl href="https://gemini.google.com/app" target=_blank rel=noopener>Gemini &#8599;</a>
    <a class=kcl href="https://chatgpt.com/" target=_blank rel=noopener>ChatGPT &#8599;</a>
    <a class=kcl href="https://claude.ai/new" target=_blank rel=noopener>Claude &#8599;</a>
  </div>
  <div id=bungkusPerintah hidden style="margin-top:9px">
    <textarea id=perintah rows=12 readonly></textarea>
  </div>
</div>

<div class=k>
  <h2><b>2</b> <span id=judulNaskah>Naskah soal</span> &mdash; tempel jawaban AI, atau ketik sendiri</h2>
  <textarea name=naskah id=naskah rows=16></textarea>
  <div class=r>
    <button type=button id=btnPeriksa class=abu>Periksa naskah</button>
    <button type=button id=btnTempel class=abu>Tempel dari papan klip</button>
    <span class=kcl id=hasilPeriksa style="margin:0"></span>
  </div>
</div>

<div class=k>
  <h2><b>3</b> Kop &amp; bentuk lembar</h2>
  <div class=r style="margin-top:0">
    {medan_kode_kop()}
    <input name=lembaga placeholder="nama lembaga" value="{n('lembaga') or 'Exact Course'}" style="flex:1;min-width:150px">
    <input name=sekolah placeholder="kode sekolah" value="{n('sekolah')}" size=10>
    <input name=kelas placeholder="kelas" size=6>
    <input name=tanggal placeholder="tgl" value="{tgl_ini}" size=7>
  </div>
  <div class=r data-jenis="soal">
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
  <div class=r data-jenis="soal">
    <label class=kcl><input type=checkbox name=ke_practice> sekalian terbitkan ke Exact Practice</label>
    <input name=set placeholder="set ke-" size=6 inputmode=numeric pattern="[0-9]*"
           title="Nomor set lembar ini (mis. 3). Tercetak di kode kop sebagai MATH/NRD/7/1609/3 dan jadi «— Set 3» pada judul paket di Exact Practice. Kosongkan kalau bukan seri.">
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
<script>{SKRIP_MANUAL}</script>"""
