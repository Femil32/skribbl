import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type BadgeVariant = "host" | "private" | "status-ready" | "status-idle" | "status-offline" | "pill";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  host:
    "border-[1.5px] border-[#1a1714] bg-sk-panel2 text-[#1a1714] text-label",
  private:
    "border-[1.5px] border-[#1a1714] bg-tomato text-[#1a1714] text-label",
  "status-ready":
    "font-mono text-[11px] font-bold before:content-[''] before:inline-block before:w-1.5 before:h-1.5 before:rounded-full before:bg-game-success before:mr-1.5",
  "status-idle":
    "font-mono text-[11px] font-bold before:content-[''] before:inline-block before:w-1.5 before:h-1.5 before:rounded-full before:bg-game-warning before:mr-1.5",
  "status-offline":
    "font-mono text-[11px] font-bold before:content-[''] before:inline-block before:w-1.5 before:h-1.5 before:rounded-full before:bg-gray-400 before:mr-1.5",
  pill:
    "rounded-full border-[1.5px] border-[#1a1714] bg-sk-panel2 text-[11px] font-bold px-2 py-0.5",
};

export function Badge({ variant = "pill", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[6px] px-2 py-0.5",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Dot + label status indicator (no border) */
export function StatusDot({
  status,
  ping,
}: {
  status: "ready" | "idle" | "offline";
  ping?: number;
}) {
  const colors = {
    ready: "#2a8f4a",
    idle: "#d97a3a",
    offline: "#9ca3af",
  };
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: colors[status] }}
      />
      {status}
      {ping != null && ` · ${ping}ms`}
    </span>
  );
}
