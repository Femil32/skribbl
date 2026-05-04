import type { ReactNode } from "react";
import { DR } from "@/features/lobby/design/tokens";

type SectionLabelProps = {
  children: ReactNode;
};

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: DR.colors.inkDim,
        letterSpacing: ".18em",
        textTransform: "uppercase",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}
