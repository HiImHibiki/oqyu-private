import { AlertTriangle } from "lucide-react";
import { SiteHeader } from "@/components/ui/SiteHeader";
import type { LegalDoc } from "@/lib/legal";

/* Naskah hukum hanya memakai **tebal**; sengaja TIDAK memakai RichText karena
 * komponen itu menyeret KaTeX dan seluruh mesin markdown ujian ke halaman yang
 * tidak pernah memuat satu pun rumus. */
function bold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>,
  );
}

/** Satu tata letak untuk kebijakan privasi dan ketentuan layanan. */
export function LegalDocView({ doc, authed }: { doc: LegalDoc; authed?: boolean }) {
  return (
    <>
      <SiteHeader authed={authed} />
      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="display mb-2 text-3xl">{doc.title}</h1>
        <p className="mb-6 text-xs muted">Version {doc.updated}</p>
        <p className="mb-8 text-[1.02rem] leading-relaxed">{doc.intro}</p>

        {doc.sections.map((s) => (
          <section key={s.heading} className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">{s.heading}</h2>
            <div className="space-y-3 text-sm leading-relaxed">
              {s.body.map((p, i) => <p key={i}>{bold(p)}</p>)}
            </div>
          </section>
        ))}

        <div className="card flex gap-3 p-4" style={{ borderColor: "var(--warn)" }}>
          <AlertTriangle size={18} className="mt-0.5 shrink-0" style={{ color: "var(--warn)" }} />
          <p className="text-xs leading-relaxed muted">{doc.disclaimer}</p>
        </div>
      </main>
    </>
  );
}
