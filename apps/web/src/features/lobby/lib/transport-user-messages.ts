/** Shown when the socket closes before `roomCreated` / `roomJoined` (browser rarely gives a reason). */
export const transportCloseBeforeHandshakeMessage =
  "The connection closed before your room was ready. That usually means a network drop or that the game server was unreachable. Check Wi‑Fi or VPN, then try again.";

/**
 * Browser `error` on WebSocket before open — no standard payload; list practical causes
 * without blaming the player (AC2).
 */
export const transportOpenFailedMessage =
  "We could not open a realtime link to the game server. The server may be down, a firewall may be blocking WebSockets, or the page may use https while the game URL uses ws (mixed content). Try again or check the deployment setup.";
