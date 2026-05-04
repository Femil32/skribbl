"use client";

import { cn } from "@/lib/utils";

interface PackChipProps {
  label: string;
  count?: number | string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function PackChip({
  label,
  count,
  selected = false,
  onClick,
  className,
}: PackChipProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-2 rounded-[12px] border-[2.5px] border-[#1a1714] px-3 py-2 text-[13px] font-bold cursor-pointer select-none press-down",
        selected
          ? "bg-tomato text-[#1a1714] shadow-skribbl-sm"
          : "bg-sk-panel2 text-[#1a1714]",
        className
      )}
    >
      {label}
      {count != null && (
        <span
          className={cn(
            "text-[10px] font-semibold px-1.5 py-0.5 rounded-[6px] border-[1.5px] border-[#1a1714]",
            selected ? "bg-black/18" : "bg-sk-panel"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
