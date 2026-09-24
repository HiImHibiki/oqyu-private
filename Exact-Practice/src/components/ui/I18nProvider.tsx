"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  DICTIONARIES, LOCALE_META, type Locale, type MessageKey,
} from "@/lib/i18n/dictionaries";

interface Ctx {
  locale: Locale;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  setLocale: (l: Locale) => void;
  /** tag Intl, mis. "zh-CN" — dipakai untuk memformat tanggal dan angka */
  intl: string;
}

const I18nCtx = createContext<Ctx | null>(null);

export function useI18n(): Ctx {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n dipakai di luar I18nProvider");
  return ctx;
}

export function I18nProvider({ locale: initial, children }: { locale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initial);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.documentElement.lang = l === "zh" ? "zh-CN" : l;
    // simpan pilihan; cookie juga di-set server supaya render berikutnya konsisten
    void fetch("/api/profile/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: l }),
    }).catch(() => {});
  }, []);

  const value = useMemo<Ctx>(() => ({
    locale,
    intl: LOCALE_META[locale].intl,
    setLocale,
    t: (key, params) => {
      const raw = DICTIONARIES[locale]?.[key] ?? DICTIONARIES.en[key] ?? key;
      if (!params) return raw;
      return raw.replace(/\{(\w+)\}/g, (m, k: string) => String(params[k] ?? m));
    },
  }), [locale, setLocale]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}
