/**
 * Wire protocol (Skribbl) — single source of truth for JSON shapes.
 *
 * All client↔server commands and events accrete here as Zod schemas + inferred types.
 * Do not duplicate command enums or message structs in apps/web or apps/server.
 *
 * Discriminant field on the wire: `type` (stable for demux in server handlers and client).
 */

import { z } from "zod";
import { avatarPresetIdSchema } from "./player-identity.js";

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

export const lobbyRosterPlayerSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  avatarPresetId: avatarPresetIdSchema,
  isHost: z.boolean(),
  /** Running total for the match (FR10); omitted on wire is treated as 0 in parsers. */
  score: z.number().int().nonnegative().default(0),
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
  }),
  /** Join an existing room by code (server normalizes casing / whitespace). */
  z.object({
    type: z.literal("joinRoom"),
    roomCode: z.string(),
    displayName: z.string(),
    avatarPresetId: avatarPresetIdSchema.optional(),
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
]);

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
   * Drawer receives ack; all peers receive the same chunk with authoritative sequence (Story 3.4).
   * Drawer should ignore applies for `senderPlayerId === localPlayerId` because local ink is already rendered.
   */
  z.object({
    type: z.literal("drawingStrokeCommitted"),
    roomId: z.string(),
    seq: z.number().int().nonnegative(),
    senderPlayerId: z.string(),
    strokeId: z.string(),
    chunkId: z.string(),
    points: z.array(drawingStrokePointSchema).min(1).max(256),
    color: z.string(),
    lineWidthPx: z.number(),
  }),
  /**
   * Authoritative non-stroke canvas op (clear / fill / eraser chunk). Shares the same monotonic `seq` as
   * `drawingStrokeCommitted` within the drawing phase (`room.drawingStrokeSeq`, Story 3.6).
   */
  z.object({
    type: z.literal("drawingCanvasOpCommitted"),
    roomId: z.string(),
    seq: z.number().int().nonnegative(),
    senderPlayerId: z.string(),
    op: drawingCanvasOpPayloadSchema,
  }),
]);

export type ClientCommand = z.infer<typeof clientCommandSchema>;
export type ServerEvent = z.infer<typeof serverEventSchema>;
export type DrawingStrokeCommitted = Extract<ServerEvent, { type: "drawingStrokeCommitted" }>;
export type DrawingCanvasOpCommitted = Extract<
  ServerEvent,
  { type: "drawingCanvasOpCommitted" }
>;
/** Ordered replay stream for the canvas (strokes + destructive ops share `seq`, Story 3.6). */
export type CanvasReplayEvent = DrawingStrokeCommitted | DrawingCanvasOpCommitted;

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
