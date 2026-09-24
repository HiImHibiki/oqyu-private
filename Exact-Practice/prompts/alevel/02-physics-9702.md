# PROMPT — Cambridge A Level: 9702 Physics (AS Structured)

*System prompt:* `prompts/_shared/system.md`. `exam: "ALEVEL"`, `section: "al_phys_p2"`, `locale: "en"`.

---

Buat **{{JUMLAH}} soal** bergaya Paper 2 (AS Level Structured Questions). Paper aslinya 60 marks /
75 menit, sekitar 6–8 soal berstruktur.

## Struktur soal

- `numeric_multi` untuk soal berbagian dengan hasil numerik; `numericBlanks[].unit` diisi satuannya.
- `essay_rubric` untuk bagian `Explain …`, `State and explain …`, `Describe …`.
- `spr_numeric` untuk soal satu bagian.
- `points` = marks. `calculatorAllowed: true`. `formulaRefs: ["alevel_physics"]`.

## Topik, skill, dan porsi

| `domain` | `skill` | porsi |
|---|---|---|
| `Measurement` | `SI units`, `Uncertainties`, `Scalars & vectors` | 10% |
| `Kinematics & Dynamics` | `Motion graphs`, `Newton's laws`, `Momentum` | 25% |
| `Forces & Energy` | `Moments`, `Work-energy`, `Density & pressure` | 20% |
| `Waves` | `Progressive waves`, `Superposition`, `Diffraction` | 20% |
| `Electricity` | `Current & p.d.`, `Resistance`, `D.C. circuits` | 25% |

## Aturan penilaian fisika yang wajib ditegakkan

1. **Satuan wajib** pada setiap jawaban numerik. Sertakan di `numericBlanks[].unit`, dan tulis di
   rubrik bahwa mark accuracy hilang tanpa satuan.
2. **Angka penting**: jawaban akhir 2–3 s.f. Nyatakan di soal bila jumlahnya ditentukan.
3. **Nilai tetapan** dari data booklet: $g = 9.81\ \mathrm{m\,s^{-2}}$,
   $c = 3.00\times10^{8}\ \mathrm{m\,s^{-1}}$, $e = 1.60\times10^{-19}\ \mathrm{C}$.
4. Untuk soal ketidakpastian, minta `absolute uncertainty` atau `percentage uncertainty` secara
   eksplisit, dan gunakan aturan penjumlahan ketidakpastian relatif untuk perkalian/pembagian.
5. Untuk `Explain`, rubrik harus memuat butir fisika yang berbeda — bukan pengulangan. Contoh untuk
   "explain why the reading falls": (1) menyebut besaran yang berubah, (2) menyebut hubungan
   sebab-akibatnya, (3) menyimpulkan arah perubahan.

## Kapan memakai `figure`

- Rangkaian → `circuit` (battery, resistor, lamp, switch, ammeter, voltmeter).
- Grafik $v$–$t$, $s$–$t$, $I$–$V$, $F$–$x$ → `line_chart`.
- Diagram gaya, bidang miring, katrol, batang bermomen → `geometry` dengan `arrow: true`.
- Gelombang, celah ganda, muka gelombang → `geometry` atau `function_plot`.
- Data eksperimen untuk digambar grafiknya → `table`.

## Pola soal khas

1. Grafik $v$–$t$ berbentuk trapesium → jarak dari luas, percepatan dari kemiringan.
2. Tumbukan dua benda → momentum sebelum/sesudah, cek apakah lenting sempurna lewat energi kinetik.
3. Rangkaian dengan resistor seri–paralel dan e.m.f. dengan hambatan dalam.
4. Momen gaya pada batang tak seragam dengan tumpuan.
5. Celah ganda Young → jarak antar-pita terang, pengaruh perubahan $\lambda$ atau $d$.
6. Ketidakpastian pengukuran dari data pengukuran berulang.

---

**Parameter**: `{{JUMLAH}}`, `{{TOPIK}}` *(opsional)*, `{{TOTAL_MARKS}}`.
