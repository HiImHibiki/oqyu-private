"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle } from "lucide-react";

export function StartTryout({ exam, disabled }: { exam: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button className="btn btn-primary shrink-0" disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        const r = await fetch("/api/attempts", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ exam }),
        });
        const j = await r.json();
        setBusy(false);
        if (j.attemptId) router.push(`/ujian/${j.attemptId}`);
        else alert(j.error ?? "Gagal memulai");
      }}>
      {busy ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />} Mulai
    </button>
  );
}
