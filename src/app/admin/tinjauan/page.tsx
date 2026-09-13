import { requireAdmin } from "@/lib/adminGuard";
import { searchBank } from "@/lib/exams/bank";
import { buildQueue } from "@/lib/exams/reviewRisk";
import { PageHead } from "@/components/ui/AppShell";
import { ReviewQueue } from "./ReviewQueue";
import type { ExamCode } from "@/lib/types";

export const metadata = { title: "Antrean tinjauan" };

export default async function TinjauanPage({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string; all?: string }>;
}) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const exam = (sp.exam || undefined) as ExamCode | undefined;
  const includeReviewed = sp.all === "1";

  const bank = await searchBank({ exam });
  const queue = buildQueue(bank, { includeReviewed });

  const active = bank.filter((q) => q.status !== "retired");
  const done = active.filter((q) => q.review?.verdict === "correct").length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead
        title="Antrean tinjauan"
        subtitle="Soal yang belum diperiksa manusia, diurutkan menurut peluang kekeliruan lolos tanpa disadari. Mulai dari atas."
      />
      <ReviewQueue
        items={JSON.parse(JSON.stringify(queue.slice(0, 200)))}
        total={queue.length}
        done={done}
        active={active.length}
        exam={sp.exam ?? ""}
        includeReviewed={includeReviewed}
        canApprove={me.role === "admin"}
      />
    </div>
  );
}
