import type { AvatarPresetId } from "@skribbl/shared";

/** Per-connection lobby identity assigned by the server (Story 1.5). */
export type LobbySessionIdentity = {
  playerId: string;
  displayName: string;
  avatarPresetId: AvatarPresetId;
};
