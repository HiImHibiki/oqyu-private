#!/usr/bin/env python3
"""Penjaga: pastikan layanan benar-benar MELAYANI, bukan sekadar hidup.

KeepAlive milik launchd hanya melihat apakah prosesnya ada. Ia tidak bisa
membedakan proses sehat dari proses yang tersangkut — dan yang terakhir itu
justru yang pernah terjadi: launchd mencatat PID-nya hidup, port 7790 tidak
dijawab siapa pun, dan karena prosesnya "ada" ia tidak pernah dinyalakan ulang.
Penjaga ini menguji lewat HTTP, bukan lewat keberadaan proses.

Ditulis dengan Python, bukan zsh, karena alasan izin: proyeknya ada di
~/Documents yang dilindungi TCC macOS. /bin/zsh tidak boleh membaca berkas di
situ — gejalanya "can't open input file" — sedangkan /usr/bin/python3 sudah
diberi Full Disk Access, terbukti dari layanannya sendiri yang jalan dari sana.
"""
import os, subprocess, sys, time, urllib.request

LABEL = 'com.exactcourse.worksheet'
ALAMAT = 'http://127.0.0.1:7790/status'
TANDA = '/tmp/exact-penjaga-gagal'


def sehat(batas=8):
    try:
        urllib.request.urlopen(ALAMAT, timeout=batas).read(1)
        return True
    except Exception:
        return False


def catat(pesan):
    print(f"{time.strftime('%F %T')} {pesan}", flush=True)


def main():
    if sehat():
        if os.path.exists(TANDA):
            os.unlink(TANDA)
        return 0

    # Satu kegagalan belum tentu berarti sakit: layanan mungkin sedang
    # dinyalakan ulang, atau sedang sibuk merender PDF. Baru bertindak pada
    # kegagalan KEDUA berturut-turut, supaya tidak memutus pekerjaan yang
    # sebetulnya sedang berjalan.
    if not os.path.exists(TANDA):
        open(TANDA, 'w').close()
        catat('tidak menyahut — menunggu pemeriksaan berikutnya')
        return 0

    os.unlink(TANDA)
    catat('tidak menyahut dua kali — dinyalakan ulang')
    subprocess.run(['launchctl', 'kickstart', '-k', f'gui/{os.getuid()}/{LABEL}'],
                   capture_output=True, timeout=60)
    for i in range(1, 31):
        time.sleep(1)
        if sehat(3):
            catat(f'pulih setelah {i} detik')
            return 0
    catat('MASIH tidak menyahut setelah dinyalakan ulang')
    return 1


if __name__ == '__main__':
    sys.exit(main())
