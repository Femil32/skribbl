"use client";

import type { AvatarPresetId, LobbyRosterPlayer, RoomPhase } from "@skribbl/shared";
import { safeParseServerEvent } from "@skribbl/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  messageForProtocolErrorCode,
  protocolParseErrorMessage,
} from "@/features/lobby/lib/protocol-error-message";
import { resolveGameWebSocketUrl } from "@/lib/game-ws-url";
import { serializeCreateRoomCommand, serializeStartMatchCommand } from "@/lib/ws-client";

const missingWsUrlMessage =
  "Real-time play is not configured for this deployment. Set NEXT_PUBLIC_WS_URL to your game server WebSocket URL (for example ws://localhost:3001 when running the game server locally).";

export type HostLobbyState =
  | { status: "idle" }
  | { status: "connecting" }
  | {
      status: "lobby";
      roomId: string;
      roomCode: string;
      playerId: string;
      displayName: string;
      avatarPresetId: AvatarPresetId;
      phase: RoomPhase;
      players: LobbyRosterPlayer[];
      isStartPending: boolean;
    }
  | { status: "error"; message: string };

export type UseHostCreateRoomParams = {
  /** After the user submits the lobby identity form, set true to open the socket and send `createRoom`. */
  shouldConnect: boolean;
  /** Bump when retrying create with the same identity fields. */
  attemptId: number;
  displayName: string;
  avatarPresetId?: AvatarPresetId;
};

export type UseHostCreateRoomResult = {
  state: HostLobbyState;
  /** Authoritative host start — no-op unless lobby state is active. */
  startMatch: () => void;
};

export function useHostCreateRoom(
  params: UseHostCreateRoomParams,
): UseHostCreateRoomResult {
  const { shouldConnect, attemptId, displayName, avatarPresetId } = params;
  const wsUrl = resolveGameWebSocketUrl();
  const [state, setState] = useState<HostLobbyState>({ status: "idle" });
  const reachedLobbyRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!shouldConnect) {
      reachedLobbyRef.current = false;
      return;
    }

    if (!wsUrl) {
      return;
    }

    reachedLobbyRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: align UI with subscription start
    setState({ status: "connecting" });

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    let closedByCleanup = false;

    function fail(message: string) {
      if (!closedByCleanup && !reachedLobbyRef.current) {
        setState({ status: "error", message });
      }
    }

    ws.addEventListener("open", () => {
      try {
        ws.send(serializeCreateRoomCommand(displayName, avatarPresetId));
      } catch {
        fail("Could not send create request. Try again.");
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
        case "roomCreated":
          reachedLobbyRef.current = true;
          setState({
            status: "lobby",
            roomId: parsed.data.roomId,
            roomCode: parsed.data.roomCode,
            playerId: parsed.data.playerId,
            displayName: parsed.data.displayName,
            avatarPresetId: parsed.data.avatarPresetId,
            phase: parsed.data.phase,
            players: [],
            isStartPending: false,
          });
          return;
        case "lobbyRoster": {
          const roster = parsed.data;
          setState((prev) => {
            if (prev.status !== "lobby") return prev;
            if (roster.roomId !== prev.roomId) return prev;
            return {
              ...prev,
              players: roster.players,
            };
          });
          return;
        }
        case "matchStarting": {
          const start = parsed.data;
          setState((prev) => {
            if (prev.status !== "lobby") return prev;
            if (start.roomId !== prev.roomId) return prev;
            return {
              ...prev,
              phase: start.phase,
              isStartPending: false,
            };
          });
          return;
        }
        case "error": {
          const err = parsed.data;
          if (!reachedLobbyRef.current) {
            setState({
              status: "error",
              message: messageForProtocolErrorCode(err.code),
            });
            return;
          }
          setState((prev) => {
            if (prev.status !== "lobby") return prev;
            return { ...prev, isStartPending: false };
          });
          return;
        }
        case "pong":
        case "roomJoined":
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
      if (reachedLobbyRef.current) return;
      fail("The connection closed before the room was ready. Try again.");
    });

    return () => {
      closedByCleanup = true;
      wsRef.current = null;
      ws.close();
    };
  }, [wsUrl, shouldConnect, attemptId, displayName, avatarPresetId]);

  const startMatch = useCallback(() => {
    const w = wsRef.current;
    if (!w || w.readyState !== WebSocket.OPEN) return;
    try {
      setState((prev) => {
        if (prev.status !== "lobby") return prev;
        return { ...prev, isStartPending: true };
      });
      w.send(serializeStartMatchCommand());
    } catch {
      setState((prev) => {
        if (prev.status !== "lobby") return prev;
        return { ...prev, isStartPending: false };
      });
    }
  }, []);

  if (!shouldConnect) {
    return { state: { status: "idle" }, startMatch };
  }

  if (!wsUrl) {
    return { state: { status: "error", message: missingWsUrlMessage }, startMatch };
  }

  if (state.status === "idle") {
    return { state: { status: "connecting" }, startMatch };
  }

  return { state, startMatch };
}
