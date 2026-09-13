import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { rupiah } from "@/lib/packages";
import { AFFILIATE } from "@/lib/affiliate";
import { PageHead } from "@/components/ui/AppShell";
import { AffiliateAdmin } from "./AffiliateAdmin";

export const metadata = { title: "Afiliasi" };

export default async function AdminAfiliasiPage() {
  await requireAdmin();
  const db = getDb();
  const [affiliates, payouts] = await Promise.all([db.listAffiliates(), db.listPayouts()]);

  // komisi seluruh afiliasi, untuk daftar persetujuan
  const commissions = (
    await Promise.all(affiliates.map((a) => db.commissionsOf(a.userId)))
  ).flat();

  const nameOf = new Map(affiliates.map((a) => [a.userId, a.fullName ?? a.email ?? a.code]));
  const owed = affiliates.reduce((s, a) => s + a.pendingIdr + a.approvedIdr, 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHead
        title="Afiliasi"
        subtitle={`${affiliates.length} afiliasi · utang komisi ${rupiah(owed)} · masa tahan ${AFFILIATE.holdDays} hari`}
      />
      <AffiliateAdmin
        affiliates={JSON.parse(JSON.stringify(affiliates))}
        payouts={JSON.parse(JSON.stringify(payouts))}
        commissions={JSON.parse(JSON.stringify(
          commissions.map((c) => ({ ...c, affiliateName: nameOf.get(c.affiliateUserId) ?? "—" })),
        ))}
        holdDays={AFFILIATE.holdDays}
      />
    </div>
  );
}
