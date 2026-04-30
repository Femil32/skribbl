import type { ReactNode } from "react";

import { DrawingCanvas } from "../canvas/DrawingCanvas";

export type GamePageProps = {
  /** Extra chat content (e.g. long lists); keeps default shell minimal on `/game`. */
  chatSlot?: ReactNode;
};

export function GamePage({ chatSlot }: GamePageProps = {}) {
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
            <DrawingCanvas mode="drawing" />
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
