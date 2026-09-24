"use client";
import { Check, Languages } from "lucide-react";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/dictionaries";
import { useI18n } from "./I18nProvider";
import { Dropdown } from "./Dropdown";

export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <Dropdown
      label={t("nav.language")}
      width={224}
      trigger={
        <>
          <Languages size={16} />
          {!compact && <span>{LOCALE_META[locale].native}</span>}
        </>
      }
    >
      {(close) =>
        LOCALES.map((l: Locale) => (
          <button
            key={l}
            role="menuitemradio"
            aria-checked={locale === l}
            onClick={() => { setLocale(l); close(); }}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm hover:bg-[var(--bg-sunken)]"
          >
            <span aria-hidden>{LOCALE_META[l].flag}</span>
            <span className="flex-1">{LOCALE_META[l].native}</span>
            {locale === l && <Check size={14} />}
          </button>
        ))
      }
    </Dropdown>
  );
}
