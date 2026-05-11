import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearToken,
  getOrCreatePlayerToken,
  getStoredToken,
  storeToken,
  wsUrlToHttpUrl,
} from "./player-token";

describe("wsUrlToHttpUrl", () => {
  it("converts ws:// to http://", () => {
    expect(wsUrlToHttpUrl("ws://localhost:3001")).toBe("http://localhost:3001");
  });

  it("converts wss:// to https://", () => {
    expect(wsUrlToHttpUrl("wss://example.com")).toBe("https://example.com");
  });

  it("leaves other URLs unchanged", () => {
    expect(wsUrlToHttpUrl("http://example.com")).toBe("http://example.com");
  });
});

describe("getStoredToken / storeToken / clearToken", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns null when nothing stored", () => {
    expect(getStoredToken()).toBeNull();
  });

  it("returns null when only one key stored", () => {
    localStorage.setItem("skribbl_pid", "abc");
    expect(getStoredToken()).toBeNull();
  });

  it("round-trips via storeToken / getStoredToken", () => {
    storeToken("mytoken", "myplayerid");
    expect(getStoredToken()).toEqual({ token: "mytoken", playerId: "myplayerid" });
  });

  it("clears both keys", () => {
    storeToken("tok", "pid");
    clearToken();
    expect(getStoredToken()).toBeNull();
  });
});

describe("getOrCreatePlayerToken", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns stored token without fetching", async () => {
    storeToken("existing-tok", "existing-pid");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await getOrCreatePlayerToken("http://localhost:3001");
    expect(result).toEqual({ token: "existing-tok", playerId: "existing-pid" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches and stores new token when none exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "new-tok-abc", playerId: "new-pid-xyz" }),
    } as Response);
    const result = await getOrCreatePlayerToken("http://localhost:3001");
    expect(result).toEqual({ token: "new-tok-abc", playerId: "new-pid-xyz" });
    expect(getStoredToken()).toEqual({ token: "new-tok-abc", playerId: "new-pid-xyz" });
  });

  it("returns empty strings on fetch failure, not throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network error"));
    const result = await getOrCreatePlayerToken("http://localhost:3001");
    expect(result).toEqual({ token: "", playerId: "" });
  });

  it("returns empty strings on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);
    const result = await getOrCreatePlayerToken("http://localhost:3001");
    expect(result).toEqual({ token: "", playerId: "" });
  });

  it("reuses token on subsequent call (simulates reload)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "reload-tok", playerId: "reload-pid" }),
    } as Response);
    await getOrCreatePlayerToken("http://localhost:3001");
    // Second call should reuse without fetching again
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await getOrCreatePlayerToken("http://localhost:3001");
    expect(result).toEqual({ token: "reload-tok", playerId: "reload-pid" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
