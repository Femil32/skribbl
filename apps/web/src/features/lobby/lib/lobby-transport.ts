/**
 * Browser WebSocket transport phases for lobby surfaces (host + guest).
 * Aligns with game-architecture connection vocabulary: connecting | live | reconnecting.
 */
export type LobbyTransportPhase =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "disconnected"
  | "blocked"
  | "fatal";

export type LobbyConnectionReason = "first" | "after-drop";

export type LobbyBannerPresentation = {
  alertRole: "alert" | "status";
  alertClass: string;
  title: string;
  description?: string;
  showRetry: boolean;
  /** Full page reload affordance (e.g. missing WS URL or browser blocked sockets). */
  showReload: boolean;
};

/**
 * Pure mapping for banner copy, a11y roles, and DaisyUI alert classes.
 * No user-facing strings may include stack traces or raw Error.message.
 */
export function lobbyConnectionBannerModel(input: {
  transport: LobbyTransportPhase;
  reason: LobbyConnectionReason;
  /** Server/protocol or transport failure copy (already sanitized). */
  errorMessage?: string;
  /** True when socket is open but app is still waiting for roomCreated / roomJoined. */
  awaitingRoomHandshake?: boolean;
}): LobbyBannerPresentation | null {
  const { transport, reason, errorMessage, awaitingRoomHandshake } = input;

  if (transport === "idle") return null;

  if (transport === "blocked") {
    return {
      alertRole: "alert",
      alertClass: "alert alert-error",
      title: "Real-time play is not available",
      description: errorMessage,
      showRetry: false,
      showReload: true,
    };
  }

  if (transport === "fatal") {
    return {
      alertRole: "alert",
      alertClass: "alert alert-warning",
      title: "Could not reach the game server",
      description: errorMessage,
      showRetry: true,
      showReload: false,
    };
  }

  if (transport === "disconnected") {
    return {
      alertRole: "alert",
      alertClass: "alert alert-warning",
      title: "You are disconnected",
      description:
        "The live connection dropped. Check your network, then retry. If it keeps happening, the host or your network may be blocking WebSockets.",
      showRetry: true,
      showReload: false,
    };
  }

  if (transport === "reconnecting") {
    return {
      alertRole: "status",
      alertClass: "alert alert-info",
      title: "Restoring your session…",
      description:
        "Hang tight — the server is resuming your seat after a connection drop or manual retry.",
      showRetry: false,
      showReload: false,
    };
  }

  if (transport === "connecting") {
    const title =
      reason === "after-drop"
        ? "Reconnecting to the game server…"
        : "Connecting to the game server…";
    return {
      alertRole: "status",
      alertClass: "alert alert-info",
      title,
      description:
        reason === "after-drop"
          ? "Establishing a fresh connection."
          : "Starting a secure realtime session.",
      showRetry: false,
      showReload: false,
    };
  }

  if (transport === "live") {
    if (awaitingRoomHandshake) {
      return {
        alertRole: "status",
        alertClass: "alert alert-success",
        title: "Connected",
        description: "Finishing room setup…",
        showRetry: false,
        showReload: false,
      };
    }
    return {
      alertRole: "status",
      alertClass: "alert alert-success border border-success/30",
      title: "Live",
      description: "Realtime connection is active.",
      showRetry: false,
      showReload: false,
    };
  }

  const _exhaustive: never = transport;
  return _exhaustive;
}
