import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Minus, X } from "lucide-react";
import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { questionsByIds } from "@/lib/exams/bank";
import { remainingSec } from "@/lib/exams/attempt";
import { gradeAnswer } from "@/lib/exams/grade";
import { getPaket } from "@/lib/practice/paket";
import { jawabanMuridTeks, kunciTeks } from "@/lib/practice/latihan";
import { posisiDari } from "@/lib/practice/posisi";
import { kanvasMurid, urlLihatKanvas } from "@/lib/practice/canvas";
import { RichText, RichInline } from "@/components/exam/RichText";
import { SegarkanOtomatis } from "../SegarkanOtomatis";
import type { ResponseValue } from "@/lib/types";

export const metadata = { title: "Pantau murid" };
export const dynamic = "force-dynamic";

const menit = (d: number) => `${Math.floor(d / 60)}:${String(d % 60).padStart(2, "0")}`;
const lalu = (ms: number) => { const d = Math.round((Date.now() - ms) / 1000); return d < 60 ? `${d} dtk lalu` : `${Math.floor(d / 60)} mnt lalu`; };

/** Pantau satu murid secara langsung: nomor yang sedang dibuka beserta
 *  soalnya, jawaban & kunci tiap nomor, dan kanvas coretnya (Exact Canvas).
 *  Diperbarui tiap 3 detik; jawaban murid terkirim ±1,5 detik setelah diisi. */
