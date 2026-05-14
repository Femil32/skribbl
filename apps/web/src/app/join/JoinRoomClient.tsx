"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AvatarPresetId } from "@skribbl/shared";
import {
  DEFAULT_AVATAR_PRESET_ID,
  NICKNAME_MAX_GRAPHEMES,
  assertChatMessageLength,
  countGraphemes,
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
import { LobbyPlayerRoster } from "@/features/lobby/components/LobbyPlayerRoster";
import { LobbyDrWaitingRoom } from "@/features/lobby/components/LobbyDrWaitingRoom";
import { CreateRoomForm } from "@/features/lobby/components/CreateRoomForm";
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
  const router = useRouter();
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
    transportErrorMessage: guestTransportError,
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

  useEffect(() => {
    if (guestState.status !== "joined") return;
    if (guestState.phase === "lobby") return;
    router.replace(`/game?code=${encodeURIComponent(guestState.roomCode)}`);
  }, [guestState, router]);

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
    if (guestState.phase !== "lobby") {
      return (
        <div className="min-h-screen flex items-center justify-center bg-base-200 p-8">
          <p className="text-base-content/80">Opening match…</p>
        </div>
      );
    }

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
      <div className="flex flex-1 flex-col min-h-0">
        {connecting ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center gap-4">
            <p className="text-base-content/80 max-w-md">Working on your join request…</p>
          </div>
        ) : (
          <>
            {guestTransport === "fatal" ||
            guestTransport === "blocked" ||
            guestTransport === "disconnected" ? (
              <div
                role="alert"
                className="alert alert-warning m-4 flex-col sm:flex-row items-stretch gap-3"
              >
                <span className="min-w-0">
                  {bannerErrorDetail ?? "Connection issue — check your network or try again."}
                </span>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {guestTransport === "fatal" || guestTransport === "disconnected" ? (
                    <button type="button" className="btn btn-sm btn-primary" onClick={bumpGuestConnection}>
                      Retry
                    </button>
                  ) : null}
                  {guestTransport === "blocked" ? (
                    <button type="button" className="btn btn-sm btn-outline" onClick={reloadFullPage}>
                      Reload page
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
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
