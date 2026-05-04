import { DR } from "@/features/lobby/design/tokens";

type StatusDotProps = {
  ready: boolean;
  size?: number;
};

export function StatusDot({ ready, size = 6 }: StatusDotProps) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: 99,
        background: ready ? DR.semantic.success : DR.semantic.warning,
        flexShrink: 0,
      }}
    />
  );
}
