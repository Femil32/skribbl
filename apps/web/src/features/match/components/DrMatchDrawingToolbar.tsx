"use client";

import type { RoomPhase } from "@skribbl/shared";
import { normalizeClientStrokeColor, serializeClientCommand } from "@skribbl/shared";
import { useEffect, useRef, useState } from "react";

import type { DrawingActiveTool } from "@/features/game/canvas/DrawingCanvas";
import { DR, chunk, type DrPalette } from "@/features/lobby/design/tokens";

/** Aligned with ScreenGame.jsx reference kit */
const DR_PALETTE_SWATCHES = [
  "#1a1714",
  "#ffffff",
  "#ff5a3c",
  "#ffd23f",
  "#3ddc97",
  "#5b8def",
  "#c084fc",
  "#ff7ab6",
  "#fb923c",
  "#34d399",
  "#a78bfa",
  "#f87171",
  "#fbbf24",
  "#60a5fa",
  "#4ade80",
  "#e879f9",
] as const;

const DR_BRUSH_SIZES = [3, 6, 12, 22] as const;

function isDrBrushSize(px: number): px is (typeof DR_BRUSH_SIZES)[number] {
  return (DR_BRUSH_SIZES as readonly number[]).includes(px);
}

export type DrMatchDrawingToolbarProps = {
  palette: DrPalette;
  accentHex: string;
  phase: RoomPhase;
  isDrawer: boolean;
  roomId: string;
  sendJsonLine: (raw: string) => void;
  brushColor: string;
  brushWidthPx: number;
  activeTool: DrawingActiveTool;
  onActiveToolChange: (tool: DrawingActiveTool) => void;
  onBrushColorChange: (hexNormalized: `#${string}`) => void;
  onBrushWidthChange: (px: number) => void;
};

