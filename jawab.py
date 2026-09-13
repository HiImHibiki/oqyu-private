#!/usr/bin/env python3
"""Tab Jawaban: foto soal anak → kunci jawaban + pembahasan → PDF siap cetak.

Berbeda dari tab Buat: di sini soalnya TIDAK dikarang. Soal disalin apa adanya
dari foto, lalu diberi kunci dan pembahasan langkah demi langkah.
"""

PERINTAH = """Kamu diberi naskah soal hasil pemindaian foto. Tugasmu BUKAN membuat soal baru.

Tulis ulang SETIAP soal PERSIS seperti aslinya, lalu berikan kunci jawaban dan
pembahasan langkah demi langkah untuk masing-masing.

Aturan penulisan, ikuti persis:

1. Baris pertama: judul singkat, tanpa label.

2. Tiap bagian diawali "Bagian [Nama]: (KODE)" dengan KODE salah satu dari
   (PG) pilihan ganda, (B) benar/salah, (I) isian singkat, (E) uraian.

3. Penomoran soal memakai kode bagiannya: "PG1.", "B1.", "I1.", "E1.".
   Pilihan jawaban di baris sendiri: "A. ...", "B. ...", dan seterusnya.

4. Rumus matematika, fisika, atau kimia WAJIB dibungkus tanda dolar $...$,
   termasuk di pilihan jawaban, kunci, dan pembahasan.

5. Kalau soal punya gambar, grafik, atau tabel yang tidak terbaca dari foto,
   tulis [GAMBAR: keterangan singkat] di posisinya — jangan melewatkan soalnya.

6. Kalau ada bagian yang tidak terbaca jelas dari foto, tulis apa adanya lalu
   tambahkan "(tidak terbaca jelas)" — JANGAN mengarang isinya.

7. Setelah semua soal, tulis kunci jawaban PERSIS begini, satu paragraf
   mengalir, kode diikuti TANDA HUBUNG lalu jawabannya:
Kunci Jawaban
PG1-B, PG2-A, I1-12, E1-[jawaban ringkas]

8. Lalu pembahasan dengan format sama, tunjukkan LANGKAHNYA bukan hanya hasil:
Pembahasan
PG1-[langkah dan alasannya]PG2-[langkah dan alasannya]

Jangan memakai markdown (tanpa **tebal**, tanpa #, tanpa daftar bertanda -).
Bahasa: {bahasa}.
{catatan}
NASKAH HASIL PEMINDAIAN:
{naskah}"""

def bangun(naskah, bahasa='Indonesia', catatan='', mapel='', kelas=''):
    tambahan = []
    if mapel: tambahan.append(f'Mata pelajaran: {mapel}.')
    if kelas: tambahan.append(f'Jenjang: {kelas}.')
    if catatan.strip(): tambahan.append(catatan.strip())
    ket = ('\n' + ' '.join(tambahan) + '\n') if tambahan else '\n'
    return PERINTAH.format(bahasa=bahasa, catatan=ket, naskah=naskah.strip()[:9000])
