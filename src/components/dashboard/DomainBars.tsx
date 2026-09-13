"use client";

export function DomainBars({ data }: { data: { domain: string; pct: number; total: number }[] }) {
  if (!data.length) return <p className="text-sm muted">Belum ada data domain.</p>;
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.domain}>
          <div className="mb-1 flex items-baseline gap-2 text-xs">
            <span className="flex-1 truncate">{d.domain}</span>
            <span className="font-semibold tabular-nums">{d.pct}%</span>
            <span className="muted">({d.total} soal)</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--bg-sunken)" }}>
            <div className="h-full rounded-full"
              style={{
                width: `${d.pct}%`,
                background: d.pct < 50 ? "var(--danger)" : d.pct < 75 ? "var(--warn)" : "var(--ok)",
              }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
