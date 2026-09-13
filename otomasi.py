#!/usr/bin/env python3
"""Otomasi Gemini + Exact Worksheet Maker lewat DevTools Protocol.

Menggantikan jalur AppleScript: Chrome 152 tidak bisa disuruh menyalakan
"Allow JavaScript from Apple Events" secara program, jadi jalur itu buntu.
Di sini Chrome berjalan dengan profil khusus dan port kendali sendiri.
"""
import json, os, time, re
import cdp, wsmaker

URL_GEMINI = 'https://gemini.google.com/app'

class BelumMasuk(Exception): pass

def _tampilkan(s):
    """Bawa tab ke depan dan tunggu sampai benar-benar terlihat.

    Peristiwa tetikus dari DevTools TIDAK sampai ke tab yang berstatus hidden —
    tab itu tetap bisa dibaca dan diisi teksnya, tapi klik tombol kirim diam
    tanpa galat. Inilah sebab kegagalan "Perintah tidak terkirim" yang muncul
    acak: berhasil hanya ketika tabnya kebetulan sedang di depan.
    """
    s.ukuran()                    # viewport layak, bukan 800x600 bawaan headless
    try:
        s.perintah('Page.bringToFront')
    except Exception:
        pass
    for _ in range(10):
        if s.evaluasi("document.visibilityState") == 'visible':
            break
        time.sleep(0.4)
    return s

def _sesi(url, potongan):
    """Cari tab yang sudah ada; kalau belum ada, BUKA TAB BARU.

    Versi pertama mengambil tab pertama yang ada lalu mengarahkannya ulang —
    akibatnya tab Gemini yang sudah login ikut terbajak saat giliran Worksheet
    Maker, dan larian berikutnya gagal karena Gemini-nya sudah hilang.
    """
    cdp.nyalakan()
    tab = cdp.cari_tab(potongan)
    if tab:
        return _tampilkan(cdp.Sesi(tab))
    tab = cdp.buka_tab(url, paksa_baru=True)
    for _ in range(20):
        time.sleep(0.8)
        t = cdp.cari_tab(potongan)
        if t: return _tampilkan(cdp.Sesi(t))
    return _tampilkan(cdp.Sesi(tab))

JS_SUDAH_MASUK = r"""
(function(){
  if(document.querySelector('div.ql-editor[contenteditable="true"], [role="textbox"][contenteditable="true"]')) return 'MASUK';
  const t = (document.body.innerText || '').slice(0, 600);
  if(/sign in|masuk|login/i.test(t)) return 'BELUM';
  return 'MEMUAT';
})()
"""

# Gemini MERENDER LaTeX jadi matematika di layar. Membaca innerText berarti
# membaca hasil renderannya: "$a_1$" sudah berubah jadi "a 1", dan seluruh
# tanda $ hilang — naskahnya jadi tidak berguna untuk Worksheet Maker.
# Karena itu jawaban diminta dibungkus blok kode, yang TIDAK dirender, lalu
# dibaca dari elemen <pre>/<code>-nya.
BUNGKUS = ("\n\nSANGAT PENTING: tulis SELURUH jawabanmu di dalam SATU blok kode "
           "(diawali tiga tanda backtick dan diakhiri tiga tanda backtick), tanpa "
           "teks apa pun di luar blok itu. Ini wajib supaya tanda $ pada rumus "
           "tidak hilang saat disalin.")

JS_BACA = r"""
(function(){
  const b = document.querySelectorAll('.model-response-text, message-content, model-response');
  if(!b.length) return 'KOSONG';
  const akhir = b[b.length-1];
  const kode = akhir.querySelector('pre code, code-block pre, pre');
  const t = kode ? (kode.innerText || '') : (akhir.innerText || '');
  const sibuk = !!document.querySelector('button[aria-label*="Stop" i], [data-test-id="stop-button"]');
  return (sibuk ? 'SIBUK:' : 'SELESAI:') + t;
})()
"""

PAGAR = re.compile(r'^\s*```[a-zA-Z]*\s*\n?|\n?\s*```\s*$')

