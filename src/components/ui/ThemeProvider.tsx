"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME, THEMES } from "@/lib/themes";

type Ctx = { theme: string; setTheme: (id: string) => void };
const ThemeCtx = createContext<Ctx>({ theme: DEFAULT_THEME, setTheme: () => {} });
export const useTheme = () => useContext(ThemeCtx);

const KEY = "exact.theme";

export function ThemeProvider({ children, initial }: { children: React.ReactNode; initial?: string }) {
  const [theme, setThemeState] = useState(initial ?? DEFAULT_THEME);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    const id = saved && THEMES.some((t) => t.id === saved) ? saved : (initial ?? DEFAULT_THEME);
    setThemeState(id);
    document.documentElement.dataset.theme = id;
  }, [initial]);

  const setTheme = useCallback((id: string) => {
    setThemeState(id);
    document.documentElement.dataset.theme = id;
    try { localStorage.setItem(KEY, id); } catch {}
    // sinkron ke profil (best-effort, tidak memblokir UI)
    fetch("/api/profile/theme", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme_id: id }),
    }).catch(() => {});
  }, []);

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}
