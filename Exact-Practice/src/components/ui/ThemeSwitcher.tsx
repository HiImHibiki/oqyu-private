"use client";
import { Check, Palette } from "lucide-react";
import { THEMES, type ThemeGroup } from "@/lib/themes";
import { useTheme } from "./ThemeProvider";
import { useI18n } from "./I18nProvider";
import { Dropdown } from "./Dropdown";

const ORDER: ThemeGroup[] = ["Netral", "Maskulin", "Feminin", "Aksesibilitas"];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  return (
    <Dropdown
      label={t("nav.theme")}
      width={288}
      trigger={
        <>
          <Palette size={16} />
          {!compact && <span>{t("nav.theme")}</span>}
        </>
      }
    >
      {(close) =>
        ORDER.map((g) => (
          <div key={g} className="mb-1">
            <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider muted">{g}</div>
            {THEMES.filter((x) => x.group === g).map((x) => (
              <button
                key={x.id}
                role="menuitemradio"
                aria-checked={theme === x.id}
                onClick={() => { setTheme(x.id); close(); }}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-[var(--bg-sunken)]"
              >
                <span className="flex shrink-0 overflow-hidden rounded-md ring-1 ring-[var(--border)]">
                  {x.swatch.map((c, i) => (
                    <span key={i} style={{ background: c, width: 14, height: 22 }} />
                  ))}
                </span>
                <span className="flex-1 truncate">{x.name}</span>
                {theme === x.id && <Check size={14} className="shrink-0" />}
              </button>
            ))}
          </div>
        ))
      }
    </Dropdown>
  );
}
