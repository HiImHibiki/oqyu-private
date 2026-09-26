import type { ExamCode, FormSectionLayout, ResponseValue } from "@/lib/types";
import type { Currency } from "@/lib/geo";
import type { ScoreReport } from "@/lib/exams/scoring";

/* =========================================================================
 * Antarmuka penyimpanan.
 * Dua implementasi: `dev` (berkas .data/db.json) dan `supabase` (produksi).
 * Route handler tidak boleh menyentuh salah satunya secara langsung —
 * selalu lewat getDb() di src/lib/db/index.ts.
 * ========================================================================= */

export interface OrderRecord {
  id: string;
  userId: string;
  packageId: string;
  exam: ExamCode;
  /** Nominal yang benar-benar ditagih — sudah dipotong kupon. */
  amount: number;
  currency: Currency;
  status: "pending" | "paid" | "failed" | "expired" | "refunded";
  provider: string;
  providerRef?: string | null;
  createdAt: string;
  paidAt?: string | null;
  /** Kupon yang dipakai, disimpan supaya kampanye bisa dievaluasi. */
  couponCode?: string | null;
  /** Besar potongan dalam mata uang pesanan. `amount` sudah bersih. */
  discount?: number | null;
}

export interface EntitlementRecord {
  id: string;
  userId: string;
  packageId: string;
  exam: ExamCode;
  attemptsTotal: number;
  attemptsUsed: number;
  expiresAt?: string | null;
  /** Pesanan yang memberi kuota ini — dipakai saat pengembalian dana. */
  orderId?: string | null;
}

export interface AttemptRecord {
  id: string;
  userId: string;
  exam: ExamCode;
  formTitle: string;
  isDemo: boolean;
  status: "in_progress" | "submitted" | "expired" | "voided";
  /** indeks section yang sedang dikerjakan */
  currentSection: number;
  /** kode section -> tenggat absolut ISO. Server yang memegang ini, bukan browser. */
  sectionDeadlines: Record<string, string>;
  /** susunan paket yang dibekukan saat attempt dibuat */
  formLayout: FormSectionLayout[];
  /** Id soal esai dalam paket ini, ditulis saat attempt ditutup.
   *
   *  Disimpan supaya antrean penilai bisa dibangun tanpa membuka bank soal —
   *  dan supaya soal yang kemudian dipensiunkan tetap muncul untuk dinilai
   *  kalau ada yang sudah mengerjakannya. */
  pendingRubric?: string[];
  /** Nilai esai per soal, diisi pengajar setelah ujian selesai.
   *  Soal rubrik yang belum ada di sini DIKELUARKAN dari skor — bukan
   *  dianggap salah. */
  marks?: Record<string, RubricMark>;
  /** Pengali waktu akomodasi yang berlaku untuk attempt ini (1 = normal,
   *  1.5 = waktu setengah lagi, 2 = waktu ganda).
   *
   *  Durasinya sudah ikut dikalikan ke dalam `formLayout`, jadi angka ini
   *  hanya untuk ditampilkan dan diaudit. Dibekukan bersama attempt karena
   *  alasan yang sama seperti susunan paket: mengubah pengaturan peserta di
   *  tengah ujian tidak boleh mengubah ujian yang sedang berjalan — ke arah
   *  mana pun. */
  timeMultiplier?: number;
  /** Hasil routing modul adaptif: kode section -> varian yang dipilih.
   *  Ditulis sekali oleh server saat peserta meninggalkan modul 1, dan tidak
   *  pernah diubah lagi — mengulanginya akan membuat peserta bisa mencoba
   *  kedua varian. */
  routing?: Record<string, "easier" | "harder">;
  responses: Record<string, ResponseValue>;
  score?: ScoreReport | null;
  integrity?: unknown;
  startedAt: string;
  submittedAt?: string | null;
}


/* Nilai satu jawaban esai.
 *
 * Disimpan per attempt, bukan per soal: rubriknya milik soal, tetapi
 * penerapannya milik jawaban seseorang. Menyimpan siapa dan kapan bukan
 * kelengkapan administratif — tanpa itu, «sudah dinilai guru» hanyalah klaim
 * yang tidak bisa ditelusuri saat peserta mempersoalkan nilainya. */
