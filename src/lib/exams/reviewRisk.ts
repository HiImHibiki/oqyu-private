import type { BankQuestion } from "./bank";

/* =========================================================================
 * PRIORITAS TINJAUAN
 *
 * 647 soal tidak bisa ditinjau sekaligus, dan meninjaunya berurutan menurut id
 * berarti soal paling berbahaya mungkin baru tersentuh pada minggu keenam.
 * Modul ini menyusun antrean menurut peluang salah dikalikan akibatnya.
 *
 * Skor ini BUKAN penilaian mutu. Skor tinggi tidak berarti soal itu keliru —
 * hanya berarti kalau ia keliru, kekeliruannya lebih mungkin lolos tanpa
 * disadari. Karena itu setiap sinyal dijelaskan alasannya di layar, supaya
 * peninjau tahu apa yang harus ia curigai, bukan sekadar melihat angka.
 *
 * Bobotnya hasil pertimbangan, bukan hasil pengukuran. Setelah ada data
 * tinjauan sungguhan (soal mana yang benar-benar dikembalikan), bobot ini
 * harus dikalibrasi ulang terhadap kenyataan.
 * ========================================================================= */

export interface RiskSignal {
  code: string;
  weight: number;
  label: string;   // ditampilkan sebagai chip
  why: string;     // alasannya, ditampilkan saat ditunjuk
}

export interface RiskScore {
  score: number;
  signals: RiskSignal[];
}

/** Angka di luar LaTeX dan di luar penomoran daftar. */
const NUMBERS = /-?\d+(?:[.,]\d+)?/g;
/** Operator yang menandakan ada perhitungan, bukan sekadar penyebutan angka. */
const OPERATORS = /[+\-×÷*/=]|\\times|\\div|\\dfrac|\\frac|\\sqrt/g;

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

