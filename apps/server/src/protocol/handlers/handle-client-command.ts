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

function chatMessageErrorDetail(code: string): string {
  switch (code) {
    case "BAD_ROOM":
      return "That room doesn't match your connection.";
    case "CHAT_EMPTY":
      return "Message was empty after cleanup.";
    case "CHAT_TOO_LONG":
      return "Message is too long.";
    case "WRONG_PHASE":
      return "That action isn't available in this phase.";
    case "GUESSER_IS_DRAWER":
      return "The drawer can't score as a guesser.";
    case "UNKNOWN_ROOM":
      return "That room no longer exists.";
    case "NO_DRAWER":
      return "There is no active drawer for this round.";
    case "NOT_IN_MATCH":
      return "You are not in this match.";
    case "NO_DRAWING_START":
      return "Drawing has not started yet.";
    case "INTERNAL":
      return "Something went wrong. Try again.";
    default:
      return "Message could not be sent.";
  }
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
          phase: room.phase,
          playerId: session.playerId,
          displayName: session.displayName,
          avatarPresetId: session.avatarPresetId,
        },
        roomManager,
      );
      roomManager.broadcastLobbyRoster(room);
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
            : outcome.reason === "JOIN_NOT_ALLOWED"
              ? "Game already started"
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
          phase: room.phase,
          playerCount: room.playerCount,
          playerId: session.playerId,
          displayName: session.displayName,
          avatarPresetId: session.avatarPresetId,
        },
        roomManager,
      );
      roomManager.broadcastLobbyRoster(room);
      return;
    }
    case "reconnectHost": {
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
      const outcome = roomManager.reconnectHost(ws, cmd.roomId, cmd.playerId, identity);
      if (!outcome.ok) {
        const errorCode =
          outcome.reason === "UNKNOWN_ROOM"
            ? "HOST_SESSION_LOST"
            : outcome.reason === "NOT_HOST"
              ? "HOST_RECLAIM_DENIED"
              : outcome.reason;
        sendProtocolError(
          ws,
          errorCode,
          outcome.reason === "UNKNOWN_ROOM"
            ? "This lobby is no longer on the server. Create a new room."
            : outcome.reason === "JOIN_NOT_ALLOWED"
              ? "Game already started"
              : outcome.reason === "NOT_HOST"
                ? "Could not reclaim the host session. Create a new room."
                : outcome.reason === "ROOM_FULL"
                  ? "Room is full"
                  : "This host session is already connected.",
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
          type: "roomCreated",
          roomId: room.id,
          roomCode: room.code,
          phase: room.phase,
          playerId: session.playerId,
          displayName: session.displayName,
          avatarPresetId: session.avatarPresetId,
        },
        roomManager,
      );
      roomManager.sendRoomHydrate(ws, room, session.playerId);
      roomManager.broadcastLobbyRoster(room);
      return;
    }
    case "reconnectPlayer": {
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
      const outcome = roomManager.reconnectPlayer(ws, cmd.roomId, cmd.playerId, identity);
      if (!outcome.ok) {
        const errorCode =
          outcome.reason === "UNKNOWN_ROOM"
            ? "HOST_SESSION_LOST"
            : outcome.reason === "HOST_USE_RECONNECT_HOST"
              ? "HOST_USE_RECONNECT_HOST"
              : outcome.reason === "NO_STASHED_SESSION"
                ? "NO_STASHED_SESSION"
                : outcome.reason;
        sendProtocolError(
          ws,
          errorCode,
          outcome.reason === "UNKNOWN_ROOM"
            ? "That room is no longer available."
            : outcome.reason === "HOST_USE_RECONNECT_HOST"
              ? "Use the host reconnect flow for your host session."
              : outcome.reason === "NO_STASHED_SESSION"
                ? "Reconnect window expired — this seat is no longer resumable."
                : outcome.reason === "ROOM_FULL"
                  ? "Room is full"
                  : "You are already connected in another tab.",
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
          phase: room.phase,
          playerCount: room.playerCount,
          playerId: session.playerId,
          displayName: session.displayName,
          avatarPresetId: session.avatarPresetId,
        },
        roomManager,
      );
      roomManager.sendRoomHydrate(ws, room, session.playerId);
      roomManager.broadcastLobbyRoster(room);
      return;
    }
    case "startMatch": {
      const outcome = roomManager.startMatch(ws);
      if (!outcome.ok) {
        sendProtocolError(
          ws,
          outcome.code,
          outcome.code === "NOT_HOST"
            ? "Only the host can start"
            : outcome.code === "NOT_ENOUGH_PLAYERS"
              ? "Need at least two players"
              : outcome.code === "WRONG_PHASE"
                ? "Room is not in lobby"
                : "Unable to start",
          roomManager,
        );
      }
      return;
    }
    case "chooseWord": {
      const outcome = roomManager.chooseWord(ws, cmd.choiceIndex);
      if (!outcome.ok) {
        sendProtocolError(
          ws,
          outcome.code,
          outcome.code === "WRONG_PHASE"
            ? "Not choosing a word right now."
            : outcome.code === "NOT_DRAWER"
              ? "Only the drawer picks the word."
              : outcome.code === "BAD_CHOICE"
                ? "Pick one of the three words."
                : outcome.code === "ALREADY_CHOSE"
                  ? "Word already chosen for this round."
                  : outcome.code === "NO_WORD_OFFER"
                    ? "No word options available. Wait for the round to start."
                    : "Could not choose word.",
          roomManager,
        );
      }
      return;
    }
    case "returnToLobby": {
      const outcome = roomManager.returnToLobby(ws);
      if (!outcome.ok) {
        sendProtocolError(
          ws,
          outcome.code,
          outcome.code === "NOT_HOST"
            ? "Only the host can start a new match."
            : outcome.code === "WRONG_PHASE"
              ? "The room is not in the post-match screen right now."
              : "Could not return to the lobby.",
          roomManager,
        );
      }
      return;
    }
    case "drawingStrokeChunk": {
      const outcome = roomManager.applyDrawingStrokeChunk(ws, cmd);
      if (!outcome.ok) {
        sendProtocolError(
          ws,
          outcome.code,
          outcome.code === "NOT_DRAWER"
            ? "Only the drawer can send strokes right now."
            : outcome.code === "WRONG_PHASE"
              ? "Strokes only while the round is in the drawing phase."
              : outcome.code === "BAD_ROOM"
                ? "That room doesn't match your connection."
                : "Stroke could not be applied.",
          roomManager,
        );
      }
      return;
    }
    case "drawingCanvasClear":
    case "drawingCanvasFill":
    case "drawingEraserChunk": {
      const outcome = roomManager.applyDrawingCanvasCommand(ws, cmd);
      if (!outcome.ok) {
        sendProtocolError(
          ws,
          outcome.code,
          outcome.code === "NOT_DRAWER"
            ? "Only the drawer can use drawing tools right now."
            : outcome.code === "WRONG_PHASE"
              ? "Drawing tools only while the round is in the drawing phase."
              : outcome.code === "BAD_ROOM"
                ? "That room doesn't match your connection."
                : "Canvas command could not be applied.",
          roomManager,
        );
      }
      return;
    }
    case "chatMessage": {
      const outcome = roomManager.applyChatMessage(ws, cmd.roomId, cmd.text);
      if (!outcome.ok) {
        sendProtocolError(
          ws,
          outcome.code,
          chatMessageErrorDetail(outcome.code),
          roomManager,
        );
      }
      return;
    }
    default: {
      const _exhaustive: never = cmd;
      return _exhaustive;
    }
  }
}
