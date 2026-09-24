"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2 } from "lucide-react";

/* Tombol pengembalian dana.
 *
 * Syarat kelayakan sengaja TIDAK dihitung di sini melainkan di server: satu
 * tempat, satu aturan. Halaman ini hanya menampilkan apa yang dijawab server,
 * termasuk ketika jawabannya «tidak memenuhi syarat» — dan barulah admin
 * memutuskan apakah tetap mengembalikan dana. */
export function RefundButton({ orderId, label }: { orderId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function refund(force: boolean) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/refund", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, force }),
      });
      const j = await r.json();

      if (r.status === 409 && j.needsForce) { setBlocked(j.error); return; }
      if (!r.ok) { setBlocked(j.error ?? "Gagal memproses pengembalian"); return; }

      setBlocked(null);
      setDone(`${j.attemptsRevoked ?? 0} kuota dicabut · ${j.commissionsVoided ?? 0} komisi dibatalkan`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (done) return <span className="text-[11px]" style={{ color: "var(--ok)" }}>{done}</span>;

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button className="btn btn-ghost !px-2 !py-1 text-xs" disabled={busy}
        title={`Kembalikan dana ${label}`}
        onClick={() => {
          if (!blocked && !confirm(
            `Kembalikan dana untuk ${label}?\n\n` +
            "Uangnya dikembalikan lewat dasbor gateway; tombol ini mencabut sisa kuota " +
            "dan membatalkan komisi afiliasi atas pesanan ini.",
          )) return;
          void refund(Boolean(blocked));
        }}>
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
        {blocked ? "Tetap kembalikan" : "Refund"}
      </button>
      {blocked && (
        <span className="max-w-[190px] text-[11px] leading-snug" style={{ color: "var(--warn)" }}>
          {blocked} Tekan sekali lagi untuk tetap mengembalikan.
        </span>
      )}
    </span>
  );
}
