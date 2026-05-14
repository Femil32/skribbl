import { Suspense } from "react";
import { GameMatchClient } from "@/app/game/GameMatchClient";

function GameFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <p className="text-base-content/80">Loading match…</p>
    </div>
  );
}

export default function GameRoutePage() {
  return (
    <Suspense fallback={<GameFallback />}>
      <GameMatchClient />
    </Suspense>
  );
}