function pickNearestBrushSize(px: number): number {
  let best: number = DR_BRUSH_SIZES[0];
  let bestD = Math.abs(px - best);
  for (const s of DR_BRUSH_SIZES) {
    const d = Math.abs(px - s);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/**
 * Chunky drawing toolbar — ScreenGame.jsx artist controls (brush / eraser / fill / sizes / swatches / clear).
 */
export function DrMatchDrawingToolbar({
  palette,
  accentHex,
  phase,
  isDrawer,
  roomId,
  sendJsonLine,
  brushColor,
  brushWidthPx,
  activeTool,
  onActiveToolChange,
  onBrushColorChange,
  onBrushWidthChange,
}: DrMatchDrawingToolbarProps) {
  const ck = (x = 4, y = 5) => chunk(x, y, palette.line);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const clearTriggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clearModalOpen) return;
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setClearModalOpen(false);
        clearTriggerRef.current?.focus();
        return;
      }
      if (e.key === "Tab" && focusable.length > 0) {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    modal.addEventListener("keydown", onKeyDown);
    return () => modal.removeEventListener("keydown", onKeyDown);
  }, [clearModalOpen]);

  if (phase !== "drawing" || !isDrawer) return null;

  const currentColor = normalizeClientStrokeColor(brushColor);

  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      data-testid="drawing-toolbar"
      style={{
        background: palette.panel,
        border: `3px solid ${palette.line}`,
        borderRadius: 16,
        boxShadow: ck(5, 6),
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        {(
          [
            { id: "brush" as const, icon: "✏️", label: "Brush" },
            { id: "eraser" as const, icon: "🧹", label: "Eraser" },
            { id: "fill" as const, icon: "🪣", label: "Fill" },
          ] as const
        ).map((t2) => {
          const pressed = activeTool === t2.id;
          return (
            <button
              key={t2.id}
              type="button"
              data-testid={`drawing-tool-${t2.id}`}
              aria-pressed={pressed}
              onClick={() => onActiveToolChange(t2.id)}
              style={{
                border: `2.5px solid ${palette.line}`,
                borderRadius: 10,
                background: pressed ? palette.ink : palette.panel2,
                color: pressed ? palette.panel : palette.ink,
                padding: "6px 10px",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: pressed ? ck(3, 4) : "none",
                transform: pressed ? "translate(-1px,-1px)" : "none",
              }}
            >
              {t2.icon} {t2.label}
            </button>
          );
        })}
      </div>

      <div style={{ width: 1, height: 32, background: palette.line, opacity: 0.2 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: palette.inkDim }}>SIZE</span>
        {DR_BRUSH_SIZES.map((s) => {
          const showRing =
            brushWidthPx === s ||
            (!isDrBrushSize(brushWidthPx) && pickNearestBrushSize(brushWidthPx) === s);
          return (
            <button
              key={s}
              type="button"
              aria-label={`Brush size ${String(s)} pixels`}
              aria-pressed={showRing}
              onClick={() => onBrushWidthChange(s)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 99,
                border: `2px solid ${palette.line}`,
                background: showRing ? palette.ink : palette.panel2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <div
                style={{
                  width: Math.max(4, s * 0.8),
                  height: Math.max(4, s * 0.8),
                  borderRadius: 99,
                  background: showRing ? palette.panel : palette.ink,
                }}
              />
            </button>
          );
        })}
      </div>

      <div style={{ width: 1, height: 32, background: palette.line, opacity: 0.2 }} />

      <div
        style={{
          display: "flex",
          gap: 5,
          flexWrap: "wrap",
          maxWidth: 320,
        }}
      >
        {DR_PALETTE_SWATCHES.map((c) => {
          const normalized = normalizeClientStrokeColor(c);
          const usesStrokeColor = activeTool === "brush" || activeTool === "fill";
          const pressed = currentColor === normalized && usesStrokeColor;
          return (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => {
                onBrushColorChange(normalized as `#${string}`);
              }}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                border: `2px solid ${palette.line}`,
                background: c,
                cursor: "pointer",
                padding: 0,
                boxShadow: pressed ? `0 0 0 2.5px ${accentHex}` : "none",
                transform: pressed ? "scale(1.12)" : "none",
                transition: "transform .12s",
              }}
            />
          );
        })}
      </div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button
          ref={clearTriggerRef}
          type="button"
          data-testid="drawing-tool-clear"
          aria-label="Clear canvas"
          onClick={() => setClearModalOpen(true)}
          style={{
            border: `2.5px solid ${palette.line}`,
            borderRadius: 10,
            padding: "6px 12px",
            background: DR.semantic.danger,
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 13,
            color: "#1a1714",
            boxShadow: ck(3, 4),
          }}
        >
          ✕ Clear
        </button>
      </div>

      {clearModalOpen ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,.35)",
            padding: 16,
          }}
          onClick={() => {
            setClearModalOpen(false);
            clearTriggerRef.current?.focus();
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dr-clear-canvas-title"
            style={{
              maxWidth: 400,
              width: "100%",
              background: palette.panel,
              border: `3px solid ${palette.line}`,
              borderRadius: 16,
              padding: 20,
              boxShadow: ck(6, 8),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="dr-clear-canvas-title"
              style={{ margin: "0 0 8px", fontFamily: DR.font.display, fontSize: 20 }}
            >
              Clear the canvas?
            </h3>
            <p style={{ margin: "0 0 18px", fontSize: 14, color: palette.inkDim, lineHeight: 1.5 }}>
              This removes the whole drawing for everyone in the room.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setClearModalOpen(false);
                  clearTriggerRef.current?.focus();
                }}
                style={{
                  border: `2px solid ${palette.line}`,
                  borderRadius: 10,
                  padding: "8px 14px",
                  background: palette.panel2,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="drawing-clear-confirm"
                onClick={() => {
                  sendJsonLine(
                    serializeClientCommand({
                      type: "drawingCanvasClear",
                      roomId,
                    }),
                  );
                  setClearModalOpen(false);
                }}
                style={{
                  border: `2px solid ${palette.line}`,
                  borderRadius: 10,
                  padding: "8px 14px",
                  background: DR.semantic.danger,
                  fontWeight: 800,
                  cursor: "pointer",
                  color: "#1a1714",
                }}
              >
                Clear for everyone
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
