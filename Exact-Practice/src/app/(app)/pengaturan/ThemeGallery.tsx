"use client";
import { Check } from "lucide-react";
import { THEMES, type ThemeGroup } from "@/lib/themes";
import { useTheme } from "@/components/ui/ThemeProvider";

const GROUPS: ThemeGroup[] = ["Netral", "Maskulin", "Feminin", "Aksesibilitas"];

export function ThemeGallery() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="space-y-6">
      {GROUPS.map((g) => (
        <div key={g}>
          <p className="mb-2 text-xs font-medium muted">{g}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEMES.filter((t) => t.group === g).map((t) => (
              <button key={t.id} onClick={() => setTheme(t.id)}
                className="card overflow-hidden p-0 text-left"
                style={{ borderColor: theme === t.id ? "var(--accent)" : "var(--border)", borderWidth: theme === t.id ? 1.5 : 1 }}>
                <div className="flex h-16">
                  {t.swatch.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
                </div>
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="flex-1 text-sm font-medium">{t.name}</span>
                  <span className="text-[10px] muted">{t.mode === "dark" ? "gelap" : "terang"}</span>
                  {theme === t.id && <Check size={14} style={{ color: "var(--accent)" }} />}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
