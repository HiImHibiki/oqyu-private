import type { ExamCode, FormSectionLayout, Question } from "@/lib/types";
import { getBlueprint } from "./blueprints";
import { approvedPool, questionsByIds, type BankQuestion } from "./bank";
import type { PlayerSection } from "@/components/exam/ExamPlayer";

/* Menyusun paket soal dari bank.
 *
 * Dua langkah yang sengaja dipisah:
 *   composeLayout()  memilih soal — dijalankan SEKALI saat attempt dibuat
 *   sectionsFrom()   membangun ulang paket dari pilihan yang tersimpan
 *
 * Semua penilaian memakai langkah kedua, sehingga soal MANA yang dipakai tidak
 * pernah berubah setelah attempt dibuat — pemilihannya sudah dibekukan.
 *
 * Yang TIDAK dibekukan adalah isi soalnya. sectionsFrom() membaca ulang setiap
 * soal dari bank berdasarkan id, jadi teks opsi dan kunci jawaban selalu yang
 * terbaru. Selama satu attempt berjalan, menimpa soalnya akan mengubah
 * jawaban peserta tanpa ia menyentuhnya. Karena itu importQuestions() menolak
 * menimpa soal yang sedang dikerjakan; lihat penjelasannya di bank.ts. */

const DEMO_COUNT = 10;
const DEMO_DURATION_SEC = 15 * 60;

/** Pengali akomodasi yang diakui. Nilai lain ditolak, bukan dibulatkan:
 *  «1,7× waktu» bukan akomodasi yang dikenal lembaga ujian mana pun, dan
 *  menerimanya diam-diam akan membuat durasi yang tidak bisa
 *  dipertanggungjawabkan. */
export const TIME_MULTIPLIERS = [1, 1.5, 2] as const;
export type TimeMultiplier = (typeof TIME_MULTIPLIERS)[number];

export function normalizeMultiplier(v: unknown): TimeMultiplier {
  const n = Number(v);
  return (TIME_MULTIPLIERS as readonly number[]).includes(n) ? (n as TimeMultiplier) : 1;
}

/** Waktu dibulatkan ke menit penuh: «96 menit 30 detik» tidak pernah muncul
 *  di ujian sungguhan dan hanya membingungkan saat dibacakan pengawas. */
function scaleTime(sec: number, mult: number): number {
  if (mult === 1) return sec;
  return Math.round((sec * mult) / 60) * 60;
}

/** Varian untuk `breakAfterSec`, yang boleh tidak ada. */
function scaleTimeOpt(sec: number | undefined, mult: number): number | undefined {
  return sec === undefined ? undefined : scaleTime(sec, mult);
}

/* --------------------------------------------------------- pemilihan soal */

/* Acak yang stabil untuk satu attempt: urutan soal berbeda antar peserta,
 * tetapi tetap sama setiap kali paket itu dibangun ulang.
 *
 * Versi sebelumnya memakai LCG modulo 2^31 dan mengambil `h % (i + 1)` —
 * yaitu BIT RENDAH-nya. Bit rendah LCG semacam itu berperiode sangat pendek,
 * sehingga permutasinya jauh dari seragam: diukur pada pool 80 soal yang
 * diambil 40, ada soal yang muncul di 19% paket dan ada yang di 57%, dengan
 * simpangan baku 7,5 poin persen — hampir sepuluh kali lipat dari yang
 * seharusnya. Akibatnya sebagian soal nyaris tidak pernah dipakai sementara
 * sebagian lain terlalu sering terpapar.
 *
 * mulberry32 mencampur seluruh bit sebelum mengeluarkan hasil, dan indeksnya
 * diambil dari pecahan [0,1) alih-alih dari sisa bagi. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rand = mulberry32(h);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Paket lengkap sesuai blueprint. Kalau bank soal belum cukup, section
 *  diisi seadanya — struktur ujian tetap terlihat utuh. */
