import { createAdminClient } from "@/lib/supabase/server";
import type { ExamCode, FormSectionLayout, ResponseValue } from "@/lib/types";
import type { ScoreReport } from "@/lib/exams/scoring";
import {
  isExpired, shortName,
  type AdminOverview, type AdminUserRow, type AffiliateRecord, type AffiliateStats,
  type AttemptRecord, type CommissionRecord, type EntitlementRecord, type FullDb,
  type ItemOutcomeRow, type OrderRecord, type PayoutRecord,
  type ReferralRecord, type SaveResult,
  type RubricMark,
  type AffiliateBalance,
} from "./types";
import type { Currency } from "@/lib/geo";

/* Driver produksi.
 *
 * Semua operasi di sini memakai service-role dan berjalan HANYA di server:
 *  - kuota, tenggat waktu, dan skor tidak boleh bisa disentuh browser
 *  - RLS tetap aktif untuk pembacaan langsung dari klien (dashboard, journey)
 *
 * Kolom tambahan yang dipakai driver ini dibuat di
 * supabase/migrations/0004_attempt_runtime.sql. */

const sb = () => createAdminClient();

/* ------------------------------------------------------------- pemetaan */

type OrderRow = {
  id: string; user_id: string; package_id: string; exam: ExamCode;
  amount: number; currency: Currency; status: OrderRecord["status"]; provider: string;
  provider_ref: string | null; created_at: string; paid_at: string | null;
  coupon_code: string | null; discount: number | null;
};

const toOrder = (r: OrderRow): OrderRecord => ({
  id: r.id, userId: r.user_id, packageId: r.package_id, exam: r.exam,
  amount: r.amount, currency: (r.currency ?? "IDR") as Currency, status: r.status, provider: r.provider,
  providerRef: r.provider_ref, createdAt: r.created_at, paidAt: r.paid_at,
  couponCode: r.coupon_code, discount: r.discount,
});

type AttemptRow = {
  id: string; user_id: string | null; exam: ExamCode; form_title: string | null;
  is_demo: boolean; status: AttemptRecord["status"]; current_section: number;
  section_deadlines: Record<string, string>; form_layout: FormSectionLayout[] | null;
  routing: Record<string, "easier" | "harder"> | null;
  responses_draft: Record<string, ResponseValue>;
  score: ScoreReport | null; integrity: unknown; started_at: string; submitted_at: string | null;
  time_multiplier: number | null;
  pending_rubric: string[] | null;
  marks: Record<string, RubricMark> | null;
};

const toAttempt = (r: AttemptRow): AttemptRecord => ({
  id: r.id, userId: r.user_id ?? "guest", exam: r.exam, formTitle: r.form_title ?? r.exam,
  isDemo: r.is_demo, status: r.status, currentSection: r.current_section ?? 0,
  sectionDeadlines: r.section_deadlines ?? {}, formLayout: r.form_layout ?? [],
  routing: r.routing ?? undefined,
  timeMultiplier: r.time_multiplier ?? undefined,
  pendingRubric: r.pending_rubric ?? undefined,
  marks: r.marks ?? undefined,
  responses: r.responses_draft ?? {},
  score: r.score, integrity: r.integrity, startedAt: r.started_at, submittedAt: r.submitted_at,
});

const ATTEMPT_COLS =
  "id,user_id,exam,form_title,is_demo,status,current_section,section_deadlines,form_layout,routing,responses_draft,score,integrity,started_at,submitted_at,time_multiplier,pending_rubric,marks";

/* ---------------------------------------------------------------- driver */

