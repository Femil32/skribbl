"use client";

import type { AvatarPresetId } from "@skribbl/shared";
import { safeParseServerEvent } from "@skribbl/shared";
import { useEffect, useRef, useState } from "react";
import {
  messageForProtocolErrorCode,
  protocolParseErrorMessage,
} from "@/features/lobby/lib/protocol-error-message";
import { resolveGameWebSocketUrl } from "@/lib/game-ws-url";
import { serializeCreateRoomCommand } from "@/lib/ws-client";

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

export function useHostCreateRoom(
  params: UseHostCreateRoomParams,
): HostLobbyState {
  const { shouldConnect, attemptId, displayName, avatarPresetId } = params;
  const wsUrl = resolveGameWebSocketUrl();
  const [state, setState] = useState<HostLobbyState>({ status: "idle" });
  const reachedLobbyRef = useRef(false);

  useEffect(() => {
    if (!shouldConnect) {
      reachedLobbyRef.current = false;
      return;
    }

    if (!wsUrl) {
      return;
    }

    reachedLobbyRef.current = false;
    // Sync "connecting" with starting the WebSocket in this effect; async handlers perform other updates.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: align UI with subscription start
    setState({ status: "connecting" });

    const ws = new WebSocket(wsUrl);
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
          });
          return;
        case "error":
          if (reachedLobbyRef.current) return;
          setState({
            status: "error",
            message: messageForProtocolErrorCode(parsed.data.code),
          });
          return;
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
      ws.close();
    };
  }, [wsUrl, shouldConnect, attemptId, displayName, avatarPresetId]);

  if (!shouldConnect) {
    return { status: "idle" };
  }

  if (!wsUrl) {
    return { status: "error", message: missingWsUrlMessage };
  }

  if (state.status === "idle") {
    return { status: "connecting" };
  }

  return state;
}
