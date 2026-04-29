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

export const lobbyRosterPlayerSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  avatarPresetId: avatarPresetIdSchema,
  isHost: z.boolean(),
});

export type LobbyRosterPlayer = z.infer<typeof lobbyRosterPlayerSchema>;

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
]);

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
  }),
]);

export type ClientCommand = z.infer<typeof clientCommandSchema>;
export type ServerEvent = z.infer<typeof serverEventSchema>;

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
