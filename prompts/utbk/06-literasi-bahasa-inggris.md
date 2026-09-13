# PROMPT — UTBK-SNBT: Literasi dalam Bahasa Inggris

*System prompt:* `prompts/_shared/system.md`. `locale: "id"`, `exam: "UTBK"`, `section: "utbk_lbe"`.

> Catatan bahasa: **bacaan dan pertanyaan ditulis dalam bahasa Inggris**, tetapi field `locale`
> tetap `"id"` karena subtes ini bagian dari paket UTBK berbahasa Indonesia. `explanation` ditulis
> dalam **bahasa Indonesia** agar pembahasannya berguna bagi siswa.

---

Buat **{{JUMLAH}} soal**. Subtes ini 20 soal / 20 menit — rata-rata **60 detik per soal**.

## Bentuk khas

Satu teks untuk 3–4 soal. Panjang 200–350 kata, tingkat kebahasaan **CEFR B1–B2** (bukan C1).
Kosakata di luar B2 harus bisa disimpulkan dari konteks.

## Domain, skill, dan porsi

| `domain` | `skill` | porsi |
|---|---|---|
| `Informational Text` | `Locating information`, `Interpreting & integrating`, `Evaluating & reflecting` | 60% |
| `Literary Text` | `Locating information`, `Interpreting & integrating`, `Evaluating & reflecting` | 40% |

## Tipe soal

- `mcq_single`, **5 opsi** `A`–`E`, teks opsi dalam bahasa Inggris.
- `true_false_multi` dengan pernyataan berbahasa Inggris.
- `calculatorAllowed: false`.

## Pola pertanyaan

- `What is the main idea of the passage?`
- `The word "..." in line ... is closest in meaning to ...`
- `Which of the following can be inferred from paragraph 3?`
- `The author mentions ... in order to ...`
- `Which statement would the author most likely agree with?`
- `What is the tone of the passage?` (opsi: `objective`, `skeptical`, `enthusiastic`, `critical`, `nostalgic`)

## Aturan mutu khusus

1. Jangan menguji tata bahasa. Subtes ini literasi, bukan structure.
2. Untuk soal kosakata, kata yang diuji harus punya **petunjuk konteks yang tegas** di kalimat yang
   sama atau kalimat sebelumnya.
3. Distraktor "inference" harus berupa kesimpulan yang *masuk akal secara umum* tetapi tidak
   didukung teks — inilah kesalahan tersering siswa.
4. `explanation` berbahasa Indonesia, dan **mengutip kalimat Inggris** yang menjadi bukti.

---

**Parameter**: `{{JUMLAH}}`, `{{JENIS_TEKS}}` (`informational` / `literary`), `{{TEMA}}`.
