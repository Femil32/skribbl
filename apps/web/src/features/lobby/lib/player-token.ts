const TOKEN_KEY = "skribbl_pid";
const PLAYER_ID_KEY = "skribbl_player_id";

export interface PlayerToken {
  token: string;
  playerId: string;
}

export function getStoredToken(): PlayerToken | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const playerId = localStorage.getItem(PLAYER_ID_KEY);
    if (!token || !playerId) return null;
    return { token, playerId };
  } catch {
    return null;
  }
}

export function storeToken(token: string, playerId: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(PLAYER_ID_KEY, playerId);
  } catch {
    // Ignore quota errors — token is best-effort
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PLAYER_ID_KEY);
  } catch {
    // Ignore errors
  }
}

export async function getOrCreatePlayerToken(sessionApiUrl: string): Promise<PlayerToken> {
  const stored = getStoredToken();
  if (stored) return stored;

  try {
    const res = await fetch(`${sessionApiUrl}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`Session API returned ${res.status}`);
    const data = (await res.json()) as { token: string; playerId: string };
    if (data.token && data.playerId) {
      storeToken(data.token, data.playerId);
      return { token: data.token, playerId: data.playerId };
    }
    throw new Error("Invalid session response");
  } catch {
    // Best-effort: return empty strings so WS connection proceeds without token
    return { token: "", playerId: "" };
  }
}

export function wsUrlToHttpUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://");
}
