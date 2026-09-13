#!/usr/bin/env python3
"""Kendalikan Chrome lewat DevTools Protocol — tanpa AppleScript, tanpa setelan.

Chrome 152 mengabaikan klik menu dari otomasi, jadi "Allow JavaScript from Apple
Events" tidak bisa dinyalakan secara program. Jalur ini melewatinya sepenuhnya:
Chrome dijalankan dengan profil khusus dan port kendali sendiri.

Konsekuensi: profilnya terpisah, jadi login Google dilakukan sekali di jendela itu.
"""
import base64, json, os, socket, struct, subprocess, time, urllib.request, uuid
import lokasi

KROM = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
PROFIL = lokasi.data('chrome-otomatis')
PORT = 9222

class GagalCDP(Exception): pass

# ---------------------------------------------------------------- WebSocket
class WS:
    """Klien WebSocket seadanya — cukup untuk bicara dengan DevTools."""
    def __init__(self, url, timeout=180):
        if not url.startswith('ws://'): raise GagalCDP('URL WebSocket tidak sah')
        sisa = url[5:]
        host_port, _, jalur = sisa.partition('/')
        host, _, port = host_port.partition(':')
        self.sock = socket.create_connection((host, int(port or 80)), timeout=timeout)
        self.sock.settimeout(timeout)
        kunci = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall((
            f'GET /{jalur} HTTP/1.1\r\nHost: {host_port}\r\nUpgrade: websocket\r\n'
            f'Connection: Upgrade\r\nSec-WebSocket-Key: {kunci}\r\n'
            f'Sec-WebSocket-Version: 13\r\n\r\n').encode())
        buf = b''
        while b'\r\n\r\n' not in buf:
            d = self.sock.recv(4096)
            if not d: raise GagalCDP('Chrome menutup sambungan saat jabat tangan')
            buf += d
        if b'101' not in buf.split(b'\r\n')[0]:
            raise GagalCDP('Jabat tangan WebSocket ditolak: ' + buf[:80].decode('utf-8','replace'))
        self.sisa = buf.split(b'\r\n\r\n', 1)[1]

    def _baca(self, n):
        while len(self.sisa) < n:
            d = self.sock.recv(65536)
            if not d: raise GagalCDP('Sambungan terputus')
            self.sisa += d
        d, self.sisa = self.sisa[:n], self.sisa[n:]
        return d

    def kirim(self, teks):
        data = teks.encode()
        n = len(data)
        kepala = b'\x81'
        if n < 126: kepala += struct.pack('!B', 0x80 | n)
        elif n < 65536: kepala += struct.pack('!BH', 0x80 | 126, n)
        else: kepala += struct.pack('!BQ', 0x80 | 127, n)
        topeng = os.urandom(4)
        kepala += topeng
        self.sock.sendall(kepala + bytes(b ^ topeng[i % 4] for i, b in enumerate(data)))

    def terima(self):
        b1, b2 = self._baca(2)
        n = b2 & 0x7F
        if n == 126: n = struct.unpack('!H', self._baca(2))[0]
        elif n == 127: n = struct.unpack('!Q', self._baca(8))[0]
        isi = self._baca(n)
        if b2 & 0x80:                      # server tidak menyamarkan, tapi jaga-jaga
            t = self._baca(4); isi = bytes(c ^ t[i % 4] for i, c in enumerate(isi))
        return isi.decode('utf-8', 'replace')

    def tutup(self):
        try: self.sock.close()
        except Exception: pass

# ---------------------------------------------------------------- Chrome
def hidup():
    try:
        urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json/version', timeout=2).read()
        return True
    except Exception:
        return False