export function scoreQuestion(q: BankQuestion): RiskScore {
  const signals: RiskSignal[] = [];
  const add = (code: string, weight: number, label: string, why: string) =>
    signals.push({ code, weight, label, why });

  const explanation = q.explanation ?? "";

  /* -------------------------------------------------- perhitungan berantai */
  const ops = countMatches(explanation, OPERATORS);
  const nums = countMatches(explanation, NUMBERS);
  if (ops >= 6 && nums >= 6) {
    add("arithmetic-heavy", 30, "hitungan panjang",
      "Pembahasan memuat banyak langkah aritmetika. Satu salah tanda atau salah bagi di tengah akan " +
      "menghasilkan kunci yang keliru tetapi tetap terlihat masuk akal.");
  } else if (ops >= 3 && nums >= 4) {
    add("arithmetic", 15, "ada hitungan",
      "Pembahasan mengandung perhitungan. Periksa ulang setiap langkah, bukan hanya hasil akhirnya.");
  }

  /* ------------------------------------------------- jawaban tanpa pengecoh */
  if (q.type === "spr_numeric" || q.type === "numeric_multi") {
    add("no-distractors", 25, "isian angka",
      "Tidak ada pilihan yang bisa menjadi pemeriksa silang. Pada soal pilihan ganda, kunci yang " +
      "salah hitung sering tidak ada di antara opsi sehingga penulis menyadarinya; di sini tidak.");
  }

  /* ------------------------------------------------------------- dwibahasa */
  if (q.exam === "CSCA") {
    add("bilingual", 20, "dwibahasa",
      "Terjemahan bisa mengubah makna soal atau justru membocorkan kunci. Kedua versi harus " +
      "menanyakan hal yang sama persis.");
  }

  /* ----------------------------------------------------------------- gambar */
  if (q.figure) {
    add("figure", 20, "bergambar",
      "Angka pada gambar dan angka pada pembahasan harus cocok. Ketidakcocokan di sini tidak " +
      "terdeteksi validator mana pun.");
  }

  /* ------------------------------------------------- penilaian rubrik */
  if (q.type === "essay_rubric") {
    add("rubric", 25, "rubrik",
      "Penilaian uraian bergantung pada rubrik dan contoh jawaban. Keduanya perlu dibaca guru " +
      "mata pelajaran, bukan sekadar diperiksa strukturnya.");
  }

  /* ------------------------------------------------------------ soal sulit */
  if (q.difficulty === "H" || (q.irtB ?? 0) >= 0.8) {
    add("hard", 12, "sulit",
      "Soal sulit lebih sering memuat langkah yang halus, dan kekeliruannya lebih merugikan " +
      "karena justru soal inilah yang memisahkan peserta berkemampuan tinggi.");
  }

  /* --------------------------- kunci numerik tidak muncul di pembahasan
   *
   * Versi pertama sinyal ini membandingkan teks kunci apa pun dengan isi
   * pembahasan, dan menyala pada 41% soal — hampir semuanya salah tuduh,
   * karena pembahasan wajar menyebut «Raising the pressure» untuk kunci
   * «Increasing the pressure». Sinyal yang menyala di mana-mana melatih
   * peninjau untuk mengabaikannya, jadi lebih buruk daripada tidak ada.
   *
   * Sekarang hanya kunci berupa ANGKA yang diperiksa. Di situ kecocokan
   * harfiah memang bisa diharapkan, dan ketidakhadirannya adalah pola khas
   * dari kekeliruan yang paling sering terjadi: kunci diubah tetapi
   * pembahasannya lupa ikut diubah. */
  const choiceKey = q.answer.mode === "choice" ? q.answer.value : null;
  if (choiceKey && q.choices?.length) {
    const key = q.choices.find((c) => c.id === choiceKey);
    const bare = key?.text.replace(/\$|\\[a-zA-Z]+|[{}\\,\s]/g, "") ?? "";
    const numeric = /^-?\d+(?:[.,]\d+)?$/.test(bare);
    if (numeric) {
      const plain = explanation.replace(/\$|\\[a-zA-Z]+|[{}\\,\s]/g, "");
      if (!plain.includes(bare)) {
        add("key-unsupported", 30, "angka kunci tak muncul",
          `Kunci bernilai ${bare}, tetapi angka itu tidak muncul di mana pun dalam pembahasan. ` +
          "Ini pola khas kunci yang diubah tanpa pembahasannya ikut diperbarui.");
      }
    }
  }

  /* ------------------------------------- pengecoh tanpa alasan yang ditulis */
  if (choiceKey && q.choices?.length) {
    const wrong = q.choices.filter((c) => c.id !== choiceKey).map((c) => c.id);
    const given = Object.keys(q.distractorRationale ?? {});
    const missing = wrong.filter((id) => !given.includes(id));
    if (missing.length) {
      add("no-rationale", 10, "pengecoh tanpa alasan",
        `Opsi ${missing.join(", ")} belum punya penjelasan mengapa salah. Pengecoh tanpa alasan ` +
        "sering kali ternyata tidak benar-benar salah.");
    }
  }

  /* ------------------------------------------ pernah dikembalikan sebelumnya */
  if (q.review?.verdict === "returned") {
    add("previously-returned", 40, "pernah dikembalikan",
      "Soal ini pernah ditolak peninjau. Perbaikannya harus diperiksa sebelum dipakai lagi.");
  }

  return { score: signals.reduce((a, s) => a + s.weight, 0), signals };
}

export interface QueueItem {
  id: string;
  exam: string;
  section: string;
  domain: string;
  skill: string;
  difficulty: string;
  type: string;
  status: string;
  stem: string;
  score: number;
  signals: RiskSignal[];
  reviewed: boolean;
  returned: boolean;
}

/** Antrean tinjauan: yang belum diperiksa manusia, paling berisiko lebih dulu. */
export function buildQueue(bank: BankQuestion[], opts: { includeReviewed?: boolean } = {}): QueueItem[] {
  return bank
    .filter((q) => q.status !== "retired")
    .filter((q) => opts.includeReviewed || q.review?.verdict !== "correct")
    .map((q) => {
      const { score, signals } = scoreQuestion(q);
      return {
        id: q.id, exam: q.exam, section: q.section, domain: q.domain, skill: q.skill,
        difficulty: q.difficulty, type: q.type, status: q.status,
        stem: q.stem.slice(0, 150),
        score, signals,
        reviewed: Boolean(q.review),
        returned: q.review?.verdict === "returned",
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
