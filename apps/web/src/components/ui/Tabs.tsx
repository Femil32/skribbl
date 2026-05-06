"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface Tab<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ tabs, active, onChange, className }: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const currentIdx = tabs.findIndex((t) => t.id === active);
    if (currentIdx === -1) return;
    const nextIdx =
      e.key === "ArrowRight"
        ? (currentIdx + 1) % tabs.length
        : (currentIdx - 1 + tabs.length) % tabs.length;
    const next = tabs[nextIdx];
    if (!next) return;
    onChange(next.id);
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[nextIdx]?.focus();
  }

  return (
    <div ref={listRef} className={cn("flex gap-2", className)} role="tablist" onKeyDown={handleKeyDown}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-[10px] border-[2.5px] border-[#1a1714] px-3.5 py-1.5 text-[13px] font-extrabold capitalize cursor-pointer press-down focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary",
              isActive
                ? "bg-[#1a1714] text-[#fffdf6] shadow-skribbl-sm"
                : "bg-sk-panel2 text-[#1a1714]"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
