import { packageById } from "@/lib/packages";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { ExamCode, ResponseValue } from "@/lib/types";
import type { ScoreReport } from "@/lib/exams/scoring";
import {
  isExpired, shortName,
  type AdminOverview, type AdminUserRow, type AffiliateRecord, type AffiliateStats,
  type AttemptRecord, type CommissionRecord, type EntitlementRecord, type FullDb,
  type LeaderRow, type OrderRecord, type PayoutMethod, type PayoutRecord,
  type ReferralRecord, type SaveResult,
  type AffiliateBalance,
} from "./types";
import type { Currency } from "@/lib/geo";

/* Driver pengembangan: menyimpan semuanya di .data/db.json.
 * Aktif otomatis kalau NEXT_PUBLIC_SUPABASE_URL belum diisi, supaya aplikasi
 * bisa dijalankan dan diuji end-to-end sebelum project Supabase dibuat.
 * TIDAK bisa dipakai di Vercel (filesystem baca-saja). */

/* Lokasi berkas bisa dialihkan lewat EXACT_DATA_DIR.
 *
 * Ada untuk pengujian: uji yang membuat attempt, memakai kuota, dan menilai
 * esai harus bisa berjalan tanpa menyentuh data pengembangan yang sedang
 * dipakai. Menyalin-dan-memulihkan .data/db.json di sekeliling setiap uji
 * bekerja sampai satu uji gagal di tengah jalan dan memulihkannya tidak pernah
 * terjadi. */
const FILE = path.join(process.env.EXACT_DATA_DIR || path.join(process.cwd(), ".data"), "db.json");

export interface DevUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  school?: string;
  country?: string;
  themeId: string;
  locale?: string;
  consent?: { terms: string; privacy: string; version: string; ip?: string };
  deletionRequestedAt?: string;
  passwordHash?: string;
  passwordSet: boolean;
  role: string;                 // student | reviewer | admin
  /** Akomodasi waktu: 1 (normal), 1.5, atau 2. Hanya admin yang boleh
   *  menetapkannya — peserta tidak punya jalan untuk mengubahnya sendiri. */
  timeMultiplier?: number;
  referredBy?: string;
  otp?: { code: string; expiresAt: number; attempts: number };
  createdAt: string;
}
export interface DevSession { token: string; userId: string; expiresAt: number }

interface Shape {
  users: DevUser[];
  orders: OrderRecord[];
  entitlements: EntitlementRecord[];
  attempts: AttemptRecord[];
  sessions: DevSession[];
  affiliates: AffiliateRecord[];
  referrals: ReferralRecord[];
  clicks: { code: string; at: string }[];
  commissions: CommissionRecord[];
  payouts: PayoutRecord[];
}

const empty: Shape = {
  users: [], orders: [], entitlements: [], attempts: [], sessions: [],
  affiliates: [], referrals: [], clicks: [], commissions: [], payouts: [],
};

/* Baca–ubah–tulis dijalankan berurutan.
 *
 * Setiap operasi driver ini membaca seluruh berkas, mengubah satu bagian, lalu
 * menulisnya kembali. Dua permintaan yang tumpang tindih — dua tab ujian yang
 * autosave bersamaan sudah cukup — membaca keadaan yang sama, lalu saling
 * menimpa: perubahan yang satu hilang tanpa jejak. Rantai janji ini membuat
 * setiap operasi menunggu giliran. */
let antrean: Promise<unknown> = Promise.resolve();
function berurutan<T>(fn: () => Promise<T>): Promise<T> {
  const hasil = antrean.then(fn, fn);
  antrean = hasil.catch(() => {});
  return hasil;
}

/* Bungkus setiap metode sebuah objek supaya berjalan berurutan.
 *
 * Metodenya di-`apply` ke objek MENTAH, bukan ke hasil bungkusan. Dua alasan,
 * keduanya diperlukan:
 *
 *   1. Beberapa metode memanggil saudaranya lewat `this` — `login()` memanggil
 *      `this.userByEmail()`. Memanggil `fn(...)` begitu saja membuat `this`
 *      menjadi undefined dan login langsung melempar. Cacat ini sempat masuk
 *      dan tidak tertangkap apa pun sampai ada uji yang benar-benar mencoba
 *      masuk.
 *   2. Panggilan dalam itu TIDAK BOLEH mengantre lagi: metode yang sudah
 *      memegang giliran lalu menunggu metode lain di belakang antrean akan
 *      saling menunggu selamanya. */
