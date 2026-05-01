"use client";

import type {
  AvatarPresetId,
  CanvasReplayEvent,
  LobbyRosterPlayer,
  RoomPhase,
  ServerEvent,
} from "@skribbl/shared";
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
  serializeResumeSessionCommand,
  serializeStartMatchCommand,
  serializeChooseWordCommand,
  serializeReturnToLobbyCommand,
  serializeChatMessageCommand,
} from "@/lib/ws-client";
import {
  appendDrawingHintRows,
  type MatchHintFeedRow,
} from "@/features/lobby/lib/drawing-hint-rows";
import {
  clearLastActiveHostRoom,
  clearPersistedRoomSession,
  loadLastActiveHostRoom,
  persistLastActiveHostRoom,
  persistRoomSession,
} from "@/features/lobby/lib/persist-room-session";

type ChatFeedEvent = Extract<
  ServerEvent,
  | { type: "chatPlayerMessage" }
  | { type: "chatSystemMessage" }
  | { type: "chatCorrectGuess" }
>;

const MAX_CHAT_FEED = 400;

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
      /** Server match meta (Story 2.2+). */
      drawerPlayerId?: string;
      matchRoundIndex?: number;
      /** Unix ms when current timed phase ends (from **`matchPhase`**, Story 2.4). Cleared when absent. */
      phaseDeadlineMs?: number;
      /** Offer payload — drawer only; cleared when phase leaves `choosingWord`. */
      wordChoiceOffer?: {
        words: readonly [string, string, string];
        phaseDeadlineMs: number;
        matchRoundIndex: number;
      } | null;
      wordChoicePickError?: string | null;
      /** Replay buffer for peers (Story 3.5–3.6) — strokes + canvas ops; cleared on lobby or new match round. */
      remoteCanvasCommits: CanvasReplayEvent[];
      /** Bounded rows from **`drawingHintTick`** (Story 2.5); cleared leaving `drawing` or on round mismatch. */
      drawingHintRows: MatchHintFeedRow[];
      /** Live chat tail (Epic 4); cleared when returning to pre-match `lobby`. */
      chatFeed: ChatFeedEvent[];
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
  /** Send drawer word pick (no-op unless lobby socket open). */
  chooseWord: (choiceIndex: 0 | 1 | 2) => void;
  /** Host-only: return from `matchEnded` to lobby (Story 2.7). */
  returnToLobby: () => void;
  /** Raw JSON line for drawing commands (open socket only). */
  sendGameJsonLine: (raw: string) => void;
  /** Send a chat line / guess (Epic 4). */
  sendChat: (text: string) => void;
};

/** Avoid unbounded `remoteCanvasCommits` growth during long drawing phases. */
const MAX_REMOTE_CANVAS_COMMITS_BUFFER = 8192;

const TERMINAL_PROTOCOL_CODES_AFTER_LOBBY = new Set([
  "BAD_PAYLOAD",
  "INTERNAL",
  "JOIN_NOT_ALLOWED",
  "UNKNOWN_ROOM",
  "ROOM_FULL",
  "HOST_SESSION_LOST",
  "HOST_RECLAIM_DENIED",
  "INVALID_SESSION",
  "ALREADY_CONNECTED",
]);

