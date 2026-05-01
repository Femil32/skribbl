import { describe, expect, it } from "vitest";
import { lobbyConnectionBannerModel } from "./lobby-transport";

describe("lobbyConnectionBannerModel", () => {
  it("returns null for idle", () => {
    expect(
      lobbyConnectionBannerModel({
        transport: "idle",
        reason: "first",
      }),
    ).toBeNull();
  });

  it("uses alert role for blocking misconfiguration", () => {
    const m = lobbyConnectionBannerModel({
      transport: "blocked",
      reason: "first",
      errorMessage: "Set NEXT_PUBLIC_WS_URL…",
    });
    expect(m?.alertRole).toBe("alert");
    expect(m?.title).toContain("not available");
  });

  it("uses status role for reconnecting", () => {
    const m = lobbyConnectionBannerModel({
      transport: "reconnecting",
      reason: "after-drop",
    });
    expect(m?.alertRole).toBe("status");
    expect(m?.title).toContain("Restoring");
  });

  it("uses status role for first-time connecting", () => {
    const m = lobbyConnectionBannerModel({
      transport: "connecting",
      reason: "first",
    });
    expect(m?.alertRole).toBe("status");
    expect(m?.title).toContain("Connecting");
  });

  it("uses alert for disconnected lobby", () => {
    const m = lobbyConnectionBannerModel({
      transport: "disconnected",
      reason: "after-drop",
    });
    expect(m?.alertRole).toBe("alert");
    expect(m?.showRetry).toBe(true);
  });

  it("uses alert for fatal pre-join failures", () => {
    const m = lobbyConnectionBannerModel({
      transport: "fatal",
      reason: "first",
      errorMessage: "Could not reach the game server",
    });
    expect(m?.alertRole).toBe("alert");
    expect(m?.showRetry).toBe(true);
  });

  it("uses status for live handshake wait", () => {
    const m = lobbyConnectionBannerModel({
      transport: "live",
      reason: "first",
      awaitingRoomHandshake: true,
    });
    expect(m?.alertRole).toBe("status");
    expect(m?.title).toBe("Connected");
  });
});
