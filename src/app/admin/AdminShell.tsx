"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookMarked, ClipboardCheck, FileQuestion, Gauge, Gift, LogOut, Receipt, ShieldCheck, Users, PenLine } from "lucide-react";
import { Logo } from "@/components/ui/SiteHeader";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";

const NAV = [
  { href: "/admin", label: "Ringkasan", icon: Gauge },
  { href: "/admin/soal", label: "Bank soal", icon: FileQuestion },
  { href: "/admin/tinjauan", label: "Antrean tinjauan", icon: ClipboardCheck },
  { href: "/admin/esai", label: "Penilaian esai", icon: PenLine },
  { href: "/admin/referensi", label: "Referensi ujian", icon: BookMarked },
  { href: "/admin/peserta", label: "Peserta", icon: Users },
  { href: "/admin/pesanan", label: "Pesanan", icon: Receipt },
  { href: "/admin/afiliasi", label: "Afiliasi", icon: Gift },
];

export function AdminShell({
  children, user,
}: {
  children: React.ReactNode;
  user: { fullName: string; email: string; role: string };
}) {
  const path = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/masuk");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r px-4 py-5 md:flex"
        style={{ background: "var(--bg-elev)" }}>
        <Logo small />
        <div className="mt-2 chip" style={{ color: "var(--accent)" }}>
          <ShieldCheck size={11} /> Panel {user.role}
        </div>

        <nav className="mt-6 flex-1 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
            return (
              <Link key={href} href={href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition"
                style={{
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--fg)" : "var(--fg-muted)",
                  fontWeight: active ? 600 : 400,
                }}>
                <Icon size={16} /> {label}
              </Link>
            );
          })}
        </nav>

        <Link href="/dashboard" className="mb-3 text-xs underline muted">← Kembali ke sisi peserta</Link>

        <div className="rounded-xl p-3" style={{ background: "var(--bg-sunken)" }}>
          <div className="truncate text-xs font-semibold">{user.fullName || "Admin"}</div>
          <div className="truncate text-[10px] muted">{user.email}</div>
          <div className="mt-2.5 flex gap-1.5">
            <ThemeSwitcher compact />
            <button className="btn btn-ghost !px-2.5 min-h-11 min-w-11" title="Keluar" aria-label="Keluar"
              onClick={signOut}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Bilah atas khusus ponsel: bilah samping beserta tombol tema dan
         * keluar tersembunyi di bawah breakpoint md, sehingga tanpa baris ini
         * admin yang membuka dari ponsel tidak punya jalan untuk keluar. */}
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b px-4 py-2.5 md:hidden"
          style={{ background: "var(--bg-elev)" }}>
          <span className="text-sm font-semibold">Admin</span>
          <span className="ml-auto flex items-center gap-1.5">
            <ThemeSwitcher compact />
            <button className="btn btn-ghost !px-2.5 min-h-11 min-w-11" title="Keluar" aria-label="Keluar"
              onClick={signOut}>
              <LogOut size={16} />
            </button>
          </span>
        </header>

        <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
      </div>

      {/* Nav bawah admin DIGULIR MENDATAR, tidak dibagi rata.
       *
       * Ada delapan tujuan di sini. Membaginya rata dengan `flex-1` memberi
       * sekitar 45 px per menu pada layar 360 px — lebih sempit daripada ujung
       * jempol, dan labelnya terpotong sampai tidak terbaca. Lebar tetap per
       * menu plus gulir mendatar mempertahankan seluruh tujuan tetap dapat
       * ditekan, dengan konsekuensi sebagian harus digulir untuk terlihat. */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex snap-x overflow-x-auto border-t md:hidden"
        style={{ background: "var(--bg-elev)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href;
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className="flex min-h-[3.25rem] w-[4.75rem] shrink-0 snap-start flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] leading-tight"
              style={{ color: active ? "var(--accent)" : "var(--fg-muted)", fontWeight: active ? 600 : 400 }}>
              <Icon size={18} />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
