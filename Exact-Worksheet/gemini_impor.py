#!/usr/bin/env python3
"""Urai keluaran Gemini jadi soal terstruktur.

Keluaran Gemini sangat seragam (Q1:, a) b) c) d)), jadi sebagian besar bisa
diurai deterministik TANPA model bahasa. AI lokal hanya dipanggil kalau cara ini
gagal — lihat gemini_bantu_ai() di bawah.
"""
import re, json, subprocess, os

# Gemini memakai beberapa gaya penomoran; semuanya ditangani di sini.
# Dua pola, sengaja dipisah. Yang berawalan huruf (Q1, PG1, Soal 1) boleh tanpa
# tanda baca; yang polos WAJIB bertanda baca, kalau tidak setiap baris berangka
# ikut tertangkap.
AWAL_BERAWALAN = re.compile(r'^\s*(?:Q|Soal|No|Question|PG|PGN|Essay|Esai|Uraian)\s*'
                            r'(\d{1,3})\s*[.):]?\s*(.*)$', re.I)
AWAL_POLOS     = re.compile(r'^\s*(\d{1,3})\s*[.):]\s*(.*)$')

def _awal(b):
    m = AWAL_BERAWALAN.match(b) or AWAL_POLOS.match(b)
    return m
OPSI = re.compile(r'^\s*\(?([A-Ea-e])\s*[.)]\s*(.*)$')
LEWAT = re.compile(r'^\s*(Exact Course|Multiple Choice Questions?|Answer Key|Kunci Jawaban|'
                   r'Pilihan Ganda|Essay|Uraian|Jawaban|Formula|Question|'
                   r'SECTION [A-Z][^a-z]*)\s*:?\s*$', re.I)

def urai(teks):
    """Kembalikan (daftar_soal, catatan). Tiap soal: {no, batang, opsi}."""
    baris = [b.rstrip() for b in teks.replace('\r', '').split('\n')]
    soal, kini = [], None
    bagian_kunci = False
    for b in baris:
        if LEWAT.match(b):
            if re.match(r'^\s*(Answer Key|Kunci Jawaban)', b, re.I): bagian_kunci = True
            continue
        if bagian_kunci: continue
        m = _awal(b)
        if m and (not kini or int(m.group(1)) != kini['no']):
            if kini: soal.append(kini)
            kini = {'no': int(m.group(1)), 'batang': m.group(2).strip(), 'opsi': {}, '_op': None}
            continue
        if kini is None: continue
        mo = OPSI.match(b)
        if mo:
            h = mo.group(1).upper()
            kini['opsi'][h] = mo.group(2).strip(); kini['_op'] = h
        elif kini['_op']:
            kini['opsi'][kini['_op']] += ' ' + b.strip()
        elif b.strip():
            kini['batang'] += (' ' if kini['batang'] else '') + b.strip()
    if kini: soal.append(kini)
    for s in soal: s.pop('_op', None)
    bagus = [s for s in soal if len(s['batang']) >= 10]
    catatan = {'total': len(soal), 'layak': len(bagus),
               'pilihan_ganda': sum(1 for s in bagus if len(s['opsi']) >= 3)}
    return bagus, catatan

def dari_pdf(path):
    """Baca PDF Gemini: pangkat dipulihkan, kunci jawaban dipisahkan.

    Jalur lama (pdftotext -layout polos) meratakan x kuadrat jadi "x2" DAN
    membiarkan bagian kunci jawaban tertelan ke soal terakhir. Dua-duanya
    merusak hasil panen, jadi pembacaan dialihkan ke gemini_baca.
    """
    try:
        import gemini_baca
        teks, kunci = gemini_baca.baca(path)
        if teks.strip():
            soal, catatan = urai(teks)
            catatan['kunci'] = kunci
            for s in soal:
                if s.get('no') in kunci: s['kunci'] = kunci[s['no']]
            return soal, catatan
    except Exception:
        pass
    r = subprocess.run(['pdftotext', '-layout', '-enc', 'UTF-8', path, '-'],
                       capture_output=True, timeout=120)
    if r.returncode != 0: return [], {'total': 0, 'layak': 0, 'pilihan_ganda': 0}
    return urai(r.stdout.decode('utf-8', 'replace'))

ARAHAN_AI = (
 "Ubah naskah soal berikut menjadi JSON. Jangan menjawab soalnya, jangan mengubah "
 "kalimatnya, jangan menambah soal baru.\n"
 'Format: {"soal":[{"no":1,"batang":"...","opsi":{"A":"...","B":"..."}}]}\n'
 "Kalau soal tidak punya pilihan, isi opsi dengan objek kosong. "
 "Tulis rumus matematika sebagai LaTeX di antara tanda $.\n\nNASKAH:\n"
)

def gemini_bantu_ai(teks, model='qwen2.5:7b', api=None):
    """Cadangan bila urai() gagal: minta model lokal menstrukturkan.

    Dipakai HANYA kalau penguraian deterministik tidak menghasilkan apa-apa.
    Hasilnya tetap diverifikasi ulang, karena model bisa mengarang.
    """
    import urllib.request
    api = api or os.environ.get('EXACT_API') or 'http://localhost:11434/v1/chat/completions'
    badan = json.dumps({"model": model, "temperature": 0,
                        "options": {"num_ctx": 8192, "num_predict": 2500},
                        "response_format": {"type": "json_object"},
                        "messages": [{"role": "user", "content": ARAHAN_AI + teks[:12000]}]}).encode()
    req = urllib.request.Request(api, data=badan, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=300) as r:
        isi = json.loads(r.read())['choices'][0]['message']['content']
    try: d = json.loads(isi)
    except Exception:
        m = re.search(r'\{.*\}', isi, re.S)
        d = json.loads(m.group(0)) if m else {'soal': []}
    keluar = []
    for s in d.get('soal', []):
        b = str(s.get('batang', '')).strip()
        if len(b) < 10: continue
        op = {str(k).upper(): str(v) for k, v in (s.get('opsi') or {}).items()}
        keluar.append({'no': s.get('no'), 'batang': b, 'opsi': op})
    return keluar, {'total': len(keluar), 'layak': len(keluar),
                    'pilihan_ganda': sum(1 for s in keluar if len(s['opsi']) >= 3)}
