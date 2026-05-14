// Doodle Royale design tokens — light + dark palettes from ui_kits/game/tokens.js

export type DrPalette = {
  bg: string;
  panel: string;
  panel2: string;
  ink: string;
  inkDim: string;
  line: string;
  soft: string;
};

export const DR_PALETTE_LIGHT: DrPalette = {
  bg: "#fff7e8",
  panel: "#fffdf6",
  panel2: "#fdf3d8",
  ink: "#1a1714",
  inkDim: "rgba(26,23,20,.55)",
  line: "#1a1714",
  soft: "#f6ead0",
};

export const DR_PALETTE_DARK: DrPalette = {
  bg: "#181613",
  panel: "#221f1b",
  panel2: "#2a2622",
  ink: "#f5efe6",
  inkDim: "rgba(245,239,230,.55)",
  line: "#0a0908",
  soft: "#332e28",
};

export function getDrPalette(isDark: boolean): DrPalette {
  return isDark ? DR_PALETTE_DARK : DR_PALETTE_LIGHT;
}

export const DR = {
  font: {
    // CSS vars injected by next/font/google in layout.tsx
    display: "var(--font-bricolage), system-ui, sans-serif",
    body: "var(--font-bricolage), system-ui, sans-serif",
    mono: "var(--font-dm-mono), monospace",
  },
  /** Default warm light shell (landing, lobby) — use `getDrPalette` for match theme toggle. */
  colors: DR_PALETTE_LIGHT,
  accent: {
    tomato: "#ff5a3c",
    canary: "#ffd23f",
    mint: "#3ddc97",
    cornflower: "#5b8def",
    lavender: "#c084fc",
    rose: "#ff7ab6",
  },
  semantic: {
    success: "#2a8f4a",
    warning: "#d97a3a",
    danger: "#ff3c3c",
    timerWarn: "#ffd23f",
  },
  radius: {
    xs: 6, sm: 10, md: 12, lg: 14, xl: 18, xxl: 22, pill: 99,
  },
} as const;

// chunk(x, y) — flat chunky drop shadow used throughout the design system
export function chunk(x = 4, y = 5, line?: string): string {
  return `${x}px ${y}px 0 0 ${line ?? "#1a1714"}`;
}

// Avatar face colors keyed by preset ID — matches the 6 design-system accent colors
export const AVATAR_PRESET_COLORS: Record<string, string> = {
  "preset-1": "#ff5a3c", // Tomato
  "preset-2": "#ffd23f", // Canary
  "preset-3": "#3ddc97", // Mint
  "preset-4": "#5b8def", // Cornflower
  "preset-5": "#c084fc", // Lavender
  "preset-6": "#ff7ab6", // Rose
};

// Word pack options for lobby settings UI
export const WORD_PACKS = [
  { id: "classic", label: "Classic", count: 1247 },
  { id: "cryptids", label: "Cryptids", count: 312 },
  { id: "foods", label: "Snack Bar", count: 408 },
  { id: "movies", label: "Movie Night", count: 561 },
  { id: "custom", label: "Custom", count: 0 },
] as const;

export type WordPackId = (typeof WORD_PACKS)[number]["id"];