def buang_pagar(teks):
    """Buang pagar blok kode. Jawaban diminta dibungkus ``` agar LaTeX-nya utuh,
    tapi pagarnya sendiri jangan ikut masuk naskah."""
    t = (teks or '').strip()
    t = re.sub(r'^```[a-zA-Z]*\s*\n', '', t)
    t = re.sub(r'\n```\s*$', '', t)
    return t.replace('```text', '').replace('```', '').strip()

def normalkan_rumus(teks):
    """Samakan pembatas rumus ke $...$ seperti yang diharapkan Worksheet Maker.

    Walau diminta memakai $, Gemini sering mengembalikan \\( ... \\) dan
    \\[ ... \\]. Isinya benar, hanya pembatasnya berbeda — jadi ditukar di sini
    ketimbang beradu perintah dengan modelnya.
    """
    teks = re.sub(r'\\\[(.+?)\\\]', lambda m: '$' + m.group(1).strip() + '$', teks, flags=re.S)
    teks = re.sub(r'\\\((.+?)\\\)', lambda m: '$' + m.group(1).strip() + '$', teks, flags=re.S)
    return teks

def _periksa(teks):
    """Tolak penolakan dan jawaban kerdil — jangan sampai jadi PDF kosong."""
    t = (teks or '').strip()
    if PENOLAKAN.search(t[:400]):
        raise Ditolak('Gemini menolak permintaan: ' + t[:120])
    if len(t) < 200:
        raise RuntimeError(f'Jawaban Gemini terlalu pendek ({len(t)} karakter): ' + t[:120])
    return normalkan_rumus(buang_pagar(t))

def _tunggu_selesai_menulis(s, batas=180):
    """Tunggu sampai Gemini berhenti menulis jawaban sebelumnya.

    Selagi menulis, tombol kirim DIGANTI tombol "Stop response" — jadi mencari
    tombol kirim saat itu selalu gagal dengan gejala "tombol tidak aktif",
    padahal sebenarnya cuma perlu menunggu.
    """
    t0 = time.time()
    while time.time() - t0 < batas:
        sibuk = s.evaluasi("""!!document.querySelector(
            'button[aria-label*="Stop" i], [data-test-id="stop-button"]')""")
        if not sibuk:
            return True
        time.sleep(2)
    return False

def _kirim(s, perintah):
    """Isi kotak lalu tekan tombol kirim.

    Dua hal yang WAJIB, dan dua-duanya sempat gagal:
      1. Teks dimasukkan lewat Input.insertText (CDP), bukan innerHTML —
         Gemini mengabaikan perubahan DOM dari JavaScript.
      2. Tombol kirim diklik lewat Input.dispatchMouseEvent di koordinatnya,
         bukan .click() — peristiwa buatan JavaScript diabaikan juga.
    """
    _tunggu_selesai_menulis(s)
    s.ganti_isi_editor('div.ql-editor', perintah)
    time.sleep(1.4)
    for _ in range(12):
        pos = s.evaluasi("""(function(){
          const b=[...document.querySelectorAll('button')]
            .find(x=>/^send/i.test(x.getAttribute('aria-label')||''));
          if(!b||b.disabled) return null;
          const r=b.getBoundingClientRect();
          return [r.left+r.width/2, r.top+r.height/2];})()""")
        if pos: break
        time.sleep(0.5)
    else:
        raise RuntimeError('Tombol kirim Gemini tidak aktif. Kemungkinan Gemini '
                           'masih menulis jawaban sebelumnya, atau teks tidak masuk.')
    s.klik_di(pos[0], pos[1])
    for _ in range(20):
        time.sleep(1)
        if (s.evaluasi("((document.querySelector('div.ql-editor')||{}).innerText||'').trim().length") or 0) <= 1:
            return True
    raise RuntimeError('Perintah tidak terkirim — kotak masih terisi')

PENOLAKAN = re.compile(
    r'tidak bisa membantu|tidak dapat membantu|hanya model bahasa|'
    r"i can't help|i'm unable|as a language model|maaf, saya", re.I)

