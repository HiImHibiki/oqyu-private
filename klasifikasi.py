#!/usr/bin/env python3
"""Latih Naive Bayes dari dokumen yang sudah berlabel, lalu labeli sisanya.
Murni Python — tanpa pustaka luar, tanpa GPU."""
import os, re, sqlite3, math, random, unicodedata
from collections import defaultdict, Counter
DB = os.path.expanduser('~/ExactSearch/exact.db')

STOP = set('''yang dan di ke dari untuk pada dengan adalah ini itu atau tidak dalam akan
dapat oleh sebagai karena jika maka the of and to in a is for are be on as by with an at
or if then this that it from was were has have had not no dan nya nilai jawaban soal
adalah jawab pilihlah berikut bawah benar salah kunci halaman bab hal'''.split())

def tok(t):
    t = unicodedata.normalize('NFKC', t).lower()
    return [w for w in re.findall(r'[a-z][a-z\-]{2,20}', t) if w not in STOP]

class NB:
    def __init__(s, alpha=0.3): s.alpha=alpha; s.kelas=Counter(); s.kata=defaultdict(Counter); s.tot=Counter(); s.vocab=set()
    def latih(s, X, y):
        for teks, lab in zip(X, y):
            s.kelas[lab] += 1
            c = Counter(tok(teks))
            for w, n in c.items():
                s.kata[lab][w] += n; s.tot[lab] += n; s.vocab.add(w)
    def duga(s, teks):
        c = Counter(tok(teks)); V = len(s.vocab); N = sum(s.kelas.values())
        skor = {}
        for lab in s.kelas:
            lp = math.log(s.kelas[lab]/N)
            kd = s.kata[lab]; td = s.tot[lab]
            for w, n in c.items():
                if w in s.vocab:
                    lp += n * math.log((kd[w]+s.alpha)/(td+s.alpha*V))
            skor[lab] = lp
        if not skor: return None, 0.0
        urut = sorted(skor.items(), key=lambda x:-x[1])
        top = urut[0]
        m = top[1]
        z = sum(math.exp(v-m) for _, v in urut)
        return top[0], math.exp(0)/z          # peluang kelas teratas

def muat_teks(db):
    teks = defaultdict(list)
    for dok_id, no_hal, t in db.execute("SELECT dok_id, no_hal, teks FROM halaman"):
        if no_hal <= 5: teks[dok_id].append((no_hal, t))
    return {k: '\n'.join(t for _, t in sorted(v))[:20000] for k, v in teks.items()}

def kerjakan(db, teks, kolom, ambang):
    berlabel = db.execute(f"SELECT id,{kolom} FROM dokumen WHERE {kolom} IS NOT NULL AND n_hal_teks>0 AND dup_dari IS NULL").fetchall()
    data = [(teks[i], l) for i, l in berlabel if i in teks and len(teks[i]) > 200]
    if len(data) < 50: print(f"  {kolom}: data latih kurang"); return 0
    random.seed(42); random.shuffle(data)
    n_uji = max(40, len(data)//5)
    uji, latih = data[:n_uji], data[n_uji:]
    m = NB(); m.latih([x for x,_ in latih], [y for _,y in latih])
    benar = yakin = benar_yakin = 0
    for t, y in uji:
        p, c = m.duga(t)
        if p == y: benar += 1
        if c >= ambang:
            yakin += 1
            if p == y: benar_yakin += 1
    akur = 100*benar/len(uji)
    akur_y = 100*benar_yakin/yakin if yakin else 0
    print(f"  {kolom}: latih {len(latih)} · uji {len(uji)} · akurasi {akur:.0f}%"
          f" · pada yang yakin(≥{ambang:.2f}) {akur_y:.0f}% dari {100*yakin//len(uji)}% kasus")
    # latih ulang dengan seluruh data, lalu duga yang kosong
    m = NB(); m.latih([x for x,_ in data], [y for _,y in data])
    kosong = db.execute(f"SELECT id FROM dokumen WHERE {kolom} IS NULL AND n_hal_teks>0").fetchall()
    upd = []
    for (i,) in kosong:
        t = teks.get(i)
        if not t or len(t) < 200: continue
        p, c = m.duga(t)
        if p and c >= ambang: upd.append((p, round(c,3), i))
    db.executemany(f"UPDATE dokumen SET {kolom}=?, yakin_{kolom}=? WHERE id=?", upd)
    db.commit()
    print(f"    → {len(upd)} dokumen baru dilabeli")
    return len(upd)

def main():
    db = sqlite3.connect(DB)
    for k in ('mapel','jenis','jenjang'):
        try: db.execute(f'ALTER TABLE dokumen ADD COLUMN yakin_{k} REAL')
        except sqlite3.OperationalError: pass
    db.commit()
    print("membaca teks...", flush=True)
    teks = muat_teks(db)
    print(f"{len(teks)} dokumen berteks\n")
    print("melatih & menguji:")
    for kolom, ambang in (('mapel',0.90), ('jenis',0.90), ('jenjang',0.90)):
        kerjakan(db, teks, kolom, ambang)
    db.close()

if __name__ == '__main__': main()
