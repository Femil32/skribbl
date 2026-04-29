import type { WebSocket } from "ws";
import type { AvatarPresetId } from "@skribbl/shared";
import {
  DEFAULT_AVATAR_PRESET_ID,
  NICKNAME_MAX_GRAPHEMES,
  countGraphemes,
  isValidAvatarPresetId,
  isValidRoomCodeForJoin,
  normalizeRoomCode,
  sanitizeDisplayName,
  serializeServerEvent,
  type ClientCommand,
  type ServerEvent,
} from "@skribbl/shared";
import type { RoomManager } from "../../room/room-manager.js";

function parseLobbyPlayer(cmd: {
  displayName: string;
  avatarPresetId?: string;
}):
  | { ok: true; displayName: string; avatarPresetId: AvatarPresetId }
  | { ok: false; code: string } {
  const trimmed = cmd.displayName.trim();
  if (trimmed === "") return { ok: false, code: "BAD_NICKNAME" };

  const sanitized = sanitizeDisplayName(trimmed);
  if (sanitized === "") return { ok: false, code: "BAD_NICKNAME" };

  if (countGraphemes(sanitized) > NICKNAME_MAX_GRAPHEMES) {
    return { ok: false, code: "NICKNAME_TOO_LONG" };
  }

  const presetRaw = cmd.avatarPresetId ?? DEFAULT_AVATAR_PRESET_ID;
  if (!isValidAvatarPresetId(presetRaw)) {
    return { ok: false, code: "INVALID_AVATAR" };
  }
  return {
    ok: true,
    displayName: sanitized,
    avatarPresetId: presetRaw,
  };
}

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
      const identity = parseLobbyPlayer(cmd);
      if (!identity.ok) {
        sendProtocolError(
          ws,
          identity.code,
          identity.code === "BAD_NICKNAME"
            ? "Pick a short display name."
            : identity.code === "NICKNAME_TOO_LONG"
              ? "That name is too long."
              : "Pick one of the avatar options.",
          roomManager,
        );
        return;
      }
      const room = roomManager.createRoom(ws, identity);
      const session = roomManager.getLobbySession(ws);
      if (!session) {
        sendProtocolError(ws, "INTERNAL", "Could not create session", roomManager);
        return;
      }
      sendServerEvent(
        ws,
        {
          type: "roomCreated",
          roomId: room.id,
          roomCode: room.code,
          phase: "lobby",
          playerId: session.playerId,
          displayName: session.displayName,
          avatarPresetId: session.avatarPresetId,
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
      const identity = parseLobbyPlayer(cmd);
      if (!identity.ok) {
        sendProtocolError(
          ws,
          identity.code,
          identity.code === "BAD_NICKNAME"
            ? "Pick a short display name."
            : identity.code === "NICKNAME_TOO_LONG"
              ? "That name is too long."
              : "Pick one of the avatar options.",
          roomManager,
        );
        return;
      }
      const outcome = roomManager.joinRoom(ws, normalized, identity);
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
      const session = roomManager.getLobbySession(ws);
      if (!session) {
        sendProtocolError(ws, "INTERNAL", "Could not create session", roomManager);
        return;
      }
      sendServerEvent(
        ws,
        {
          type: "roomJoined",
          roomId: room.id,
          roomCode: room.code,
          phase: "lobby",
          playerCount: room.playerCount,
          playerId: session.playerId,
          displayName: session.displayName,
          avatarPresetId: session.avatarPresetId,
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