# Mode Gemini yang dipakai. Bawaan akunnya "Flash", yang paling sering membalas
# "saya hanya model bahasa dan tidak mampu memahami" untuk permintaan panjang
# berformat kaku seperti naskah soal. Mode penalaran menolak jauh lebih jarang
# dan hitungannya lebih bisa dipercaya — itu yang dibutuhkan lembar bimbel.
# Nilainya pola, bukan potongan teks. Mencocokkan potongan "Flash" saja membuat
# "3.5 Flash-Lite" terpilih lebih dulu karena ia lebih atas di daftar — dan
# Flash-Lite jawabannya paling dangkal dari semuanya.
MODE = {
    'flash': r'\bflash\b(?!-)',   # "3.8 Flash", bukan "3.5 Flash-Lite"
    'pro': r'\bpro\b',            # 3.1 Pro — penalaran, untuk naskah berat
    'panjang': r'extended',        # Extended thinking — paling lambat
}
# Nama yang muncul di tombol setelah terpilih, untuk memeriksa mode yang aktif.
NAMA_MODE = {'flash': 'Flash', 'pro': 'Pro', 'panjang': 'Extended'}


def pilih_mode(s, mau='pro'):
    """Pilih mode Gemini sebelum bertanya. False bila pemilihnya tidak ada."""
    mau = mau if mau in MODE else 'flash'
    pola, nama = MODE[mau], NAMA_MODE[mau]
    try:
        kini = s.evaluasi(
            "((document.querySelector('button[aria-label^=\"Open mode picker\"]')"
            " || {}).getAttribute ? document.querySelector("
            "'button[aria-label^=\"Open mode picker\"]').getAttribute('aria-label') : '')")
    except Exception:
        return False
    if not kini:
        return False
    import re as _re
    if _re.search(pola, kini, _re.I):
        return True                       # sudah pada mode yang diminta
    if not s.klik_elemen('button[aria-label^="Open mode picker"]'):
        return False
    time.sleep(1.5)
    ok = s.evaluasi("""(function(pola){
      const p = new RegExp(pola, 'i');
      const a = [...document.querySelectorAll('[role=menuitem],[role=option],button')];
      const t = a.find(e => p.test((e.innerText||'').trim()));
      if (!t) return false;
      const r = t.getBoundingClientRect();
      window.__exactTitik = [r.left + r.width/2, r.top + r.height/2];
      return true;
    })(%s)""" % json.dumps(pola))
    if not ok:
        s.tombol('Escape', 27)
        return False
    titik = s.evaluasi("window.__exactTitik")
    s.klik_di(titik[0], titik[1])
    time.sleep(2)
    return True


def percakapan_baru(s):
    """Mulai obrolan baru sebelum tiap permintaan.

    Memakai ulang satu utas membuat konteksnya menumpuk; utas yang sudah panjang
    dan tercampur pesan lain membuat Gemini menolak permintaan yang sebenarnya
    wajar. Tiap lembar kerja berhak atas utas bersih.
    """
    try:
        if s.klik_elemen('[data-test-id="new-chat-button"], button[aria-label*="New chat" i]'):
            time.sleep(2.5)
            return True
    except Exception:
        pass
    s.buka(URL_GEMINI)
    time.sleep(3)
    return True

JS_UNGGAHAN_SIAP = r"""
(function(){
  const pra = document.querySelectorAll('uploader-file-preview').length;
  if (!pra) return 'KOSONG';
  const putar = [...document.querySelectorAll('mat-spinner,[class*=spinner],[class*=progress]')]
                  .filter(e => e.offsetParent).length;
  return putar ? 'PROSES' : 'SIAP:' + pra;
})()
"""