export interface RubricMark {
  /** Poin yang diberikan per kriteria, urutannya sama dengan rubrik soal. */
  awarded: number[];
  /** Jumlah poin. Dihitung ulang di server, tidak dipercaya dari browser. */
  total: number;
  /** Umpan balik untuk peserta. Inilah yang membuat esai berguna dilatih. */
  comment?: string;
  by: string;                 // email penilai
  at: string;                 // ISO timestamp
}

export interface ItemOutcomeRow {
  questionId: string;
  sectionCode: string;
  position: number;
  credit: number;
  correct: boolean;
  timeSpentSec: number;
  flagged: boolean;
}

export interface SaveResult {
  ok: boolean;
  /** true bila tenggat section sudah lewat — jawaban ditolak */
  expired?: boolean;
  serverNow: string;
}

export interface Db {
  /* --- pesanan & kuota --- */
  createOrder(input: {
    userId: string; packageId: string; exam: ExamCode; amount: number; currency: Currency; provider: string;
    couponCode?: string | null; discount?: number | null;
  }): Promise<OrderRecord>;
  getOrder(id: string): Promise<OrderRecord | null>;
  /** Riwayat pesanan satu peserta, terbaru dulu. */
  ordersOf(userId: string): Promise<OrderRecord[]>;
  /** Berapa kali satu kode kupon sudah dipakai pada pesanan yang LUNAS.
   *  Pesanan pending tidak dihitung: kalau dihitung, satu orang bisa
   *  menghabiskan kuota kampanye hanya dengan membuka halaman checkout. */
  countCouponUses(code: string): Promise<number>;
  getOrderByRef(ref: string): Promise<OrderRecord | null>;
  markOrderPaid(id: string, attemptsGranted: number, providerRef?: string): Promise<OrderRecord | null>;
  /** Mengembalikan dana satu pesanan: status menjadi `refunded`, sisa kuota
   *  dicabut, dan komisi afiliasi atas pesanan itu dibatalkan.
   *
   *  Idempoten: pesanan yang sudah `refunded` dikembalikan apa adanya.
   *  Kuota yang SUDAH TERPAKAI tidak diutak-atik — riwayat attempt peserta
   *  tetap utuh; yang dicabut hanya sisanya. */
  /** Menutup pesanan yang tidak jadi dibayar. Hanya berlaku dari `pending`:
   *  notifikasi «deny» yang datang terlambat tidak boleh menurunkan pesanan
   *  yang sudah lunas. */
  setOrderStatus(id: string, status: "failed" | "expired"): Promise<OrderRecord | null>;
  refundOrder(id: string): Promise<{
    order: OrderRecord;
    attemptsRevoked: number;
    commissionsVoided: number;
  } | null>;
  entitlements(userId: string): Promise<EntitlementRecord[]>;

  /* --- attempt --- */
  /** Attempt dibuat TANPA tenggat. Jam ujian baru berjalan saat startSection()
   *  dipanggil — supaya siswa tidak kehilangan waktu di layar persiapan. */
  createAttempt(input: {
    userId: string; exam: ExamCode; formTitle: string; isDemo: boolean;
    formLayout: FormSectionLayout[];
    timeMultiplier?: number;
  }): Promise<AttemptRecord>;
  getAttempt(id: string): Promise<AttemptRecord | null>;
  /** Mulai (atau lanjutkan) satu section dan tetapkan tenggatnya di server. */
  startSection(id: string, index: number, section: { code: string; durationSec: number }): Promise<AttemptRecord | null>;
  /** Mencatat varian modul adaptif yang dipilih. Menulis dua kali diabaikan —
   *  keputusan routing tidak boleh dapat diulang oleh peserta. */
  setRouting(id: string, sectionCode: string, variant: "easier" | "harder"): Promise<AttemptRecord | null>;
  saveResponses(id: string, sectionCode: string, responses: Record<string, ResponseValue>): Promise<SaveResult>;
  submitAttempt(
    id: string,
    score: ScoreReport,
    integrity: unknown,
    responses: Record<string, ResponseValue>,
    /** hasil penilaian per soal, dimaterialisasi untuk analitik butir */
    items?: ItemOutcomeRow[],
    /** Id soal esai dalam paket ini — antrean penilai dibangun dari sini. */
    pendingRubric?: string[],
  ): Promise<AttemptRecord | null>;
  /** Memperbarui skor attempt yang SUDAH ditutup, setelah esainya dinilai.
   *
   *  Terpisah dari `submitAttempt` yang sengaja hanya menerima attempt
   *  berstatus `in_progress` — penjagaan itu mencegah pengiriman ganda dan
   *  tidak boleh dilonggarkan hanya supaya penilaian ulang bisa lewat. */
  rescoreAttempt(
    id: string,
    score: ScoreReport,
    items?: ItemOutcomeRow[],
  ): Promise<AttemptRecord | null>;
  attemptsOf(userId: string): Promise<AttemptRecord[]>;

