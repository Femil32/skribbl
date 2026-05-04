"use client";

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
  return (
    <div className={cn("flex gap-2", className)} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-[10px] border-[2.5px] border-[#1a1714] px-3.5 py-1.5 text-[13px] font-extrabold capitalize cursor-pointer press-down",
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