export const supabaseDb: FullDb = {
  async createOrder(input) {
    const { data, error } = await sb()
      .from("orders")
      .insert({
        user_id: input.userId, package_id: input.packageId, exam: input.exam,
        amount: input.amount, currency: input.currency, provider: input.provider, status: "pending",
        coupon_code: input.couponCode ?? null, discount: input.discount ?? 0,
      })
      .select("*")
      .single();
    if (error) throw new Error(`createOrder: ${error.message}`);
    return toOrder(data as OrderRow);
  },

  async getOrder(id) {
    const { data } = await sb().from("orders").select("*").eq("id", id).maybeSingle();
    return data ? toOrder(data as OrderRow) : null;
  },

  async getOrderByRef(ref) {
    const { data } = await sb().from("orders").select("*")
      .or(`provider_ref.eq.${ref},id.eq.${ref}`).maybeSingle();
    return data ? toOrder(data as OrderRow) : null;
  },

  async ordersOf(userId) {
    const { data } = await sb().from("orders").select("*")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    return ((data ?? []) as OrderRow[]).map(toOrder);
  },

  async countCouponUses(code) {
    const { count } = await sb().from("orders")
      .select("id", { count: "exact", head: true })
      .eq("coupon_code", code.toUpperCase())
      .eq("status", "paid");
    return count ?? 0;
  },

  /** Idempoten: webhook Midtrans bisa mengirim notifikasi yang sama berkali-kali. */
  async markOrderPaid(id, attemptsGranted, providerRef) {
    const client = sb();
    const { data: existing } = await client.from("orders").select("*").eq("id", id).maybeSingle();
    if (!existing) return null;
    if ((existing as OrderRow).status === "paid") return toOrder(existing as OrderRow);

    // update bersyarat: hanya berhasil kalau statusnya masih pending
    const { data: updated } = await client
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString(), provider_ref: providerRef ?? null })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (!updated) {
      const { data: again } = await client.from("orders").select("*").eq("id", id).single();
      return toOrder(again as OrderRow);
    }

    const row = updated as OrderRow;
    const { error } = await client.from("entitlements").insert({
      user_id: row.user_id, order_id: row.id, package_id: row.package_id, exam: row.exam,
      attempts_total: attemptsGranted, attempts_used: 0,
      expires_at: new Date(Date.now() + 365 * 864e5).toISOString(),
    });
    if (error) throw new Error(`grant entitlement: ${error.message}`);
    return toOrder(row);
  },

  async entitlements(userId): Promise<EntitlementRecord[]> {
    const { data } = await sb().from("entitlements").select("*").eq("user_id", userId);
    return (data ?? []).map((e) => ({
      id: e.id, userId: e.user_id, packageId: e.package_id, exam: e.exam,
      attemptsTotal: e.attempts_total, attemptsUsed: e.attempts_used, expiresAt: e.expires_at,
      orderId: e.order_id ?? null,
    }));
  },

  async setOrderStatus(id, status) {
    const client = sb();
    /* Pembaruan bersyarat: hanya pesanan yang masih `pending` yang ditutup,
     * sehingga notifikasi terlambat tidak dapat menurunkan pesanan lunas. */
    const { data } = await client.from("orders").update({ status })
      .eq("id", id).eq("status", "pending").select("*").maybeSingle();
    if (data) return toOrder(data as OrderRow);
    const { data: now } = await client.from("orders").select("*").eq("id", id).maybeSingle();
    return now ? toOrder(now as OrderRow) : null;
  },

  async refundOrder(id) {
    const client = sb();
    const { data: row } = await client.from("orders").select("*").eq("id", id).maybeSingle();
    if (!row) return null;
    const order = toOrder(row as OrderRow);
    if (order.status === "refunded") return { order, attemptsRevoked: 0, commissionsVoided: 0 };

    await client.from("orders").update({ status: "refunded" }).eq("id", id);

    /* Sisa kuota dicabut dengan menyamakan jatah dengan yang sudah terpakai.
     * Baris entitlement sengaja TIDAK dihapus: attempt yang sudah dikerjakan
     * merujuk kuota ini, dan menghapusnya akan memutus jejak asal-usulnya. */
    const { data: ents } = await client
      .from("entitlements").select("id,attempts_total,attempts_used").eq("order_id", id);
    let attemptsRevoked = 0;
    for (const e of ents ?? []) {
      const sisa = (e.attempts_total as number) - (e.attempts_used as number);
      if (sisa <= 0) continue;
      const { error } = await client
        .from("entitlements").update({ attempts_total: e.attempts_used }).eq("id", e.id);
      if (!error) attemptsRevoked += sisa;
    }

    /* Komisi yang SUDAH DIBAYAR tidak disentuh: uangnya sudah keluar, dan
     * membatalkannya di sini hanya akan membuat saldo afiliasi tidak cocok
     * dengan yang benar-benar ditransfer. Penagihan kembali adalah urusan
     * manual yang harus terlihat, bukan efek samping sebuah tombol. */
    const { data: voided } = await client
      .from("commissions").update({ status: "void" })
      .eq("order_id", id).in("status", ["pending", "approved"]).select("id");

    const { data: after } = await client.from("orders").select("*").eq("id", id).single();
    return {
      order: toOrder(after as OrderRow),
      attemptsRevoked,
      commissionsVoided: (voided ?? []).length,
    };
  },

  async createAttempt(input) {
    const client = sb();

    if (!input.isDemo) {
      // ambil satu kuota; gagal kalau tidak ada yang tersisa
      const { data: ents } = await client
        .from("entitlements")
        .select("id,attempts_total,attempts_used")
        .eq("user_id", input.userId)
        .eq("exam", input.exam)
        .or("expires_at.is.null,expires_at.gt.now()")
        .order("created_at", { ascending: true });

      const usable = (ents ?? []).find((e) => e.attempts_used < e.attempts_total);
      if (!usable) throw new Error("Kuota try out habis");

      const { data: taken } = await client
        .from("entitlements")
        .update({ attempts_used: usable.attempts_used + 1 })
        .eq("id", usable.id)
        .eq("attempts_used", usable.attempts_used)   // optimistic lock
        .select("id")
        .maybeSingle();
      if (!taken) throw new Error("Kuota sedang dipakai di perangkat lain. Coba lagi.");
    }

    const { data, error } = await client
      .from("attempts")
      .insert({
        user_id: input.isDemo && input.userId === "guest" ? null : input.userId,
        exam: input.exam, form_title: input.formTitle,
        is_demo: input.isDemo,
        question_ids: input.formLayout.flatMap((f) => f.questionIds),
        form_layout: input.formLayout,
        time_multiplier: input.timeMultiplier ?? 1,
        current_section: 0, section_deadlines: {},   // diisi saat startSection()
        responses_draft: {},
      })
      .select(ATTEMPT_COLS)
      .single();
    if (error) throw new Error(`createAttempt: ${error.message}`);
    return toAttempt(data as AttemptRow);
  },

  async getAttempt(id) {
    const { data } = await sb().from("attempts").select(ATTEMPT_COLS).eq("id", id).maybeSingle();
    return data ? toAttempt(data as AttemptRow) : null;
  },

  async startSection(id, index, section) {
    const client = sb();
    const { data: cur } = await client.from("attempts").select(ATTEMPT_COLS).eq("id", id).maybeSingle();
    if (!cur) return null;
    const row = cur as AttemptRow;
    if (row.status !== "in_progress") return toAttempt(row);

    const deadlines = { ...(row.section_deadlines ?? {}) };
    // tenggat ditetapkan sekali saja — membuka ulang section tidak menambah waktu
    if (!deadlines[section.code]) {
      deadlines[section.code] = new Date(Date.now() + section.durationSec * 1000).toISOString();
    }

    const { data, error } = await client
      .from("attempts")
      .update({ current_section: index, section_deadlines: deadlines })
      .eq("id", id)
      .select(ATTEMPT_COLS)
      .single();
    if (error) throw new Error(`startSection: ${error.message}`);
    return toAttempt(data as AttemptRow);
  },

  async setRouting(id, sectionCode, variant) {
    const client = sb();
    const { data: cur } = await client.from("attempts").select(ATTEMPT_COLS).eq("id", id).maybeSingle();
    if (!cur) return null;
    const row = cur as AttemptRow;
    if (row.status !== "in_progress") return toAttempt(row);

    const routing = { ...(row.routing ?? {}) };
    if (routing[sectionCode]) return toAttempt(row);   // sekali ditulis, tidak diubah
    routing[sectionCode] = variant;

    const { data, error } = await client
      .from("attempts").update({ routing }).eq("id", id).select(ATTEMPT_COLS).single();
    if (error) throw new Error(`setRouting: ${error.message}`);
    return toAttempt(data as AttemptRow);
  },

  async saveResponses(id, sectionCode, responses): Promise<SaveResult> {
    const client = sb();
    const serverNow = new Date().toISOString();
    const { data: cur } = await client.from("attempts").select(ATTEMPT_COLS).eq("id", id).maybeSingle();
    if (!cur) return { ok: false, serverNow };
    const row = cur as AttemptRow;
    if (row.status !== "in_progress") return { ok: false, serverNow };
    if (isExpired(row.section_deadlines?.[sectionCode])) return { ok: false, expired: true, serverNow };

    const merged = { ...(row.responses_draft ?? {}), ...responses };
    const { error } = await client.from("attempts").update({ responses_draft: merged }).eq("id", id);
    if (error) throw new Error(`saveResponses: ${error.message}`);
    return { ok: true, serverNow };
  },

  async rescoreAttempt(id, score, items: ItemOutcomeRow[] = []) {
    const client = sb();
    const { data, error } = await client
      .from("attempts").update({ score }).eq("id", id).eq("status", "submitted")
      .select(ATTEMPT_COLS).maybeSingle();
    if (error) throw new Error(`rescoreAttempt: ${error.message}`);
    if (!data) return null;
    if (items.length) {
      await client.from("responses").upsert(
        items.map((it) => ({
          attempt_id: id, question_id: it.questionId, section_code: it.sectionCode,
          position: it.position, credit: it.credit, correct: it.correct,
          time_spent_sec: it.timeSpentSec, flagged: it.flagged,
        })),
        { onConflict: "attempt_id,question_id" },
      );
    }
    return toAttempt(data as AttemptRow);
  },

  async submitAttempt(id, score, integrity, responses, items: ItemOutcomeRow[] = [], pendingRubric) {
    const client = sb();
    const { data, error } = await client
      .from("attempts")
      .update({
        responses_draft: responses,
        score,
        integrity: integrity as Record<string, unknown>,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        ...(pendingRubric?.length ? { pending_rubric: pendingRubric } : {}),
      })
      .eq("id", id)
      .eq("status", "in_progress")
      .select(ATTEMPT_COLS)
      .maybeSingle();
    if (error) throw new Error(`submitAttempt: ${error.message}`);
    if (!data) {
      const { data: already } = await client.from("attempts").select(ATTEMPT_COLS).eq("id", id).maybeSingle();
      return already ? toAttempt(already as AttemptRow) : null;
    }

    // materialisasi jawaban per soal supaya analitik butir & RPC domain bisa jalan
    if (items.length) {
      const rows = items.map((it) => ({
        attempt_id: id,
        question_id: it.questionId,
        section_code: it.sectionCode,
        position: it.position,
        raw: (responses[it.questionId]?.raw ?? null) as unknown,
        flagged: it.flagged,
        time_spent_sec: Math.round(it.timeSpentSec),
        visited: Boolean(responses[it.questionId]?.visited),
        credit: it.credit,
        correct: it.correct,
      }));
      const { error: rErr } = await client.from("responses").upsert(rows, { onConflict: "attempt_id,question_id" });
      if (rErr) console.error("materialisasi responses gagal:", rErr.message);
    }

    return toAttempt(data as AttemptRow);
  },

  async attemptsOf(userId) {
    const { data } = await sb()
      .from("attempts").select(ATTEMPT_COLS)
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(100);
    return (data ?? []).map((r) => toAttempt(r as AttemptRow));
  },


  /* ---------------------------------------------------------- afiliasi */

  async getAffiliate(userId) {
    const { data } = await sb().from("affiliates").select("*").eq("user_id", userId).maybeSingle();
    return data ? toAffiliate(data) : null;
  },

  async createAffiliate(userId, code, rate) {
    const client = sb();
    const { data: existing } = await client.from("affiliates").select("*").eq("user_id", userId).maybeSingle();
    if (existing) return toAffiliate(existing);
    const { data, error } = await client
      .from("affiliates")
      .insert({ user_id: userId, code, rate })
      .select("*")
      .single();
    if (error) throw new Error(`createAffiliate: ${error.message}`);
    return toAffiliate(data);
  },

  async affiliateByCode(code) {
    const { data } = await sb().from("affiliates").select("*").ilike("code", code).maybeSingle();
    return data ? toAffiliate(data) : null;
  },

  async updatePayoutMethod(userId, method) {
    await sb().from("affiliates").update({ payout_method: method }).eq("user_id", userId);
  },

  async recordClick(code) {
    await sb().from("referral_clicks").insert({ code: code.toUpperCase() });
  },

  async attachReferral(code, referredUserId) {
    const client = sb();
    const { data: aff } = await client.from("affiliates").select("user_id,code").ilike("code", code).maybeSingle();
    if (!aff || aff.user_id === referredUserId) return;                 // tidak boleh merujuk diri sendiri
    // unique(referred_user_id) menjaga satu akun hanya terikat sekali
    const { error } = await client
      .from("referrals")
      .insert({ code: aff.code, referred_user_id: referredUserId });
    if (error && !error.message.includes("duplicate")) console.error("attachReferral:", error.message);
    await client.from("profiles").update({ referred_by: aff.code }).eq("id", referredUserId);
  },

  async referralOfUser(userId) {
    const { data } = await sb().from("referrals").select("*").eq("referred_user_id", userId).maybeSingle();
    return data ? toReferral(data) : null;
  },

  async referralsOf(affiliateUserId) {
    const client = sb();
    const { data: aff } = await client.from("affiliates").select("code").eq("user_id", affiliateUserId).maybeSingle();
    if (!aff) return [];
    const { data } = await client
      .from("referrals")
      .select("*, profiles!referrals_referred_user_id_fkey(full_name)")
      .eq("code", aff.code)
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []).map((r) => ({
      ...toReferral(r),
      referredName: shortName((r as { profiles?: { full_name?: string } }).profiles?.full_name ?? ""),
    }));
  },

  async createCommission(input) {
    const { data, error } = await sb()
      .from("commissions")
      .insert({
        affiliate_user_id: input.affiliateUserId,
        referred_user_id: input.referredUserId,
        order_id: input.orderId,
        amount: input.amount,
        currency: input.currency,
        rate: input.rate,
      })
      .select("*")
      .maybeSingle();
    // unique(order_id) membuat pemanggilan ganda dari webhook tidak berefek
    if (error) return null;
    if (!data) return null;
    await sb().from("referrals")
      .update({ first_order_id: input.orderId })
      .eq("referred_user_id", input.referredUserId)
      .is("first_order_id", null);
    return toCommission(data);
  },

  async commissionsOf(affiliateUserId) {
    const { data } = await sb()
      .from("commissions").select("*")
      .eq("affiliate_user_id", affiliateUserId)
      .order("created_at", { ascending: false })
      .limit(300);
    return (data ?? []).map(toCommission);
  },

  async affiliateStats(affiliateUserId): Promise<AffiliateStats> {
    const client = sb();
    const { data } = await client.rpc("affiliate_stats", { p_user: affiliateUserId });
    const row = Array.isArray(data) ? data[0] : data;

    /* Saldo dihitung dari tabelnya langsung, DIPISAH per mata uang.
     *
     * RPC `affiliate_stats` menjumlahkan seluruh komisi tanpa memandang mata
     * uang — rupiah dan dolar masuk ke satu angka yang bukan keduanya. Angka
     * dari RPC tetap dipakai untuk klik dan pendaftar, yang memang tidak
     * bermata uang. */
    const [{ data: komisi }, { data: cair }] = await Promise.all([
      client.from("commissions").select("amount,currency,status").eq("affiliate_user_id", affiliateUserId),
      client.from("payouts").select("amount,currency").eq("affiliate_user_id", affiliateUserId).eq("status", "requested"),
    ]);

    const mataUang = [...new Set((komisi ?? []).map((c) => c.currency as Currency))];
    const balances: AffiliateBalance[] = mataUang.map((cur) => {
      const punya = (komisi ?? []).filter((c) => c.currency === cur);
      const sum = (st: string) =>
        punya.filter((c) => c.status === st).reduce((a, c) => a + Number(c.amount), 0);
      const approved = sum("approved");
      const diajukan = (cair ?? []).filter((p) => p.currency === cur).reduce((a, p) => a + Number(p.amount), 0);
      return {
        currency: cur, pending: sum("pending"), approved, paid: sum("paid"),
        withdrawable: Math.max(0, approved - diajukan),
      };
    }).sort((a, b) => b.pending + b.approved + b.paid - (a.pending + a.approved + a.paid));

    const utama = balances[0] ?? {
      currency: "IDR" as Currency, pending: 0, approved: 0, paid: 0, withdrawable: 0,
    };
    return {
      clicks: Number(row?.clicks ?? 0),
      signups: Number(row?.signups ?? 0),
      conversions: Number(row?.conversions ?? 0),
      balances,
      pendingIdr: utama.pending,
      approvedIdr: utama.approved,
      paidIdr: utama.paid,
      withdrawableIdr: utama.withdrawable,
      currency: utama.currency,
    };
  },

  async requestPayout(userId, amount, currency, method) {
    const { data, error } = await sb()
      .from("payouts")
      .insert({ affiliate_user_id: userId, amount, currency, method: method ?? null })
      .select("*")
      .single();
    if (error) throw new Error(`requestPayout: ${error.message}`);
    return toPayout(data);
  },

  async payoutsOf(userId) {
    const { data } = await sb()
      .from("payouts").select("*")
      .eq("affiliate_user_id", userId)
      .order("requested_at", { ascending: false });
    return (data ?? []).map(toPayout);
  },

  async grantBonusAttempt(userId, exam, packageId) {
    await sb().from("entitlements").insert({
      user_id: userId, package_id: `${packageId}-bonus`, exam,
      attempts_total: 1, attempts_used: 0,
      expires_at: new Date(Date.now() + 365 * 864e5).toISOString(),
    });
  },

  /* ------------------------------------------------------------- admin */

  async adminOverview(): Promise<AdminOverview> {
    const { data, error } = await sb().rpc("admin_overview");
    if (error) throw new Error(`adminOverview: ${error.message}`);
    return data as AdminOverview;
  },

  async listUsers(q, limit = 100): Promise<AdminUserRow[]> {
    let query = sb()
      .from("profiles")
      .select("id,email,full_name,phone,school,role,created_at,referred_by,time_multiplier")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
    const { data } = await query;

    const ids = (data ?? []).map((u) => u.id);
    const [{ data: atts }, { data: ents }] = await Promise.all([
      sb().from("attempts").select("user_id").in("user_id", ids),
      sb().from("entitlements").select("user_id,attempts_total,attempts_used").in("user_id", ids),
    ]);

    return (data ?? []).map((u) => ({
      id: u.id, email: u.email, fullName: u.full_name, phone: u.phone,
      school: u.school, role: u.role, createdAt: u.created_at, referredBy: u.referred_by,
      timeMultiplier: Number(u.time_multiplier ?? 1),
      attempts: (atts ?? []).filter((a) => a.user_id === u.id).length,
      quotaLeft: (ents ?? [])
        .filter((e) => e.user_id === u.id)
        .reduce((a, e) => a + (e.attempts_total - e.attempts_used), 0),
    }));
  },

  async listOrders(limit = 100) {
    const { data } = await sb()
      .from("orders")
      .select("*, profiles!orders_user_id_fkey(email,full_name)")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((o) => {
      const p = (o as { profiles?: { email?: string; full_name?: string } }).profiles;
      return { ...toOrder(o as OrderRow), email: p?.email, fullName: p?.full_name };
    });
  },

  async listAffiliates() {
    const { data } = await sb()
      .from("affiliates")
      .select("*, profiles!affiliates_user_id_fkey(full_name,email)")
      .order("created_at", { ascending: false })
      .limit(200);
    const out = [];
    for (const a of data ?? []) {
      const p = (a as { profiles?: { full_name?: string; email?: string } }).profiles;
      const stats = await this.affiliateStats(a.user_id);
      out.push({ ...toAffiliate(a), fullName: p?.full_name, email: p?.email, ...stats });
    }
    return out;
  },

  async listPayouts(status) {
    let query = sb()
      .from("payouts")
      .select("*, profiles!payouts_affiliate_user_id_fkey(full_name)")
      .order("requested_at", { ascending: false })
      .limit(200);
    if (status) query = query.eq("status", status);
    const { data } = await query;
    return (data ?? []).map((p) => ({
      ...toPayout(p),
      affiliateName: (p as { profiles?: { full_name?: string } }).profiles?.full_name,
    }));
  },

  async setPayoutStatus(id, status, note) {
    const client = sb();
    const patch: Record<string, unknown> = { status, note: note ?? null };
    if (status === "paid") patch.paid_at = new Date().toISOString();
    const { data } = await client.from("payouts").update(patch).eq("id", id).select("*").maybeSingle();
    if (!data || status !== "paid") return;

    // tandai komisi yang menutupi nominal pencairan sebagai sudah dibayar
    const { data: approved } = await client
      .from("commissions").select("id,amount")
      .eq("affiliate_user_id", data.affiliate_user_id).eq("status", "approved")
      .order("created_at", { ascending: true });

    let left = Number(data.amount);
    const ids: string[] = [];
    for (const c of approved ?? []) {
      if (left <= 0) break;
      ids.push(c.id);
      left -= Number(c.amount);
    }
    if (ids.length) {
      await client.from("commissions")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .in("id", ids);
    }
  },

  async setCommissionStatus(ids, status) {
    const patch: Record<string, unknown> = { status };
    if (status === "paid") patch.paid_at = new Date().toISOString();
    await sb().from("commissions").update(patch).in("id", ids);
  },

  async setRubricMark(attemptId, questionId, mark) {
    const client = sb();
    const { data: cur } = await client.from("attempts").select(ATTEMPT_COLS).eq("id", attemptId).maybeSingle();
    if (!cur) return null;
    const marks = { ...((cur as AttemptRow).marks ?? {}) };
    if (mark) marks[questionId] = mark; else delete marks[questionId];
    const { data, error } = await client
      .from("attempts").update({ marks }).eq("id", attemptId).select(ATTEMPT_COLS).single();
    if (error) throw new Error(`setRubricMark: ${error.message}`);
    return toAttempt(data as AttemptRow);
  },

  async attemptsAwaitingMarks(limit = 100) {
    const { data } = await sb()
      .from("attempts")
      .select(`${ATTEMPT_COLS}, profiles!attempts_user_id_fkey(full_name)`)
      .eq("status", "submitted").eq("is_demo", false)
      .not("pending_rubric", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(limit);
    return (data ?? [])
      .map((a) => ({
        ...toAttempt(a as unknown as AttemptRow),
        fullName: (a as { profiles?: { full_name?: string } }).profiles?.full_name,
      }))
      .filter((a) => (a.pendingRubric ?? []).some((qid) => !a.marks?.[qid]));
  },

  async setTimeMultiplier(userId, multiplier) {
    const { error } = await sb()
      .from("profiles").update({ time_multiplier: multiplier }).eq("id", userId);
    if (error) throw new Error(`setTimeMultiplier: ${error.message}`);
  },

  async setUserRole(userId, role) {
    await sb().from("profiles").update({ role }).eq("id", userId);
  },

  async recentAttempts(limit = 30) {
    const { data } = await sb()
      .from("attempts")
      .select(`${ATTEMPT_COLS}, profiles!attempts_user_id_fkey(full_name)`)
      .order("started_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((a) => ({
      ...toAttempt(a as unknown as AttemptRow),
      fullName: (a as { profiles?: { full_name?: string } }).profiles?.full_name,
    }));
  },
};

