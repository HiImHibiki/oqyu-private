import { getDb, usingDev } from "@/lib/db";
import { devAuth } from "@/lib/db/dev";

/* =========================================================================
 * HAK ATAS DATA PRIBADI
 *
 * Dua hak yang tidak bisa dipenuhi dengan kalimat di kebijakan privasi dan
 * harus benar-benar berjalan:
 *
 *   Akses & portabilitas  — UU PDP Pasal 5-6, GDPR Art. 15 & 20
 *   Penghapusan           — UU PDP Pasal 8,   GDPR Art. 17
 *
 * Catatan penting soal penghapusan: catatan keuangan TIDAK boleh ikut
 * dihapus. Kewajiban pembukuan (dan GDPR Art. 17(3)(b) sendiri) menuntut
 * transaksi tetap tersimpan. Karena itu yang dilakukan adalah menghapus data
 * pribadinya dan MENGANONIMKAN pesanannya, bukan menghapus barisnya.
 * ========================================================================= */

export interface ConsentRecord {
  terms: string;            // ISO timestamp saat menyetujui Ketentuan Layanan
  privacy: string;          // ISO timestamp saat menyetujui Kebijakan Privasi
  version: string;          // versi dokumen yang disetujui
  ip?: string;
}

/** Versi dokumen. Naikkan setiap kali isi kebijakan berubah secara material —
 *  persetujuan lama tidak berlaku untuk versi baru. */
export const LEGAL_VERSION = "2026-08-28";

export interface DataExport {
  exportedAt: string;
  format: "exact-tryout/v1";
  profile: Record<string, unknown>;
  orders: unknown[];
  entitlements: unknown[];
  attempts: unknown[];
  affiliate: Record<string, unknown> | null;
  referrals: unknown[];
  commissions: unknown[];
  payouts: unknown[];
  notes: string[];
}

/** Seluruh data yang kami simpan tentang satu orang, dalam JSON yang bisa
 *  dibaca mesin — itulah yang dimaksud "portabilitas". */
export async function exportUserData(userId: string): Promise<DataExport> {
  const db = getDb();

  const [orders, entitlements, attempts, affiliate, referrals, commissions, payouts] =
    await Promise.all([
      listOrdersOf(userId),
      db.entitlements(userId),
      db.attemptsOf(userId),
      db.getAffiliate(userId),
      db.referralsOf(userId),
      db.commissionsOf(userId),
      db.payoutsOf(userId),
    ]);

  const profile = await profileOf(userId);

  return {
    exportedAt: new Date().toISOString(),
    format: "exact-tryout/v1",
    profile,
    orders,
    entitlements,
    attempts: attempts.map((a) => ({
      id: a.id,
      exam: a.exam,
      title: a.formTitle,
      isDemo: a.isDemo,
      status: a.status,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      score: a.score,
      integrity: a.integrity,
      formLayout: a.formLayout,
      responses: a.responses,
    })),
    affiliate: affiliate ? { ...affiliate } : null,
    referrals,
    commissions,
    payouts,
    notes: [
      /* Klaim «seluruh data pribadi» sebelumnya tidak benar: catatan sesi
       * login tidak disertakan. Menyebut cakupan secara mutlak lalu diam-diam
       * meninggalkan satu kategori lebih buruk daripada meninggalkannya
       * dengan penjelasan — orang yang memakai haknya berhak tahu apa yang
       * masih kami simpan tentang dirinya. */
      "Berkas ini memuat data pribadi yang kami simpan tentang kamu pada tanggal ekspor, dengan satu pengecualian yang disebut di bawah.",
      "`attempts[].responses` adalah jawaban mentah kamu; `formLayout` adalah susunan soal yang kamu kerjakan.",
      "Isi soal tidak disertakan karena berhak cipta dan bukan data pribadimu.",
      "`integrity` memuat catatan pengawasan: perpindahan tab, keluar layar penuh, dan percobaan salin-tempel.",
      "Catatan sesi login tidak disertakan: isinya adalah token yang berfungsi sebagai kunci masuk ke akunmu, dan menyalinnya ke dalam berkas yang bisa berpindah tangan akan membahayakan akun itu sendiri. Sesi berakhir sendiri setelah tujuh hari, dan seluruh sesi dihapus saat kamu menghapus akun.",
    ],
  };
}

export interface DeletionResult {
  ok: boolean;
  deleted: string[];
  retained: string[];
  error?: string;
}

/** Menghapus identitas seseorang, menyisakan catatan keuangan yang sudah
 *  dianonimkan. Tidak bisa dibatalkan. */