def _lampirkan(s, berkas, batas=120):
    """Unggah foto ke Gemini supaya matanya sendiri yang membaca.

    Dipakai untuk tulisan tangan dan gambar/diagram, yang tidak bisa diwakili
    teks hasil OCR. input[type=file] baru dibuat setelah menu "Upload & tools"
    dibuka, dan menu itu kadang belum terpasang saat diklik pertama kali —
    karena itu pembukaannya diulang beberapa kali sebelum menyerah.
    """
    berkas = [str(x) for x in (berkas or [])]
    if not berkas: return 0
    _tampilkan(s)                               # tab tersembunyi tidak menerima klik
    for _ in range(20):                         # tombolnya muncul belakangan setelah utas baru
        if s.evaluasi("!!document.querySelector('button[aria-label=\"Upload & tools\"]')"):
            break
        time.sleep(0.5)
    for percobaan in range(4):
        s.klik_elemen('button[aria-label="Upload & tools"]')
        time.sleep(1.5 + percobaan)
        try:
            if s.unggah_ke_input('input[type=file]', berkas): break
        except Exception:
            pass
        s.tombol('Escape', 27); time.sleep(1)
    else:
        raise RuntimeError('Kotak unggah Gemini tidak ditemukan')
    s.tombol('Escape', 27)                      # tutup menu agar tidak menutupi kotak ketik
    t0 = time.time()
    while time.time() - t0 < batas:
        time.sleep(2)
        k = s.evaluasi(JS_UNGGAHAN_SIAP) or ''
        if k.startswith('SIAP:'):
            return int(k.split(':', 1)[1] or 0)
    raise RuntimeError('Gemini tidak selesai memproses foto dalam batas waktu')


class Ditolak(RuntimeError):
    """Gemini menjawab dengan penolakan, bukan dengan isi."""


# Cara membujuk ulang, dipakai berurutan. Mengirim teks yang PERSIS SAMA setelah
# ditolak hampir selalu ditolak lagi — yang berubah harus bingkainya, bukan cuma
# percobaannya. Urutannya dari yang paling kecil perubahannya:
#   1. apa adanya
#   2. diberi kalimat pembuka yang menjelaskan ini tugas mengajar — penolakan
#      "saya hanya model bahasa" biasanya muncul karena perintahnya terbaca
#      sebagai templat kaku tanpa permintaan yang jelas
#   3. tanpa tuntutan blok kode — tuntutan itu sendiri sering jadi pemicunya;
#      rumusnya masih bisa diselamatkan normalkan_rumus() dari bentuk \(...\)
PEMBUKA = ("Saya guru bimbel dan sedang menyiapkan bahan belajar untuk murid saya. "
           "Tolong kerjakan permintaan di bawah ini.\n\n")


# Flash untuk semua percobaan: itu mode termurah, dan Rico memang memilihnya.
# Yang berubah tiap percobaan hanyalah bingkai kalimatnya. Mode lain tetap bisa
# dipilih dari halaman lewat setelan, untuk naskah yang memang berat.
MODE_BAKU = ('flash', 'flash', 'flash')


def _bingkai(perintah, ke):
    if ke == 0: return perintah + BUNGKUS
    if ke == 1: return PEMBUKA + perintah + BUNGKUS
    return PEMBUKA + perintah


def gemini_tanya(perintah, batas=300, stabil=5, lapor=None, ulang=2, lampiran=None,
                 mode=None):
    """Kirim ke Gemini, dengan beberapa cara membujuk bila ditolak."""
    galat_akhir = None
    for ke in range(ulang + 1):
        try:
            return _tanya_sekali(_bingkai(perintah, ke), batas, stabil, lapor, lampiran,
                                 mode or MODE_BAKU[min(ke, len(MODE_BAKU) - 1)])
        except BelumMasuk:
            raise
        except Exception as e:
            galat_akhir = e
            if ke >= ulang:
                break
            _catat_galat(ke + 1, e)
            # Penolakan cukup dijawab dengan bingkai lain di utas baru; memuat
            # ulang halaman hanya berguna untuk kegagalan teknis (sesi kacau,
            # tab menggantung), dan lambat.
            if not isinstance(e, Ditolak):
                s = _sesi(URL_GEMINI, 'gemini.google.com')
                try:
                    s.buka(URL_GEMINI)      # muat ulang penuh: keadaan bersih
                    time.sleep(5)
                finally:
                    s.tutup()
            else:
                time.sleep(3)
    raise galat_akhir


def _catat_galat(ke, e):
    """Tulis kegagalan ke keluaran layanan supaya frekuensinya terukur.

    Sebelumnya galat hanya tersimpan di memori tugas, jadi pertanyaan "kenapa
    sering muncul?" tidak punya satu pun angka untuk dijawab.
    """
    try:
        print(f'[gemini] percobaan {ke} gagal: {type(e).__name__}: '
              f'{str(e)[:160]}', flush=True)
    except Exception:
        pass


