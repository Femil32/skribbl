"use client";

import type {
  AvatarPresetId,
  CanvasReplayEvent,
  LobbyRosterPlayer,
  RoomPhase,
  ServerEvent,
} from "@skribbl/shared";
import {
  isValidRoomCodeForJoin,
  normalizeRoomCode,
  safeParseServerEvent,
} from "@skribbl/shared";
import { useLobbySettingsStore } from "@/features/lobby/stores/lobby-settings-store";
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
import { getOrCreatePlayerToken, wsUrlToHttpUrl } from "@/features/lobby/lib/player-token";
import {
  serializeChooseWordCommand,
  serializeJoinRoomCommand,
  serializeReconnectPlayerCommand,
  serializeChatMessageCommand,
} from "@/lib/ws-client";
import {
  appendDrawingHintRows,
  type MatchHintFeedRow,
} from "@/features/lobby/lib/drawing-hint-rows";
import {
  mergeCanvasReplayBySeq,
  mergeChatFeedWithHydrateTail,
} from "@/features/lobby/lib/hydrate-merge";
import {
  clearSession,
  loadSession,
  saveSession,
} from "@/features/lobby/lib/session-storage";

type ChatFeedEvent = Extract<
  ServerEvent,
  | { type: "chatPlayerMessage" }
  | { type: "chatSystemMessage" }
  | { type: "chatCorrectGuess" }
>;

const MAX_CHAT_FEED = 400;

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
      /** Replay buffer (Story 3.5–3.6); cleared on lobby or new match round. */
      remoteCanvasCommits: CanvasReplayEvent[];
      drawingHintRows: MatchHintFeedRow[];
      chatFeed: ChatFeedEvent[];
      closeGuessHint: { message: string; id: string } | null;
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
  sendGameJsonLine: (raw: string) => void;
  sendChat: (text: string) => void;
};

/**
 * Opens one WebSocket, sends **`joinRoom`** via **`serializeJoinRoomCommand`**, demuxes with
 * **`safeParseServerEvent`**. Keeps the socket open after **`roomJoined`** for lobby roster /
 * match start events (Story 1.6+).
 */
/** Avoid unbounded `remoteCanvasCommits` growth during long drawing phases. */
const MAX_REMOTE_CANVAS_COMMITS_BUFFER = 8192;

