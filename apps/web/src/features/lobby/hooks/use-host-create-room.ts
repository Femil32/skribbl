"use client";

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
  | { status: "connecting" }
  | {
      status: "lobby";
      roomId: string;
      roomCode: string;
    }
  | { status: "error"; message: string };

export function useHostCreateRoom(): HostLobbyState {
  const wsUrl = resolveGameWebSocketUrl();
  const [state, setState] = useState<HostLobbyState>(() =>
    wsUrl ? { status: "connecting" } : { status: "error", message: missingWsUrlMessage },
  );
  const reachedLobbyRef = useRef(false);

  useEffect(() => {
    if (!wsUrl) return;

    const ws = new WebSocket(wsUrl);
    let closedByCleanup = false;

    function fail(message: string) {
      if (!closedByCleanup && !reachedLobbyRef.current) {
        setState({ status: "error", message });
      }
    }

    ws.addEventListener("open", () => {
      try {
        ws.send(serializeCreateRoomCommand());
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
  }, [wsUrl]);

  return state;
}
