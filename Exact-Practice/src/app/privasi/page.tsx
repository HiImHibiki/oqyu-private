import { LegalDocView } from "@/components/ui/LegalDocView";
import { PRIVACY } from "@/lib/legal";
import { getLocale } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "Privacy Policy" };

export default async function PrivacyPage() {
  const [locale, user] = await Promise.all([getLocale(), currentUser()]);
  return <LegalDocView doc={PRIVACY[locale]} authed={Boolean(user)} />;
}
