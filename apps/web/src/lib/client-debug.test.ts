import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldLogRouteErrors } from "./client-debug";

describe("shouldLogRouteErrors", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("is true in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(shouldLogRouteErrors()).toBe(true);
  });

  it("is false without opt-in when not in development", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(shouldLogRouteErrors()).toBe(false);
  });

  it("is true when URL has debug=1", () => {
    window.history.replaceState({}, "", "/?debug=1");
    expect(shouldLogRouteErrors()).toBe(true);
  });

  it("is true when localStorage skribbl_debug is 1", () => {
    localStorage.setItem("skribbl_debug", "1");
    expect(shouldLogRouteErrors()).toBe(true);
  });
});
