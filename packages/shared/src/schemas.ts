/**
 * Wire protocol (Skribbl) — single source of truth for JSON shapes.
 *
 * All client↔server commands and events accrete here as Zod schemas + inferred types.
 * Do not duplicate command enums or message structs in apps/web or apps/server.
 *
 * Discriminant field on the wire: `type` (stable for demux in server handlers and client).
 */

import { z, type ZodError } from "zod";
import {
  CHAT_MESSAGE_MAX_GRAPHEMES,
  sanitizeChatMessage,
} from "./chat-text.js";
import {
  avatarPresetIdSchema,
  countGraphemes,
} from "./player-identity.js";

/** Zod refinement issue messages — echoed by `@skribbl/server` as protocol `error.code` where applicable */
export const LOBBY_CHAT_ZOD_ISSUE_CHAT_EMPTY = "CHAT_EMPTY";
export const LOBBY_CHAT_ZOD_ISSUE_MESSAGE_TOO_LONG = "MESSAGE_TOO_LONG";

/**
 * Maps `lobbyChatCommandSchema.parse` errors to protocol `error.code` values.
 * Returns `null` for unrelated issues (unknown fields, wrong types, etc.).
 */
export function wireCodeFromLobbyChatZodError(
  error: ZodError,
): "MESSAGE_TOO_LONG" | "CHAT_EMPTY" | null {
  for (const issue of error.issues) {
    if (issue.code !== z.ZodIssueCode.custom) continue;
    if (issue.message === LOBBY_CHAT_ZOD_ISSUE_MESSAGE_TOO_LONG) return "MESSAGE_TOO_LONG";
    if (issue.message === LOBBY_CHAT_ZOD_ISSUE_CHAT_EMPTY) return "CHAT_EMPTY";
  }
  return null;
}

/**
 * Validates `lobbyChat` payloads (Story 8.3). Unknown keys rejected via `.strict()`.
 */
export const lobbyChatCommandSchema = z
  .object({
    type: z.literal("lobbyChat"),
    roomCode: z.string(),
    message: z.string(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const sanitized = sanitizeChatMessage(data.message);
    if (sanitized.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: LOBBY_CHAT_ZOD_ISSUE_CHAT_EMPTY,
        path: ["message"],
      });
      return;
    }
    if (countGraphemes(sanitized) > CHAT_MESSAGE_MAX_GRAPHEMES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: LOBBY_CHAT_ZOD_ISSUE_MESSAGE_TOO_LONG,
        path: ["message"],
      });
    }
  });

// ─── Room Settings (Story 8.2) ───────────────────────────────────────────────

export const roomSettingsSchema = z.object({
  rounds:     z.number().int().min(1).max(20),
  drawTime:   z.number().int().min(20).max(240),
  maxPlayers: z.number().int().min(2).max(12),
  wordPack:   z.enum(["classic", "cryptids", "foods", "movies", "custom"]),
  showHints:  z.boolean(),
  skipAfk:    z.boolean(),
  allowVoice: z.boolean(),
});
export type RoomSettings = z.infer<typeof roomSettingsSchema>;
export type WordPackId = z.infer<typeof roomSettingsSchema.shape.wordPack>;

// ─── Room Phase ──────────────────────────────────────────────────────────────

/** Shared room phase literals — server is authoritative (Epic 2.1+ match flow). */
export const roomPhaseSchema = z.enum([
  "lobby",
  "matchStarting",
  "choosingWord",
  "drawing",
  "roundResult",
  /** Terminal phase after the last scheduled round (FR11); roster carries final totals. */
  "matchEnded",
]);
export type RoomPhase = z.infer<typeof roomPhaseSchema>;

const MATCH_FLOW_PHASES = new Set<RoomPhase>([
  "matchStarting",
  "choosingWord",
  "drawing",
  "roundResult",
]);

/** True when the room has left pre-match lobby (UI placeholder for in-match surfaces). */
export function isMatchFlowPhase(phase: RoomPhase): boolean {
  return MATCH_FLOW_PHASES.has(phase);
}

/** True when lobby roster should show running / final match totals (2.6 + 2.7). */
export function isRosterScoreVisiblePhase(phase: RoomPhase): boolean {
  return isMatchFlowPhase(phase) || phase === "matchEnded";
}

