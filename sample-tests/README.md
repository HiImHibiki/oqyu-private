# Sample test — 42 soal orisinal

Soal contoh untuk keempat ujian, ditulis mengikuti spesifikasi resmi yang terverifikasi di
[`src/lib/exams/reference.ts`](../src/lib/exams/reference.ts). Seluruhnya **lolos validator** dan
sudah diimpor ke bank soal berstatus `approved`, jadi langsung bisa dikerjakan di aplikasi.

| Berkas | Soal | Cakupan |
|---|---|---|
| `sat-sample.json` | 10 | R&W 5 (4 domain), Math 5 (4 domain) — termasuk 1 isian grid-in, 1 bar chart, 1 scatter |
| `utbk-sample.json` | 12 | ketujuh subtes; termasuk true/false, matriks centang, isian angka, grafik garis |
| `csca-sample.json` | 12 | Math 4, Physics 3, Chemistry 3, STEM Chinese 1, Humanities Chinese 1 — **semuanya bilingual** |
| `alevel-sample.json` | 8 | 9709 P1 (2), 9702 P2 (2), 9701 P1 (3), 9708 P2 (1) — termasuk 3 rubrik mark scheme |

## Ini soal orisinal, bukan salinan past paper

Setiap soal ditulis dari nol mengikuti struktur, bobot domain, alokasi waktu, dan gaya pertanyaan
resmi tiap ujian. Tidak ada satu pun kalimat yang disalin dari soal SAT, past paper Cambridge,
maupun soal UTBK — itu berhak cipta, dan menyalinnya ke produk komersial adalah pelanggaran.

Yang **ditiru** adalah hal yang memang boleh ditiru dan justru paling menentukan:

- **Struktur**: SAT Math 15 PG + 7 isian per modul; CSCA seluruhnya PG 4 opsi tanpa kalkulator;
  A Level dinilai per langkah dengan kode M/A/B.
- **Gaya pertanyaan**: kalimat perintah baku (`Which choice completes the text...`, `Show that...`,
  `Discuss whether...`, `Simpulan yang pasti benar adalah ...`).
- **Distraktor**: setiap opsi salah lahir dari satu kesalahan berpikir nyata, dan alasannya ditulis
  di `distractorRationale`.
- **Beban waktu**: `estimatedTimeSec` mengikuti rata-rata detik per soal ujian aslinya.

## Contoh soal yang sengaja dirancang menjebak

Beberapa soal di sini menargetkan kesalahan yang paling sering menjatuhkan siswa:

- **`sat-sample-rw-02`** — bukti kuantitatif. Salah satu distraktor benar secara aritmetika
  (total 50 → 77) tetapi tidak membuktikan klaim tentang **setiap** situs.
- **`utbk-sample-ppu-01`** — *serampangan*. Distraktor *tergesa-gesa* menyoroti kecepatan, padahal
  konteks menunjuk ketiadaan perhitungan.
- **`csca-sample-chem-02`** — Le Chatelier gaya kombinasi pernyataan Tiongkok. Menguji pembedaan
  pengaruh katalis terhadap **laju** dan terhadap **posisi kesetimbangan**.
- **`csca-sample-zhhum-01`** — 反映 vs 反应, dua kata berbunyi identik (fǎnyìng) yang paling sering
  tertukar dalam tulisan akademik mahasiswa asing.
- **`al-sample-econ-01`** — datanya sengaja memuat kenaikan 9% jus tak dikenai pajak, sehingga
  jawaban yang berhenti di "penjualan turun 14%, jadi efektif" tidak menembus AO4.

## Memakainya

Sudah diimpor. Untuk mengimpor ulang setelah `.data/` dihapus:

```bash
for f in sat utbk csca alevel; do
  npm run import sample-tests/$f-sample.json -- --status approved
done
```

Atau lewat panel: `/admin/soal` → *Impor soal dari JSON* → tempel isi berkasnya.

## Batas yang perlu kamu tahu

Validator memeriksa struktur, bukan kebenaran matematis kunci jawaban. Saya sudah menghitung ulang
setiap kunci, tetapi **sebelum dipakai untuk siswa berbayar**, jalankan
[`prompts/_shared/review.md`](../prompts/_shared/review.md) dengan model kedua dan mintalah guru mata
pelajaran memeriksanya — terutama soal 中文, yang menuntut penilaian penutur asli.

42 soal ini adalah **contoh mutu**, bukan bank soal produksi. Target minimum untuk berjualan ada di
[`docs/SETUP.md`](../docs/SETUP.md#5-isi-bank-soal).
