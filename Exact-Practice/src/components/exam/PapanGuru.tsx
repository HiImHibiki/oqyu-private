"use client";
import { ChevronDown, ChevronUp, Maximize2, Minimize2, X } from "lucide-react";
import { useI18n } from "@/components/ui/I18nProvider";

export type ModePapan = "kecil" | "normal" | "penuh";

/* Panel papan guru: layar murid Exact Canvas di dalam halaman Practice.
 * Di halaman soal: di ponsel menumpuk di bawah soal (45% tinggi), di layar
 * lebar berdampingan di kanan. Di halaman hasil: satu blok selebar halaman
 * (`kelasNormal`). "Lipat" hanya menyembunyikan — iframe-nya tetap hidup
 * supaya sambungan ke kanvas tidak putus dan bunyi "dibahas" tetap sampai. */
export function PapanGuru({ url, mode, onMode, onTutup, kelasNormal }: {
  url: string; mode: ModePapan;
  onMode: (m: ModePapan) => void; onTutup?: () => void;
  /** kelas tata letak saat mode normal; bawaan = panel samping di halaman soal */
  kelasNormal?: string;
}) {
  const { t } = useI18n();
  const penuh = mode === "penuh";
  const kecil = mode === "kecil";
  const kelas = penuh
    ? "fixed inset-0 z-[60] flex flex-col"
    : kecil
      ? "flex shrink-0 flex-col border-t lg:border-l lg:border-t-0"
      : (kelasNormal ?? "flex shrink-0 flex-col border-t lg:border-l lg:border-t-0 h-[45%] lg:h-auto lg:w-1/2");
  return (
    <section className={kelas} style={{ background: "var(--bg-elev)" }} aria-label={t("exam.boardTitle")}>
      <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs">
        <span className="shrink-0 font-semibold">{t("exam.boardTitle")}</span>
        {!penuh && <span className="hidden truncate muted sm:inline">{t("exam.boardHint")}</span>}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {!penuh && (
            <button className="btn btn-ghost !px-2 !py-1" onClick={() => onMode(kecil ? "normal" : "kecil")} title={kecil ? t("exam.boardShow") : t("exam.boardCollapse")}>
              {kecil ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          <button className="btn btn-ghost !px-2 !py-1" onClick={() => onMode(penuh ? "normal" : "penuh")} title={penuh ? t("exam.boardBack") : t("exam.boardFull")}>
            {penuh ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {onTutup && (
            <button className="btn btn-ghost !px-2 !py-1" onClick={onTutup} title={t("exam.boardClose")}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <iframe
        src={url}
        title={t("exam.boardTitle")}
        className="w-full min-h-0 flex-1 border-0"
        hidden={kecil}
        allow="fullscreen; screen-wake-lock; autoplay"
      />
    </section>
  );
}