export async function composeLayout(
  exam: ExamCode,
  seed: string,
  /* Akomodasi waktu (1 = normal, 1.5, 2). Dikalikan ke dalam susunan paket di
   * sini, bukan dihitung ulang setiap kali section dimulai: durasinya lalu
   * ikut membeku bersama attempt, sehingga seluruh aplikasi — layar persiapan,
   * penghitung mundur, penetapan tenggat — melihat angka yang sama tanpa satu
   * pun dari mereka perlu tahu tentang akomodasi. */
  timeMultiplier = 1,
  /* Soal yang SUDAH PERNAH dilihat peserta ini. Lihat catatan di bawah. */
  seenIds?: Iterable<string>,
): Promise<FormSectionLayout[]> {
  const bp = getBlueprint(exam);
  if (!bp) return [];

  const shuffled = shuffle(await approvedPool(exam), seed);

  /* Soal yang belum pernah dilihat peserta ini didahulukan.
   *
   * Tanpa ini, dua percobaan sama-sama mengambil dari pool yang sama secara
   * acak, sehingga dengan bank dua kali ukuran satu form, percobaan kedua
   * mengulang sekitar separuh soal — bukan karena banknya kurang, melainkan
   * karena pemilihannya tidak pernah tahu apa yang sudah pernah keluar.
   *
   * Yang dijanjikan paket «6 try out» adalah enam paket berbeda, dan itulah
   * yang diukur peserta. Mendahulukan yang belum pernah dilihat membuat janji
   * itu ditepati sampai banknya benar-benar habis; sesudah itu perilakunya
   * kembali persis seperti semula, mengambil dari sisa yang ada.
   *
   * Urutannya tetap acak DI DALAM tiap kelompok, jadi dua peserta berbeda
   * tetap memperoleh paket yang berbeda. Yang berubah hanya prioritasnya. */
  const seen = seenIds ? new Set(seenIds) : null;
  const bank = seen?.size
    ? [...shuffled.filter((q) => !seen.has(q.id)), ...shuffled.filter((q) => seen.has(q.id))]
    : shuffled;

  const used = new Set<string>();

  // Selama bank masih tipis, section tanpa soal sendiri boleh meminjam,
  // tetapi hanya sebesar jatah ratanya. Begitu bank penuh, `mine` selalu
  // cukup dan peminjaman tidak pernah terjadi.
  const fairShare = Math.max(1, Math.floor(bank.length / bp.sections.length));

  /* Modul adaptif menghasilkan DUA entri: varian mudah dan varian sulit.
   * Keduanya disusun sekarang dan dibekukan bersama attempt; server memilih
   * salah satunya setelah modul 1 selesai. Menyusunnya belakangan berarti
   * mengambil dari bank yang mungkin sudah berubah, dan itu merusak
   * pembekuan susunan paket. */
  const out: FormSectionLayout[] = [];

  for (const s of bp.sections) {
    const isAdaptive = s.adaptive?.module === 2;
    const variants: ("easier" | "harder")[] = isAdaptive ? ["easier", "harder"] : [];

    const take = (variant?: "easier" | "harder") => {
      let mine = bank.filter((q) => q.section === s.code && !used.has(q.id));

      /* Varian mudah dan varian sulit dibedakan oleh KOMPOSISI kesulitannya,
       * bukan oleh pengurutan penuh.
       *
       * Versi sebelumnya mengurutkan seluruh pool section (E→M→H untuk varian
       * mudah, H→M→E untuk varian sulit) lalu mengambil dari depan. Selama
       * jumlah soal pada tingkat terluar hanya sedikit di atas jumlah yang
       * diambil, varian itu mengambil soal yang sama pada hampir setiap
       * attempt: diukur pada pool 108 soal `sat_rw_m2` yang memuat 29 soal H,
       * varian sulit mengambil 27 di antaranya, dan dua paket berbagi 93%
       * soal. Menambah soal tidak menolong selama pengurutannya masih penuh —
       * yang bertambah hanya ekornya, yang tidak pernah terambil.
       *
       * Kuota per tingkat kesulitan menjaga perbedaan varian tetap nyata
       * sekaligus menyebar pilihan ke seluruh pool. Ini juga lebih dekat ke
       * bentuknya yang asli: modul 2 versi sulit pada SAT digital tetap memuat
       * soal mudah dan sedang, hanya bobotnya yang bergeser. */
      if (variant) {
        const mix = variant === "easier"
          ? { E: 0.4, M: 0.45, H: 0.15 }
          : { E: 0.15, M: 0.45, H: 0.4 };
        const rank = (d: string) =>
          variant === "easier" ? { E: 0, M: 1, H: 2 }[d] ?? 1 : { H: 0, M: 1, E: 2 }[d] ?? 1;

        const chosen: BankQuestion[] = [];
        for (const d of ["E", "M", "H"] as const) {
          chosen.push(...mine.filter((q) => q.difficulty === d).slice(0, Math.round(s.questionCount * mix[d])));
        }

        /* Kekurangan akibat pembulatan, atau karena satu tingkat kesulitan
         * belum cukup terisi di bank, ditutup dari sisa — didahulukan yang
         * paling sesuai arah varian. */
        const taken = new Set(chosen.map((q) => q.id));
        const rest = mine
          .filter((q) => !taken.has(q.id))
          .sort((a, b) => rank(a.difficulty) - rank(b.difficulty));
        const keep = new Set([...chosen, ...rest].slice(0, s.questionCount).map((q) => q.id));

        // Urutan acak dari `bank` dipertahankan: kuota menentukan soal mana
        // yang terpilih, bukan urutan tampilnya.
        mine = mine.filter((q) => keep.has(q.id));
      }

      /* Modul adaptif TIDAK BOLEH meminjam dari section lain.
       *
       * Peminjaman lintas-section berguna selagi bank tipis, tetapi di sini ia
       * merusak justru hal yang sedang dibangun: varian «mudah» yang diisi soal
       * pinjaman bukanlah varian yang lebih mudah, hanya kumpulan soal lain.
       * Lebih baik mengaku belum bisa adaptif daripada menyajikan adaptivitas
       * yang tidak nyata. */
      const need = Math.min(s.questionCount, Math.max(mine.length, fairShare));
      const spare = variant || mine.length >= need
        ? []
        : bank.filter((q) => q.section !== s.code && !used.has(q.id)).slice(0, need - mine.length);
      const picked = [...mine, ...spare].slice(0, s.questionCount);
      picked.forEach((q) => used.add(q.id));

      return {
        code: s.code,
        name: variant === "easier" ? `${s.name} — varian mudah`
          : variant === "harder" ? `${s.name} — varian sulit`
          : s.name,
        durationSec: scaleTime(s.durationSec, timeMultiplier),
        calculatorAllowed: s.calculatorAllowed,
        formulaSheet: s.formulaSheet,
        breakAfterSec: scaleTimeOpt(s.breakAfterSec, timeMultiplier),
        ...(variant ? { variant } : {}),
        questionIds: picked.map((q) => q.id),
      } satisfies FormSectionLayout;
    };

    if (!isAdaptive) {
      const one = take();
      if (one.questionIds.length) out.push(one);
      continue;
    }

    const built = variants.map((v) => take(v)).filter((x) => x.questionIds.length);
    /* Bila bank belum cukup untuk dua varian penuh, jangan pura-pura adaptif:
     * pakai satu modul saja. Menyajikan varian «mudah» yang isinya sama
     * dengan varian «sulit» adalah adaptivitas palsu. */
    if (built.length === 2 && built.every((b) => b.questionIds.length === s.questionCount)) {
      out.push(...built);
    } else {
      const merged = built[0] ?? take();
      if (merged.questionIds.length) out.push({ ...merged, name: s.name, variant: undefined });
    }
  }

  return out;
}

