import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Tabs } from "./Tabs";

const TABS = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Gamma" },
] as const;

function TabsHarness() {
  const [active, setActive] = useState<"a" | "b" | "c">("a");
  return <Tabs tabs={[...TABS]} active={active} onChange={setActive} />;
}

describe("Tabs — keyboard navigation (AC #4)", () => {
  it("active tab has tabIndex 0, others have tabIndex -1", () => {
    render(<TabsHarness />);
    const [alpha, beta, gamma] = screen.getAllByRole("tab");
    expect(alpha?.tabIndex).toBe(0);
    expect(beta?.tabIndex).toBe(-1);
    expect(gamma?.tabIndex).toBe(-1);
  });

  it("ArrowRight moves focus and selection to next tab", async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);
    const [alpha] = screen.getAllByRole("tab");
    alpha?.focus();
    await user.keyboard("{ArrowRight}");
    const tabs = screen.getAllByRole("tab");
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
  });

  it("ArrowLeft wraps from first tab to last tab", async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);
    const [alpha] = screen.getAllByRole("tab");
    alpha?.focus();
    await user.keyboard("{ArrowLeft}");
    const tabs = screen.getAllByRole("tab");
    expect(document.activeElement).toBe(tabs[2]);
    expect(tabs[2]?.getAttribute("aria-selected")).toBe("true");
  });

  it("ArrowRight wraps from last tab to first tab", async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);
    // Click gamma to make it active, then ArrowRight should wrap to alpha
    await user.click(screen.getByRole("tab", { name: /gamma/i }));
    screen.getByRole("tab", { name: /gamma/i }).focus();
    await user.keyboard("{ArrowRight}");
    const refreshed = screen.getAllByRole("tab");
    expect(document.activeElement).toBe(refreshed[0]);
    expect(refreshed[0]?.getAttribute("aria-selected")).toBe("true");
  });
});
