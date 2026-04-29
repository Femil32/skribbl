import { randomBytes, randomUUID } from "node:crypto";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCodeForJoin,
  normalizeRoomCode,
} from "@skribbl/shared";
import type { WebSocket } from "ws";
import { resolveMaxPlayers } from "../config/game.js";
import type { LobbySessionIdentity } from "./lobby-session.js";
import { Room } from "./room.js";

export {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCodeForJoin,
  normalizeRoomCode,
};

export type JoinRoomFailureReason = "UNKNOWN_ROOM" | "ROOM_FULL";

export type NewLobbyPlayer = Pick<
  LobbySessionIdentity,
  "displayName" | "avatarPresetId"
>;

export class RoomManager {
  private readonly roomsByCode = new Map<string, Room>();
  private readonly roomsById = new Map<string, Room>();
  private readonly socketToRoomId = new Map<WebSocket, string>();
  private readonly socketLobbyIdentity = new Map<WebSocket, LobbySessionIdentity>();

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
    if (!roomId) {
      this.socketLobbyIdentity.delete(ws);
      return;
    }
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
    this.socketLobbyIdentity.delete(ws);
  }

  getLobbySession(ws: WebSocket): LobbySessionIdentity | undefined {
    return this.socketLobbyIdentity.get(ws);
  }

  createRoom(ws: WebSocket, player: NewLobbyPlayer): Room {
    this.leaveSocketRoom(ws);
    const playerId = randomUUID();
    this.socketLobbyIdentity.set(ws, {
      playerId,
      displayName: player.displayName,
      avatarPresetId: player.avatarPresetId,
    });
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
    player: NewLobbyPlayer,
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
    const playerId = randomUUID();
    this.socketLobbyIdentity.set(ws, {
      playerId,
      displayName: player.displayName,
      avatarPresetId: player.avatarPresetId,
    });
    room.sockets.add(ws);
    this.socketToRoomId.set(ws, room.id);
    return { ok: true, room };
  }

  getRoomForSocket(ws: WebSocket): Room | undefined {
    const id = this.socketToRoomId.get(ws);
    return id ? this.roomsById.get(id) : undefined;
  }
}
