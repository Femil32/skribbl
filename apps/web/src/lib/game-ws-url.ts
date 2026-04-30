/**
 * Browser WebSocket URL for the game server. Set `NEXT_PUBLIC_WS_URL` for production
 * or when the WS host/port differs from local dev.
 *
 * Dev fallback uses port `GAME_SERVER_DEV_PORT`, aligned with `GAME_SERVER_DEFAULT_PORT` in `apps/server`
 * (`resolvePort()` when `PORT` is unset).
 */
const GAME_SERVER_DEV_PORT = 3001;
const LOCAL_DEV_GAME_WS_URL = `ws://localhost:${GAME_SERVER_DEV_PORT}`;

/** User-facing explanation when `NEXT_PUBLIC_WS_URL` is unset outside development. */
export function missingGameWebSocketUrlUserMessage(): string {
  return "Real-time play is not configured for this deployment. Set NEXT_PUBLIC_WS_URL to your game server WebSocket URL (for example ws://localhost:3001 when running the game server locally).";
}

export function resolveGameWebSocketUrl(): string | undefined {
  const fromEnv = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development") {
    // LAN / mobile testing: same machine loads the page via a LAN IP but `localhost`
    // in the WS URL would point at the client device, not the dev machine.
    if (typeof window !== "undefined") {
      const { hostname, protocol } = window.location;
      const wsScheme = protocol === "https:" ? "wss:" : "ws:";
      return `${wsScheme}//${hostname}:${GAME_SERVER_DEV_PORT}`;
    }
    return LOCAL_DEV_GAME_WS_URL;
  }
  return undefined;
}
