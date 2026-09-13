import type { ExamCode } from "@/lib/types";

/* =========================================================================
 * BASIS DATA REFERENSI UJIAN
 *
 * Fakta administratif dan struktural tiap ujian, beserta SUMBER dan TANGGAL
 * VERIFIKASI-nya. Ini yang membuat blueprint bisa dipercaya: setiap angka
 * bisa dilacak ke dokumen resminya, dan yang belum terverifikasi ditandai
 * terang-terangan alih-alih disamarkan.
 *
 * Yang TIDAK ada di sini, dan memang tidak boleh ada: soal past paper.
 * Soal SAT milik College Board, past paper A Level milik Cambridge, dan
 * soal UTBK tidak pernah dipublikasikan. Menyalinnya ke bank soal komersial
 * adalah pelanggaran hak cipta. Yang legal dan justru lebih berguna adalah
 * SPESIFIKASI di bawah ini — dari sinilah prompt AI menghasilkan soal orisinal
 * yang berperilaku seperti soal aslinya.
 * ========================================================================= */

export type Confidence = "verified" | "reported" | "estimated";

export interface SourceRef {
  label: string;
  url: string;
  /** kapan terakhir dicocokkan dengan dokumen sumbernya */
  checked: string;
}

export interface ExamReference {
  code: ExamCode;
  officialName: string;
  localName?: string;
  body: string;
  website: string;

  delivery: string;
  sittingsPerYear: string;
  scoreScale: string;
  scoreValidity: string;
  resultTiming?: string;
  feeNote?: string;

  /** seberapa yakin angka blueprint-nya */
  confidence: Confidence;
  lastVerified: string;
  sources: SourceRef[];

  /** hal yang harus dicek ulang tiap tahun */
  recheck: string[];
  notes: string[];
}

const D = "2026-08-28";

