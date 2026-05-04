"use client";

import { cn } from "@/lib/utils";

interface TimerCardProps {
  /** seconds remaining */
  value: number;
  /** total seconds */
  total: number;
  className?: string;
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getUrgency(value: number, total: number): "healthy" | "urgent" | "critical" {
  const ratio = value / total;
  if (ratio <= 0.15) return "critical";
  if (ratio <= 0.35) return "urgent";
  return "healthy";
}

const urgencyColor = {
  healthy: "var(--color-timer-healthy)",
  urgent: "var(--color-timer-urgent)",
  critical: "var(--color-timer-critical)",
};

export function TimerCard({ value, total, className }: TimerCardProps) {
  const urgency = getUrgency(value, total);
  const pct = Math.max(0, Math.min(100, (value / total) * 100));
  const color = urgencyColor[urgency];

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 px-4 py-2 rounded-[14px] border-[2.5px] border-[#1a1714] bg-sk-panel2 shadow-skribbl-sm",
        className
      )}
    >
      <span
        className="font-mono font-black text-[28px] leading-none tabular-nums"
        style={{ color }}
      >
        {formatTime(value)}
      </span>
      <div className="w-20 h-[5px] bg-sk-soft rounded-full border-[1.5px] border-[#1a1714] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
