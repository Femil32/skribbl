import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DrawingToolbar } from "./DrawingToolbar";

const defaultMeta = {
  roomId: "room-1",
  sendJsonLine: () => {},
  activeTool: "brush" as const,
  onActiveToolChange: () => {},
};

describe("DrawingToolbar", () => {
  it("renders toolbar when drawer during drawing with root test id", () => {
    render(
      <DrawingToolbar
        phase="drawing"
        isDrawer
        {...defaultMeta}
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
        {...defaultMeta}
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
        {...defaultMeta}
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
        {...defaultMeta}
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
        {...defaultMeta}
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
        {...defaultMeta}
        brushColor="#0f172a"
        brushWidthPx={4}
        onBrushColorChange={onColor}
        onBrushWidthChange={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: /color blue/i }));
    expect(onColor).toHaveBeenCalledWith("#3b82f6");
  });

  it("switches active tool and sets aria-pressed on eraser", async () => {
    const user = userEvent.setup();
    const onTool = vi.fn();
    render(
      <DrawingToolbar
        phase="drawing"
        isDrawer
        {...defaultMeta}
        activeTool="brush"
        onActiveToolChange={onTool}
        brushColor="#0f172a"
        brushWidthPx={4}
        onBrushColorChange={() => {}}
        onBrushWidthChange={() => {}}
      />,
    );
    await user.click(screen.getByTestId("drawing-tool-eraser"));
    expect(onTool).toHaveBeenCalledWith("eraser");
  });

  it("clear confirm sends wire command only (canvas clears on server replay)", async () => {
    const user = userEvent.setup();
    const sendJsonLine = vi.fn();
    render(
      <DrawingToolbar
        phase="drawing"
        isDrawer
        roomId="rid-99"
        sendJsonLine={sendJsonLine}
        activeTool="brush"
        onActiveToolChange={() => {}}
        brushColor="#0f172a"
        brushWidthPx={4}
        onBrushColorChange={() => {}}
        onBrushWidthChange={() => {}}
      />,
    );

    await user.click(screen.getByTestId("drawing-tool-clear"));
    await user.click(screen.getByTestId("drawing-clear-confirm"));

    expect(sendJsonLine).toHaveBeenCalledTimes(1);
    const raw = sendJsonLine.mock.calls[0]?.[0];
    expect(raw).toBeDefined();
    expect(JSON.parse(raw as string)).toEqual({ type: "drawingCanvasClear", roomId: "rid-99" });
  });

  it("clear dialog is a modal dialog with accessible name", async () => {
    const user = userEvent.setup();
    render(
      <DrawingToolbar
        phase="drawing"
        isDrawer
        roomId="r1"
        sendJsonLine={() => {}}
        activeTool="brush"
        onActiveToolChange={() => {}}
        brushColor="#0f172a"
        brushWidthPx={4}
        onBrushColorChange={() => {}}
        onBrushWidthChange={() => {}}
      />,
    );

    await user.click(screen.getByTestId("drawing-tool-clear"));
    const dlg = screen.getByRole("dialog", { name: /clear the canvas/i });
    expect(dlg.tagName.toLowerCase()).toBe("dialog");
  });

  it("focuses first actionable control in clear dialog when opened", async () => {
    const user = userEvent.setup();
    render(
      <DrawingToolbar
        phase="drawing"
        isDrawer
        roomId="r1"
        sendJsonLine={() => {}}
        activeTool="brush"
        onActiveToolChange={() => {}}
        brushColor="#0f172a"
        brushWidthPx={4}
        onBrushColorChange={() => {}}
        onBrushWidthChange={() => {}}
      />,
    );

    await user.click(screen.getByTestId("drawing-tool-clear"));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^cancel$/i })).toHaveFocus();
    });
  });

  it("Escape closes clear dialog without sending clear command", async () => {
    const user = userEvent.setup();
    const sendJsonLine = vi.fn();
    render(
      <DrawingToolbar
        phase="drawing"
        isDrawer
        roomId="r1"
        sendJsonLine={sendJsonLine}
        activeTool="brush"
        onActiveToolChange={() => {}}
        brushColor="#0f172a"
        brushWidthPx={4}
        onBrushColorChange={() => {}}
        onBrushWidthChange={() => {}}
      />,
    );

    await user.click(screen.getByTestId("drawing-tool-clear"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /clear the canvas/i })).toBeNull();
    expect(sendJsonLine).not.toHaveBeenCalled();
  });
});