/* ------------------------------------------------------ pemetaan afiliasi */

type Row = Record<string, unknown>;

const toAffiliate = (r: Row): AffiliateRecord => ({
  userId: String(r.user_id),
  code: String(r.code),
  rate: Number(r.rate),
  status: (r.status as AffiliateRecord["status"]) ?? "active",
  payoutMethod: (r.payout_method as AffiliateRecord["payoutMethod"]) ?? null,
  createdAt: String(r.created_at),
});

const toReferral = (r: Row): ReferralRecord => ({
  id: String(r.id),
  code: String(r.code),
  referredUserId: String(r.referred_user_id),
  createdAt: String(r.created_at),
  firstOrderId: (r.first_order_id as string | null) ?? null,
  converted: Boolean(r.first_order_id),
});

const toCommission = (r: Row): CommissionRecord => ({
  id: String(r.id),
  affiliateUserId: String(r.affiliate_user_id),
  referredUserId: String(r.referred_user_id),
  orderId: String(r.order_id),
  amount: Number(r.amount),
  currency: (r.currency ?? "IDR") as Currency,
  rate: Number(r.rate),
  status: r.status as CommissionRecord["status"],
  createdAt: String(r.created_at),
  paidAt: (r.paid_at as string | null) ?? null,
});

const toPayout = (r: Row): PayoutRecord => ({
  id: String(r.id),
  affiliateUserId: String(r.affiliate_user_id),
  amount: Number(r.amount),
  currency: (r.currency ?? "IDR") as Currency,
  status: r.status as PayoutRecord["status"],
  method: (r.method as PayoutRecord["method"]) ?? null,
  note: (r.note as string | null) ?? null,
  requestedAt: String(r.requested_at),
  paidAt: (r.paid_at as string | null) ?? null,
});
