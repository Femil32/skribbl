import { randomBytes, randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { resolveMaxPlayers } from "../config/game.js";
import { Room } from "./room.js";

/**
 * Canonical room codes after normalization: uppercase; length matches generated codes.
 * Alphabet excludes ambiguous 0/O, 1/I/L — generation uses only these chars so joins match server codes.
 */
export const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const ROOM_CODE_LENGTH = 6;

/** Strip whitespace and non-alphanumeric, uppercase (paste-friendly). */
export function normalizeRoomCode(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** Join payloads must normalize to this shape (same charset/length as generated codes). */
export function isValidRoomCodeForJoin(normalized: string): boolean {
  if (normalized.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of normalized) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

export type JoinRoomFailureReason = "UNKNOWN_ROOM" | "ROOM_FULL";

export class RoomManager {
  private readonly roomsByCode = new Map<string, Room>();
  private readonly roomsById = new Map<string, Room>();
  private readonly socketToRoomId = new Map<WebSocket, string>();

  readonly maxPlayersPerRoom: number;

  constructor(maxPlayersPerRoom?: number) {
    this.maxPlayersPerRoom = maxPlayersPerRoom ?? resolveMaxPlayers();
  }

  /** Unique non-guessable code using crypto-grade randomness + collision retry. */
  private generateUniqueCode(): string {
    const alphabet = ROOM_CODE_ALPHABET;
    const len = ROOM_CODE_LENGTH;
    const maxAttempts = 256;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const bytes = randomBytes(len);
      let code = "";
      for (let i = 0; i < len; i++) {
        code += alphabet[bytes[i]! % alphabet.length]!;
      }
      if (!this.roomsByCode.has(code)) return code;
    }
    throw new Error("ROOM_CODE_COLLISION_RETRY_EXHAUSTED");
  }

  leaveSocketRoom(ws: WebSocket): void {
    const roomId = this.socketToRoomId.get(ws);
    if (!roomId) return;
    const room = this.roomsById.get(roomId);
    if (room) {
      room.sockets.delete(ws);
      if (room.hostSocket === ws) {
        const next = room.sockets.values().next().value as WebSocket | undefined;
        room.hostSocket = next ?? null;
      }
      if (room.sockets.size === 0) {
        this.roomsByCode.delete(room.code);
        this.roomsById.delete(room.id);
      }
    }
    this.socketToRoomId.delete(ws);
  }

  createRoom(ws: WebSocket): Room {
    this.leaveSocketRoom(ws);
    const code = this.generateUniqueCode();
    const room = new Room({
      id: randomUUID(),
      code,
      maxPlayers: this.maxPlayersPerRoom,
    });
    room.sockets.add(ws);
    room.hostSocket = ws;
    this.roomsByCode.set(code, room);
    this.roomsById.set(room.id, room);
    this.socketToRoomId.set(ws, room.id);
    return room;
  }

  joinRoom(
    ws: WebSocket,
    normalizedCode: string,
  ):
    | { ok: true; room: Room }
    | { ok: false; reason: JoinRoomFailureReason } {
    const room = this.roomsByCode.get(normalizedCode);
    if (!room) return { ok: false, reason: "UNKNOWN_ROOM" };

    const current = this.getRoomForSocket(ws);
    if (current?.id === room.id) {
      return { ok: true, room };
    }

    if (!room.hasCapacity()) return { ok: false, reason: "ROOM_FULL" };

    this.leaveSocketRoom(ws);
    room.sockets.add(ws);
    this.socketToRoomId.set(ws, room.id);
    return { ok: true, room };
  }

  getRoomForSocket(ws: WebSocket): Room | undefined {
    const id = this.socketToRoomId.get(ws);
    return id ? this.roomsById.get(id) : undefined;
  }
}