function berurutanSemua<T extends Record<string, (...a: never[]) => Promise<unknown>>>(mentah: T): T {
  return Object.fromEntries(
    Object.entries(mentah).map(([nama, fn]) => [
      nama,
      (...args: unknown[]) =>
        berurutan(() => (fn as (...a: unknown[]) => Promise<unknown>).apply(mentah, args)),
    ]),
  ) as unknown as T;
}

async function read(): Promise<Shape> {
  let raw: string;
  try {
    raw = await fs.readFile(FILE, "utf8");
  } catch (e) {
    // Berkas belum ada — wajar saat pertama kali dijalankan.
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(empty);
    throw e;
  }

  try {
    return { ...empty, ...JSON.parse(raw) };
  } catch (e) {
    /* Berkasnya ADA tetapi rusak. Ini TIDAK boleh diperlakukan sama dengan
     * «belum ada».
     *
     * Versi sebelumnya menangkap kedua hal itu bersama dan mengembalikan
     * basis data kosong. Konsekuensinya jauh lebih buruk daripada satu galat:
     * pemanggil berikutnya menulis balik keadaan kosong itu, dan seluruh
     * pengguna, attempt, pesanan, serta entitlement lenyap — kerusakan kecil
     * pada satu tulisan berubah menjadi kehilangan total. Lebih baik gagal
     * dengan berisik dan menyisakan berkasnya utuh untuk diperbaiki. */
    throw new Error(
      `.data/db.json rusak dan tidak bisa dibaca: ${e instanceof Error ? e.message : e}. ` +
      "Berkasnya sengaja TIDAK ditimpa — perbaiki atau pulihkan dari cadangan.",
    );
  }
}
async function write(d: Shape) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  /* Tulis ke berkas sementara lalu ganti namanya.
   *
   * `writeFile` memotong berkas lebih dulu baru mengisinya, sehingga tulisan
   * yang terputus di tengah — atau dua tulisan yang bersinggungan —
   * meninggalkan JSON yang tercabik. Itu yang sudah terjadi: berkasnya
   * berakhir dengan «}}» dan seluruh basis data tidak bisa dibaca lagi.
   * `rename` bersifat atomik pada POSIX: pembaca melihat berkas lama yang utuh
   * atau berkas baru yang utuh, tidak pernah setengah-setengah. */
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(d, null, 2));
  await fs.rename(tmp, FILE);
}

export const uid = () => crypto.randomUUID();
/* Hash kata sandi: scrypt dengan garam per pengguna.
 *
 * Sebelumnya SHA-256 polos dengan satu imbuhan tetap. SHA-256 dirancang untuk
 * CEPAT — itu justru yang tidak diinginkan dari hash kata sandi. Satu GPU
 * biasa menghitung miliaran SHA-256 per detik, jadi bila berkas datanya bocor,
 * sandi yang lazim terpecahkan dalam hitungan detik. Imbuhan tetap juga bukan
 * garam: dua orang dengan sandi sama menghasilkan hash sama, sehingga satu
 * tabel pelangi cukup untuk seluruh pengguna.
 *
 * scrypt lambat dan haus memori secara sengaja, dan garamnya berbeda untuk
 * setiap orang. Tersedia di modul `crypto` bawaan Node — tanpa dependensi
 * tambahan.
 *
 * Format: "scrypt$<garam heksa>$<hash heksa>". Awalannya ada supaya hash lama
 * masih bisa dikenali dan ditingkatkan, bukan membuat orang terkunci di luar. */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

export function hashPw(pw: string, garamHex?: string): string {
  const garam = garamHex ? Buffer.from(garamHex, "hex") : crypto.randomBytes(16);
  const kunci = crypto.scryptSync(pw, garam, SCRYPT.keylen, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p,
    maxmem: 128 * SCRYPT.N * SCRYPT.r * 2,
  });
  return `scrypt$${garam.toString("hex")}$${kunci.toString("hex")}`;
}

/** Hash lama: SHA-256 dengan imbuhan tetap. Hanya untuk MEMERIKSA sandi yang
 *  sudah tersimpan sebelum peralihan — tidak pernah dipakai menulis yang baru. */
const hashPwLama = (pw: string) => crypto.createHash("sha256").update(pw + "::exact").digest("hex");

/** Bandingkan dalam waktu tetap, supaya lamanya pemeriksaan tidak membocorkan
 *  berapa banyak karakter awal yang sudah cocok. */
