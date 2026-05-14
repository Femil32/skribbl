"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AvatarPresetId } from "@skribbl/shared";
import {
  DEFAULT_AVATAR_PRESET_ID,
  NICKNAME_MAX_GRAPHEMES,
  assertChatMessageLength,
  countGraphemes,
  isMatchFlowPhase,
  isValidRoomCodeForJoin,
  normalizeRoomCode,
  sanitizeChatMessage,
  sanitizeDisplayName,
  type LobbyChatMessageEvent,
} from "@skribbl/shared";
import { messageForProtocolErrorCode } from "@/features/lobby/lib/protocol-error-message";
import { useGuestJoinRoom } from "@/features/lobby/hooks/use-guest-join-room";
import type { LobbyVoteKickWireEvent } from "@/features/lobby/hooks/use-host-create-room";
import { useLobbySettingsSync } from "@/features/lobby/hooks/use-lobby-settings";
import { useLobbySettingsStore } from "@/features/lobby/stores/lobby-settings-store";
import {
  serializeCastVoteKickCommand,
  serializeInitiateVoteKickCommand,
} from "@/lib/ws-client";
import { buildRoomInviteUrl, resolvePublicWebOrigin } from "@/lib/invite-url";
import {
  clipboardFailureMessage,
  copyToClipboard,
} from "@/features/lobby/lib/lobby-dr-clipboard";
import { LobbyConnectionBanner } from "@/features/lobby/components/LobbyConnectionBanner";
import { LobbyPlayerRoster } from "@/features/lobby/components/LobbyPlayerRoster";
import { LobbyDrWaitingRoom } from "@/features/lobby/components/LobbyDrWaitingRoom";
import { CreateRoomForm } from "@/features/lobby/components/CreateRoomForm";
import { MatchDrawingColumn } from "@/features/game/components/MatchDrawingColumn";
import { PhaseBar } from "@/features/match/components/PhaseBar";
import { ScoreboardSummary } from "@/features/match/components/ScoreboardSummary";
import { MatchHintFeed } from "@/features/match/components/MatchHintFeed";
import { WordChoicePanel } from "@/features/match/components/WordChoicePanel";
import { MatchChatPanel } from "@/features/match/components/MatchChatPanel";
import { loadSession } from "@/features/lobby/lib/session-storage";
import { DR, chunk } from "@/features/lobby/design/tokens";
import { randomClientId } from "@/lib/random-client-id";

const formatHintId = "join-room-code-format-hint";
const protocolErrId = "join-room-protocol-error";
const nicknameHintId = "join-room-nickname-hint";
const nicknameErrId = "join-room-nickname-error";

const JOIN_DR_ACCENT = DR.accent.tomato;

function protocolErrorRelatesToRoomCode(code: string | undefined): boolean {
  if (code === undefined) return false;
  switch (code) {
    case "BAD_CODE":
    case "UNKNOWN_ROOM":
    case "ROOM_FULL":
    case "JOIN_NOT_ALLOWED":
      return true;
    default:
      return false;
  }
}

function protocolErrorRelatesToNickname(code: string | undefined): boolean {
  if (code === undefined) return true;
  switch (code) {
    case "BAD_CODE":
    case "UNKNOWN_ROOM":
    case "ROOM_FULL":
    case "JOIN_NOT_ALLOWED":
    case "INVALID_AVATAR":
      return false;
    default:
      return true;
  }
}

type JoinRoomClientProps = {
  /** Already display-normalized on the server (`normalizeRoomCodeForDisplay`). */
  initialQueryCode: string | null;
};

/**
 * Paste-friendly join: valid **`?code=`** deep links pre-fill the code field; **`joinRoom`** is only
 * sent after display name + optional avatar preset are chosen (Story 1.5).
 */
