/* =========================================================================
 * Negara, mata uang, dan nomor telepon internasional.
 *
 * Sebelum ini, pendaftaran menolak setiap nomor telepon non-Indonesia dan
 * seluruh harga hanya ada dalam rupiah — dua hal yang membuat aplikasi ini
 * mustahil dipakai peserta SAT, CSCA, atau A Level di luar Indonesia.
 * ========================================================================= */

export const CURRENCIES = ["USD", "IDR", "CNY", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface Country {
  code: string;      // ISO 3166-1 alpha-2
  name: string;
  dial: string;      // kode panggil, tanpa "+"
  currency: Currency;
}

/* Daftar difokuskan ke pasar keempat ujian: Asia Tenggara dan Asia Selatan
 * (SAT, CSCA), Asia Timur (CSCA), Timur Tengah dan Afrika (A Level), serta
 * negara-negara berbahasa Inggris yang menjadi tujuan studi. "Lainnya"
 * menutup sisanya tanpa memaksa daftar ini menjadi lengkap. */
export const COUNTRIES: Country[] = [
  { code: "ID", name: "Indonesia", dial: "62", currency: "IDR" },
  { code: "MY", name: "Malaysia", dial: "60", currency: "USD" },
  { code: "SG", name: "Singapore", dial: "65", currency: "USD" },
  { code: "TH", name: "Thailand", dial: "66", currency: "USD" },
  { code: "VN", name: "Vietnam", dial: "84", currency: "USD" },
  { code: "PH", name: "Philippines", dial: "63", currency: "USD" },
  { code: "MM", name: "Myanmar", dial: "95", currency: "USD" },
  { code: "KH", name: "Cambodia", dial: "855", currency: "USD" },
  { code: "LA", name: "Laos", dial: "856", currency: "USD" },
  { code: "BN", name: "Brunei", dial: "673", currency: "USD" },
  { code: "TL", name: "Timor-Leste", dial: "670", currency: "USD" },

  { code: "CN", name: "China", dial: "86", currency: "CNY" },
  { code: "HK", name: "Hong Kong", dial: "852", currency: "CNY" },
  { code: "TW", name: "Taiwan", dial: "886", currency: "CNY" },
  { code: "KR", name: "South Korea", dial: "82", currency: "USD" },
  { code: "JP", name: "Japan", dial: "81", currency: "USD" },
  { code: "MN", name: "Mongolia", dial: "976", currency: "CNY" },
  { code: "KZ", name: "Kazakhstan", dial: "7", currency: "USD" },
  { code: "UZ", name: "Uzbekistan", dial: "998", currency: "USD" },

  { code: "IN", name: "India", dial: "91", currency: "USD" },
  { code: "PK", name: "Pakistan", dial: "92", currency: "USD" },
  { code: "BD", name: "Bangladesh", dial: "880", currency: "USD" },
  { code: "LK", name: "Sri Lanka", dial: "94", currency: "USD" },
  { code: "NP", name: "Nepal", dial: "977", currency: "USD" },

  { code: "AE", name: "United Arab Emirates", dial: "971", currency: "USD" },
  { code: "SA", name: "Saudi Arabia", dial: "966", currency: "USD" },
  { code: "QA", name: "Qatar", dial: "974", currency: "USD" },
  { code: "KW", name: "Kuwait", dial: "965", currency: "USD" },
  { code: "OM", name: "Oman", dial: "968", currency: "USD" },
  { code: "BH", name: "Bahrain", dial: "973", currency: "USD" },
  { code: "EG", name: "Egypt", dial: "20", currency: "USD" },
  { code: "JO", name: "Jordan", dial: "962", currency: "USD" },
  { code: "TR", name: "Türkiye", dial: "90", currency: "EUR" },

  { code: "NG", name: "Nigeria", dial: "234", currency: "USD" },
  { code: "GH", name: "Ghana", dial: "233", currency: "USD" },
  { code: "KE", name: "Kenya", dial: "254", currency: "USD" },
  { code: "TZ", name: "Tanzania", dial: "255", currency: "USD" },
  { code: "ZA", name: "South Africa", dial: "27", currency: "USD" },
  { code: "ET", name: "Ethiopia", dial: "251", currency: "USD" },

  { code: "GB", name: "United Kingdom", dial: "44", currency: "EUR" },
  { code: "IE", name: "Ireland", dial: "353", currency: "EUR" },
  { code: "DE", name: "Germany", dial: "49", currency: "EUR" },
  { code: "FR", name: "France", dial: "33", currency: "EUR" },
  { code: "NL", name: "Netherlands", dial: "31", currency: "EUR" },
  { code: "ES", name: "Spain", dial: "34", currency: "EUR" },
  { code: "IT", name: "Italy", dial: "39", currency: "EUR" },

  { code: "US", name: "United States", dial: "1", currency: "USD" },
  { code: "CA", name: "Canada", dial: "1", currency: "USD" },
  { code: "AU", name: "Australia", dial: "61", currency: "USD" },
  { code: "NZ", name: "New Zealand", dial: "64", currency: "USD" },
  { code: "BR", name: "Brazil", dial: "55", currency: "USD" },
  { code: "MX", name: "Mexico", dial: "52", currency: "USD" },

  { code: "XX", name: "Other country", dial: "", currency: "USD" },
];

export const countryByCode = (code: string) =>
  COUNTRIES.find((c) => c.code === code.toUpperCase());

export function currencyForCountry(code?: string | null): Currency {
  return countryByCode(code ?? "")?.currency ?? "USD";
}

/* ------------------------------------------------------ nomor telepon */

/** Menormalkan nomor ke bentuk E.164 (`+6281234567890`).
 *
 *  Menerima nomor lokal dengan awalan 0 selama negaranya diketahui, karena
 *  hampir semua orang mengetikkan nomornya seperti itu. */
export function toE164(raw: string, countryCode?: string): string | null {
  const country = countryByCode(countryCode ?? "");
  let s = (raw ?? "").replace(/[\s\-().]/g, "");
  if (!s) return null;

  if (s.startsWith("00")) s = "+" + s.slice(2);

  if (!s.startsWith("+")) {
    if (!country?.dial) return null;                 // tanpa kode negara, tidak bisa ditebak
    s = s.replace(/^0+/, "");                        // buang nol depan gaya lokal
    s = `+${country.dial}${s}`;
  }

  return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
}

export const isValidPhone = (raw: string, countryCode?: string) => toE164(raw, countryCode) !== null;

/* ---------------------------------------------------------- mata uang */

/** Nol desimal untuk rupiah; dua desimal untuk sisanya. */
export const CURRENCY_DECIMALS: Record<Currency, number> = { IDR: 0, USD: 2, CNY: 2, EUR: 2 };

export function formatMoney(amount: number, currency: Currency, intlTag = "en-US") {
  return new Intl.NumberFormat(intlTag, {
    style: "currency",
    currency,
    minimumFractionDigits: CURRENCY_DECIMALS[currency],
    maximumFractionDigits: CURRENCY_DECIMALS[currency],
  }).format(amount);
}

/** Nominal dalam satuan terkecil — sen untuk USD/EUR/CNY, rupiah utuh untuk IDR.
 *  Stripe meminta bentuk ini; Midtrans meminta rupiah utuh. */
export function toMinorUnits(amount: number, currency: Currency) {
  return CURRENCY_DECIMALS[currency] === 0 ? Math.round(amount) : Math.round(amount * 100);
}

/** Gateway mana yang menangani mata uang ini.
 *  Midtrans hanya melayani rupiah; sisanya lewat Stripe. */
export const gatewayFor = (currency: Currency): "midtrans" | "stripe" =>
  currency === "IDR" ? "midtrans" : "stripe";
