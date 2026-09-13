import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AFFILIATE, referralUrl } from "@/lib/affiliate";
import { PageHead } from "@/components/ui/AppShell";
import { AffiliatePanel } from "./AffiliatePanel";

export const metadata = { title: "Program afiliasi" };

export default async function AfiliasiPage() {
  const user = (await currentUser())!;
  const db = getDb();
  const affiliate = await db.getAffiliate(user.id);

  if (!affiliate) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <PageHead
          title="Program afiliasi"
          subtitle="Bagikan tautanmu, dapatkan komisi setiap kali temanmu membeli paket."
        />
        <AffiliatePanel
          state="none"
          rate={AFFILIATE.defaultRate}
          minPayout={AFFILIATE.minPayoutIdr}
          holdDays={AFFILIATE.holdDays}
          bonus={AFFILIATE.refereeBonusAttempts}
        />
      </div>
    );
  }

  const [stats, referrals, commissions, payouts] = await Promise.all([
    db.affiliateStats(user.id),
    db.referralsOf(user.id),
    db.commissionsOf(user.id),
    db.payoutsOf(user.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHead
        title="Program afiliasi"
        subtitle={`Komisi kamu ${Math.round(affiliate.rate * 100)}% dari setiap paket yang terjual lewat tautanmu.`}
      />
      <AffiliatePanel
        state="active"
        code={affiliate.code}
        rate={affiliate.rate}
        link={referralUrl(affiliate.code)}
        method={affiliate.payoutMethod ?? null}
        minPayout={AFFILIATE.minPayoutIdr}
        holdDays={AFFILIATE.holdDays}
        bonus={AFFILIATE.refereeBonusAttempts}
        stats={stats}
        referrals={JSON.parse(JSON.stringify(referrals))}
        commissions={JSON.parse(JSON.stringify(commissions))}
        payouts={JSON.parse(JSON.stringify(payouts))}
      />
    </div>
  );
}
