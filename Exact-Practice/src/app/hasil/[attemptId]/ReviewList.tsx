"use client";
import { useState } from "react";
import { CheckCircle2, ChevronDown, MinusCircle, XCircle } from "lucide-react";
import type { Question } from "@/lib/types";
import { QuestionView } from "@/components/exam/QuestionView";
import { RichText } from "@/components/exam/RichText";
import { answerLabel } from "@/lib/exams/grade";
import { useI18n } from "@/components/ui/I18nProvider";

export interface ReviewItem {
  sectionName: string;
  index: number;
  question: Question;
  raw: unknown;
  correct: boolean;
  credit: number;
  /** Untuk soal esai: nilai pengajar, atau null bila belum dinilai. */
  mark?: {
    awarded: number[];
    total: number;
    comment?: string;
    by: string;
    at: string;
  } | null;
}

type Filter = "all" | "wrong" | "blank";

export function ReviewList({ items }: { items: ReviewItem[] }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(items[0]?.question.id ?? null);

  const shown = items.filter((it) =>
    filter === "all" ? true : filter === "wrong" ? !it.correct : it.raw === null || it.raw === "",
  );

  return (
    <>
      <div className="mb-3 flex gap-2">
        {([["all", t("result.filterAll", { n: items.length })], ["wrong", t("result.filterWrong", { n: items.filter((i) => !i.correct).length })], ["blank", t("result.filterBlank", { n: items.filter((i) => i.raw === null || i.raw === "").length })]] as [Filter, string][]).map(([k, label]) => (
          <button key={k} className="chip" onClick={() => setFilter(k)}
            style={filter === k ? { background: "var(--accent)", color: "var(--accent-fg)", borderColor: "transparent" } : undefined}>
            {label}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {shown.map((it) => {
          const q = it.question;
          const isOpen = open === q.id;
          const blank = it.raw === null || it.raw === "";
          return (
            <li key={q.id} className="card overflow-hidden">
              <button className="flex w-full items-center gap-3 px-4 py-3 text-left"
                onClick={() => setOpen(isOpen ? null : q.id)}>
                {blank ? <MinusCircle size={17} className="muted shrink-0" />
                  : it.correct ? <CheckCircle2 size={17} style={{ color: "var(--ok)" }} className="shrink-0" />
                  : <XCircle size={17} style={{ color: "var(--danger)" }} className="shrink-0" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">#{it.index} · {q.domain}</span>
                  <span className="block truncate text-xs muted">{q.skill} · {it.sectionName}</span>
                </span>
                <span className="chip">{{ E: t("common.easy"), M: t("common.medium"), H: t("common.hard") }[q.difficulty]}</span>
                <ChevronDown size={16} className="shrink-0 transition"
                  style={{ transform: isOpen ? "rotate(180deg)" : undefined }} />
              </button>

              {isOpen && (
                <div className="border-t px-5 py-5">
                  {q.stimulus && (
                    <div className="mb-4 rounded-xl p-4" style={{ background: "var(--bg-sunken)" }}>
                      {q.stimulus.title && <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider muted">{q.stimulus.title}</p>}
                      <RichText className="passage text-[.95rem]">{q.stimulus.content}</RichText>
                    </div>
                  )}

                  <QuestionView
                    question={q}
                    value={it.raw}
                    onChange={() => {}}
                    review
                    correctIds={correctIds(q)}
                  />

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl px-4 py-3" style={{ background: "var(--bg-sunken)" }}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider muted">{t("result.yourAnswer")}</p>
                      <p className="mt-0.5 text-sm">{blank ? t("common.empty") : String(formatRaw(it.raw))}</p>
                    </div>
                    <div className="rounded-xl px-4 py-3" style={{ background: "color-mix(in srgb, var(--ok) 12%, transparent)" }}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider muted">{t("result.key")}</p>
                      <p className="mt-0.5 text-sm">{answerLabel(q)}</p>
                    </div>
                  </div>

                  {/* Soal esai: nilai dan umpan balik pengajar. Angka saja
                      tidak mengajari apa pun — komentarnya yang berguna. */}
                  {q.answer?.mode === "rubric" && (
                    it.mark ? (
                      <div className="mt-4 rounded-xl px-4 py-3" style={{ background: "var(--bg-sunken)" }}>
                        <div className="mb-2 flex items-baseline gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wider muted">Penilaian pengajar</p>
                          <span className="ml-auto text-sm tabular-nums">
                            <strong>{it.mark.total}</strong> <span className="muted">/ {q.points} poin</span>
                          </span>
                        </div>
                        <ul className="mb-2 space-y-1">
                          {(q.answer.rubric ?? []).map((c, ci) => (
                            <li key={ci} className="flex gap-2 text-xs">
                              <span className="tabular-nums muted">{it.mark!.awarded[ci] ?? 0}/{c.points}</span>
                              <span className="flex-1">{c.criterion}</span>
                            </li>
                          ))}
                        </ul>
                        {it.mark.comment && <p className="mt-2 whitespace-pre-wrap text-sm">{it.mark.comment}</p>}
                        <p className="mt-2 text-[11px] muted">
                          Dinilai {it.mark.by} · {new Date(it.mark.at).toLocaleDateString()}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-4 rounded-xl px-4 py-3 text-sm muted" style={{ background: "var(--bg-sunken)" }}>
                        Menunggu penilaian pengajar. Soal ini belum dihitung dalam skor —
                        tidak dianggap salah.
                      </p>
                    )
                  )}

                  <div className="mt-4">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider muted">{t("result.explanation")}</p>
                    <RichText className="text-sm leading-relaxed">{q.explanation}</RichText>
                  </div>

                  {q.distractorRationale && Object.keys(q.distractorRationale).length > 0 && (
                    <div className="mt-4">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider muted">{t("result.distractors")}</p>
                      <ul className="space-y-1 text-sm muted">
                        {Object.entries(q.distractorRationale).map(([k, v]) => (
                          <li key={k}><strong>{k}.</strong> {v}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function correctIds(q: Question): string[] {
  if (q.answer.mode === "choice") return [q.answer.value];
  if (q.answer.mode === "choice_set") return q.answer.value;
  return [];
}

function formatRaw(raw: unknown): string {
  if (raw === null || raw === undefined) return "(kosong)";
  if (Array.isArray(raw)) return raw.map((v) => (v === true ? "Benar" : v === false ? "Salah" : String(v ?? "-"))).join(", ");
  if (typeof raw === "object") return Object.entries(raw as object).map(([k, v]) => `${k}: ${v}`).join(", ");
  return String(raw);
}
