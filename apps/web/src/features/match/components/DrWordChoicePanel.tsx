"use client";

import type { DrPalette } from "@/features/lobby/design/tokens";
import { DR, chunk } from "@/features/lobby/design/tokens";

export type DrWordChoicePanelProps = {
  palette: DrPalette;
  accentHex: string;
  words: readonly [string, string, string] | null;
  isLoading: boolean;
  errorMessage: string | null;
  onPick: (index: 0 | 1 | 2) => void;
  disabled?: boolean;
};

export function DrWordChoicePanel({
  palette,
  accentHex,
  words,
  isLoading,
  errorMessage,
  onPick,
  disabled,
}: DrWordChoicePanelProps) {
  const ck = (x = 4, y = 5) => chunk(x, y, palette.line);

  return (
    <section
      aria-label="Choose a word to draw"
      style={{
        background: palette.panel,
        border: `3px solid ${palette.line}`,
        borderRadius: DR.radius.xxl,
        boxShadow: ck(5, 6),
        padding: "14px 18px 18px",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: DR.font.display,
            fontSize: 18,
            fontWeight: 900,
            color: palette.ink,
          }}
        >
          Pick a word to draw
        </h2>
      </div>

      {isLoading && !words ? (
        <p style={{ margin: 0, fontSize: 14, color: palette.inkDim }}>
          Loading word choices…
        </p>
      ) : null}

      {words ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          {words.map((label, index) => (
            <button
              key={`${String(index)}-${label}`}
              type="button"
              disabled={disabled}
              onClick={() => onPick(index as 0 | 1 | 2)}
              style={{
                border: `2.5px solid ${palette.line}`,
                borderRadius: DR.radius.lg,
                background: palette.panel2,
                color: accentHex,
                padding: "12px 14px",
                fontFamily: DR.font.body,
                fontWeight: 800,
                fontSize: 15,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.55 : 1,
                boxShadow: disabled ? "none" : ck(3, 4),
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {errorMessage ? (
        <p style={{ margin: "12px 0 0", fontSize: 14, color: DR.semantic.danger }} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
