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
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useHostCreateRoom } from "@/features/lobby/hooks/use-host-create-room";
import { LobbyConnectionBanner } from "@/features/lobby/components/LobbyConnectionBanner";
import { LobbyPlayerRoster } from "@/features/lobby/components/LobbyPlayerRoster";
import { MatchDrawingColumn } from "@/features/game/components/MatchDrawingColumn";
import { PhaseBar } from "@/features/match/components/PhaseBar";
import { ScoreboardSummary } from "@/features/match/components/ScoreboardSummary";
import { MatchHintFeed } from "@/features/match/components/MatchHintFeed";
import { WordChoicePanel } from "@/features/match/components/WordChoicePanel";
import { MatchChatPanel } from "@/features/match/components/MatchChatPanel";
import { buildRoomInviteUrl, resolvePublicWebOrigin } from "@/lib/invite-url";
import { DR, chunk, WORD_PACKS } from "@/features/lobby/design/tokens";
import { useLobbySettingsStore } from "@/features/lobby/stores/lobby-settings-store";
import { Stepper } from "@/features/lobby/components/primitives/Stepper";
import { Toggle } from "@/features/lobby/components/primitives/Toggle";
import { SectionLabel } from "@/features/lobby/components/primitives/SectionLabel";

// Default accent colour — tomato from the DR palette
const ACCENT = DR.accent.tomato;

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

type ChatMessage = { who: string; text: string; system?: boolean };

const nicknameHintId = "host-lobby-nickname-hint";
const nicknameErrId = "host-lobby-nickname-error";

