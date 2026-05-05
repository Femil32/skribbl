import type { AvatarPresetId } from "@skribbl/shared";
import { isValidAvatarPresetId } from "@skribbl/shared";

export type SkribblSession = {
  roomId: string;
  roomCode: string;
  playerId: string;
  displayName: string;
  avatarPresetId: AvatarPresetId;
  role: "host" | "guest";
};

const SESSION_KEY = "skribbl_session";

export function saveSession(s: SkribblSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* ignore — storage unavailable or quota exceeded */
  }
}

export function loadSession(): SkribblSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return parseSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function parseSession(v: unknown): SkribblSession | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const s = v as Record<string, unknown>;
  if (
    typeof s.roomId !== "string" ||
    !s.roomId ||
    typeof s.roomCode !== "string" ||
    !s.roomCode ||
    typeof s.playerId !== "string" ||
    !s.playerId ||
    typeof s.displayName !== "string" ||
    !s.displayName ||
    typeof s.avatarPresetId !== "string" ||
    !isValidAvatarPresetId(s.avatarPresetId) ||
    (s.role !== "host" && s.role !== "guest")
  ) {
    return null;
  }
  return {
    roomId: s.roomId,
    roomCode: s.roomCode,
    playerId: s.playerId,
    displayName: s.displayName,
    avatarPresetId: s.avatarPresetId,
    role: s.role,
  };
}
