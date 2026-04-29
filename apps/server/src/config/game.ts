/**
 * Gameplay constants and env reads — extend in later stories.
 * WORDS_PATH / data/words.json: Story 2.x.
 *
 * MAX_PLAYERS: max players per lobby room (NFR-S1); override via env like WORDS_PATH.
 */
import type { RawData } from "ws";

export const GAME_SERVER_DEFAULT_PORT = 3001;

/** Default max players per room — aligns with NFR-S1 / epics. */
export const DEFAULT_MAX_PLAYERS = 8;

/** Max inbound WebSocket frame payload (bytes); JSON commands stay small (DoS mitigation). */
export const MAX_WS_MESSAGE_BYTES = 16_384;

let didWarnInvalidMaxPlayers = false;

export function resolvePort(): number {
  const raw = process.env.PORT;
  if (!raw) return GAME_SERVER_DEFAULT_PORT;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : GAME_SERVER_DEFAULT_PORT;
}

export function resolveMaxPlayers(): number {
  const raw = process.env.MAX_PLAYERS;
  if (!raw) return DEFAULT_MAX_PLAYERS;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 2 && n <= 64) return n;
  if (!didWarnInvalidMaxPlayers) {
    didWarnInvalidMaxPlayers = true;
    console.warn(
      `[game] MAX_PLAYERS env invalid (${JSON.stringify(raw)}); using ${DEFAULT_MAX_PLAYERS} (allowed 2–64)`,
    );
  }
  return DEFAULT_MAX_PLAYERS;
}

/** Byte length of an inbound WS message (ws `RawData`) before JSON parse. */
export function inboundWsMessageByteLength(raw: RawData): number {
  if (Buffer.isBuffer(raw)) return raw.length;
  if (raw instanceof ArrayBuffer) return raw.byteLength;
  if (Array.isArray(raw)) {
    let total = 0;
    for (const part of raw) total += part.length;
    return total;
  }
  return 0;
}