def _tanya_sekali(perintah, batas=300, stabil=5, lapor=None, lampiran=None,
                  mode=None):
    perintah = perintah + BUNGKUS
    s = _sesi(URL_GEMINI, 'gemini.google.com')
    try:
        for _ in range(20):
            k = s.evaluasi(JS_SUDAH_MASUK)
            if k == 'MASUK': break
            if k == 'BELUM':
                raise BelumMasuk('Jendela Chrome kendali belum masuk akun Google. '
                                 'Login sekali di jendela itu, lalu ulangi.')
            time.sleep(1.5)
        else:
            raise BelumMasuk('Halaman Gemini tidak siap di jendela kendali.')

        percakapan_baru(s)
        for _ in range(20):
            if s.evaluasi(JS_SUDAH_MASUK) == 'MASUK': break
            time.sleep(1)
        try:
            pilih_mode(s, mode or MODE_BAKU[0])
        except Exception:
            pass                          # mode gagal dipilih bukan alasan batal
        if lampiran:
            _lampirkan(s, lampiran)
        _kirim(s, perintah)

        t0, terakhir, sejak = time.time(), '', None
        while time.time() - t0 < batas:
            time.sleep(2)
            k = s.evaluasi(JS_BACA) or ''
            if k == 'KOSONG': continue
            sibuk = k.startswith('SIBUK:')
            teks = k.split(':', 1)[1] if ':' in k else ''
            if lapor and teks: lapor(len(teks))
            if teks and teks == terakhir and not sibuk:
                if sejak is None: sejak = time.time()
                elif time.time() - sejak >= stabil: return _periksa(teks)
            else:
                terakhir, sejak = teks, None
        if terakhir: return _periksa(terakhir)
        raise RuntimeError('Gemini tidak menjawab dalam batas waktu')
    finally:
        s.tutup()

AWAL_SOAL = re.compile(r'^\s*((?:PG|B|I|E|M|IB)\d{1,3}\.|\(?[a-h]\)|\((?:i{1,3}|iv|v|vi{1,3})\))\s')
BOBOT = re.compile(r'\s*\[(\d{1,2})\]\s*')

def rapikan_naskah(teks):
    """Pindahkan bobot nilai yang nyasar ke akhir kalimat soalnya.

    Format menuntut "[3]" di AKHIR kalimat, tapi Gemini kadang menaruhnya di
    tengah — "Hitunglah nilai dari: [2] 18 - 15 ...". Aplikasi lalu mencetaknya
    sebagai teks biasa di badan soal, bukan di kolom nilai.
    """
    keluar = []
    for b in teks.split('\n'):
        if AWAL_SOAL.match(b):
            angka = BOBOT.findall(b)
            if angka and not b.rstrip().endswith(']'):
                b = BOBOT.sub(' ', b).rstrip()
                b = re.sub(r'\s{2,}', ' ', b) + f' [{angka[0]}]'
        keluar.append(b)
    return '\n'.join(keluar)

JS_ISI_WS = r"""
(function(teks){
  const k = document.getElementById('rawInput');
  if(!k) return 'GAGAL:rawInput';
  k.value = teks;
  k.dispatchEvent(new Event('input', {bubbles:true}));
  // Event input saja TIDAK cukup — aplikasi ini merender lewat tombol
  // "Render Worksheet" (#btnRender). Tanpa mengkliknya, yang tercetak
  // hanyalah pesan "Tempel naskah soal di panel kiri".
  const b = document.getElementById('btnRender');
  if(!b) return 'GAGAL:btnRender';
  b.click();
  return 'OK';
})(%s)
"""

