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

/** Authoritative drawing phase length (FR7 / architecture). Override: `ROUND_MS`. */
export const DEFAULT_ROUND_MS = 80_000;

/** Word-pick window before drawing (Epic 2.3+ refines UX). Override: `WORD_CHOICE_MS`. */
export const DEFAULT_WORD_CHOICE_MS = 15_000;

/** Brief pause after `matchStarting` before `choosingWord`. Override: `MATCH_START_HANDSHAKE_MS`. */
export const DEFAULT_MATCH_START_HANDSHAKE_MS = 750;

let didWarnInvalidRoundMs = false;
let didWarnInvalidWordChoiceMs = false;
let didWarnInvalidHandshakeMs = false;

export function resolveRoundMs(): number {
  const raw = process.env.ROUND_MS;
  if (!raw) return DEFAULT_ROUND_MS;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 5_000 && n <= 600_000) return n;
  if (!didWarnInvalidRoundMs) {
    didWarnInvalidRoundMs = true;
    console.warn(
      `[game] ROUND_MS env invalid (${JSON.stringify(raw)}); using ${DEFAULT_ROUND_MS} (allowed 5000–600000)`,
    );
  }
  return DEFAULT_ROUND_MS;
}

export function resolveWordChoiceMs(): number {
  const raw = process.env.WORD_CHOICE_MS;
  if (!raw) return DEFAULT_WORD_CHOICE_MS;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 3_000 && n <= 120_000) return n;
  if (!didWarnInvalidWordChoiceMs) {
    didWarnInvalidWordChoiceMs = true;
    console.warn(
      `[game] WORD_CHOICE_MS env invalid (${JSON.stringify(raw)}); using ${DEFAULT_WORD_CHOICE_MS} (allowed 3000–120000)`,
    );
  }
  return DEFAULT_WORD_CHOICE_MS;
}

export function resolveMatchStartHandshakeMs(): number {
  const raw = process.env.MATCH_START_HANDSHAKE_MS;
  if (!raw) return DEFAULT_MATCH_START_HANDSHAKE_MS;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 0 && n <= 30_000) return n;
  if (!didWarnInvalidHandshakeMs) {
    didWarnInvalidHandshakeMs = true;
    console.warn(
      `[game] MATCH_START_HANDSHAKE_MS env invalid (${JSON.stringify(raw)}); using ${DEFAULT_MATCH_START_HANDSHAKE_MS} (allowed 0–30000)`,
    );
  }
  return DEFAULT_MATCH_START_HANDSHAKE_MS;
}

/** Scheduled rounds per match (Epic 2.2+). Override: `ROUNDS_PER_MATCH`. */
export const DEFAULT_ROUNDS_PER_MATCH = 3;

/** Pause after `roundResult` before the next `choosingWord`. Override: `INTER_ROUND_GAP_MS`. */
export const DEFAULT_INTER_ROUND_GAP_MS = 1_500;

let didWarnInvalidRounds = false;
let didWarnInvalidGap = false;

export function resolveRoundsPerMatch(): number {
  const raw = process.env.ROUNDS_PER_MATCH;
  if (!raw) return DEFAULT_ROUNDS_PER_MATCH;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 50) return n;
  if (!didWarnInvalidRounds) {
    didWarnInvalidRounds = true;
    console.warn(
      `[game] ROUNDS_PER_MATCH env invalid (${JSON.stringify(raw)}); using ${DEFAULT_ROUNDS_PER_MATCH} (allowed 1–50)`,
    );
  }
  return DEFAULT_ROUNDS_PER_MATCH;
}

export function resolveInterRoundGapMs(): number {
  const raw = process.env.INTER_ROUND_GAP_MS;
  if (!raw) return DEFAULT_INTER_ROUND_GAP_MS;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 0 && n <= 60_000) return n;
  if (!didWarnInvalidGap) {
    didWarnInvalidGap = true;
    console.warn(
      `[game] INTER_ROUND_GAP_MS env invalid (${JSON.stringify(raw)}); using ${DEFAULT_INTER_ROUND_GAP_MS} (allowed 0–60000)`,
    );
  }
  return DEFAULT_INTER_ROUND_GAP_MS;
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