export const EXAM_REFERENCE: Record<ExamCode, ExamReference> = {
  /* ------------------------------------------------------------------ SAT */
  SAT: {
    code: "SAT",
    officialName: "Digital SAT",
    body: "College Board",
    website: "https://satsuite.collegeboard.org/sat",
    delivery: "Digital, adaptif per modul, di aplikasi Bluebook",
    sittingsPerYear: "7 kali per tahun (internasional bisa berbeda)",
    scoreScale: "400–1600 · dua section 200–800",
    scoreValidity: "Umumnya diterima 5 tahun",
    confidence: "verified",
    lastVerified: D,
    sources: [
      { label: "Digital SAT format, timing, dan bobot domain", url: "https://thetestadvantage.com/blog/digital-sat-format-2026-sections-timing-scoring-guide-1", checked: D },
      { label: "Domain Reading & Writing beserta persentasenya", url: "https://thetestadvantage.com/blog/digital-sat-reading-writing-domains-whats-tested-2026", checked: D },
      { label: "Struktur modul adaptif dan pembobotan kesulitan", url: "https://www.scoir.com/blog/the-ins-and-outs-of-the-digital-sat", checked: D },
    ],
    recheck: [
      "Bobot domain diperbarui College Board dari waktu ke waktu",
      "Kebijakan kalkulator (saat ini Desmos tersedia sepanjang section Math)",
    ],
    notes: [
      "98 soal, 2 jam 14 menit, ditambah jeda 10 menit antar-section.",
      "Reading & Writing: 54 soal / 64 menit (2 modul × 27 soal × 32 menit).",
      "Math: 44 soal / 70 menit (2 modul × 22 soal × 35 menit).",
      "Di tiap modul Math, soal 1–15 pilihan ganda dan 16–22 isian (student-produced response).",
      "Modul 2 tiap section menyesuaikan tingkat kesulitan dari hasil modul 1, dan soal sulit berbobot lebih besar terhadap skor.",
    ],
  },

  /* ----------------------------------------------------------------- UTBK */
  UTBK: {
    code: "UTBK",
    officialName: "Ujian Tulis Berbasis Komputer - Seleksi Nasional Berdasarkan Tes",
    localName: "UTBK-SNBT",
    body: "Panitia SNPMB, Kementerian Pendidikan Tinggi, Sains, dan Teknologi",
    website: "https://snpmb.bppp.kemdikbud.go.id",
    delivery: "Berbasis komputer di pusat UTBK",
    sittingsPerYear: "1 kali per tahun (April)",
    scoreScale: "Skor IRT per subtes, dilaporkan pada skala ~0–1000",
    scoreValidity: "Berlaku untuk satu musim penerimaan",
    confidence: "reported",
    lastVerified: D,
    sources: [
      { label: "Kisi-kisi materi dan alokasi waktu UTBK-SNBT", url: "https://edukasi.kompas.com/read/2026/04/06/104500471/kisi-kisi-materi-utbk-snbt-2026-per-soal-berapa-menit-dikerjakan-", checked: D },
      { label: "Rincian jumlah soal dan durasi per subtes", url: "https://unnes.ac.id/berapa-soal-utbk-2026-dan-pembagian-subtesnya/", checked: D },
      { label: "Kisi-kisi UTBK-SNBT terlengkap", url: "https://www.ruangguru.com/blog/kisi-kisi-utbk-snbt", checked: D },
    ],
    recheck: [
      "SNPMB mengumumkan komposisi subtes setiap tahun — WAJIB dicocokkan ulang sebelum musim baru",
      "Sumber sekunder menyebut total 155–160 soal; alokasi per subtes sedikit berbeda antar-sumber",
      "Durasi Literasi B. Inggris dan Penalaran Matematika paling sering berubah",
    ],
    notes: [
      "Total 155 soal / 195 menit pada komposisi yang dipakai aplikasi ini.",
      "Penalaran Umum 30 soal terbagi rata: induktif, deduktif, dan kuantitatif masing-masing 10 soal.",
      "TPS terverifikasi: PU 30 soal/30 menit, PPU 20/15, PBM 20/25.",
      "Tidak ada lembar rumus resmi; daftar rumus di aplikasi ini adalah alat bantu belajar Exact, bukan bagian ujian.",
      "Soal UTBK tidak pernah dipublikasikan resmi — yang beredar sebagai 'soal asli' adalah rekonstruksi ingatan peserta dan tidak boleh dijadikan acuan.",
    ],
  },

  /* ----------------------------------------------------------------- CSCA */
  CSCA: {
    code: "CSCA",
    officialName: "China Scholastic Competency Assessment",
    localName: "CSCA",
    body: "China Scholarship Council (CSC)",
    website: "https://csca.cn",
    delivery: "Daring dengan pengawasan jarak jauh; sebagian negara menyediakan pusat ujian luring",
    sittingsPerYear: "5 kali per tahun sejak 2026 (Januari, Maret, April, Juni, Desember)",
    scoreScale: "100 poin per mata uji, dilaporkan bersama peringkat persentil",
    scoreValidity: "2 tahun",
    resultTiming: "7 hari kerja setelah ujian (daring); 14 hari kerja untuk ujian kertas",
    feeNote: "CNY 450 untuk satu mata uji, CNY 700 untuk dua mata uji atau lebih",
    confidence: "verified",
    lastVerified: D,
    sources: [
      { label: "Instructions for CSCA - Beijing Language and Culture University", url: "https://admission.blcu.edu.cn/en/2025/1212/c1587a3032/page.htm", checked: D },
      { label: "Guide to the CSCA Exam (silabus resmi edisi 2025 dikutip di dalamnya)", url: "https://www.china-admissions.com/wp-content/uploads/2025/11/CSCA-Guidebook.pdf", checked: D },
      { label: "Notice About the China Scholastic Competency Assessment", url: "https://mn.china-embassy.gov.cn/eng/zytz/202510/t20251030_11743700.htm", checked: D },
      { label: "China Aims for 'Quality' Overseas Students With Entry Exam", url: "https://www.insidehighered.com/news/admissions/2026/01/15/china-aims-quality-overseas-students-entry-exam", checked: D },
    ],
    recheck: [
      "CSCA baru berjalan sejak Desember 2025 — spesifikasinya masih bisa berubah cepat",
      "Setiap universitas menentukan sendiri mata uji yang diwajibkan; matriks di bawah adalah pola umum, bukan aturan resmi",
      "Cek csca.cn sebelum tiap musim pendaftaran",
    ],
    notes: [
      "Lima mata uji: Mathematics, Physics, Chemistry, Humanities Chinese (文科中文), STEM Chinese (理科中文).",
      "SELURUHNYA pilihan ganda. Mathematics/Physics/Chemistry: 48 soal / 60 menit. Chinese: 80 soal / 90 menit.",
      "Mathematics wajib untuk semua pelamar. Physics dan Chemistry opsional dan ditentukan universitas.",
      "Mathematics, Physics, dan Chemistry tersedia dalam bahasa Inggris ATAU Mandarin — peserta memilih.",
      "Professional Chinese hanya tersedia dalam Mandarin, dan pelamar program berbahasa Inggris dibebaskan darinya.",
      "Professional Chinese BUKAN HSK: yang diuji kemampuan bahasa akademik, bukan percakapan.",
      "Wajib untuk pendaftaran beasiswa CSC mulai intake 2026; diperkirakan wajib bagi seluruh pelamar S1 pada 2028.",
    ],
  },

  /* --------------------------------------------------------------- ALEVEL */
  ALEVEL: {
    code: "ALEVEL",
    officialName: "Cambridge International AS & A Level",
    body: "Cambridge Assessment International Education",
    website: "https://www.cambridgeinternational.org/alevel",
    delivery: "Ujian tulis di pusat ujian terdaftar",
    sittingsPerYear: "Juni dan November (sebagian zona juga Maret)",
    scoreScale: "Grade A*–E per subject; ambang batas ditetapkan ulang tiap sesi",
    scoreValidity: "Tidak kedaluwarsa",
    confidence: "verified",
    lastVerified: D,
    sources: [
      { label: "Silabus resmi Physics 9702 untuk 2025, 2026, 2027 (assessment overview + content overview)", url: "https://www.cambridgeinternational.org/Images/664565-2025-2027-syllabus.pdf", checked: D },
      { label: "Assessment overview Mathematics 9709", url: "https://cambridgepapers.net/assessment-overview-cambridge-international-as-and-a-level-mathematics-9709", checked: D },
      { label: "Grade thresholds Juni 2026 - Mathematics 9709", url: "https://www.cambridgeinternational.org/Images/761530-mathematics-9709-june-2026-grade-threshold-table.pdf", checked: D },
    ],
    recheck: [
      "Ambang batas grade (grade threshold) ditetapkan ULANG setiap sesi ujian — angka A*–E di aplikasi ini adalah perkiraan, bukan angka resmi sesi tertentu",
      "Silabus 9701 Chemistry dan 9708 Economics belum dicocokkan langsung ke PDF resminya",
    ],
    notes: [
      "Physics 9702 (terverifikasi dari silabus resmi): P1 MCQ 40 soal/40 mark/1j15m; P2 AS terstruktur 60 mark/1j15m; P3 praktik 40 mark/2j; P4 A Level terstruktur 100 mark/2j; P5 perencanaan-analisis-evaluasi 30 mark/1j15m.",
      "Bobot A Level 9702: P1 15,5% · P2 23% · P3 11,5% · P4 38,5% · P5 11,5%.",
      "Mathematics 9709: P1 Pure 1 75 mark/1j50m; P3 Pure 3 75 mark/1j50m; P4 Mechanics 50 mark/1j15m; P5 Probability & Statistics 1 50 mark/1j15m.",
      "Nilai diberikan per langkah dengan kode mark scheme: M (method), A (accuracy), B (independent), ft (follow-through).",
    ],
  },
  /* ------------------------------------------------------------- TKA SMP */
  TKA_SMP: {
    code: "TKA_SMP",
    officialName: "Tes Kemampuan Akademik jenjang SMP/MTs",
    localName: "TKA SMP",
    body: "Kementerian Pendidikan Dasar dan Menengah",
    website: "https://www.kemendikdasmen.go.id",
    delivery: "Berbasis komputer di satuan pendidikan",
    sittingsPerYear: "Mengikuti jadwal resmi tahunan",
    scoreScale: "0-100 per mata pelajaran",
    scoreValidity: "Berlaku untuk tahun ajaran berjalan",
    confidence: "estimated",
    lastVerified: D,
    sources: [],
    recheck: [
      "PALING PENTING: daftar mata pelajaran. Blueprint ini menyiapkan Bahasa Indonesia dan Matematika atas keputusan pemilik produk, BUKAN salinan POS resmi",
      "Jumlah soal dan alokasi waktu per mata pelajaran belum dicocokkan ke POS - angka di blueprint adalah rancangan latihan, bukan angka resmi",
      "Bobot domain per mata pelajaran perlu dicocokkan ke kisi-kisi resmi bila sudah terbit",
    ],
    notes: [
      "Blueprint TKA di aplikasi ini adalah SPESIFIKASI LATIHAN, bukan replika ujian resmi. Sampaikan itu apa adanya kepada peserta.",
      "Karena tidak ada satu pun sumber resmi yang sudah dicocokkan, confidence sengaja ditandai 'estimated' - jangan naikkan sebelum POS-nya benar-benar dibaca.",
      "Struktur per mata pelajaran memudahkan penyesuaian: mengubah daftar mapel cukup di blueprints.ts, dan komposer form serta skoring mengikuti.",
    ],
  },
  /* ------------------------------------------------------------- TKA SMA */
  TKA_SMA: {
    code: "TKA_SMA",
    officialName: "Tes Kemampuan Akademik jenjang SMA/MA",
    localName: "TKA SMA",
    body: "Kementerian Pendidikan Dasar dan Menengah",
    website: "https://www.kemendikdasmen.go.id",
    delivery: "Berbasis komputer di satuan pendidikan",
    sittingsPerYear: "Mengikuti jadwal resmi tahunan",
    scoreScale: "0-100 per mata pelajaran",
    scoreValidity: "Dipakai sebagai salah satu komponen seleksi masuk perguruan tinggi",
    confidence: "estimated",
    lastVerified: D,
    sources: [],
    recheck: [
      "PALING PENTING: daftar mata pelajaran pilihan. Blueprint ini menyiapkan tiga mapel wajib (Bahasa Indonesia, Matematika, Bahasa Inggris) plus paket saintek (Fisika, Kimia, Biologi) atas keputusan pemilik produk",
      "Berapa mapel pilihan yang boleh diambil peserta, dan apakah kombinasinya dibatasi jurusan",
      "Jumlah soal dan alokasi waktu per mata pelajaran belum dicocokkan ke POS resmi",
      "Bagaimana skor TKA dipakai dalam seleksi masuk perguruan tinggi - ini berubah antar tahun",
    ],
    notes: [
      "Blueprint TKA di aplikasi ini adalah SPESIFIKASI LATIHAN, bukan replika ujian resmi.",
      "Peserta hanya mengerjakan mata pelajaran yang dipilihnya; angka gabungan dihitung sebagai RATA-RATA mapel yang dikerjakan, sehingga peserta yang mengambil lebih sedikit mapel tidak dirugikan.",
      "Mapel soshum (Ekonomi, Sosiologi, Geografi, Sejarah) belum disiapkan - menambahkannya cukup dengan menambah section di blueprints.ts dan mengisi bank soalnya.",
    ],
  },
};

