import { describe, expect, it } from "vitest";
import { gameWsUrlToHttpHealthzUrl } from "./game-ws-url-to-healthz";

describe("gameWsUrlToHttpHealthzUrl", () => {
  it("maps ws://localhost:3001 to http://localhost:3001/healthz", () => {
    expect(gameWsUrlToHttpHealthzUrl("ws://localhost:3001")).toBe(
      "http://localhost:3001/healthz",
    );
  });

  it("normalizes trailing slash on ws URL", () => {
    expect(gameWsUrlToHttpHealthzUrl("ws://localhost:3001/")).toBe(
      "http://localhost:3001/healthz",
    );
  });

  it("maps wss:// to https:// and ignores ws path segment (healthz is on HTTP root)", () => {
    expect(gameWsUrlToHttpHealthzUrl("wss://game.example.com/v1/socket")).toBe(
      "https://game.example.com/healthz",
    );
  });

  it("preserves non-default port", () => {
    expect(gameWsUrlToHttpHealthzUrl("ws://127.0.0.1:9999")).toBe(
      "http://127.0.0.1:9999/healthz",
    );
  });

  it("throws on malformed ws URL strings", () => {
    expect(() => gameWsUrlToHttpHealthzUrl("not-a-url")).toThrow();
  });
});
