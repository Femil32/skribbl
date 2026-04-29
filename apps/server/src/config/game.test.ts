import { describe, expect, it } from "vitest";
import { inboundWsMessageByteLength } from "./game.js";

describe("inboundWsMessageByteLength", () => {
  it("measures Buffer, ArrayBuffer, and Buffer[]", () => {
    expect(inboundWsMessageByteLength(Buffer.from("abc"))).toBe(3);
    expect(inboundWsMessageByteLength(new ArrayBuffer(5))).toBe(5);
    expect(inboundWsMessageByteLength([Buffer.from("a"), Buffer.from("bc")])).toBe(3);
  });
});