/* ------------------------------------------------- matriks mata uji CSCA */

export interface CscaRequirement {
  category: string;
  majors: string;
  chineseTaught: string[];
  englishTaught: string[];
  note?: string;
}

/** Pola umum mata uji CSCA menurut rumpun program studi.
 *  Bukan aturan resmi — setiap universitas menetapkan syaratnya sendiri. */
export const CSCA_REQUIREMENTS: CscaRequirement[] = [
  {
    category: "A · Desain, Film & Seni",
    majors: "Visual Communication, Architecture, Animation, Film Production, Fine Arts, Fashion Design",
    chineseTaught: ["Mathematics", "Humanities Chinese"],
    englishTaught: ["Mathematics"],
    note: "Sebagian universitas menggolongkan Arsitektur sebagai teknik, sehingga Physics ikut diwajibkan.",
  },
  {
    category: "B · STEM",
    majors: "Engineering, Computer Science, Physics, Mathematics",
    chineseTaught: ["Mathematics", "Physics", "STEM Chinese"],
    englishTaught: ["Mathematics", "Physics"],
  },
  {
    category: "C · Kedokteran & Ilmu Hayati",
    majors: "Clinical Medicine (MBBS), Pharmacy, Biology",
    chineseTaught: ["Mathematics", "Chemistry", "STEM Chinese"],
    englishTaught: ["Mathematics", "Chemistry"],
    note: "Sebagian universitas juga mewajibkan Physics.",
  },
  {
    category: "D · Bisnis & Ilmu Sosial",
    majors: "Economics, Law, International Relations, Business Administration",
    chineseTaught: ["Mathematics", "Humanities Chinese"],
    englishTaught: ["Mathematics"],
  },
];

