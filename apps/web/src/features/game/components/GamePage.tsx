"use client";

import type { LobbyRosterPlayer, RoomPhase } from "@skribbl/shared";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";

import { MatchDrawingColumn } from "@/features/game/components/MatchDrawingColumn";
import { PhaseBar } from "@/features/match/components/PhaseBar";

const DEV_MATCH_PHASE: RoomPhase = "drawing";

/** Minimal roster rows for PhaseBar UX in `/game` dev shell (canonical `phase-bar` test id matches production path). */
const DEV_PHASEBAR_PLAYERS: LobbyRosterPlayer[] = [
  {
    playerId: "dev-local-drawer",
    displayName: "Dev drawer",
    avatarPresetId: "preset-1",
    isHost: true,
    score: 0,
    connectionStatus: "connected",
    joinedAtMs: 0,
  },
];

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
  const [devPhaseDeadlineMs] = useState(() => Date.now() + 120_000);
  const sendJsonLineDev = useCallback(() => {
    /* dev scaffold — no WebSocket transport */
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <header className="shrink-0 border-b border-base-300 bg-base-200 px-3 py-2">
        <PhaseBar
          phase={DEV_MATCH_PHASE}
          players={DEV_PHASEBAR_PLAYERS}
          localPlayerId="dev-local-drawer"
          drawerPlayerId="dev-local-drawer"
          matchRoundIndex={0}
          phaseDeadlineMs={devPhaseDeadlineMs}
        />
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
              remoteCanvasCommits={[]}
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
