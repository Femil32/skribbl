"use client";

import type { RoomPhase } from "@skribbl/shared";
import { normalizeClientStrokeColor } from "@skribbl/shared";

export const DRAWING_COLOR_PRESETS = [
  { hex: "#0f172a", label: "Slate" },
  { hex: "#ef4444", label: "Red" },
  { hex: "#22c55e", label: "Green" },
  { hex: "#3b82f6", label: "Blue" },
  { hex: "#eab308", label: "Yellow" },
  { hex: "#a855f7", label: "Violet" },
  { hex: "#f97316", label: "Orange" },
  { hex: "#ffffff", label: "White" },
] as const;

export const DRAWING_BRUSH_WIDTH_PRESETS = [2, 4, 8, 12, 16, 24] as const;

export type DrawingToolbarProps = {
  phase: RoomPhase;
  /** True when local player may paint (authority matches server drawer id). */
  isDrawer: boolean;
  brushColor: string;
  brushWidthPx: number;
  onBrushColorChange: (hexNormalized: `#${string}`) => void;
  onBrushWidthChange: (px: number) => void;
};

/**
 * Drawer-only during `drawing` — color / brush size presets (Story 3.5).
 */
export function DrawingToolbar({
  phase,
  isDrawer,
  brushColor,
  brushWidthPx,
  onBrushColorChange,
  onBrushWidthChange,
}: DrawingToolbarProps) {
  if (phase !== "drawing" || !isDrawer) return null;

  const currentColor = normalizeClientStrokeColor(brushColor);

  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      data-testid="drawing-toolbar"
      className="flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-3 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span id="drawing-toolbar-colors" className="sr-only">
          Stroke color
        </span>
        <div
          className="join join-horizontal flex flex-wrap gap-1"
          role="group"
          aria-labelledby="drawing-toolbar-colors"
        >
          {DRAWING_COLOR_PRESETS.map(({ hex, label }) => {
            const normalized = normalizeClientStrokeColor(hex);
            const pressed = currentColor === normalized;
            return (
              <button
                key={normalized}
                type="button"
                className={`btn join-item min-h-11 min-w-11 px-1 sm:min-w-12 ${
                  pressed ? "btn-primary" : "btn-ghost btn-outline btn-sm"
                }`}
                aria-pressed={pressed}
                aria-label={`Color ${label}`}
                title={label}
                onClick={() => onBrushColorChange(normalized as `#${string}`)}
              >
                <span
                  className="block size-6 rounded-sm border border-base-300"
                  style={{ backgroundColor: normalized }}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span id="drawing-toolbar-widths" className="text-sm font-medium text-base-content/80">
          Brush size
        </span>
        <div
          className="join join-horizontal flex flex-wrap gap-1"
          role="group"
          aria-labelledby="drawing-toolbar-widths"
        >
          {DRAWING_BRUSH_WIDTH_PRESETS.map((w) => {
            const pressed = brushWidthPx === w;
            return (
              <button
                key={w}
                type="button"
                className={`btn join-item min-h-11 min-w-11 px-2 text-sm tabular-nums sm:min-w-12 ${
                  pressed ? "btn-primary" : "btn-outline btn-sm"
                }`}
                aria-pressed={pressed}
                aria-label={`Brush width ${String(w)} pixels`}
                onClick={() => onBrushWidthChange(w)}
              >
                {String(w)}px
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
