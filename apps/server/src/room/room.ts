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

  /**
   * Monotonic **canvas** sequence within the current drawing phase (Epic 3): stroke batches and
   * canvas ops (`drawingCanvasOpCommitted`) share this counter (Story 3.4 + 3.6). Reset when entering `drawing`.
   * (Field name `drawingStrokeSeq` is historical — treats strokes as the first canvas op type.)
   */
  drawingStrokeSeq = 0;

  /**
   * Monotonic/session clock ms when {@link phase} transitioned to `drawing` (Story 2.6).
   * Cleared when leaving `drawing` (timer-driven `roundResult` or future early guess).
   */
  drawingPhaseStartedAtMs: number | null = null;

  /**
   * Guessers already credited this drawing phase (Story 2.6).
   * Cleared when entering and when leaving `drawing`; prevents duplicate awards for the same guesser id.
   */
  drawingPhaseAwardedGuesserIds: Set<string> | null = null;

  /** Match session totals keyed by stable `playerId` (Story 2.6). Cleared/`startMatch`. */
  scoresByPlayerId: Record<string, number> = {};

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
