/**
 * Browser WebSocket URL for the game server. Set `NEXT_PUBLIC_WS_URL` for production
 * or when the WS host/port differs from local dev.
 *
 * Default dev URL uses the same port as `GAME_SERVER_DEFAULT_PORT` in `apps/server`
 * (`resolvePort()` when `PORT` is unset).
 */
const LOCAL_DEV_GAME_WS_URL = "ws://localhost:3001";

export function resolveGameWebSocketUrl(): string | undefined {
  const fromEnv = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development") return LOCAL_DEV_GAME_WS_URL;
  return undefined;
}
