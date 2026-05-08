import type { RoomPhase } from "@skribbl/shared";
import type { ChatTranscriptFanoutRow } from "../../room/chat-transcript.js";

export const ROOM_TTL_IDLE_S = 1800; // 30 min idle
export const ROOM_TTL_ACTIVE_S = 7200; // 2h active

export function roomKey(code: string): string {
  return `room:${code}`;
}

export function roomByIdKey(id: string): string {
  return `room-by-id:${id}`;
}

export interface PersistedRoomFields {
  id: string;
  code: string;
  hostPlayerId: string;
  phase: RoomPhase;
  maxPlayers: number;
  matchPlayerOrder: string[] | null;
  matchRoundIndex: number;
  currentDrawerPlayerId: string | null;
  roundWordOptions: [string, string, string] | null;
  roundSecretWord: string | null;
  drawingStrokeSeq: number;
  chatTranscriptFanoutRows: ChatTranscriptFanoutRow[];
  drawingPhaseStartedAtMs: number | null;
  drawingPhaseAwardedGuesserIds: Set<string> | null;
  scoresByPlayerId: Record<string, number>;
}

export function serializeRoom(r: PersistedRoomFields): Record<string, string> {
  return {
    id: r.id,
    code: r.code,
    hostPlayerId: r.hostPlayerId,
    phase: r.phase,
    maxPlayers: String(r.maxPlayers),
    matchPlayerOrder: r.matchPlayerOrder !== null ? JSON.stringify(r.matchPlayerOrder) : "",
    matchRoundIndex: String(r.matchRoundIndex),
    currentDrawerPlayerId: r.currentDrawerPlayerId ?? "",
    roundWordOptions: r.roundWordOptions !== null ? JSON.stringify(r.roundWordOptions) : "",
    roundSecretWord: r.roundSecretWord ?? "",
    drawingStrokeSeq: String(r.drawingStrokeSeq),
    chatTranscriptFanoutRows: JSON.stringify(r.chatTranscriptFanoutRows),
    drawingPhaseStartedAtMs:
      r.drawingPhaseStartedAtMs !== null ? String(r.drawingPhaseStartedAtMs) : "",
    drawingPhaseAwardedGuesserIds:
      r.drawingPhaseAwardedGuesserIds !== null
        ? JSON.stringify([...r.drawingPhaseAwardedGuesserIds])
        : "",
    scoresByPlayerId: JSON.stringify(r.scoresByPlayerId),
  };
}

// P-7: runtime guard so corrupt Redis data fails loudly, not silently
const VALID_ROOM_PHASES: ReadonlySet<string> = new Set<RoomPhase>([
  "lobby",
  "matchStarting",
  "choosingWord",
  "drawing",
  "roundResult",
  "matchEnded",
]);

function parseRoomPhase(value: string | undefined): RoomPhase {
  if (!value || !VALID_ROOM_PHASES.has(value)) {
    throw new Error(`Invalid RoomPhase stored in Redis: "${value}"`);
  }
  return value as RoomPhase;
}

// P-6: wrap all JSON.parse calls so corrupt Redis data throws a clear error
export function deserializeRoom(h: Record<string, string>): PersistedRoomFields {
  try {
    return {
      id: h["id"]!,
      code: h["code"]!,
      hostPlayerId: h["hostPlayerId"]!,
      phase: parseRoomPhase(h["phase"]),
      maxPlayers: Number(h["maxPlayers"]),
      matchPlayerOrder: h["matchPlayerOrder"] ? JSON.parse(h["matchPlayerOrder"]) : null,
      matchRoundIndex: Number(h["matchRoundIndex"] ?? "0"),
      currentDrawerPlayerId: h["currentDrawerPlayerId"] || null,
      roundWordOptions: h["roundWordOptions"] ? JSON.parse(h["roundWordOptions"]) : null,
      roundSecretWord: h["roundSecretWord"] || null,
      drawingStrokeSeq: Number(h["drawingStrokeSeq"] ?? "0"),
      chatTranscriptFanoutRows: h["chatTranscriptFanoutRows"]
        ? JSON.parse(h["chatTranscriptFanoutRows"])
        : [],
      drawingPhaseStartedAtMs: h["drawingPhaseStartedAtMs"]
        ? Number(h["drawingPhaseStartedAtMs"])
        : null,
      drawingPhaseAwardedGuesserIds: h["drawingPhaseAwardedGuesserIds"]
        ? new Set(JSON.parse(h["drawingPhaseAwardedGuesserIds"]))
        : null,
      scoresByPlayerId: h["scoresByPlayerId"] ? JSON.parse(h["scoresByPlayerId"]) : {},
    };
  } catch (err) {
    throw new Error(
      `Failed to deserialize room from Redis: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
