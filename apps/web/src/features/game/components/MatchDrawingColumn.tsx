"use client";

import type { CanvasReplayEvent, RoomPhase } from "@skribbl/shared";
import { useMemo, useState } from "react";
import { chunk, type DrPalette } from "@/features/lobby/design/tokens";
import {
  DrawingCanvas,
  type DrawingActiveTool,
  type DrawingCanvasMode,
} from "@/features/game/canvas/DrawingCanvas";
import { DrMatchDrawingToolbar } from "@/features/match/components/DrMatchDrawingToolbar";

export type MatchDrawingColumnProps = {
  palette: DrPalette;
  accentHex: string;
  phase: RoomPhase;
  localPlayerId: string;
  drawerPlayerId?: string;
  roomId: string;
  /** Remount canvas when the match round advances so ink does not stack across rounds. */
  matchRoundIndex?: number;
  brushColor: string;
  brushWidthPx: number;
  onBrushColorChange: (hex: `#${string}`) => void;
  onBrushWidthChange: (px: number) => void;
  sendJsonLine: (raw: string) => void;
  remoteCanvasCommits: CanvasReplayEvent[];
  wsLive: boolean;
  /** Guesser SKR reference: “🔍 Guess the word!” chip overlaying the canvas. */
  showGuessBanner: boolean;
};

/**
 * Match canvas stack — canvas first, chunky DR toolbar under drawer (ScreenGame.jsx order).
 */
export function MatchDrawingColumn({
  palette,
  accentHex,
  phase,
  localPlayerId,
  drawerPlayerId,
  roomId,
  matchRoundIndex,
  brushColor,
  brushWidthPx,
  onBrushColorChange,
  onBrushWidthChange,
  sendJsonLine,
  remoteCanvasCommits,
  wsLive,
  showGuessBanner,
}: MatchDrawingColumnProps) {
  const [activeTool, setActiveTool] = useState<DrawingActiveTool>("brush");
  const ck = (x = 4, y = 5) => chunk(x, y, palette.line);

  const isDrawer =
    drawerPlayerId !== undefined && drawerPlayerId === localPlayerId;

  const strokeTransport = useMemo(() => {
    if (!wsLive || !roomId) return null;
    return {
      roomId,
      phase,
      localPlayerId,
      currentDrawerPlayerId: drawerPlayerId ?? null,
      sendJsonLine,
    };
  }, [wsLive, roomId, phase, localPlayerId, drawerPlayerId, sendJsonLine]);

  const canvasMode: DrawingCanvasMode = wsLive ? "drawing" : "read-only";

  const canvasInstanceKey =
    matchRoundIndex !== undefined
      ? `${roomId}-r${String(matchRoundIndex)}`
      : roomId;

  return (
    <div
      className="flex w-full min-h-0 flex-1 flex-col gap-3"
      data-testid="match-drawing-column"
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          background: "#ffffff",
          border: `3px solid ${palette.line}`,
          borderRadius: 18,
          boxShadow: ck(6, 8),
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {showGuessBanner && phase === "drawing" ? (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              background: palette.panel,
              border: `2px solid ${palette.line}`,
              borderRadius: 10,
              padding: "4px 12px",
              fontWeight: 700,
              fontSize: 12,
              boxShadow: ck(3, 4),
              zIndex: 2,
              pointerEvents: "none",
            }}
          >
            🔍 Guess the word!
          </div>
        ) : null}
        <DrawingCanvas
          key={canvasInstanceKey}
          className="min-h-[200px] w-full flex-1"
          brushColor={brushColor}
          brushWidthPx={brushWidthPx}
          activeTool={activeTool}
          mode={canvasMode}
          strokeTransport={strokeTransport}
          remoteCanvasCommits={remoteCanvasCommits}
        />
      </div>

      <DrMatchDrawingToolbar
        palette={palette}
        accentHex={accentHex}
        phase={phase}
        isDrawer={isDrawer}
        roomId={roomId}
        sendJsonLine={sendJsonLine}
        brushColor={brushColor}
        brushWidthPx={brushWidthPx}
        activeTool={activeTool}
        onActiveToolChange={setActiveTool}
        onBrushColorChange={onBrushColorChange}
        onBrushWidthChange={onBrushWidthChange}
      />

      {phase === "drawing" && !isDrawer ? (
        <p style={{ fontSize: 12, color: palette.inkDim, margin: 0 }} role="note">
          Only the drawer can use tools. You can still watch the sketch.
        </p>
      ) : null}
    </div>
  );
}
