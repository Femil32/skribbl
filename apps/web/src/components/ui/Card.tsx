import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tilt?: "none" | "n1" | "n2" | "p1" | "p05";
  shadow?: "sm" | "md" | "lg" | "xl" | "2xl";
}

const shadowMap = {
  sm: "shadow-skribbl-sm",
  md: "shadow-skribbl-md",
  lg: "shadow-skribbl-lg",
  xl: "shadow-skribbl-xl",
  "2xl": "shadow-skribbl-2xl",
};

const tiltMap = {
  none: "",
  n1: "tilt-n1",
  n2: "tilt-n2",
  p1: "tilt-p1",
  p05: "tilt-p05",
};

export function Card({
  children,
  tilt = "none",
  shadow = "lg",
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-sk-panel border-[3px] border-[#1a1714] rounded-[22px] p-4",
        shadowMap[shadow],
        tiltMap[tilt],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