/** Authoritative socket presence for roster rows (Story 5.3). Omitted on wire → `connected`. */
export const rosterConnectionStatusSchema = z.enum(["connected", "disconnected"]);
export type RosterConnectionStatus = z.infer<typeof rosterConnectionStatusSchema>;

export const lobbyRosterPlayerSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  avatarPresetId: avatarPresetIdSchema,
  isHost: z.boolean(),
  /** Running total for the match (FR10); omitted on wire is treated as 0 in parsers. */
  score: z.number().int().nonnegative().default(0),
  /**
   * Mid-match disconnect: seat retained in `awaitingReconnect` but socket gone.
   * Default `connected` preserves older payloads.
   */
  connectionStatus: rosterConnectionStatusSchema.default("connected"),
});

export type LobbyRosterPlayer = z.infer<typeof lobbyRosterPlayerSchema>;

/** Single batched sample in CSS-pixel canvas space (Story 3.3). */
export const drawingStrokePointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export type DrawingStrokePoint = z.infer<typeof drawingStrokePointSchema>;

/** Client → server commands (extend in Story 1.2+ with joinRoom, etc.). */
export const clientCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ping"),
    ts: z.number().optional(),
  }),
  /**
   * No-op placeholder — keeps the discriminated union pattern stable while
   * handlers are added story-by-story.
   */
  z.object({
    type: z.literal("noop"),
  }),
  /** Create a new lobby room; server assigns a non-guessable room code. */
  z.object({
    type: z.literal("createRoom"),
    displayName: z.string(),
    avatarPresetId: avatarPresetIdSchema.optional(),
    token: z.string().min(1).optional(),
  }),
  /** Join an existing room by code (server normalizes casing / whitespace). */
  z.object({
    type: z.literal("joinRoom"),
    roomCode: z.string(),
    displayName: z.string(),
    avatarPresetId: avatarPresetIdSchema.optional(),
    token: z.string().min(1).optional(),
  }),
  /**
   * Host-only: reclaim the same lobby after a transport drop (Story 1.7+).
   * Requires the canonical `playerId` issued in the original `roomCreated`.
   */
  z.object({
    type: z.literal("reconnectHost"),
    roomId: z.string(),
    playerId: z.string(),
    displayName: z.string(),
    avatarPresetId: avatarPresetIdSchema.optional(),
    token: z.string().min(1).optional(),
  }),
  /**
   * Reclaim a disconnected **non-host** seat after a transport drop during an active match phase
   * (Story 5.2+). Requires a prior **`awaitingReconnect`** stash on the server; clients should send
   * the same **`playerId`** from **`roomJoined`**.
   */
  z.object({
    type: z.literal("reconnectPlayer"),
    roomId: z.string(),
    playerId: z.string(),
    displayName: z.string(),
    avatarPresetId: avatarPresetIdSchema.optional(),
    token: z.string().min(1).optional(),
  }),
  /** Host-only: request transition from lobby to match handshake (Story 1.6+). */
  z.object({
    type: z.literal("startMatch"),
  }),
  /** Drawer-only: pick one of three words during `choosingWord` (Story 2.3). */
  z.object({
    type: z.literal("chooseWord"),
    choiceIndex: z.number().int().min(0).max(2),
  }),
  /** Host-only: after `matchEnded`, reset the room to lobby for a rematch (Story 2.7). */
  z.object({
    type: z.literal("returnToLobby"),
  }),
  /**
   * Drawer-only during `drawing`: batched polyline segment (Epic 3 — NFR-P3 ~50ms batching on client).
   * Server assigns monotonic `seq` on `drawingStrokeCommitted` (Story 3.4).
   */
  z.object({
    type: z.literal("drawingStrokeChunk"),
    roomId: z.string().min(1),
    strokeId: z.string().min(1),
    chunkId: z.string().min(1),
    points: z.array(drawingStrokePointSchema).min(1).max(256),
    color: z
      .string()
      .regex(/^#[\da-fA-F]{6}$/, "expected #RRGGBB stroke color"),
    lineWidthPx: z.number().finite().gte(1).lte(96),
  }),
  /** Drawer-only during `drawing`: clear entire canvas (server assigns `seq` on `drawingCanvasOpCommitted`). */
  z.object({
    type: z.literal("drawingCanvasClear"),
    roomId: z.string().min(1),
  }),
  z.object({
    type: z.literal("drawingCanvasFill"),
    roomId: z.string().min(1),
    x: z.number().finite(),
    y: z.number().finite(),
    color: z
      .string()
      .regex(/^#[\da-fA-F]{6}$/, "expected #RRGGBB fill color"),
  }),
  z.object({
    type: z.literal("drawingEraserChunk"),
    roomId: z.string().min(1),
    strokeId: z.string().min(1),
    chunkId: z.string().min(1),
    points: z.array(drawingStrokePointSchema).min(1).max(256),
    lineWidthPx: z.number().finite().gte(1).lte(96),
  }),
  /** Room chat / guesses (Epic 4, FR19). Text sanitized + length-checked on server. */
  z.object({
    type: z.literal("chatMessage"),
    roomId: z.string().min(1),
    text: z.string().min(1).max(4096),
  }),
  /** Host-only: update lobby match settings (Story 8.2). */
  z.object({
    type: z.literal("updateSettings"),
    settings: roomSettingsSchema.partial(),
  }),
  /** Lobby-only text relay (Story 8.3). Sanitized grapheme length enforced in schema. */
  lobbyChatCommandSchema,
  /** Lobby-only: start a 30s vote-kick window (Story 8.4). */
  z
    .object({
      type: z.literal("initiateVoteKick"),
      roomCode: z.string(),
      targetPlayerId: z.string().min(1),
    })
    .strict(),
  /** Lobby-only: cast yes/no on the active vote for `targetPlayerId` (Story 8.4). */
  z
    .object({
      type: z.literal("castVoteKick"),
      roomCode: z.string(),
      targetPlayerId: z.string().min(1),
      vote: z.enum(["yes", "no"]),
    })
    .strict(),
]);

