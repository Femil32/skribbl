"use client";

import { cn } from "@/lib/utils";

interface StepperProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  suffix?: string;
  onChange: (value: number) => void;
  className?: string;
}

export function Stepper({
  label,
  value,
  min = 1,
  max = 99,
  suffix = "",
  onChange,
  className,
}: StepperProps) {
  function dec() {
    if (value > min) onChange(value - 1);
  }
  function inc() {
    if (value < max) onChange(value + 1);
  }

  return (
    <div
      className={cn(
        "rounded-[12px] border-[2.5px] border-[#1a1714] bg-sk-panel2 px-2 pb-2 pt-1.5 min-w-[120px]",
        className
      )}
    >
      <div className="text-label text-[#1a1714]/55 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <button
          onClick={dec}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="w-[26px] h-[26px] rounded-[8px] border-2 border-[#1a1714] bg-sk-panel font-black text-sm flex items-center justify-center cursor-pointer hover:bg-sk-soft disabled:opacity-40 disabled:cursor-not-allowed"
        >
          −
        </button>
        <span className="flex-1 font-mono font-extrabold text-lg text-center tabular-nums">
          {value}{suffix}
        </span>
        <button
          onClick={inc}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className="w-[26px] h-[26px] rounded-[8px] border-2 border-[#1a1714] bg-sk-panel font-black text-sm flex items-center justify-center cursor-pointer hover:bg-sk-soft disabled:opacity-40 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>
    </div>
  );
}
