# PROMPT — CSCA: Chemistry 化学

*System prompt:* `prompts/_shared/system.md` + `prompts/csca/00-aturan-csca.md`.
`exam: "CSCA"`, `section: "csca_chemistry"`, `locale: "en"` dengan `i18n.zh` **wajib**.

---

Buat **{{JUMLAH}} soal** Chemistry. Mata uji ini **48 soal / 60 menit / 100 poin**, seluruhnya
pilihan ganda **4 opsi**, **tanpa kalkulator** — rata-rata **75 detik per soal**.

Diwajibkan untuk pelamar Kedokteran (MBBS), Teknik Kimia, dan Ilmu Hayati.

## Domain, skill, dan porsi (silabus resmi 2025)

| `domain` | `skill` | porsi |
|---|---|---|
| `Basic Concepts 基本概念` | `State changes 状态变化`, `Chemical equations 化学方程式`, `Solution pH and concentration 溶液pH与浓度`, `Ideal gas law 理想气体定律` | 25% |
| `Properties & Reactions 性质与反应` | `Acids, bases and salts 酸碱盐`, `Metals 金属`, `Hydrocarbons 烃`, `Redox reactions 氧化还原反应`, `Ion reactions 离子反应` | 30% |
| `Theory 理论` | `Periodic trends 元素周期律`, `Chemical bonds 化学键`, `Intermolecular forces 分子间作用力`, `Reaction rates 反应速率`, `Chemical equilibrium 化学平衡`, `Electrochemistry 电化学` | 30% |
| `Experiments 实验` | `Lab safety 实验安全`, `Gas identification 气体检验`, `Purification methods 提纯方法` | 15% |

## Pola soal khas yang wajib muncul

1. **Stoikiometri mol** dari massa, volume gas STP, atau konsentrasi larutan.
2. **Persamaan ion bersih** → mana yang ditulis dengan benar.
3. **Kecenderungan periodik**: jari-jari atom, energi ionisasi pertama, keelektronegatifan,
   sifat asam-basa oksida.
4. **Ikatan kimia**: ionik vs kovalen vs logam, bentuk molekul, kepolaran.
5. **Kesetimbangan** (Le Chatelier): pengaruh suhu, tekanan, konsentrasi, dan katalis — bedakan
   pengaruh terhadap **laju** dan terhadap **posisi kesetimbangan**. Ini titik salah paling sering.
6. **pH larutan** asam/basa kuat dan lemah, serta pengenceran.
7. **Reaksi redoks**: menentukan bilangan oksidasi, oksidator/reduktor, penyetaraan.
8. **Elektrokimia**: sel volta vs elektrolisis, reaksi di anode/katode, hukum Faraday.
9. **Hidrokarbon**: isomer, reaksi substitusi/adisi/eliminasi, identifikasi gugus fungsi.
10. **Percobaan**: urutan langkah pemurnian, cara mengenali gas, keselamatan laboratorium.

## Format soal "kombinasi pernyataan"

Gaya khas ujian Tiongkok — pakai untuk sekitar 25% soal:

```
关于该反应的说法，正确的是：
① 升高温度反应速率加快
② 增大压强平衡向正反应方向移动
③ 加入催化剂可提高产率

A ①            B ①②           C ②③           D ①②③
```

## Aturan penulisan kimia

1. Rumus kimia LaTeX: `$\mathrm{H_2SO_4}$`, `$\mathrm{Ca(OH)_2}$`, ion `$\mathrm{SO_4^{2-}}$`.
2. Persamaan reaksi **wajib setara**; kesetimbangan memakai `\rightleftharpoons`.
3. Tetapan: $N_A=6.02\times10^{23}\ \mathrm{mol^{-1}}$, $V_m=22.4\ \mathrm{L\,mol^{-1}}$ (STP),
   $F=96500\ \mathrm{C\,mol^{-1}}$.
4. **Tanpa kalkulator**: pakai massa molar bulat ($\mathrm{H}=1$, $\mathrm{C}=12$, $\mathrm{O}=16$,
   $\mathrm{Na}=23$, $\mathrm{S}=32$, $\mathrm{Cl}=35.5$) dan angka yang membagi habis.
5. `formulaRefs: ["csca_chemistry"]` bila relevan.
6. Istilah 中文 baku: 化学平衡, 氧化还原反应, 元素周期律, 离子反应, 电解池, 原电池.

---

**Parameter**: `{{JUMLAH}}`, `{{DOMAIN}}` *(opsional)*, `{{TINGKAT}}`.
