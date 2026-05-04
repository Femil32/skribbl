"use client";

import { FormEvent, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ChatInput({
  onSubmit,
  placeholder = "type your guess…",
  disabled = false,
  className,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex gap-2", className)}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "flex-1 px-3 py-2.5 rounded-[12px] border-[2.5px] border-[#1a1714] bg-sk-panel2 text-[#1a1714]",
          "font-sans text-sm placeholder:text-[#1a1714]/40",
          "outline-none focus-visible:ring-2 focus-visible:ring-tomato focus-visible:ring-offset-1",
          "disabled:opacity-55"
        )}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className={cn(
          "px-3.5 rounded-[12px] border-[2.5px] border-[#1a1714] bg-[#1a1714] text-[#fffdf6]",
          "font-extrabold text-sm shadow-[3px_4px_0_0_#0a0908]",
          "press-down cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed disabled:shadow-none"
        )}
      >
        go
      </button>
    </form>
  );
}
