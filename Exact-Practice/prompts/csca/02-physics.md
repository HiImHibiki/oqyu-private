# PROMPT — CSCA: Physics 物理

*System prompt:* `prompts/_shared/system.md` + `prompts/csca/00-aturan-csca.md`.
`exam: "CSCA"`, `section: "csca_physics"`, `locale: "en"` dengan `i18n.zh` **wajib**.

---

Buat **{{JUMLAH}} soal** Physics. Mata uji ini **48 soal / 60 menit / 100 poin**, seluruhnya pilihan
ganda **4 opsi**, **tanpa kalkulator** — rata-rata **75 detik per soal**.

Diwajibkan untuk pelamar Teknik, Ilmu Komputer, dan Sains Fisik.

## Domain, skill, dan porsi (silabus resmi 2025)

| `domain` | `skill` | porsi |
|---|---|---|
| `Mechanics 力学` | `Velocity and acceleration 速度与加速度`, `Newton's laws 牛顿定律`, `Momentum and impulse 动量与冲量`, `Work and energy 功与能`, `Circular motion 圆周运动`, `Simple harmonic motion 简谐运动` | 35% |
| `Electromagnetism 电磁学` | `Coulomb's law 库仑定律`, `Ohm's law 欧姆定律`, `Magnetic induction 磁感应`, `Lorentz force 洛伦兹力`, `Faraday's law 法拉第定律`, `Lenz's law 楞次定律` | 30% |
| `Thermodynamics 热学` | `Molecular theory 分子动理论`, `Ideal gas equation 理想气体状态方程`, `First law of thermodynamics 热力学第一定律` | 15% |
| `Optics 光学` | `Reflection 反射`, `Refraction 折射`, `Interference 干涉`, `Diffraction 衍射` | 10% |
| `Modern Physics 近代物理` | `Photoelectric effect 光电效应`, `Atomic structure 原子结构`, `Nuclear physics 原子核物理` | 10% |

## Pola soal khas yang wajib muncul

1. **Grafik $v$–$t$** berbentuk trapesium → jarak dari luas, percepatan dari kemiringan.
2. **Bidang miring dengan gesekan** → percepatan atau kecepatan di dasar.
3. **Tumbukan** lenting sempurna dan tidak lenting → kecepatan akhir, cek energi kinetik.
4. **Gerak melingkar** → tegangan tali di titik tertinggi, kecepatan minimum.
5. **Rangkaian seri–paralel** → arus total, tegangan pada satu resistor, daya disipasi.
6. **Muatan bergerak dalam medan magnet** → jari-jari lintasan, arah gaya Lorentz.
7. **Induksi elektromagnetik** → ggl pada batang bergerak, arah arus induksi (Lenz).
8. **Gas ideal** → perubahan keadaan isotermal/isobarik, penerapan hukum I termodinamika.
9. **Celah ganda** → jarak antar-pita terang, pengaruh perubahan $\lambda$ atau $d$.
10. **Efek fotolistrik** → energi kinetik maksimum, frekuensi ambang.

## Kapan memakai `figure`

- Rangkaian → `circuit` (battery, resistor, lamp, switch, ammeter, voltmeter)
- Grafik $v$–$t$, $s$–$t$, $I$–$V$ → `line_chart`
- Diagram gaya, bidang miring, katrol, muatan dalam medan → `geometry` dengan `arrow: true`
- Gelombang, celah ganda, pembiasan → `geometry`

## Aturan penulisan fisika

1. Satuan SI dengan `\mathrm{}`: `$12\ \mathrm{m\,s^{-1}}$`, `$0.5\ \mathrm{A}$`.
2. Tetapan yang boleh dipakai tanpa disebutkan: $g=9.8\ \mathrm{m\,s^{-2}}$,
   $c=3.0\times10^{8}\ \mathrm{m\,s^{-1}}$, $e=1.6\times10^{-19}\ \mathrm{C}$,
   $h=6.63\times10^{-34}\ \mathrm{J\,s}$.
3. **Tanpa kalkulator**: pilih angka yang menghasilkan bilangan bulat atau desimal satu angka.
   Contoh baik: $12\ \mathrm{V}$ dengan $R=6\ \Omega$. Contoh buruk: $13.7\ \mathrm{V}$ dengan $R=4.3\ \Omega$.
4. Distraktor harus berasal dari kesalahan fisika yang nyata: lupa komponen gaya, membalik arah,
   memakai massa alih-alih berat, menjumlahkan resistor paralel seperti seri.
5. `formulaRefs: ["csca_physics"]` bila memakai rumus di lembar rumus.
6. Istilah 中文 baku: 动量守恒, 电磁感应, 光电效应, 简谐运动, 理想气体.

---

**Parameter**: `{{JUMLAH}}`, `{{DOMAIN}}` *(opsional)*, `{{TINGKAT}}`.
