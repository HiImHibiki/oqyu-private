"use client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/components/ui/I18nProvider";
import { usePayment, type Gateway } from "@/lib/usePayment";

/** Melanjutkan pesanan yang sudah dibuat tetapi belum dibayar.
 *
 *  Pesanan lama tetap bisa dibayar berapa pun umurnya: sesi gateway-nya dibuat
 *  ulang setiap kali tombol ini ditekan, jadi tautan Snap atau Stripe yang
 *  sudah kedaluwarsa tidak menjadi alasan pembeli kehilangan pesanannya. */
export function ResumePayment({
  orderId, gateway, packageId, compact,
}: {
  orderId: string;
  gateway: Gateway;
  packageId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { busy, waiting, err, pay } = usePayment(() => router.refresh());

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button className={`btn ${compact ? "btn-ghost !px-2.5 !py-1.5 text-xs" : "btn-primary"}`}
        disabled={busy || waiting} onClick={() => pay(orderId, gateway, packageId)}>
        {busy || waiting ? <Loader2 size={14} className="animate-spin" /> : null}
        {waiting ? t("auth.waitingPayment") : t("packages.resume")}
      </button>
      {err && <span className="text-[11px]" style={{ color: "var(--danger)" }}>{err}</span>}
    </span>
  );
}
