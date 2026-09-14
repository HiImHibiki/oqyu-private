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

    Potongan URL-nya harus SPESIFIK. Mencocokkan "gemini.google.com" saja
    membuat halaman setelan seperti /saved-info ikut terpilih — halaman itu
    tidak punya kotak ketik, jadi gejalanya "Halaman Gemini tidak siap di
    jendela kendali" padahal sesinya sehat.
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
# Dulu tiap perintah diakhiri permintaan membungkus jawaban dalam satu blok
# kode, supaya tanda $ pada rumus tidak hilang saat disalin. Permintaan itu
# dicabut: ia justru sering membuat Gemini menolak atau malah membalas dengan
# skrip Python. Sekarang Gemini menulis biasa saja, dan rumusnya diselamatkan
# di sisi kita — normalkan_rumus() menukar \(...\) dan \[...\] jadi $...$.
# Kosong dengan sengaja. Tidak ada lagi permintaan cara menulis: rumusnya
# diambil dari atribut data-math di halaman (lihat JS_BACA), jadi Gemini boleh
# menulis sewajarnya. Tiap aturan format tambahan adalah satu alasan lagi
# baginya untuk menolak.
BUNGKUS = ""

JS_BACA = r"""
(function(){
  const b = document.querySelectorAll('.model-response-text, message-content, model-response');
  if(!b.length) return 'KOSONG';
  const akhir = b[b.length-1];
  const sibuk = !!document.querySelector('button[aria-label*="Stop" i], [data-test-id="stop-button"]');

  // Rumus tidak lagi diminta dalam blok kode, jadi Gemini merendernya dengan
  // KaTeX dan innerText hanya memberi pecahan glif: "c=", "a", "2", "+b".
  // LaTeX aslinya masih ada di atribut data-math pada pembungkusnya, jadi tiap
  // rumus ditukar kembali jadi $...$ sebelum teksnya dibaca.
  //
  // Penukaran dilakukan pada SALINAN yang ditempel sementara di luar layar:
  // innerText perlu tata letak (salinan lepas hanya memberi textContent tanpa
  // ganti baris), sementara mengubah simpul aslinya berarti mengutak-atik
  // halaman yang mungkin masih ditulisi Gemini.
  const salinan = akhir.cloneNode(true);
  salinan.querySelectorAll('[data-math]').forEach(function(e){
    const r = (e.getAttribute('data-math') || '').trim();
    if (r) e.replaceWith(document.createTextNode('$' + r + '$'));
  });
  const bayang = document.createElement('div');
  bayang.style.cssText = 'position:absolute;left:-99999px;top:0;width:900px';
  bayang.appendChild(salinan);
  document.body.appendChild(bayang);
  const t = salinan.innerText || salinan.textContent || '';
  bayang.remove();

  return (sibuk ? 'SIBUK:' : 'SELESAI:') + t;
})()
"""

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
    if TANPA_BAHAN.search(t[:500]):
        raise TanpaBahan('Gemini tidak menerima bahannya: ' + t[:120])
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

# Jeda setelah perintah ditempel, sebelum dikirim. Bukan sekadar berjaga-jaga:
# Gemini baru menyalakan tombol kirimnya dan mengaitkan lampiran ke pesan
# setelah isinya diproses, dan mengirim terlalu cepat membuatnya menjawab
# seolah tidak ada bahan yang dikirim.
JEDA_SEBELUM_KIRIM = 2

# Diketik manual di ujung tiap prompt (lihat _kirim). Kalimatnya sengaja luwes
# seperti tulisan orang, bukan perintah kaku.
INSTRUKSI_MANUAL = 'Oiya, tolong jawabannya tanpa tautan sumber atau sitasi ya.'

# Pemanasan: giliran pertama yang SINGKAT dan alami, tanpa lampiran, supaya
# Gemini sudah masuk "mode menjawab" sebelum PDF + aturan panjang tiba. Menurut
# Gemini sendiri, PDF + blok aturan panjang yang datang sekaligus di pesan
# pertama kadang memicu penolakan/guardrail; membuka percakapan dulu
# TERNYATA malah memperlambat # mengurangi itu. Dimatikan dengan EXACT_PEMANASAN=0. menambah gagal (uji 2026-09-14: kunci 272s vs
# 81s, Gemini bingung "materi belum terlampir"). Default MATI; nyalakan dengan
# EXACT_PEMANASAN=1 hanya untuk eksperimen.
PEMANASAN = ('Halo, saya guru bimbel. Saya mau minta tolong dibuatkan bahan '
             'belajar untuk murid saya. Sebentar lagi saya kirim detail dan '
             'bahannya di pesan berikutnya ya, tolong dibantu.')

