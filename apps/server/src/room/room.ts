import type { WebSocket } from "ws";
import type { RoomPhase } from "@skribbl/shared";

/**
 * In-memory room aggregate (Story 1.2 skeleton): code, capacity, lobby phase.
 */
export class Room {
  readonly id: string;
  readonly code: string;
  /** Canonical host player id from the first `roomCreated` (Story 1.7 reconnect). */
  readonly hostPlayerId: string;
  phase: RoomPhase = "lobby";
  /** Deterministic player ids for round-robin (Story 2.2); set when the match flow starts. */
  matchPlayerOrder: string[] | null = null;
  /** Zero-based round counter while in match. */
  matchRoundIndex = 0;
  currentDrawerPlayerId: string | null = null;
  /** Non-null only while phase is choosingWord and before drawing. */
  roundWordOptions: [string, string, string] | null = null;
  /** Locked word for adjudication / hints in later stories; set when leaving word choice. */
  roundSecretWord: string | null = null;
  /** Cleared when choice resolves or on room teardown (Story 2.3). */
  wordChoiceTimerHandle: ReturnType<typeof setTimeout> | null = null;

  readonly sockets = new Set<WebSocket>();
  hostSocket: WebSocket | null = null;
  readonly maxPlayers: number;

  constructor(opts: { id: string; code: string; maxPlayers: number; hostPlayerId: string }) {
    this.id = opts.id;
    this.code = opts.code;
    this.maxPlayers = opts.maxPlayers;
    this.hostPlayerId = opts.hostPlayerId;
  }

  get playerCount(): number {
    return this.sockets.size;
  }

  hasCapacity(): boolean {
    return this.sockets.size < this.maxPlayers;
  }
}
