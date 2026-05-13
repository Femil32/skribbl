import { describe, expect, it } from "vitest";
import {
  clientCommandSchema,
  isMatchFlowPhase,
  isRosterScoreVisiblePhase,
  lobbyRosterPlayerSchema,
  roomSettingsSchema,
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

  it("accepts drawingStrokeChunk with hex color", () => {
    const result = clientCommandSchema.safeParse({
      type: "drawingStrokeChunk",
      roomId: "r1",
      strokeId: "s1",
      chunkId: "c1",
      points: [{ x: 1, y: 2 }],
      color: "#aabbCC",
      lineWidthPx: 4,
    });
    expect(result.success).toBe(true);
  });

  it("rejects drawingStrokeChunk with malformed color", () => {
    expect(
      clientCommandSchema.safeParse({
        type: "drawingStrokeChunk",
        roomId: "r1",
        strokeId: "s1",
        chunkId: "c1",
        points: [{ x: 0, y: 0 }],
        color: "red",
        lineWidthPx: 4,
      }).success,
    ).toBe(false);
  });

  it("serializeClientCommand validates drawingCanvasClear", () => {
    const json = serializeClientCommand({
      type: "drawingCanvasClear",
      roomId: "r1",
    });
    expect(JSON.parse(json)).toEqual({ type: "drawingCanvasClear", roomId: "r1" });
  });

  it("accepts drawingCanvasFill", () => {
    const result = clientCommandSchema.safeParse({
      type: "drawingCanvasFill",
      roomId: "r1",
      x: 10,
      y: 20,
      color: "#00ff00",
    });
    expect(result.success).toBe(true);
  });

  it("accepts drawingEraserChunk", () => {
    const result = clientCommandSchema.safeParse({
      type: "drawingEraserChunk",
      roomId: "r1",
      strokeId: "s1",
      chunkId: "c1",
      points: [{ x: 0, y: 0 }],
      lineWidthPx: 8,
    });
    expect(result.success).toBe(true);
  });

  it("serializeClientCommand validates drawingStrokeChunk", () => {
    const json = serializeClientCommand({
      type: "drawingStrokeChunk",
      roomId: "r1",
      strokeId: "s1",
      chunkId: "c1",
      points: [{ x: 0, y: 0 }],
      color: "#000000",
      lineWidthPx: 2,
    });
    expect(JSON.parse(json).type).toBe("drawingStrokeChunk");
  });
});