def _pemanasan_nyala():
    import os
    return os.environ.get('EXACT_PEMANASAN', '0') in ('1', 'ya', 'true')   # default MATI: uji menunjukkan lebih lambat + lebih sering gagal


def _kirim(s, perintah, tambah_instruksi=True):
    """Isi kotak, tunggu sebentar, lalu kirim.

    Dua hal yang WAJIB, dan dua-duanya sempat gagal:
      1. Teks dimasukkan lewat Input.insertText (CDP), bukan innerHTML —
         Gemini mengabaikan perubahan DOM dari JavaScript.
      2. Pengirimannya lewat peristiwa masukan tepercaya (tombol Enter atau
         klik di koordinat), bukan .click() — peristiwa buatan JavaScript
         diabaikan juga.
    """
    _tunggu_selesai_menulis(s)
    s.ganti_isi_editor('div.ql-editor', perintah)
    time.sleep(JEDA_SEBELUM_KIRIM)

    # Instruksi "hapus tautan sumber" DIKETIK MANUAL (huruf demi huruf), bukan
    # ikut ditempel: satu aliran ketikan tangan tiap pesan membuat interaksinya
    # tidak tampak seperti robot menempel blok besar — sekaligus memastikan
    # Gemini tidak menyisipkan tautan sumber/sitasi ke dalam naskah, yang
    # merusak pengurai. Berlaku untuk semua jenis (buat soal, kunci, rangkuman)
    # karena _kirim dipakai ketiganya.
    if INSTRUKSI_MANUAL and tambah_instruksi:
        try:
            s.ketik_manual('\n' + INSTRUKSI_MANUAL)
            time.sleep(0.6)
        except Exception:
            pass          # gagal ketik manual bukan alasan membatalkan kiriman

    # Pengirimannya lewat KLIK tombol kirim, bukan Enter.
    #
    # Enter memang mengirim — tapi hanya untuk pesan satu baris. Perintah kita
    # bertingkat banyak baris, dan di kotak seperti itu Enter berarti "baris
    # baru": diuji dengan perintah 7.227 karakter, kotaknya tetap terisi penuh
    # setelah enam detik. Uji dengan pesan pendek sempat menyesatkan karena di
    # situ Enter justru berhasil.
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
    # Kliknya kadang meleset — tombol bergeser sesaat setelah kotaknya terisi,
    # atau lapisan menu sempat menutupinya. Dulu satu klik meleset membuang
    # SELURUH percobaan, padahal mengklik ulang ongkosnya nol: perintahnya masih
    # utuh di kotak, tinggal ditekan lagi di koordinat yang dihitung ulang.
    kosong = ("((document.querySelector('div.ql-editor')||{}).innerText||'')"
              ".trim().length")
    for percobaan in range(4):
        s.klik_di(pos[0], pos[1])
        for _ in range(8):
            time.sleep(1)
            if (s.evaluasi(kosong) or 0) <= 1:
                return True
        titik = s.evaluasi("""(function(){
          const b=[...document.querySelectorAll('button')]
            .find(x=>/^send/i.test(x.getAttribute('aria-label')||''));
          if(!b||b.disabled) return null;
          const r=b.getBoundingClientRect();
          return [r.left+r.width/2, r.top+r.height/2];})()""")
        if titik:
            pos = titik
        else:
            # tombol kirim hilang: biasanya justru karena kiriman SUDAH jalan
            if (s.evaluasi(kosong) or 0) <= 1:
                return True
            time.sleep(1.5)
    raise RuntimeError('Perintah tidak terkirim — kotak masih terisi')