def nyalakan(tampil=None):
    """Jalankan Chrome berprofil khusus. Kembalikan True kalau baru dinyalakan.

    Bawaannya TANPA JENDELA supaya tidak merebut layar saat lembar dibuat —
    profil dan sesi loginnya tetap sama. Setel EXACT_TAMPIL=1 untuk memunculkan
    jendelanya, misalnya saat perlu login ulang atau menelusuri masalah.

    Catatan: dalam mode tanpa jendela, halaman tetap berstatus visible, jadi
    peristiwa tetikus sampai dengan benar — justru menghilangkan masalah tab
    tersembunyi yang menghantui mode berjendela.
    """
    if tampil is None:
        tampil = os.environ.get('EXACT_TAMPIL') in ('1', 'ya', 'true')
    if hidup(): return False
    os.makedirs(PROFIL, exist_ok=True)
    # Ukuran jendela WAJIB disetel: tanpa jendela, Chrome memakai 800x600 dan
    # tata letak Gemini jadi sempit — tombol berpindah tempat, sebagian elemen
    # tidak muncul sama sekali.
    bendera = [KROM, f'--remote-debugging-port={PORT}', f'--user-data-dir={PROFIL}',
               '--no-first-run', '--no-default-browser-check',
               '--window-size=1400,1000', '--remote-allow-origins=*']
    if not tampil: bendera.append('--headless=new')
    subprocess.Popen(bendera, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        time.sleep(0.5)
        if hidup(): return True
    raise GagalCDP('Chrome kendali tidak mau hidup di port 9222')

def matikan(tunggu=12):
    """Tutup Chrome kendali sampai benar-benar mati.

    Memuat ulang halaman tidak selalu cukup: kalau Gemini sudah kacau —
    sesi tersangkut, pekerja layanan basi, tab menggantung — keadaan itu
    bertahan melewati reload. Menutup Chrome-nya membuang semuanya, dan
    profilnya tetap di disk sehingga login Google tidak hilang.
    """
    if not hidup():
        return False
    # Polanya jalur profil saja, TANPA "--user-data-dir=" di depannya: pola
    # yang diawali tanda hubung dikira pkill sebagai opsi, bukan pola, sehingga
    # perintahnya gagal diam-diam dan Chrome tetap hidup.
    try:
        subprocess.run(['pkill', '-f', PROFIL], capture_output=True, timeout=10)
    except Exception:
        pass
    for _ in range(tunggu * 2):
        time.sleep(0.5)
        if not hidup():
            return True
    # masih hidup: paksa
    try:
        subprocess.run(['pkill', '-9', '-f', PROFIL], capture_output=True, timeout=10)
    except Exception:
        pass
    for _ in range(10):
        time.sleep(0.5)
        if not hidup():
            return True
    return False


def nyalakan_ulang(tampil=None):
    """Tutup Chrome kendali lalu nyalakan lagi dari keadaan bersih."""
    matikan()
    time.sleep(1.5)
    return nyalakan(tampil)


def daftar_tab():
    d = urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json', timeout=10).read()
    return [t for t in json.loads(d) if t.get('type') == 'page']

def cari_tab(potongan_url):
    for t in daftar_tab():
        if potongan_url in (t.get('url') or ''): return t
    return None

def buka_tab(url, paksa_baru=False):
    """Buka tab baru. Chrome baru menuntut metode PUT untuk /json/new.

    `paksa_baru` penting bila beberapa halaman berbagi host yang sama: mencocokkan
    host saja akan mengembalikan tab lain yang kebetulan sealamat, lalu perintah
    dijalankan di halaman yang salah.
    """
    if not paksa_baru:
        t = cari_tab(url.split('//')[-1].split('/')[0])
        if t: return t
    alamat = f'http://127.0.0.1:{PORT}/json/new?{urllib.parse.quote(url, safe=":/?&=")}'
    req = urllib.request.Request(alamat, method='PUT')
    d = urllib.request.urlopen(req, timeout=15).read()
    time.sleep(2)
    return json.loads(d)

class Sesi:
    """Satu sambungan ke satu tab."""
    def __init__(self, tab, timeout=180):
        self.ws = WS(tab['webSocketDebuggerUrl'], timeout=timeout)
        self.id = 0
    def perintah(self, metode, **param):
        self.id += 1
        self.ws.kirim(json.dumps({'id': self.id, 'method': metode, 'params': param}))
        while True:
            pesan = json.loads(self.ws.terima())
            if pesan.get('id') != self.id: continue        # lewati peristiwa
            if 'error' in pesan: raise GagalCDP(pesan['error'].get('message', 'galat CDP'))
            return pesan.get('result', {})
    def tunggu_peristiwa(self, nama, batas=15):
        """Tunggu satu peristiwa CDP, misalnya Page.fileChooserOpened.

        perintah() membuang semua peristiwa; pengunggahan berkas justru perlu
        membacanya, karena backendNodeId kotak pilih berkas hanya muncul di sana.
        """
        tenggat = time.time() + batas
        while time.time() < tenggat:
            sisa = tenggat - time.time()
            self.ws.sock.settimeout(max(0.5, min(sisa, 5)))
            try:
                pesan = json.loads(self.ws.terima())
            except Exception:
                continue
            if pesan.get('method') == nama:
                return pesan.get('params', {})
        return None

    def unggah_berkas(self, jalur, pemilih_pembuka=None, batas=20):
        """Serahkan berkas ke kotak unggah halaman tanpa dialog macOS.

        Input.dispatchMouseEvent pada tombol unggah biasanya memunculkan dialog
        berkas milik sistem yang tidak bisa disentuh dari CDP. Dengan
        Page.setInterceptFileChooserDialog, Chrome menahan dialog itu dan
        mengirim Page.fileChooserOpened berisi backendNodeId, sehingga berkas
        dapat disuntikkan lewat DOM.setFileInputFiles.
        """
        self.perintah('Page.enable')
        self.perintah('DOM.enable')
        self.perintah('Page.setInterceptFileChooserDialog', enabled=True)
        try:
            if pemilih_pembuka and not self.klik_elemen(pemilih_pembuka):
                return False
            ev = self.tunggu_peristiwa('Page.fileChooserOpened', batas)
            if not ev or 'backendNodeId' not in ev:
                return False
            self.perintah('DOM.setFileInputFiles',
                          files=[str(x) for x in (jalur if isinstance(jalur, (list, tuple)) else [jalur])],
                          backendNodeId=ev['backendNodeId'])
            return True
        finally:
            try: self.perintah('Page.setInterceptFileChooserDialog', enabled=False)
            except Exception: pass

    def unggah_ke_input(self, pemilih, jalur):
        """Suntikkan berkas ke sebuah input[type=file] yang sudah ada di DOM.

        Atribut accept hanya penyaring dialog sistem; DOM.setFileInputFiles
        melewatinya, jadi foto tetap masuk walau accept cuma menyebut dokumen.
        """
        self.perintah('DOM.enable')
        # pierce=True agar input yang bersembunyi di shadow DOM tetap terjangkau
        akar = self.perintah('DOM.getDocument', depth=-1, pierce=True)['root']['nodeId']
        try:
            nid = self.perintah('DOM.querySelector', nodeId=akar, selector=pemilih).get('nodeId')
        except Exception:
            nid = None
        if not nid:
            # jalur cadangan: cari lewat objek JS, lalu terjemahkan ke nodeId
            obj = self.perintah('Runtime.evaluate',
                                expression=f'document.querySelector({pemilih!r})'
                                ).get('result', {}).get('objectId')
            if not obj: return False
            nid = self.perintah('DOM.requestNode', objectId=obj).get('nodeId')
        if not nid: return False
        daftar = jalur if isinstance(jalur, (list, tuple)) else [jalur]
        self.perintah('DOM.setFileInputFiles',
                      files=[os.path.abspath(str(x)) for x in daftar], nodeId=nid)
        return True

    def ukuran(self, lebar=1400, tinggi=1000):
        """Setel ukuran viewport.

        Bendera --window-size tidak digubris pada mode tanpa jendela: Chrome
        tetap memakai 800x600, dan tata letak Gemini jadi sempit sehingga
        tombolnya berpindah atau hilang. Emulation.* bekerja di kedua mode.
        """
        try:
            self.perintah('Emulation.setDeviceMetricsOverride', width=lebar,
                          height=tinggi, deviceScaleFactor=1, mobile=False)
        except Exception:
            pass

    def evaluasi(self, ekspresi, tunggu_janji=False):
        r = self.perintah('Runtime.evaluate', expression=ekspresi, returnByValue=True,
                          awaitPromise=tunggu_janji)
        hasil = r.get('result', {})
        if r.get('exceptionDetails'):
            raise GagalCDP(str(r['exceptionDetails'].get('text', 'galat JavaScript'))[:200])
        return hasil.get('value')
    def buka(self, url):
        self.perintah('Page.enable')
        self.perintah('Page.navigate', url=url)
        time.sleep(2.5)
    def pdf(self, tujuan, margin_mm=(12, 11)):
        r = self.perintah('Page.printToPDF', printBackground=True,
                          paperWidth=8.27, paperHeight=11.69,
                          marginTop=margin_mm[0]/25.4, marginBottom=margin_mm[0]/25.4,
                          marginLeft=margin_mm[1]/25.4, marginRight=margin_mm[1]/25.4)
        open(tujuan, 'wb').write(base64.b64decode(r['data']))
        return tujuan
    # --- masukan TEPERCAYA -------------------------------------------------
    # Aplikasi seperti Gemini mengabaikan .click() dan KeyboardEvent buatan
    # JavaScript. Input.* dari DevTools dikirim di tingkat peramban, sehingga
    # tidak bisa dibedakan dari tangan manusia.
    def ketik(self, teks):
        self.perintah('Input.insertText', text=teks)

    def ketik_alami(self, pemilih, teks, potong=220, jeda=0.05, ekor=12):
        """Isi kotak seperti orang mengetik, bukan sekali tempel.

        Input.insertText memasukkan ribuan karakter dalam satu peristiwa —
        pola yang tidak mungkin dihasilkan tangan manusia. Di sini teksnya
        dipecah jadi potongan pendek berjeda, dan beberapa karakter TERAKHIR
        dikirim sebagai peristiwa papan tik sungguhan, supaya kejadian terakhir
        yang dilihat halaman sebelum tombol kirim ditekan adalah ketikan.

        Mengetik SELURUHNYA karakter demi karakter tidak dilakukan: perintah
        7.000 karakter akan memakan menit, dan itu jauh lebih mahal daripada
        masalah yang sedang dihindari.
        """
        self.evaluasi(f"""(function(){{
          const e = document.querySelector({pemilih!r});
          if (!e) return 0;
          e.focus();
          const r = document.createRange();
          r.selectNodeContents(e);
          const sel = window.getSelection();
          sel.removeAllRanges(); sel.addRange(r);
          return 1;
        }})()""")
        badan, sisa = (teks[:-ekor], teks[-ekor:]) if len(teks) > ekor else (teks, '')
        pertama = True
        for i in range(0, len(badan), potong):
            self.perintah('Input.insertText', text=badan[i:i + potong])
            if pertama:
                pertama = False          # potongan pertama MENGGANTI seleksi
            time.sleep(jeda)
        for c in sisa:
            self.perintah('Input.dispatchKeyEvent', type='keyDown', text=c,
                          unmodifiedText=c)
            self.perintah('Input.dispatchKeyEvent', type='keyUp', text=c,
                          unmodifiedText=c)
            time.sleep(0.03)
        return True

    def tombol(self, kunci='Enter', kode_vm=13):
        for jenis in ('keyDown', 'keyUp'):
            self.perintah('Input.dispatchKeyEvent', type=jenis, key=kunci,
                          code=kunci, windowsVirtualKeyCode=kode_vm,
                          nativeVirtualKeyCode=kode_vm)

    def ganti_isi_editor(self, pemilih, teks):
        """Ganti seluruh isi kotak contenteditable dengan teks baru.

        Menyetel innerHTML hanya mengubah DOM — kerangka seperti Gemini
        mengabaikannya, sehingga model internalnya menyimpan teks lama dan
        tombol kirim mati tanpa gejala. Cmd+A lewat Input.dispatchKeyEvent juga
        tidak bekerja: di macOS itu perintah tingkat peramban, bukan peristiwa
        papan tik, dan hanya menghapus satu huruf.

        Yang bekerja: seleksi lewat Selection API (murni menandai, bukan
        mengubah isi), lalu Input.insertText yang MENGGANTI seleksi itu melalui
        jalur masukan tepercaya.
        """
        self.evaluasi(f"""(function(){{
          const e = document.querySelector({pemilih!r});
          if (!e) return 0;
          e.focus();
          const r = document.createRange();
          r.selectNodeContents(e);
          const sel = window.getSelection();
          sel.removeAllRanges(); sel.addRange(r);
          return 1;
        }})()""")
        self.perintah('Input.insertText', text=teks)

    def ketik_alami(self, pemilih, teks, potong=220, jeda=0.05, ekor=12):
        """Isi kotak seperti orang mengetik, bukan sekali tempel.

        Input.insertText memasukkan ribuan karakter dalam satu peristiwa —
        pola yang tidak mungkin dihasilkan tangan manusia. Di sini teksnya
        dipecah jadi potongan pendek berjeda, dan beberapa karakter TERAKHIR
        dikirim sebagai peristiwa papan tik sungguhan, supaya kejadian terakhir
        yang dilihat halaman sebelum tombol kirim ditekan adalah ketikan.

        Mengetik SELURUHNYA karakter demi karakter tidak dilakukan: perintah
        7.000 karakter akan memakan menit, dan itu jauh lebih mahal daripada
        masalah yang sedang dihindari.
        """
        self.evaluasi(f"""(function(){{
          const e = document.querySelector({pemilih!r});
          if (!e) return 0;
          e.focus();
          const r = document.createRange();
          r.selectNodeContents(e);
          const sel = window.getSelection();
          sel.removeAllRanges(); sel.addRange(r);
          return 1;
        }})()""")
        badan, sisa = (teks[:-ekor], teks[-ekor:]) if len(teks) > ekor else (teks, '')
        pertama = True
        for i in range(0, len(badan), potong):
            self.perintah('Input.insertText', text=badan[i:i + potong])
            if pertama:
                pertama = False          # potongan pertama MENGGANTI seleksi
            time.sleep(jeda)
        for c in sisa:
            self.perintah('Input.dispatchKeyEvent', type='keyDown', text=c,
                          unmodifiedText=c)
            self.perintah('Input.dispatchKeyEvent', type='keyUp', text=c,
                          unmodifiedText=c)
            time.sleep(0.03)
        return True

    def klik_di(self, x, y):
        for jenis in ('mousePressed', 'mouseReleased'):
            self.perintah('Input.dispatchMouseEvent', type=jenis, x=x, y=y,
                          button='left', clickCount=1)

    def klik_elemen(self, pemilih):
        """Klik tepat di tengah elemen memakai peristiwa tetikus sungguhan."""
        kotak = self.evaluasi(f"""(function(){{
          const e = document.querySelector({pemilih!r});
          if(!e) return null;
          const r = e.getBoundingClientRect();
          return [r.left + r.width/2, r.top + r.height/2];
        }})()""")
        if not kotak: return False
        self.klik_di(kotak[0], kotak[1])
        return True

    def tutup(self): self.ws.tutup()

import urllib.parse
