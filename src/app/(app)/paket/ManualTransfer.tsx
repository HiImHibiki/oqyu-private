"use client";
import { useState } from "react";
import { Building2, Check, Copy, Mail, MessageCircle } from "lucide-react";
import { money } from "@/lib/packages";
import type { Currency } from "@/lib/geo";
import { useI18n } from "@/components/ui/I18nProvider";
import {
  MANUAL_PAYMENT, confirmationMessage, mailtoUrl, orderRef, whatsappUrl,
} from "@/lib/payment";

/* Instruksi transfer bank.
 *
 * Seluruh isinya sudah diketahui begitu pesanan dibuat, jadi tidak ada yang
 * perlu diminta ke server lagi — layar ini bisa dibuka berkali-kali, ditutup,
 * dan dibuka lagi dari riwayat pesanan tanpa satu pun permintaan jaringan.
 *
 * Kuota TIDAK diberikan dari sini. Yang terjadi setelah tombol WhatsApp
 * ditekan hanyalah pesan ke admin; kuotanya lahir di /admin/pesanan, sama
 * seperti kuota dari webhook lahir di webhook. */
export function ManualTransfer({
  orderId, amount, currency, packageName, buyerName,
}: {
  orderId: string;
  amount: number;
  currency: Currency;
  packageName: string;
  buyerName?: string;
}) {
  const { t, intl } = useI18n();
  const ref = orderRef(orderId);
  const shown = money(amount, currency, intl);

  const message = confirmationMessage({ ref, packageName, amount: shown, name: buyerName });
  const wa = whatsappUrl(message);
  const mail = mailtoUrl(`Konfirmasi transfer ${ref}`, message);

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--bg-sunken)" }}>
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Building2 size={15} /> {t("packages.transferTitle")}
      </p>

      <dl className="space-y-2">
        <Row label={t("packages.transferBank")} value={MANUAL_PAYMENT.bank} />
        <Row label={t("packages.transferAccount")} value={MANUAL_PAYMENT.accountNumber} copyable />
        <Row label={t("packages.transferHolder")} value={MANUAL_PAYMENT.accountHolder} />
        <Row label={t("packages.transferAmount")} value={shown} copyable strong />
        <Row label={t("packages.transferRef")} value={ref} copyable strong />
      </dl>

      <p className="mt-2.5 text-xs muted">{t("packages.transferRefHint")}</p>

      {(wa || mail) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-primary flex-1 justify-center">
              <MessageCircle size={15} /> {t("packages.contactWhatsapp")}
            </a>
          )}
          {mail && (
            <a href={mail} className="btn btn-ghost flex-1 justify-center">
              <Mail size={15} /> {t("packages.contactEmail")}
            </a>
          )}
        </div>
      )}

      <p className="mt-3 text-xs muted">{t("packages.transferNote")}</p>
    </div>
  );
}

function Row({ label, value, copyable, strong }: {
  label: string; value: string; copyable?: boolean; strong?: boolean;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Peramban tanpa izin papan klip: nilainya tetap terlihat dan bisa
       * diblok-salin sendiri, jadi tidak ada yang perlu dikeluhkan. */
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <dt className="w-32 shrink-0 muted">{label}</dt>
      <dd className={`min-w-0 flex-1 break-all ${strong ? "font-semibold" : "font-medium"}`}>{value || "—"}</dd>
      {copyable && value && (
        <button type="button" onClick={copy}
          className="shrink-0 rounded-lg px-2 py-1 text-[11px]"
          style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}>
          {copied
            ? <span className="flex items-center gap-1" style={{ color: "var(--ok)" }}><Check size={11} /> {t("packages.copied")}</span>
            : <span className="flex items-center gap-1 muted"><Copy size={11} /> {t("packages.copy")}</span>}
        </button>
      )}
    </div>
  );
}
