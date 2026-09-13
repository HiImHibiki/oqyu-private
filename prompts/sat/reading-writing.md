# PROMPT — Digital SAT: Reading and Writing

*System prompt:* `prompts/_shared/system.md`. Bahasa soal: **English**. `locale: "en"`.

---

Buat **{{JUMLAH}} soal** untuk section `{{SECTION}}` (isi `sat_rw_m1` atau `sat_rw_m2`).

## Bentuk baku Digital SAT R&W

- **Selalu** `type: "mcq_single"` dengan **tepat 4 opsi** ber-id `"A"`, `"B"`, `"C"`, `"D"`.
- **Satu stimulus pendek untuk satu soal.** Panjang 25–150 kata. Tidak ada bacaan panjang bersama.
- `calculatorAllowed: false`.
- `estimatedTimeSec` 45–95 (rata-rata ujian 71 detik/soal).
- Urutan soal dalam modul: Craft and Structure → Information and Ideas → Standard English
  Conventions → Expression of Ideas. Kesulitan meningkat di dalam tiap kelompok.

## Domain dan skill (pakai persis)

| `domain` | `skill` | porsi |
|---|---|---|
| `Information and Ideas` | `Central Ideas and Details`, `Command of Evidence (Textual)`, `Command of Evidence (Quantitative)`, `Inferences` | 26% |
| `Craft and Structure` | `Words in Context`, `Text Structure and Purpose`, `Cross-Text Connections` | 28% |
| `Expression of Ideas` | `Rhetorical Synthesis`, `Transitions` | 20% |
| `Standard English Conventions` | `Boundaries`, `Form, Structure, and Sense` | 26% |

## Pola pertanyaan resmi — pakai kalimat ini apa adanya

- Words in Context → `Which choice completes the text with the most logical and precise word or phrase?`
- Text Structure and Purpose → `Which choice best states the main purpose of the text?` / `... best describes the overall structure of the text?`
- Central Ideas → `Which choice best states the main idea of the text?`
- Inferences → `Which choice most logically completes the text?` (stimulus berakhir dengan ` _______ .`)
- Command of Evidence (Textual) → `Which finding, if true, would most directly support the researchers' claim?`
- Command of Evidence (Quantitative) → `Which choice most effectively uses data from the {graph/table} to complete the statement?` — **wajib** sertakan `figure` bar/line/table.
- Cross-Text Connections → `stimulus.type: "dual_passage"`, dua teks dipisah baris `---`. Pertanyaan: `Based on the texts, how would the author of Text 2 most likely respond to the claim made in Text 1?`
- Transitions → `Which choice completes the text with the most logical transition?` — opsi berupa penanda hubungan (`However,` `For example,` `Therefore,` `In addition,`); **jangan** ada dua opsi dengan hubungan yang sama.
- Rhetorical Synthesis → `stimulus.type: "notes"` berisi butir catatan siswa dengan `-`, lalu `While researching a topic, a student has taken the notes above. The student wants to {tujuan}. Which choice most effectively uses relevant information from the notes to accomplish this goal?`
- Boundaries → stimulus memuat ` ______ ` di titik tanda baca; opsi menguji koma, titik koma, titik dua, tanda hubung, apostrof.
- Form, Structure, and Sense → menguji kesesuaian subjek-verba, bentuk kata kerja, pronomina, paralelisme, modifier.

## Materi bacaan

Sebarkan topik stimulus: sastra (fiksi/puisi asli), sejarah & dokumen kenegaraan (gaya abad ke-18–19),
ilmu sosial, dan sains. Sertakan penulis dan peneliti dari latar yang beragam. Untuk teks bergaya
sejarah, tulis ulang dengan register periode itu — jangan mengutip dokumen nyata.

## Aturan khusus per skill

**Words in Context.** Kata kunci harus level akademik yang wajar (bukan kata langka). Keempat opsi
harus kelas kata yang sama dan semuanya masuk secara tata bahasa; yang membedakan hanya makna dalam
konteks. Konteks harus memuat *satu petunjuk penentu* — kata kontras, contoh, atau penjelasan setelah
titik dua.

**Boundaries.** Tiga opsi salah harus mewakili kesalahan berbeda: comma splice, koma tunggal antara
subjek dan predikat, titik koma di tempat yang butuh koma, dsb.

**Command of Evidence (Quantitative).** Kunci wajib mengandung *dua* titik data yang membentuk
hubungan yang diklaim. Distraktor tipikal: benar secara aritmetika tetapi tidak relevan dengan klaim;
membalik arah hubungan; hanya menyebut satu titik data; mengutip data yang tidak ada di grafik.

## Kalibrasi kesulitan modul

- Untuk `sat_rw_m1`: campuran `E` 30% / `M` 45% / `H` 25%.
- Untuk `sat_rw_m2` varian **sulit**: `M` 35% / `H` 65%, `irtB` rata-rata ≥ +0,8.
- Untuk `sat_rw_m2` varian **mudah**: `E` 55% / `M` 40% / `H` 5%, `irtB` rata-rata ≤ −0,6.
  (Tulis varian yang diminta di `{{VARIAN}}`.)

## Contoh keluaran yang benar

```json
[{
  "id": "sat-rw-wic-0201",
  "exam": "SAT", "section": "sat_rw_m1",
  "domain": "Craft and Structure", "skill": "Words in Context",
  "difficulty": "M", "irtB": 0.1, "calculatorAllowed": false, "locale": "en",
  "stimulus": {
    "type": "passage",
    "content": "Curator Delia Ortiz argues that museum labels have grown too deferential. A label that merely records a painting's title and date, she contends, treats the viewer as a passive recipient. Ortiz's own labels are deliberately ______ : they pose questions, name what the artist may have gotten wrong, and invite disagreement.",
    "source": "Adapted from a 2024 essay on museum practice."
  },
  "stem": "Which choice completes the text with the most logical and precise word or phrase?",
  "type": "mcq_single",
  "choices": [
    {"id":"A","text":"provocative"},
    {"id":"B","text":"exhaustive"},
    {"id":"C","text":"conciliatory"},
    {"id":"D","text":"ornamental"}
  ],
  "answer": {"mode":"choice","value":"A"},
  "explanation": "The colon introduces what Ortiz's labels do: **pose questions**, **name what the artist got wrong**, and **invite disagreement**. All three are deliberately unsettling gestures, so a word meaning 'meant to stir a reaction' is required. *Exhaustive* describes length, not stance; *conciliatory* is the opposite of inviting disagreement; *ornamental* describes decoration, which the text never mentions.",
  "distractorRationale": {
    "B": "Dipilih kalau siswa membaca daftar tiga hal itu sebagai 'lengkap' alih-alih membaca sifatnya.",
    "C": "Kebalikan makna; dipilih kalau kata 'invite' dibaca sebagai ramah.",
    "D": "Kata bernuansa museum yang menggoda secara topik tapi tidak didukung konteks."
  },
  "tags": ["words-in-context","colon-clue"],
  "estimatedTimeSec": 65, "points": 1,
  "meta": {"generator":"ai","model":"claude-opus-5","reviewed":false,"version":1}
}]
```

---

**Parameter yang diisi sebelum menjalankan prompt**

- `{{JUMLAH}}` — berapa soal (disarankan 8–12 per panggilan agar mutu terjaga)
- `{{SECTION}}` — `sat_rw_m1` atau `sat_rw_m2`
- `{{VARIAN}}` — `base` (untuk modul 1) / `hard` / `easy` (untuk modul 2)
- `{{DOMAIN}}` *(opsional)* — batasi ke satu domain kalau ingin mengisi kekosongan bank soal
