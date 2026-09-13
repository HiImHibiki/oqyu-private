import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/adminGuard";
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
        /* Kata sandi hanya berguna bagi yang punya halaman masuk berkata sandi,
         * dan setelah peserta beralih ke Google hanya /admin/masuk yang punya.
         * Menawarkan kolom sandi kepada peserta berarti menawarkan sesuatu yang
         * tidak bisa ia pakai untuk masuk. */
        canSetPassword={isAdmin(user)}
      />
      <div className="mt-5"><SessionControl /></div>
      <div className="mt-5"><DataRights /></div>
      <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wider muted">Tema tampilan</h2>
      <ThemeGallery />
    </div>
  );
}
