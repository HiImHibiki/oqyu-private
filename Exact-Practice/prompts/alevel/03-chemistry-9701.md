# PROMPT — Cambridge A Level: 9701 Chemistry (Multiple Choice)

*System prompt:* `prompts/_shared/system.md`. `exam: "ALEVEL"`, `section: "al_chem_p1"`, `locale: "en"`.

---

Buat **{{JUMLAH}} soal** bergaya Paper 1. Paper aslinya 40 soal pilihan ganda / 60 menit —
**90 detik per soal**, semuanya `mcq_single` dengan **4 opsi** `A`–`D`, `points: 1`.

`calculatorAllowed: true`, `formulaRefs: ["alevel_chem"]`.

## Topik, skill, dan porsi

| `domain` | `skill` | porsi |
|---|---|---|
| `Physical Chemistry` | `Atomic structure`, `Moles & stoichiometry`, `Energetics`, `Equilibria`, `Kinetics` | 40% |
| `Inorganic Chemistry` | `Periodicity`, `Group 2`, `Group 17`, `Nitrogen & sulfur` | 25% |
| `Organic Chemistry` | `Hydrocarbons`, `Halogenoalkanes`, `Alcohols`, `Carbonyls`, `Analytical techniques` | 35% |

## Dua format khas Paper 1 yang wajib dipakai

**1. Soal hitungan langsung** — 4 opsi berupa nilai numerik. Distraktornya adalah hasil dari
kesalahan spesifik: lupa perbandingan mol, memakai volume dalam cm³ bukan dm³, lupa membagi dua,
memakai Mr yang salah.

**2. Soal "combination"** — pernyataan bernomor, opsi berupa kombinasinya:

```
Which statements about the reaction are correct?
1  The rate increases when temperature rises.
2  The equilibrium yield increases when pressure rises.
3  A catalyst increases the equilibrium yield.

A  1 only        B  1 and 2 only        C  2 and 3 only        D  1, 2 and 3
```

Gunakan format ini untuk sekitar 30% soal — ini ciri paling khas Paper 1 Cambridge.

## Aturan penulisan kimia

1. Rumus kimia LaTeX: `$\mathrm{H_2SO_4}$`, `$\mathrm{Ca(OH)_2}$`, ion: `$\mathrm{SO_4^{2-}}$`.
2. Persamaan reaksi harus **setara**: `$\mathrm{2NaOH + H_2SO_4 \rightarrow Na_2SO_4 + 2H_2O}$`.
   Kesetimbangan memakai `\rightleftharpoons`.
3. Kondisi ditulis di atas panah bila relevan: `$\xrightarrow{\text{conc. } H_2SO_4,\ 170^\circ C}$`.
4. Tetapan dari data booklet: $N_A = 6.02\times10^{23}\ \mathrm{mol^{-1}}$,
   $R = 8.31\ \mathrm{J\,K^{-1}\,mol^{-1}}$, $V_m = 24.0\ \mathrm{dm^3\,mol^{-1}}$ pada r.t.p.
5. Struktur organik: bila perlu digambar, pakai `figure` bertipe `geometry` dengan
   `line` + `label` (mis. rangka karbon dengan gugus `-OH`). Bila cukup, tulis dalam bentuk
   ringkas: `$\mathrm{CH_3CH_2CH(OH)CH_3}$`.

## Pola soal yang harus ada

1. Stoikiometri titrasi dengan perbandingan mol bukan 1 : 1.
2. Entalpi lewat hukum Hess atau energi ikatan (perhatikan tanda!).
3. Kesetimbangan: pengaruh suhu, tekanan, katalis terhadap **laju** vs **posisi kesetimbangan** —
   ini pembeda yang paling sering salah.
4. Kinetika: orde reaksi dari data laju awal.
5. Kecenderungan periodik: jari-jari atom, energi ionisasi pertama (termasuk anomali Grup 2→13 dan
   15→16), sifat asam-basa oksida.
6. Isomerisme: struktural, cis-trans, optis — hitung jumlah isomer.
7. Mekanisme: substitusi nukleofilik $\mathrm{S_N1}$ vs $\mathrm{S_N2}$, adisi elektrofilik.
8. Uji identifikasi: Tollens, Fehling, iodoform, uji halida dengan $\mathrm{AgNO_3}$.

## Aturan mutu khusus

1. Karena hanya 4 opsi, setiap distraktor harus **benar-benar berasal dari satu kesalahan** dan
   dicatat di `distractorRationale`.
2. Pada soal combination, pastikan setiap pernyataan bisa dinilai benar/salah secara mandiri.
3. `explanation` menyebut nilai antara (mol, Mr, konsentrasi) supaya siswa bisa melacak di mana
   perhitungannya menyimpang.

---

**Parameter**: `{{JUMLAH}}`, `{{TOPIK}}` *(opsional)*, `{{TINGKAT}}`.
