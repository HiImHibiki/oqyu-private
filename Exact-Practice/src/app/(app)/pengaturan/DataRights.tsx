"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, Loader2, Trash2 } from "lucide-react";
import { useI18n } from "@/components/ui/I18nProvider";

/** Hak akses dan penghapusan yang benar-benar berjalan, bukan janji di
 *  kebijakan privasi. Keduanya seketika: tanpa formulir, tanpa masa tunggu. */
export function DataRights() {
  const { t } = useI18n();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function remove() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/privacy/delete", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: typed }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Deletion failed");
    alert(t("data.deleted"));
    router.push("/");
    router.refresh();
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 font-semibold">{t("data.title")}</h2>
      <p className="mb-4 text-xs muted">{t("data.sub")}</p>

      {err && (
        <p className="mb-3 text-sm" style={{ color: "var(--danger)" }}>{err}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl p-4" style={{ background: "var(--bg-sunken)" }}>
          <a className="btn btn-ghost w-full" href="/api/privacy/export" download>
            <Download size={15} /> {t("data.export")}
          </a>
          <p className="mt-2 text-[11px] leading-relaxed muted">{t("data.exportHint")}</p>
        </div>

        <div className="rounded-xl p-4" style={{ background: "var(--bg-sunken)" }}>
          {!confirming ? (
            <>
              <button className="btn btn-ghost w-full" style={{ color: "var(--danger)" }}
                onClick={() => setConfirming(true)}>
                <Trash2 size={15} /> {t("data.delete")}
              </button>
              <p className="mt-2 text-[11px] leading-relaxed muted">{t("data.deleteHint")}</p>
            </>
          ) : (
            <>
              <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--danger)" }}>
                <AlertTriangle size={14} /> {t("data.deleteConfirmTitle")}
              </p>
              <p className="mb-2 text-[11px] leading-relaxed muted">{t("data.deleteConfirmBody")}</p>
              <input className="input mb-2 font-mono" value={typed} placeholder={t("data.deleteTyped")}
                onChange={(e) => setTyped(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn btn-ghost flex-1 !py-1.5 !text-xs"
                  onClick={() => { setConfirming(false); setTyped(""); }}>
                  {t("common.cancel")}
                </button>
                <button className="btn btn-danger flex-1 !py-1.5 !text-xs"
                  disabled={busy || typed.trim().toUpperCase() !== "DELETE"} onClick={remove}>
                  {busy ? <><Loader2 size={12} className="animate-spin" /> {t("data.deleting")}</> : t("data.delete")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
