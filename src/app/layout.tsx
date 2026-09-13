import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { I18nProvider } from "@/components/ui/I18nProvider";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { themeCss, DEFAULT_THEME } from "@/lib/themes";
import { getLocale, translate } from "@/lib/i18n";

/* `viewport-fit: cover` diperlukan agar `env(safe-area-inset-*)` bernilai
 * bukan nol di iPhone berponi. Tanpa baris ini, jarak aman yang dipasang pada
 * nav bawah tetap terhitung 0 dan barisnya tertutup batang beranda —
 * gejalanya halus: menu terakhir tampak ada tetapi tidak bisa ditekan.
 *
 * `maximumScale` sengaja TIDAK dibatasi: mengunci cubit-zoom membuat teks kecil
 * mustahil diperbesar oleh pengguna yang membutuhkannya. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: { default: "Exact Try Out", template: "%s · Exact Try Out" },
    description: translate(locale, "landing.sub"),
    applicationName: "Exact Try Out",
    alternates: { languages: { en: "/", id: "/", "zh-CN": "/" } },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const htmlLang = locale === "zh" ? "zh-CN" : locale;

  return (
    <html lang={htmlLang} data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <I18nProvider locale={locale}>
          <ThemeProvider>
            {children}
            <CookieConsent />
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
