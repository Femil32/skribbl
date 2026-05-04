import { DR } from "@/features/lobby/design/tokens";

export function EmptySlot() {
  const C = DR.colors;
  return (
    <div
      style={{
        border: `2px dashed ${C.inkDim}`,
        borderRadius: DR.radius.lg,
        height: 58,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: C.inkDim,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: ".1em",
        textTransform: "uppercase",
      }}
    >
      empty
    </div>
  );
}