export async function deleteUserData(userId: string): Promise<DeletionResult> {
  const deleted: string[] = [];
  const retained: string[] = [];

  try {
    if (usingDev()) {
      const d = await devAuth.read();
      const u = d.users.find((x) => x.id === userId);
      if (!u) return { ok: false, deleted, retained, error: "Akun tidak ditemukan" };

      // 1. attempt dan jawabannya — data pribadi, dihapus seluruhnya
      const before = d.attempts.length;
      d.attempts = d.attempts.filter((a) => a.userId !== userId);
      deleted.push(`${before - d.attempts.length} attempt beserta jawabannya`);

      // 2. kuota — tidak lagi bermakna tanpa akunnya
      const ents = d.entitlements.length;
      d.entitlements = d.entitlements.filter((e) => e.userId !== userId);
      deleted.push(`${ents - d.entitlements.length} entitlement`);

      // 3. afiliasi dan rujukan
      d.affiliates = d.affiliates.filter((a) => a.userId !== userId);
      d.referrals = d.referrals.filter((r) => r.referredUserId !== userId);
      deleted.push("data afiliasi dan rujukan");

      // 4. pesanan DIPERTAHANKAN tetapi dianonimkan — kewajiban pembukuan
      let anon = 0;
      for (const o of d.orders) {
        if (o.userId === userId) { o.userId = "deleted"; anon++; }
      }
      for (const c of d.commissions) {
        if (c.referredUserId === userId) c.referredUserId = "deleted";
        if (c.affiliateUserId === userId) c.affiliateUserId = "deleted";
      }
      for (const p of d.payouts) {
        if (p.affiliateUserId === userId) {
          p.affiliateUserId = "deleted";
          delete p.method;                      // rekening tujuan itu data pribadi
        }
      }
      retained.push(`${anon} catatan pesanan, dianonimkan untuk kewajiban pembukuan`);

      // 5. sesi dan akun itu sendiri
      d.sessions = d.sessions.filter((s) => s.userId !== userId);
      d.users = d.users.filter((x) => x.id !== userId);
      deleted.push("profil, email, nomor telepon, kata sandi, dan seluruh sesi aktif");

      await devAuth.write(d);
      return { ok: true, deleted, retained };
    }

    /* ------------------------------------------------------- Supabase ---- */
    const { createAdminClient } = await import("@/lib/supabase/server");
    const sb = createAdminClient();

    await sb.from("responses").delete().in(
      "attempt_id",
      ((await sb.from("attempts").select("id").eq("user_id", userId)).data ?? []).map((a) => a.id),
    );
    await sb.from("attempts").delete().eq("user_id", userId);
    deleted.push("seluruh attempt beserta jawabannya");

    await sb.from("entitlements").delete().eq("user_id", userId);
    deleted.push("entitlement");

    await sb.from("affiliates").delete().eq("user_id", userId);
    await sb.from("referrals").delete().eq("referred_user_id", userId);
    deleted.push("data afiliasi dan rujukan");

    /* Catatan keuangan dipertahankan, identitasnya dilepas — dan ini HARUS
     * terjadi sebelum auth.admin.deleteUser(), karena penghapusan akun
     * memicu foreign key. Sampai migrasi 0011, `commissions` dan `payouts`
     * masih `on delete cascade`, sehingga seluruh riwayat komisi dan
     * pencairan orang itu ikut terhapus — termasuk bukti bahwa uang pernah
     * dibayarkan kepadanya. Driver berkas sudah menganonimkannya sejak awal;
     * yang tertinggal adalah sisi Supabase. */
    await sb.from("orders").update({ user_id: null }).eq("user_id", userId);
    await sb.from("commissions").update({ affiliate_user_id: null }).eq("affiliate_user_id", userId);
    await sb.from("commissions").update({ referred_user_id: null }).eq("referred_user_id", userId);
    // `method` berisi rekening tujuan: itu data pribadi, bukan angka pembukuan.
    await sb.from("payouts")
      .update({ affiliate_user_id: null, method: null })
      .eq("affiliate_user_id", userId);
    retained.push("catatan pesanan, komisi, dan pencairan — dianonimkan untuk kewajiban pembukuan");

    // Menghapus auth user memicu cascade ke profiles.
    const { error } = await sb.auth.admin.deleteUser(userId);
    if (error) return { ok: false, deleted, retained, error: error.message };
    deleted.push("profil, email, nomor telepon, kata sandi, dan seluruh sesi aktif");

    return { ok: true, deleted, retained };
  } catch (e) {
    return { ok: false, deleted, retained, error: e instanceof Error ? e.message : "Gagal menghapus" };
  }
}

/* ------------------------------------------------------------- persetujuan */

export async function recordConsent(userId: string, consent: ConsentRecord) {
  if (usingDev()) {
    const d = await devAuth.read();
    const u = d.users.find((x) => x.id === userId);
    if (u) { u.consent = consent; await devAuth.write(d); }
    return;
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  await createAdminClient().from("profiles").update({ consent }).eq("id", userId);
}

/* ----------------------------------------------------------------- helper */

async function profileOf(userId: string): Promise<Record<string, unknown>> {
  if (usingDev()) {
    const u = await devAuth.userById(userId);
    if (!u) return {};
    const { passwordHash, otp, ...rest } = u;
    void passwordHash; void otp;                 // rahasia tidak ikut diekspor
    return rest as Record<string, unknown>;
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const { data } = await createAdminClient().from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data ?? {}) as Record<string, unknown>;
}

async function listOrdersOf(userId: string) {
  if (usingDev()) {
    const d = await devAuth.read();
    return d.orders.filter((o) => o.userId === userId);
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const { data } = await createAdminClient().from("orders").select("*").eq("user_id", userId);
  return data ?? [];
}
