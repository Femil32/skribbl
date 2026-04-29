import { describe, expect, it } from "vitest";
import {
  clientCommandSchema,
  isMatchFlowPhase,
  isRosterScoreVisiblePhase,
  lobbyRosterPlayerSchema,
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

  it("accepts chooseWord", () => {
    const result = clientCommandSchema.safeParse({ type: "chooseWord", choiceIndex: 1 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ type: "chooseWord", choiceIndex: 1 });
  });

  it("accepts returnToLobby", () => {
    const result = clientCommandSchema.safeParse({ type: "returnToLobby" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ type: "returnToLobby" });
  });

  it("rejects chooseWord index out of range", () => {
    expect(clientCommandSchema.safeParse({ type: "chooseWord", choiceIndex: 3 }).success).toBe(
      false,
    );
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
          score: 0,
        },
        {
          playerId: "b",
          displayName: "Gue",
          avatarPresetId: "preset-2",
          isHost: false,
          score: 42,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("lobby roster player defaults score to 0 when omitted", () => {
    const row = lobbyRosterPlayerSchema.parse({
      playerId: "a",
      displayName: "Hue",
      avatarPresetId: "preset-1",
      isHost: true,
    });
    expect(row.score).toBe(0);
  });

  it("accepts matchStarting with phase literal", () => {
    const result = serverEventSchema.safeParse({
      type: "matchStarting",
      roomId: "550e8400-e29b-41d4-a716-446655440000",
      phase: "matchStarting",
    });
    expect(result.success).toBe(true);
  });

  it("accepts matchPhase with matchEnded", () => {
    const result = serverEventSchema.safeParse({
      type: "matchPhase",
      roomId: "550e8400-e29b-41d4-a716-446655440000",
      phase: "matchEnded",
      matchRoundIndex: 0,
    });
    expect(result.success).toBe(true);
  });

  it("accepts wordChoiceOffer", () => {
    const result = serverEventSchema.safeParse({
      type: "wordChoiceOffer",
      roomId: "550e8400-e29b-41d4-a716-446655440000",
      words: ["apple", "banana", "citrus"],
      matchRoundIndex: 0,
      phaseDeadlineMs: 1_700_000_000_000,
    });
    expect(result.success).toBe(true);
  });
});

describe("isMatchFlowPhase", () => {
  it("is false for lobby", () => {
    expect(isMatchFlowPhase("lobby")).toBe(false);
  });

  it("is false for matchEnded (post-match shell, not active round flow)", () => {
    expect(isMatchFlowPhase("matchEnded")).toBe(false);
  });

  it("is true for match phases", () => {
    expect(isMatchFlowPhase("choosingWord")).toBe(true);
    expect(isMatchFlowPhase("drawing")).toBe(true);
  });
});

describe("isRosterScoreVisiblePhase", () => {
  it("is true for match flow and matchEnded", () => {
    expect(isRosterScoreVisiblePhase("drawing")).toBe(true);
    expect(isRosterScoreVisiblePhase("matchEnded")).toBe(true);
  });

  it("is false for pre-match lobby", () => {
    expect(isRosterScoreVisiblePhase("lobby")).toBe(false);
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

  it("round-trips returnToLobby", () => {
    const line = serializeClientCommand({ type: "returnToLobby" });
    expect(JSON.parse(line)).toEqual({ type: "returnToLobby" });
    expect(clientCommandSchema.safeParse(JSON.parse(line)).success).toBe(true);
  });

  it("round-trips reconnectHost", () => {
    const line = serializeClientCommand({
      type: "reconnectHost",
      roomId: "550e8400-e29b-41d4-a716-446655440000",
      playerId: "660e8400-e29b-41d4-a716-446655440001",
      displayName: "Pat",
      avatarPresetId: "preset-1",
    });
    const parsed = clientCommandSchema.safeParse(JSON.parse(line));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.type).toBe("reconnectHost");
  });
});
