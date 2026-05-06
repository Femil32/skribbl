import { DR } from "@/features/lobby/design/tokens";

type ToggleProps = {
  label: string;
  value: boolean;
  setValue: (v: boolean) => void;
  disabled?: boolean;
};

export function Toggle({ label, value, setValue, disabled = false }: ToggleProps) {
  const C = DR.colors;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => !disabled && setValue(!value)}
      disabled={disabled}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: value ? C.ink : "transparent",
        color: value ? C.panel : C.ink,
        border: `2px solid ${C.line}`,
        borderRadius: 99,
        padding: "6px 10px 6px 8px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: DR.font.body,
        fontSize: 12,
        fontWeight: 700,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          border: `2px solid ${value ? C.panel : C.line}`,
          background: value ? C.panel : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          color: C.ink,
          flexShrink: 0,
        }}
      >
        {value ? "✓" : ""}
      </span>
      {label}
    </button>
  );
}
