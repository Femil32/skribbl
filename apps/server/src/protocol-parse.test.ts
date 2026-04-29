import { describe, expect, it } from "vitest";
import { safeParseClientCommand } from "@skribbl/shared";

describe("shared linkage — invalid client payloads", () => {
  it("rejects payloads that are not valid commands", () => {
    expect(safeParseClientCommand({ not: "a-command" }).success).toBe(false);
    expect(safeParseClientCommand({ type: "garbage" }).success).toBe(false);
  });
});
