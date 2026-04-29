import { randomBytes, randomUUID } from "node:crypto";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCodeForJoin,
  normalizeRoomCode,
  serializeServerEvent,
  type LobbyRosterPlayer,
  type ServerEvent,
} from "@skribbl/shared";
import type { WebSocket } from "ws";
import {
  resolveInterRoundGapMs,
  resolveMaxPlayers,
  resolveMatchStartHandshakeMs,
  resolveRoundMs,
  resolveRoundsPerMatch,
  resolveWordChoiceMs,
} from "../config/game.js";
import type { LobbySessionIdentity } from "./lobby-session.js";
import { Room } from "./room.js";

export {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCodeForJoin,
  normalizeRoomCode,
};

export type JoinRoomFailureReason =
  | "UNKNOWN_ROOM"
  | "ROOM_FULL"
  | "JOIN_NOT_ALLOWED";

export type ReconnectHostFailureReason =
  | "UNKNOWN_ROOM"
  | "JOIN_NOT_ALLOWED"
  | "NOT_HOST"
  | "ROOM_FULL"
  | "ALREADY_CONNECTED";

export type NewLobbyPlayer = Pick<
  LobbySessionIdentity,
  "displayName" | "avatarPresetId"
>;

export class RoomManager {
  private readonly roomsByCode = new Map<string, Room>();
  private readonly roomsById = new Map<string, Room>();
  private readonly socketToRoomId = new Map<WebSocket, string>();
  private readonly socketLobbyIdentity = new Map<WebSocket, LobbySessionIdentity>();
  /** Cleared when a room is destroyed or match chain reschedules. */
  private readonly matchTimersByRoomId = new Map<string, ReturnType<typeof setTimeout>[]>();

  readonly maxPlayersPerRoom: number;

  constructor(maxPlayersPerRoom?: number) {
    this.maxPlayersPerRoom = maxPlayersPerRoom ?? resolveMaxPlayers();
  }

  /** Sorted by `playerId` (deterministic roster order — Story 1.6). */
  buildLobbyRosterPlayers(room: Room): LobbyRosterPlayer[] {
    const rows: LobbyRosterPlayer[] = [];
    for (const ws of room.sockets) {
      const identity = this.socketLobbyIdentity.get(ws);
      if (!identity) continue;
      rows.push({
        playerId: identity.playerId,
        displayName: identity.displayName,
        avatarPresetId: identity.avatarPresetId,
        isHost: room.hostSocket === ws,
      });
    }
    rows.sort((a, b) => a.playerId.localeCompare(b.playerId));
    return rows;
  }

  private sendEvent(ws: WebSocket, event: ServerEvent): void {
    try {
      ws.send(serializeServerEvent(event));
    } catch {
      this.leaveSocketRoom(ws);
    }
  }

  private clearMatchTimers(roomId: string): void {
    const pending = this.matchTimersByRoomId.get(roomId);
    if (!pending) return;
    for (const t of pending) clearTimeout(t);
    this.matchTimersByRoomId.delete(roomId);
  }

  private broadcastMatchPhase(
    room: Room,
    phaseDeadlineMs: number | undefined,
    drawerPlayerId: string,
    matchRoundIndex: number,
  ): void {
    const payload: ServerEvent =
      phaseDeadlineMs === undefined
        ? {
            type: "matchPhase",
            roomId: room.id,
            phase: room.phase,
            drawerPlayerId,
            matchRoundIndex,
          }
        : {
            type: "matchPhase",
            roomId: room.id,
            phase: room.phase,
            phaseDeadlineMs,
            drawerPlayerId,
            matchRoundIndex,
          };
    for (const sock of room.sockets) this.sendEvent(sock, payload);
  }

