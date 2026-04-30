import { describe, expect, it } from "vitest";
import { connectRemoteChunkPoints } from "./remote-chunk-bridge";

describe("connectRemoteChunkPoints", () => {
  it("passes through the first chunk unchanged and records tail", () => {
    const tails = new Map<string, { x: number; y: number }>();
    const out = connectRemoteChunkPoints("s1", [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ], tails);
    expect(out).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(tails.get("s1")).toEqual({ x: 1, y: 1 });
  });

  it("prepends previous tail so consecutive chunks form one polyline", () => {
    const tails = new Map<string, { x: number; y: number }>();
    connectRemoteChunkPoints("s1", [{ x: 0, y: 0 }], tails);
    const out = connectRemoteChunkPoints("s1", [{ x: 2, y: 2 }], tails);
    expect(out).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 2 },
    ]);
    expect(tails.get("s1")).toEqual({ x: 2, y: 2 });
  });

  it("keeps separate tails per strokeId", () => {
    const tails = new Map<string, { x: number; y: number }>();
    connectRemoteChunkPoints("a", [{ x: 1, y: 1 }], tails);
    connectRemoteChunkPoints("b", [{ x: 9, y: 9 }], tails);
    const out = connectRemoteChunkPoints("a", [{ x: 3, y: 3 }], tails);
    expect(out).toEqual([
      { x: 1, y: 1 },
      { x: 3, y: 3 },
    ]);
  });
});
