# PROMPT — CSCA: Mathematics 数学

*System prompt:* `prompts/_shared/system.md` + `prompts/csca/00-aturan-csca.md`.
`exam: "CSCA"`, `section: "csca_math"`, `locale: "en"` dengan `i18n.zh` **wajib**.

---

Buat **{{JUMLAH}} soal** Mathematics. Mata uji ini **48 soal / 60 menit / 100 poin**, seluruhnya
pilihan ganda **4 opsi**, **tanpa kalkulator** — rata-rata **75 detik per soal**.

Mathematics **wajib bagi seluruh pelamar CSCA**, apa pun jurusan dan bahasa pengantarnya. Ini mata
uji dengan peserta terbanyak, jadi mutunya paling menentukan.

## Tingkat materi

Setara kurikulum SMA Tiongkok (人教版) kelas 10–12: sudah mencakup **dasar kalkulus**, **bilangan
kompleks**, **irisan kerucut**, dan **geometri ruang dengan koordinat**. Lebih tinggi dari SAT Math,
sedikit di bawah A Level Pure Mathematics.

## Domain, skill, dan porsi (silabus resmi 2025)

| `domain` | `skill` | porsi |
|---|---|---|
| `Sets & Inequalities 集合与不等式` | `Set operations 集合运算`, `Quadratic inequalities 一元二次不等式`, `Rational inequalities 分式不等式` | 15% |
| `Functions 函数` | `Domain and range 定义域与值域`, `Monotonicity 单调性`, `Parity 奇偶性`, `Power functions 幂函数`, `Exponential functions 指数函数`, `Logarithmic functions 对数函数`, `Trigonometric functions 三角函数`, `Arithmetic sequences 等差数列`, `Geometric sequences 等比数列`, `Basics of derivatives 导数基础`, `Basics of calculus 微积分基础` | 35% |
| `Geometry & Algebra 几何与代数` | `Lines 直线`, `Circles 圆`, `Ellipses 椭圆`, `Hyperbolas 双曲线`, `Parabolas 抛物线`, `Vectors 向量`, `Complex numbers 复数`, `Solid geometry with space coordinates 立体几何与空间坐标` | 30% |
| `Probability & Statistics 概率统计` | `Classical probability 古典概型`, `Mean 平均数`, `Variance 方差`, `Normal distribution 正态分布` | 20% |

## Pola soal khas yang wajib muncul

1. **Barisan** dengan syarat gabungan: $a_1+a_5=20$, $a_3=8$ → cari $S_{10}$.
2. **Monotonisitas dan paritas** fungsi: menentukan interval naik/turun, atau apakah fungsi ganjil/genap.
3. **Turunan untuk nilai ekstrem** $f(x)=x^3+ax^2+bx$ → menentukan $a$, $b$, atau nilai maksimum.
4. **Irisan kerucut**: eksentrisitas, jarak fokus, hubungan garis dengan elips/hiperbola.
5. **Bilangan kompleks**: modulus, konjugat, letak di bidang kompleks, akar persamaan.
6. **Vektor dan geometri ruang**: sudut antara garis dan bidang, jarak titik ke bidang, hasil kali skalar.
7. **Distribusi normal**: membaca peluang dari sifat simetri $\mu \pm \sigma$.
8. **Peluang klasik**: pengambilan bola/kartu dengan angka kecil.
9. **Pertidaksamaan** kuadrat atau pecahan → himpunan penyelesaian dalam notasi interval.
10. **Logaritma dan eksponen**: menyederhanakan atau menyelesaikan persamaan.

## Kapan memakai `figure`

- Irisan kerucut & geometri analitik → `function_plot` atau `geometry`
- Geometri ruang → `geometry` (rusuk tersembunyi digambar `dashed: true`)
- Statistika → `histogram`, `box_plot`, atau `table`

## Aturan mutu khusus

1. **Tanpa kalkulator**: hasil antara harus bulat, pecahan sederhana, atau akar yang rapi.
2. Empat opsi harus berdekatan nilainya sehingga tidak bisa dieliminasi dengan taksiran kasar.
3. Distraktor irisan kerucut yang terbukti efektif: tertukar $a$ dan $b$; memakai $c^2=a^2+b^2$
   untuk elips; membalik $e=a/c$.
4. `explanation` menunjukkan jalan tercepat, bukan cara panjang — peserta hanya punya 75 detik.
5. Versi 中文 memakai istilah matematika baku Tiongkok.

---

**Parameter**: `{{JUMLAH}}`, `{{DOMAIN}}` *(opsional)*, `{{TINGKAT}}`.
