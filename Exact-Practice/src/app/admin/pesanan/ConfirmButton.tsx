"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2 } from "lucide-react";

/* Tombol «Tandai lunas» untuk transfer bank.
 *
 * Menekan tombol ini memberi kuota kepada orang lain, jadi ia sengaja tidak
 * dibuat gampang ditekan tanpa sadar: konfirmasinya menyebut nominal, kode
 * pesanan, dan pemiliknya — tiga hal yang harus dicocokkan admin dengan mutasi
 * rekening sebelum menjawab «ya». */
export function ConfirmButton({ orderId, code, label }: {
  orderId: string; code: string; label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirmPaid() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/admin/orders/confirm", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error ?? "Gagal menandai lunas"); return; }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button className="btn btn-ghost !px-2 !py-1 text-xs" disabled={busy}
        onClick={() => {
          if (!confirm(
            `Tandai lunas pesanan ${code}?\n\n${label}\n\n` +
            "Pastikan dananya benar-benar terlihat di mutasi rekening. Kuota langsung " +
            "diberikan dan struk dikirim ke pembeli.",
          )) return;
          void confirmPaid();
        }}>
        {busy ? <Loader2 size={13} className="animate-spin" /> : <BadgeCheck size={13} />}
        Tandai lunas
      </button>
      {err && <span className="max-w-[190px] text-[11px] leading-snug" style={{ color: "var(--danger)" }}>{err}</span>}
    </span>
  );
}
