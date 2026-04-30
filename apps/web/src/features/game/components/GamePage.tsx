"use client";

import type { ReactNode } from "react";
import type { RoomPhase } from "@skribbl/shared";
import { useCallback, useState } from "react";

import { MatchDrawingColumn } from "@/features/game/components/MatchDrawingColumn";

const DEV_MATCH_PHASE: RoomPhase = "drawing";

export type GamePageProps = {
  /** Extra chat content (e.g. long lists); keeps default shell minimal on `/game`. */
  chatSlot?: ReactNode;
};

/**
 * Dev scaffold: Direction-1 shell with the same toolbar + canvas wiring as lobby match UI (Story 3.5).
 */
export function GamePage({ chatSlot }: GamePageProps = {}) {
  const [brushColor, setBrushColor] = useState("#0f172a");
  const [brushWidthPx, setBrushWidthPx] = useState(4);
  const sendJsonLineDev = useCallback(() => {
    /* dev scaffold — no WebSocket transport */
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <header
        className="shrink-0 border-b border-base-300 bg-base-200 px-3 py-2"
        data-testid="phase-bar"
      >
        <div className="text-sm opacity-80">Phase bar placeholder</div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <main
          className="flex min-h-0 min-w-[320px] flex-1 flex-col overflow-hidden bg-base-100"
          data-testid="canvas-region"
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-3">
            <MatchDrawingColumn
              phase={DEV_MATCH_PHASE}
              localPlayerId="dev-local-drawer"
              drawerPlayerId="dev-local-drawer"
              roomId="dev-room"
              matchRoundIndex={0}
              brushColor={brushColor}
              brushWidthPx={brushWidthPx}
              onBrushColorChange={setBrushColor}
              onBrushWidthChange={setBrushWidthPx}
              sendJsonLine={sendJsonLineDev}
              remoteCommitted={[]}
              wsLive
            />
          </div>
        </main>

        <aside
          className="max-h-full w-full shrink-0 overflow-y-auto border-t border-base-300 bg-base-200 lg:w-80 lg:border-l lg:border-t-0"
          data-testid="chat-region"
        >
          <div className="p-3 text-sm opacity-80">Chat area</div>
          {chatSlot}
        </aside>
      </div>
    </div>
  );
}
