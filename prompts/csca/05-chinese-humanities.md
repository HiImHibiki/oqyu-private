# PROMPT — CSCA: Humanities Chinese 文科中文

*System prompt:* `prompts/_shared/system.md` + `prompts/csca/00-aturan-csca.md`.
`exam: "CSCA"`, `section: "csca_chinese_hum"`, **`locale: "zh"`**.

---

Buat **{{JUMLAH}} soal**. Mata uji ini **80 soal / 90 menit / 100 poin**, seluruhnya pilihan ganda
**4 opsi** — rata-rata **68 detik per soal**.

Diwajibkan untuk pelamar program **berbahasa Mandarin** di bidang humaniora, seni, hukum, dan ilmu
sosial.

## Yang diuji: bahasa Mandarin AKADEMIK, bukan HSK

Yang diukur adalah kesiapan membaca **buku ajar sejarah, filsafat, hukum, dan sastra berbahasa
Mandarin**. Register-nya lebih formal daripada percakapan, banyak memakai 书面语 dan struktur
klasik yang masih hidup di teks akademik.

**Jangan** membuat soal bertema perjalanan atau kehidupan kampus sehari-hari. **Buat** soal bertema
kutipan pemikiran, penggalan sejarah, ketentuan hukum sederhana, dan penggalan karya sastra.

## Aturan bahasa untuk mata uji ini

Sama seperti STEM Chinese: **materi ujinya bahasa Mandarin itu sendiri**, jadi stem, opsi, dan
bacaan tidak diterjemahkan. `locale: "zh"`, dan `i18n.en` hanya berisi terjemahan instruksi serta
`explanation` versi Inggris.

## Domain, skill, dan porsi (silabus resmi 2025)

| `domain` | `skill` | porsi |
|---|---|---|
| `Academic Vocabulary 学术词汇` | `Literary terminology 文学术语`, `Philosophy terminology 哲学术语`, `Legal terminology 法律术语` | 30% |
| `Humanities Reading 文科文阅读` | `History texts 历史`, `Education texts 教育`, `Politics texts 政治`, `Literature passages 文学作品` | 45% |
| `Language Use 语言运用` | `Character recognition 汉字识别`, `Vocabulary fill-in-the-blank 词语填空`, `Paragraph completion 语段补全` | 25% |

## Empat bentuk soal resmi

1. **汉字识别** — karakter mirip dalam istilah humaniora: 权力／权利, 制度／制订, 意义／意思,
   历史／历时.
2. **词语填空** — kalimat akademik dengan satu rumpang. Pasangan menjebak khas humaniora:
   反映／反应, 以致／以至, 必须／必需, 制定／制订, 收集／搜集.
3. **语段补全** — paragraf argumentatif dengan satu kalimat hilang; peserta memilih kalimat yang
   menjaga alur penalaran dan penanda hubungan (然而, 因此, 换言之, 由此可见).
4. **文科文阅读** — bacaan 250–450 karakter, diikuti 2–4 soal: 主旨, 细节, 推断, 作者态度,
   词语在文中的含义.

## Kosakata akademik yang wajib muncul

- **文学**: 意象, 叙述, 象征, 主题, 修辞, 体裁, 抒情, 讽刺
- **哲学**: 思想, 观念, 本质, 现象, 理性, 伦理, 辩证, 价值观
- **法律**: 权利, 义务, 法规, 条款, 合同, 判决, 责任, 程序
- **历史／政治**: 制度, 改革, 政策, 影响, 背景, 时期, 变迁, 传统
- **论证**: 论点, 论据, 前提, 结论, 假设, 归纳, 演绎, 反驳

## Aturan mutu khusus

1. Bacaan harus memuat **struktur argumen yang bisa dinilai**: klaim, bukti, dan satu keterbatasan —
   tanpa itu, soal 推断 dan 作者态度 tidak punya pijakan.
2. Untuk 词语填空, keempat opsi benar secara tata bahasa; pembedanya kolokasi dan register.
3. Distraktor 阅读 terbaik: pernyataan yang benar menurut pengetahuan umum tetapi tidak ada di
   bacaan, dan pernyataan yang ada di bacaan tetapi tidak menjawab pertanyaan.
4. Konten harus netral: **hindari** penilaian politik kontemporer, tokoh yang masih menjabat, dan
   isu yang memecah. Sejarah dan filsafat klasik aman; komentar politik terkini tidak.
5. Gunakan 简体字 dan tanda baca lebar Tiongkok.

---

**Parameter**: `{{JUMLAH}}`, `{{DOMAIN}}` *(opsional)*, `{{TINGKAT}}`.
