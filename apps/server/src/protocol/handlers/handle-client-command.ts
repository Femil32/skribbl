import type { WebSocket } from "ws";
import {
  isValidRoomCodeForJoin,
  normalizeRoomCode,
  serializeServerEvent,
  type ClientCommand,
  type ServerEvent,
} from "@skribbl/shared";
import type { RoomManager } from "../../room/room-manager.js";

function sendServerEvent(
  ws: WebSocket,
  event: ServerEvent,
  roomManager: RoomManager,
): void {
  try {
    ws.send(serializeServerEvent(event));
  } catch {
    roomManager.leaveSocketRoom(ws);
  }
}

export function sendProtocolError(
  ws: WebSocket,
  code: string,
  message?: string,
  roomManager?: RoomManager,
): void {
  try {
    ws.send(
      serializeServerEvent({
        type: "error",
        code,
        message,
      }),
    );
  } catch {
    roomManager?.leaveSocketRoom(ws);
  }
}

export function handleClientCommand(
  ws: WebSocket,
  cmd: ClientCommand,
  roomManager: RoomManager,
): void {
  switch (cmd.type) {
    case "ping":
      sendServerEvent(
        ws,
        {
          type: "pong",
          ts: Date.now(),
        },
        roomManager,
      );
      return;
    case "noop":
      return;
    case "createRoom": {
      const room = roomManager.createRoom(ws);
      sendServerEvent(
        ws,
        {
          type: "roomCreated",
          roomId: room.id,
          roomCode: room.code,
          phase: "lobby",
        },
        roomManager,
      );
      return;
    }
    case "joinRoom": {
      const normalized = normalizeRoomCode(cmd.roomCode);
      if (!isValidRoomCodeForJoin(normalized)) {
        sendProtocolError(ws, "BAD_CODE", "Invalid room code", roomManager);
        return;
      }
      const outcome = roomManager.joinRoom(ws, normalized);
      if (!outcome.ok) {
        sendProtocolError(
          ws,
          outcome.reason,
          outcome.reason === "UNKNOWN_ROOM"
            ? "Room not found"
            : "Room is full",
          roomManager,
        );
        return;
      }
      const { room } = outcome;
      sendServerEvent(
        ws,
        {
          type: "roomJoined",
          roomId: room.id,
          roomCode: room.code,
          phase: "lobby",
          playerCount: room.playerCount,
        },
        roomManager,
      );
      return;
    }
    default: {
      const _exhaustive: never = cmd;
      return _exhaustive;
    }
  }
}
