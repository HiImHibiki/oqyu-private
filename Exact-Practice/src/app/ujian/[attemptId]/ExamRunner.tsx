"use client";
import { useRouter } from "next/navigation";
import { ExamPlayer, type PlayerSection, type SectionClock } from "@/components/exam/ExamPlayer";
import type { ExamCode, ResponseValue } from "@/lib/types";

export function ExamRunner(props: {
  attemptId: string;
  examCode: ExamCode;
  examName: string;
  studentName: string;
  isDemo: boolean;
  sections: PlayerSection[];
  initial: { sectionIndex: number; remainingSec: number; started: boolean };
  savedResponses?: Record<string, ResponseValue>;
  timeMultiplier?: number;
}) {
  const router = useRouter();
  const base = `/api/attempts/${props.attemptId}`;

  const post = async (path: string, body: unknown) => {
    const r = await fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) };
  };

  return (
    <ExamPlayer
      {...props}
      onStartSection={async (index): Promise<SectionClock | null> => {
        const res = await post("/section", { index });
        if (!res.ok) return null;
        return {
          sectionIndex: res.json.sectionIndex,
          remainingSec: res.json.remainingSec,
          questions: res.json.questions,   // soal section ini baru tiba sekarang
        };
      }}
      onSync={async () => {
        const r = await fetch(base + "/state", { cache: "no-store" });
        if (!r.ok) return null;
        const j = await r.json();
        if (j.status === "submitted") { router.push(`/hasil/${props.attemptId}`); return null; }
        return { sectionIndex: j.sectionIndex, remainingSec: j.remainingSec, status: j.status };
      }}
      onSave={async ({ sectionCode, responses }) => {
        const res = await post("/save", { sectionCode, responses });
        if (res.status === 409 && res.json?.expired) return { expired: true };
        return {};
      }}
      onFlush={({ sectionCode, responses }) => {
        // `keepalive` membuat permintaan ini tetap dikirim setelah halaman
        // ditutup. Batas 64 KB dari spesifikasi cukup: yang dikirim hanya
        // jawaban satu section.
        void fetch(base + "/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sectionCode, responses }),
          keepalive: true,
        }).catch(() => {});
      }}
      onProctorEvent={(type, detail) => {
        // jalur terpisah dari /save: gagal mencatat event tidak boleh
        // sampai mengganggu penyimpanan jawaban
        void fetch(base + "/proctor", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type, detail }),
          keepalive: true,
        }).catch(() => {});
      }}
      onSubmit={async ({ attemptId, responses, integrity }) => {
        await fetch(`/api/attempts/${attemptId}/submit`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ responses: responses as Record<string, ResponseValue>, integrity }),
        });
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        router.push(`/hasil/${attemptId}`);
      }}
    />
  );
}
