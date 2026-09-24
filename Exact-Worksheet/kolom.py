#!/usr/bin/env python3
"""Deteksi kolom N-arah lewat pengelompokan jurang.

Versi lama memotong halaman SEKALI di tengah, jadi naskah 3-5 kolom membuat
opsi beberapa soal berbeda menempel jadi satu. Versi ini mencari SEMUA celah
kosong vertikal dari sebaran posisi x yang sebenarnya.
"""
def cari_kolom(W, baris, min_baris=3):
    """Kembalikan daftar batas-x kolom. [] bila halaman satu kolom.

    Memakai LEMBAH KERAPATAN, bukan celah kosong mutlak: satu baris kepala
    selebar halaman sudah cukup menutup celah sejati, sehingga pencarian bin
    yang benar-benar kosong selalu gagal pada naskah ujian sungguhan.
    """
    if len(baris) < 8: return []
    n_bin = 300
    skala = n_bin / W
    hitung = [0] * n_bin
    for b in baris:
        a = max(0, min(n_bin-1, int(b['x0']*skala)))
        z = max(0, min(n_bin-1, int(b['x1']*skala)))
        for i in range(a, z+1): hitung[i] += 1
    puncak = max(hitung)
    if puncak < 4: return []
    ambang = max(1, puncak * 0.12)           # lembah = kerapatan sangat rendah
    tepi_kiri  = next((i for i, v in enumerate(hitung) if v > ambang), 0)
    tepi_kanan = next((i for i in range(n_bin-1, -1, -1) if hitung[i] > ambang), n_bin-1)
    min_lebar = max(2, int(0.015 * n_bin))
    calon, i = [], tepi_kiri
    while i <= tepi_kanan:
        if hitung[i] <= ambang:
            j = i
            while j <= tepi_kanan and hitung[j] <= ambang: j += 1
            if j - i >= min_lebar: calon.append((i + j) / 2 / skala)
            i = j
        else: i += 1
    sah = []
    for x in calon:
        ka = sum(1 for b in baris if b['x1'] <= x)
        ki = sum(1 for b in baris if b['x0'] >= x)
        if ka >= min_baris and ki >= min_baris: sah.append(x)
    return sah

# Catatan: pengelompokan TITIK AWAL baris pernah dicoba sebagai cara kedua untuk
# naskah padat rumus (tempat lembah kerapatan gagal). Diukur dan DIBUANG: ia
# memecah kolom di tempat yang salah pada halaman yang tadinya benar — opsi bersih
# jatuh 39% -> 28%. Jangan dicoba lagi tanpa cara validasi yang lebih baik.

def urutkan_kolom(W, baris):
    """Susun baris jadi urutan baca yang benar. Kembalikan (daftar_teks, n_kolom)."""
    if len(baris) < 8:
        return [b['t'] for b in sorted(baris, key=lambda b: b['y'])], 1
    batas = cari_kolom(W, baris)
    if not batas:
        return [b['t'] for b in sorted(baris, key=lambda b: (b['y'], b['x0']))], 1

    lebar_teks = max(b['x1'] for b in baris) - min(b['x0'] for b in baris)

    def kolom_dari(b):
        """Nomor kolom baris ini, atau None bila ia benar-benar selebar halaman.

        Baris yang cuma menjorok sedikit melewati batas JANGAN dijadikan pemisah
        pita — itu memecah kolom dan memutus rantai nomor soal. Ia dimasukkan ke
        kolom terdekat menurut titik tengahnya.
        """
        if (b['x1'] - b['x0']) >= 0.6 * lebar_teks: return None      # kepala/gambar lebar
        tengah = (b['x0'] + b['x1']) / 2
        k = 0
        for x in batas:
            if tengah < x: return k
            k += 1
        return k

    silang = [b for b in baris if kolom_dari(b) is None]
    isi = {}
    for b in baris:
        k = kolom_dari(b)
        if k is not None: isi.setdefault(k, []).append(b)
    if len(isi) < 2:
        return [b['t'] for b in sorted(baris, key=lambda b: (b['y'], b['x0']))], 1

    pemisah = sorted(b['y'] for b in silang) + [float('inf')]
    hasil, mulai = [], float('-inf')
    for y in pemisah:
        for k in sorted(isi):
            hasil += [b['t'] for b in sorted(isi[k], key=lambda b: b['y']) if mulai <= b['y'] < y]
        hasil += [b['t'] for b in silang if b['y'] == y]
        mulai = y
    return hasil, len(isi)
