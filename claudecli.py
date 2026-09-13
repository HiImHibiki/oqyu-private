#!/usr/bin/env python3
"""Kirim perintah ke Claude lewat CLI-nya, sebagai ganti otomasi browser Gemini.

Bedanya dengan jalur Gemini bukan soal model, tapi soal lapisan yang dilewati.
Jalur Gemini harus mengendalikan Chrome: membuka menu unggah, mengklik tombol
kirim di koordinatnya, menunggu tulisan selesai, lalu memungut rumus dari
atribut data-math. Tiap lapisan itu pernah gagal sendiri-sendiri. Di sini tidak
ada satu pun dari itu — perintah masuk lewat stdin, jawaban keluar lewat stdout.

Memakai langganan Claude Pro milik Rico, bukan kunci API.
"""
import glob, os, subprocess

# Urutan pencarian: yang dipasang sendiri lebih dulu, salinan bawaan ekstensi
# VS Code paling belakang — jalurnya memuat nomor versi, jadi ia berpindah
# setiap ekstensinya diperbarui.
def _cari_biner():
    for j in ('claude',):
        d = subprocess.run(['which', j], capture_output=True).stdout.decode().strip()
        if d: return d
    for j in (os.path.expanduser('~/.claude/local/claude'),
              '/opt/homebrew/bin/claude', '/usr/local/bin/claude'):
        if os.path.isfile(j) and os.access(j, os.X_OK): return j
    pola = os.path.expanduser(
        '~/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude')
    ada = sorted(glob.glob(pola))
    return ada[-1] if ada else None


BINER = _cari_biner()


class TakAdaClaude(RuntimeError):
    pass


def tersedia():
    return bool(BINER)


# Spesifikasi format disimpan sebagai berkas di sini, bukan ikut dikirim pada
# tiap permintaan. Spesifikasi naskah soal saja 16.000 karakter; mengirimkannya
# berulang-ulang untuk tiap lembar itu pemborosan yang sia-sia. CLAUDE.md cuma
# menunjuk berkas mana yang harus dibaca untuk tiap jenis permintaan, jadi
# permintaan yang datang hanya membawa isian yang memang berbeda tiap lembar.
PROYEK = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'claude-proyek')

# Nama berkas spesifikasi per jenis permintaan.
FORMAT = {
    'soal': 'format-soal.md',
    'pembahasan': 'format-pembahasan.md',
    'rangkuman': 'format-rangkuman.md',
}


def tanya(perintah, lampiran=None, batas=600, format=None):
    """Kirim perintah, kembalikan jawabannya sebagai teks.

    format: 'soal' | 'pembahasan' | 'rangkuman' — menentukan berkas spesifikasi
    yang disuruh dibaca. Kalau None, perintahnya dikirim apa adanya.
    lampiran: daftar jalur berkas gambar/PDF yang dibaca Claude sendiri.
    """
    if not BINER:
        raise TakAdaClaude(
            'Claude CLI tidak ditemukan. Pasang dulu, atau pilih mesin Gemini.')

    isi = perintah
    if format in FORMAT:
        isi = (f'Ikuti spesifikasi di {FORMAT[format]} — baca berkas itu lebih '
               f'dulu. Balas hanya dengan naskahnya.\n\n' + isi)
    if lampiran:
        daftar = '\n'.join(f'- {os.path.abspath(x)}' for x in lampiran)
        isi = ('Baca berkas gambar/PDF berikut lebih dulu, lalu kerjakan '
               'permintaan di bawahnya:\n' + daftar + '\n\n' + perintah)

    # Dijalankan DI DALAM folder proyek supaya CLAUDE.md dan berkas
    # spesifikasinya terbaca. Perintahnya lewat stdin, bukan argumen: naskah
    # soal bisa ribuan karakter dan mengandung tanda kutip.
    argumen = [BINER, '-p', '--permission-mode', 'bypassPermissions',
               '--allowedTools', 'Read']
    o = subprocess.run(argumen, input=isi.encode('utf-8'),
                       capture_output=True, timeout=batas, cwd=PROYEK)
    keluar = o.stdout.decode('utf-8', 'replace').strip()
    if not keluar:
        galat = o.stderr.decode('utf-8', 'replace').strip()[:300]
        raise RuntimeError('Claude tidak menjawab' + (f': {galat}' if galat else ''))
    return keluar