JS_SETEL = r"""
(function(o){
  const set = (id, nilai) => {
    const e = document.getElementById(id);
    if (!e || nilai === null || nilai === undefined || nilai === '') return;
    e.value = nilai; e.dispatchEvent(new Event('input', {bubbles:true}));
  };
  const centang = (id, mau) => {
    const e = document.getElementById(id);
    if (!e || e.checked === mau) return;
    e.click();                     // klik, bukan .checked — agar penanganya jalan
  };
  set('brandName', o.lembaga);
  set('codeMapel', o.mapel);
  set('codeSekolah', o.sekolah);
  set('codeKelas', o.kelas);
  set('codeTanggal', o.tanggal);
  set('bodyColumns', o.kolom);        // 1 kolom penuh / 2 kolom koran
  set('pgOptionCols', o.kolom);
  // Kerapatan adalah tombol preset yang menyetel ukuran font & jarak sekaligus
  if (o.kerapatan) {
    const b = document.getElementById('density' + o.kerapatan);
    if (b) b.click();
  }
  // Ruang jawab otomatis: 2 garis per nilai itu longgar untuk soal hitungan;
  // nilainya disetel lewat input range, bukan teks biasa.
  if (o.garis_per_nilai) {
    const r = document.getElementById('linesPerMark');
    if (r) { r.value = o.garis_per_nilai; r.dispatchEvent(new Event('input', {bubbles:true})); }
  }
  centang('showAnswerKey', !!o.kunci);
  centang('showExplanation', !!o.pembahasan);
  centang('showMarks', true);
  return 'OK';
})(%s)
"""

JS_JAWABAN = r"""
(function(o){
  const centang = (id, mau) => {
    const e = document.getElementById(id);
    if (e && e.checked !== mau) e.click();
  };
  centang('showAnswerKey', !!o.kunci);
  centang('showExplanation', !!o.pembahasan);
  const b = document.getElementById('btnRender');
  if (b) b.click();
  return 'OK';
})(%s)
"""

def cetak_halaman(url, tujuan, tunggu=3.5):
    """Cetak halaman apa pun di server ini jadi PDF — dipakai lembar pembahasan
    yang punya tata letak sendiri, di luar Exact Worksheet Maker."""
    s = _sesi(url, url.split('//')[-1].split('?')[0])
    try:
        s.buka(url)
        time.sleep(tunggu)                # beri waktu KaTeX merender
        return s.pdf(tujuan, margin_mm=(16, 15))
    finally:
        s.tutup()


def worksheet_pdf(naskah, tujuan, tunggu=4.0, kop=None, tujuan_kunci=None):
    """Suapkan naskah ke Exact Worksheet Maker, lalu cetak PDF dari tabnya.

    Bila `tujuan_kunci` diisi, lembar dirender DUA KALI dari naskah yang sama:
    tanpa kunci/pembahasan untuk siswa, lalu dengan keduanya untuk guru. Meminta
    Gemini dua kali akan menghasilkan soal yang BERBEDA — bukan itu yang dimau.
    """
    wsmaker.pastikan_server()
    s = _sesi(wsmaker.ALAMAT, '/wsm/')
    try:
        if kop:
            s.evaluasi(JS_SETEL % json.dumps(kop))
            time.sleep(0.6)
        if s.evaluasi(JS_ISI_WS % json.dumps(rapikan_naskah(naskah))) != 'OK':
            raise RuntimeError('Kotak naskah Exact Worksheet Maker tidak ditemukan')
        # Panel kerja TIDAK perlu disembunyikan manual: aplikasi sudah punya
        # aturan @media print (.no-print{display:none}), dan Page.printToPDF
        # merender dengan media cetak. Menyetel display:none lewat JS justru
        # merusak: tombol #btnRender ada di dalam bilah sisi, jadi perenderan
        # berikutnya mati total dan PDF keluar kosong.
        if tujuan_kunci:
            # 1) lembar siswa: tanpa kunci & pembahasan
            s.evaluasi(JS_JAWABAN % json.dumps({'kunci': False, 'pembahasan': False}))
            time.sleep(tunggu)
            s.pdf(tujuan)
            # 2) lembar guru: dengan kunci & pembahasan
            s.evaluasi(JS_JAWABAN % json.dumps(
                {'kunci': True, 'pembahasan': bool((kop or {}).get('pembahasan', True))}))
            time.sleep(tunggu)
            s.pdf(tujuan_kunci)
            return tujuan, tujuan_kunci
        time.sleep(tunggu)                       # beri waktu render + KaTeX + SVG
        return s.pdf(tujuan)
    finally:
        s.tutup()