/* ---------------------------------------------------- model skor per ujian */

export interface ScoringModel {
  exam: ExamCode;
  method: string;
  scale: string;
  howItWorks: string[];
  limitations: string[];
}

export const SCORING_MODELS: Record<ExamCode, ScoringModel> = {
  SAT: {
    exam: "SAT",
    method: "Kurva pangkat mendekati tabel konversi resmi, dengan plafon adaptif",
    scale: "200–800 per section · 400–1600 total",
    howItWorks: [
      "Persentase benar dipetakan lewat kurva 200 + 600·p^0,86 sehingga bagian bawah tidak terlalu murah.",
      "Peserta yang dirutekan ke modul 2 mudah dipetakan ke rentang 200–600; puncak skala hanya terbuka lewat modul sulit.",
      "Skor RW dan Math dihitung terpisah lalu dijumlahkan.",
    ],
    limitations: [
      "College Board tidak mempublikasikan tabel konversi per formulir, jadi ini pendekatan — bukan salinan.",
      "Pembobotan per butir berdasarkan kesulitan baru bisa akurat setelah irtB dikalibrasi dari data siswa.",
      "Plafon 600 untuk modul mudah adalah perkiraan; batas sesungguhnya berbeda tiap sesi dan tidak dipublikasikan.",
    ],
  },
  UTBK: {
    exam: "UTBK",
    method: "Estimasi kemampuan IRT model Rasch (1 parameter), Newton-Raphson",
    scale: "0–1000 per subtes",
    howItWorks: [
      "Tiap soal punya parameter kesulitan b (irtB); θ peserta diestimasi dari pola jawabannya.",
      "θ dipetakan ke skala laporan lewat 500 + 110·θ, sehingga rata-rata ada di sekitar 500.",
      "Menjawab benar soal sulit menaikkan θ lebih banyak daripada soal mudah — inilah sebab skor UTBK bukan sekadar jumlah benar.",
    ],
    limitations: [
      "SNPMB tidak mempublikasikan parameter butir maupun rumus penskalaannya.",
      "irtB awal berasal dari tebakan AI dan HARUS dikalibrasi ulang setelah ±200 respons per soal.",
    ],
  },
  CSCA: {
    exam: "CSCA",
    method: "Skor mentah pilihan ganda diskalakan ke 100 poin per mata uji",
    scale: "0–100 per mata uji, dilaporkan bersama persentil",
    howItWorks: [
      "Seluruh soal pilihan ganda dan berbobot sama; skor = 100 × proporsi benar, dengan sedikit pelurusan kurva.",
      "Tidak ada penalti jawaban salah, sehingga menebak selalu menguntungkan.",
      "Peringkat persentil ikut dilaporkan ke universitas untuk membandingkan pelamar antar-negara.",
    ],
    limitations: [
      "CSC belum mempublikasikan metode penskalaan resminya; persentil di aplikasi ini dihitung dari sebaran pengguna Exact sendiri, bukan sebaran global.",
    ],
  },
  ALEVEL: {
    exam: "ALEVEL",
    method: "Total mark per paper dipetakan ke grade lewat ambang batas",
    scale: "A*–E per subject",
    howItWorks: [
      "Nilai diberikan per langkah sesuai mark scheme (M/A/B/ft), bukan sekadar benar-salah.",
      "Total mark seluruh komponen dibandingkan dengan ambang batas grade.",
      "Bobot tiap paper terhadap grade akhir mengikuti silabus (mis. 9702 Paper 4 = 38,5%).",
    ],
    limitations: [
      "Cambridge menetapkan ambang batas BARU setiap sesi setelah melihat performa peserta.",
      "Ambang di aplikasi ini (A* 90 / A 80 / B 70 / C 60 / D 50 / E 40) adalah rata-rata kasar, bukan angka sesi tertentu — pakai sebagai indikator, jangan sebagai janji.",
    ],
  },
  TKA_SMP: {
    exam: "TKA_SMP",
    method: "Skor mentah per mata pelajaran diskalakan ke 100 poin",
    scale: "0-100 per mata pelajaran; angka gabungan = rata-rata mapel yang dikerjakan",
    howItWorks: [
      "Seluruh soal berbobot sama; skor = 100 x proporsi benar, dengan sedikit pelurusan kurva agar bagian bawah tidak terlalu murah.",
      "Angka gabungan adalah rata-rata, bukan jumlah, sehingga jumlah mata pelajaran yang diambil tidak mengubah skala.",
    ],
    limitations: [
      "Kemendikdasmen belum mempublikasikan rumus penskalaan TKA - kurva ini rancangan sendiri, bukan salinan.",
      "Karena daftar mata pelajaran di blueprint ini adalah keputusan produk dan bukan salinan POS, skor TKA di aplikasi ini adalah indikator latihan, bukan prediksi skor resmi.",
    ],
  },
  TKA_SMA: {
    exam: "TKA_SMA",
    method: "Skor mentah per mata pelajaran diskalakan ke 100 poin",
    scale: "0-100 per mata pelajaran; angka gabungan = rata-rata mapel yang dikerjakan",
    howItWorks: [
      "Seluruh soal berbobot sama; skor = 100 x proporsi benar, dengan sedikit pelurusan kurva.",
      "Peserta hanya mengerjakan mapel wajib ditambah mapel pilihannya, dan rata-rata dipakai supaya kombinasi mapel yang berbeda tetap sebanding.",
    ],
    limitations: [
      "Rumus penskalaan resmi belum dipublikasikan - kurva ini rancangan sendiri.",
      "Cara skor TKA dipakai dalam seleksi masuk perguruan tinggi berada di luar jangkauan aplikasi ini dan berubah antar tahun.",
    ],
  },
};

export const referenceFor = (code: ExamCode) => EXAM_REFERENCE[code];
export const scoringFor = (code: ExamCode) => SCORING_MODELS[code];
