import type { AvatarPresetId, ClientCommand, RoomSettings } from "@skribbl/shared";
import {
  clientCommandSchema,
  serializeClientCommand,
} from "@skribbl/shared";
import { resolveGameWebSocketUrl } from "@/lib/game-ws-url";

/**
 * Build a connectivity-check ping using only shared shapes (compile-time + runtime).
 * Wire sends JSON; validate outbound in dev/tests with the same schema as the server.
 */
export function createPingCommand(ts = Date.now()): ClientCommand {
  const cmd = { type: "ping" as const, ts };
  return clientCommandSchema.parse(cmd);
}

/** Validated JSON line for `createRoom` — send over the game WebSocket after `open`. */
export function serializeCreateRoomCommand(
  displayName: string,
  avatarPresetId?: AvatarPresetId,
  token?: string,
): string {
  return serializeClientCommand({
    type: "createRoom",
    displayName,
    ...(avatarPresetId !== undefined ? { avatarPresetId } : {}),
    ...(token ? { token } : {}),
  });
}

/** Validated JSON for mid-match guest reconnect (Story 5.2). */
export function serializeReconnectPlayerCommand(
  roomId: string,
  playerId: string,
  displayName: string,
  avatarPresetId: AvatarPresetId,
  token?: string,
): string {
  return serializeClientCommand({
    type: "reconnectPlayer",
    roomId,
    playerId,
    displayName,
    avatarPresetId,
    ...(token ? { token } : {}),
  });
}

/** Host reclaim after transport drop — same `playerId` from the original `roomCreated`. */
export function serializeReconnectHostCommand(
  roomId: string,
  playerId: string,
  displayName: string,
  avatarPresetId: AvatarPresetId,
  token?: string,
): string {
  return serializeClientCommand({
    type: "reconnectHost",
    roomId,
    playerId,
    displayName,
    avatarPresetId,
    ...(token ? { token } : {}),
  });
}

/** Validated JSON line for `joinRoom` — outbound shape matches `@skribbl/shared`. */
export function serializeJoinRoomCommand(
  roomCode: string,
  displayName: string,
  avatarPresetId?: AvatarPresetId,
  token?: string,
): string {
  return serializeClientCommand({
    type: "joinRoom",
    roomCode,
    displayName,
    ...(avatarPresetId !== undefined ? { avatarPresetId } : {}),
    ...(token ? { token } : {}),
  });
}

/** Host-only validated JSON for `startMatch` (Story 1.6+). */
export function serializeStartMatchCommand(): string {
  return serializeClientCommand({ type: "startMatch" });
}

/** Drawer validated word pick (Story 2.3). */
export function serializeChooseWordCommand(choiceIndex: 0 | 1 | 2): string {
  return serializeClientCommand({ type: "chooseWord", choiceIndex });
}

/** Host-only: leave post-match scoreboard and reset room to lobby (Story 2.7). */
export function serializeReturnToLobbyCommand(): string {
  return serializeClientCommand({ type: "returnToLobby" });
}

/** Host-only: update lobby match settings (Story 8.2). */
export function serializeUpdateSettingsCommand(settings: Partial<RoomSettings>): string {
  return serializeClientCommand({ type: "updateSettings", settings });
}

/** Room chat / guesses (Epic 4). */
export function serializeChatMessageCommand(roomId: string, text: string): string {
  return serializeClientCommand({ type: "chatMessage", roomId, text });
}

/**
 * Optional dev helper: open a WebSocket and send one ping when NEXT_PUBLIC debug WS URL is set.
 * Gated so production bundles do not require a live game server.
 */
export function maybeDemoPingWs(): void {
  if (process.env.NODE_ENV === "production") return;
  const url = resolveGameWebSocketUrl();
  if (!url || process.env.NEXT_PUBLIC_ENABLE_WS_DEMO !== "1") return;

  try {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify(createPingCommand()));
    });
  } catch {
    /* ignore — demo only */
  }
}
