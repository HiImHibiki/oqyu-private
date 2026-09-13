#!/bin/bash
# Nyalakan ulang layanan LEWAT launchd, bukan dengan pkill.
#
# Alasannya izin, bukan kerapian. macOS memberi akses Desktop berdasarkan
# proses yang bertanggung jawab. Layanan yang dijalankan launchd punya izin itu;
# proses python yang dijalankan tangan dari terminal lain TIDAK. Kalau layanan
# dimatikan dengan pkill lalu ada python lain yang lebih dulu merebut port 7790,
# penjaga "satu proses saja" membuat layanan resmi justru menyerah — dan yang
# melayani adalah proses tanpa izin. Gejalanya menyesatkan: halaman hasil bilang
# "Belum ada lembar" padahal ada ratusan berkas di Desktop.
set -e
LABEL=com.exactcourse.worksheet
launchctl kickstart -k "gui/$(id -u)/$LABEL"
for i in $(seq 1 20); do
  sleep 1
  if curl -sf -m 3 http://127.0.0.1:7790/status >/dev/null 2>&1; then
    # grep -c menghitung BARIS, sedangkan seluruh kartu ada di satu baris
    n=$(curl -s -m 20 http://127.0.0.1:7790/hasil | grep -o 'class=kartu' | wc -l | tr -d ' ')
    echo "Layanan jalan. Lembar terbaca: $n"
    [ "$n" -eq 0 ] && echo "PERINGATAN: nol lembar — periksa /diag, mungkin izin Desktop." >&2
    exit 0
  fi
done
echo "Layanan tidak menyahut dalam 20 detik." >&2
exit 1
