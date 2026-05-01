import { describe, expect, it } from "vitest";
import { lobbyConnectionBannerModel } from "./lobby-transport";

describe("lobbyConnectionBannerModel", () => {
  it("offers reload without retry when transport is blocked", () => {
    const model = lobbyConnectionBannerModel({
      transport: "blocked",
      reason: "first",
      errorMessage: "Configure NEXT_PUBLIC_WS_URL",
    });
    expect(model).not.toBeNull();
    expect(model?.showRetry).toBe(false);
    expect(model?.showReload).toBe(true);
    expect(model?.alertRole).toBe("alert");
  });

  it("offers retry without reload for fatal transport", () => {
    const model = lobbyConnectionBannerModel({
      transport: "fatal",
      reason: "first",
      errorMessage: "Could not reach server",
    });
    expect(model?.showRetry).toBe(true);
    expect(model?.showReload).toBe(false);
  });

  it("returns null for idle transport", () => {
    expect(
      lobbyConnectionBannerModel({ transport: "idle", reason: "first" }),
    ).toBeNull();
  });
});
