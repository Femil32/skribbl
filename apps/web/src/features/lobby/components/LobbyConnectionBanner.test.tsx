import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LobbyConnectionBanner } from "./LobbyConnectionBanner";

describe("LobbyConnectionBanner", () => {
  it("renders status role while connecting", () => {
    const { container } = render(
      <LobbyConnectionBanner transport="connecting" reason="first" />,
    );
    const strip = container.firstChild as HTMLElement;
    expect(strip.getAttribute("role")).toBe("status");
    expect(screen.getByText(/Connecting to the game server/i)).toBeTruthy();
  });

  it("renders alert role when disconnected", () => {
    const { container } = render(
      <LobbyConnectionBanner transport="disconnected" reason="after-drop" />,
    );
    const strip = container.firstChild as HTMLElement;
    expect(strip.getAttribute("role")).toBe("alert");
    expect(screen.getByText(/You are disconnected/i)).toBeTruthy();
  });

  it("does not use alert role for reconnecting strip", () => {
    const { container } = render(
      <LobbyConnectionBanner transport="reconnecting" reason="after-drop" />,
    );
    const strip = container.firstChild as HTMLElement;
    expect(strip.getAttribute("role")).toBe("status");
  });

  it("invokes onRetry for fatal transport when retry shown", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <LobbyConnectionBanner
        transport="fatal"
        reason="first"
        errorMessage="Could not reach server"
        onRetry={onRetry}
      />,
    );
    await user.click(screen.getByRole("button", { name: /retry connection/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows Reload page for blocked transport when onReload provided", async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    render(
      <LobbyConnectionBanner
        transport="blocked"
        reason="first"
        errorMessage="Real-time requires configuration."
        onReload={onReload}
      />,
    );
    await user.click(screen.getByRole("button", { name: /reload page/i }));
    expect(onReload).toHaveBeenCalledOnce();
  });
});