const TERMINAL_PROTOCOL_CODES_AFTER_JOINED = new Set([
  "BAD_PAYLOAD",
  "INTERNAL",
  "JOIN_NOT_ALLOWED",
  "HOST_SESSION_LOST",
  "HOST_RECLAIM_DENIED",
  "ALREADY_CONNECTED",
  "NO_STASHED_SESSION",
  "HOST_USE_RECONNECT_HOST",
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
  const joinedRoomIdRef = useRef<string | null>(null);
  const frozenIdentityRef = useRef<{ displayName: string; avatarPresetId: AvatarPresetId } | null>(null);
  /** True when the current connect attempt is a page-reload reconnect from sessionStorage. */
  const pageReloadReconnectRef = useRef(false);
  const guestResumeContextRef = useRef<{
    roomId: string;
    playerId: string;
    roomCode: string;
    displayName: string;
    avatarPresetId: AvatarPresetId;
  } | null>(null);

  const sendGameJsonLine = useCallback((raw: string) => {
    const w = wsRef.current;
    if (!w || w.readyState !== WebSocket.OPEN) return;
    try {
      w.send(raw);
    } catch {
      /* ignore */
    }
  }, []);

  const sendChat = useCallback((text: string) => {
    const w = wsRef.current;
    if (!w || w.readyState !== WebSocket.OPEN) return;
    const rid = joinedRoomIdRef.current;
    if (!rid) return;
    try {
      w.send(serializeChatMessageCommand(rid, text));
    } catch {
      /* ignore */
    }
  }, []);

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
      joinedRoomIdRef.current = null;
      guestResumeContextRef.current = null;
      pageReloadReconnectRef.current = false;
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

    // On fresh page-load (not transport-drop): check sessionStorage for saved guest session.
    if (!retryAfterJoinedDrop && !pageReloadReconnectRef.current) {
      const stored = loadSession();
      if (stored?.role === "guest" && stored.roomCode === normalized) {
        guestResumeContextRef.current = {
          roomId: stored.roomId,
          playerId: stored.playerId,
          roomCode: stored.roomCode,
          displayName: stored.displayName,
          avatarPresetId: stored.avatarPresetId,
        };
        pageReloadReconnectRef.current = true;
      }
    }

    const isReconnecting = retryAfterJoinedDrop || pageReloadReconnectRef.current;
    setConnectionReason(retryAfterJoinedDrop ? "after-drop" : "first");
    setTransport(isReconnecting && guestResumeContextRef.current ? "reconnecting" : "connecting");

    let closedByCleanup = false;

    void (async () => {
      // Best-effort: resolve player token before opening WS
      const { token } = await getOrCreatePlayerToken(wsUrlToHttpUrl(wsUrl));

      if (closedByCleanup) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

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
        const resume = isReconnecting ? guestResumeContextRef.current : null;
        if (resume) {
          ws.send(
            serializeReconnectPlayerCommand(
              resume.roomId,
              resume.playerId,
              resume.displayName,
              resume.avatarPresetId,
              token || undefined,
            ),
          );
        } else {
          ws.send(serializeJoinRoomCommand(normalized, displayName, avatarPresetId, token || undefined));
        }
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
          pageReloadReconnectRef.current = false;
          guestResumeContextRef.current = {
            roomId: parsed.data.roomId,
            playerId: parsed.data.playerId,
            roomCode: parsed.data.roomCode,
            displayName: parsed.data.displayName,
            avatarPresetId: parsed.data.avatarPresetId,
          };
          frozenIdentityRef.current = {
            displayName: parsed.data.displayName,
            avatarPresetId: parsed.data.avatarPresetId,
          };
          saveSession({
            roomId: parsed.data.roomId,
            roomCode: parsed.data.roomCode,
            playerId: parsed.data.playerId,
            displayName: parsed.data.displayName,
            avatarPresetId: parsed.data.avatarPresetId,
            role: "guest",
          });
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
            remoteCanvasCommits: [],
            drawingHintRows: [],
            chatFeed: [],
            closeGuessHint: null,
          });
          useLobbySettingsStore.setState(parsed.data.settings);
          joinedRoomIdRef.current = parsed.data.roomId;
          setTransport("live");
          return;
        case "settingsUpdated": {
          useLobbySettingsStore.setState(parsed.data.settings);
          return;
        }
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
            const drawerPlayerId =
              mp.phase === "matchEnded" || mp.phase === "lobby"
                ? undefined
                : mp.drawerPlayerId !== undefined
                  ? mp.drawerPlayerId
                  : prev.drawerPlayerId;
            const matchRoundIndex =
              mp.phase === "lobby"
                ? undefined
                : mp.matchRoundIndex !== undefined
                  ? mp.matchRoundIndex
                  : prev.matchRoundIndex;
            const phaseDeadlineMs =
              mp.phaseDeadlineMs !== undefined ? mp.phaseDeadlineMs : undefined;

            let nextCommits = prev.remoteCanvasCommits;
            let drawingHintRows = prev.drawingHintRows;
            let chatFeed = prev.chatFeed;
            let closeGuessHint = prev.closeGuessHint;
            const roundBump =
              prev.matchRoundIndex !== undefined &&
              mp.matchRoundIndex !== undefined &&
              mp.matchRoundIndex !== prev.matchRoundIndex;

            if (mp.phase === "lobby") {
              nextCommits = [];
              drawingHintRows = [];
              chatFeed = [];
              closeGuessHint = null;
            } else if (roundBump) {
              nextCommits = [];
              drawingHintRows = [];
              closeGuessHint = null;
            } else if (mp.phase !== "drawing") {
              drawingHintRows = [];
              closeGuessHint = null;
            }

            return {
              ...prev,
              phase: mp.phase,
              drawerPlayerId,
              matchRoundIndex,
              phaseDeadlineMs,
              wordChoiceOffer,
              wordChoicePickError,
              remoteCanvasCommits: nextCommits,
              drawingHintRows,
              chatFeed,
              closeGuessHint,
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
            pageReloadReconnectRef.current = false;
            // NO_STASHED_SESSION: lobby-phase guest — keep session, page falls back to joinRoom.
            // ALREADY_CONNECTED: keep session — other tab may close.
            if (code !== "NO_STASHED_SESSION" && code !== "ALREADY_CONNECTED") {
              clearSession();
              guestResumeContextRef.current = null;
            }
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
            if (code !== "ALREADY_CONNECTED") {
              clearSession();
            }
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
          // Unknown post-join error — surface as a banner message without clearing state.
          setTransportErrorMessage(messageForProtocolErrorCode(code));
          return;
        }
        case "drawingHintTick": {
          const h = parsed.data;
          setState((prev) => {
            if (prev.status !== "joined") return prev;
            if (h.roomId !== prev.roomId) return prev;
            if (prev.phase !== "drawing") return prev;
            if (prev.matchRoundIndex !== h.matchRoundIndex) {
              return prev;
            }
            const row: MatchHintFeedRow = {
              hintIndex: h.hintIndex,
              maskedWord: h.maskedWord,
              totalLetters: h.totalLetters,
              revealedLetterCount: h.revealedLetterCount,
            };
            return {
              ...prev,
              drawingHintRows: appendDrawingHintRows(prev.drawingHintRows, row),
            };
          });
          return;
        }
        case "pong":
        case "roomCreated":
          return;
        case "drawingStrokeCommitted":
        case "drawingCanvasOpCommitted": {
          const canvasEv = parsed.data;
          setState((prev) => {
            if (prev.status !== "joined") return prev;
            if (canvasEv.roomId !== prev.roomId) return prev;
            return {
              ...prev,
              remoteCanvasCommits: [
                ...prev.remoteCanvasCommits,
                canvasEv,
              ].slice(-MAX_REMOTE_CANVAS_COMMITS_BUFFER),
            };
          });
          return;
        }
        case "chatPlayerMessage":
        case "chatSystemMessage":
        case "chatCorrectGuess": {
          const chatEv = parsed.data;
          setState((prev) => {
            if (prev.status !== "joined") return prev;
            if (chatEv.roomId !== prev.roomId) return prev;
            return {
              ...prev,
              chatFeed: [...prev.chatFeed, chatEv].slice(-MAX_CHAT_FEED),
            };
          });
          return;
        }
        case "chatCloseGuessHint": {
          const hint = parsed.data;
          setState((prev) => {
            if (prev.status !== "joined") return prev;
            if (hint.roomId !== prev.roomId) return prev;
            if (
              prev.phase !== "drawing" ||
              prev.matchRoundIndex !== hint.matchRoundIndex
            ) {
              return prev;
            }
            return {
              ...prev,
              closeGuessHint: { message: hint.message, id: hint.id },
            };
          });
          return;
        }
        case "roomHydrate": {
          const h = parsed.data;
          setState((prev) => {
            if (prev.status !== "joined") return prev;
            if (h.roomId !== prev.roomId) return prev;
            return {
              ...prev,
              remoteCanvasCommits: mergeCanvasReplayBySeq(
                prev.remoteCanvasCommits,
                h.canvasCommits,
                MAX_REMOTE_CANVAS_COMMITS_BUFFER,
              ),
              chatFeed: mergeChatFeedWithHydrateTail(prev.chatFeed, h.chatTail, MAX_CHAT_FEED),
              closeGuessHint: null,
            };
          });
          return;
        }
        case "canvasOpLogResync": {
          const r = parsed.data;
          setState((prev) => {
            if (prev.status !== "joined") return prev;
            if (r.roomId !== prev.roomId) return prev;
            return { ...prev, remoteCanvasCommits: [] };
          });
          return;
        }
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
    })(); // end async IIFE

    return () => {
      closedByCleanup = true;
      const w = wsRef.current;
      wsRef.current = null;
      w?.close();
    };
  }, [
    activeJoinAttempt,
    connectionAttemptId,
    normalized,
    wsUrl,
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
      sendGameJsonLine,
      sendChat,
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
      sendGameJsonLine,
      sendChat,
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
      sendGameJsonLine,
      sendChat,
    };
  }

  return {
    state,
    transport,
    connectionReason,
    transportErrorMessage,
    awaitingRoomHandshake,
    chooseWord,
    sendGameJsonLine,
    sendChat,
  };
}
