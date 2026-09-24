"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Undo2 } from "lucide-react";
import { ReviewPanel } from "../soal/ReviewPanel";
import type { QueueItem } from "@/lib/exams/reviewRisk";

/* Antrean tinjauan.
 *
 * Meninjau menurut urutan id berarti soal paling berbahaya mungkin baru
 * tersentuh berminggu-minggu kemudian. Di sini urutannya dibalik: yang paling
 * mungkin menyembunyikan kekeliruan naik ke atas, dan alasannya ditampilkan
 * sebagai chip supaya peninjau tahu apa yang harus dicurigai. */
export function ReviewQueue({
  items, total, done, active, exam, includeReviewed, canApprove,
}: {
  items: QueueItem[]; total: number; done: number; active: number;
  exam: string; includeReviewed: boolean; canApprove: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const pct = active ? Math.round((100 * done) / active) : 0;

  function go(patch: Record<string, string>) {
    const p = new URLSearchParams({ exam, all: includeReviewed ? "1" : "", ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    router.push(`/admin/tinjauan?${p.toString()}`);
  }

  return (
    <>
      <div className="card mb-5 p-5">
        <div className="mb-2 flex flex-wrap items-baseline gap-2">
          <span className="display text-2xl">{done}</span>
          <span className="text-sm muted">dari {active} soal aktif sudah diperiksa manusia</span>
          <span className="ml-auto text-sm font-semibold">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--bg-sunken)" }}>
          <div className="h-full rounded-full transition-[width]"
            style={{ width: `${pct}%`, background: pct >= 100 ? "var(--ok)" : "var(--accent)" }} />
        </div>
        <p className="mt-2 text-xs muted">
          Validator sudah memastikan strukturnya benar. Yang tersisa hanya bisa diperiksa orang yang
          menguasai materinya: apakah kuncinya benar, apakah semua pengecoh sungguh salah, dan apakah
          pembahasannya menjelaskan alasannya.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className="input !w-auto !py-1.5 text-sm" value={exam} onChange={(e) => go({ exam: e.target.value })}>
          <option value="">Semua ujian</option>
          {["SAT", "UTBK", "CSCA", "ALEVEL"].map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <input type="checkbox" className="accent-[var(--accent)]" checked={includeReviewed}
            onChange={(e) => go({ all: e.target.checked ? "1" : "" })} />
          tampilkan yang sudah disetujui
        </label>
        <span className="ml-auto text-xs muted">{total} soal dalam antrean</span>
      </div>

      <ol className="space-y-2">
        {items.map((it, i) => (
          <li key={it.id}>
            <button className="card flex w-full gap-3 p-4 text-left" onClick={() => setOpen(it.id)}>
              <span className="w-7 shrink-0 pt-0.5 text-right font-mono text-xs muted">{i + 1}</span>

              <span className="w-14 shrink-0">
                <span className="block rounded-md px-1.5 py-0.5 text-center text-xs font-semibold"
                  style={{
                    background: it.score >= 70 ? "color-mix(in srgb, var(--danger) 15%, transparent)"
                      : it.score >= 40 ? "color-mix(in srgb, var(--warn) 15%, transparent)"
                      : "var(--bg-sunken)",
                    color: it.score >= 70 ? "var(--danger)" : it.score >= 40 ? "var(--warn)" : "var(--fg-muted)",
                  }}>
                  {it.score}
                </span>
              </span>

              <span className="min-w-0 flex-1">
                <span className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="chip">{it.exam}</span>
                  <span className="chip font-mono text-[10px]">{it.section}</span>
                  <span className="font-mono text-[11px] muted">{it.id}</span>
                  {it.returned && (
                    <span className="chip" style={{ color: "var(--warn)" }}>
                      <Undo2 size={10} /> pernah dikembalikan
                    </span>
                  )}
                  {it.reviewed && !it.returned && (
                    <span className="chip" style={{ color: "var(--ok)" }}>
                      <CheckCircle2 size={10} /> sudah diperiksa
                    </span>
                  )}
                </span>

                <span className="block truncate text-sm">{it.stem}</span>

                <span className="mt-1.5 flex flex-wrap gap-1">
                  {it.signals.map((s) => (
                    <span key={s.code} title={s.why}
                      className="rounded px-1.5 py-0.5 text-[10px]"
                      style={{ background: "var(--bg-sunken)", color: "var(--fg-muted)" }}>
                      {s.label}
                    </span>
                  ))}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      {!items.length && (
        <p className="card p-8 text-center text-sm muted">
          Tidak ada soal yang menunggu tinjauan. Centang «tampilkan yang sudah disetujui» untuk
          memeriksa ulang.
        </p>
      )}
      {total > items.length && (
        <p className="mt-3 text-xs muted">
          Menampilkan {items.length} teratas dari {total}. Selesaikan yang di atas dulu — urutannya
          sudah menempatkan yang paling berisiko lebih awal.
        </p>
      )}

      {open && (
        <ReviewPanel id={open} canApprove={canApprove}
          onClose={() => setOpen(null)}
          onDone={() => { setOpen(null); router.refresh(); }} />
      )}
    </>
  );
}
