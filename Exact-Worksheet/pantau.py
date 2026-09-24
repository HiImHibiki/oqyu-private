#!/usr/bin/env python3
"""Pantau keluaran Gemini, langsung jadikan lembar kerja PDF.

Dua sumber, tanpa salin-tempel:
  1. BERKAS  — tekan Export di Gemini; PDF-nya mendarat di ~/Downloads, langsung diolah.
  2. PAPAN KLIP — cukup salin (Cmd+C) hasil Gemini; tidak perlu menempel ke mana pun.

Soal yang terbaca masuk ke bank soal, lalu PDF lembar kerjanya dibuka sendiri.
"""
import os, re, sys, time, json, sqlite3, subprocess, argparse, urllib.parse, urllib.request
import lokasi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gemini_impor

DB    = lokasi.data('exact.db')
KELUAR= os.path.expanduser(os.environ.get('EXACT_KELUAR') or '~/Desktop')
PORT  = 7790
CIRI  = re.compile(r'(^|\n)\s*(?:Q|PG|Soal|Question)?\s*\d{1,3}\s*[.):]', re.I)

def layak(teks):
    """Apakah teks ini kelihatan seperti naskah soal?

    Jangan syaratkan adanya pilihan ganda: setelah bagian kunci jawaban dipotong,
    naskah berisi soal uraian saja tidak punya baris a) b) c) sama sekali dan
    akan tertolak padahal sah.
    """
    if len(teks) < 120: return False
    n_soal = len(CIRI.findall(teks))
    n_opsi = len(re.findall(r'^\s*\(?[a-eA-E]\s*[.)]\s+\S', teks, re.M))
    return (n_soal >= 3 and n_opsi >= 4) or n_soal >= 3 and len(teks) > 300

BUKAN_JUDUL = re.compile(r'^(exact course|multiple choice|formulas?|questions?|answer key|'
                         r'kunci jawaban|pilihan ganda|section\b|essays?|uraian|catatan)\b', re.I)

def judul_dari(teks, asal):
    """Nama berkas lebih dipercaya daripada baris pertama isi.

    Ekspor Gemini diberi nama menurut topik percakapan ("Algebra Problems
    Completing Square"), sedangkan baris pertama isinya sering berupa kepala
    bagian seperti "Formulas" atau "Exact Course" yang tidak menjelaskan apa pun.
    """
    nama = os.path.splitext(os.path.basename(asal))[0]
    nama = re.sub(r'\s*[-–]\s*Google Gemini.*$', '', nama, flags=re.I)
    nama = re.sub(r'\s*\[[0-9a-f]{6,}\]\s*$', '', nama).strip()
    if len(nama) >= 6 and not BUKAN_JUDUL.match(nama): return nama[:60]
    for x in [x.strip() for x in teks.split('\n') if x.strip()][:8]:
        if 6 < len(x) < 70 and not CIRI.match(x) and not re.match(r'^\(?[a-eA-E][.)]', x) \
           and not BUKAN_JUDUL.match(x):
            return x[:60]
    return nama[:60] or 'Latihan'

ISYARAT_SOAL = re.compile(r'\?|\.\.\.|…|\badalah\b|\bberapa\b|\bhitung|\btentukan\b|'
                          r'\bjelaskan\b|\bcari\b|\bfind\b|\bcalculate\b|\bwhat\b|'
                          r'\bwhich\b|\bhow\b|\bexpress\b|\bsolve\b|\bwrite\b', re.I)

def masuk_akal(s):
    """Saring keluaran AI: blok rumus dan kepala bagian sering dikira soal."""
    b = (s.get('batang') or '').strip()
    if len(b.split()) < 5: return False
    if re.match(r'^\s*(formulas?|exact course|answer keys?|section\b)', b, re.I): return False
    return bool(ISYARAT_SOAL.search(b)) or len(s.get('opsi') or {}) >= 3

def rapikan_ai(teks, model, api):
    """Cadangan: minta model lokal menstrukturkan bila pengurai gagal."""
    try:
        soal, _ = gemini_impor.gemini_bantu_ai(teks, model=model, api=api)
        return soal
    except Exception as e:
        print(f"    AI lokal tidak terpakai ({type(e).__name__})", flush=True)
        return []

def simpan(soal, judul, mapel, kelas):
    c = sqlite3.connect(DB, timeout=60)
    potongan = re.sub(r'\W+', '-', judul)[:40]
    rel = f"IMPOR/{int(time.time())}-{potongan}"
    cur = c.execute("""INSERT INTO dokumen(rel,nama,folder,mapel,kelas,jenis,n_hal,n_hal_teks)
                       VALUES(?,?,'IMPOR',?,?,'Impor Gemini',1,1)""",
                    (rel, judul, mapel or None, kelas or None))
    dok = cur.lastrowid; ids = []
    for i, s in enumerate(soal, 1):
        cc = c.execute("""INSERT INTO soal(dok_id,no_hal,no_soal,batang,opsi,n_opsi,sidik,mutu,dup)
                          VALUES(?,1,?,?,?,?,NULL,?,0)""",
                       (dok, s.get('no') or i, s['batang'],
                        json.dumps(s['opsi'], ensure_ascii=False), len(s['opsi']),
                        2 if len(s['opsi']) >= 3 else 1))
        ids.append(cc.lastrowid)
    c.executemany("INSERT INTO soal_fts(batang,opsi,soal_id) SELECT batang,opsi,id FROM soal WHERE id=?",
                  [(i,) for i in ids])
    c.commit(); c.close()
    return ids

