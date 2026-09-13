"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { useI18n } from "./I18nProvider";

export const CONSENT_COOKIE = "exact_cookie_consent";

/* Banner ini sengaja TIDAK generik.
 *
 * Cookie esensial (sesi, bahasa, tema) tidak memerlukan izin menurut ePrivacy,
 * dan meminta izin untuk sesuatu yang tetap kita pasang adalah teater. Yang
 * benar-benar butuh izin hanya satu: cookie rujukan afiliasi, karena ia
 * mengikuti pengguna selama 30 hari demi kepentingan komersial kita.
 * Banner ini menyebutkannya apa adanya. */
export function CookieConsent() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const has = document.cookie.split("; ").some((c) => c.startsWith(`${CONSENT_COOKIE}=`));
    if (!has) setShow(true);
  }, []);

  function decide(value: "all" | "essential") {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${365 * 24 * 3600}; SameSite=Lax${secure}`;
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] p-3 sm:p-4" role="dialog" aria-label={t("cookie.title")}>
      <div className="card mx-auto flex max-w-3xl flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          <Cookie size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("cookie.title")}</p>
          <p className="mt-0.5 text-xs leading-relaxed muted">{t("cookie.body")}</p>
          <Link href="/privasi" className="mt-1 inline-block text-xs underline muted">{t("cookie.more")}</Link>
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost !py-1.5 !text-xs" onClick={() => decide("essential")}>
            {t("cookie.reject")}
          </button>
          <button className="btn btn-primary !py-1.5 !text-xs" onClick={() => decide("all")}>
            {t("cookie.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
