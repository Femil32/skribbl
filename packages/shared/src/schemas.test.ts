import { describe, expect, it } from "vitest";
import {
  clientCommandSchema,
  safeParseServerEvent,
  serializeClientCommand,
  serverEventSchema,
} from "./schemas.js";

describe("clientCommandSchema", () => {
  it("rejects unknown discriminant", () => {
    const result = clientCommandSchema.safeParse({
      type: "not-a-real-command",
    });
    expect(result.success).toBe(false);
  });

  it("accepts ping", () => {
    const result = clientCommandSchema.safeParse({ type: "ping", ts: 1 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe("ping");
  });

  it("rejects joinRoom without roomCode or displayName", () => {
    expect(clientCommandSchema.safeParse({ type: "joinRoom" }).success).toBe(
      false,
    );
    expect(
      clientCommandSchema.safeParse({ type: "joinRoom", roomCode: "ABCD" })
        .success,
    ).toBe(false);
  });

  it("rejects createRoom without displayName", () => {
    expect(clientCommandSchema.safeParse({ type: "createRoom" }).success).toBe(
      false,
    );
  });

  it("rejects invalid avatar preset on createRoom", () => {
    expect(
      clientCommandSchema.safeParse({
        type: "createRoom",
        displayName: "Pat",
        avatarPresetId: "evil",
      }).success,
    ).toBe(false);
  });

  it("accepts startMatch with no extra fields", () => {
    const result = clientCommandSchema.safeParse({ type: "startMatch" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ type: "startMatch" });
  });
});

describe("serverEventSchema", () => {
  it("rejects roomJoined missing required fields", () => {
    expect(safeParseServerEvent({ type: "roomJoined" }).success).toBe(false);
  });

  it("accepts roomCreated with identity", () => {
    const result = serverEventSchema.safeParse({
      type: "roomCreated",
      roomId: "550e8400-e29b-41d4-a716-446655440000",
      roomCode: "A2BCDE",
      phase: "lobby",
      playerId: "660e8400-e29b-41d4-a716-446655440001",
      displayName: "Pat",
      avatarPresetId: "preset-1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts lobbyRoster golden payload", () => {
    const result = serverEventSchema.safeParse({
      type: "lobbyRoster",
      roomId: "550e8400-e29b-41d4-a716-446655440000",
      players: [
        {
          playerId: "a",
          displayName: "Hue",
          avatarPresetId: "preset-1",
          isHost: true,
        },
        {
          playerId: "b",
          displayName: "Gue",
          avatarPresetId: "preset-2",
          isHost: false,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts matchStarting with phase literal", () => {
    const result = serverEventSchema.safeParse({
      type: "matchStarting",
      roomId: "550e8400-e29b-41d4-a716-446655440000",
      phase: "matchStarting",
    });
    expect(result.success).toBe(true);
  });
});

describe("serializeClientCommand", () => {
  it("round-trips createRoom with identity through clientCommandSchema", () => {
    const line = serializeClientCommand({
      type: "createRoom",
      displayName: "Alex",
      avatarPresetId: "preset-2",
    });
    const parsed = clientCommandSchema.safeParse(JSON.parse(line));
    expect(parsed.success).toBe(true);
    if (parsed.success)
      expect(parsed.data).toEqual({
        type: "createRoom",
        displayName: "Alex",
        avatarPresetId: "preset-2",
      });
  });

  it("round-trips startMatch", () => {
    const line = serializeClientCommand({ type: "startMatch" });
    expect(JSON.parse(line)).toEqual({ type: "startMatch" });
    const parsed = clientCommandSchema.safeParse(JSON.parse(line));
    expect(parsed.success).toBe(true);
  });
});