/** Persisted / hydrated vote-kick tally while `status === PENDING` (Story 8.4). */
export const voteKickPendingStateSchema = z.object({
  status: z.literal("PENDING"),
  targetPlayerId: z.string(),
  initiatorPlayerId: z.string(),
  startedAtMs: z.number(),
  expiresAtMs: z.number(),
  votes: z.record(z.string(), z.enum(["yes", "no"])),
});

export type VoteKickPendingState = z.infer<typeof voteKickPendingStateSchema>;

export const voteKickResolvedReasonSchema = z.enum(["target_left"]);
export type VoteKickResolvedReason = z.infer<typeof voteKickResolvedReasonSchema>;

export const playerLeftReasonSchema = z.enum(["kicked"]);
export type PlayerLeftReason = z.infer<typeof playerLeftReasonSchema>;

const drawingCanvasOpPayloadSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("clear") }),
  z.object({
    op: z.literal("fill"),
    x: z.number().finite(),
    y: z.number().finite(),
    color: z
      .string()
      .regex(/^#[\da-fA-F]{6}$/, "expected #RRGGBB fill color"),
  }),
  z.object({
    op: z.literal("eraserChunk"),
    strokeId: z.string().min(1),
    chunkId: z.string().min(1),
    points: z.array(drawingStrokePointSchema).min(1).max(256),
    lineWidthPx: z.number().finite().gte(1).lte(96),
  }),
]);
export type DrawingCanvasOpPayload = z.infer<typeof drawingCanvasOpPayloadSchema>;

/** Server + client hydrate: same cap as lobby chat feed tail (`MAX_HYDRATE_CHAT_TAIL`). */
export const MAX_HYDRATE_CHAT_TAIL = 400;

/**
 * MVP “snapshot” is an empty baseline at seq 0 + ordered replay (Story 5.2). Hard cap before
 * **`CANVAS_OP_LOG_OVERFLOW`** / structured resync signals — never silently truncate.
 */
export const MAX_CANVAS_OPS_PER_DRAWING_PHASE = 8192;

