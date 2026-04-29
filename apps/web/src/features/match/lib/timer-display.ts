/** Pure helpers for authoritative match-phase countdowns (Story 2.4). No client guesses at round length. */

export type TimerUrgencyTier = "healthy" | "urgent" | "critical";

/**
 * Milliseconds remaining until `deadlineMs`, floored at 0.
 */
export function remainingMs(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.floor(deadlineMs - nowMs));
}

/**
 * `MM:SS` with tabular-safe digit count (minutes grow without cap for long env-driven windows).
 */
export function formatRoundCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Maps remaining-vs-total fraction to semantic urgency (align with UX timer tokens). */
export function timerUrgencyTier(fractionRemaining: number): TimerUrgencyTier {
  const f = Math.min(1, Math.max(0, fractionRemaining));
  if (f > 0.42) return "healthy";
  if (f > 0.15) return "urgent";
  return "critical";
}

export function tierToTimerTokenClass(tier: TimerUrgencyTier): string {
  switch (tier) {
    case "healthy":
      return "text-timer-healthy";
    case "urgent":
      return "text-timer-urgent";
    case "critical":
      return "text-timer-critical";
  }
}
