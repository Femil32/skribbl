import type { WebSocket } from "ws";
import type { RoomPhase } from "@skribbl/shared";

/**
 * In-memory room aggregate (Story 1.2 skeleton): code, capacity, lobby phase.
 */
export class Room {
  readonly id: string;
  readonly code: string;
  phase: RoomPhase = "lobby";
  readonly sockets = new Set<WebSocket>();
  hostSocket: WebSocket | null = null;
  readonly maxPlayers: number;

  constructor(opts: { id: string; code: string; maxPlayers: number }) {
    this.id = opts.id;
    this.code = opts.code;
    this.maxPlayers = opts.maxPlayers;
  }

  get playerCount(): number {
    return this.sockets.size;
  }

  hasCapacity(): boolean {
    return this.sockets.size < this.maxPlayers;
  }
}
