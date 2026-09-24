# Pustaka Prompt AI — Exact Try Out

Semua soal di Exact Try Out dihasilkan dengan pola yang sama:

```
system prompt  =  _shared/system.md
user prompt    =  file segmen (mis. utbk/04-pengetahuan-kuantitatif.md)
                  dengan {{PLACEHOLDER}} sudah diisi
output         =  JSON array  ->  validasi  ->  review manusia  ->  bank soal
```

## Cara pakai (3 menit)

1. Buka file segmen yang kamu butuhkan.
2. Ganti setiap `{{...}}` dengan nilai nyata. Contoh: `{{JUMLAH}}` → `10`.
3. Di Claude / API, kirim `_shared/system.md` sebagai **system prompt** dan file segmen sebagai
   **user prompt**.
4. Salin keluaran JSON-nya.
5. **Cara termudah:** buka `/admin/soal` → *Buat soal dengan AI*. Panel itu merakit prompt dari
   berkas-berkas di folder ini, mengisi placeholder-nya dari form kriteria, lalu memanggil Claude /
   Gemini / ChatGPT langsung — hasilnya divalidasi dan bisa diimpor dengan satu tombol. Tombol
   *Salin prompt* di panel yang sama menyalin teks final kalau kamu lebih suka mengerjakannya di
   aplikasi chat.

   Kalau kamu sudah punya JSON: `/admin/soal` → *Impor soal dari JSON* → tempel → **Impor**.

   **Cara lewat terminal**, kalau kamu lebih suka berkas:
   ```bash
   npm run validate hasil.json -- --strict
   npm run import   hasil.json -- --status in_review
   ```

Keduanya memakai validator yang sama (`src/lib/exams/validate.ts`), jadi hasilnya tidak pernah
berbeda. Soal yang punya temuan **BLOCKER** tidak ikut masuk; sisanya tetap diimpor.

## Daftar file

| Ujian | File | Section |
|---|---|---|
| Umum | `_shared/system.md` | — · dipakai sebagai *system prompt* oleh panel admin |
| Umum | `_shared/review.md` | prompt peninjau soal (QA) |
| Skema | `_schema/question.schema.json` | kontrak JSON |
| SAT | `sat/reading-writing.md` | `sat_rw_m1`, `sat_rw_m2` |
| SAT | `sat/math.md` | `sat_math_m1`, `sat_math_m2` |
| UTBK | `utbk/01-penalaran-umum.md` | `utbk_pu` |
| UTBK | `utbk/02-ppu.md` | `utbk_ppu` |
| UTBK | `utbk/03-pbm.md` | `utbk_pbm` |
| UTBK | `utbk/04-pengetahuan-kuantitatif.md` | `utbk_pk` |
| UTBK | `utbk/05-literasi-bahasa-indonesia.md` | `utbk_lbi` |
| UTBK | `utbk/06-literasi-bahasa-inggris.md` | `utbk_lbe` |
| UTBK | `utbk/07-penalaran-matematika.md` | `utbk_pm` |
| CSCA | `csca/00-aturan-bilingual.md` | wajib dibaca lebih dulu |
| CSCA | `csca/01-mathematics.md` | `csca_math` |
| CSCA | `csca/02-chinese.md` | `csca_chinese` |
| CSCA | `csca/03-english.md` | `csca_english` |
| CSCA | `csca/04-science.md` | `csca_science` |
| CSCA | `csca/05-logic.md` | `csca_logic` |
| A Level | `alevel/01-mathematics-9709-p1.md` | `al_math_p1` |
| A Level | `alevel/02-physics-9702.md` | `al_phys_p2` |
| A Level | `alevel/03-chemistry-9701.md` | `al_chem_p1` |
| A Level | `alevel/04-economics-9708.md` | `al_econ_p2` |

## Kenapa dipecah per subtes

Satu prompt panjang untuk "semua soal UTBK" menghasilkan soal yang seragam dan dangkal: model
kehabisan perhatian untuk aturan spesifik tiap subtes. Prompt per subtes memuat pola pertanyaan
resmi, alokasi waktu, dan jebakan khas subtes itu — hasilnya jauh lebih mirip soal aslinya.

## Praktik yang terbukti membantu

- **8–12 soal per panggilan.** Lebih dari itu, mutu soal terakhir turun tajam.
- **Satu domain per panggilan** kalau kamu sedang mengisi kekosongan bank soal. Hasilnya lebih tajam
  daripada meminta campuran.
- **Selalu jalankan `_shared/review.md`** pada keluarannya, dengan model yang sama atau berbeda.
  Peninjau menangkap kunci ganda dan distraktor yang sebenarnya juga benar — kesalahan yang paling
  merusak kepercayaan siswa.
- **Naikkan suhu untuk keragaman konteks, turunkan untuk ketepatan.** Untuk matematika dan sains,
  `temperature: 0.3`. Untuk bacaan dan konteks cerita, `temperature: 0.8`.
- **Simpan `meta.model` dan `meta.version`.** Kalau kelak ditemukan pola kesalahan dari satu model,
  kamu bisa menarik seluruh soal yang berasal dari sana.

## Alur produksi yang disarankan

```
generate (8-12 soal)
   -> validate-questions.mjs        (struktur, LaTeX, token, konsistensi kunci)
   -> review.md dengan model kedua  (kunci ganda, distraktor cacat, bias)
   -> perbaikan
   -> tinjauan guru mata pelajaran  (status: in_review -> approved)
   -> uji lapangan sebagai soal tak bernilai di paket nyata
   -> kalibrasi irtB dari data jawaban
```

Soal berstatus `draft` dan `in_review` **tidak pernah** dipakai di paket berbayar.


## Placeholder yang diisi otomatis oleh panel admin

Panel `/admin/soal` mengganti placeholder ini dari form kriteria. Kalau kamu menambah berkas prompt
baru, pakai nama yang sama supaya ikut terisi:

| placeholder | diisi dari |
|---|---|
| `{{JUMLAH}}` | kolom "Jumlah soal" |
| `{{SECTION}}` | subtes yang dipilih |
| `{{DOMAIN}}` / `{{TOPIK}}` | kolom "Domain" |
| `{{VARIAN}}` | kolom varian modul adaptif (SAT) |
| `{{TINGKAT}}` / `{{HSK}}` | kolom "Komposisi kesulitan" |
| `{{TEMA}}` / `{{TEMA_BACAAN}}` / `{{KONTEKS}}` / `{{JENIS_TEKS}}` / `{{JENIS}}` | kolom "Tema / konteks" |
| `{{TOTAL_MARKS}}` | dihitung dari jumlah soal |

Berkas prompt baru juga perlu didaftarkan di `src/lib/ai/promptRegistry.ts` (`FILE_FOR_SECTION`)
supaya muncul di dropdown subtes.