/** Wire shape for **`drawingStrokeCommitted`** (composed for replay + hydrate). */
export const drawingStrokeCommittedWireSchema = z.object({
  type: z.literal("drawingStrokeCommitted"),
  roomId: z.string(),
  seq: z.number().int().nonnegative(),
  senderPlayerId: z.string(),
  strokeId: z.string(),
  chunkId: z.string(),
  points: z.array(drawingStrokePointSchema).min(1).max(256),
  color: z.string(),
  lineWidthPx: z.number(),
});

/** Wire shape for **`drawingCanvasOpCommitted`**. */
export const drawingCanvasOpCommittedWireSchema = z.object({
  type: z.literal("drawingCanvasOpCommitted"),
  roomId: z.string(),
  seq: z.number().int().nonnegative(),
  senderPlayerId: z.string(),
  op: drawingCanvasOpPayloadSchema,
});

export const canvasReplayEventWireSchema = z.union([
  drawingStrokeCommittedWireSchema,
  drawingCanvasOpCommittedWireSchema,
]);
export type CanvasReplayEventWire = z.infer<typeof canvasReplayEventWireSchema>;

/** Chat rows allowed inside **`roomHydrate.chatTail`** (spoiler-aware per reconnecting viewer). */
export const hydrateChatTailWireSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("chatPlayerMessage"),
    roomId: z.string(),
    id: z.string(),
    ts: z.number().int().nonnegative(),
    senderPlayerId: z.string(),
    senderDisplayName: z.string(),
    text: z.string(),
  }),
  z.object({
    type: z.literal("chatSystemMessage"),
    roomId: z.string(),
    id: z.string(),
    ts: z.number().int().nonnegative(),
    text: z.string(),
  }),
  z.object({
    type: z.literal("chatCorrectGuess"),
    roomId: z.string(),
    id: z.string(),
    ts: z.number().int().nonnegative(),
    guesserPlayerId: z.string(),
    guesserDisplayName: z.string(),
    revealedWord: z.string().optional(),
    censoredAnnouncement: z.string(),
  }),
]);

export type HydrateChatTailEvent = z.infer<typeof hydrateChatTailWireSchema>;