def jadikan_pdf(ids, judul):
    os.makedirs(KELUAR, exist_ok=True)
    q = '&'.join(f'id={i}' for i in ids) + '&judul=' + urllib.parse.quote(judul) + '&kunci=1'
    nama = re.sub(r'[^\w -]', '', judul).strip()[:60] or 'Lembar'
    tuju = os.path.join(KELUAR, f"{nama} — {time.strftime('%Y-%m-%d %H%M')}.pdf")
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{PORT}/lembar.pdf?{q}', timeout=180) as r:
            d = r.read()
    except Exception as e:
        print(f"    gagal membuat PDF: {e}", flush=True); return None
    open(tuju, 'wb').write(d)
    return tuju

def olah(teks, asal, a, kunci=None):
    soal, catatan = gemini_impor.urai(teks)
    lewat_ai = False
    # AI lokal hanya dipanggil kalau pengurai TIDAK MENGHASILKAN APA PUN.
    # Diukur: pada naskah yang terurai 2 soal bersih, AI mengembalikan 4 "soal"
    # yang satu di antaranya blok rumus utuh. Cadangan yang memperburuk itu
    # lebih berbahaya daripada tidak ada cadangan.
    if not soal and a.api:
        print("    pengurai gagal total — meminta bantuan AI lokal", flush=True)
        calon = rapikan_ai(teks, a.model, a.api)
        calon = [c for c in calon if masuk_akal(c)]
        if len(calon) > len(soal): soal, lewat_ai = calon, True
    if len(soal) < 2:
        print(f"    dilewati: hanya {len(soal)} soal terbaca", flush=True); return
    judul = a.judul or judul_dari(teks, asal)
    ids = simpan(soal, judul, a.mapel, a.kelas)
    pdf = jadikan_pdf(ids, judul)
    pg = sum(1 for s in soal if len(s['opsi']) >= 3)
    print(f"    {len(soal)} soal ({pg} pilihan ganda){' · lewat AI lokal' if lewat_ai else ''}", flush=True)
    if pdf:
        print(f"    -> {pdf}", flush=True)
        subprocess.run(['open', pdf], capture_output=True)
        subprocess.run(['osascript', '-e',
            f'display notification "{len(soal)} soal siap" with title "Lembar Kerja dibuat"'],
            capture_output=True)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--folder', default=os.path.expanduser('~/Downloads'))
    ap.add_argument('--papan-klip', action='store_true', dest='klip', default=True)
    ap.add_argument('--tanpa-papan-klip', action='store_false', dest='klip')
    ap.add_argument('--mapel', default=None); ap.add_argument('--kelas', type=int, default=None)
    ap.add_argument('--judul', default=None)
    ap.add_argument('--model', default='qwen2.5:7b')
    ap.add_argument('--api', default=os.environ.get('EXACT_API'))
    a = ap.parse_args()

    print(f"Memantau: {a.folder}" + ("  + papan klip" if a.klip else ""))
    print(f"Keluaran: {KELUAR}")
    print(f"AI lokal: {a.api or '(belum tersedia — pengurai saja)'}\n", flush=True)

    lihat = {f for f in os.listdir(a.folder)} if os.path.isdir(a.folder) else set()
    klip_lama = subprocess.run(['pbpaste'], capture_output=True).stdout.decode('utf-8','replace') if a.klip else ''
    while True:
        try:
            if os.path.isdir(a.folder):
                kini = set(os.listdir(a.folder))
                for f in sorted(kini - lihat):
                    p = os.path.join(a.folder, f)
                    if not os.path.isfile(p) or not f.lower().endswith(('.pdf','.txt','.md')): continue
                    time.sleep(1.5)                       # tunggu unduhan tuntas
                    print(f"[berkas] {f}", flush=True)
                    kunci = {}
                    if f.lower().endswith('.pdf'):
                        # Pakai pembaca khusus: memulihkan pangkat dan memotong
                        # bagian kunci jawaban. pdftotext biasa meratakan x kuadrat
                        # jadi "x2" dan membiarkan kunci tertelan ke soal terakhir.
                        import gemini_baca
                        teks, kunci = gemini_baca.baca(p)
                        if not teks.strip():
                            r = subprocess.run(['pdftotext','-layout',p,'-'],
                                               capture_output=True, timeout=120)
                            teks = r.stdout.decode('utf-8','replace')
                    else:
                        teks = open(p, encoding='utf-8', errors='replace').read()
                    if layak(teks): olah(teks, p, a, kunci)
                    else: print("    bukan naskah soal, dilewati", flush=True)
                lihat = kini
            if a.klip:
                k = subprocess.run(['pbpaste'], capture_output=True).stdout.decode('utf-8','replace')
                if k != klip_lama:
                    klip_lama = k
                    if layak(k):
                        print("[papan klip] naskah soal terdeteksi", flush=True)
                        olah(k, 'papan-klip', a, {})
            time.sleep(2)
        except KeyboardInterrupt:
            print("\ndihentikan"); return
        except Exception as e:
            print(f"  ! {type(e).__name__}: {e}", flush=True); time.sleep(3)

if __name__ == '__main__': main()
