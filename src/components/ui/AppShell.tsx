"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, GraduationCap, Gift, LogOut, Route, Settings, ShoppingBag, Trophy } from "lucide-react";
import { Logo } from "./SiteHeader";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useI18n } from "./I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";

const NAV: { href: string; key: MessageKey; icon: typeof BarChart3 }[] = [
  { href: "/dashboard", key: "nav.dashboard", icon: BarChart3 },
  { href: "/journey", key: "nav.journey", icon: Route },
  { href: "/leaderboard", key: "nav.leaderboard", icon: Trophy },
  { href: "/paket", key: "nav.packages", icon: ShoppingBag },
  { href: "/afiliasi", key: "nav.affiliate", icon: Gift },
  { href: "/pengaturan", key: "nav.settings", icon: Settings },
];

export function AppShell({
  children, user,
}: {
  children: React.ReactNode;
  user: { fullName: string; email: string };
}) {
  const path = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r px-4 py-5 md:flex"
        style={{ background: "var(--bg-elev)" }}>
        <Logo small />

        <nav className="mt-8 flex-1 space-y-1">
          {NAV.map(({ href, key, icon: Icon }) => {
            const active = path === href || path.startsWith(href + "/");
            return (
              <Link key={href} href={href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition"
                style={{
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--fg)" : "var(--fg-muted)",
                  fontWeight: active ? 600 : 400,
                }}>
                <Icon size={16} /> {t(key)}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 rounded-xl p-3" style={{ background: "var(--bg-sunken)" }}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
              {initials(user.fullName)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{user.fullName || "Peserta"}</div>
              <div className="truncate text-[10px] muted">{user.email}</div>
            </div>
          </div>
          <div className="mt-2.5 flex gap-1.5">
            <LocaleSwitcher compact />
            <ThemeSwitcher compact />
            <button className="btn btn-ghost !px-2.5 min-h-11 min-w-11" title={t("nav.signOut")}
              aria-label={t("nav.signOut")} onClick={signOut}>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Bilah atas KHUSUS PONSEL.
         *
         * Bilah samping disembunyikan di bawah breakpoint md, dan kartu akun
         * ikut tersembunyi bersamanya — sehingga di ponsel tidak ada satu pun
         * jalan untuk berganti bahasa, berganti tema, atau keluar. Bilah ini
         * mengembalikan ketiganya tanpa memakan ruang nav bawah, yang sudah
         * penuh oleh enam tujuan. */}
        <header
          className="sticky top-0 z-30 flex items-center gap-2 border-b px-4 py-2.5 md:hidden"
          style={{ background: "var(--bg-elev)" }}
        >
          <Logo small />
          <span className="ml-auto flex items-center gap-1.5">
            <LocaleSwitcher compact />
            <ThemeSwitcher compact />
            <button
              className="btn btn-ghost !px-2.5 min-h-11 min-w-11"
              title={t("nav.signOut")}
              aria-label={t("nav.signOut")}
              onClick={signOut}
            >
              <LogOut size={16} />
            </button>
          </span>
        </header>

        <main className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
      </div>

      {/* Nav bawah untuk layar kecil.
       *
       * `env(safe-area-inset-bottom)` menjaga agar baris ini tidak tertutup
       * batang beranda iPhone, dan tinggi minimum 44 px mengikuti ukuran
       * sentuh terkecil yang nyaman ditekan jempol. */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex border-t md:hidden"
        style={{ background: "var(--bg-elev)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV.map(({ href, key, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[10px] leading-tight"
              style={{ color: active ? "var(--accent)" : "var(--fg-muted)", fontWeight: active ? 600 : 400 }}
            >
              <Icon size={18} />
              <span className="max-w-full truncate">{t(key).split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end gap-4">
      <div>
        <h1 className="display text-2xl md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm muted">{subtitle}</p>}
      </div>
      {action && <div className="ml-auto">{action}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
        {icon ?? <GraduationCap size={20} />}
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm muted">{body}</p>
      {action}
    </div>
  );
}

const initials = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "EX";