export function JoinRoomClient({ initialQueryCode }: JoinRoomClientProps) {
  const searchParams = useSearchParams();
  const codeFromRouter = searchParams.get("code");
  const effectiveQueryRaw =
    codeFromRouter != null && codeFromRouter !== ""
      ? codeFromRouter
      : (initialQueryCode ?? "");

  const urlNormalized =
    effectiveQueryRaw === "" ? null : normalizeRoomCode(effectiveQueryRaw);

  const urlCodeValid =
    urlNormalized !== null && isValidRoomCodeForJoin(urlNormalized);

  const [typedRaw, setTypedRaw] = useState(() => {
    if (effectiveQueryRaw === "") return "";
    if (urlNormalized === null) return "";
    if (isValidRoomCodeForJoin(urlNormalized)) return "";
    return urlNormalized;
  });

  const raw = urlCodeValid ? urlNormalized! : typedRaw;

  const [manualCommitted, setManualCommitted] = useState(false);
  const [joinGeneration, setJoinGeneration] = useState(0);

  const [nicknameRaw, setNicknameRaw] = useState("");
  const [avatarId, setAvatarId] = useState<AvatarPresetId>(
    DEFAULT_AVATAR_PRESET_ID,
  );
  const [brushColor, setBrushColor] = useState("#0f172a");
  const [brushWidthPx, setBrushWidthPx] = useState(4);

  const normalized = normalizeRoomCode(raw);
  const formatOk = isValidRoomCodeForJoin(normalized);

  const nicknameTrimmed = nicknameRaw.trim();
  const nicknameSanitized = sanitizeDisplayName(nicknameTrimmed);
  const nicknameEmpty = manualCommitted && nicknameTrimmed.length === 0;
  const nicknameTooLong =
    manualCommitted &&
    nicknameTrimmed.length > 0 &&
    nicknameSanitized.length > 0 &&
    countGraphemes(nicknameSanitized) > NICKNAME_MAX_GRAPHEMES;
  const nicknameOk =
    nicknameTrimmed.length > 0 &&
    nicknameSanitized.length > 0 &&
    countGraphemes(nicknameSanitized) <= NICKNAME_MAX_GRAPHEMES;

  const activeJoinAttempt = manualCommitted && formatOk && nicknameOk;

  const [joinLobbyDraft, setJoinLobbyDraft] = useState("");
  const [guestLobbyLines, setGuestLobbyLines] = useState<
    { id: string; who: string; text: string }[]
  >([]);
  const [guestDrToast, setGuestDrToast] = useState<string | null>(null);
  const [copyJoinError, setCopyJoinError] = useState<string | null>(null);
  const [guestVoteKickActive, setGuestVoteKickActive] = useState<{
    targetPlayerId: string;
    expiresAtMs: number;
  } | null>(null);

  const onGuestLobbyChatMessage = useCallback((ev: LobbyChatMessageEvent) => {
    setGuestLobbyLines((prev) =>
      [...prev, { id: randomClientId(), who: ev.displayName, text: ev.message }].slice(-400),
    );
  }, []);

  const onGuestLobbyProtocolNotice = useCallback((code: string) => {
    setGuestDrToast(messageForProtocolErrorCode(code));
  }, []);

  const onGuestLobbyVoteKick = useCallback((ev: LobbyVoteKickWireEvent) => {
    if (ev.type === "voteKickStarted") {
      setGuestVoteKickActive({ targetPlayerId: ev.targetPlayerId, expiresAtMs: ev.expiresAtMs });
      setGuestDrToast("Vote kick started.");
      return;
    }
    if (ev.type === "voteKickResolved") {
      setGuestVoteKickActive(null);
      if (ev.reason === "target_left") setGuestDrToast("Vote ended — target left.");
      else if (ev.outcome === "kicked") setGuestDrToast("Player removed by vote.");
      else if (ev.outcome === "expired") setGuestDrToast("Vote kick timed out.");
      else setGuestDrToast("Vote kick did not pass.");
      return;
    }
    setGuestVoteKickActive(null);
  }, []);

  useEffect(() => {
    setGuestLobbyLines([]);
    setJoinLobbyDraft("");
    setGuestVoteKickActive(null);
  }, [joinGeneration]);

  useEffect(() => {
    if (!guestDrToast) return;
    const t = window.setTimeout(() => setGuestDrToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [guestDrToast]);

  const {
    state: guestState,
    transport: guestTransport,
    connectionReason: guestConnectionReason,
    transportErrorMessage: guestTransportError,
    awaitingRoomHandshake: guestAwaitingHandshake,
    chooseWord: guestChooseWord,
    sendGameJsonLine: guestSendGameJsonLine,
    sendChat: guestSendChat,
    leaveLobby: guestLeaveLobby,
  } = useGuestJoinRoom({
    activeJoinAttempt,
    connectionAttemptId: joinGeneration,
    roomCodeInput: raw,
    displayName: nicknameTrimmed,
    avatarPresetId: avatarId,
    onLobbyChatMessage: onGuestLobbyChatMessage,
    onLobbyProtocolNotice: onGuestLobbyProtocolNotice,
    onLobbyVoteKickEvent: onGuestLobbyVoteKick,
  });

  const maxPlayersLobby = useLobbySettingsStore((s) => s.maxPlayers);
  const { sendSettings: sendGuestRoomSettings } = useLobbySettingsSync(
    guestSendGameJsonLine,
    false,
  );

  const bumpGuestConnection = () => {
    setJoinGeneration((n) => n + 1);
  };

  useEffect(() => {
    if (guestState.status !== "joined") return;
    if (guestState.phase !== "lobby") setGuestVoteKickActive(null);
  }, [guestState]);

  // Track whether the current attempt is a page-reload reconnect so we can detect fallback.
  const [isPageReloadReconnect, setIsPageReloadReconnect] = useState(false);

  // Auto-reconnect on page reload: if a guest session exists matching the URL code, pre-fill and connect.
  useEffect(() => {
    const session = loadSession();
    if (session?.role === "guest" && urlNormalized && session.roomCode === urlNormalized) {
      setNicknameRaw(session.displayName);
      setAvatarId(session.avatarPresetId);
      setManualCommitted(true);
      setIsPageReloadReconnect(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // NO_STASHED_SESSION fallback: lobby-phase guest falls back to normal joinRoom.
  useEffect(() => {
    if (
      isPageReloadReconnect &&
      guestState.status === "error" &&
      guestState.protocolCode === "NO_STASHED_SESSION"
    ) {
      setIsPageReloadReconnect(false);
      setJoinGeneration((n) => n + 1);
    }
  }, [isPageReloadReconnect, guestState]);

  const reloadFullPage = useCallback(() => {
    if (typeof window !== "undefined") window.location.reload();
  }, []);

  const connecting = guestState.status === "connecting";
  const bannerErrorDetail =
    guestState.status === "error" ? guestState.message : guestTransportError;
  const bannerOnRetry =
    guestTransport === "fatal" || guestTransport === "disconnected"
      ? bumpGuestConnection
      : undefined;
  const helperFormat =
    raw.trim().length > 0 && !formatOk
      ? "After removing spaces and symbols, codes are six letters or numbers using 2–9 and A–Z (excluding O, I, and L)."
      : null;

  const protocolErrorMsg =
    guestState.status === "error" ? guestState.message : null;

  const protocolCode =
    guestState.status === "error" ? guestState.protocolCode : undefined;

  const nickFieldError = nicknameEmpty
    ? "Enter a display name."
    : nicknameTooLong
      ? `Use at most ${String(NICKNAME_MAX_GRAPHEMES)} characters.`
      : null;

  const ariaCode = [
    helperFormat ? formatHintId : null,
    protocolErrorMsg && protocolErrorRelatesToRoomCode(protocolCode)
      ? protocolErrId
      : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  const ariaNickname =
    [
      nicknameHintId,
      nickFieldError ? nicknameErrId : null,
      protocolErrorMsg && protocolErrorRelatesToNickname(protocolCode)
        ? protocolErrId
        : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setManualCommitted(true);
    if (
      !formatOk ||
      nicknameTrimmed.length === 0 ||
      nicknameSanitized.length === 0 ||
      countGraphemes(nicknameSanitized) > NICKNAME_MAX_GRAPHEMES
    ) {
      return;
    }
    setJoinGeneration((n) => n + 1);
  }

  if (guestState.status === "joined") {
    const publicOriginJoin =
      resolvePublicWebOrigin() ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const inviteUrlJoined = publicOriginJoin
      ? buildRoomInviteUrl(guestState.roomCode, publicOriginJoin)
      : `/join?code=${encodeURIComponent(guestState.roomCode)}`;

    async function handleJoinDrCopy(label: "link" | "code", text: string) {
      setCopyJoinError(null);
      try {
        await copyToClipboard(text);
        setGuestDrToast(label === "link" ? "Link copied" : "Code copied");
      } catch (err) {
        setCopyJoinError(clipboardFailureMessage(err));
      }
    }

    const sendGuestDrLobbyChat = () => {
      const trimmed = joinLobbyDraft.trim();
      if (trimmed === "" || guestTransport !== "live") return;
      const sanitized = sanitizeChatMessage(trimmed);
      if (sanitized === "") {
        setGuestDrToast(messageForProtocolErrorCode("CHAT_EMPTY"));
        return;
      }
      if (!assertChatMessageLength(sanitized).ok) {
        setGuestDrToast(messageForProtocolErrorCode("MESSAGE_TOO_LONG"));
        return;
      }
      guestSendChat(trimmed);
      setJoinLobbyDraft("");
    };

    if (guestState.phase === "lobby") {
      const hostPlayer = guestState.players.find((p) => p.isHost);
      const CJ = DR.colors;
      const ckj = (x = 4, y = 5) => chunk(x, y, CJ.line);
      const calloutJoined = (
        <div
          style={{
            background: CJ.panel2,
            border: `2px solid ${CJ.line}`,
            borderRadius: DR.radius.md,
            padding: "14px 18px",
            fontFamily: DR.font.body,
            fontSize: 14,
            lineHeight: 1.55,
            color: CJ.ink,
          }}
        >
          <strong>Joining someone else&apos;s room.</strong>{" "}
          <span style={{ color: CJ.inkDim }}>Hosted by </span>
          <span style={{ fontWeight: 800 }}>{hostPlayer?.displayName ?? "another player"}</span>
          .
          {" "}You&apos;re at the table as{" "}
          <span style={{ fontWeight: 800 }}>{guestState.displayName}</span>
          {" "}— chill in pre-game until the host presses start.
        </div>
      );

      const guestSidebarFooterJoined = (
        <>
          <button
            type="button"
            onClick={() => handleJoinDrCopy("link", inviteUrlJoined)}
            aria-label="Copy invite link"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary"
            style={{
              background: CJ.panel,
              border: `2px solid ${CJ.line}`,
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
                color: CJ.inkDim,
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
                color: CJ.ink,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {inviteUrlJoined}
            </span>
            <span
              style={{
                fontSize: 11,
                color:
                  guestDrToast === "Link copied" ? DR.semantic.success : CJ.inkDim,
                flexShrink: 0,
              }}
            >
              {guestDrToast === "Link copied" ? "✓" : "⧉"}
            </span>
          </button>
          <p
            style={{
              fontSize: 12,
              color: CJ.inkDim,
              textAlign: "center",
              margin: 0,
            }}
          >
            Only the host can start — you&apos;ll jump in automatically.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "center",
            }}
          >
            <Link
              href="/"
              style={{
                border: `2.5px solid ${CJ.line}`,
                borderRadius: 14,
                background: "transparent",
                color: CJ.ink,
                padding: "10px 16px",
                fontWeight: 800,
                fontSize: 13,
                fontFamily: DR.font.body,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Home
            </Link>
            <Link
              href="/lobby"
              style={{
                border: `3px solid ${CJ.line}`,
                borderRadius: 14,
                background: JOIN_DR_ACCENT,
                color: "#1a1714",
                padding: "10px 16px",
                fontWeight: 900,
                fontSize: 13,
                fontFamily: DR.font.display,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                boxShadow: ckj(3, 4),
              }}
            >
              Create a room →
            </Link>
          </div>
        </>
      );

      return (
        <>
          {guestTransport !== "live" ? (
            <LobbyConnectionBanner
              transport={guestTransport}
              reason={guestConnectionReason}
              errorMessage={
                guestTransport === "blocked" || guestTransport === "fatal"
                  ? bannerErrorDetail
                  : undefined
              }
              awaitingRoomHandshake={false}
              onRetry={
                guestTransport === "disconnected" ? bumpGuestConnection : undefined
              }
              onReload={guestTransport === "blocked" ? reloadFullPage : undefined}
            />
          ) : null}
          <LobbyDrWaitingRoom
            callout={calloutJoined}
            roomCode={guestState.roomCode}
            headerEyebrow={`Invitation · #${guestState.roomCode}`}
            headerTitle={
              hostPlayer ? `${hostPlayer.displayName}'s table` : "Private table"
            }
            localDisplayName={guestState.displayName}
            accentHex={JOIN_DR_ACCENT}
            toast={guestDrToast}
            codeCopiedHighlight={guestDrToast === "Code copied"}
            copyError={copyJoinError}
            onCopyRoomCode={() => handleJoinDrCopy("code", guestState.roomCode)}
            transportLive={guestTransport === "live"}
            onLeaveLobby={() => guestLeaveLobby()}
            chatMessages={guestLobbyLines.map((m) => ({
              id: m.id,
              who: m.who,
              text: m.text,
            }))}
            chatDraft={joinLobbyDraft}
            onChatDraftChange={setJoinLobbyDraft}
            onSendLobbyChat={sendGuestDrLobbyChat}
            chatSubmitDisabled={guestTransport !== "live"}
            chatFooterNotice={undefined}
            rulesIsHost={false}
            sendRoomSettings={sendGuestRoomSettings}
            playersPanel={
              <>
                <LobbyPlayerRoster
                  players={guestState.players}
                  localPlayerId={guestState.playerId}
                  maxPlayers={maxPlayersLobby}
                  accent={JOIN_DR_ACCENT}
                  onVoteKick={(targetPlayerId) => {
                    if (guestTransport !== "live") return;
                    guestSendGameJsonLine(
                      serializeInitiateVoteKickCommand(
                        guestState.roomCode,
                        targetPlayerId,
                      ),
                    );
                  }}
                />
                {guestVoteKickActive ? (
                  <div className="mt-3 rounded-box border border-base-300 bg-base-100/80 p-3 text-sm flex flex-col gap-2">
                    <span className="font-semibold text-base-content/90">
                      Kick vote active
                    </span>
                    {guestVoteKickActive.targetPlayerId === guestState.playerId ? (
                      <span className="text-base-content/75">
                        Others are voting on whether you stay.
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={guestTransport !== "live"}
                          onClick={() =>
                            guestSendGameJsonLine(
                              serializeCastVoteKickCommand(
                                guestState.roomCode,
                                guestVoteKickActive.targetPlayerId,
                                "yes",
                              ),
                            )
                          }
                        >
                          Vote yes — remove
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={guestTransport !== "live"}
                          onClick={() =>
                            guestSendGameJsonLine(
                              serializeCastVoteKickCommand(
                                guestState.roomCode,
                                guestVoteKickActive.targetPlayerId,
                                "no",
                              ),
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
            sidebarFooter={guestSidebarFooterJoined}
          />
        </>
      );
    }

    return (
      <div className="min-h-screen flex flex-col bg-base-200">
        <LobbyConnectionBanner
          transport={guestTransport}
          reason={guestConnectionReason}
          errorMessage={
            guestTransport === "blocked" || guestTransport === "fatal"
              ? bannerErrorDetail
              : undefined
          }
          awaitingRoomHandshake={false}
          onRetry={
            guestTransport === "disconnected" ? bumpGuestConnection : undefined
          }
          onReload={guestTransport === "blocked" ? reloadFullPage : undefined}
        />
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <div
            className={`card bg-base-100 shadow-xl w-full ${
              isMatchFlowPhase(guestState.phase) ? "max-w-4xl" : "max-w-lg"
            } ${
              guestTransport === "disconnected"
                ? "opacity-60 pointer-events-none"
                : ""
            }`}
          >
            <div className="card-body gap-6 text-center">
              <h1 className="card-title text-2xl justify-center">
                {guestState.phase === "matchEnded"
                  ? "Match finished"
                  : isMatchFlowPhase(guestState.phase)
                    ? "Match in progress"
                    : "Waiting"}
              </h1>
              <p className="text-base-content/80">
                {guestState.phase === "matchEnded" ? (
                  <>
                    You are{" "}
                    <span className="font-semibold">{guestState.displayName}</span> in
                    this room. Final scores are below — wait for the host to play again.
                  </>
                ) : isMatchFlowPhase(guestState.phase) ? (
                  <>
                    You are{" "}
                    <span className="font-semibold">{guestState.displayName}</span> in
                    this room as a guest.
                  </>
                ) : (
                  <>
                    Waiting for the host — you&apos;ll join the round when it begins.
                  </>
                )}
              </p>
              {isMatchFlowPhase(guestState.phase) || guestState.phase === "matchEnded" ? (
                <PhaseBar
                  phase={guestState.phase}
                  players={guestState.players}
                  localPlayerId={guestState.playerId}
                  drawerPlayerId={guestState.drawerPlayerId}
                  matchRoundIndex={guestState.matchRoundIndex}
                  phaseDeadlineMs={guestState.phaseDeadlineMs}
                />
              ) : null}
              {guestState.phase === "drawing" ? (
                <MatchHintFeed
                  rows={guestState.drawingHintRows}
                  suppressForDrawer={
                    Boolean(
                      guestState.drawerPlayerId &&
                        guestState.playerId === guestState.drawerPlayerId,
                    )
                  }
                />
              ) : null}
              {guestState.phase === "matchEnded" ? (
                <ScoreboardSummary
                  players={guestState.players}
                  localPlayerId={guestState.playerId}
                  isHost={false}
                />
              ) : null}
              {guestState.phase === "choosingWord" &&
              guestState.playerId === guestState.drawerPlayerId ? (
                <WordChoicePanel
                  words={guestState.wordChoiceOffer?.words ?? null}
                  isLoading={guestState.wordChoiceOffer == null}
                  errorMessage={guestState.wordChoicePickError ?? null}
                  onPick={guestChooseWord}
                  disabled={guestTransport !== "live"}
                  phaseDeadlineMs={guestState.phaseDeadlineMs}
                  deadlineResetKey={
                    guestState.matchRoundIndex !== undefined
                      ? `${guestState.roomId}-${String(guestState.matchRoundIndex)}`
                      : guestState.roomId
                  }
                />
              ) : null}
              {isMatchFlowPhase(guestState.phase) ? (
                <div className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,340px)] lg:items-start w-full max-w-4xl mx-auto">
                  <MatchDrawingColumn
                    phase={guestState.phase}
                    localPlayerId={guestState.playerId}
                    drawerPlayerId={guestState.drawerPlayerId}
                    roomId={guestState.roomId}
                    matchRoundIndex={guestState.matchRoundIndex}
                    brushColor={brushColor}
                    brushWidthPx={brushWidthPx}
                    onBrushColorChange={setBrushColor}
                    onBrushWidthChange={setBrushWidthPx}
                    sendJsonLine={guestSendGameJsonLine}
                    remoteCanvasCommits={guestState.remoteCanvasCommits}
                    wsLive={guestTransport === "live"}
                  />
                  <MatchChatPanel
                    localPlayerId={guestState.playerId}
                    feed={guestState.chatFeed}
                    onSend={guestSendChat}
                    disabled={guestTransport !== "live"}
                    closeGuessHint={guestState.closeGuessHint}
                  />
                </div>
              ) : guestState.phase === "matchEnded" ? (
                <div className="w-full max-w-lg mx-auto">
                  <MatchChatPanel
                    localPlayerId={guestState.playerId}
                    feed={guestState.chatFeed}
                    onSend={guestSendChat}
                    disabled={guestTransport !== "live"}
                    closeGuessHint={guestState.closeGuessHint}
                  />
                  <p className="text-sm text-base-content/70 mt-3">
                    Match finished — scores are above. Wait for the host to play again.
                  </p>
                </div>
              ) : null}

              <div className="space-y-2 text-left w-full max-w-md mx-auto">
                <span className="text-sm font-medium text-base-content/70">
                  Players ({String(guestState.players.length)})
                </span>
                <LobbyPlayerRoster
                  players={guestState.players}
                  localPlayerId={guestState.playerId}
                  maxPlayers={12}
                  accent="#ff5a3c"
                  onVoteKick={(targetPlayerId) => {
                    if (guestTransport !== "live") return;
                    guestSendGameJsonLine(
                      serializeInitiateVoteKickCommand(guestState.roomCode, targetPlayerId),
                    );
                  }}
                />
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-base-content/70">Room code</span>
                <p className="font-mono text-2xl tracking-widest bg-base-200 rounded-box px-3 py-3 border border-base-300">
                  {guestState.roomCode}
                </p>
              </div>
              <p className="text-sm text-base-content/70">
                Players here:{" "}
                <span className="font-semibold tabular-nums">{guestState.playerCount}</span>
              </p>
              <div className="card-actions flex-wrap justify-center gap-2">
                <Link href="/" className="btn btn-ghost">
                  Home
                </Link>
                <Link href="/lobby" className="btn btn-primary">
                  Create a room
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }



  if (protocolCode === "ALREADY_CONNECTED") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8">
        <div role="alert" className="alert alert-warning w-full max-w-lg">
          <span>Already open in another tab — close this tab or the other one.</span>
        </div>
      </div>
    );
  }

  const nicknameFormError =
    nickFieldError ??
    (protocolErrorMsg && protocolErrorRelatesToNickname(protocolCode)
      ? protocolErrorMsg
      : null);

  return (
    <div className="min-h-screen flex flex-col bg-base-200">
      <LobbyConnectionBanner
        transport={guestTransport}
        reason={guestConnectionReason}
        errorMessage={bannerErrorDetail}
        awaitingRoomHandshake={guestAwaitingHandshake}
        onRetry={bannerOnRetry}
        onReload={guestTransport === "blocked" ? reloadFullPage : undefined}
      />
      <div className="flex flex-1 flex-col min-h-0">
        {connecting ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center gap-4">
            <p className="text-base-content/80 max-w-md">
              Working on your join request — see the connection status above.
            </p>
          </div>
        ) : (
          <>
            {protocolErrorMsg ? (
              <p id={protocolErrId} className="sr-only">
                {protocolErrorMsg}
              </p>
            ) : null}
            <CreateRoomForm
              variant="join"
              nicknameRaw={nicknameRaw}
              onNicknameChange={setNicknameRaw}
              avatarId={avatarId}
              onAvatarChange={setAvatarId}
              error={nicknameFormError}
              onSubmit={handleSubmit}
              nicknameInputId="join-room-nickname"
              nicknameAriaDescribedBy={ariaNickname}
              joinRoomCode={raw}
              onJoinRoomCodeChange={(v) => setTypedRaw(v)}
              joinRoomCodeReadOnly={urlCodeValid}
              joinRoomCodeDisabled={connecting}
              joinRoomCodeInvalid={Boolean(
                helperFormat ||
                  (protocolErrorMsg && protocolErrorRelatesToRoomCode(protocolCode)),
              )}
              joinRoomCodeInputId="join-room-code-input"
              joinRoomCodeDescribedBy={ariaCode}
              joinAfterCodeSlot={
                helperFormat ? (
                  <p
                    id={formatHintId}
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      color: DR.colors.inkDim,
                      fontFamily: DR.font.body,
                      lineHeight: 1.4,
                    }}
                  >
                    {helperFormat}
                  </p>
                ) : null
              }
              submitDisabledExtra={!formatOk || connecting}
            />
          </>
        )}
      </div>
    </div>
  );
}
