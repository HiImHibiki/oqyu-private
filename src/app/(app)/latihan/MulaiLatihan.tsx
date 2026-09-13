"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle } from "lucide-react";

/** Tombol mulai latihan — dari paket guru, atau acak per topik dari bank. */
export function MulaiLatihan({ body, label = "Mulai", kecil }: {
  body: { paketId: string } | { mapel: string; kelas?: string; topik?: string; jumlah?: number };
  label?: string; kecil?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button className={`btn btn-primary shrink-0 ${kecil ? "!px-3 !py-1.5 text-xs" : ""}`} disabled={busy}
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
      {busy ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />} {label}
    </button>
  );
}
