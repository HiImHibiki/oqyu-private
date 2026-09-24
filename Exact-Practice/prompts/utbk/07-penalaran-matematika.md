# PROMPT — UTBK-SNBT: Penalaran Matematika

*System prompt:* `prompts/_shared/system.md`. `locale: "id"`, `exam: "UTBK"`, `section: "utbk_pm"`.

---

Buat **{{JUMLAH}} soal** Penalaran Matematika. Subtes ini 20 soal / ~42 menit — rata-rata
**125 detik per soal**, jadi soalnya boleh panjang dan berlapis. **Tanpa kalkulator.**

## Perbedaan penting dari Pengetahuan Kuantitatif

PK menguji kecepatan manipulasi. **Penalaran Matematika menguji pemodelan**: siswa diberi situasi
nyata yang panjang, lalu harus memutuskan sendiri model matematika mana yang berlaku. Karena itu:

- **Setiap soal wajib punya konteks nyata** — tarif, dosis obat, denah, produksi, konsumsi listrik,
  cicilan, resep masakan, jadwal transportasi, data sensor.
- **Satu stimulus dipakai 2–3 soal** yang menggali aspek berbeda dari situasi yang sama.
- Sertakan `figure` (`table`, `bar_chart`, `line_chart`, `geometry`) pada sebagian besar soal.

## Domain, skill, dan porsi

| `domain` | `skill` | porsi |
|---|---|---|
| `Bilangan` | `Representasi bilangan`, `Operasi kontekstual`, `Rasio & proporsi` | 20% |
| `Aljabar` | `Pemodelan persamaan`, `Fungsi kontekstual`, `Sistem persamaan` | 30% |
| `Geometri dan Pengukuran` | `Bangun & volume kontekstual`, `Skala & denah`, `Trigonometri terapan` | 25% |
| `Data dan Ketidakpastian` | `Analisis data nyata`, `Peluang kontekstual`, `Inferensi sederhana` | 25% |

## Tipe soal

- `mcq_single`, **5 opsi** `A`–`E`
- `spr_numeric` — isian angka, sekitar 25% soal
- `true_false_multi` — 3–4 pernyataan tentang situasi yang sama
- `table_grid` — mis. "Kesimpulan ini didukung / tidak didukung data"
- `calculatorAllowed: false`, `formulaRefs: ["utbk_math"]` bila relevan

## Pola soal yang harus ada

1. **Fungsi bertahap** (tarif parkir, tarif listrik berjenjang, pajak progresif).
2. **Perbandingan senilai/berbalik nilai** dalam konteks pekerja-waktu atau kecepatan-jarak.
3. **Skala denah** — luas sebenarnya dari denah berskala, atau menghitung kebutuhan material.
4. **Membaca data lalu menilai klaim** — "Berdasarkan tabel, manakah klaim yang didukung data?"
5. **Model linear vs eksponensial** — mana yang lebih cocok untuk pola data yang diberikan.
6. **Volume dan konversi satuan** — tangki, kemasan, laju aliran.

## Aturan mutu khusus

1. Konteks harus **realistis secara angka**: harga masuk akal, tarif masuk akal, ukuran masuk akal.
2. Meski konteksnya panjang, **hitungannya tetap harus tanpa kalkulator**. Rancang angkanya dulu,
   baru bungkus dengan cerita.
3. Setiap soal harus memaksa satu keputusan pemodelan. Kalau siswa bisa langsung memasukkan angka ke
   rumus tanpa berpikir, soal itu milik PK, bukan Penalaran Matematika.
4. `explanation` memperlihatkan **model yang dibangun** lebih dulu (mis. "Biaya $= 5 + 3(t-1)$ ribu
   untuk $t \ge 1$"), baru penyelesaiannya.
5. Untuk `true_false_multi` berbasis data, minimal satu pernyataan harus salah karena **melampaui
   apa yang bisa disimpulkan** dari data (bukan karena salah hitung).

---

**Parameter**: `{{JUMLAH}}`, `{{KONTEKS}}` — tema situasi, `{{DOMAIN}}` *(opsional)*, `{{TINGKAT}}`.
