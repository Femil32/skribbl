/**
 * Maps a game WebSocket URL to the HTTP(S) probe URL for the game server's
 * `GET /healthz` endpoint (same host/port; path is always `/healthz` on the Node HTTP listener).
 */
export function gameWsUrlToHttpHealthzUrl(wsUrl: string): string {
  const u = new URL(wsUrl);
  const scheme = u.protocol === "wss:" ? "https:" : "http:";
  return `${scheme}//${u.host}/healthz`;
}