export function LobbyHostPage() {
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

  // Pre-game chat — UI only (backend wired in later story)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: 99999 });
  }, [chatMessages]);

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
      setChatMessages([{ who: "system", text: `Room created · share the code: ${state.roomCode}`, system: true }]);
    }
  }, [state.status === "lobby" ? state.roomCode : null, seededCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lobby settings from Zustand store
  const {
    rounds, setRounds,
    drawTime, setDrawTime,
    maxPlayers, setMaxPlayers,
    wordPack, setWordPack,
    showHints, setShowHints,
    skipAfk, setSkipAfk,
    allowVoice, setAllowVoice,
  } = useLobbySettingsStore();

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
                  id="host-lobby-nickname"
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

              <div className="form-control w-full">
                <span className="label-text font-medium mb-2">Avatar</span>
                <div
                  className="flex flex-wrap gap-2 justify-center sm:justify-start"
                  role="group"
                  aria-label="Avatar preset"
                >
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
              </div>

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

  // ─── Connecting state ────────────────────────────────────────────────────────
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

  // ─── Error state ─────────────────────────────────────────────────────────────
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

  // ─── Fallback: unknown status ─────────────────────────────────────────────
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

  // ─── Game-active phases: keep existing layout ─────────────────────────────
  // DR: lobby-phase-only redesign — game/endgame phases use existing DaisyUI layout
  if (isMatchFlowPhase(state.phase) || state.phase === "matchEnded") {
    return (
      <div className="min-h-screen flex flex-col bg-base-200">
        <LobbyConnectionBanner
          transport={transport}
          reason={connectionReason}
          errorMessage={transportErrorMessage}
          awaitingRoomHandshake={awaitingRoomHandshake}
          onRetry={transport === "disconnected" ? bumpConnectionAttempt : undefined}
        />
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <div className={`card bg-base-100 shadow-xl w-full max-w-4xl`}>
            <div className="card-body gap-6">
              <PhaseBar
                phase={state.phase}
                players={state.players}
                localPlayerId={state.playerId}
                drawerPlayerId={state.drawerPlayerId}
                matchRoundIndex={state.matchRoundIndex}
                phaseDeadlineMs={state.phaseDeadlineMs}
              />
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
                  closeGuessHint={state.closeGuessHint}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── DR: Lobby waiting-room layout (phase === 'lobby') ────────────────────
  const C = DR.colors;
  const ck = (x = 4, y = 5) => chunk(x, y, C.line);

  const sendChatMessage = () => {
    if (!chatDraft.trim()) return;
    setChatMessages((prev) => [...prev, { who: state.displayName, text: chatDraft.trim() }]);
    setChatDraft("");
  };

  return (
    <div
      style={{
        width: "100%",
        flex: 1,
        background: C.bg,
        color: C.ink,
        fontFamily: DR.font.body,
        padding: 28,
        display: "grid",
        gridTemplateColumns: "1fr 360px",
        gridTemplateRows: "auto 1fr",
        gap: 22,
        overflow: "hidden",
        position: "relative",
        minHeight: "calc(100vh - 60px)", // account for SiteHeader
      }}
    >
      {/* Decorative dot grid */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: "radial-gradient(rgba(26,23,20,.07) 1.2px, transparent 1.5px)",
          backgroundSize: "22px 22px",
        }}
      />

      {/* Toast notification */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 200,
          pointerEvents: "none",
        }}
      >
        {toast ? (
          <div
            style={{
              background: DR.semantic.success,
              color: "#fff",
              fontFamily: DR.font.body,
              fontWeight: 700,
              fontSize: 14,
              padding: "10px 16px",
              borderRadius: DR.radius.md,
              border: `2px solid ${C.line}`,
              boxShadow: ck(3, 4),
            }}
          >
            ✓ {toast}
          </div>
        ) : null}
      </div>

      {/* ── HEADER (col-span 2) ─────────────────────────────────────────────── */}
      <header
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          alignItems: "center",
          gap: 18,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo badge */}
        <div
          style={{
            fontFamily: DR.font.display,
            fontSize: 38,
            lineHeight: 0.9,
            fontWeight: 900,
            letterSpacing: "-.02em",
            padding: "10px 16px 14px",
            background: ACCENT,
            color: "#1a1714",
            border: `3px solid ${C.line}`,
            borderRadius: 18,
            boxShadow: ck(6, 7),
            transform: "rotate(-2deg)",
            userSelect: "none",
          }}
          aria-label="Doodle Royale"
        >
          DOODLE
          <br />
          ROYALE
        </div>

        {/* Room info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".18em",
              color: C.inkDim,
              textTransform: "uppercase",
            }}
          >
            Private lobby · #{roomCode}
          </div>
          <div
            style={{ fontFamily: DR.font.display, fontSize: 26, fontWeight: 800 }}
          >
            {state.displayName}&apos;s table
          </div>
        </div>

        {/* Room code copy button */}
        <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <button
            type="button"
            onClick={() => handleCopy("code", roomCode)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: C.panel,
              color: C.ink,
              border: `3px solid ${C.line}`,
              borderRadius: 14,
              padding: "10px 14px",
              fontFamily: DR.font.mono,
              fontSize: 15,
              fontWeight: 700,
              boxShadow: ck(),
              cursor: "pointer",
            }}
          >
            <span
              style={{
                color: C.inkDim,
                fontSize: 11,
                letterSpacing: ".18em",
                textTransform: "uppercase",
              }}
            >
              code
            </span>
            {roomCode}
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: toast === "Code copied" ? DR.semantic.success : C.inkDim,
                transition: "color .2s",
              }}
            >
              {toast === "Code copied" ? "✓ copied" : "⧉ copy"}
            </span>
          </button>
          {copyError ? (
            <p style={{ fontSize: 12, color: DR.semantic.danger, margin: 0 }}>{copyError}</p>
          ) : null}
        </div>
      </header>

      {/* ── LEFT: players + settings ─────────────────────────────────────────── */}
      <main
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateRows: "auto 1fr",
          gap: 20,
          minHeight: 0,
        }}
      >
        {/* Players section */}
        <section
          style={{
            background: C.panel,
            border: `3px solid ${C.line}`,
            borderRadius: 22,
            boxShadow: ck(6, 7),
            padding: "18px 20px 20px",
          }}
        >
          <LobbyPlayerRoster
            players={state.players}
            localPlayerId={state.playerId}
            maxPlayers={maxPlayers}
            accent={ACCENT}
            isHost={isHost}
            // onKick wired once backend supports kick command
          />
        </section>

        {/* Settings section — "Rules of the round" */}
        <section
          style={{
            background: C.panel,
            border: `3px solid ${C.line}`,
            borderRadius: 22,
            boxShadow: ck(6, 7),
            padding: "18px 20px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <h2
              style={{
                margin: 0,
                fontFamily: DR.font.display,
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              Rules of the round
            </h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.inkDim,
                letterSpacing: ".18em",
                textTransform: "uppercase",
                marginLeft: "auto",
              }}
            >
              {isHost ? "host only" : "read-only"}
            </span>
          </div>

          {/* Numeric steppers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Stepper
              label="Rounds"
              value={rounds}
              min={1}
              max={20}
              setValue={setRounds}
              disabled={!isHost}
            />
            <Stepper
              label="Draw time"
              value={drawTime}
              min={20}
              max={240}
              step={10}
              unit="s"
              setValue={setDrawTime}
              disabled={!isHost}
            />
            <Stepper
              label="Max players"
              value={maxPlayers}
              min={2}
              max={12}
              setValue={setMaxPlayers}
              disabled={!isHost}
            />
          </div>

          {/* Word pack pills */}
          <div>
            <SectionLabel>Word pack</SectionLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {WORD_PACKS.map((wp) => {
                const selected = wordPack === wp.id;
                return (
                  <button
                    key={wp.id}
                    type="button"
                    onClick={() => isHost && setWordPack(wp.id)}
                    disabled={!isHost}
                    style={{
                      border: `2.5px solid ${C.line}`,
                      borderRadius: 12,
                      background: selected ? ACCENT : C.panel2,
                      color: selected ? "#1a1714" : C.ink,
                      padding: "8px 12px",
                      cursor: isHost ? "pointer" : "default",
                      boxShadow: selected ? ck(3, 4) : "none",
                      transform: selected ? "translate(-1px,-1px)" : "none",
                      fontFamily: DR.font.body,
                      fontSize: 13,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      opacity: !isHost ? 0.7 : 1,
                    }}
                  >
                    {wp.label}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: 6,
                        background: selected ? "rgba(0,0,0,.18)" : C.panel,
                        border: `1.5px solid ${C.line}`,
                      }}
                    >
                      {wp.count || "add"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggle options */}
          <div style={{ display: "flex", gap: 10, marginTop: "auto", flexWrap: "wrap" }}>
            <Toggle
              label="Show hints"
              value={showHints}
              setValue={setShowHints}
              disabled={!isHost}
            />
            <Toggle
              label="Auto-skip AFK"
              value={skipAfk}
              setValue={setSkipAfk}
              disabled={!isHost}
            />
            <Toggle
              label="Allow voice"
              value={allowVoice}
              setValue={setAllowVoice}
              disabled={!isHost}
            />
          </div>
        </section>
      </main>

      {/* ── RIGHT: pre-game chat + start button ──────────────────────────────── */}
      <aside
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          minHeight: 0,
        }}
      >
        {/* Pre-game chat panel */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            background: C.panel,
            border: `3px solid ${C.line}`,
            borderRadius: 22,
            boxShadow: ck(6, 7),
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <h2
              style={{
                margin: 0,
                fontFamily: DR.font.display,
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              Pre-game
            </h2>
            <span style={{ fontSize: 11, color: C.inkDim, fontWeight: 600 }}>
              · {chatMessages.length} messages
            </span>
          </div>

          {/* Message list */}
          <div
            ref={chatRef}
            style={{
              flex: 1,
              overflowY: "auto",
              background: C.panel2,
              border: `2px solid ${C.line}`,
              borderRadius: 14,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            {chatMessages.map((m, i) =>
              m.system ? (
                // System messages in monospace, centred with dashed border
                <div
                  key={i}
                  style={{
                    fontFamily: DR.font.mono,
                    fontSize: 11,
                    color: C.inkDim,
                    textAlign: "center",
                    padding: "4px 8px",
                    borderTop: `1px dashed ${C.inkDim}`,
                    borderBottom: `1px dashed ${C.inkDim}`,
                    margin: "4px 0",
                  }}
                >
                  {m.text}
                </div>
              ) : (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <span
                    style={{
                      fontWeight: 800,
                      color: m.who === state.displayName ? "#1a1714" : C.ink,
                      background: m.who === state.displayName ? ACCENT : "transparent",
                      padding: m.who === state.displayName ? "0 6px" : 0,
                      borderRadius: 6,
                      flexShrink: 0,
                    }}
                  >
                    {m.who}
                  </span>
                  <span style={{ wordBreak: "break-word" }}>{m.text}</span>
                </div>
              ),
            )}
            {chatMessages.length === 0 && (
              <div
                style={{
                  color: C.inkDim,
                  fontSize: 12,
                  textAlign: "center",
                  marginTop: "auto",
                  marginBottom: "auto",
                }}
              >
                say hi…
              </div>
            )}
          </div>

          {/* Chat input */}
          <form
            onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }}
            style={{ display: "flex", gap: 8 }}
          >
            <input
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="say hi…"
              aria-label="Chat message"
              style={{
                flex: 1,
                padding: "10px 12px",
                border: `2.5px solid ${C.line}`,
                borderRadius: 12,
                background: C.panel2,
                color: C.ink,
                fontFamily: DR.font.body,
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                border: `2.5px solid ${C.line}`,
                borderRadius: 12,
                background: C.ink,
                color: C.panel,
                padding: "0 14px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: ck(3, 4),
                fontFamily: DR.font.body,
              }}
            >
              send
            </button>
          </form>
        </div>

        {/* Invite link (compact, below chat) */}
        <div
          style={{
            background: C.panel,
            border: `2px solid ${C.line}`,
            borderRadius: DR.radius.lg,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
          }}
          onClick={() => handleCopy("link", inviteUrl)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleCopy("link", inviteUrl)}
          aria-label="Copy invite link"
        >
          <span
            style={{ fontSize: 11, fontWeight: 700, color: C.inkDim, letterSpacing: ".18em", textTransform: "uppercase", flexShrink: 0 }}
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
          <span style={{ fontSize: 11, color: toast === "Link copied" ? DR.semantic.success : C.inkDim, flexShrink: 0 }}>
            {toast === "Link copied" ? "✓" : "⧉"}
          </span>
        </div>

        {/* START GAME button */}
        <button
          type="button"
          onClick={() => startMatch()}
          disabled={!canStart || transport !== "live"}
          aria-busy={state.isStartPending}
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
          {/* Ready count badge */}
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
            /
            {state.players.length}
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
      </aside>
    </div>
  );
}