  /* --- papan peringkat --- */
}

/** Antarmuka penuh yang dipakai getDb(). */
export type FullDb = Db & AffiliateDb;

/** Toleransi keterlambatan jaringan sebelum jawaban dianggap lewat tenggat. */
export const GRACE_SEC = 10;

export function isExpired(deadlineIso: string | undefined, now = Date.now()) {
  if (!deadlineIso) return false;
  return now > new Date(deadlineIso).getTime() + GRACE_SEC * 1000;
}

export function shortName(full: string) {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Peserta";
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
}

/* =========================================================================
 * Program afiliasi
 *
 * Alurnya:
 *   1. Pengguna mendaftar jadi afiliasi -> dapat kode unik
 *   2. Tautan /r/<kode> mencatat klik lalu menaruh cookie 30 hari
 *   3. Saat pendaftaran, cookie itu mengikat pendaftar ke kode tersebut
 *   4. Saat pesanan LUNAS (hanya dari webhook), komisi dibuat berstatus
 *      `pending`; pendaftar juga mendapat 1 kuota bonus untuk pesanan
 *      pertamanya
 *   5. Setelah masa refund lewat, admin menyetujui komisi lalu membayarnya
 *
 * Komisi tidak pernah dibuat dari sisi browser, sama seperti kuota.
 * ========================================================================= */

export interface AffiliateRecord {
  userId: string;
  code: string;
  /** porsi komisi, mis. 0.15 = 15% */
  rate: number;
  status: "active" | "suspended";
  payoutMethod?: PayoutMethod | null;
  createdAt: string;
}

export interface PayoutMethod {
  type: "bank" | "ewallet";
  provider: string;      // "BCA", "GoPay", ...
  accountNumber: string;
  accountName: string;
}

export interface ReferralRecord {
  id: string;
  code: string;
  referredUserId: string;
  referredName?: string;
  createdAt: string;
  firstOrderId?: string | null;
  converted: boolean;
}

export interface CommissionRecord {
  id: string;
  affiliateUserId: string;
  referredUserId: string;
  orderId: string;
  amount: number;
  currency: Currency;
  rate: number;
  status: "pending" | "approved" | "paid" | "void";
  createdAt: string;
  paidAt?: string | null;
}

export interface PayoutRecord {
  id: string;
  affiliateUserId: string;
  affiliateName?: string;
  amount: number;
  currency: Currency;
  status: "requested" | "paid" | "rejected";
  method?: PayoutMethod | null;
  note?: string | null;
  requestedAt: string;
  paidAt?: string | null;
}

/** Saldo komisi untuk SATU mata uang. */
export interface AffiliateBalance {
  currency: Currency;
  pending: number;
  approved: number;
  paid: number;
  /** siap dicairkan = approved - yang sedang diajukan */
  withdrawable: number;
}

export interface AffiliateStats {
  clicks: number;
  signups: number;
  conversions: number;
  /* Saldo DIPISAH per mata uang.
   *
   * Sebelumnya seluruh komisi dijumlahkan menjadi satu angka lalu dilabeli
   * dengan mata uang komisi yang kebetulan pertama. Seorang afiliasi dengan
   * satu pembeli Indonesia (komisi Rp 52.350) dan satu pembeli Amerika
   * (komisi US$ 9) melihat «Rp 52.359» — angka yang bukan rupiah, bukan dolar,
   * dan tidak bisa dibayarkan. Aplikasi ini memang menjual dalam empat mata
   * uang, jadi keadaan itu wajar terjadi, bukan kasus pinggiran.
   *
   * Tidak dikonversi ke satu mata uang karena aplikasi ini tidak punya kurs —
   * mengarang kurs akan menukar kesalahan yang kelihatan dengan kesalahan yang
   * tersembunyi. */
  balances: AffiliateBalance[];
  /* Nilai utama untuk tampilan ringkas: mata uang dengan komisi terbanyak.
   * Selalu berasal dari SATU mata uang, tidak pernah campuran. */
  pendingIdr: number;
  approvedIdr: number;
  paidIdr: number;
  currency: Currency;
  withdrawableIdr: number;
}

