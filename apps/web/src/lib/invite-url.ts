import { normalizeRoomCode } from "@skribbl/shared";

/**
 * Invite links for Story 1.3–1.4: stable path `/join?code=` for shareable URLs.
 * Optional `NEXT_PUBLIC_APP_URL` (no trailing slash) overrides `window.location.origin`
 * when the public web origin must differ from the current page (preview/staging).
 */

/** Alias for `@skribbl/shared` `normalizeRoomCode` — identical rules for invites and join. */
export function normalizeRoomCodeForDisplay(raw: string): string {
  return normalizeRoomCode(raw);
}

export function resolvePublicWebOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/**
 * Full invite URL including origin. Pass `origin` in tests or SSR when `window` is absent.
 */
export function buildRoomInviteUrl(roomCode: string, origin?: string): string {
  const o = origin ?? resolvePublicWebOrigin();
  if (!o) {
    throw new Error("Cannot build invite URL without a public origin");
  }
  const q = encodeURIComponent(roomCode);
  return `${o}/join?code=${q}`;
}
