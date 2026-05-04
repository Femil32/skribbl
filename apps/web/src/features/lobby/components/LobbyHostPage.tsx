"use client";

import type { AvatarPresetId } from "@skribbl/shared";
import {
  DEFAULT_AVATAR_PRESET_ID,
  NICKNAME_MAX_GRAPHEMES,
  avatarPresets,
  countGraphemes,
  isMatchFlowPhase,
  isRosterScoreVisiblePhase,
  sanitizeDisplayName,
} from "@skribbl/shared";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useId, useState } from "react";
import { useHostCreateRoom } from "@/features/lobby/hooks/use-host-create-room";
import { LobbyConnectionBanner } from "@/features/lobby/components/LobbyConnectionBanner";
import { LobbyPlayerRoster } from "@/features/lobby/components/LobbyPlayerRoster";
import { MatchDrawingColumn } from "@/features/game/components/MatchDrawingColumn";
import { PhaseBar } from "@/features/match/components/PhaseBar";
import { ScoreboardSummary } from "@/features/match/components/ScoreboardSummary";
import { MatchHintFeed } from "@/features/match/components/MatchHintFeed";
import { WordChoicePanel } from "@/features/match/components/WordChoicePanel";
import { MatchChatPanel } from "@/features/match/components/MatchChatPanel";
import { MatchSkipToChatLink } from "@/features/match/components/MatchSkipToChatLink";
import {
  buildRoomInviteUrl,
  resolvePublicWebOrigin,
} from "@/lib/invite-url";

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator === "undefined") {
    throw new Error("CLIPBOARD_UNAVAILABLE");
  }
  if (!navigator.clipboard?.writeText) {
    throw new Error("CLIPBOARD_UNAVAILABLE");
  }
  await navigator.clipboard.writeText(text);
}

function clipboardFailureMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "name" in err) {
    const name = String((err as Error).name);
    if (name === "NotAllowedError") {
      return "Copy was blocked. Allow clipboard access for this site, or copy manually.";
    }
  }
  if (
    typeof window !== "undefined" &&
    !window.isSecureContext &&
    window.location.hostname !== "localhost"
  ) {
    return "Copy needs a secure connection (https). You can copy the text manually below.";
  }
  return "Copy is not available in this browser. You can select and copy the text below.";
}

