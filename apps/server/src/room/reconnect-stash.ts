import type { AvatarPresetId } from "@skribbl/shared";

/** Server-only stash for transport drops; lobby grace uses optional `graceExpiresAtMs` (Story 8.5). */
export type ReconnectStash = {
  playerId: string;
  displayName: string;
  avatarPresetId: AvatarPresetId;
  /** Canonical join order for host promotion and roster. */
  joinedAtMs: number;
  /** When set (lobby disconnect), seat auto-expires at this monotonic time. */
  graceExpiresAtMs?: number;
};