  /**
   * Epic 2.1+2.2: server timers, round-robin drawer (`matchPlayerOrder`) per round.
   */
  private scheduleMatchFlow(room: Room): void {
    this.clearMatchTimers(room.id);
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    this.matchTimersByRoomId.set(room.id, timeouts);

    const roster = this.buildLobbyRosterPlayers(room);
    room.matchPlayerOrder = roster.map((p) => p.playerId);
    room.matchRoundIndex = 0;

    const schedule = (ms: number, fn: () => void) => {
      timeouts.push(setTimeout(fn, ms));
    };

    const runRound = (roundIndex: number, leadMs: number, gatePhase: "matchStarting" | "roundResult") => {
      const order = room.matchPlayerOrder;
      if (!order || order.length === 0) return;

      schedule(leadMs, () => {
        if (!this.roomsById.get(room.id)) return;
        if (room.phase !== gatePhase) return;

        const drawerId = order[roundIndex % order.length]!;
        room.currentDrawerPlayerId = drawerId;
        room.matchRoundIndex = roundIndex;

        room.phase = "choosingWord";
        this.broadcastMatchPhase(
          room,
          Date.now() + resolveWordChoiceMs(),
          drawerId,
          roundIndex,
        );
        schedule(resolveWordChoiceMs(), () => {
          if (!this.roomsById.get(room.id) || room.phase !== "choosingWord") return;
          room.phase = "drawing";
          this.broadcastMatchPhase(
            room,
            Date.now() + resolveRoundMs(),
            drawerId,
            roundIndex,
          );
          schedule(resolveRoundMs(), () => {
            if (!this.roomsById.get(room.id) || room.phase !== "drawing") return;
            room.phase = "roundResult";
            this.broadcastMatchPhase(room, undefined, drawerId, roundIndex);
            if (roundIndex + 1 < resolveRoundsPerMatch()) {
              schedule(resolveInterRoundGapMs(), () =>
                runRound(roundIndex + 1, 0, "roundResult"),
              );
            }
          });
        });
      });
    };

    runRound(0, resolveMatchStartHandshakeMs(), "matchStarting");
  }

  broadcastLobbyRoster(room: Room): void {
    const payload: ServerEvent = {
      type: "lobbyRoster",
      roomId: room.id,
      players: this.buildLobbyRosterPlayers(room),
    };
    for (const sock of room.sockets) this.sendEvent(sock, payload);
  }

  /** Host-only authoritative start (Story 1.6). Transitions phase to `matchStarting`. */
  startMatch(actor: WebSocket): { ok: true } | { ok: false; code: string } {
    const room = this.getRoomForSocket(actor);
    if (!room) return { ok: false, code: "INTERNAL" };
    if (room.hostSocket !== actor) return { ok: false, code: "NOT_HOST" };
    if (room.phase !== "lobby") return { ok: false, code: "WRONG_PHASE" };
    if (room.playerCount < 2) return { ok: false, code: "NOT_ENOUGH_PLAYERS" };

    room.phase = "matchStarting";
    const payload: ServerEvent = {
      type: "matchStarting",
      roomId: room.id,
      phase: "matchStarting",
    };
    for (const sock of room.sockets) this.sendEvent(sock, payload);
    this.scheduleMatchFlow(room);
    return { ok: true };
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
      const survivors = room.sockets.size;
      if (survivors === 0) {
        this.clearMatchTimers(room.id);
        this.roomsByCode.delete(room.code);
        this.roomsById.delete(room.id);
      } else {
        this.broadcastLobbyRoster(room);
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
      hostPlayerId: playerId,
    });
    room.sockets.add(ws);
    room.hostSocket = ws;
    this.roomsByCode.set(code, room);
    this.roomsById.set(room.id, room);
    this.socketToRoomId.set(ws, room.id);
    return room;
  }

  reconnectHost(
    ws: WebSocket,
    roomId: string,
    expectedPlayerId: string,
    player: NewLobbyPlayer,
  ): { ok: true; room: Room } | { ok: false; reason: ReconnectHostFailureReason } {
    const room = this.roomsById.get(roomId);
    if (!room) return { ok: false, reason: "UNKNOWN_ROOM" };
    if (room.phase !== "lobby") return { ok: false, reason: "JOIN_NOT_ALLOWED" };
    if (room.hostPlayerId !== expectedPlayerId) return { ok: false, reason: "NOT_HOST" };

    for (const s of room.sockets) {
      const id = this.socketLobbyIdentity.get(s);
      if (id?.playerId === expectedPlayerId) return { ok: false, reason: "ALREADY_CONNECTED" };
    }

    if (!room.hasCapacity()) return { ok: false, reason: "ROOM_FULL" };

    this.leaveSocketRoom(ws);

    this.socketLobbyIdentity.set(ws, {
      playerId: expectedPlayerId,
      displayName: player.displayName,
      avatarPresetId: player.avatarPresetId,
    });
    room.sockets.add(ws);
    room.hostSocket = ws;
    this.socketToRoomId.set(ws, room.id);
    return { ok: true, room };
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

    if (room.phase !== "lobby") {
      return { ok: false, reason: "JOIN_NOT_ALLOWED" };
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
