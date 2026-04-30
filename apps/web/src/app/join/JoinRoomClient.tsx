"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import type { AvatarPresetId } from "@skribbl/shared";
import {
  DEFAULT_AVATAR_PRESET_ID,
  NICKNAME_MAX_GRAPHEMES,
  avatarPresets,
  countGraphemes,
  isMatchFlowPhase,
  isRosterScoreVisiblePhase,
  isValidRoomCodeForJoin,
  normalizeRoomCode,
  sanitizeDisplayName,
} from "@skribbl/shared";
import { useGuestJoinRoom } from "@/features/lobby/hooks/use-guest-join-room";
import { LobbyConnectionBanner } from "@/features/lobby/components/LobbyConnectionBanner";
import { LobbyPlayerRoster } from "@/features/lobby/components/LobbyPlayerRoster";
import { MatchDrawingColumn } from "@/features/game/components/MatchDrawingColumn";
import { PhaseBar } from "@/features/match/components/PhaseBar";
import { ScoreboardSummary } from "@/features/match/components/ScoreboardSummary";
import { WordChoicePanel } from "@/features/match/components/WordChoicePanel";

const formatHintId = "join-room-code-format-hint";
const protocolErrId = "join-room-protocol-error";
const nicknameHintId = "join-room-nickname-hint";
const nicknameErrId = "join-room-nickname-error";

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

function protocolErrorRelatesToAvatar(code: string | undefined): boolean {
  return code === "INVALID_AVATAR";
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

  const {
    state: guestState,
    transport: guestTransport,
    connectionReason: guestConnectionReason,
    transportErrorMessage: guestTransportError,
    awaitingRoomHandshake: guestAwaitingHandshake,
    chooseWord: guestChooseWord,
    sendGameJsonLine: guestSendGameJsonLine,
  } = useGuestJoinRoom({
    activeJoinAttempt,
    connectionAttemptId: joinGeneration,
    roomCodeInput: raw,
    displayName: nicknameTrimmed,
    avatarPresetId: avatarId,
  });

  const bumpGuestConnection = () => {
    setJoinGeneration((n) => n + 1);
  };

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

  const ariaAvatarPreset =
    [
      protocolErrorMsg && protocolErrorRelatesToAvatar(protocolCode)
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
                    : "You joined the room"}
              </h1>
              <p className="text-base-content/80">
                {guestState.phase === "matchEnded" ? (
                  <>
                    You are <span className="font-semibold">{guestState.displayName}</span> in
                    this room. Final scores are below — wait for the host to play again.
                  </>
                ) : isMatchFlowPhase(guestState.phase) ? (
                  <>
                    You are <span className="font-semibold">{guestState.displayName}</span> in
                    this room as a guest.
                  </>
                ) : (
                  <>
                    You are <span className="font-semibold">{guestState.displayName}</span> in
                    the lobby as a guest — the host starts the match.
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
                  remoteCommitted={guestState.remoteStrokeCommits}
                  wsLive={guestTransport === "live"}
                />
              ) : guestState.phase === "matchEnded" ? (
                <p className="text-sm text-base-content/70">
                  Match finished — scores are above. Wait for the host to play again.
                </p>
              ) : (
                <p className="text-sm text-base-content/70">
                  Waiting for the host to begin. You will not have a Start control here.
                </p>
              )}

              <div className="space-y-2 text-left w-full max-w-md mx-auto">
                <span className="text-sm font-medium text-base-content/70">
                  Players ({String(guestState.players.length)})
                </span>
                <LobbyPlayerRoster
                  players={guestState.players}
                  localPlayerId={guestState.playerId}
                  showScores={isRosterScoreVisiblePhase(guestState.phase)}
                />
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-base-content/70">
                  Room code
                </span>
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

  return (
    <div className="min-h-screen flex flex-col bg-base-200">
      <LobbyConnectionBanner
        transport={guestTransport}
        reason={guestConnectionReason}
        errorMessage={bannerErrorDetail}
        awaitingRoomHandshake={guestAwaitingHandshake}
        onRetry={bannerOnRetry}
      />
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="card bg-base-100 shadow-xl w-full max-w-lg">
          <div className="card-body gap-4 text-center">
            <h1 className="card-title text-2xl justify-center">Join a room</h1>
            <p className="text-base-content/80">
              Paste a code from an invite or type it, then choose how you appear.
            </p>

            {connecting ? (
              <p className="text-base-content/80 py-6">
                Working on your join request — see the connection status above.
              </p>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-3 w-full max-w-sm mx-auto text-left"
                noValidate
              >
                <label className="form-control w-full">
                  <span className="label-text font-medium">Room code</span>
                  <input
                    type="text"
                    name="roomCode"
                    id="join-room-code-input"
                    className="input input-bordered w-full font-mono"
                    value={raw}
                    onChange={(e) => setTypedRaw(e.target.value)}
                    readOnly={urlCodeValid}
                    placeholder="Paste or type the code"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={connecting}
                    aria-invalid={Boolean(
                      helperFormat ||
                        (protocolErrorMsg &&
                          protocolErrorRelatesToRoomCode(protocolCode)),
                    )}
                    aria-describedby={ariaCode}
                  />
                </label>

                {helperFormat ? (
                  <p id={formatHintId} className="text-sm text-base-content/70">
                    {helperFormat}
                  </p>
                ) : null}

                <label className="form-control w-full">
                  <span className="label-text font-medium">Display name</span>
                  <input
                    type="text"
                    name="nickname"
                    id="join-room-nickname"
                    className="input input-bordered w-full"
                    value={nicknameRaw}
                    onChange={(e) => setNicknameRaw(e.target.value)}
                    autoComplete="username"
                    maxLength={128}
                    disabled={connecting}
                    aria-invalid={Boolean(
                      nickFieldError ||
                        (protocolErrorMsg &&
                          protocolErrorRelatesToNickname(protocolCode)),
                    )}
                    aria-describedby={ariaNickname}
                  />
                </label>
                <p id={nicknameHintId} className="text-sm text-base-content/70">
                  Plain text only — everyone in the lobby will see this.
                </p>
                {nickFieldError ? (
                  <p id={nicknameErrId} role="alert" className="text-sm text-warning">
                    {nickFieldError}
                  </p>
                ) : null}

                <div className="form-control w-full">
                  <span className="label-text font-medium mb-2">Avatar</span>
                  <div
                    className="flex flex-wrap gap-2 justify-center sm:justify-start"
                    role="group"
                    aria-label="Avatar preset"
                    aria-describedby={ariaAvatarPreset || undefined}
                  >
                    {avatarPresets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`btn btn-sm gap-2 ${
                          avatarId === p.id ? "btn-primary" : "btn-outline"
                        }`}
                        aria-pressed={avatarId === p.id}
                        onClick={() => setAvatarId(p.id)}
                      >
                        <span
                          className="inline-block size-6 rounded-full border border-base-300 bg-gradient-to-br from-primary/30 to-secondary/40"
                          aria-hidden
                        />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {protocolErrorMsg ? (
                  <p id={protocolErrId} className="sr-only">
                    {protocolErrorMsg}
                  </p>
                ) : null}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!formatOk || connecting}
                >
                  Join room
                </button>
              </form>
            )}

            <div className="card-actions justify-center">
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
