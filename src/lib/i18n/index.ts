import { cookies, headers } from "next/headers";
import { LOCALES, LOCALE_META, translate, type Locale, type MessageKey } from "./dictionaries";

export { LOCALES, LOCALE_META };
export type { Locale, MessageKey };

export const LOCALE_COOKIE = "exact_locale";
export const DEFAULT_LOCALE: Locale = "id";   // bimbel Indonesia: bahasa Indonesia kecuali peramban minta lain

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

export { translate } from "./dictionaries";

export type Translator = (key: MessageKey, params?: Record<string, string | number>) => string;

export const translatorFor = (locale: Locale): Translator =>
  (key, params) => translate(locale, key, params);

/* ---------------------------------------------------------- sisi server */

/** Urutan penentuan bahasa:
 *   1. cookie pilihan pengguna
 *   2. header Accept-Language dari browser
 *   3. bahasa Inggris
 *
 * Bahasa Inggris sengaja menjadi default, bukan Indonesia: pengunjung dari
 * negara mana pun harus bisa memahami halaman pertama yang ia lihat. */
export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const fromCookie = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();
    if (tag.startsWith("id")) return "id";
    if (tag.startsWith("zh")) return "zh";
  }
  return DEFAULT_LOCALE;
}

/** Dipakai Server Component: `const t = await getT();` */
export async function getT(): Promise<Translator> {
  return translatorFor(await getLocale());
}

/* ------------------------------------------------------- format lokal */

export const intlTag = (locale: Locale) => LOCALE_META[locale].intl;

export function formatDate(
  value: string | number | Date,
  locale: Locale,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
  timeZone?: string,
) {
  return new Intl.DateTimeFormat(intlTag(locale), { ...opts, timeZone }).format(new Date(value));
}

export function formatNumber(value: number, locale: Locale, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(intlTag(locale), opts).format(value);
}
