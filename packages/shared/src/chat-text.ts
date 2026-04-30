/**
 * Chat ingress + guess comparison (Epic 4, FR20). Shared between server adjudication and tests.
 */

import { countGraphemes, sanitizeDisplayName } from "./player-identity.js";

/** Hard cap after sanitize — enforced server-side with structured error. */
export const CHAT_MESSAGE_MAX_GRAPHEMES = 200;

/**
 * Sanitize outgoing chat body (NFR-SEC2). Reuses display-name style stripping; then cap grapheme length.
 */
export function sanitizeChatMessage(raw: string): string {
  return sanitizeDisplayName(raw);
}

export function assertChatMessageLength(sanitized: string): {
  ok: true;
} | {
  ok: false;
  code: "CHAT_TOO_LONG";
} {
  if (countGraphemes(sanitized) > CHAT_MESSAGE_MAX_GRAPHEMES) {
    return { ok: false, code: "CHAT_TOO_LONG" };
  }
  return { ok: true };
}

/**
 * Normalize for case- and whitespace-insensitive exact match against the secret word (FR20).
 * Apply after {@link sanitizeChatMessage} on both user text and secret.
 */
export function normalizeGuessText(s: string): string {
  return s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}
