import { LegalDocView } from "@/components/ui/LegalDocView";
import { TERMS } from "@/lib/legal";
import { getLocale } from "@/lib/i18n";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "Terms of Service" };

export default async function TermsPage() {
  const [locale, user] = await Promise.all([getLocale(), currentUser()]);
  return <LegalDocView doc={TERMS[locale]} authed={Boolean(user)} />;
}
