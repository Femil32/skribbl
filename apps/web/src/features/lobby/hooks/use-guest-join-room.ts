"use client";

import type { AvatarPresetId, LobbyRosterPlayer, RoomPhase } from "@skribbl/shared";
import {
  isValidRoomCodeForJoin,
  normalizeRoomCode,
  safeParseServerEvent,
} from "@skribbl/shared";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  messageForProtocolErrorCode,
  protocolParseErrorMessage,
} from "@/features/lobby/lib/protocol-error-message";
import {
  transportCloseBeforeHandshakeMessage,
  transportOpenFailedMessage,
} from "@/features/lobby/lib/transport-user-messages";
import type { LobbyConnectionReason, LobbyTransportPhase } from "@/features/lobby/lib/lobby-transport";
import { missingGameWebSocketUrlUserMessage, resolveGameWebSocketUrl } from "@/lib/game-ws-url";
import { serializeChooseWordCommand, serializeJoinRoomCommand } from "@/lib/ws-client";

export type GuestJoinLobbyState =
  | { status: "idle" }
  | { status: "connecting" }
  | {
      status: "joined";
      roomId: string;
      roomCode: string;
      phase: RoomPhase;
      playerCount: number;
      playerId: string;
      displayName: string;
      avatarPresetId: AvatarPresetId;
      players: LobbyRosterPlayer[];
      drawerPlayerId?: string;
      matchRoundIndex?: number;
      /** Unix ms when current timed phase ends (**`matchPhase`**, Story 2.4). Cleared when absent. */
      phaseDeadlineMs?: number;
      wordChoiceOffer?: {
        words: readonly [string, string, string];
        phaseDeadlineMs: number;
        matchRoundIndex: number;
      } | null;
      wordChoicePickError?: string | null;
    }
  | {
      /** Server `error.code` when the failure came from an `error` event; omit for generic failures. */
      status: "error";
      message: string;
      protocolCode?: string;
    };

export type UseGuestJoinRoomArgs = {
  connectionAttemptId: number;
  activeJoinAttempt: boolean;
  roomCodeInput: string;
  displayName: string;
  avatarPresetId?: AvatarPresetId;
};

export type UseGuestJoinRoomResult = {
  state: GuestJoinLobbyState;
  transport: LobbyTransportPhase;
  connectionReason: LobbyConnectionReason;
  transportErrorMessage?: string;
  awaitingRoomHandshake: boolean;
  chooseWord: (choiceIndex: 0 | 1 | 2) => void;
};

/**
 * Opens one WebSocket, sends **`joinRoom`** via **`serializeJoinRoomCommand`**, demuxes with
 * **`safeParseServerEvent`**. Keeps the socket open after **`roomJoined`** for lobby roster /
 * match start events (Story 1.6+).
 */
const TERMINAL_PROTOCOL_CODES_AFTER_JOINED = new Set([
  "BAD_PAYLOAD",
  "INTERNAL",
  "JOIN_NOT_ALLOWED",
  "HOST_SESSION_LOST",
  "HOST_RECLAIM_DENIED",
  "ALREADY_CONNECTED",
]);

