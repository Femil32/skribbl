import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-label text-[#1a1714]/55">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "px-3 py-2.5 rounded-[12px] border-[2.5px] border-[#1a1714] bg-sk-panel2 text-[#1a1714]",
            "font-sans text-sm font-semibold placeholder:text-[#1a1714]/40",
            "outline-none focus-visible:ring-2 focus-visible:ring-tomato focus-visible:ring-offset-1",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";
