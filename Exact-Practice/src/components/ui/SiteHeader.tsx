"use client";
import Link from "next/link";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useI18n } from "./I18nProvider";

export function Logo({ small }: { small?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span
        className="flex items-center justify-center rounded-lg font-bold"
        style={{
          width: small ? 26 : 30, height: small ? 26 : 30,
          background: "var(--accent)", color: "var(--accent-fg)",
          fontSize: small ? 12 : 14, letterSpacing: "-.03em",
        }}
      >
        EX
      </span>
      <span className="display leading-tight" style={{ fontSize: small ? 15 : 17 }}>
        Exact <span className="muted">Practice</span>
      </span>
    </Link>
  );
}

export function SiteHeader({ authed }: { authed?: boolean }) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-30 border-b backdrop-blur"
      style={{ background: "color-mix(in srgb, var(--bg) 88%, transparent)" }}>
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
        <Logo />
        <nav className="ml-6 hidden items-center gap-5 text-sm md:flex">
          <a href="#exams" className="muted hover:text-[var(--fg)]">{t("nav.exams")}</a>
          <a href="#features" className="muted hover:text-[var(--fg)]">{t("nav.features")}</a>
          <a href="#pricing" className="muted hover:text-[var(--fg)]">{t("nav.pricing")}</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher compact />
          <ThemeSwitcher compact />
          {authed ? (
            <Link href="/latihan" className="btn btn-primary">{t("nav.dashboard")}</Link>
          ) : (
            <>
              <Link href="/masuk" className="btn btn-ghost">{t("nav.signIn")}</Link>
              <Link href="/daftar" className="btn btn-primary">{t("nav.start")}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