export function useGuestJoinRoom(args: UseGuestJoinRoomArgs): UseGuestJoinRoomResult {
  const {
    connectionAttemptId,
    activeJoinAttempt,
    roomCodeInput,
    displayName,
    avatarPresetId,
  } = args;
  const wsUrl = resolveGameWebSocketUrl();
  const normalized = normalizeRoomCode(roomCodeInput);

  const [state, setState] = useState<GuestJoinLobbyState>({ status: "idle" });
  const [transport, setTransport] = useState<LobbyTransportPhase>("idle");
  const [connectionReason, setConnectionReason] = useState<LobbyConnectionReason>("first");
  const [transportErrorMessage, setTransportErrorMessage] = useState<string | undefined>(
    undefined,
  );

  const reachedJoinedRef = useRef(false);
  const closedWhileJoinedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);

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

  /* eslint-disable react-hooks/set-state-in-effect -- WebSocket subscription: transport and join state track open/message/error/close. */
  useEffect(() => {
    if (!activeJoinAttempt) {
      reachedJoinedRef.current = false;
      closedWhileJoinedRef.current = false;
      return;
    }

    if (!wsUrl) {
      return;
    }

    if (!isValidRoomCodeForJoin(normalized)) {
      return;
    }

    reachedJoinedRef.current = false;
    setTransportErrorMessage(undefined);

    const retryAfterJoinedDrop = closedWhileJoinedRef.current;
    setConnectionReason(retryAfterJoinedDrop ? "after-drop" : "first");
    setTransport(retryAfterJoinedDrop ? "reconnecting" : "connecting");

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    let closedByCleanup = false;

    function fail(message: string) {
      if (!closedByCleanup && !reachedJoinedRef.current) {
        setTransport("fatal");
        setTransportErrorMessage(message);
        setState({ status: "error", message });
      }
    }

    ws.addEventListener("open", () => {
      setTransport("live");
      try {
        ws.send(
          serializeJoinRoomCommand(normalized, displayName, avatarPresetId),
        );
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
          closedWhileJoinedRef.current = false;
          setState({
            status: "joined",
            roomId: parsed.data.roomId,
            roomCode: parsed.data.roomCode,
            phase: parsed.data.phase,
            playerCount: parsed.data.playerCount,
            playerId: parsed.data.playerId,
            displayName: parsed.data.displayName,
            avatarPresetId: parsed.data.avatarPresetId,
            players: [],
            wordChoiceOffer: null,
            wordChoicePickError: null,
          });
          setTransport("live");
          return;
        case "lobbyRoster": {
          const roster = parsed.data;
          setState((prev) => {
            if (prev.status !== "joined") return prev;
            if (roster.roomId !== prev.roomId) return prev;
            return {
              ...prev,
              players: roster.players,
              playerCount: roster.players.length,
            };
          });
          return;
        }
        case "matchPhase": {
          const mp = parsed.data;
          setState((prev) => {
            if (prev.status !== "joined") return prev;
            if (mp.roomId !== prev.roomId) return prev;
            let wordChoiceOffer = prev.wordChoiceOffer;
            let wordChoicePickError = prev.wordChoicePickError;
            if (mp.phase !== "choosingWord") {
              wordChoiceOffer = null;
              wordChoicePickError = null;
            } else if (
              mp.matchRoundIndex !== undefined &&
              prev.matchRoundIndex !== undefined &&
              mp.matchRoundIndex !== prev.matchRoundIndex
            ) {
              wordChoiceOffer = null;
              wordChoicePickError = null;
            }
            return {
              ...prev,
              phase: mp.phase,
              drawerPlayerId: mp.drawerPlayerId ?? prev.drawerPlayerId,
              matchRoundIndex:
                mp.matchRoundIndex !== undefined
                  ? mp.matchRoundIndex
                  : prev.matchRoundIndex,
              phaseDeadlineMs:
                mp.phaseDeadlineMs !== undefined ? mp.phaseDeadlineMs : undefined,
              wordChoiceOffer,
              wordChoicePickError,
            };
          });
          return;
        }
        case "wordChoiceOffer": {
          const o = parsed.data;
          setState((prev) => {
            if (prev.status !== "joined") return prev;
            if (o.roomId !== prev.roomId) return prev;
            if (prev.phase !== "choosingWord") return prev;
            if (prev.playerId !== prev.drawerPlayerId) return prev;
            if (
              prev.matchRoundIndex !== undefined &&
              o.matchRoundIndex !== prev.matchRoundIndex
            ) {
              return prev;
            }
            return {
              ...prev,
              wordChoiceOffer: {
                words: o.words,
                phaseDeadlineMs: o.phaseDeadlineMs,
                matchRoundIndex: o.matchRoundIndex,
              },
              wordChoicePickError: null,
            };
          });
          return;
        }
        case "matchStarting": {
          const match = parsed.data;
          setState((prev) => {
            if (prev.status !== "joined") return prev;
            if (match.roomId !== prev.roomId) return prev;
            return {
              ...prev,
              phase: match.phase,
            };
          });
          return;
        }
        case "error": {
          const errEv = parsed.data;
          if (errEv.type !== "error") return;
          const code = errEv.code;
          if (!reachedJoinedRef.current) {
            setTransport("fatal");
            setTransportErrorMessage(messageForProtocolErrorCode(code));
            setState({
              status: "error",
              message: messageForProtocolErrorCode(code),
              protocolCode: code,
            });
            return;
          }
          if (TERMINAL_PROTOCOL_CODES_AFTER_JOINED.has(code)) {
            reachedJoinedRef.current = false;
            setTransport("fatal");
            setTransportErrorMessage(messageForProtocolErrorCode(code));
            setState({
              status: "error",
              message: messageForProtocolErrorCode(code),
              protocolCode: code,
            });
            return;
          }
          const wordPickRecoverable = new Set([
            "NOT_DRAWER",
            "BAD_CHOICE",
            "ALREADY_CHOSE",
            "NO_WORD_OFFER",
            "WRONG_PHASE",
          ]);
          if (wordPickRecoverable.has(code)) {
            setState((prev) => {
              if (prev.status !== "joined") return prev;
              return {
                ...prev,
                wordChoicePickError: messageForProtocolErrorCode(code),
              };
            });
            return;
          }
          return;
        }
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
      if (reachedJoinedRef.current) return;
      fail(transportOpenFailedMessage);
    });

    ws.addEventListener("close", () => {
      if (closedByCleanup) return;
      if (reachedJoinedRef.current) {
        closedWhileJoinedRef.current = true;
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
  }, [
    activeJoinAttempt,
    connectionAttemptId,
    normalized,
    wsUrl,
    displayName,
    avatarPresetId,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const chooseWord = useCallback((choiceIndex: 0 | 1 | 2) => {
    const w = wsRef.current;
    if (!w || w.readyState !== WebSocket.OPEN) return;
    setState((prev) =>
      prev.status === "joined" ? { ...prev, wordChoicePickError: null } : prev,
    );
    try {
      w.send(serializeChooseWordCommand(choiceIndex));
    } catch {
      setState((prev) =>
        prev.status === "joined"
          ? { ...prev, wordChoicePickError: "Could not send choice. Try again." }
          : prev,
      );
    }
  }, []);

  if (!activeJoinAttempt) {
    return {
      state: { status: "idle" },
      transport: "idle",
      connectionReason: "first",
      transportErrorMessage: undefined,
      awaitingRoomHandshake: false,
      chooseWord,
    };
  }

  if (!wsUrl) {
    return {
      state: { status: "error", message: missingGameWebSocketUrlUserMessage() },
      transport: "blocked",
      connectionReason: "first",
      transportErrorMessage: missingGameWebSocketUrlUserMessage(),
      awaitingRoomHandshake: false,
      chooseWord,
    };
  }

  const awaitingRoomHandshake = state.status === "connecting" && transport === "live";

  if (state.status === "idle") {
    return {
      state: { status: "connecting" },
      transport: transport === "idle" ? "connecting" : transport,
      connectionReason,
      transportErrorMessage,
      awaitingRoomHandshake: false,
      chooseWord,
    };
  }

  return {
    state,
    transport,
    connectionReason,
    transportErrorMessage,
    awaitingRoomHandshake,
    chooseWord,
  };
}
