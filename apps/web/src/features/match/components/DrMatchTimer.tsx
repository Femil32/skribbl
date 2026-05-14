"use client";

import { useEffect, useState } from "react";
import {
  formatRoundCountdown,
  remainingMs,
  timerUrgencyTier,
  type TimerUrgencyTier,
} from "@/features/match/lib/timer-display";
import type { DrPalette } from "@/features/lobby/design/tokens";
import { DR, chunk } from "@/features/lobby/design/tokens";

type DrMatchTimerProps = {
  palette: DrPalette;
  accentHex: string;
  deadlineMs: number;
  resetKey: string;
};

function tierColor(tier: TimerUrgencyTier, accentHex: string): string {
  switch (tier) {
    case "healthy":
      return accentHex;
    case "urgent":
      return DR.semantic.timerWarn;
    case "critical":
      return DR.semantic.danger;
  }
}

/**
 * Countdown styled like ui_kits/game TimerWidget (progress bar + display font).
 */
export function DrMatchTimer({ palette, accentHex, deadlineMs, resetKey }: DrMatchTimerProps) {
  const [baselineTotalMs] = useState(() => Math.max(1, remainingMs(deadlineMs, Date.now())));
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 1_000);
    return () => window.clearInterval(id);
  }, [resetKey]);

  const nowMs = Date.now();
  const rem = remainingMs(deadlineMs, nowMs);
  const pct = Math.min(1, rem / baselineTotalMs);
  const tier = timerUrgencyTier(pct);
  const color = tierColor(tier, accentHex);
  const label = formatRoundCountdown(rem).replace(":", " : ");
  const ck = (a: number, b: number) => chunk(a, b, palette.line);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        border: `2.5px solid ${palette.line}`,
        borderRadius: DR.radius.lg,
        padding: "6px 14px",
        background: palette.panel2,
        boxShadow: ck(3, 4),
        minWidth: 70,
      }}
    >
      <div
        style={{
          fontFamily: DR.font.display,
          fontSize: 26,
          fontWeight: 900,
          lineHeight: 1,
          color,
          transition: "color .3s",
        }}
      >
        {label}
      </div>
      <div
        style={{
          width: "100%",
          height: 5,
          background: palette.soft,
          border: `1.5px solid ${palette.line}`,
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct * 100}%`,
            background: color,
            transition: "width 1s linear, background .3s",
            borderRadius: 99,
          }}
        />
      </div>
    </div>
  );
}