type HostResumeContext = {
  roomId: string;
  roomCode: string;
  playerId: string;
  reconnectToken: string;
  displayName: string;
  avatarPresetId: AvatarPresetId;
  lastPhase: RoomPhase;
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
    const rid = hostResumeContextRef.current?.roomId;
    if (!rid) return;
    try {
      w.send(serializeChatMessageCommand(rid, text));
    } catch {
      /* ignore */
    }
  }, []);
  /** Set when the socket closes after the host reached the lobby; drives “reconnecting” copy on retry. */
  const closedWhileInLobbyRef = useRef(false);
  /** Latest successful handshake — Story 5.1 `resumeSession` after drop or reload. */
  const hostResumeContextRef = useRef<HostResumeContext | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPageHide = () => {
      if (!reachedLobbyRef.current || !hostResumeContextRef.current) return;
      try {
        sessionStorage.setItem(
          "skribbl:intent-host-resume-room",
          hostResumeContextRef.current.roomId,
        );
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

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
    const intentRoomId =
      typeof window !== "undefined"
        ? sessionStorage.getItem("skribbl:intent-host-resume-room")
        : null;
    let resumeHostCtx = retryAfterLobbyDrop ? hostResumeContextRef.current : null;
    let resumedFromCold = false;

    if (!resumeHostCtx && intentRoomId) {
      const persisted = loadLastActiveHostRoom();
      if (
        persisted &&
        persisted.kind === "host" &&
        persisted.roomId === intentRoomId &&
        persisted.reconnectToken.length >= 16
      ) {
        resumeHostCtx = {
          roomId: persisted.roomId,
          roomCode: persisted.roomCode,
          playerId: persisted.playerId,
          reconnectToken: persisted.reconnectToken,
          displayName: persisted.displayName,
          avatarPresetId: persisted.avatarPresetId,
          lastPhase: persisted.lastPhase,
        };
        hostResumeContextRef.current = resumeHostCtx;
        try {
          sessionStorage.removeItem("skribbl:intent-host-resume-room");
        } catch {
          /* ignore */
        }
        resumedFromCold = true;
      }
    }

    const afterDropUx = retryAfterLobbyDrop || resumedFromCold;

    setConnectionReason(afterDropUx ? "after-drop" : "first");
    setTransport(afterDropUx ? "reconnecting" : "connecting");
    if (!afterDropUx) {
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
        if (resumeHostCtx) {
          ws.send(
            serializeResumeSessionCommand(
              resumeHostCtx.roomId,
              resumeHostCtx.playerId,
              resumeHostCtx.reconnectToken,
              resumeHostCtx.displayName,
              resumeHostCtx.avatarPresetId,
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
            roomCode: parsed.data.roomCode,
            playerId: parsed.data.playerId,
            reconnectToken: parsed.data.reconnectToken,
            displayName: parsed.data.displayName,
            avatarPresetId: parsed.data.avatarPresetId,
            lastPhase: parsed.data.phase,
          };
          persistRoomSession({
            kind: "host",
            roomId: parsed.data.roomId,
            roomCode: parsed.data.roomCode,
            playerId: parsed.data.playerId,
            reconnectToken: parsed.data.reconnectToken,
            displayName: parsed.data.displayName,
            avatarPresetId: parsed.data.avatarPresetId,
            lastPhase: parsed.data.phase,
          });
          persistLastActiveHostRoom({
            kind: "host",
            roomId: parsed.data.roomId,
            roomCode: parsed.data.roomCode,
            playerId: parsed.data.playerId,
            reconnectToken: parsed.data.reconnectToken,
            displayName: parsed.data.displayName,
            avatarPresetId: parsed.data.avatarPresetId,
            lastPhase: parsed.data.phase,
          });
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
            wordChoiceOffer: null,
            wordChoicePickError: null,
            remoteCanvasCommits: [],
            drawingHintRows: [],
            chatFeed: [],
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
        case "matchPhase": {
          const mp = parsed.data;
          setState((prev) => {
            if (prev.status !== "lobby") return prev;
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
            const roundBump =
              prev.matchRoundIndex !== undefined &&
              mp.matchRoundIndex !== undefined &&
              mp.matchRoundIndex !== prev.matchRoundIndex;

            if (mp.phase === "lobby") {
              nextCommits = [];
              drawingHintRows = [];
              chatFeed = [];
            } else if (roundBump) {
              nextCommits = [];
              drawingHintRows = [];
            } else if (mp.phase !== "drawing") {
              drawingHintRows = [];
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
              ...(mp.phase === "lobby" ? { isStartPending: false } : {}),
            };
          });
          return;
        }
        case "wordChoiceOffer": {
          const o = parsed.data;
          setState((prev) => {
            if (prev.status !== "lobby") return prev;
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
              err.code === "UNKNOWN_ROOM" ||
              err.code === "ROOM_FULL" ||
              err.code === "HOST_SESSION_LOST" ||
              err.code === "HOST_RECLAIM_DENIED" ||
              err.code === "ALREADY_CONNECTED" ||
              err.code === "INVALID_SESSION"
            ) {
              const rid = hostResumeContextRef.current?.roomId;
              hostResumeContextRef.current = null;
              closedWhileInLobbyRef.current = false;
              if (rid) clearPersistedRoomSession(rid);
              clearLastActiveHostRoom();
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
            const rid = hostResumeContextRef.current?.roomId;
            hostResumeContextRef.current = null;
            closedWhileInLobbyRef.current = false;
            reachedLobbyRef.current = false;
            if (rid) clearPersistedRoomSession(rid);
            clearLastActiveHostRoom();
            setTransport("fatal");
            setTransportErrorMessage(messageForProtocolErrorCode(err.code));
            setState({
              status: "error",
              message: messageForProtocolErrorCode(err.code),
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
          if (wordPickRecoverable.has(err.code)) {
            setState((prev) => {
              if (prev.status !== "lobby") return prev;
              return {
                ...prev,
                wordChoicePickError: messageForProtocolErrorCode(err.code),
              };
            });
            return;
          }
          setState((prev) => {
            if (prev.status !== "lobby") return prev;
            return { ...prev, isStartPending: false };
          });
          return;
        }
        case "drawingHintTick": {
          const h = parsed.data;
          setState((prev) => {
            if (prev.status !== "lobby") return prev;
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
        case "roomJoined":
          return;
        case "drawingStrokeCommitted":
        case "drawingCanvasOpCommitted": {
          const canvasEv = parsed.data;
          setState((prev) => {
            if (prev.status !== "lobby") return prev;
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
            if (prev.status !== "lobby") return prev;
            if (chatEv.roomId !== prev.roomId) return prev;
            return {
              ...prev,
              chatFeed: [...prev.chatFeed, chatEv].slice(-MAX_CHAT_FEED),
            };
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

  useEffect(() => {
    if (state.status !== "lobby") return;
    const ctx = hostResumeContextRef.current;
    if (!ctx || ctx.roomId !== state.roomId) return;
    if (ctx.lastPhase === state.phase) return;
    ctx.lastPhase = state.phase;
    const pack = {
      kind: "host" as const,
      roomId: ctx.roomId,
      roomCode: state.roomCode,
      playerId: ctx.playerId,
      reconnectToken: ctx.reconnectToken,
      displayName: ctx.displayName,
      avatarPresetId: ctx.avatarPresetId,
      lastPhase: state.phase,
    };
    persistRoomSession(pack);
    persistLastActiveHostRoom(pack);
  }, [state]);

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

  const chooseWord = useCallback((choiceIndex: 0 | 1 | 2) => {
    const w = wsRef.current;
    if (!w || w.readyState !== WebSocket.OPEN) return;
    setState((prev) =>
      prev.status === "lobby" ? { ...prev, wordChoicePickError: null } : prev,
    );
    try {
      w.send(serializeChooseWordCommand(choiceIndex));
    } catch {
      setState((prev) =>
        prev.status === "lobby"
          ? { ...prev, wordChoicePickError: "Could not send choice. Try again." }
          : prev,
      );
    }
  }, []);

  const returnToLobby = useCallback(() => {
    const w = wsRef.current;
    if (!w || w.readyState !== WebSocket.OPEN) return;
    try {
      w.send(serializeReturnToLobbyCommand());
    } catch {
      /* ignore */
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
      chooseWord,
      returnToLobby,
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
      startMatch,
      chooseWord,
      returnToLobby,
      sendGameJsonLine,
      sendChat,
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
      chooseWord,
      returnToLobby,
      sendGameJsonLine,
      sendChat,
    };
  }

  return {
    state,
    transport,
    connectionReason,
    transportErrorMessage,
    awaitingRoomHandshake: awaitingHandshake,
    startMatch,
    chooseWord,
    returnToLobby,
    sendGameJsonLine,
    sendChat,
  };
}