function samaAman(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Apakah `password` cocok dengan hash tersimpan, apa pun formatnya. */
export function cocokPw(password: string, tersimpan: string): boolean {
  if (tersimpan.startsWith("scrypt$")) {
    const [, garam] = tersimpan.split("$");
    return samaAman(hashPw(password, garam), tersimpan);
  }
  return samaAman(hashPwLama(password), tersimpan);      // format lama
}
export const otpCode = () => String(crypto.randomInt(100000, 999999));

/* --------------------------------------------------------------- auth dev */

const devAuthRaw = {

  async upsertUser(input: { email: string; fullName: string; phone: string; school?: string; country?: string }) {
    const d = await read();
    const email = input.email.trim().toLowerCase();
    let u = d.users.find((x) => x.email === email);
    if (!u) {
      u = {
        id: uid(), email, fullName: input.fullName, phone: input.phone,
        school: input.school, country: input.country,
        themeId: "porcelain", passwordSet: false, role: bootstrapRole(email),
        createdAt: new Date().toISOString(),
      };
      d.users.push(u);
    } else {
      u.fullName = input.fullName || u.fullName;
      u.phone = input.phone || u.phone;
      if (input.school) u.school = input.school;
      if (input.country) u.country = input.country;
    }
    await write(d);
    return u;
  },

  async userById(id: string) {
    return (await read()).users.find((u) => u.id === id) ?? null;
  },

  async userByEmail(email: string) {
    return (await read()).users.find((u) => u.email === email.trim().toLowerCase()) ?? null;
  },

  async setOtp(email: string) {
    const d = await read();
    const u = d.users.find((x) => x.email === email.trim().toLowerCase());
    if (!u) return null;
    const code = otpCode();
    u.otp = { code, expiresAt: Date.now() + 10 * 60_000, attempts: 0 };
    await write(d);
    return code;
  },

  async verifyOtp(email: string, code: string) {
    const d = await read();
    const u = d.users.find((x) => x.email === email.trim().toLowerCase());
    if (!u?.otp) return { ok: false as const, reason: "OTP belum diminta" };
    if (u.otp.attempts >= 5) return { ok: false as const, reason: "Terlalu banyak percobaan. Minta kode baru." };
    u.otp.attempts++;
    if (Date.now() > u.otp.expiresAt) { await write(d); return { ok: false as const, reason: "Kode kedaluwarsa" }; }
    if (u.otp.code !== code) { await write(d); return { ok: false as const, reason: "Kode salah" }; }
    delete u.otp;
    await write(d);
    return { ok: true as const, userId: u.id };
  },

  async setPassword(userId: string, password: string) {
    const d = await read();
    const u = d.users.find((x) => x.id === userId);
    if (!u) return false;
    u.passwordHash = hashPw(password);                   // selalu format baru
    u.passwordSet = true;
    await write(d);
    return true;
  },

  async login(email: string, password: string) {
    const u = await this.userByEmail(email);
    if (!u?.passwordHash || !cocokPw(password, u.passwordHash)) return null;

    /* Tingkatkan hash lama saat sandinya terbukti benar.
     *
     * Ini satu-satunya saat sandi asli tersedia, jadi satu-satunya kesempatan
     * mengubah formatnya tanpa meminta orang menyetel ulang sandinya. */
    if (!u.passwordHash.startsWith("scrypt$")) {
      const d = await read();
      const rec = d.users.find((x) => x.id === u.id);
      if (rec) { rec.passwordHash = hashPw(password); await write(d); }
    }
    return u;
  },

  /** Akhiri SELURUH sesi milik satu pengguna, termasuk yang sedang berjalan.
   *
   *  Sengaja termasuk sesi saat ini: orang yang menekan tombol ini biasanya
   *  menduga akunnya dipakai orang lain, dan menyisakan satu sesi hidup —
   *  entah miliknya atau milik penyusup — membuat tindakannya setengah jadi.
   *  Lebih baik semua putus lalu ia masuk lagi. */
  async dropAllSessions(userId: string) {
    const d = await read();
    const sebelum = d.sessions.length;
    d.sessions = d.sessions.filter((s) => s.userId !== userId);
    await write(d);
    return sebelum - d.sessions.length;
  },

  async setLocale(userId: string, locale: string) {
    const d = await read();
    const u = d.users.find((x) => x.id === userId);
    if (!u) return false;
    u.locale = locale;
    await write(d);
    return true;
  },

  async setTheme(userId: string, themeId: string) {
    const d = await read();
    const u = d.users.find((x) => x.id === userId);
    if (!u) return false;
    u.themeId = themeId;
    await write(d);
    return true;
  },

  async createSession(userId: string) {
    const d = await read();
    const token = crypto.randomBytes(24).toString("hex");
    d.sessions = d.sessions.filter((s) => s.expiresAt > Date.now());
    d.sessions.push({ token, userId, expiresAt: Date.now() + 7 * 864e5 });
    await write(d);
    return token;
  },

  async userByToken(token?: string) {
    if (!token) return null;
    const d = await read();
    const s = d.sessions.find((x) => x.token === token && x.expiresAt > Date.now());
    return s ? d.users.find((u) => u.id === s.userId) ?? null : null;
  },

  async dropSession(token?: string) {
    if (!token) return;
    const d = await read();
    d.sessions = d.sessions.filter((s) => s.token !== token);
    await write(d);
  },
};

/* ---------------------------------------------------------------- data dev */

/** Email di ADMIN_EMAILS langsung menjadi admin — cara membuat admin pertama
 *  tanpa perlu menyentuh basis data. */
function bootstrapRole(email: string) {
  const list = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase()) ? "admin" : "student";
}

