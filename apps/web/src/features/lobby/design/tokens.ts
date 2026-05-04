// Doodle Royale design tokens — light theme only (no dark mode in MVP).
// Ported from claude-design/skribbl/project/ui_kits/game/tokens.js

export const DR = {
  font: {
    // CSS vars injected by next/font/google in layout.tsx
    display: "var(--font-bricolage), system-ui, sans-serif",
    body: "var(--font-bricolage), system-ui, sans-serif",
    mono: "var(--font-dm-mono), monospace",
  },
  colors: {
    bg: "#fff7e8",
    panel: "#fffdf6",
    panel2: "#fdf3d8",
    ink: "#1a1714",
    inkDim: "rgba(26,23,20,.55)",
    line: "#1a1714",
    soft: "#f6ead0",
  },
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
export function chunk(x = 4, y = 5, line = "#1a1714"): string {
  return `${x}px ${y}px 0 0 ${line}`;
}

// Avatar face colors keyed by preset ID (matches avatarPresets in @skribbl/shared)
export const AVATAR_PRESET_COLORS: Record<string, string> = {
  "preset-1": "#22d3ee", // Cyan
  "preset-2": "#c084fc", // Violet
  "preset-3": "#fbbf24", // Amber
  "preset-4": "#fb7185", // Rose
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
