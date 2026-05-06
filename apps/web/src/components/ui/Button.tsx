import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "ink" | "secondary" | "ghost" | "danger" | "cta";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  badge?: ReactNode;
  children: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-1.5 font-sans font-extrabold cursor-pointer select-none border-[2.5px] border-[#1a1714] rounded-[12px] press-down transition-colors disabled:opacity-55 disabled:cursor-not-allowed disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-tomato text-[#1a1714] shadow-skribbl-sm",
  ink:
    "bg-[#1a1714] text-[#fffdf6] shadow-skribbl-sm",
  secondary:
    "bg-sk-panel2 text-[#1a1714]",
  ghost:
    "bg-transparent text-[#1a1714] border-transparent shadow-none",
  danger:
    "bg-game-danger text-[#1a1714] shadow-skribbl-sm",
  cta:
    "bg-tomato text-[#1a1714] rounded-[18px] border-[3px] border-[#1a1714] shadow-skribbl-2xl text-2xl font-black py-[18px] px-7",
};

const sizes: Record<ButtonSize, string> = {
  sm: "text-xs px-2.5 py-1.5 rounded-[10px]",
  md: "text-sm px-[18px] py-2.5",
  lg: "text-base px-6 py-3",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", badge, className, children, disabled, ...props }, ref) => {
    const isCta = variant === "cta";
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(base, variants[variant], !isCta && sizes[size], className)}
        {...props}
      >
        {children}
        {badge != null && (
          <span className="font-mono text-xs font-bold bg-black/20 px-2 py-0.5 rounded-[6px]">
            {badge}
          </span>
        )}
      </button>
    );
  }
);
Button.displayName = "Button";
