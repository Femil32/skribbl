"use client";

import { useEffect, useState } from "react";
import {
  formatRoundCountdown,
  remainingMs,
  timerUrgencyTier,
  tierToTimerTokenClass,
} from "@/features/match/lib/timer-display";

export type PhaseCountdownChipProps = {
  deadlineMs: number;
  /** Remount when phase/round/deadline changes so fraction baseline resets. */
  resetKey: string;
  "data-testid"?: string;
};

/**
 * Server-driven countdown chip (Story 2.4). Updates at ≥1 Hz; urgency from remaining/total fraction.
 *
 * Uses wall-clock ticks in render alongside `deadlineMs` — parent remounts via `resetKey` when deadlines change.
 */
export function PhaseCountdownChip({
  deadlineMs,
  resetKey,
  "data-testid": testId,
}: PhaseCountdownChipProps) {
  const [baselineTotalMs] = useState(() =>
    Math.max(1, remainingMs(deadlineMs, Date.now())),
  );
  /** Drives rerenders ~1 Hz — wall-clock read happens in render (see purity exception below). */
  const [, forceTick] = useState(0);
  const [motionReduced, setMotionReduced] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 1_000);
    return () => window.clearInterval(id);
  }, [resetKey]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    function sync() {
      setMotionReduced(mq.matches);
    }
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // eslint-disable-next-line react-hooks/purity -- countdown UI must compare authoritative deadline to current wall clock
  const nowMs = Date.now();

  const rem = remainingMs(deadlineMs, nowMs);
  const fraction = Math.min(1, rem / baselineTotalMs);
  const tier = timerUrgencyTier(fraction);
  const label = formatRoundCountdown(rem);
  const toneClass = tierToTimerTokenClass(tier);
  const pulseClass =
    tier === "critical" && !motionReduced ? "animate-pulse" : "";
  const remainingSec = Math.ceil(rem / 1000);
  const totalSec = Math.max(1, Math.ceil(baselineTotalMs / 1000));

  return (
    <span
      role="timer"
      aria-live="off"
      aria-valuenow={remainingSec}
      aria-valuemin={0}
      aria-valuemax={totalSec}
      data-testid={testId}
      className={`inline-flex items-center rounded-md border border-base-300 bg-base-100/80 px-2 py-0.5 text-sm font-semibold tabular-nums ${toneClass} ${pulseClass}`}
    >
      {label}
    </span>
  );
}
