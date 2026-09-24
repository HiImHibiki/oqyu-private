export type ThemeGroup = "Netral" | "Maskulin" | "Feminin" | "Aksesibilitas";

export interface Theme {
  id: string;
  name: string;
  group: ThemeGroup;
  mode: "light" | "dark";
  /** warna kecil untuk swatch di picker */
  swatch: [string, string, string];
  tokens: Record<string, string>;
}

/* Token yang dipakai seluruh UI:
 *  --bg  --bg-elev  --bg-sunken  --fg  --fg-muted  --border  --border-strong
 *  --accent  --accent-fg  --accent-soft  --ok  --warn  --danger  --ring
 *  --serif (font display)  --shadow */

const SANS = `"Inter", "Noto Sans SC", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
const SERIF = `"Fraunces", "Iowan Old Style", Georgia, "Times New Roman", serif`;

export const THEMES: Theme[] = [
  {
    id: "midnight",
    name: "Midnight Ink",
    group: "Netral",
    mode: "dark",
    swatch: ["#0b1020", "#1b2540", "#7aa2ff"],
    tokens: {
      "--bg": "#0b1020", "--bg-elev": "#131a2e", "--bg-sunken": "#080c18",
      "--fg": "#e8ecf7", "--fg-muted": "#95a1bd", "--border": "#222c48", "--border-strong": "#32406b",
      "--accent": "#7aa2ff", "--accent-fg": "#08122c", "--accent-soft": "#17224a",
      "--ok": "#54d6a0", "--warn": "#f2c14e", "--danger": "#ff7a7a", "--ring": "#7aa2ff",
      "--serif": SERIF, "--sans": SANS,
      "--shadow": "0 18px 50px -22px rgba(0,0,0,.85)",
    },
  },
  {
    id: "porcelain",
    name: "Porcelain",
    group: "Netral",
    mode: "light",
    swatch: ["#fbfaf8", "#e9e5df", "#1f6f5c"],
    tokens: {
      "--bg": "#fbfaf8", "--bg-elev": "#ffffff", "--bg-sunken": "#f2efe9",
      "--fg": "#1a1c1a", "--fg-muted": "#6b6f6b", "--border": "#e4e0d8", "--border-strong": "#cdc7bb",
      "--accent": "#1f6f5c", "--accent-fg": "#ffffff", "--accent-soft": "#e2efea",
      "--ok": "#1f8a5f", "--warn": "#b8860b", "--danger": "#c0392b", "--ring": "#1f6f5c",
      "--serif": SERIF, "--sans": SANS,
      "--shadow": "0 14px 40px -24px rgba(26,28,26,.35)",
    },
  },
  {
    id: "cobalt",
    name: "Cobalt Steel",
    group: "Maskulin",
    mode: "light",
    swatch: ["#f5f7fb", "#dce3ef", "#12386e"],
    tokens: {
      "--bg": "#f5f7fb", "--bg-elev": "#ffffff", "--bg-sunken": "#e8edf6",
      "--fg": "#101828", "--fg-muted": "#5d6b85", "--border": "#dbe2ee", "--border-strong": "#b9c5d9",
      "--accent": "#12386e", "--accent-fg": "#ffffff", "--accent-soft": "#dde7f6",
      "--ok": "#1f7a4d", "--warn": "#a86a00", "--danger": "#b42318", "--ring": "#2f6fc0",
      "--serif": SERIF, "--sans": SANS,
      "--shadow": "0 14px 40px -24px rgba(16,24,40,.35)",
    },
  },
  {
    id: "graphite",
    name: "Graphite Amber",
    group: "Maskulin",
    mode: "dark",
    swatch: ["#141414", "#242424", "#e0993e"],
    tokens: {
      "--bg": "#141414", "--bg-elev": "#1e1e1e", "--bg-sunken": "#0d0d0d",
      "--fg": "#f0ece5", "--fg-muted": "#9c968c", "--border": "#2c2c2c", "--border-strong": "#3f3f3f",
      "--accent": "#e0993e", "--accent-fg": "#1a1204", "--accent-soft": "#2e2415",
      "--ok": "#63c98a", "--warn": "#e0993e", "--danger": "#e8705f", "--ring": "#e0993e",
      "--serif": SERIF, "--sans": SANS,
      "--shadow": "0 18px 50px -22px rgba(0,0,0,.9)",
    },
  },
  {
    id: "rosewood",
    name: "Rosewood",
    group: "Feminin",
    mode: "light",
    swatch: ["#fdf7f6", "#f3dedd", "#9b3b52"],
    tokens: {
      "--bg": "#fdf7f6", "--bg-elev": "#ffffff", "--bg-sunken": "#f8eceb",
      "--fg": "#2a1a1e", "--fg-muted": "#7b6167", "--border": "#f0dedd", "--border-strong": "#dcbdbd",
      "--accent": "#9b3b52", "--accent-fg": "#ffffff", "--accent-soft": "#fae3e7",
      "--ok": "#2f8a6a", "--warn": "#b57d1f", "--danger": "#c0392b", "--ring": "#c05f76",
      "--serif": SERIF, "--sans": SANS,
      "--shadow": "0 14px 40px -24px rgba(42,26,30,.3)",
    },
  },
  {
    id: "lavender",
    name: "Lavender Mist",
    group: "Feminin",
    mode: "light",
    swatch: ["#faf8fd", "#e6dff5", "#6b4bab"],
    tokens: {
      "--bg": "#faf8fd", "--bg-elev": "#ffffff", "--bg-sunken": "#f2eefa",
      "--fg": "#1f1a2b", "--fg-muted": "#6c6484", "--border": "#e8e2f4", "--border-strong": "#cfc4e6",
      "--accent": "#6b4bab", "--accent-fg": "#ffffff", "--accent-soft": "#ece5fa",
      "--ok": "#2f8a6a", "--warn": "#a8790f", "--danger": "#c0392b", "--ring": "#8b6cd0",
      "--serif": SERIF, "--sans": SANS,
      "--shadow": "0 14px 40px -24px rgba(31,26,43,.3)",
    },
  },
  {
    id: "plumnight",
    name: "Plum Night",
    group: "Feminin",
    mode: "dark",
    swatch: ["#181022", "#2a1b3a", "#e0a3c8"],
    tokens: {
      "--bg": "#181022", "--bg-elev": "#221733", "--bg-sunken": "#110b19",
      "--fg": "#f2e9f5", "--fg-muted": "#a596b3", "--border": "#31234a", "--border-strong": "#452f63",
      "--accent": "#e0a3c8", "--accent-fg": "#2a0f22", "--accent-soft": "#33203f",
      "--ok": "#63c98a", "--warn": "#e8c06a", "--danger": "#f08585", "--ring": "#e0a3c8",
      "--serif": SERIF, "--sans": SANS,
      "--shadow": "0 18px 50px -22px rgba(0,0,0,.85)",
    },
  },
  {
    id: "sepia",
    name: "Focus Sepia",
    group: "Aksesibilitas",
    mode: "light",
    swatch: ["#f6efe2", "#e6d9c0", "#5b4636"],
    tokens: {
      "--bg": "#f6efe2", "--bg-elev": "#fdf9f0", "--bg-sunken": "#ece0ca",
      "--fg": "#2b2118", "--fg-muted": "#6e6152", "--border": "#e0d3ba", "--border-strong": "#c7b494",
      "--accent": "#5b4636", "--accent-fg": "#fdf9f0", "--accent-soft": "#eadfc8",
      "--ok": "#3f7d4f", "--warn": "#9a6b12", "--danger": "#a83a2b", "--ring": "#8a6d4f",
      "--serif": SERIF, "--sans": SANS,
      "--shadow": "0 14px 40px -26px rgba(43,33,24,.4)",
    },
  },
  {
    id: "contrast",
    name: "High Contrast",
    group: "Aksesibilitas",
    mode: "dark",
    swatch: ["#000000", "#111111", "#ffe600"],
    tokens: {
      "--bg": "#000000", "--bg-elev": "#0d0d0d", "--bg-sunken": "#000000",
      "--fg": "#ffffff", "--fg-muted": "#d0d0d0", "--border": "#5a5a5a", "--border-strong": "#8a8a8a",
      "--accent": "#ffe600", "--accent-fg": "#000000", "--accent-soft": "#2b2600",
      "--ok": "#39ff88", "--warn": "#ffe600", "--danger": "#ff5c5c", "--ring": "#ffe600",
      "--serif": SANS, "--sans": SANS,
      "--shadow": "none",
    },
  },
];

export const DEFAULT_THEME = "porcelain";
export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[1];

/** CSS yang di-inject di <head> — satu blok [data-theme="x"] per tema. */
export function themeCss(): string {
  return THEMES.map((t) => {
    const decls = Object.entries(t.tokens).map(([k, v]) => `${k}:${v}`).join(";");
    return `[data-theme="${t.id}"]{${decls};color-scheme:${t.mode}}`;
  }).join("\n");
}
