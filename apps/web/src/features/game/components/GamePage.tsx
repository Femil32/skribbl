"use client";

import type { ReactNode } from "react";
import {
  GameDevShell,
  type GameDevShellProps,
} from "@/features/game/components/GameDevShell";

export type GamePageProps = GameDevShellProps;

/** @deprecated Prefer `GameDevShell` — kept for tests and older imports. */
export function GamePage({ chatSlot }: GamePageProps = {}) {
  return <GameDevShell chatSlot={chatSlot} />;
}
