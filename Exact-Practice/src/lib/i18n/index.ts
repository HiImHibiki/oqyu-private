import { cookies } from "next/headers";
import { LOCALES, LOCALE_META, translate, type Locale, type MessageKey } from "./dictionaries";

export { LOCALES, LOCALE_META };
export type { Locale, MessageKey };

export const LOCALE_COOKIE = "exact_locale";
export const DEFAULT_LOCALE: Locale = "id";   // bimbel Indonesia: selalu Indonesia kecuali pengguna memilih lain

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

export { translate } from "./dictionaries";

export type Translator = (key: MessageKey, params?: Record<string, string | number>) => string;

export const translatorFor = (locale: Locale): Translator =>
  (key, params) => translate(locale, key, params);

/* ---------------------------------------------------------- sisi server */

/** Bahasa = cookie pilihan pengguna (tombol bahasa), selain itu Indonesia.
 *
 * Accept-Language browser sengaja TIDAK dipakai lagi. Warisan Try Out dulu
 * melewati "en" lalu mengembalikan "zh" bila Mandarin tercantum di urutan
 * mana pun — browser "Inggris, Mandarin" mendapat halaman Mandarin (24 Sep
 * 2026). Murid Exact Course berbahasa Indonesia; yang lain bisa memilih
 * sendiri. */
export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const fromCookie = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
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
