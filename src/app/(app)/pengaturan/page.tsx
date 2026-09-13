import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/adminGuard";
import { usingDev } from "@/lib/db";
import { PageHead } from "@/components/ui/AppShell";
import { SettingsForm } from "./SettingsForm";
import { ThemeGallery } from "./ThemeGallery";
import { DataRights } from "./DataRights";
import { SessionControl } from "./SessionControl";

export const metadata = { title: "Pengaturan" };

export default async function PengaturanPage() {
  const user = (await currentUser())!;
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageHead title="Pengaturan" subtitle="Data peserta, tampilan, dan keamanan akun." />
      <SettingsForm
        user={{ fullName: user.fullName, email: user.email, phone: user.phone, school: user.school ?? "" }}
        /* Di Exact Practice (mode berkas) murid masuk dengan kata sandi, jadi
         * semua orang boleh menggantinya; di mode Supabase peserta masuk lewat
         * Google dan kolom sandi hanya berguna bagi admin. */
        canSetPassword={usingDev() || isAdmin(user)}
      />
      <div className="mt-5"><SessionControl /></div>
      <div className="mt-5"><DataRights /></div>
      <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider muted">Tema tampilan</h2>
      <ThemeGallery />
    </div>
  );
}
