# PROMPT — UTBK-SNBT: Pengetahuan dan Pemahaman Umum (PPU)

*System prompt:* `prompts/_shared/system.md`. `locale: "id"`, `exam: "UTBK"`, `section: "utbk_ppu"`.

---

Buat **{{JUMLAH}} soal** PPU. Subtes ini 20 soal / 15 menit — rata-rata **45 detik per soal**.
Ini subtes tercepat; soalnya harus bisa dijawab dari pengetahuan kebahasaan langsung, bukan dari
analisis panjang.

## Domain, skill, dan porsi

| `domain` | `skill` | porsi |
|---|---|---|
| `Kemampuan Verbal` | `Sinonim & antonim`, `Makna kata dalam konteks`, `Analogi kata`, `Idiom` | 40% |
| `Pemahaman Wacana` | `Ide pokok`, `Simpulan`, `Informasi tersurat/tersirat` | 35% |
| `Pengetahuan Kebahasaan` | `Kalimat efektif`, `Ejaan & PUEBI`, `Kata baku` | 25% |

## Tipe soal

- `mcq_single`, **5 opsi** `A`–`E`.
- `true_false_multi` untuk soal berbasis paragraf pendek.
- `calculatorAllowed: false`.
- `estimatedTimeSec` 30–60.

## Pola soal yang harus ada

- **Makna kata dalam konteks**: satu kalimat/paragraf pendek dengan kata bercetak tebal; opsi berupa
  padanan yang semuanya masuk akal di luar konteks tetapi hanya satu yang tepat di dalam konteks.
- **Analogi**: hubungan harus jelas dan tunggal — bagian-keseluruhan, alat-fungsi, sebab-akibat,
  pelaku-tempat kerja. Hindari analogi asosiatif longgar.
- **Kalimat efektif**: kalimat dengan satu cacat spesifik (pemborosan, subjek ganda, konjungsi
  bertumpuk, ketidaksejajaran bentuk). Opsi lain memperbaiki hal yang salah atau memperkenalkan
  cacat baru.
- **Ejaan & PUEBI**: penulisan gabungan kata, kata depan `di`/`ke`, huruf kapital nama geografi,
  penulisan angka dan bilangan, gelar, kata serapan.
- **Kata baku**: pasangan yang sering keliru — `praktik/praktek`, `analisis/analisa`, `izin/ijin`,
  `risiko/resiko`, `sekretaris/sekertaris`, `nomor/nomer`, `sistem/sistim`, `karier/karir`.
- **Ide pokok / simpulan**: paragraf 60–110 kata; opsi salah berupa detail pendukung yang benar tapi
  bukan ide pokok, atau simpulan yang melampaui isi teks.

## Aturan mutu khusus PPU

1. Untuk soal ejaan, hanya **satu** aspek yang diuji per soal, agar diagnosisnya jelas.
2. Untuk sinonim/antonim, jangan memakai kata yang punya lebih dari satu padanan kuat di antara opsi.
3. `explanation` harus mengutip aturan yang berlaku (mis. "PUEBI: kata depan *di* ditulis terpisah
   dari kata yang mengikutinya bila menyatakan tempat").
4. Paragraf wacana harus bertema ilmu pengetahuan, sosial, budaya, atau lingkungan — bukan opini
   politik.

---

**Parameter**: `{{JUMLAH}}`, `{{DOMAIN}}` *(opsional)*, `{{TINGKAT}}`.