/** Demo gratis: 10 soal, satu section, 15 menit. */
export async function composeDemoLayout(exam: ExamCode, seed: string): Promise<FormSectionLayout[]> {
  const bp = getBlueprint(exam);
  const mine = await approvedPool(exam);
  let pool: BankQuestion[] = shuffle(mine, seed);

  if (pool.length < DEMO_COUNT) {
    // bank ujian ini masih tipis — pinjam dari ujian lain agar demo tetap utuh
    const others: BankQuestion[] = [];
    for (const other of (["SAT", "UTBK", "CSCA", "ALEVEL"] as ExamCode[])) {
      if (other === exam) continue;
      others.push(...(await approvedPool(other)));
    }
    pool = [...pool, ...shuffle(others, seed)];
  }

  const picked = pool.slice(0, DEMO_COUNT);
  if (!picked.length) return [];

  return [{
    code: `${exam.toLowerCase()}_demo`,
    name: `Demo ${bp?.name ?? exam} - ${picked.length} soal`,
    durationSec: DEMO_DURATION_SEC,
    calculatorAllowed: true,
    formulaSheet: bp?.sections.find((s) => s.formulaSheet)?.formulaSheet,
    questionIds: picked.map((q) => q.id),
  }];
}

/* ------------------------------------------------- membangun ulang paket */

/** Bangun paket siap-render dari susunan yang tersimpan di attempt. */
export async function sectionsFrom(layout: FormSectionLayout[]): Promise<PlayerSection[]> {
  const ids = layout.flatMap((s) => s.questionIds);
  const map = await questionsByIds(ids);

  return layout
    .map((s) => ({
      code: s.code,
      name: s.name,
      durationSec: s.durationSec,
      calculatorAllowed: s.calculatorAllowed,
      formulaSheet: s.formulaSheet,
      breakAfterSec: s.breakAfterSec,
      questionCount: s.questionIds.length,
      questions: s.questionIds
        .map((id) => map.get(id))
        .filter((q): q is BankQuestion => Boolean(q)) as Question[],
    }))
    .filter((s) => s.questions.length > 0);
}

export const layoutQuestionIds = (layout: FormSectionLayout[]) => layout.flatMap((s) => s.questionIds);

/** Soal yang benar-benar DILIHAT peserta pada satu attempt.
 *
 *  Berbeda dari `layoutQuestionIds`: susunan paket adaptif memuat kedua varian
 *  modul 2, tetapi peserta hanya mengerjakan satu di antaranya. Varian yang
 *  tidak terpilih belum pernah ia lihat, jadi memperlakukannya sebagai «sudah
 *  dilihat» akan membuang soal yang masih segar — untuk SAT, sepertiga bank
 *  akan hangus setelah satu percobaan saja. */
export const seenQuestionIds = (
  layout: FormSectionLayout[] = [],
  routing?: Record<string, "easier" | "harder">,
) =>
  layout
    .filter((s) => !s.variant || routing?.[s.code] === s.variant)
    .flatMap((s) => s.questionIds);
