"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle, RotateCcw } from "lucide-react";

/** Tombol mulai latihan dari paket guru — pengerjaan penuh (berwaktu) atau
 *  perbaikan (hanya nomor yang masih salah, tanpa waktu). */
export function MulaiLatihan({ body, label = "Mulai", kecil, gaya = "primary", ikon = "mulai" }: {
  body: { paketId: string; perbaikan?: boolean };
  label?: string; kecil?: boolean; gaya?: "primary" | "ghost"; ikon?: "mulai" | "ulang";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const Ikon = ikon === "ulang" ? RotateCcw : PlayCircle;
  return (
    <button className={`btn btn-${gaya} shrink-0 ${kecil ? "!px-3 !py-1.5 text-xs" : ""}`} disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await fetch("/api/latihan", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
        });
        const j = await r.json();
        setBusy(false);
        if (j.attemptId) router.push(`/ujian/${j.attemptId}`);
        else alert(j.error ?? "Gagal memulai");
      }}>
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Ikon size={16} />} {label}
    </button>
  );
}
