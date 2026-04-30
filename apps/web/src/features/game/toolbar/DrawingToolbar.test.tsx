import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DrawingToolbar } from "./DrawingToolbar";

describe("DrawingToolbar", () => {
  it("renders toolbar when drawer during drawing with root test id", () => {
    render(
      <DrawingToolbar
        phase="drawing"
        isDrawer
        brushColor="#ef4444"
        brushWidthPx={4}
        onBrushColorChange={() => {}}
        onBrushWidthChange={() => {}}
      />,
    );
    expect(screen.getByTestId("drawing-toolbar")).toBeTruthy();
  });

  it("returns null when not drawer", () => {
    const { container } = render(
      <DrawingToolbar
        phase="drawing"
        isDrawer={false}
        brushColor="#000000"
        brushWidthPx={4}
        onBrushColorChange={() => {}}
        onBrushWidthChange={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when phase is not drawing", () => {
    const { container } = render(
      <DrawingToolbar
        phase="choosingWord"
        isDrawer
        brushColor="#000000"
        brushWidthPx={4}
        onBrushColorChange={() => {}}
        onBrushWidthChange={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("sets aria-pressed on selected color and width", () => {
    render(
      <DrawingToolbar
        phase="drawing"
        isDrawer
        brushColor="#22c55e"
        brushWidthPx={8}
        onBrushColorChange={() => {}}
        onBrushWidthChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /color green/i }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(
      screen.getByRole("button", { name: /brush width 8 pixels/i }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("button", { name: /color slate/i }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("fires brush width change with preset pixel value", async () => {
    const user = userEvent.setup();
    const onWidth = vi.fn();
    render(
      <DrawingToolbar
        phase="drawing"
        isDrawer
        brushColor="#0f172a"
        brushWidthPx={4}
        onBrushColorChange={() => {}}
        onBrushWidthChange={onWidth}
      />,
    );
    await user.click(screen.getByRole("button", { name: /brush width 16 pixels/i }));
    expect(onWidth).toHaveBeenCalledWith(16);
  });

  it("fires color change with normalized lowercase hex", async () => {
    const user = userEvent.setup();
    const onColor = vi.fn();
    render(
      <DrawingToolbar
        phase="drawing"
        isDrawer
        brushColor="#0f172a"
        brushWidthPx={4}
        onBrushColorChange={onColor}
        onBrushWidthChange={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: /color blue/i }));
    expect(onColor).toHaveBeenCalledWith("#3b82f6");
  });
});
