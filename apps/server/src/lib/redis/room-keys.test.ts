import { describe, expect, it } from "vitest";
import {
  playerKey,
  serializePlayer,
  deserializePlayer,
  PLAYER_TTL_S,
  type PersistedPlayerFields,
  serializeRoom,
  deserializeRoom,
  type PersistedRoomFields,
} from "./room-keys.js";
import { DEFAULT_ROOM_SETTINGS } from "../../config/game.js";

function minimalPersistedRoom(extra: Partial<PersistedRoomFields> = {}): PersistedRoomFields {
  return {
    id: "rid-8-4",
    code: "ABCDEF",
    hostPlayerId: "hp1",
    hostToken: "tok8",
    phase: "lobby",
    maxPlayers: 8,
    matchPlayerOrder: null,
    matchRoundIndex: 0,
    currentDrawerPlayerId: null,
    roundWordOptions: null,
    roundSecretWord: null,
    drawingStrokeSeq: 0,
    chatTranscriptFanoutRows: [],
    drawingPhaseStartedAtMs: null,
    drawingPhaseAwardedGuesserIds: null,
    scoresByPlayerId: {},
    settings: { ...DEFAULT_ROOM_SETTINGS },
    ...extra,
  };
}

describe("serializeRoom / deserializeRoom voteKick (Story 8.4)", () => {
  it("round-trips PENDING voteKick", () => {
    const voteKick = {
      status: "PENDING" as const,
      targetPlayerId: "t1",
      initiatorPlayerId: "i9",
      startedAtMs: 10,
      expiresAtMs: 30010,
      votes: { i9: "yes" as const },
    };
    const room = minimalPersistedRoom({ voteKick });
    const round = deserializeRoom(serializeRoom(room));
    expect(round.voteKick).toEqual(voteKick);
  });

  it("omits voteKick when absent", () => {
    const room = minimalPersistedRoom();
    const fields = serializeRoom(room);
    expect(fields.voteKick).toBe("");
    expect(deserializeRoom(fields).voteKick).toBeUndefined();
  });
});

describe("playerKey", () => {
  it("returns player:{token}", () => {
    expect(playerKey("abc123")).toBe("player:abc123");
  });
});

describe("PLAYER_TTL_S", () => {
  it("is 90 days in seconds", () => {
    expect(PLAYER_TTL_S).toBe(7776000);
  });
});

describe("serializePlayer / deserializePlayer round-trip", () => {
  const sample: PersistedPlayerFields = {
    playerId: "uuid-player-1",
    displayName: "Alice",
    avatarPresetId: "preset-1",
    updatedAt: "2026-05-08T00:00:00.000Z",
  };

  it("round-trips all fields", () => {
    const serialized = serializePlayer(sample);
    const deserialized = deserializePlayer(serialized);
    expect(deserialized).toEqual(sample);
  });

  it("serializes to Record<string, string>", () => {
    const serialized = serializePlayer(sample);
    for (const v of Object.values(serialized)) {
      expect(typeof v).toBe("string");
    }
  });
});

describe("deserializePlayer error paths", () => {
  it("throws on missing playerId", () => {
    expect(() =>
      deserializePlayer({
        displayName: "Alice",
        avatarPresetId: "cat",
        updatedAt: "2026-05-08T00:00:00.000Z",
      }),
    ).toThrow("Missing playerId");
  });

  it("throws on missing displayName", () => {
    expect(() =>
      deserializePlayer({
        playerId: "uuid-1",
        avatarPresetId: "cat",
        updatedAt: "2026-05-08T00:00:00.000Z",
      }),
    ).toThrow("Missing displayName");
  });

  it("throws on missing updatedAt", () => {
    expect(() =>
      deserializePlayer({
        playerId: "uuid-1",
        displayName: "Alice",
        avatarPresetId: "cat",
      }),
    ).toThrow("Missing updatedAt");
  });

  it("falls back to DEFAULT_AVATAR_PRESET_ID on invalid avatarPresetId", () => {
    const result = deserializePlayer({
      playerId: "uuid-1",
      displayName: "Alice",
      avatarPresetId: "invalid-preset-xyz",
      updatedAt: "2026-05-08T00:00:00.000Z",
    });
    expect(result.avatarPresetId).toBeDefined();
  });
});
