"use client";

import type { CanvasReplayEvent, RoomPhase } from "@skribbl/shared";
import { useMemo, useState } from "react";
import {
  DrawingCanvas,
  type DrawingActiveTool,
  type DrawingCanvasMode,
} from "@/features/game/canvas/DrawingCanvas";
import { DrawingToolbar } from "@/features/game/toolbar/DrawingToolbar";

export type MatchDrawingColumnProps = {
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
};

/**
 * Direction-1 canvas stack: optional drawer toolbar + shared `DrawingCanvas` (Story 3.5 + 3.6).
 */
export function MatchDrawingColumn({
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
}: MatchDrawingColumnProps) {
  const [activeTool, setActiveTool] = useState<DrawingActiveTool>("brush");

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
      className="flex w-full flex-col gap-2"
      data-testid="match-drawing-column"
    >
      <DrawingToolbar
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
        <p className="text-xs text-base-content/60" role="note">
          Only the drawer can use color and brush controls. You can still watch the sketch.
        </p>
      ) : null}
      <div className="flex min-h-[220px] w-full flex-1 flex-col overflow-hidden rounded-box border border-base-300 bg-base-200">
        <DrawingCanvas
          key={canvasInstanceKey}
          className="min-h-[200px]"
          brushColor={brushColor}
          brushWidthPx={brushWidthPx}
          activeTool={activeTool}
          mode={canvasMode}
          strokeTransport={strokeTransport}
          remoteCanvasCommits={remoteCanvasCommits}
        />
      </div>
    </div>
  );
}