/** Server → client events pushed over WebSocket. */
export const serverEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("pong"),
    ts: z.number().optional(),
  }),
  z.object({
    type: z.literal("error"),
    code: z.string(),
    message: z.string().optional(),
    correlationId: z.string().optional(),
  }),
  z.object({
    type: z.literal("roomCreated"),
    roomId: z.string(),
    roomCode: z.string(),
    phase: roomPhaseSchema,
    playerId: z.string(),
    /** Sanitized display name (plain text; never HTML). */
    displayName: z.string(),
    avatarPresetId: avatarPresetIdSchema,
    /** Host identity token — sent only to the creating WS, never broadcast. */
    hostToken: z.string().min(1),
    settings: roomSettingsSchema,
  }),
  z.object({
    type: z.literal("roomJoined"),
    roomId: z.string(),
    roomCode: z.string(),
    phase: roomPhaseSchema,
    playerCount: z.number().int().nonnegative(),
    playerId: z.string(),
    displayName: z.string(),
    avatarPresetId: avatarPresetIdSchema,
    settings: roomSettingsSchema,
  }),
  z.object({
    type: z.literal("lobbyRoster"),
    roomId: z.string(),
    players: z.array(lobbyRosterPlayerSchema),
  }),
  z.object({
    type: z.literal("matchStarting"),
    roomId: z.string(),
    phase: z.literal("matchStarting"),
  }),
  /**
   * Authoritative match phase transition (Epic 2.1+). `phaseDeadlineMs` is Unix ms when the current phase ends (optional if open-ended).
   */
  z.object({
    type: z.literal("matchPhase"),
    roomId: z.string(),
    phase: roomPhaseSchema,
    phaseDeadlineMs: z.number().optional(),
    /** Authoritative drawer for the active round (Story 2.2). */
    drawerPlayerId: z.string().optional(),
    matchRoundIndex: z.number().int().nonnegative().optional(),
  }),
  /**
   * Drawer-only: three distinct word options for the current round (Story 2.3).
   * Guessers must never receive this event.
   */
  z.object({
    type: z.literal("wordChoiceOffer"),
    roomId: z.string(),
    words: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
    matchRoundIndex: z.number().int().nonnegative(),
    phaseDeadlineMs: z.number(),
  }),
  /**
   * Periodic letter-reveal ticks during **`drawing`** (Story 2.5). Guessers derive UI only from
   * authoritative **`maskedWord`**; **`HINT_MASK_CHAR`** in **`@skribbl/shared`/hint-mask** documents the glyph.
   */
  z
    .object({
      type: z.literal("drawingHintTick"),
      roomId: z.string(),
      matchRoundIndex: z.number().int().nonnegative(),
      hintIndex: z.number().int().nonnegative(),
      maskedWord: z.string(),
      totalLetters: z.number().int().nonnegative(),
      revealedLetterCount: z.number().int().nonnegative(),
    })
    .refine((d) => d.revealedLetterCount <= d.totalLetters, {
      message: "revealedLetterCount must be <= totalLetters",
    }),
  /**
   * Drawer receives ack; all peers receive the same chunk with authoritative sequence (Story 3.4).
   * Drawer should ignore applies for `senderPlayerId === localPlayerId` because local ink is already rendered.
   */
  drawingStrokeCommittedWireSchema,
  /**
   * Authoritative non-stroke canvas op (clear / fill / eraser chunk). Shares the same monotonic `seq` as
   * `drawingStrokeCommitted` within the drawing phase (`room.drawingStrokeSeq`, Story 3.6).
   */
  drawingCanvasOpCommittedWireSchema,
  /** Player chat row (Epic 4, FR19). */
  z.object({
    type: z.literal("chatPlayerMessage"),
    roomId: z.string(),
    id: z.string(),
    ts: z.number().int().nonnegative(),
    senderPlayerId: z.string(),
    senderDisplayName: z.string(),
    text: z.string(),
  }),
  /** System chat row (e.g. drawer spoiler guard). */
  z.object({
    type: z.literal("chatSystemMessage"),
    roomId: z.string(),
    id: z.string(),
    ts: z.number().int().nonnegative(),
    text: z.string(),
  }),
  /**
   * Correct guess fan-out (FR23). `revealedWord` omitted for spoiler-safe recipients (FR21).
   */
  z.object({
    type: z.literal("chatCorrectGuess"),
    roomId: z.string(),
    id: z.string(),
    ts: z.number().int().nonnegative(),
    guesserPlayerId: z.string(),
    guesserDisplayName: z.string(),
    revealedWord: z.string().optional(),
    censoredAnnouncement: z.string(),
  }),
  /**
   * Private proximity hint to the submitting guesser only (Story 7.1 / FR24). Fixed spoiler-safe copy;
   * never includes the secret or numeric distance.
   */
  z.object({
    type: z.literal("chatCloseGuessHint"),
    roomId: z.string(),
    matchRoundIndex: z.number().int().nonnegative(),
    message: z.string().min(1).max(120),
    id: z.string(),
    ts: z.number().int().nonnegative(),
  }),
  /**
   * Targeted hydrate after reconnect (Story 5.2): empty **`canvasCommits`** whenever **`phase`** is not
   * **`drawing`** (no stale ink from prior rounds — baseline is effectively seq 0 + replay subset).
   * **`drawingStrokeSeq`** is the authoritative watermark for that phase.
   */
  z.object({
    type: z.literal("roomHydrate"),
    roomId: z.string(),
    phase: roomPhaseSchema,
    drawingStrokeSeq: z.number().int().nonnegative(),
    matchRoundIndex: z.number().int().nonnegative().optional(),
    drawerPlayerId: z.string().nullable().optional(),
    canvasCommits: z.array(canvasReplayEventWireSchema),
    chatTail: z.array(hydrateChatTailWireSchema),
  }),
  /**
   * Canvas op seq integrity lost or overflow exceeded — reset local canvas replay state and await a
   * fresh **`roomHydrate`** or phase transition rather than patching gaps silently (Story 5.2 / engine rules).
   */
  z.object({
    type: z.literal("canvasOpLogResync"),
    roomId: z.string(),
    code: z.string(),
    message: z.string().optional(),
  }),
  /** Broadcast to all room members when host changes lobby settings (Story 8.2). */
  z.object({
    type: z.literal("settingsUpdated"),
    roomId: z.string(),
    settings: roomSettingsSchema,
  }),
  /** Ephemeral relay while `phase === lobby` (Story 8.3); `message` is server-sanitized text. */
  z.object({
    type: z.literal("lobbyChatMessage"),
    playerId: z.string(),
    displayName: z.string(),
    message: z.string(),
    timestamp: z.number().int().nonnegative(),
  }),
  /** Lobby vote-kick window opened (Story 8.4). */
  z.object({
    type: z.literal("voteKickStarted"),
    roomId: z.string(),
    targetPlayerId: z.string(),
    initiatorPlayerId: z.string(),
    expiresAtMs: z.number(),
  }),
  /** Lobby vote-kick outcome (Story 8.4). Optional `reason` when `outcome === "failed"`. */
  z.object({
    type: z.literal("voteKickResolved"),
    outcome: z.enum(["kicked", "failed", "expired"]),
    reason: voteKickResolvedReasonSchema.optional(),
  }),
  /** Lobby roster departure fact; extend `reason` in later epics (Story 8.4 — `kicked`). */
  z.object({
    type: z.literal("playerLeft"),
    playerId: z.string(),
    reason: playerLeftReasonSchema,
  }),
]);

