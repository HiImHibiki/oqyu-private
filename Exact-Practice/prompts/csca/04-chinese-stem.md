# PROMPT — CSCA: STEM Chinese 理科中文

*System prompt:* `prompts/_shared/system.md` + `prompts/csca/00-aturan-csca.md`.
`exam: "CSCA"`, `section: "csca_chinese_stem"`, **`locale: "zh"`**.

---

Buat **{{JUMLAH}} soal**. Mata uji ini **80 soal / 90 menit / 100 poin**, seluruhnya pilihan ganda
**4 opsi** — rata-rata **68 detik per soal**.

Diwajibkan untuk pelamar program **berbahasa Mandarin** di bidang STEM, teknik, dan kedokteran.

## Yang diuji: bahasa Mandarin AKADEMIK, bukan HSK

Ini pembeda paling penting. Yang diukur adalah kesiapan membaca **buku ajar dan soal ujian
berbahasa Mandarin di jurusan sains**, bukan percakapan sehari-hari. Seorang peserta HSK 6 yang
belum pernah membaca buku fisika berbahasa Mandarin tetap bisa gagal di sini.

**Jangan** membuat soal bertema restoran, belanja, atau liburan. **Buat** soal bertema kelas
laboratorium, langkah percobaan, pembacaan tabel data, dan definisi konsep ilmiah.

## Aturan bahasa untuk mata uji ini

Materi ujinya adalah bahasa Mandarin itu sendiri, jadi **stem, opsi, dan bacaan TIDAK diterjemahkan**.
Isi `i18n.en` hanya dengan terjemahan **instruksi** dan `explanation` versi Inggris.

```jsonc
{
  "locale": "zh",
  "stem": "阅读下面的实验步骤，选出加点词语的正确含义：……",
  "explanation": "「量取」指用量筒等仪器取一定体积的液体……",
  "i18n": { "en": {
    "stem": "Read the experimental procedure below and choose the correct meaning of the marked word: ...",
    "explanation": "「量取」means to measure out a specific volume of liquid using apparatus such as a measuring cylinder..."
  }}
}
```

## Domain, skill, dan porsi (silabus resmi 2025)

| `domain` | `skill` | porsi |
|---|---|---|
| `Academic Vocabulary 学术词汇` | `Mathematical symbols 数学符号`, `Physics terminology 物理术语`, `Chemistry terminology 化学术语` | 30% |
| `Scientific Reading 科技文阅读` | `Lab operation texts 实验操作`, `Data chart interpretation 图表解读`, `Technical passage comprehension 科技文理解` | 45% |
| `Language Use 语言运用` | `Character recognition 汉字识别`, `Vocabulary fill-in-the-blank 词语填空`, `Paragraph completion 语段补全` | 25% |

## Empat bentuk soal resmi

1. **汉字识别 (character recognition)** — memilih karakter yang benar untuk istilah ilmiah,
   membedakan karakter mirip: 溶／熔／融, 密度／浓度, 摄氏／华氏.
2. **词语填空 (vocabulary fill-in-the-blank)** — kalimat ilmiah dengan satu rumpang; empat opsi
   semuanya masuk secara tata bahasa, hanya satu yang tepat kolokasinya.
   Contoh pasangan menjebak: 增加／增大／提高／上升, 测量／测定／检测, 由于／因为／既然.
3. **语段补全 (paragraph completion)** — paragraf prosedur percobaan dengan satu kalimat hilang;
   peserta memilih kalimat yang menjaga urutan logis dan kohesi.
4. **科技文阅读 (scientific reading)** — bacaan 200–400 karakter tentang percobaan, konsep, atau
   tabel data, diikuti 2–4 soal: 主旨, 细节, 推断, 图表解读.

## Kosakata ilmiah yang wajib muncul

- **数学**: 函数, 方程, 导数, 极限, 概率, 坐标, 直角, 半径, 面积, 体积
- **物理**: 速度, 加速度, 质量, 重力, 摩擦力, 电流, 电压, 电阻, 磁场, 波长
- **化学**: 溶液, 浓度, 沉淀, 催化剂, 氧化, 还原, 摩尔, 化合物, 试管, 滤纸
- **实验**: 量取, 称量, 加热, 搅拌, 过滤, 蒸发, 记录, 误差, 对照组, 结论

## Aturan mutu khusus

1. Kalimatnya harus terdengar wajar bagi penutur asli — hindari kalimat buatan yang kaku.
2. Untuk 词语填空, keempat opsi wajib benar secara tata bahasa; pembedanya hanya kolokasi atau
   register ilmiah.
3. Untuk 阅读, distraktor terbaik adalah pernyataan yang **benar secara ilmiah tetapi tidak ada di
   bacaan** — inilah kesalahan tersering peserta asing.
4. `explanation` versi 中文 menjelaskan aturannya; versi English menjelaskan **kenapa peserta asing
   sering salah** di titik itu.
5. Gunakan 简体字 dan tanda baca lebar Tiongkok.

---

**Parameter**: `{{JUMLAH}}`, `{{DOMAIN}}` *(opsional)*, `{{TINGKAT}}`.
