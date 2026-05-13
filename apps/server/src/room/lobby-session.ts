import type { AvatarPresetId } from "@skribbl/shared";

/** Per-connection lobby identity assigned by the server (Story 1.5). */
export type LobbySessionIdentity = {
  playerId: string;
  displayName: string;
  avatarPresetId: AvatarPresetId;
  /** Join order for this seat (Story 8.5); mirrors `Room.joinedAtByPlayerId`. */
  joinedAtMs: number;
};
