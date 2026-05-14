"use client";

import type { AvatarPresetId } from "@skribbl/shared";
import {
  DEFAULT_AVATAR_PRESET_ID,
  NICKNAME_MAX_GRAPHEMES,
  assertChatMessageLength,
  countGraphemes,
  sanitizeChatMessage,
  sanitizeDisplayName,
  type LobbyChatMessageEvent,
  type RoomPhase,
} from "@skribbl/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useHostCreateRoom, type LobbyVoteKickWireEvent } from "@/features/lobby/hooks/use-host-create-room";
import { LobbyPlayerRoster } from "@/features/lobby/components/LobbyPlayerRoster";
import {
  serializeCastVoteKickCommand,
  serializeInitiateVoteKickCommand,
} from "@/lib/ws-client";
import { buildRoomInviteUrl, resolvePublicWebOrigin } from "@/lib/invite-url";
import { loadSession } from "@/features/lobby/lib/session-storage";
import { DR, chunk } from "@/features/lobby/design/tokens";
import { useLobbySettingsStore } from "@/features/lobby/stores/lobby-settings-store";
import { useLobbySettingsSync } from "@/features/lobby/hooks/use-lobby-settings";
import { CreateRoomForm } from "@/features/lobby/components/CreateRoomForm";
import { LobbyDrWaitingRoom } from "@/features/lobby/components/LobbyDrWaitingRoom";
import type { LobbyDrChatMessage } from "@/features/lobby/components/LobbyDrWaitingRoom";
import { messageForProtocolErrorCode } from "@/features/lobby/lib/protocol-error-message";
import {
  clipboardFailureMessage,
  copyToClipboard,
} from "@/features/lobby/lib/lobby-dr-clipboard";
import { randomClientId } from "@/lib/random-client-id";

// Default accent colour — tomato from the DR palette
const ACCENT = DR.accent.tomato;
type ChatMessage = LobbyDrChatMessage;

