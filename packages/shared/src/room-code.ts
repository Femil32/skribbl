/**
 * Room code normalization and validation — shared by web and server (no drift).
 * Alphabet excludes ambiguous 0/O, 1/I/L; generated codes use this set only.
 */

export const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const ROOM_CODE_LENGTH = 6;

/** Strip whitespace and non-alphanumeric, uppercase (paste-friendly). */
export function normalizeRoomCode(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** True when `normalized` matches server generation rules (length + charset). */
export function isValidRoomCodeForJoin(normalized: string): boolean {
  if (normalized.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of normalized) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}