# Gemini menolak dengan kata-kata yang berubah-ubah: "hanya model bahasa",
# "sebagai model bahasa", "tidak diprogram", "tidak dirancang". Yang tetap cuma
# frasa "model bahasa", jadi itu yang dicocokkan — bukan kalimat utuhnya.
# "Belum terlampir", "belum tersalin", "tidak ada gambar", "silakan kirimkan
# materinya" - Gemini bilang ia tidak menerima bahan. Balasannya sering lebih
# dari 200 karakter, jadi lolos ambang panjang dan baru ketahuan saat pengurai
# gagal - dengan pesan yang tidak menyebut sebab sebenarnya.
TANPA_BAHAN = re.compile(
    r'belum terlampir|tidak terlampir|belum tersalin|tidak tersalin|'
    r'belum (?:ada|dilampirkan)|tidak (?:ada|menemukan) (?:gambar|foto|lampiran|berkas)|'
    r'silakan (?:kirim|lampir|unggah)|sepertinya belum', re.I)

PENOLAKAN = re.compile(
    r'tidak bisa membantu|tidak dapat membantu|model bahasa|'
    r'tidak diprogram|tidak dirancang|belum bisa membantu|tidak mampu memahami|'
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

# Tanda pengenal tombol unggah beserta letaknya. Kalau nilainya berubah antara
# dua pembacaan berjarak, bilah pengetiknya sedang dirender ulang.
JS_TOMBOL_UNGGAH = r"""
(function(){
  const e = document.querySelector('button[aria-label="Upload & tools"]');
  if (!e) return '';
  const r = e.getBoundingClientRect();
  return [Math.round(r.left), Math.round(r.top), Math.round(r.width)].join(',');
})()
"""

JS_UNGGAHAN_SIAP = r"""
(function(){
  const pra = document.querySelectorAll('uploader-file-preview').length;
  if (!pra) return 'KOSONG';
  const putar = [...document.querySelectorAll('mat-spinner,[class*=spinner],[class*=progress]')]
                  .filter(e => e.offsetParent).length;
  return putar ? 'PROSES' : 'SIAP:' + pra;
})()
"""


def _lampirkan(s, berkas, batas=120, jeda=5):
    """Unggah foto ke Gemini supaya matanya sendiri yang membaca.

    Dipakai untuk tulisan tangan dan gambar/diagram, yang tidak bisa diwakili
    teks hasil OCR. input[type=file] baru dibuat setelah menu "Upload & tools"
    dibuka, dan menu itu kadang belum terpasang saat diklik pertama kali —
    karena itu pembukaannya diulang beberapa kali sebelum menyerah.
    """
    berkas = [str(x) for x in (berkas or [])]
    if not berkas: return 0
    _tampilkan(s)                               # tab tersembunyi tidak menerima klik
    # input[type=file] dibuat sekali saat menu unggah pertama kali dibuka, lalu
    # bertahan selama halaman tidak dimuat ulang. Mencoba langsung lebih dulu
    # menghindari klik menu yang sering meleset — dan setiap kegagalan unggah
    # membakar satu percobaan, yang berikutnya sering berakhir jadi penolakan.
    sudah = False
    try:
        sudah = bool(s.evaluasi("!!document.querySelector('input[type=file]')"))
    except Exception:
        pass
    if sudah:
        try:
            if s.unggah_ke_input('input[type=file]', berkas):
                sudah = True
            else:
                sudah = False
        except Exception:
            sudah = False
    if not sudah:
        for _ in range(20):                     # tombolnya muncul belakangan
            if s.evaluasi("!!document.querySelector('button[aria-label=\"Upload & tools\"]')"):
                break
            time.sleep(0.5)
        # Tombolnya TOGGLE. Kalau menunya sudah terbuka dari percobaan
        # sebelumnya, mengkliknya justru MENUTUP — dan gejalanya persis seperti
        # klik yang tidak sampai: menu kosong, tak ada input berkas, tanpa
        # galat apa pun. Karena itu keadaannya dibaca dulu, bukan diasumsikan.
        for percobaan in range(5):
            # Tunggu bilah pengetiknya DIAM dulu. Gemini merender ulang bagian
            # itu sesekali — tombolnya sempat hilang sama sekali dari halaman —
            # dan klik yang jatuh tepat saat render membuat menunya terbuka
            # lalu langsung tertutup lagi. Gejalanya sama persis dengan klik
            # yang tidak sampai: menu kosong, tanpa galat apa pun.
            for _ in range(25):
                a = s.evaluasi(JS_TOMBOL_UNGGAH)
                time.sleep(0.4)
                if a and a == s.evaluasi(JS_TOMBOL_UNGGAH):
                    break
            terbuka = s.evaluasi(
                '(document.querySelector(\'button[aria-label="Upload & tools"]\')'
                ' || {}).getAttribute ? document.querySelector('
                '\'button[aria-label="Upload & tools"]\').getAttribute("aria-expanded") : null')
            if terbuka == 'true':
                s.tombol('Escape', 27)
                time.sleep(0.8)
            s.klik_elemen('button[aria-label="Upload & tools"]')
            time.sleep(1.5 + percobaan * 0.7)
            try:
                if s.unggah_ke_input('input[type=file]', berkas): break
            except Exception:
                pass
            s.tombol('Escape', 27); time.sleep(1)
        else:
            # Jalur cadangan: biarkan Chrome MENAHAN dialog berkas milik sistem
            # (Page.setInterceptFileChooserDialog) lalu suntikkan berkasnya ke
            # simpul yang dilaporkannya. Ini tidak bergantung pada menunya
            # terbuka atau tidak — yang selama ini jadi titik gagalnya.
            if not s.unggah_berkas(berkas, 'button[aria-label="Upload & tools"]'):
                raise RuntimeError('Menu unggah Gemini tidak mau terbuka — biasanya '
                               'halamannya sedang dirender ulang. Coba ulangi '
                               'sebentar lagi.')
    s.tombol('Escape', 27)                      # tutup menu agar tidak menutupi kotak ketik

    # Pratinjaunya muncul dulu — itu baru tanda berkasnya DITERIMA halaman,
    # bukan tanda unggahannya selesai.
    t0 = time.time()
    while time.time() - t0 < batas:
        time.sleep(1)
        k = s.evaluasi(JS_UNGGAHAN_SIAP) or ''
        if k.startswith('SIAP:'):
            n = int(k.split(':', 1)[1] or 0)
            break
    else:
        raise RuntimeError('Foto tidak terpasang di Gemini — kotak unggahnya tidak '
                           'menampilkan pratinjau. Coba ulangi; kalau berulang, '
                           'buka jendela Chrome kendali dan periksa halamannya.')

    # Pratinjau muncul = berkasnya DITERIMA halaman, bukan unggahannya selesai.
    # Halaman tidak memberi tanda apa pun untuk selesainya — cip pratinjau,
    # kelasnya, dan tombol kirim semuanya tidak berubah dari awal sampai akhir.
    # Jadi diberi jeda tetap. Kalau percobaan pertama gagal, pemanggilnya
    # menaikkan jeda ini (lihat gemini_tanya).
    time.sleep(jeda)
    return n


def _kelas_henti():
    """Kelas galat penghentian, diambil malas supaya otomasi tidak mengimpor buat."""
    try:
        import buat
        return buat.Dihentikan
    except Exception:
        return ()


_HENTI_KELAS = _kelas_henti()


class TanpaBahan(RuntimeError):
    """Gemini menjawab bahwa materinya tidak terlampir/tersalin.

    Ini bukan penolakan dan bukan jawaban - ini tanda pesannya terkirim
    SEBELUM lampirannya tuntas, atau lampirannya terlepas saat dikirim.
    Dibedakan dari Ditolak karena pemulihannya lain: bukan ganti bingkai
    kalimat, melainkan tunggu unggahan lebih lama lalu ulangi.
    """


class Ditolak(RuntimeError):
    """Gemini menjawab dengan penolakan, bukan dengan isi."""


# Cara membujuk ulang, dipakai berurutan. Mengirim teks yang PERSIS SAMA setelah
# ditolak hampir selalu ditolak lagi — yang berubah harus bingkainya, bukan cuma
# percobaannya. Urutannya dari yang paling kecil perubahannya:
#   1. apa adanya
#   2. diberi kalimat pembuka yang menjelaskan ini tugas mengajar — penolakan
#      "saya hanya model bahasa" biasanya muncul karena perintahnya terbaca
#      sebagai templat kaku tanpa permintaan yang jelas
#   3. tanpa embel-embel cara menulis sama sekali, hanya permintaan intinya
PEMBUKA = ("Saya guru bimbel dan sedang menyiapkan bahan belajar untuk murid saya. "
           "Tolong kerjakan permintaan di bawah ini.\n\n")

# Satu kalimat pembuka yang menyebut bentuk keluarannya. Tanpa ini, perintah
# dibuka langsung oleh spesifikasi format — dan permintaan yang terbaca sebagai
# templat kaku itulah yang paling sering dibalas "saya hanya model bahasa".
# Menyebut "daftar" membuatnya terbaca sebagai pekerjaan menulis biasa.
DAFTAR = "Tolong buatkan dalam bentuk daftar, mengikuti susunan di bawah ini.\n\n"


# Dua percobaan pertama memakai Flash — mode termurah, dan memang yang dipilih
# Rico. Percobaan TERAKHIR naik ke Pro, dan hanya itu.
#
# Alasannya dari catatan kegagalan, bukan tebakan: kalau Flash menolak, ia
# menolak ketiga-tiganya, sehingga lembarnya batal sama sekali. Satu permintaan
# Pro pada percobaan terakhir lebih hemat daripada satu lembar gagal yang
# ujungnya dikerjakan ulang dengan tangan. Kalau percobaan pertama berhasil —
# dan itu yang biasa terjadi — Pro tidak pernah tersentuh.
MODE_BAKU = ('flash', 'flash', 'pro')


def _bingkai(perintah, ke):
    if ke == 0: return DAFTAR + perintah + BUNGKUS
    if ke == 1: return PEMBUKA + DAFTAR + perintah + BUNGKUS
    return PEMBUKA + perintah


def gemini_tanya(perintah, batas=300, stabil=5, lapor=None, ulang=2, lampiran=None,
                 mode=None, henti=None):
    """Kirim ke Gemini, dengan beberapa cara membujuk bila ditolak.

    Chrome kendali DINYALAKAN ULANG dulu, tiap permintaan. Keadaan tab Gemini
    memburuk selama dipakai — bukan tercemar oleh satu obrolan, sebab tab baru
    pun ikut rusak: menu unggah tidak mau terbuka, klik kirim diabaikan bahkan
    untuk teks 76 karakter, dan tidak ada satu pun permintaan unggah yang keluar.
    Direkam lewat Network: di Chrome yang baru dinyalakan, teks terkirim 1 detik,
    foto terunggah ke push.clients6.google.com/upload (200) dan terkirim 1 detik.
    Ongkosnya ±5 detik per lembar; login tersimpan di profil, jadi tidak hilang.
    EXACT_SEGAR=0 mematikan ini untuk membandingkan.
    """
    if os.environ.get('EXACT_SEGAR', '1') not in ('0', 'tidak', 'false'):
        try:
            if cdp.SEGAR and cdp.hidup():
                cdp.SEGAR = False          # sudah dinyalakan ulang seusai tugas sebelumnya
            else:
                cdp.nyalakan_ulang()
            time.sleep(2)
        except Exception as e:
            _catat_galat(0, RuntimeError(f'gagal menyegarkan Chrome: {e}'))
    galat_akhir = None
    for ke in range(ulang + 1):
        try:
            # Percobaan pertama menunggu 5 detik setelah foto terpasang;
            # percobaan berikutnya 10. Kalau yang pertama gagal, tersangka
            # pertamanya justru unggahan yang belum rampung.
            return _tanya_sekali(_bingkai(perintah, ke), batas, stabil, lapor, lampiran,
                                 mode or MODE_BAKU[min(ke, len(MODE_BAKU) - 1)], henti,
                                 jeda_unggah=(5, 10, 20)[min(ke, 2)])
        except BelumMasuk:
            raise
        except _HENTI_KELAS:
            raise                      # permintaan berhenti bukan kegagalan
        except Exception as e:
            galat_akhir = e
            if ke >= ulang:
                break
            _catat_galat(ke + 1, e)
            if lampiran and ke == 0:
                _catat_galat(ke + 1, RuntimeError(
                    'ada foto terlampir — percobaan berikutnya menunggu 10 detik '
                    'setelah unggah, bukan 5'))
            # Pemulihan bertingkat, dari yang paling murah:
            #   penolakan   -> cukup bingkai lain di utas baru
            #   gagal ke-1  -> muat ulang halaman
            #   gagal ke-2  -> TUTUP Chrome lalu nyalakan lagi
            #
            # Memuat ulang tidak membuang segalanya: sesi yang tersangkut,
            # pekerja layanan basi, dan tab menggantung bertahan melewatinya.
            # Menutup Chrome membuang semuanya, dan profilnya tetap di disk
            # sehingga login Google tidak ikut hilang.
            if isinstance(e, (Ditolak, TanpaBahan)):
                time.sleep(3)
            elif ke == 0:
                s = _sesi(URL_GEMINI, 'gemini.google.com/app')
                try:
                    s.buka(URL_GEMINI)      # muat ulang penuh
                    time.sleep(5)
                finally:
                    s.tutup()
            else:
                _catat_galat(ke + 1, RuntimeError('menutup Chrome kendali'))
                cdp.nyalakan_ulang()
                time.sleep(4)
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


# Kalimat pelurus, dicoba berurutan di dalam utas yang sama sebelum menyerah.
TEGURAN = (
    'Ini bukan permintaan yang aneh: saya guru bimbel dan sedang menyiapkan '
    'lembar latihan untuk murid saya sendiri. Tolong kerjakan permintaan di '
    'atas, ikuti susunannya.',
    'Tolong tuliskan saja daftarnya sesuai susunan di atas, apa adanya.',
)


def _panen(s, batas, stabil, lapor=None, henti=None):
    """Tunggu Gemini selesai menulis, kembalikan teks jawabannya apa adanya.

    henti: fungsi tanpa argumen yang dipanggil tiap putaran. Kalau ia melempar,
    penantian berhenti di situ — ini tahap terlama, jadi tombol berhenti harus
    berlaku di sini, bukan cuma di batas antar langkah.
    """
    t0, terakhir, sejak = time.time(), '', None
    while time.time() - t0 < batas:
        time.sleep(2)
        if henti: henti()
        k = s.evaluasi(JS_BACA) or ''
        if k == 'KOSONG': continue
        sibuk = k.startswith('SIBUK:')
        teks = k.split(':', 1)[1] if ':' in k else ''
        if lapor and teks: lapor(len(teks))
        if teks and teks == terakhir and not sibuk:
            if sejak is None: sejak = time.time()
            elif time.time() - sejak >= stabil: return teks
        else:
            terakhir, sejak = teks, None
    if terakhir: return terakhir
    raise RuntimeError('Gemini tidak menjawab dalam batas waktu')


def _tanya_sekali(perintah, batas=300, stabil=5, lapor=None, lampiran=None,
                  mode=None, henti=None, jeda_unggah=5):
    perintah = perintah + BUNGKUS
    s = _sesi(URL_GEMINI, 'gemini.google.com/app')
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

        # Giliran 1 (pemanasan): buka percakapan dengan kalimat alami, tanpa
        # lampiran, lalu tunggu Gemini menjawab singkat ("silakan"). Setelah itu
        # baru PDF + aturan dikirim di giliran 2. Kalau pemanasannya gagal,
        # lanjut saja ke pengiriman biasa — bukan alasan membatalkan.
        if _pemanasan_nyala():
            try:
                _kirim(s, PEMANASAN, tambah_instruksi=False)
                _panen(s, batas=60, stabil=2, lapor=None, henti=henti)
            except Exception:
                pass

        if lampiran:
            _lampirkan(s, lampiran, jeda=jeda_unggah)
        _kirim(s, perintah)

        # Penolakan dijawab DI UTAS YANG SAMA lebih dulu. Membuang utasnya dan
        # mengirim ulang perintah 8.000 karakter dari nol itu mahal dan lambat,
        # padahal Gemini masih mengingat permintaannya — satu kalimat pelurus
        # biasanya cukup, dan ongkosnya hanya beberapa detik.
        teks = _panen(s, batas, stabil, lapor, henti)
        for pelurus in TEGURAN:
            if not (teks and PENOLAKAN.search(teks[:400])):
                break
            _kirim(s, pelurus)
            teks = _panen(s, batas, stabil, lapor, henti)
        return _periksa(teks)
    finally:
        s.tutup()

AWAL_BAGIAN = re.compile(r'^\s*Bagian\s+1\s*:', re.I)
BUTIR_SOAL = re.compile(r'^\s*(?:PG|B|I|E|M|IB)\d{1,3}\.', re.I | re.M)


def buang_draf(naskah):
    """Ambil satu naskah saja ketika Gemini menulis lebih dari sekali.

    Gemini kadang menampilkan draf pendek lebih dulu lalu menulis ulang versi
    lengkapnya, dan keduanya ikut terbaca dari halaman. Gejalanya persis yang
    dilaporkan: diminta 10 esai, yang tercetak cuma 1 — karena naskahnya memuat
    "Bagian 1: (E)" DUA KALI, yang pertama berisi satu soal dan yang kedua
    berisi sepuluh, lalu perendernya memakai yang pertama.

    Penanda awalnya "Bagian 1:", bukan judul: judul naskah tidak punya bentuk
    tetap, sedangkan penomoran bagian selalu dimulai dari 1. Kepala naskah
    (judul dan daftar rumus) diambil dari bagian PERTAMA karena di situ
    tempatnya, lalu disambung dengan badan yang paling lengkap.
    """
    baris = (naskah or '').replace('\r', '').split('\n')
    awal = [i for i, b in enumerate(baris) if AWAL_BAGIAN.match(b)]
    if len(awal) < 2:
        return naskah or ''
    kepala = baris[:awal[0]]
    batas = awal + [len(baris)]
    badan = ['\n'.join(baris[batas[i]:batas[i + 1]]) for i in range(len(batas) - 1)]
    terbaik = max(badan, key=lambda t: (len(BUTIR_SOAL.findall(t)), len(t)))
    return '\n'.join(kepala + terbaik.split('\n')).strip()


AWAL_SOAL = re.compile(r'^\s*((?:PG|B|I|E|M|IB)\d{1,3}\.|\(?[a-h]\)|\((?:i{1,3}|iv|v|vi{1,3})\))\s')
BOBOT = re.compile(r'\s*\[(\d{1,2})\]\s*')

def rapikan_naskah(teks):
    """Buang draf ganda, lalu pindahkan bobot nilai yang nyasar ke akhir soalnya.

    Format menuntut "[3]" di AKHIR kalimat, tapi Gemini kadang menaruhnya di
    tengah — "Hitunglah nilai dari: [2] 18 - 15 ...". Aplikasi lalu mencetaknya
    sebagai teks biasa di badan soal, bukan di kolom nilai.
    """
    teks = buang_draf(teks)
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


JS_SIAP_RENDER = r"""
(function(){
  const lembar = document.querySelectorAll('.sheet');
  if (!lembar.length) return 'KOSONG';
  const teks = document.body.innerText || '';
  return JSON.stringify({
    halaman: lembar.length,
    panjang: teks.length,
    kunci: teks.includes('Kunci Jawaban'),
    bahas: teks.includes('Pembahasan'),
    // KaTeX menyisakan simpul yang belum dirender; selama masih ada, tata
    // letaknya masih bisa berubah dan jumlah halamannya belum pasti.
    sisa: document.querySelectorAll('.katex-error, [data-katex-pending]').length
  });})()
"""


def _tunggu_render(s, butuh_kunci=False, butuh_bahas=False, batas=45, stabil=3):
    """Tunggu sampai lembarnya benar-benar selesai dirender.

    Dulu di sini cuma time.sleep(4). Itu cukup untuk naskah pendek dan TIDAK
    cukup untuk naskah berumus banyak — PDF-nya tercetak di tengah perenderan,
    dan bagian Kunci Jawaban serta Pembahasan yang dirender belakangan hilang
    tanpa jejak. Gejalanya terasa acak: naskah yang sama kadang lengkap kadang
    tidak, tergantung seberapa sibuk Mac saat itu.
    """
    t0, terakhir, sejak = time.time(), None, None
    while time.time() - t0 < batas:
        time.sleep(1)
        k = s.evaluasi(JS_SIAP_RENDER)
        if not k or k == 'KOSONG':
            continue
        try:
            d = json.loads(k)
        except Exception:
            continue
        if butuh_kunci and not d.get('kunci'):
            terakhir = None; continue
        if butuh_bahas and not d.get('bahas'):
            terakhir = None; continue
        tanda = (d['halaman'], d['panjang'])
        if tanda == terakhir:
            if sejak is None:
                sejak = time.time()
            elif time.time() - sejak >= stabil:
                return d
        else:
            terakhir, sejak = tanda, None
    return None


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
        mau_kunci = bool((kop or {}).get('kunci', True))
        mau_bahas = bool((kop or {}).get('pembahasan', True))
        if tujuan_kunci:
            # 1) lembar siswa: tanpa kunci & pembahasan
            s.evaluasi(JS_JAWABAN % json.dumps({'kunci': False, 'pembahasan': False}))
            _tunggu_render(s)
            s.pdf(tujuan)
            # 2) lembar guru: dengan kunci & pembahasan
            s.evaluasi(JS_JAWABAN % json.dumps({'kunci': True, 'pembahasan': mau_bahas}))
            _tunggu_render(s, butuh_kunci=True, butuh_bahas=mau_bahas)
            s.pdf(tujuan_kunci)
            return tujuan, tujuan_kunci
        # Kunci dan pembahasan ditegaskan lagi di sini, tidak hanya lewat
        # JS_SETEL: JS_SETEL berjalan SEBELUM naskahnya dimuat, jadi ia tidak
        # bisa memastikan hasil akhirnya benar-benar memuat keduanya.
        s.evaluasi(JS_JAWABAN % json.dumps({'kunci': mau_kunci, 'pembahasan': mau_bahas}))
        _tunggu_render(s, butuh_kunci=mau_kunci, butuh_bahas=mau_bahas)
        return s.pdf(tujuan)
    finally:
        s.tutup()


PERINTAH_BACA_FOTO = """Salin SELURUH isi gambar/berkas terlampir menjadi teks, apa adanya.

Aturan:
- Jangan menjawab soalnya, jangan mengomentari, jangan meringkas. Salin saja.
- Rumus ditulis di antara tanda dolar, misalnya $c^2 = a^2 + b^2$
- Untuk setiap gambar, diagram, grafik, atau bangun yang ada di dalamnya, tulis
  [GAMBAR: keterangan lengkap — sebutkan bentuknya, semua angka, satuan, dan
  label yang tertera padanya] di posisi yang sama seperti aslinya
- Bagian yang tidak terbaca jelas ditulis apa adanya lalu diberi tanda
  "(tidak terbaca jelas)" — JANGAN mengarang isinya
- Pertahankan urutan dan penomoran aslinya"""


def baca_foto(jalur, mode='flash', batas=240):
    """Salin isi foto jadi teks memakai mata Gemini.

    Dipakai saat mesin penyusunnya Claude: membaca gambar dengan Claude jauh
    lebih mahal daripada menyusun teks dengannya, sedangkan Gemini Flash sudah
    cukup untuk menyalin. Jadi yang mahal dipakai untuk yang memang sulit.
    """
    if not jalur:
        return ''
    return gemini_tanya(PERINTAH_BACA_FOTO, batas=batas, lampiran=list(jalur),
                        mode=mode)


def potret(potongan='gemini.google.com/app', lebar=760, mutu=55):
    """Tangkapan layar tab kendali, untuk ditampilkan di aplikasi.

    Chrome kendali berjalan tanpa jendela, jadi selama ini tidak ada cara
    melihat apa yang sedang terjadi di sana — kalau macet, yang terlihat cuma
    bilah kemajuan yang diam. Dengan potret ini penyebabnya langsung kelihatan:
    Gemini sedang menulis, menolak, meminta login, atau dialog yang menghalangi.

    Sesi dibuka dan ditutup sendiri tiap kali. Menahan sesi terbuka hanya untuk
    memotret akan berebut dengan tugas yang sedang berjalan di tab yang sama.
    """
    import base64
    # HANYA memotret, tanpa efek samping. Dulu lewat _sesi()/_tampilkan(), yang
    # pada sesi baru memasang ulang setDeviceMetricsOverride + bringToFront —
    # dan itu MENUTUP menu yang sedang terbuka. Dengan viewer di HP menyegarkan
    # tiap 2,5 detik, menu unggah tertutup di tengah tugas: lampiran lepas
    # ("belum terlampir"), lalu "Menu unggah tidak mau terbuka". Sekarang tab
    # dicari apa adanya; kalau Chrome/tab tidak ada, biarkan gagal (503) —
    # pemotret tidak boleh menyalakan Chrome atau membuka tab.
    if not cdp.hidup():
        raise RuntimeError('Chrome kendali sedang tidak hidup')
    tab = cdp.cari_tab(potongan)
    if not tab:
        raise RuntimeError('tab belum ada')
    s = cdp.Sesi(tab, timeout=15)
    try:
        d = s.perintah('Page.captureScreenshot', format='jpeg', quality=mutu,
                       captureBeyondViewport=False)
        return base64.b64decode(d['data'])
    finally:
        s.tutup()
