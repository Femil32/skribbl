"use client";

import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, label, disabled = false, className }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 text-xs font-bold rounded-full border-2 border-[#1a1714] px-2.5 py-1.5 cursor-pointer select-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary",
        checked ? "bg-[#1a1714] text-[#fffdf6]" : "bg-transparent text-[#1a1714]",
        "disabled:opacity-55 disabled:cursor-not-allowed",
        className
      )}
    >
      <span
        className={cn(
          "w-3.5 h-3.5 rounded-[4px] border-2 flex items-center justify-center text-[10px]",
          checked
            ? "border-[#fffdf6] bg-[#fffdf6] text-[#1a1714]"
            : "border-[#1a1714] bg-transparent"
        )}
      >
        {checked ? "✓" : null}
      </span>
      {label}
    </button>
  );
}