const devDbRaw: FullDb = {
  async createOrder(input) {
    const d = await read();
    const o: OrderRecord = {
      id: uid(), userId: input.userId, packageId: input.packageId, exam: input.exam,
      amount: input.amount, currency: input.currency, status: "pending", provider: input.provider,
      createdAt: new Date().toISOString(),
      ...(input.couponCode ? { couponCode: input.couponCode, discount: input.discount ?? 0 } : {}),
    };
    d.orders.push(o);
    await write(d);
    return o;
  },

  async getOrder(id) {
    return (await read()).orders.find((o) => o.id === id) ?? null;
  },

  async getOrderByRef(ref) {
    return (await read()).orders.find((o) => o.providerRef === ref || o.id === ref) ?? null;
  },

  async ordersOf(userId) {
    return (await read()).orders
      .filter((o) => o.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async countCouponUses(code) {
    const c = code.toUpperCase();
    return (await read()).orders.filter((o) => o.status === "paid" && o.couponCode === c).length;
  },

  async markOrderPaid(id, attemptsGranted, providerRef) {
    const d = await read();
    const o = d.orders.find((x) => x.id === id);
    if (!o) return null;
    if (o.status === "paid") return o;              // idempoten — webhook bisa datang dua kali
    o.status = "paid";
    o.paidAt = new Date().toISOString();
    if (providerRef) o.providerRef = providerRef;
    d.entitlements.push({
      id: uid(), userId: o.userId, packageId: o.packageId, exam: o.exam,
      attemptsTotal: attemptsGranted, attemptsUsed: 0,
      // Paket berjangka (latihan mingguan/bulanan) kedaluwarsa sesuai `days`-nya.
      expiresAt: new Date(Date.now() + (packageById(o.packageId)?.days ?? 365) * 864e5).toISOString(),
      orderId: o.id,
    });
    await write(d);
    return o;
  },

  async entitlements(userId) {
    return (await read()).entitlements.filter((e) => e.userId === userId);
  },

  async setOrderStatus(id, status) {
    const d = await read();
    const o = d.orders.find((x) => x.id === id);
    if (!o) return null;
    if (o.status !== "pending") return o;      // lunas atau sudah ditutup — jangan disentuh
    o.status = status;
    await write(d);
    return o;
  },

  async refundOrder(id) {
    const d = await read();
    const o = d.orders.find((x) => x.id === id);
    if (!o) return null;
    if (o.status === "refunded") return { order: o, attemptsRevoked: 0, commissionsVoided: 0 };

    o.status = "refunded";

    /* Kuota yang diberikan pesanan ini dicabut dengan menyamakan jatah
     * dengan yang sudah terpakai, bukan dengan menghapus barisnya. Attempt
     * yang sudah dikerjakan tetap punya asal-usul yang bisa ditelusuri, dan
     * hitungan «kuota terpakai» di panel admin tidak berubah maknanya. */
    const mine = d.entitlements.filter((e) =>
      e.orderId ? e.orderId === o.id
        : e.userId === o.userId && e.packageId === o.packageId && e.exam === o.exam,
    );
    let attemptsRevoked = 0;
    for (const e of mine) {
      const sisa = e.attemptsTotal - e.attemptsUsed;
      if (sisa <= 0) continue;
      attemptsRevoked += sisa;
      e.attemptsTotal = e.attemptsUsed;
    }

    let commissionsVoided = 0;
    for (const c of d.commissions ?? []) {
      if (c.orderId !== o.id || c.status === "void" || c.status === "paid") continue;
      c.status = "void";
      commissionsVoided++;
    }

    await write(d);
    return { order: o, attemptsRevoked, commissionsVoided };
  },

  async createAttempt(input) {
    const d = await read();
    const now = Date.now();
    const at: AttemptRecord = {
      id: uid(),
      userId: input.userId,
      exam: input.exam,
      formTitle: input.formTitle,
      isDemo: input.isDemo,
      status: "in_progress",
      currentSection: 0,
      sectionDeadlines: {},          // diisi saat startSection()
      formLayout: input.formLayout,
      ...(input.timeMultiplier && input.timeMultiplier !== 1
        ? { timeMultiplier: input.timeMultiplier }
        : {}),
      responses: {},
      startedAt: new Date(now).toISOString(),
    };
    /* Kuota diambil SEBELUM attempt dibuat, dan habisnya kuota adalah
     * kegagalan — bukan sesuatu yang boleh dilewati diam-diam.
     *
     * Versi sebelumnya menaikkan `attemptsUsed` hanya kalau ada entitlement
     * yang masih bersisa, lalu tetap membuat attempt-nya. Akibatnya begitu
     * kuota habis, attempt berbayar menjadi gratis tanpa batas: terukur 41
     * attempt terhadap total kuota 24. Driver Supabase melempar
     * «Kuota try out habis» dalam keadaan yang sama, jadi paywall-nya ada di
     * produksi tetapi tidak ada di mode pengembangan — dan justru mode itulah
     * yang dipakai untuk mengujinya. */
    if (!input.isDemo && input.exam !== "LATIHAN") {
      const ent = d.entitlements.find(
        (e) =>
          e.userId === input.userId &&
          e.exam === input.exam &&
          e.attemptsUsed < e.attemptsTotal &&
          (!e.expiresAt || new Date(e.expiresAt).getTime() > now),
      );
      if (!ent) throw new Error("Kuota try out habis");
      ent.attemptsUsed++;
    }

    d.attempts.push(at);
    await write(d);
    return at;
  },

  async getAttempt(id) {
    return (await read()).attempts.find((a) => a.id === id) ?? null;
  },

  async startSection(id, index, section) {
    const d = await read();
    const a = d.attempts.find((x) => x.id === id);
    if (!a || a.status !== "in_progress") return null;
    // tenggat hanya ditetapkan sekali; membuka ulang section tidak menambah waktu
    if (!a.sectionDeadlines[section.code]) {
      a.sectionDeadlines[section.code] = new Date(Date.now() + section.durationSec * 1000).toISOString();
    }
    a.currentSection = index;
    await write(d);
    return a;
  },

  async setRouting(id, sectionCode, variant) {
    const d = await read();
    const a = d.attempts.find((x) => x.id === id);
    if (!a || a.status !== "in_progress") return null;
    a.routing = a.routing ?? {};
    // sekali ditulis, tidak pernah berubah
    if (!a.routing[sectionCode]) { a.routing[sectionCode] = variant; await write(d); }
    return a;
  },

  async saveResponses(id, sectionCode, responses): Promise<SaveResult> {
    const d = await read();
    const a = d.attempts.find((x) => x.id === id);
    const serverNow = new Date().toISOString();
    if (!a) return { ok: false, serverNow };
    if (isExpired(a.sectionDeadlines[sectionCode])) return { ok: false, expired: true, serverNow };
    a.responses = { ...a.responses, ...responses };
    await write(d);
    return { ok: true, serverNow };
  },

  async rescoreAttempt(id, score, _items) {
    const d = await read();
    const a = d.attempts.find((x) => x.id === id);
    if (!a || a.status !== "submitted") return null;
    a.score = score;
    void _items;
    await write(d);
    return a;
  },

  async submitAttempt(id, score, integrity, responses, _items, pendingRubric) {
    const d = await read();
    const a = d.attempts.find((x) => x.id === id);
    if (!a) return null;
    a.responses = responses;
    a.score = score;
    a.integrity = integrity;
    a.status = "submitted";
    a.submittedAt = new Date().toISOString();
    if (pendingRubric?.length) a.pendingRubric = pendingRubric;
    void _items;   // driver berkas tidak menyimpan analitik butir
    await write(d);
    return a;
  },

  async attemptsOf(userId) {
    return (await read()).attempts
      .filter((a) => a.userId === userId)
      .sort((x, y) => y.startedAt.localeCompare(x.startedAt));
  },

  async leaderboard(exam): Promise<LeaderRow[]> {
    const d = await read();
    const byUser = new Map<string, { totals: number[]; name: string; school?: string }>();
    for (const a of d.attempts) {
      if (a.exam !== exam || a.status !== "submitted" || a.isDemo || !a.score) continue;
      const integrity = (a.integrity as { integrityScore?: number } | undefined)?.integrityScore ?? 100;
      if (integrity < 60) continue;                  // attempt bermasalah tidak masuk papan
      const u = d.users.find((x) => x.id === a.userId);
      const cur = byUser.get(a.userId) ?? { totals: [], name: u?.fullName ?? "Peserta", school: u?.school };
      cur.totals.push((a.score as ScoreReport).total ?? 0);
      byUser.set(a.userId, cur);
    }
    return [...byUser.entries()]
      .map(([userId, v]) => ({
        userId,
        displayName: shortName(v.name),
        school: v.school,
        attempts: v.totals.length,
        avgTotal: Math.round((v.totals.reduce((a, b) => a + b, 0) / v.totals.length) * 10) / 10,
        bestTotal: Math.max(...v.totals),
      }))
      .sort((a, b) => b.bestTotal - a.bestTotal)
      .map((r, i) => ({ rank: i + 1, ...r }));
  },

  /* ---------------------------------------------------------- afiliasi */

  async getAffiliate(userId) {
    return (await read()).affiliates.find((a) => a.userId === userId) ?? null;
  },

  async createAffiliate(userId, code, rate) {
    const d = await read();
    const existing = d.affiliates.find((a) => a.userId === userId);
    if (existing) return existing;
    const rec: AffiliateRecord = {
      userId, code, rate, status: "active", payoutMethod: null,
      createdAt: new Date().toISOString(),
    };
    d.affiliates.push(rec);
    await write(d);
    return rec;
  },

  async affiliateByCode(code) {
    const up = code.toUpperCase();
    return (await read()).affiliates.find((a) => a.code.toUpperCase() === up) ?? null;
  },

  async updatePayoutMethod(userId, method) {
    const d = await read();
    const a = d.affiliates.find((x) => x.userId === userId);
    if (a) { a.payoutMethod = method; await write(d); }
  },

  async recordClick(code) {
    const d = await read();
    d.clicks.push({ code: code.toUpperCase(), at: new Date().toISOString() });
    if (d.clicks.length > 5000) d.clicks = d.clicks.slice(-5000);
    await write(d);
  },

  async attachReferral(code, referredUserId) {
    const d = await read();
    if (d.referrals.some((r) => r.referredUserId === referredUserId)) return;   // sekali seumur akun
    const aff = d.affiliates.find((a) => a.code.toUpperCase() === code.toUpperCase());
    if (!aff || aff.userId === referredUserId) return;                          // tidak boleh merujuk diri sendiri
    d.referrals.push({
      id: uid(), code: aff.code, referredUserId,
      createdAt: new Date().toISOString(), converted: false,
    });
    const u = d.users.find((x) => x.id === referredUserId);
    if (u) u.referredBy = aff.code;
    await write(d);
  },

  async referralOfUser(userId) {
    return (await read()).referrals.find((r) => r.referredUserId === userId) ?? null;
  },

  async referralsOf(affiliateUserId) {
    const d = await read();
    const aff = d.affiliates.find((a) => a.userId === affiliateUserId);
    if (!aff) return [];
    return d.referrals
      .filter((r) => r.code.toUpperCase() === aff.code.toUpperCase())
      .map((r) => ({ ...r, referredName: shortName(d.users.find((u) => u.id === r.referredUserId)?.fullName ?? "") }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createCommission(input) {
    const d = await read();
    if (d.commissions.some((c) => c.orderId === input.orderId)) return null;    // idempoten
    const rec: CommissionRecord = {
      id: uid(), affiliateUserId: input.affiliateUserId, referredUserId: input.referredUserId,
      orderId: input.orderId, amount: input.amount, currency: input.currency, rate: input.rate,
      status: "pending", createdAt: new Date().toISOString(),
    };
    d.commissions.push(rec);
    const ref = d.referrals.find((r) => r.referredUserId === input.referredUserId);
    if (ref && !ref.firstOrderId) { ref.firstOrderId = input.orderId; ref.converted = true; }
    await write(d);
    return rec;
  },

  async commissionsOf(affiliateUserId) {
    return (await read()).commissions
      .filter((c) => c.affiliateUserId === affiliateUserId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async affiliateStats(affiliateUserId): Promise<AffiliateStats> {
    const d = await read();
    const aff = d.affiliates.find((a) => a.userId === affiliateUserId);
    const code = aff?.code.toUpperCase() ?? "";
    const mine = d.commissions.filter((c) => c.affiliateUserId === affiliateUserId);
    const cair = d.payouts.filter((p) => p.affiliateUserId === affiliateUserId && p.status === "requested");

    /* Dijumlahkan PER MATA UANG. Menjumlahkan rupiah dengan dolar
     * menghasilkan angka yang bukan keduanya dan tidak bisa dibayarkan. */
    const mataUang = [...new Set(mine.map((c) => c.currency as Currency))];
    const balances: AffiliateBalance[] = mataUang.map((cur) => {
      const punya = mine.filter((c) => c.currency === cur);
      const sum = (st: CommissionRecord["status"]) =>
        punya.filter((c) => c.status === st).reduce((a, c) => a + c.amount, 0);
      const approved = sum("approved");
      const diajukan = cair.filter((p) => p.currency === cur).reduce((a, p) => a + p.amount, 0);
      return {
        currency: cur, pending: sum("pending"), approved, paid: sum("paid"),
        withdrawable: Math.max(0, approved - diajukan),
      };
    }).sort((a, b) => b.pending + b.approved + b.paid - (a.pending + a.approved + a.paid));

    const utama = balances[0] ?? {
      currency: "IDR" as Currency, pending: 0, approved: 0, paid: 0, withdrawable: 0,
    };
    return {
      clicks: d.clicks.filter((c) => c.code === code).length,
      signups: d.referrals.filter((r) => r.code.toUpperCase() === code).length,
      conversions: mine.filter((c) => c.status !== "void").length,
      balances,
      pendingIdr: utama.pending,
      approvedIdr: utama.approved,
      paidIdr: utama.paid,
      withdrawableIdr: utama.withdrawable,
      currency: utama.currency,
    };
  },

  async requestPayout(userId, amount, currency, method) {
    const d = await read();
    const rec: PayoutRecord = {
      id: uid(), affiliateUserId: userId, amount, currency, status: "requested",
      method: method ?? d.affiliates.find((a) => a.userId === userId)?.payoutMethod ?? null,
      requestedAt: new Date().toISOString(),
    };
    d.payouts.push(rec);
    await write(d);
    return rec;
  },

  async payoutsOf(userId) {
    return (await read()).payouts
      .filter((p) => p.affiliateUserId === userId)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  },

  async grantBonusAttempt(userId, exam, packageId) {
    const d = await read();
    d.entitlements.push({
      id: uid(), userId, packageId: `${packageId}-bonus`, exam,
      attemptsTotal: 1, attemptsUsed: 0,
      expiresAt: new Date(Date.now() + 365 * 864e5).toISOString(),
    });
    await write(d);
  },

  /* ------------------------------------------------------------- admin */

  async adminOverview(): Promise<AdminOverview> {
    const d = await read();
    const paid = d.orders.filter((o) => o.status === "paid");
    return {
      users: d.users.length,
      paidOrders: paid.length,
      revenueIdr: paid.filter((o) => o.currency === "IDR").reduce((a, o) => a + o.amount, 0),
      attempts: d.attempts.length,
      submitted: d.attempts.filter((a) => a.status === "submitted").length,
      demoAttempts: d.attempts.filter((a) => a.isDemo).length,
      affiliates: d.affiliates.length,
      commissionOwedIdr: d.commissions
        .filter((c) => (c.status === "pending" || c.status === "approved") && c.currency === "IDR")
        .reduce((a, c) => a + c.amount, 0),
      commissionOwed: d.commissions
        .filter((c) => c.status === "pending" || c.status === "approved")
        .reduce<Partial<Record<Currency, number>>>((acc, c) => {
          const cur = c.currency as Currency;
          acc[cur] = (acc[cur] ?? 0) + c.amount;
          return acc;
        }, {}),
      payoutsRequested: d.payouts.filter((p) => p.status === "requested").length,
      flaggedAttempts: d.attempts.filter(
        (a) => a.status === "submitted" &&
          ((a.integrity as { integrityScore?: number } | undefined)?.integrityScore ?? 100) < 60,
      ).length,
    };
  },

  async listUsers(q, limit = 100): Promise<AdminUserRow[]> {
    const d = await read();
    const needle = (q ?? "").toLowerCase();
    return d.users
      .filter((u) => !needle || u.email.includes(needle) || u.fullName.toLowerCase().includes(needle))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((u) => ({
        id: u.id, email: u.email, fullName: u.fullName, phone: u.phone, school: u.school ?? null,
        role: u.role, createdAt: u.createdAt, referredBy: u.referredBy ?? null,
        timeMultiplier: u.timeMultiplier ?? 1,
        attempts: d.attempts.filter((a) => a.userId === u.id).length,
        quotaLeft: d.entitlements
          .filter((e) => e.userId === u.id)
          .reduce((a, e) => a + (e.attemptsTotal - e.attemptsUsed), 0),
      }));
  },

  async listOrders(limit = 100) {
    const d = await read();
    return d.orders
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((o) => {
        const u = d.users.find((x) => x.id === o.userId);
        return { ...o, email: u?.email, fullName: u?.fullName };
      });
  },

  async listAffiliates() {
    const d = await read();
    const out = [];
    for (const a of d.affiliates) {
      const u = d.users.find((x) => x.id === a.userId);
      const stats = await this.affiliateStats(a.userId);
      out.push({ ...a, fullName: u?.fullName, email: u?.email, ...stats });
    }
    return out.sort((x, y) => y.paidIdr + y.approvedIdr - (x.paidIdr + x.approvedIdr));
  },

  async listPayouts(status) {
    const d = await read();
    return d.payouts
      .filter((p) => !status || p.status === status)
      .map((p) => ({ ...p, affiliateName: d.users.find((u) => u.id === p.affiliateUserId)?.fullName }))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  },

  async setPayoutStatus(id, status, note) {
    const d = await read();
    const p = d.payouts.find((x) => x.id === id);
    if (!p) return;
    p.status = status;
    if (note) p.note = note;
    if (status === "paid") {
      p.paidAt = new Date().toISOString();
      // tandai komisi yang menutupi nominal pencairan sebagai sudah dibayar
      let left = p.amount;
      for (const c of d.commissions.filter((c) => c.affiliateUserId === p.affiliateUserId && c.status === "approved")) {
        if (left <= 0) break;
        c.status = "paid";
        c.paidAt = p.paidAt;
        left -= c.amount;
      }
    }
    await write(d);
  },

  async setCommissionStatus(ids, status) {
    const d = await read();
    for (const c of d.commissions) {
      if (ids.includes(c.id)) {
        c.status = status;
        if (status === "paid") c.paidAt = new Date().toISOString();
      }
    }
    await write(d);
  },

  async setRubricMark(attemptId, questionId, mark) {
    const d = await read();
    const a = d.attempts.find((x) => x.id === attemptId);
    if (!a) return null;
    a.marks = { ...(a.marks ?? {}) };
    if (mark) a.marks[questionId] = mark;
    else delete a.marks[questionId];
    await write(d);
    return a;
  },

  async attemptsAwaitingMarks(limit = 100) {
    const d = await read();
    return d.attempts
      .filter((a) => a.status === "submitted" && !a.isDemo)
      .filter((a) => (a.pendingRubric ?? []).some((qid) => !a.marks?.[qid]))
      .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""))
      .slice(0, limit)
      .map((a) => ({ ...a, fullName: d.users.find((u) => u.id === a.userId)?.fullName }));
  },

  async setTimeMultiplier(userId, multiplier) {
    const d = await read();
    const u = d.users.find((x) => x.id === userId);
    if (!u) return;
    u.timeMultiplier = multiplier;
    await write(d);
  },

  async setUserRole(userId, role) {
    const d = await read();
    const u = d.users.find((x) => x.id === userId);
    if (u) { u.role = role; await write(d); }
  },

  async recentAttempts(limit = 30) {
    const d = await read();
    return d.attempts
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit)
      .map((a) => ({ ...a, fullName: d.users.find((u) => u.id === a.userId)?.fullName }));
  },
};

/* Setiap metode dijalankan lewat antrean.
 *
 * Dibungkus di sini, bukan di dalam masing-masing metode: seluruh 38 metode
 * mengikuti pola baca–ubah–tulis yang sama, dan satu pun yang terlewat sudah
 * cukup untuk mengembalikan cacatnya. Membungkusnya sekali membuat aturan itu
 * berlaku untuk metode yang ditambahkan nanti juga. */
/* devAuth menulis pengguna, sesi, dan OTP — jalur baca–ubah–tulis yang sama,
 * jadi harus ikut antrean yang sama. `read` dan `write` mentah tetap terbuka
 * untuk skrip dan uji, tetapi TIDAK dibungkus: pemakainya memang perlu
 * mengendalikan sendiri kapan membaca dan menulis. */
export const devAuth = {
  read,
  write,
  ...berurutanSemua(devAuthRaw),
};

export const devDb: FullDb = berurutanSemua(
  devDbRaw as unknown as Record<string, (...a: never[]) => Promise<unknown>>,
) as unknown as FullDb;

export type { ExamCode, ResponseValue };
