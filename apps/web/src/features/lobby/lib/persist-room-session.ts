import type { AvatarPresetId, RoomPhase } from "@skribbl/shared";

const storagePrefix = "skribbl:roomCred:";
const lastGuestByCodePrefix = "skribbl:lastGuestCred:";

const lastHostRoomKey = "skribbl:lastActiveHostRoom";

export type PersistedRoomSession = {
  kind: "host" | "guest";
  roomId: string;
  roomCode: string;
  playerId: string;
  reconnectToken: string;
  displayName: string;
  avatarPresetId: AvatarPresetId;
  lastPhase: RoomPhase;
};

function decodePersisted(parsed: unknown): PersistedRoomSession | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (
    (o.kind !== "host" && o.kind !== "guest") ||
    typeof o.roomId !== "string" ||
    typeof o.roomCode !== "string" ||
    typeof o.playerId !== "string" ||
    typeof o.reconnectToken !== "string" ||
    typeof o.displayName !== "string" ||
    typeof o.avatarPresetId !== "string" ||
    typeof o.lastPhase !== "string"
  ) {
    return null;
  }
  return {
    kind: o.kind,
    roomId: o.roomId,
    roomCode: o.roomCode,
    playerId: o.playerId,
    reconnectToken: o.reconnectToken,
    displayName: o.displayName,
    avatarPresetId: o.avatarPresetId as AvatarPresetId,
    lastPhase: o.lastPhase as RoomPhase,
  };
}

/** Per-room copy (dual-key convenience for lookups). Story 5.1: survives reload via `localStorage`; lobby guest tokens are revoked — prefer `joinRoom` after lobby drop. */
export function persistRoomSession(s: PersistedRoomSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storagePrefix + s.roomId, JSON.stringify(s));
  } catch {
    /* quota / private mode */
  }
}

/** Last successful host handshake — restores `resumeSession` after full reload when the player was hosting. */
export function persistLastActiveHostRoom(s: PersistedRoomSession): void {
  if (typeof window === "undefined" || s.kind !== "host") return;
  try {
    localStorage.setItem(lastHostRoomKey, JSON.stringify(s));
  } catch {
    /* quota */
  }
}

export function loadLastActiveHostRoom(): PersistedRoomSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(lastHostRoomKey);
    if (!raw) return null;
    return decodePersisted(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearLastActiveHostRoom(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(lastHostRoomKey);
  } catch {
    /* ignore */
  }
}

/** Guest keyed by normalized room code so `/join/[code]` can resume mid-match without a prior in-memory handshake. */
export function persistGuestSessionForRoomCode(
  normalizedRoomCode: string,
  s: PersistedRoomSession,
): void {
  if (typeof window === "undefined" || s.kind !== "guest") return;
  try {
    localStorage.setItem(lastGuestByCodePrefix + normalizedRoomCode, JSON.stringify(s));
  } catch {
    /* quota */
  }
}

export function loadGuestSessionForRoomCode(
  normalizedRoomCode: string,
): PersistedRoomSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(lastGuestByCodePrefix + normalizedRoomCode);
    if (!raw) return null;
    return decodePersisted(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearGuestSessionForRoomCode(normalizedRoomCode: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(lastGuestByCodePrefix + normalizedRoomCode);
  } catch {
    /* ignore */
  }
}

export function loadPersistedRoomSession(roomId: string): PersistedRoomSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storagePrefix + roomId);
    if (!raw) return null;
    return decodePersisted(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearPersistedRoomSession(roomId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storagePrefix + roomId);
  } catch {
    /* ignore */
  }
}