describe("serverEventSchema", () => {
  it("rejects roomJoined missing required fields", () => {
    expect(safeParseServerEvent({ type: "roomJoined" }).success).toBe(false);
  });

  it("accepts roomCreated with identity and hostToken", () => {
    const result = serverEventSchema.safeParse({
      type: "roomCreated",
      roomId: "550e8400-e29b-41d4-a716-446655440000",
      roomCode: "A2BCDE",
      phase: "lobby",
      playerId: "660e8400-e29b-41d4-a716-446655440001",
      displayName: "Pat",
      avatarPresetId: "preset-1",
      hostToken: "abc123defgh456ijklmn",
      settings: { rounds: 6, drawTime: 80, maxPlayers: 8, wordPack: "classic", showHints: true, skipAfk: true, allowVoice: false },
    });
    expect(result.success).toBe(true);
  });

  it("rejects roomCreated without hostToken", () => {
    const result = serverEventSchema.safeParse({
      type: "roomCreated",
      roomId: "550e8400-e29b-41d4-a716-446655440000",
      roomCode: "A2BCDE",
      phase: "lobby",
      playerId: "660e8400-e29b-41d4-a716-446655440001",
      displayName: "Pat",
      avatarPresetId: "preset-1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts createRoom with optional token", () => {
    const result = clientCommandSchema.safeParse({
      type: "createRoom",
      displayName: "Pat",
      avatarPresetId: "preset-1",
      token: "mytoken123456789abcd",
    });
    expect(result.success).toBe(true);
  });

  it("accepts createRoom without token", () => {
    const result = clientCommandSchema.safeParse({
      type: "createRoom",
      displayName: "Pat",
    });
    expect(result.success).toBe(true);
  });

  it("accepts joinRoom with optional token", () => {
    const result = clientCommandSchema.safeParse({
      type: "joinRoom",
      roomCode: "ABCDEF",
      displayName: "Sam",
      token: "mytoken123456789abcd",
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

  it("lobby roster player defaults connectionStatus to connected when omitted", () => {
    const row = lobbyRosterPlayerSchema.parse({
      playerId: "a",
      displayName: "Hue",
      avatarPresetId: "preset-1",
      isHost: true,
      score: 0,
    });
    expect(row.connectionStatus).toBe("connected");
  });

  it("lobby roster player accepts disconnected status", () => {
    const row = lobbyRosterPlayerSchema.parse({
      playerId: "a",
      displayName: "Hue",
      avatarPresetId: "preset-1",
      isHost: false,
      score: 12,
      connectionStatus: "disconnected",
    });
    expect(row.connectionStatus).toBe("disconnected");
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

  it("accepts drawingHintTick", () => {
    const result = serverEventSchema.safeParse({
      type: "drawingHintTick",
      roomId: "550e8400-e29b-41d4-a716-446655440000",
      matchRoundIndex: 0,
      hintIndex: 2,
      maskedWord: `\u25CF\u25CFapple`,
      totalLetters: 5,
      revealedLetterCount: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects drawingHintTick when revealedLetterCount exceeds totalLetters", () => {
    const result = serverEventSchema.safeParse({
      type: "drawingHintTick",
      roomId: "550e8400-e29b-41d4-a716-446655440000",
      matchRoundIndex: 0,
      hintIndex: 2,
      maskedWord: "hello",
      totalLetters: 5,
      revealedLetterCount: 6,
    });
    expect(result.success).toBe(false);
  });

  it("accepts drawingStrokeCommitted", () => {
    const result = serverEventSchema.safeParse({
      type: "drawingStrokeCommitted",
      roomId: "r",
      seq: 1,
      senderPlayerId: "p1",
      strokeId: "s",
      chunkId: "c",
      points: [{ x: 0, y: 0 }],
      color: "#000000",
      lineWidthPx: 4,
    });
    expect(result.success).toBe(true);
  });

  it("accepts drawingCanvasOpCommitted", () => {
    const result = serverEventSchema.safeParse({
      type: "drawingCanvasOpCommitted",
      roomId: "r",
      seq: 2,
      senderPlayerId: "p1",
      op: { op: "clear" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts drawingCanvasOpCommitted fill", () => {
    const result = serverEventSchema.safeParse({
      type: "drawingCanvasOpCommitted",
      roomId: "r",
      seq: 3,
      senderPlayerId: "p1",
      op: { op: "fill", x: 1, y: 2, color: "#010203" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts Epic 4 chat server events", () => {
    expect(
      serverEventSchema.safeParse({
        type: "chatPlayerMessage",
        roomId: "r",
        id: "i1",
        ts: 1,
        senderPlayerId: "a",
        senderDisplayName: "Al",
        text: "hi",
      }).success,
    ).toBe(true);
    expect(
      serverEventSchema.safeParse({
        type: "chatCorrectGuess",
        roomId: "r",
        id: "i2",
        ts: 2,
        guesserPlayerId: "a",
        guesserDisplayName: "Al",
        censoredAnnouncement: "Al guessed the word!",
      }).success,
    ).toBe(true);
    expect(
      serverEventSchema.safeParse({
        type: "chatCorrectGuess",
        roomId: "r",
        id: "i3",
        ts: 3,
        guesserPlayerId: "a",
        guesserDisplayName: "Al",
        revealedWord: "apple",
        censoredAnnouncement: "Al guessed the word!",
      }).success,
    ).toBe(true);
  });

  it("accepts Story 7.1 chatCloseGuessHint", () => {
    const result = serverEventSchema.safeParse({
      type: "chatCloseGuessHint",
      roomId: "r",
      matchRoundIndex: 0,
      message: "You're very close!",
      id: "i-hint",
      ts: 9,
    });
    expect(result.success).toBe(true);
  });

  it("rejects chatCloseGuessHint message over 120 chars", () => {
    const result = serverEventSchema.safeParse({
      type: "chatCloseGuessHint",
      roomId: "r",
      matchRoundIndex: 0,
      message: "x".repeat(121),
      id: "i-hint",
      ts: 9,
    });
    expect(result.success).toBe(false);
  });

  it("accepts Story 5.2 roomHydrate and canvasOpLogResync", () => {
    const stroke = {
      type: "drawingStrokeCommitted",
      roomId: "r",
      seq: 1,
      senderPlayerId: "p",
      strokeId: "s",
      chunkId: "c",
      points: [{ x: 0, y: 0 }],
      color: "#000000",
      lineWidthPx: 2,
    };
    expect(
      serverEventSchema.safeParse({
        type: "roomHydrate",
        roomId: "r",
        phase: "drawing",
        drawingStrokeSeq: 1,
        matchRoundIndex: 0,
        drawerPlayerId: "p",
        canvasCommits: [stroke],
        chatTail: [],
      }).success,
    ).toBe(true);
    expect(
      serverEventSchema.safeParse({
        type: "canvasOpLogResync",
        roomId: "r",
        code: "CANVAS_OP_LOG_GAP",
      }).success,
    ).toBe(true);
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

  it("accepts chatMessage", () => {
    const result = clientCommandSchema.safeParse({
      type: "chatMessage",
      roomId: "r1",
      text: "hello",
    });
    expect(result.success).toBe(true);
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

  it("round-trips reconnectPlayer", () => {
    const line = serializeClientCommand({
      type: "reconnectPlayer",
      roomId: "r1",
      playerId: "p9",
      displayName: "Edge",
      avatarPresetId: "preset-2",
    });
    const parsed = clientCommandSchema.safeParse(JSON.parse(line));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.type).toBe("reconnectPlayer");
  });
});

describe("roomSettingsSchema (Story 8.2)", () => {
  const validSettings = {
    rounds: 6,
    drawTime: 80,
    maxPlayers: 8,
    wordPack: "classic",
    showHints: true,
    skipAfk: true,
    allowVoice: false,
  };

  it("accepts valid full settings", () => {
    expect(roomSettingsSchema.safeParse(validSettings).success).toBe(true);
  });

  it("rejects rounds out of range", () => {
    expect(roomSettingsSchema.safeParse({ ...validSettings, rounds: 0 }).success).toBe(false);
    expect(roomSettingsSchema.safeParse({ ...validSettings, rounds: 21 }).success).toBe(false);
  });

  it("rejects maxPlayers out of range", () => {
    expect(roomSettingsSchema.safeParse({ ...validSettings, maxPlayers: 1 }).success).toBe(false);
    expect(roomSettingsSchema.safeParse({ ...validSettings, maxPlayers: 13 }).success).toBe(false);
  });

  it("rejects unknown wordPack", () => {
    expect(roomSettingsSchema.safeParse({ ...validSettings, wordPack: "unknown" }).success).toBe(false);
  });

  it("accepts all valid wordPack values", () => {
    for (const wp of ["classic", "cryptids", "foods", "movies", "custom"]) {
      expect(roomSettingsSchema.safeParse({ ...validSettings, wordPack: wp }).success).toBe(true);
    }
  });
});

describe("updateSettings command (Story 8.2)", () => {
  it("accepts full settings update", () => {
    const result = clientCommandSchema.safeParse({
      type: "updateSettings",
      settings: { rounds: 3, drawTime: 60, maxPlayers: 8, wordPack: "foods", showHints: false, skipAfk: false, allowVoice: true },
    });
    expect(result.success).toBe(true);
  });

  it("accepts partial settings update", () => {
    const result = clientCommandSchema.safeParse({
      type: "updateSettings",
      settings: { rounds: 5 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty partial", () => {
    const result = clientCommandSchema.safeParse({
      type: "updateSettings",
      settings: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid field value", () => {
    const result = clientCommandSchema.safeParse({
      type: "updateSettings",
      settings: { rounds: 99 },
    });
    expect(result.success).toBe(false);
  });
});

describe("settingsUpdated event (Story 8.2)", () => {
  it("round-trips settingsUpdated", () => {
    const event = {
      type: "settingsUpdated",
      roomId: "r1",
      settings: { rounds: 6, drawTime: 80, maxPlayers: 8, wordPack: "classic", showHints: true, skipAfk: true, allowVoice: false },
    };
    const result = serverEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("settingsUpdated");
    }
  });
});

describe("roomJoined includes settings (Story 8.2)", () => {
  it("accepts roomJoined with settings", () => {
    const event = {
      type: "roomJoined",
      roomId: "r1",
      roomCode: "ABCD",
      phase: "lobby",
      playerCount: 2,
      playerId: "p1",
      displayName: "Pat",
      avatarPresetId: "preset-1",
      settings: { rounds: 6, drawTime: 80, maxPlayers: 8, wordPack: "classic", showHints: true, skipAfk: true, allowVoice: false },
    };
    expect(serverEventSchema.safeParse(event).success).toBe(true);
  });

  it("rejects roomJoined without settings", () => {
    const event = {
      type: "roomJoined",
      roomId: "r1",
      roomCode: "ABCD",
      phase: "lobby",
      playerCount: 2,
      playerId: "p1",
      displayName: "Pat",
      avatarPresetId: "preset-1",
    };
    expect(serverEventSchema.safeParse(event).success).toBe(false);
  });
});