export function LobbyHostPage() {
  const nicknameInputId = useId();
  const nicknameHintId = `${nicknameInputId}-hint`;
  const nicknameErrId = `${nicknameInputId}-err`;
  const startMinPlayersHintId = useId();

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

  const {
    state,
    transport,
    connectionReason,
    transportErrorMessage,
    awaitingRoomHandshake,
    startMatch,
    chooseWord,
    returnToLobby,
    sendGameJsonLine,
    sendChat,
  } = useHostCreateRoom({
    shouldConnect,
    attemptId,
    displayName: nicknameTrimmed,
    avatarPresetId: avatarId,
  });

  const bumpConnectionAttempt = useCallback(() => {
    setAttemptId((n) => n + 1);
  }, []);

  const reloadFullPage = useCallback(() => {
    if (typeof window !== "undefined") window.location.reload();
  }, []);

  const [toast, setToast] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [brushColor, setBrushColor] = useState("#0f172a");
  const [brushWidthPx, setBrushWidthPx] = useState(4);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

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

  if (!submitted || !nicknameOk) {
    const nickFieldError = nicknameEmpty
      ? "Enter a display name."
      : nicknameTooLong
        ? `Use at most ${String(NICKNAME_MAX_GRAPHEMES)} characters.`
        : null;
    const ariaNickname = [nicknameHintId, nickFieldError ? nicknameErrId : null]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-base-200 p-8">
        <div className="card bg-base-100 shadow-xl w-full max-w-lg">
          <div className="card-body gap-4">
            <h1 className="card-title text-2xl">Create a room</h1>
            <p className="text-base-content/80">
              Choose how you appear in the lobby before we open your room.
            </p>
            <form className="flex flex-col gap-4" onSubmit={handleCreate} noValidate>
              <label className="form-control w-full">
                <span className="label-text font-medium">Display name</span>
                <input
                  type="text"
                  id={nicknameInputId}
                  name="nickname"
                  className="input input-bordered w-full"
                  value={nicknameRaw}
                  onChange={(ev) => setNicknameRaw(ev.target.value)}
                  autoComplete="username"
                  maxLength={128}
                  aria-invalid={Boolean(nickFieldError)}
                  aria-describedby={ariaNickname || undefined}
                />
              </label>
              <p id={nicknameHintId} className="text-sm text-base-content/70">
                Plain text only — no HTML. Shown to everyone in the lobby.
              </p>
              {nickFieldError ? (
                <p id={nicknameErrId} role="alert" className="text-sm text-warning">
                  {nickFieldError}
                </p>
              ) : null}

              <fieldset className="form-control w-full border-0 p-0 min-w-0">
                <legend className="label-text font-medium mb-2">Avatar</legend>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  {avatarPresets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`btn btn-sm gap-2 ${
                        avatarId === p.id ? "btn-primary" : "btn-outline btn-primary"
                      }`}
                      aria-pressed={avatarId === p.id}
                      onClick={() => setAvatarId(p.id)}
                    >
                      <span
                        className="inline-block size-6 rounded-full border border-base-300 bg-linear-to-br from-primary/30 to-secondary/40"
                        aria-hidden
                      />
                      {p.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="card-actions justify-end">
                <Link href="/" className="btn btn-ghost">
                  Back home
                </Link>
                <button type="submit" className="btn btn-primary">
                  Create room
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "connecting") {
    return (
      <div className="min-h-screen flex flex-col bg-base-200">
        <LobbyConnectionBanner
          transport={transport}
          reason={connectionReason}
          errorMessage={transportErrorMessage}
          awaitingRoomHandshake={awaitingRoomHandshake}
        />
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <div className="card bg-base-100 shadow-xl w-full max-w-lg">
            <div className="card-body items-center text-center gap-4">
              <p className="text-base-content/80">Setting up your lobby session…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen flex flex-col bg-base-200">
        <LobbyConnectionBanner
          transport={transport}
          reason={connectionReason}
          errorMessage={state.message}
          awaitingRoomHandshake={awaitingRoomHandshake}
          onRetry={
            transport === "fatal" || transport === "disconnected"
              ? bumpConnectionAttempt
              : undefined
          }
          onReload={transport === "blocked" ? reloadFullPage : undefined}
        />
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <div className="card bg-base-100 shadow-xl w-full max-w-lg">
            <div className="card-body gap-4">
              <h1 className="card-title text-2xl">Could not create room</h1>
              <div className="card-actions justify-end">
                <Link href="/" className="btn btn-ghost">
                  Back home
                </Link>
                <button type="button" className="btn btn-primary" onClick={bumpConnectionAttempt}>
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.status !== "lobby") {
    return (
      <div className="min-h-screen flex flex-col bg-base-200">
        <LobbyConnectionBanner
          transport={transport}
          reason={connectionReason}
          errorMessage={transportErrorMessage}
          awaitingRoomHandshake={awaitingRoomHandshake}
        />
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <div className="card bg-base-100 shadow-xl w-full max-w-lg">
            <div className="card-body items-center text-center gap-4">
              <p className="text-base-content/80">Setting up your lobby session…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { roomCode } = state;
  const minPlayersOk = state.players.length >= 2;
  const canOfferStart =
    state.phase === "lobby" && minPlayersOk && !state.isStartPending;
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

  return (
    <div className="min-h-screen flex flex-col bg-base-200">
      {isMatchFlowPhase(state.phase) || state.phase === "matchEnded" ? (
        <MatchSkipToChatLink />
      ) : null}
      <LobbyConnectionBanner
        transport={transport}
        reason={connectionReason}
        errorMessage={transportErrorMessage}
        awaitingRoomHandshake={awaitingRoomHandshake}
        onRetry={transport === "disconnected" ? bumpConnectionAttempt : undefined}
      />
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <div
          className="toast toast-end toast-bottom z-50"
          aria-live="polite"
          aria-atomic="true"
        >
          {toast ? (
            <div className="alert alert-success shadow-md">
              <span>{toast}</span>
            </div>
          ) : null}
        </div>

      <div
        className={`card bg-base-100 shadow-xl w-full ${isMatchFlowPhase(state.phase) ? "max-w-4xl" : "max-w-lg"}`}
      >
        <div className="card-body gap-6">
          <h1 className="card-title text-2xl">Your lobby</h1>
          <p className="text-base-content/80">
            You are <span className="font-semibold">{state.displayName}</span>{" "}
            in this room. Share the link or code so friends can join.
          </p>

          <div
            className={`space-y-2 ${transport === "disconnected" ? "opacity-60 pointer-events-none" : ""}`}
          >
            <span className="text-sm font-medium text-base-content/70">
              Players ({String(state.players.length)})
            </span>
            <LobbyPlayerRoster
              players={state.players}
              localPlayerId={state.playerId}
              showScores={isRosterScoreVisiblePhase(state.phase)}
            />
          </div>

          <div className="flex flex-col gap-2 w-full border-t border-base-300 pt-4">
            <button
              type="button"
              className={`${canOfferStart ? "btn btn-primary" : "btn btn-outline btn-primary"} w-full sm:w-auto self-center`}
              onClick={() => startMatch()}
              disabled={
                state.phase !== "lobby" ||
                state.isStartPending ||
                !minPlayersOk ||
                transport !== "live"
              }
              aria-disabled={
                state.phase !== "lobby" ||
                state.isStartPending ||
                !minPlayersOk ||
                transport !== "live"
                  ? true
                  : undefined
              }
              aria-busy={state.isStartPending}
              aria-describedby={
                !minPlayersOk && state.phase === "lobby" ? startMinPlayersHintId : undefined
              }
            >
              {state.isStartPending ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Starting…
                </>
              ) : (
                "Start"
              )}
            </button>
            {!minPlayersOk && state.phase === "lobby" ? (
              <p
                className="text-sm text-base-content/70 text-center"
                id={startMinPlayersHintId}
              >
                Need at least two players in the room to start.
              </p>
            ) : null}
            {isMatchFlowPhase(state.phase) || state.phase === "matchEnded" ? (
              <PhaseBar
                phase={state.phase}
                players={state.players}
                localPlayerId={state.playerId}
                drawerPlayerId={state.drawerPlayerId}
                matchRoundIndex={state.matchRoundIndex}
                phaseDeadlineMs={state.phaseDeadlineMs}
              />
            ) : null}
            {state.phase === "drawing" ? (
              <MatchHintFeed
                rows={state.drawingHintRows}
                suppressForDrawer={
                  Boolean(state.drawerPlayerId && state.playerId === state.drawerPlayerId)
                }
              />
            ) : null}
            {state.phase === "matchEnded" ? (
              <ScoreboardSummary
                players={state.players}
                localPlayerId={state.playerId}
                isHost
                onPlayAgain={returnToLobby}
                playAgainDisabled={transport !== "live"}
              />
            ) : null}
            {state.phase === "choosingWord" &&
            state.playerId === state.drawerPlayerId ? (
              <WordChoicePanel
                words={state.wordChoiceOffer?.words ?? null}
                isLoading={state.wordChoiceOffer == null}
                errorMessage={state.wordChoicePickError ?? null}
                onPick={chooseWord}
                disabled={transport !== "live"}
                phaseDeadlineMs={state.phaseDeadlineMs}
                deadlineResetKey={
                  state.matchRoundIndex !== undefined
                    ? `${state.roomId}-${String(state.matchRoundIndex)}`
                    : state.roomId
                }
              />
            ) : null}
            {isMatchFlowPhase(state.phase) ? (
              <div className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,340px)] lg:items-start">
                <MatchDrawingColumn
                  phase={state.phase}
                  localPlayerId={state.playerId}
                  drawerPlayerId={state.drawerPlayerId}
                  roomId={state.roomId}
                  matchRoundIndex={state.matchRoundIndex}
                  brushColor={brushColor}
                  brushWidthPx={brushWidthPx}
                  onBrushColorChange={setBrushColor}
                  onBrushWidthChange={setBrushWidthPx}
                  sendJsonLine={sendGameJsonLine}
                  remoteCanvasCommits={state.remoteCanvasCommits}
                  wsLive={transport === "live"}
                />
                <MatchChatPanel
                  localPlayerId={state.playerId}
                  feed={state.chatFeed}
                  onSend={sendChat}
                  disabled={transport !== "live"}
                />
              </div>
            ) : state.phase === "matchEnded" ? (
              <MatchChatPanel
                localPlayerId={state.playerId}
                feed={state.chatFeed}
                onSend={sendChat}
                disabled={transport !== "live"}
              />
            ) : null}
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-base-content/70">
              Invite link
            </span>
            <p className="font-mono text-sm break-all bg-base-200 rounded-box px-3 py-2 border border-base-300">
              {inviteUrl}
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-base-content/70">
              Room code
            </span>
            <p className="font-mono text-2xl tracking-widest text-center bg-base-200 rounded-box px-3 py-3 border border-base-300">
              {roomCode}
            </p>
          </div>

          {copyError ? (
            <div className="alert alert-warning" role="alert">
              <span>{copyError}</span>
            </div>
          ) : null}

          <div className="card-actions flex-wrap justify-center gap-2">
            <button
              type="button"
              className="btn btn-outline btn-primary"
              onClick={() => handleCopy("link", inviteUrl)}
            >
              Copy link
            </button>
            <button
              type="button"
              className="btn btn-outline btn-primary"
              onClick={() => handleCopy("code", roomCode)}
            >
              Copy code
            </button>
            <Link href="/" className="btn btn-ghost">
              Home
            </Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