export type ClientCommand = z.infer<typeof clientCommandSchema>;
export type ServerEvent = z.infer<typeof serverEventSchema>;
export type ChatPlayerMessageEvent = Extract<ServerEvent, { type: "chatPlayerMessage" }>;
export type ChatSystemMessageEvent = Extract<ServerEvent, { type: "chatSystemMessage" }>;
export type ChatCorrectGuessEvent = Extract<ServerEvent, { type: "chatCorrectGuess" }>;
export type ChatCloseGuessHintEvent = Extract<ServerEvent, { type: "chatCloseGuessHint" }>;
export type DrawingStrokeCommitted = Extract<ServerEvent, { type: "drawingStrokeCommitted" }>;
export type DrawingHintTick = Extract<ServerEvent, { type: "drawingHintTick" }>;
export type DrawingCanvasOpCommitted = Extract<
  ServerEvent,
  { type: "drawingCanvasOpCommitted" }
>;
/** Ordered replay stream for the canvas (strokes + destructive ops share `seq`, Story 3.6). */
export type CanvasReplayEvent = DrawingStrokeCommitted | DrawingCanvasOpCommitted;
export type RoomHydrateEvent = Extract<ServerEvent, { type: "roomHydrate" }>;
export type CanvasOpLogResyncEvent = Extract<ServerEvent, { type: "canvasOpLogResync" }>;
export type SettingsUpdatedEvent = Extract<ServerEvent, { type: "settingsUpdated" }>;
export type LobbyChatMessageEvent = Extract<ServerEvent, { type: "lobbyChatMessage" }>;
export type UpdateSettings = Extract<ClientCommand, { type: "updateSettings" }>;
export type LobbyChatCommand = Extract<ClientCommand, { type: "lobbyChat" }>;
export type InitiateVoteKickCommand = Extract<ClientCommand, { type: "initiateVoteKick" }>;
export type CastVoteKickCommand = Extract<ClientCommand, { type: "castVoteKick" }>;
export type VoteKickStartedEvent = Extract<ServerEvent, { type: "voteKickStarted" }>;
export type VoteKickResolvedEvent = Extract<ServerEvent, { type: "voteKickResolved" }>;
export type PlayerLeftEvent = Extract<ServerEvent, { type: "playerLeft" }>;

export function safeParseClientCommand(data: unknown) {
  return clientCommandSchema.safeParse(data);
}

export function safeParseServerEvent(data: unknown) {
  return serverEventSchema.safeParse(data);
}

export function parseClientCommand(data: unknown): ClientCommand {
  return clientCommandSchema.parse(data);
}

export function parseServerEvent(data: unknown): ServerEvent {
  return serverEventSchema.parse(data);
}

/** Serialize a server event for WebSocket delivery (validates before send). */
export function serializeServerEvent(event: ServerEvent): string {
  return JSON.stringify(serverEventSchema.parse(event));
}

/** Serialize a client command for WebSocket delivery (validates before send). */
export function serializeClientCommand(cmd: ClientCommand): string {
  return JSON.stringify(clientCommandSchema.parse(cmd));
}
