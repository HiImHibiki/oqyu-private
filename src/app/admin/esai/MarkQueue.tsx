"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, PenLine } from "lucide-react";
import { RichText } from "@/components/exam/RichText";

export interface MarkTask {
  attemptId: string;
  questionId: string;
  student: string;
  exam: string;
  submittedAt: string;
  stem: string;
  points: number;
  rubric: { criterion: string; points: number; descriptor: string }[];
  exemplar?: string;
  answer: string;
}

export function MarkQueue({ tasks }: { tasks: MarkTask[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (!tasks.length) {
    return (
      <div className="card p-8 text-center">
        <Check size={20} className="mx-auto mb-2" style={{ color: "var(--ok)" }} />
        <p className="text-sm">Tidak ada jawaban esai yang menunggu.</p>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm muted">{tasks.length} jawaban menunggu penilaian.</p>
      <ul className="space-y-3">
        {tasks.map((t) => {
          const key = `${t.attemptId}:${t.questionId}`;
          return (
            <li key={key} className="card overflow-hidden">
              <button
                className="flex w-full items-center gap-3 px-5 py-3 text-left"
                onClick={() => setOpen(open === key ? null : key)}
              >
                <PenLine size={14} className="muted shrink-0" />
                <span className="flex-1 truncate text-sm">
                  <strong>{t.student}</strong>
                  <span className="muted"> · {t.exam} · {t.questionId}</span>
                </span>
                <span className="chip shrink-0 text-xs">{t.points} poin</span>
              </button>
              {open === key && <MarkForm task={t} onDone={() => setOpen(null)} />}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function MarkForm({ task, onDone }: { task: MarkTask; onDone: () => void }) {
  const router = useRouter();
  const [awarded, setAwarded] = useState<number[]>(task.rubric.map(() => 0));
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showExemplar, setShowExemplar] = useState(false);

  const total = awarded.reduce((a, b) => a + b, 0);

  async function save() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/admin/marks", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        attemptId: task.attemptId, questionId: task.questionId, awarded, comment,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Gagal menyimpan nilai"); return; }
    onDone();
    router.refresh();
  }

  return (
    <div className="border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
      <div className="mb-4 text-sm">
        <RichText>{task.stem}</RichText>
      </div>

      <div className="mb-4 rounded-lg p-3 text-sm" style={{ background: "var(--bg-sunken)" }}>
        <div className="mb-1.5 text-xs font-medium muted">Jawaban peserta</div>
        {task.answer.trim()
          ? <p className="whitespace-pre-wrap">{task.answer}</p>
          : <p className="muted italic">Tidak dijawab.</p>}
      </div>

      <div className="mb-3 space-y-2">
        {task.rubric.map((c, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex-1">
              <div className="text-sm font-medium">{c.criterion}</div>
              <div className="mt-0.5 text-xs muted"><RichText>{c.descriptor}</RichText></div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <input
                type="number" min={0} max={c.points} step={0.5}
                className="input !w-16 !py-1 text-right text-sm tabular-nums"
                value={awarded[i]}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(c.points, Number(e.target.value) || 0));
                  setAwarded((a) => a.map((x, j) => (j === i ? v : x)));
                }}
              />
              <span className="text-xs muted">/ {c.points}</span>
            </div>
          </div>
        ))}
      </div>

      {task.exemplar && (
        <div className="mb-3">
          <button className="text-xs muted hover:underline" onClick={() => setShowExemplar((v) => !v)}>
            {showExemplar ? "Sembunyikan" : "Tampilkan"} jawaban teladan
          </button>
          {showExemplar && (
            <div className="mt-2 rounded-lg p-3 text-sm" style={{ background: "var(--bg-sunken)" }}>
              <RichText>{task.exemplar}</RichText>
            </div>
          )}
        </div>
      )}

      <label className="mb-1 block text-xs font-medium muted">
        Umpan balik untuk peserta
      </label>
      <textarea
        className="input mb-1 min-h-20 text-sm"
        placeholder="Apa yang sudah benar, dan apa yang kurang. Inilah yang membuat esai berguna dilatih — angka saja tidak mengajari apa pun."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      {err && <p className="mb-2 text-xs" style={{ color: "var(--danger)" }}>{err}</p>}

      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Simpan nilai
        </button>
        <span className="text-sm tabular-nums">
          <strong>{total}</strong> <span className="muted">/ {task.points} poin</span>
        </span>
      </div>
    </div>
  );
}