export function LobbyHostPage() {
  const router = useRouter();
  const [nicknameRaw, setNicknameRaw] = useState("");
  const [avatarId, setAvatarId] = useState<AvatarPresetId>(
    DEFAULT_AVATAR_PRESET_ID,
  );
  const [submitted, setSubmitted] = useState(false);
  const [attemptId, setAttemptId] = useState(0);

  const nicknameTrimmed = nicknameRaw.trim();
  const nicknameSanitized = sanitizeDisplayName(nicknameTrimmed);
  const nicknameEmpty = submitted && nicknameTrimmed.length === 0;
  const nicknameTooLong =
    submitted &&
    nicknameTrimmed.length > 0 &&
    nicknameSanitized.length > 0 &&
    countGraphemes(nicknameSanitized) > NICKNAME_MAX_GRAPHEMES;
  const nicknameOk =
    nicknameTrimmed.length > 0 &&
    nicknameSanitized.length > 0 &&
    countGraphemes(nicknameSanitized) <= NICKNAME_MAX_GRAPHEMES;

  const shouldConnect = submitted && nicknameOk;

  const [toast, setToast] = useState<string | null>(null);
  const [voteKickActive, setVoteKickActive] = useState<{
    targetPlayerId: string;
    expiresAtMs: number;
  } | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");

  const onLobbyChatMessage = useCallback((ev: LobbyChatMessageEvent) => {
    setChatMessages((prev) => [
      ...prev,
      { id: randomClientId(), who: ev.displayName, text: ev.message },
    ]);
  }, []);

  const onLobbyProtocolNotice = useCallback((code: string) => {
    setToast(messageForProtocolErrorCode(code));
  }, []);

  const onLobbyVoteKickEvent = useCallback((ev: LobbyVoteKickWireEvent) => {
    if (ev.type === "voteKickStarted") {
      setVoteKickActive({ targetPlayerId: ev.targetPlayerId, expiresAtMs: ev.expiresAtMs });
      setToast("Vote kick started.");
      return;
    }
    if (ev.type === "voteKickResolved") {
      setVoteKickActive(null);
      if (ev.reason === "target_left") setToast("Vote ended — target left the lobby.");
      else if (ev.outcome === "kicked") setToast("Player removed by vote.");
      else if (ev.outcome === "expired") setToast("Vote kick timed out.");
      else setToast("Vote kick did not pass.");
      return;
    }
    setVoteKickActive(null);
  }, []);

  const {
    state,
    transport,
    startMatch,
    sendGameJsonLine,
    sendLobbyChat,
    leaveLobby,
  } = useHostCreateRoom({
    shouldConnect,
    attemptId,
    displayName: nicknameTrimmed,
    avatarPresetId: avatarId,
    onLobbyChatMessage,
    onLobbyProtocolNotice,
    onLobbyVoteKickEvent,
  });

  const bumpConnectionAttempt = useCallback(() => {
    setAttemptId((n) => n + 1);
  }, []);

  const reloadFullPage = useCallback(() => {
    if (typeof window !== "undefined") window.location.reload();
  }, []);

  useEffect(() => {
    if (state.status !== "lobby") return;
    if (state.phase === "lobby") return;
    router.replace("/game");
  }, [state, router]);

  useEffect(() => {
    if (state.status !== "lobby") return;
    if (state.phase !== "lobby") setVoteKickActive(null);
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Seed a system message once room code is available
  const [seededCode, setSeededCode] = useState<string | null>(null);
  useEffect(() => {
    if (state.status === "lobby" && state.roomCode && state.roomCode !== seededCode) {
      setSeededCode(state.roomCode);
      setChatMessages([{ id: randomClientId(), who: "system", text: `Room created · share the code: ${state.roomCode}`, system: true }]);
    }
  }, [state.status === "lobby" ? state.roomCode : null, seededCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevLobbyPhaseRef = useRef<RoomPhase | null>(null);
  useEffect(() => {
    if (state.status !== "lobby") return;
    const prev = prevLobbyPhaseRef.current;
    prevLobbyPhaseRef.current = state.phase;
    if (state.phase === "lobby" && prev !== null && prev !== "lobby") {
      setChatMessages([
        {
          id: randomClientId(),
          who: "system",
          text: `Back in the lobby · room code ${state.roomCode}`,
          system: true,
        },
      ]);
    }
  }, [state]);

  const maxPlayers = useLobbySettingsStore((s) => s.maxPlayers);
  const { sendSettings } = useLobbySettingsSync(sendGameJsonLine, true);

  // Auto-reconnect on page reload: if a host session exists in sessionStorage, pre-fill and connect.
  useEffect(() => {
    const session = loadSession();
    if (session?.role === "host") {
      setNicknameRaw(session.displayName);
      setAvatarId(session.avatarPresetId);
      setSubmitted(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    const trimmed = nicknameRaw.trim();
    const sanitized = sanitizeDisplayName(trimmed);
    if (
      trimmed.length === 0 ||
      sanitized.length === 0 ||
      countGraphemes(sanitized) > NICKNAME_MAX_GRAPHEMES
    ) {
      return;
    }
    setAttemptId((n) => n + 1);
  }, [nicknameRaw]);

  // ─── Pre-connect: nickname + avatar form ────────────────────────────────────
  if (!submitted || !nicknameOk) {
    const nickFieldError = nicknameEmpty
      ? "Enter a display name."
      : nicknameTooLong
        ? `Use at most ${String(NICKNAME_MAX_GRAPHEMES)} characters.`
        : null;

    return (
      <CreateRoomForm
        nicknameRaw={nicknameRaw}
        onNicknameChange={setNicknameRaw}
        avatarId={avatarId}
        onAvatarChange={setAvatarId}
        error={nickFieldError}
        onSubmit={handleCreate}
      />
    );
  }

  // ─── Connecting state ────────────────────────────────────────────────────────
  if (state.status === "connecting") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8">
        <p className="text-base-content/80">Setting up your lobby session…</p>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────────────
  if (state.status === "error") {
    if (state.protocolCode === "ALREADY_CONNECTED") {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8">
          <div role="alert" className="alert alert-warning w-full max-w-lg">
            <span>Already open in another tab — close this tab or the other one.</span>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8 gap-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-lg">
          <div className="card-body gap-4">
            <h1 className="card-title text-2xl">Could not create room</h1>
            <p className="text-base-content/80">{state.message}</p>
            <div className="card-actions justify-end flex-wrap gap-2">
              <Link href="/" className="btn btn-ghost">
                Back home
              </Link>
              {transport === "blocked" ? (
                <button type="button" className="btn btn-outline btn-primary" onClick={reloadFullPage}>
                  Reload page
                </button>
              ) : null}
              {transport === "fatal" || transport === "disconnected" ? (
                <button type="button" className="btn btn-primary" onClick={bumpConnectionAttempt}>
                  Try again
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Fallback: unknown status ─────────────────────────────────────────────
  if (state.status !== "lobby") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8">
        <p className="text-base-content/80">Setting up your lobby session…</p>
      </div>
    );
  }

  // ─── Lobby status: resolve shared values ─────────────────────────────────────
  const { roomCode } = state;
  const minPlayersOk = state.players.length >= 2;
  const canStart = state.phase === "lobby" && minPlayersOk && !state.isStartPending;
  const localPlayer = state.players.find((p) => p.playerId === state.playerId);
  const isHost = localPlayer?.isHost ?? false;

  const publicOrigin =
    resolvePublicWebOrigin() ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const inviteUrl = publicOrigin
    ? buildRoomInviteUrl(roomCode, publicOrigin)
    : `/join?code=${encodeURIComponent(roomCode)}`;

  async function handleCopy(label: "link" | "code", text: string) {
    setCopyError(null);
    try {
      await copyToClipboard(text);
      setToast(label === "link" ? "Link copied" : "Code copied");
    } catch (err) {
      setCopyError(clipboardFailureMessage(err));
    }
  }

  if (state.status === "lobby" && state.phase !== "lobby") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200 p-8">
        <p className="text-base-content/80 text-center">Opening match…</p>
      </div>
    );
  }

  // ─── DR: Lobby waiting-room layout (phase === 'lobby') ────────────────────
  const C = DR.colors;
  const ck = (x = 4, y = 5) => chunk(x, y, C.line);

  const sendChatMessage = () => {
    const trimmed = chatDraft.trim();
    if (trimmed === "") return;
    const sanitized = sanitizeChatMessage(trimmed);
    if (sanitized === "") {
      setToast(messageForProtocolErrorCode("CHAT_EMPTY"));
      return;
    }
    if (!assertChatMessageLength(sanitized).ok) {
      setToast(messageForProtocolErrorCode("MESSAGE_TOO_LONG"));
      return;
    }
    sendLobbyChat(trimmed);
    setChatDraft("");
  };

  const sidebarFooter = (
    <>
      <button
        type="button"
        onClick={() => handleCopy("link", inviteUrl)}
        aria-label="Copy invite link"
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary"
        style={{
          background: C.panel,
          border: `2px solid ${C.line}`,
          borderRadius: DR.radius.lg,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.inkDim,
            letterSpacing: ".18em",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          invite
        </span>
        <span
          style={{
            fontFamily: DR.font.mono,
            fontSize: 11,
            color: C.ink,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {inviteUrl}
        </span>
        <span
          style={{
            fontSize: 11,
            color: toast === "Link copied" ? DR.semantic.success : C.inkDim,
            flexShrink: 0,
          }}
        >
          {toast === "Link copied" ? "✓" : "⧉"}
        </span>
      </button>

      <button
        type="button"
        onClick={() => startMatch()}
        disabled={!canStart || transport !== "live"}
        aria-busy={state.isStartPending}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        style={{
          border: `3px solid ${C.line}`,
          borderRadius: 18,
          background: canStart ? ACCENT : C.soft,
          color: "#1a1714",
          padding: "18px 22px",
          fontFamily: DR.font.display,
          fontWeight: 900,
          fontSize: 22,
          boxShadow: canStart ? ck(6, 8) : "none",
          cursor: canStart && transport === "live" ? "pointer" : "not-allowed",
          opacity: canStart && transport === "live" ? 1 : 0.55,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span>
          {state.isStartPending ? "STARTING…" : canStart ? "START GAME" : "WAITING…"}
        </span>
        <span
          style={{
            fontFamily: DR.font.mono,
            fontSize: 12,
            fontWeight: 700,
            background: "rgba(0,0,0,.18)",
            padding: "4px 8px",
            borderRadius: 6,
          }}
        >
          {state.players.filter((p) => (p.connectionStatus ?? "connected") === "connected").length}
          /{state.players.length}
        </span>
      </button>

      {!minPlayersOk ? (
        <p
          style={{
            fontSize: 12,
            color: C.inkDim,
            textAlign: "center",
            margin: "-12px 0 0",
          }}
        >
          Need at least 2 players to start.
        </p>
      ) : null}
    </>
  );

  return (
    <LobbyDrWaitingRoom
      roomCode={roomCode}
      headerEyebrow={`Private lobby · #${roomCode}`}
      headerTitle={`${state.displayName}'s table`}
      localDisplayName={state.displayName}
      accentHex={ACCENT}
      toast={toast}
      codeCopiedHighlight={toast === "Code copied"}
      copyError={copyError}
      onCopyRoomCode={() => handleCopy("code", roomCode)}
      transportLive={transport === "live"}
      showLeaveLobby={state.phase === "lobby"}
      onLeaveLobby={() => leaveLobby()}
      chatMessages={chatMessages}
      chatDraft={chatDraft}
      onChatDraftChange={setChatDraft}
      onSendLobbyChat={sendChatMessage}
      chatSubmitDisabled={transport !== "live"}
      rulesIsHost={isHost}
      sendRoomSettings={sendSettings}
      playersPanel={
        <>
          <LobbyPlayerRoster
            players={state.players}
            localPlayerId={state.playerId}
            maxPlayers={maxPlayers}
            accent={ACCENT}
            onVoteKick={(targetPlayerId) => {
              if (transport !== "live") return;
              sendGameJsonLine(serializeInitiateVoteKickCommand(roomCode, targetPlayerId));
            }}
          />
          {state.phase === "lobby" && voteKickActive ? (
            <div className="mt-3 rounded-box border border-base-300 bg-base-100/80 p-3 text-sm flex flex-col gap-2">
              <span className="font-semibold text-base-content/90">Kick vote active</span>
              {voteKickActive.targetPlayerId === state.playerId ? (
                <span className="text-base-content/75">
                  Others are voting on whether you stay.
                </span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={transport !== "live"}
                    onClick={() =>
                      sendGameJsonLine(
                        serializeCastVoteKickCommand(roomCode, voteKickActive.targetPlayerId, "yes"),
                      )
                    }
                  >
                    Vote yes — remove
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={transport !== "live"}
                    onClick={() =>
                      sendGameJsonLine(
                        serializeCastVoteKickCommand(roomCode, voteKickActive.targetPlayerId, "no"),
                      )
                    }
                  >
                    Vote no — keep
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </>
      }
      sidebarFooter={sidebarFooter}
    />
  );
}
