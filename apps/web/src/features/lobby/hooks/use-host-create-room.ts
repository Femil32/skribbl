"use client";

import type { AvatarPresetId, LobbyRosterPlayer, RoomPhase } from "@skribbl/shared";
import { safeParseServerEvent } from "@skribbl/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  messageForProtocolErrorCode,
  protocolParseErrorMessage,
} from "@/features/lobby/lib/protocol-error-message";
import type { LobbyConnectionReason, LobbyTransportPhase } from "@/features/lobby/lib/lobby-transport";
import {
  transportCloseBeforeHandshakeMessage,
  transportOpenFailedMessage,
} from "@/features/lobby/lib/transport-user-messages";
import { missingGameWebSocketUrlUserMessage, resolveGameWebSocketUrl } from "@/lib/game-ws-url";
import {
  serializeCreateRoomCommand,
  serializeReconnectHostCommand,
  serializeStartMatchCommand,
} from "@/lib/ws-client";

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
  transport: LobbyTransportPhase;
  connectionReason: LobbyConnectionReason;
  /** Blocking/fatal copy for the banner (missing URL, protocol, or transport failure). */
  transportErrorMessage?: string;
  /** Socket is open but `roomCreated` not yet received. */
  awaitingRoomHandshake: boolean;
  /** Authoritative host start — no-op unless lobby state is active. */
  startMatch: () => void;
};

const TERMINAL_PROTOCOL_CODES_AFTER_LOBBY = new Set([
  "BAD_PAYLOAD",
  "INTERNAL",
  "JOIN_NOT_ALLOWED",
  "HOST_SESSION_LOST",
  "HOST_RECLAIM_DENIED",
  "ALREADY_CONNECTED",
]);

type HostResumeContext = {
  roomId: string;
  playerId: string;
  displayName: string;
  avatarPresetId: AvatarPresetId;
};

export function useHostCreateRoom(
  params: UseHostCreateRoomParams,
): UseHostCreateRoomResult {
  const { shouldConnect, attemptId, displayName, avatarPresetId } = params;
  const wsUrl = resolveGameWebSocketUrl();
  const [state, setState] = useState<HostLobbyState>({ status: "idle" });
  const [transport, setTransport] = useState<LobbyTransportPhase>("idle");
  const [connectionReason, setConnectionReason] = useState<LobbyConnectionReason>("first");
  const [transportErrorMessage, setTransportErrorMessage] = useState<string | undefined>(
    undefined,
  );
  const [awaitingHandshake, setAwaitingHandshake] = useState(false);

  const reachedLobbyRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  /** Set when the socket closes after the host reached the lobby; drives “reconnecting” copy on retry. */
  const closedWhileInLobbyRef = useRef(false);
  /** Latest successful `roomCreated` — used for `reconnectHost` after a transport drop. */
  const hostResumeContextRef = useRef<HostResumeContext | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- WebSocket subscription: transport and lobby state track open/message/error/close. */
  useEffect(() => {
    if (!shouldConnect) {
      reachedLobbyRef.current = false;
      closedWhileInLobbyRef.current = false;
      hostResumeContextRef.current = null;
      return;
    }

    if (!wsUrl) {
      return;
    }

    reachedLobbyRef.current = false;
    setTransportErrorMessage(undefined);

    const retryAfterLobbyDrop = closedWhileInLobbyRef.current;
    const resume = retryAfterLobbyDrop ? hostResumeContextRef.current : null;
    setConnectionReason(retryAfterLobbyDrop ? "after-drop" : "first");
    setTransport(retryAfterLobbyDrop ? "reconnecting" : "connecting");
    if (!retryAfterLobbyDrop) {
      setState({ status: "connecting" });
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    let closedByCleanup = false;

    function fail(message: string) {
      setAwaitingHandshake(false);
      if (!closedByCleanup && !reachedLobbyRef.current) {
        setTransport("fatal");
        setTransportErrorMessage(message);
        setState({ status: "error", message });
      }
    }

    ws.addEventListener("open", () => {
      setTransport("live");
      setAwaitingHandshake(true);
      try {
        if (resume) {
          ws.send(
            serializeReconnectHostCommand(
              resume.roomId,
              resume.playerId,
              resume.displayName,
              resume.avatarPresetId,
            ),
          );
        } else {
          ws.send(serializeCreateRoomCommand(displayName, avatarPresetId));
        }
      } catch {
        fail("Could not send request. Try again.");
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
          closedWhileInLobbyRef.current = false;
          setAwaitingHandshake(false);
          hostResumeContextRef.current = {
            roomId: parsed.data.roomId,
            playerId: parsed.data.playerId,
            displayName: parsed.data.displayName,
            avatarPresetId: parsed.data.avatarPresetId,
          };
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
          setTransport("live");
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
            setAwaitingHandshake(false);
            if (
              err.code === "HOST_SESSION_LOST" ||
              err.code === "HOST_RECLAIM_DENIED" ||
              err.code === "ALREADY_CONNECTED"
            ) {
              hostResumeContextRef.current = null;
              closedWhileInLobbyRef.current = false;
            }
            setTransport("fatal");
            setTransportErrorMessage(messageForProtocolErrorCode(err.code));
            setState({
              status: "error",
              message: messageForProtocolErrorCode(err.code),
            });
            return;
          }
          if (TERMINAL_PROTOCOL_CODES_AFTER_LOBBY.has(err.code)) {
            setAwaitingHandshake(false);
            hostResumeContextRef.current = null;
            closedWhileInLobbyRef.current = false;
            reachedLobbyRef.current = false;
            setTransport("fatal");
            setTransportErrorMessage(messageForProtocolErrorCode(err.code));
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
      if (reachedLobbyRef.current) return;
      fail(transportOpenFailedMessage);
    });

    ws.addEventListener("close", () => {
      setAwaitingHandshake(false);
      if (closedByCleanup) return;
      if (reachedLobbyRef.current) {
        closedWhileInLobbyRef.current = true;
        setTransport("disconnected");
        setTransportErrorMessage(undefined);
        return;
      }
      fail(transportCloseBeforeHandshakeMessage);
    });

    return () => {
      closedByCleanup = true;
      wsRef.current = null;
      ws.close();
    };
  }, [wsUrl, shouldConnect, attemptId, displayName, avatarPresetId]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    return {
      state: { status: "idle" },
      transport: "idle",
      connectionReason: "first",
      transportErrorMessage: undefined,
      awaitingRoomHandshake: false,
      startMatch,
    };
  }

  if (!wsUrl) {
    return {
      state: { status: "error", message: missingGameWebSocketUrlUserMessage() },
      transport: "blocked",
      connectionReason: "first",
      transportErrorMessage: missingGameWebSocketUrlUserMessage(),
      awaitingRoomHandshake: false,
      startMatch,
    };
  }

  if (state.status === "idle") {
    return {
      state: { status: "connecting" },
      transport: transport === "idle" ? "connecting" : transport,
      connectionReason,
      transportErrorMessage,
      awaitingRoomHandshake: false,
      startMatch,
    };
  }

  return {
    state,
    transport,
    connectionReason,
    transportErrorMessage,
    awaitingRoomHandshake: awaitingHandshake,
    startMatch,
  };
}
