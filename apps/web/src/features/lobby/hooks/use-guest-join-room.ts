"use client";

import {
  isValidRoomCodeForJoin,
  normalizeRoomCode,
  safeParseServerEvent,
} from "@skribbl/shared";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  messageForProtocolErrorCode,
  protocolParseErrorMessage,
} from "@/features/lobby/lib/protocol-error-message";
import { resolveGameWebSocketUrl } from "@/lib/game-ws-url";
import { serializeJoinRoomCommand } from "@/lib/ws-client";

const missingWsUrlMessage =
  "Real-time play is not configured for this deployment. Set NEXT_PUBLIC_WS_URL to your game server WebSocket URL (for example ws://localhost:3001 when running the game server locally).";

export type GuestJoinLobbyState =
  | { status: "idle" }
  | { status: "connecting" }
  | {
      status: "joined";
      roomId: string;
      roomCode: string;
      phase: "lobby";
      playerCount: number;
    }
  | { status: "error"; message: string };

export type UseGuestJoinRoomArgs = {
  /** Increments on manual submit / retry so a failed join can open a fresh socket. */
  connectionAttemptId: number;
  /** When true after a deliberate join (valid format), dial the game WebSocket and send join. */
  activeJoinAttempt: boolean;
  /** Raw or pasted room code; normalized before validate/send. */
  roomCodeInput: string;
};

/**
 * Opens one WebSocket, sends **`joinRoom`** via **`serializeJoinRoomCommand`**, demuxes with
 * **`safeParseServerEvent`**. Keeps the socket open after **`roomJoined`** for later lobby work
 * (Story 1.5+); closes on unmount or when join is deactivated.
 */
export function useGuestJoinRoom(args: UseGuestJoinRoomArgs): GuestJoinLobbyState {
  const { connectionAttemptId, activeJoinAttempt, roomCodeInput } = args;
  const wsUrl = resolveGameWebSocketUrl();
  const normalized = normalizeRoomCode(roomCodeInput);

  const [state, setState] = useState<GuestJoinLobbyState>({ status: "idle" });
  const reachedJoinedRef = useRef(false);

  useLayoutEffect(() => {
    if (!activeJoinAttempt || !wsUrl || !isValidRoomCodeForJoin(normalized)) {
      return;
    }
    setState((prev) => {
      if (prev.status === "joined") return prev;
      reachedJoinedRef.current = false;
      return { status: "connecting" };
    });
  }, [activeJoinAttempt, connectionAttemptId, normalized, wsUrl]);

  useEffect(() => {
    if (!activeJoinAttempt) {
      return;
    }

    if (!wsUrl) {
      return;
    }

    if (!isValidRoomCodeForJoin(normalized)) {
      return;
    }

    const ws = new WebSocket(wsUrl);
    let closedByCleanup = false;

    function fail(message: string) {
      if (!closedByCleanup && !reachedJoinedRef.current) {
        setState({ status: "error", message });
      }
    }

    ws.addEventListener("open", () => {
      try {
        ws.send(serializeJoinRoomCommand(normalized));
      } catch {
        fail("Could not send join request. Try again.");
      }
    });

    ws.addEventListener("message", (event) => {
      let data: unknown;
      try {
        data = JSON.parse(String(event.data));
      } catch {
        fail(protocolParseErrorMessage);
        return;
      }

      const parsed = safeParseServerEvent(data);
      if (!parsed.success) {
        fail(protocolParseErrorMessage);
        return;
      }

      switch (parsed.data.type) {
        case "roomJoined":
          reachedJoinedRef.current = true;
          setState({
            status: "joined",
            roomId: parsed.data.roomId,
            roomCode: parsed.data.roomCode,
            phase: parsed.data.phase,
            playerCount: parsed.data.playerCount,
          });
          return;
        case "error":
          if (reachedJoinedRef.current) return;
          setState({
            status: "error",
            message: messageForProtocolErrorCode(parsed.data.code),
          });
          return;
        case "pong":
        case "roomCreated":
          return;
        default: {
          const _exhaustive: never = parsed.data;
          return _exhaustive;
        }
      }
    });

    ws.addEventListener("error", () => {
      fail("Could not connect to the game server. Check your network and try again.");
    });

    ws.addEventListener("close", () => {
      if (closedByCleanup) return;
      if (reachedJoinedRef.current) return;
      fail("The connection closed before you joined. Try again.");
    });

    return () => {
      closedByCleanup = true;
      ws.close();
    };
  }, [activeJoinAttempt, connectionAttemptId, normalized, wsUrl]);

  if (!activeJoinAttempt) {
    return { status: "idle" };
  }

  if (!wsUrl) {
    return { status: "error", message: missingWsUrlMessage };
  }

  return state;
}
