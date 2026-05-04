import { DR } from "@/features/lobby/design/tokens";

type StepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  setValue: (v: number) => void;
  /** When false, controls are disabled (non-host view). */
  disabled?: boolean;
};

export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  setValue,
  disabled = false,
}: StepperProps) {
  const C = DR.colors;
  return (
    <div
      style={{
        border: `2.5px solid ${C.line}`,
        borderRadius: DR.radius.md,
        background: C.panel2,
        padding: "6px 8px 8px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.inkDim,
          letterSpacing: ".18em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => setValue(Math.max(min, value - step))}
          disabled={disabled || value <= min}
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            border: `2px solid ${C.line}`,
            background: C.panel,
            color: C.ink,
            fontWeight: 900,
            fontSize: 14,
            cursor: disabled ? "not-allowed" : "pointer",
            padding: 0,
            lineHeight: 1,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          −
        </button>
        <div
          style={{
            flex: 1,
            fontFamily: DR.font.mono,
            fontSize: 18,
            fontWeight: 800,
            textAlign: "center",
            color: C.ink,
          }}
        >
          {value}
          {unit}
        </div>
        <button
          type="button"
          onClick={() => setValue(Math.min(max, value + step))}
          disabled={disabled || value >= max}
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            border: `2px solid ${C.line}`,
            background: C.panel,
            color: C.ink,
            fontWeight: 900,
            fontSize: 14,
            cursor: disabled ? "not-allowed" : "pointer",
            padding: 0,
            lineHeight: 1,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