export interface AdminOverview {
  users: number;
  paidOrders: number;
  revenueIdr: number;
  attempts: number;
  submitted: number;
  demoAttempts: number;
  affiliates: number;
  /** Komisi terutang DALAM RUPIAH saja.
   *
   *  Sebelumnya kolom ini menjumlahkan seluruh mata uang lalu menyebutnya
   *  rupiah — persis kesalahan yang sudah dihindari `revenueIdr` tepat di
   *  atasnya, yang memang memfilter `currency === "IDR"`. */
  commissionOwedIdr: number;
  /** Komisi terutang per mata uang, supaya yang bukan rupiah tidak hilang. */
  commissionOwed: Partial<Record<Currency, number>>;
  payoutsRequested: number;
  flaggedAttempts: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  school?: string | null;
  role: string;
  createdAt: string;
  attempts: number;
  quotaLeft: number;
  referredBy?: string | null;
  /** Akomodasi waktu: 1, 1.5, atau 2. */
  timeMultiplier: number;
}

export interface AffiliateDb {
  /* ---------------------------------------------------------- afiliasi */
  getAffiliate(userId: string): Promise<AffiliateRecord | null>;
  createAffiliate(userId: string, code: string, rate: number): Promise<AffiliateRecord>;
  affiliateByCode(code: string): Promise<AffiliateRecord | null>;
  updatePayoutMethod(userId: string, method: PayoutMethod): Promise<void>;
  recordClick(code: string): Promise<void>;
  attachReferral(code: string, referredUserId: string): Promise<void>;
  referralOfUser(userId: string): Promise<ReferralRecord | null>;
  referralsOf(affiliateUserId: string): Promise<ReferralRecord[]>;
  createCommission(input: {
    affiliateUserId: string; referredUserId: string; orderId: string;
    amount: number; currency: Currency; rate: number;
  }): Promise<CommissionRecord | null>;
  commissionsOf(affiliateUserId: string): Promise<CommissionRecord[]>;
  affiliateStats(affiliateUserId: string): Promise<AffiliateStats>;
  requestPayout(userId: string, amount: number, currency: Currency, method?: PayoutMethod | null): Promise<PayoutRecord | null>;
  payoutsOf(userId: string): Promise<PayoutRecord[]>;
  /** kuota bonus untuk pendaftar yang datang lewat tautan afiliasi */
  grantBonusAttempt(userId: string, exam: ExamCode, packageId: string): Promise<void>;
  /** Akomodasi waktu peserta (1, 1.5, 2). Hanya dipanggil dari jalur admin. */
  setTimeMultiplier(userId: string, multiplier: number): Promise<void>;
  /** Menyimpan nilai esai. Skor attempt dihitung ulang oleh pemanggilnya. */
  setRubricMark(attemptId: string, questionId: string, mark: RubricMark | null): Promise<AttemptRecord | null>;
  /** Attempt yang punya jawaban esai belum dinilai — antrean pengajar. */
  attemptsAwaitingMarks(limit?: number): Promise<(AttemptRecord & { fullName?: string })[]>;

  /* ------------------------------------------------------------- admin */
  adminOverview(): Promise<AdminOverview>;
  listUsers(q?: string, limit?: number): Promise<AdminUserRow[]>;
  listOrders(limit?: number): Promise<(OrderRecord & { email?: string; fullName?: string })[]>;
  listAffiliates(): Promise<(AffiliateRecord & { fullName?: string; email?: string } & AffiliateStats)[]>;
  listPayouts(status?: PayoutRecord["status"]): Promise<PayoutRecord[]>;
  setPayoutStatus(id: string, status: PayoutRecord["status"], note?: string): Promise<void>;
  setCommissionStatus(ids: string[], status: CommissionRecord["status"]): Promise<void>;
  setUserRole(userId: string, role: string): Promise<void>;
  recentAttempts(limit?: number): Promise<(AttemptRecord & { fullName?: string })[]>;
}
