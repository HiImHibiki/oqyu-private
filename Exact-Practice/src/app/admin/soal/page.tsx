import { requireAdmin } from "@/lib/adminGuard";
import { bankSummary, searchBank, type BankStatus } from "@/lib/exams/bank";
import { getBlueprint } from "@/lib/exams/blueprints";
import { PageHead } from "@/components/ui/AppShell";
import { QuestionBank } from "./QuestionBank";
import { GeneratePanel } from "./GeneratePanel";
import { sectionOptions } from "@/lib/ai/promptRegistry";
import { providerAvailability } from "@/lib/ai/providers";
import type { ExamCode } from "@/lib/types";

export const metadata = { title: "Bank soal" };

export default async function SoalPage({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string; status?: string; q?: string }>;
}) {
  const me = await requireAdmin();
  const sp = await searchParams;

  const exam = (sp.exam || undefined) as ExamCode | undefined;
  const status = (sp.status || undefined) as BankStatus | undefined;

  const [summary, rows] = await Promise.all([
    bankSummary(),
    searchBank({ exam, statuses: status ? [status] : undefined, q: sp.q }),
  ]);

  // hitung berapa soal yang dibutuhkan tiap ujian, dari blueprint
  const targets = summary.map((s) => {
    const bp = getBlueprint(s.exam);
    const needed = bp?.sections.reduce((a, x) => a + x.questionCount, 0) ?? 0;
    return { ...s, needed };
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead
        title="Bank soal"
        subtitle="Impor hasil AI, tinjau, lalu setujui. Klik soal mana pun untuk melihat kunci jawaban dan pembahasannya. Hanya soal berstatus approved yang dipakai menyusun paket."
      />
      <GeneratePanel
        sections={sectionOptions()}
        providers={providerAvailability().map((p) => ({
          id: p.id, name: p.name, envVar: p.envVar, configured: p.configured,
          supportsPdf: p.supportsPdf, docsUrl: p.docsUrl, models: p.models,
        }))}
        canApprove={me.role === "admin"}
      />
      <QuestionBank
        summary={targets}
        rows={JSON.parse(JSON.stringify(rows.slice(0, 300).map((q) => ({
          id: q.id, exam: q.exam, section: q.section, domain: q.domain, skill: q.skill,
          difficulty: q.difficulty, type: q.type, status: q.status, source: q.source,
          stem: q.stem.slice(0, 160), review: q.review,
        }))))}
        total={rows.length}
        filter={{ exam: sp.exam ?? "", status: sp.status ?? "", q: sp.q ?? "" }}
        canApprove={me.role === "admin"}
      />
    </div>
  );
}
