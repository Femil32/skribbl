import type { AvatarPresetId, ClientCommand } from "@skribbl/shared";
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
): string {
  return serializeClientCommand({
    type: "createRoom",
    displayName,
    ...(avatarPresetId !== undefined ? { avatarPresetId } : {}),
  });
}

/** Validated JSON line for `joinRoom` — outbound shape matches `@skribbl/shared`. */
export function serializeJoinRoomCommand(
  roomCode: string,
  displayName: string,
  avatarPresetId?: AvatarPresetId,
): string {
  return serializeClientCommand({
    type: "joinRoom",
    roomCode,
    displayName,
    ...(avatarPresetId !== undefined ? { avatarPresetId } : {}),
  });
}

/** Host-only validated JSON for `startMatch` (Story 1.6+). */
export function serializeStartMatchCommand(): string {
  return serializeClientCommand({ type: "startMatch" });
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