export default async function PantauMuridPage({ params }: { params: Promise<{ attemptId: string }> }) {
  await requireAdmin();
  const { attemptId } = await params;
  const db = getDb();
  const a = await db.getAttempt(attemptId);
  if (!a || a.exam !== "LATIHAN") notFound();
  const murid = (await db.listUsers(undefined, 1000)).find((u) => u.id === a.userId);
  const lay = a.formLayout[0];
  const paket = lay?.paketId ? await getPaket(lay.paketId) : null;
  const ids = a.formLayout.flatMap((s) => s.questionIds);
  const bank = await questionsByIds(ids);
  const nomorAsli = new Map((paket?.questionIds ?? []).map((id, i) => [id, i + 1]));
  const resp = (a.responses ?? {}) as Record<string, ResponseValue>;
  const pos = a.status === "in_progress" ? posisiDari(a.id) : null;

  const baris = ids.map((id, i) => {
    const q = bank.get(id);
    const raw = resp[id]?.raw;
    const ada = raw !== undefined && raw !== null && raw !== "";
    const benar = q && ada ? gradeAnswer(q, raw).correct : false;
    return { id, q, no: nomorAsli.get(id) ?? i + 1, ada, benar, jawab: q && ada ? jawabanMuridTeks(q, raw) : "", kunci: q ? kunciTeks(q) : "" };
  });
  const sekarang = baris.find((b) => b.id === pos?.questionId) ?? null;
  const dijawab = baris.filter((b) => b.ada).length, nBenar = baris.filter((b) => b.benar).length;
  const tenggat = a.sectionDeadlines?.latihan;
  const sisa = a.status === "in_progress" && !lay?.tanpaWaktu && tenggat ? remainingSec(tenggat) : null;
  const kanvas = murid ? await kanvasMurid(murid.id, murid.fullName) : null;

  const warna = (b: (typeof baris)[number]) => (!b.ada ? "var(--fg-muted)" : b.benar ? "var(--accent)" : "var(--danger)");

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      {a.status === "in_progress" && <SegarkanOtomatis detik={3} />}
      <Link href="/admin/kelas" className="mb-3 inline-flex items-center gap-1.5 text-sm muted hover:underline"><ArrowLeft size={14} /> Pantau kelas</Link>

      <div className="card mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <div>
          <div className="display text-xl">{murid?.fullName ?? "Murid"}</div>
          <div className="text-xs muted">{a.formTitle}{lay?.perbaikan ? " · perbaikan" : ""}</div>
        </div>
        <span className="chip" style={{ color: a.status === "in_progress" ? "var(--warn)" : undefined }}>
          {a.status === "in_progress" ? "sedang mengerjakan" : "selesai"}
        </span>
        <span>Dijawab <b>{dijawab}/{ids.length}</b></span>
        <span>Benar <b style={{ color: "var(--accent)" }}>{nBenar}</b></span>
        <span>Salah <b style={{ color: "var(--danger)" }}>{dijawab - nBenar}</b></span>
        {sisa !== null && <span className="muted">sisa {menit(sisa)}</span>}
        {a.status === "submitted" && <Link href={`/hasil/${a.id}`} className="ml-auto text-sm underline">Hasil lengkap</Link>}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {baris.map((b) => (
          <a key={b.id} href={`#no-${b.no}`} className="flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold"
            title={!b.ada ? "belum dijawab" : b.benar ? "benar" : "salah"}
            style={{ color: warna(b), borderColor: b.id === pos?.questionId ? "var(--fg)" : warna(b), borderWidth: b.id === pos?.questionId ? 3 : 1,
              background: b.ada ? `color-mix(in srgb, ${warna(b)} 12%, transparent)` : "transparent" }}>
            {b.no}
          </a>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          {a.status === "in_progress" && (
            <section className="card p-4" style={{ borderColor: "var(--warn)" }}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--warn)" }}>
                Sedang dikerjakan {sekarang ? `— nomor ${sekarang.no}` : ""} {pos && <span className="font-normal normal-case muted">· {lalu(pos.at)}</span>}
              </div>
              {sekarang?.q ? <Soal b={sekarang} /> : <p className="text-sm muted">Menunggu murid membuka soal…</p>}
            </section>
          )}
          {baris.map((b) => (
            <section key={b.id} id={`no-${b.no}`} className="card p-4">
              <Soal b={b} />
            </section>
          ))}
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="card overflow-hidden">
            <div className="border-b px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>Kanvas coret murid (langsung)</div>
            {kanvas
              ? <iframe src={urlLihatKanvas(kanvas)} className="block h-[70vh] w-full" style={{ border: 0, background: "#fff" }} title="Kanvas murid" />
              : <p className="p-4 text-sm muted">Exact Canvas belum menyala atau berbagi mati (⌘, → Share on this network).</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Soal({ b }: { b: { no: number; q?: import("@/lib/exams/bank").BankQuestion; ada: boolean; benar: boolean; jawab: string; kunci: string } }) {
  const q = b.q;
  if (!q) return <p className="text-sm muted">Soal no. {b.no} tidak ditemukan di bank.</p>;
  return (
    <div className="text-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold" style={{ background: "var(--fg)", color: "var(--bg)" }}>{b.no}</span>
        {!b.ada ? <span className="chip muted"><Minus size={12} /> belum dijawab</span>
          : b.benar ? <span className="chip" style={{ color: "var(--accent)" }}><Check size={12} /> benar</span>
          : <span className="chip" style={{ color: "var(--danger)" }}><X size={12} /> salah</span>}
      </div>
      {q.stimulus && "content" in q.stimulus && typeof q.stimulus.content === "string" && (
        <details className="mb-2"><summary className="cursor-pointer text-xs muted">Teks bacaan</summary><RichText className="mt-1 text-xs">{q.stimulus.content}</RichText></details>
      )}
      {/* Diagram dikecilkan: di layar guru cukup untuk mengenali soalnya. */}
      <RichText className="mb-2 [&_.ws-diagram]:max-w-[260px] [&_svg]:max-h-[220px] [&_svg]:w-auto">{q.stem}</RichText>
      {q.choices && q.choices.length > 0 && (
        <ul className="mb-2 grid gap-1">
          {q.choices.map((c) => (
            <li key={c.id} className="flex gap-2"><b>{c.id}.</b> <RichInline>{c.text}</RichInline></li>
          ))}
        </ul>
      )}
      <div className="grid gap-1 rounded-lg px-3 py-2" style={{ background: "var(--bg-sunken)" }}>
        <div>Jawaban murid: <b style={{ color: !b.ada ? undefined : b.benar ? "var(--accent)" : "var(--danger)" }}>{b.ada ? <RichInline>{b.jawab}</RichInline> : "—"}</b></div>
        <div className="muted">Kunci: <RichInline>{b.kunci || "—"}</RichInline></div>
      </div>
    </div>
  );
}
