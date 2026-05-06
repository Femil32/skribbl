"use client";

import type { RoomPhase } from "@skribbl/shared";
import { normalizeClientStrokeColor, serializeClientCommand } from "@skribbl/shared";
import { useEffect, useRef, useState } from "react";
import type { DrawingActiveTool } from "@/features/game/canvas/DrawingCanvas";

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
  roomId: string;
  /** Sends validated JSON lines (clear / strokes / fill upstream). */
  sendJsonLine: (raw: string) => void;
  brushColor: string;
  brushWidthPx: number;
  activeTool: DrawingActiveTool;
  onActiveToolChange: (tool: DrawingActiveTool) => void;
  onBrushColorChange: (hexNormalized: `#${string}`) => void;
  onBrushWidthChange: (px: number) => void;
};

/**
 * Drawer-only during `drawing` — color / brush size / eraser / fill / clear (Story 3.5 + 3.6).
 */
export function DrawingToolbar({
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
}: DrawingToolbarProps) {
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const clearTriggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clearModalOpen) return;
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
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
      if (e.key === "Tab") {
        if (focusable.length === 0) { e.preventDefault(); return; }
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
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
      className="flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-3 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span id="drawing-toolbar-tools" className="text-sm font-medium text-base-content/80">
          Tools
        </span>
        <div
          className="join join-horizontal flex flex-wrap gap-1"
          role="group"
          aria-labelledby="drawing-toolbar-tools"
        >
          {(
            [
              { id: "brush" as const, label: "Brush" },
              { id: "eraser" as const, label: "Eraser" },
              { id: "fill" as const, label: "Fill" },
            ] as const
          ).map(({ id, label }) => {
            const pressed = activeTool === id;
            return (
              <button
                key={id}
                type="button"
                data-testid={`drawing-tool-${id}`}
                className={`btn join-item btn-sm ${pressed ? "btn-primary" : "btn-outline"}`}
                aria-pressed={pressed}
                aria-label={label}
                onClick={() => onActiveToolChange(id)}
              >
                {label}
              </button>
            );
          })}
          <button
            ref={clearTriggerRef}
            type="button"
            data-testid="drawing-tool-clear"
            className="btn join-item btn-sm btn-outline btn-error"
            aria-label="Clear canvas"
            onClick={() => setClearModalOpen(true)}
          >
            Clear
          </button>
        </div>
      </div>

      {clearModalOpen ? (
        <div
          ref={modalRef}
          className="modal modal-open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-canvas-title"
        >
          <div className="modal-box">
            <h3 id="clear-canvas-title" className="text-lg font-bold">
              Clear the canvas?
            </h3>
            <p className="py-3 text-sm opacity-80">
              This removes the whole drawing for everyone in the room.
            </p>
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setClearModalOpen(false); clearTriggerRef.current?.focus(); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-error"
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
              >
                Clear for everyone
              </button>
            </div>
          </div>
          <button
            type="button"
            tabIndex={-1}
            className="modal-backdrop bg-transparent"
            aria-hidden="true"
            onClick={() => { setClearModalOpen(false); clearTriggerRef.current?.focus(); }}
          />
        </div>
      ) : null}

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
