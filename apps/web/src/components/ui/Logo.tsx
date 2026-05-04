import { cn } from "@/lib/utils";

type LogoVariant = "full" | "mini";
type LogoColor = "tomato" | "canary" | "mint";

const bgColors: Record<LogoColor, string> = {
  tomato: "bg-tomato",
  canary: "bg-canary",
  mint: "bg-mint",
};

interface LogoProps {
  variant?: LogoVariant;
  color?: LogoColor;
  className?: string;
}

export function Logo({ variant = "full", color = "tomato", className }: LogoProps) {
  if (variant === "mini") {
    return (
      <span
        className={cn(
          "inline-block font-black text-lg leading-none px-3 py-1.5 rounded-[12px]",
          "border-[2.5px] border-[#1a1714] shadow-skribbl-sm tilt-n2",
          bgColors[color],
          "text-[#1a1714]",
          className
        )}
      >
        DR
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-block font-black text-[38px] leading-[0.9] tracking-tight px-4 pt-2.5 pb-3.5",
        "rounded-[18px] border-[3px] border-[#1a1714] shadow-skribbl-2xl tilt-n2",
        bgColors[color],
        "text-[#1a1714]",
        className
      )}
    >
      DOODLE
      <br />
      ROYALE
    </span>
  );
}
