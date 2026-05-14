"use client";

import type { AvatarPresetId } from "@skribbl/shared";
import {
  DEFAULT_AVATAR_PRESET_ID,
  HINT_MASK_CHAR,
  isMatchFlowPhase,
  isValidRoomCodeForJoin,
  normalizeRoomCode,
  NICKNAME_MAX_GRAPHEMES,
  countGraphemes,
  sanitizeDisplayName,
} from "@skribbl/shared";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useGuestJoinRoom } from "@/features/lobby/hooks/use-guest-join-room";
import { useHostCreateRoom } from "@/features/lobby/hooks/use-host-create-room";
import { loadSession } from "@/features/lobby/lib/session-storage";
import { DR, getDrPalette, chunk } from "@/features/lobby/design/tokens";
import { useLobbySettingsStore } from "@/features/lobby/stores/lobby-settings-store";
import { MatchDrawingColumn } from "@/features/game/components/MatchDrawingColumn";
import { DrMatchScreen } from "@/features/match/components/DrMatchScreen";
import { DrWordChoicePanel } from "@/features/match/components/DrWordChoicePanel";
import { MatchChatPanel } from "@/features/match/components/MatchChatPanel";
import { DrMatchEndgame } from "@/features/match/components/DrMatchEndgame";

const DR_THEME_STORAGE = "skribbl_dr_dark";
const MATCH_ACCENT = DR.accent.tomato;

function firstRevealedLetter(maskedWord: string): string {
  for (const ch of maskedWord) {
    if (ch !== HINT_MASK_CHAR && /[a-zA-Z]/.test(ch)) return ch.toUpperCase();
  }
  return "";
}

function resolvePlayerName(
  players: import("@skribbl/shared").LobbyRosterPlayer[],
  playerId: string | undefined,
): string {
  if (!playerId) return "—";
  const row = players.find((p) => p.playerId === playerId);
  if (!row) return "—";
  const away = (row.connectionStatus ?? "connected") === "disconnected";
  return away ? `${row.displayName} (away)` : row.displayName;
}

function useDrThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      setIsDark(window.localStorage.getItem(DR_THEME_STORAGE) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const onToggleTheme = useCallback(() => {
    setIsDark((d) => {
      const next = !d;
      try {
        window.localStorage.setItem(DR_THEME_STORAGE, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { isDark, onToggleTheme };
}

function MatchHeaderWord({
  palette,
  phase,
  localPlayerId,
  drawerPlayerId,
  drawingHintRows,
  drawerLocalSecretWord,
  players,
}: {
  palette: ReturnType<typeof getDrPalette>;
  phase: import("@skribbl/shared").RoomPhase;
  localPlayerId: string;
  drawerPlayerId?: string;
  drawingHintRows: readonly import("@/features/lobby/lib/drawing-hint-rows").MatchHintFeedRow[];
  drawerLocalSecretWord: string | null;
  players: import("@skribbl/shared").LobbyRosterPlayer[];
}) {
  const isDrawer = drawerPlayerId !== undefined && drawerPlayerId === localPlayerId;
  const drawerDisplayName = resolvePlayerName(players, drawerPlayerId);

  if (phase === "choosingWord") {
    if (isDrawer) {
      return (
        <div
          style={{
            fontFamily: DR.font.display,
            fontSize: 22,
            fontWeight: 900,
            background: palette.panel2,
            border: `2.5px solid ${palette.line}`,
            borderRadius: 12,
            padding: "6px 18px",
            boxShadow: chunk(4, 5, palette.line),
          }}
        >
          ✏️ Pick your word
        </div>
      );
    }
    return (
      <div
        style={{
          fontFamily: DR.font.display,
          fontSize: 18,
          fontWeight: 800,
          color: palette.inkDim,
        }}
      >
        👀 Waiting for {drawerDisplayName} to pick…
      </div>
    );
  }

  if (phase === "drawing") {
    if (isDrawer) {
      const word = (drawerLocalSecretWord ?? "").trim() || "—";
      return (
        <div
          style={{
            fontFamily: DR.font.display,
            fontSize: 26,
            fontWeight: 900,
            background: palette.panel2,
            border: `2.5px solid ${palette.line}`,
            borderRadius: 12,
            padding: "6px 18px",
            boxShadow: chunk(4, 5, palette.line),
          }}
        >
          ✏️ You are drawing {word.toUpperCase()}{" "}
          <span style={{ fontSize: 12, opacity: 0.55, fontWeight: 600 }}>draw this!</span>
        </div>
      );
    }

    const last = drawingHintRows[drawingHintRows.length - 1];
    const raw = last?.maskedWord ?? "";
    const chars = raw.length > 0 ? raw.split("") : ["_", "_", "_"];
    const hintLetter = firstRevealedLetter(raw);

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div
          style={{
            fontFamily: DR.font.display,
            fontSize: 15,
            fontWeight: 900,
            textAlign: "center",
            maxWidth: 420,
            lineHeight: 1.2,
          }}
        >
          👀 {drawerDisplayName} is drawing
          {hintLetter ? ` ${hintLetter}` : ""}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          {chars.map((ch, i) => (
            <div
              key={`${String(i)}-${ch}`}
              style={{
                minWidth: 26,
                padding: "4px 2px",
                borderBottom: `3px solid ${palette.line}`,
                fontFamily: DR.font.display,
                fontSize: 24,
                fontWeight: 900,
                textAlign: "center",
                color: ch !== HINT_MASK_CHAR && ch !== " " ? MATCH_ACCENT : palette.ink,
              }}
            >
              {ch !== HINT_MASK_CHAR && ch !== " " ? ch : "\u00a0"}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function HostGameMatch() {
  const router = useRouter();
  const { isDark, onToggleTheme } = useDrThemeToggle();
  const palette = getDrPalette(isDark);
  const roundTotal = useLobbySettingsStore((s) => s.rounds);

  const [nicknameRaw, setNicknameRaw] = useState("");
  const [avatarId, setAvatarId] = useState<AvatarPresetId>(DEFAULT_AVATAR_PRESET_ID);
  const [submitted, setSubmitted] = useState(false);
  const [attemptId, setAttemptId] = useState(0);
  const [brushColor, setBrushColor] = useState("#0f172a");
  const [brushWidthPx, setBrushWidthPx] = useState(4);

  const nicknameTrimmed = nicknameRaw.trim();
  const nicknameSanitized = sanitizeDisplayName(nicknameTrimmed);
  const nicknameOk =
    nicknameTrimmed.length > 0 &&
    nicknameSanitized.length > 0 &&
    countGraphemes(nicknameSanitized) <= NICKNAME_MAX_GRAPHEMES;

  const shouldConnect = submitted && nicknameOk;

  const {
    state,
    transport,
    awaitingRoomHandshake,
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

  useEffect(() => {
    const session = loadSession();
    if (session?.role === "host") {
      setNicknameRaw(session.displayName);
      setAvatarId(session.avatarPresetId);
      setSubmitted(true);
    }
  }, []);

  useEffect(() => {
    if (state.status !== "lobby") return;
    if (state.phase !== "lobby") return;
    router.replace("/lobby");
  }, [state, router]);

  if (!shouldConnect) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: palette.bg,
          color: palette.ink,
          fontFamily: DR.font.body,
          gap: 16,
        }}
      >
        <p style={{ margin: 0, textAlign: "center", maxWidth: 420 }}>
          Open a room from the lobby first, then you&apos;ll land here when the match starts.
        </p>
        <Link
          href="/lobby"
          style={{
            border: `3px solid ${palette.line}`,
            borderRadius: 14,
            background: MATCH_ACCENT,
            color: "#1a1714",
            padding: "12px 20px",
            fontWeight: 900,
            textDecoration: "none",
          }}
        >
          Go to lobby
        </Link>
      </div>
    );
  }

  if (state.status === "connecting" || (state.status === "lobby" && awaitingRoomHandshake)) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: palette.bg,
          color: palette.ink,
          fontFamily: DR.font.body,
        }}
      >
        <p>Reconnecting to your room…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          background: palette.bg,
          color: palette.ink,
        }}
      >
        <p role="alert" style={{ maxWidth: 440, textAlign: "center" }}>
          {state.message}
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => bumpConnectionAttempt()}
            style={{
              border: `2px solid ${palette.line}`,
              borderRadius: 12,
              padding: "10px 16px",
              cursor: "pointer",
              background: palette.panel2,
              fontWeight: 700,
            }}
          >
            Retry connection
          </button>
          <Link
            href="/lobby"
            style={{
              border: `2px solid ${palette.line}`,
              borderRadius: 12,
              padding: "10px 16px",
              fontWeight: 700,
              color: palette.ink,
              textDecoration: "none",
              background: palette.panel,
            }}
          >
            Back to lobby
          </Link>
        </div>
      </div>
    );
  }

  if (state.status === "idle") {
    return null;
  }

  if (!isMatchFlowPhase(state.phase) && state.phase !== "matchEnded") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: palette.bg,
        }}
      >
        <p style={{ color: palette.ink }}>Redirecting to lobby…</p>
      </div>
    );
  }

  const wsLive = transport === "live";
  const isArtistView =
    state.drawerPlayerId === state.playerId &&
    (state.phase === "choosingWord" || state.phase === "drawing");
  const hostPlayer = state.players.find((p) => p.isHost);
  const tableTitleLabel = hostPlayer ? `${hostPlayer.displayName}'s table` : "Room";

  return (
    <DrMatchScreen
      palette={palette}
      accentHex={MATCH_ACCENT}
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      phase={state.phase}
      players={state.players}
      localPlayerId={state.playerId}
      isArtistView={isArtistView}
      matchRoundIndex={state.matchRoundIndex}
      phaseDeadlineMs={state.phaseDeadlineMs}
      roundTotal={roundTotal}
      headerWordSlot={
        <MatchHeaderWord
          palette={palette}
          phase={state.phase}
          localPlayerId={state.playerId}
          drawerPlayerId={state.drawerPlayerId}
          drawingHintRows={state.drawingHintRows}
          drawerLocalSecretWord={state.drawerLocalSecretWord}
          players={state.players}
        />
      }
      wordChoiceBlock={
        state.phase === "choosingWord" && state.playerId === state.drawerPlayerId ? (
          <DrWordChoicePanel
            palette={palette}
            accentHex={MATCH_ACCENT}
            words={state.wordChoiceOffer?.words ?? null}
            isLoading={state.wordChoiceOffer == null}
            errorMessage={state.wordChoicePickError ?? null}
            onPick={chooseWord}
            disabled={!wsLive}
          />
        ) : null
      }
      hintFeedBlock={null}
      matchEndedBlock={
        state.phase === "matchEnded" ? (
          <DrMatchEndgame
            palette={palette}
            accentHex={MATCH_ACCENT}
            players={state.players}
            localPlayerId={state.playerId}
            roundsPlayed={roundTotal}
            tableTitleLabel={tableTitleLabel}
            isHost
            onPlayAgain={returnToLobby}
            playAgainDisabled={!wsLive}
            backToLobbyHref="/lobby"
          />
        ) : null
      }
      canvasBlock={
        isMatchFlowPhase(state.phase) ? (
          <MatchDrawingColumn
            palette={palette}
            accentHex={MATCH_ACCENT}
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
            wsLive={wsLive}
            showGuessBanner={
              state.phase === "drawing" &&
              state.drawerPlayerId !== undefined &&
              state.playerId !== state.drawerPlayerId
            }
          />
        ) : null
      }
      chatBlock={
        <MatchChatPanel
          localPlayerId={state.playerId}
          feed={state.chatFeed}
          onSend={sendChat}
          disabled={!wsLive}
          closeGuessHint={state.closeGuessHint}
          variant="doodleRoyale"
          palette={palette}
          accentHex={MATCH_ACCENT}
          showComposer={!isArtistView}
        />
      }
    />
  );
}

function GuestGameMatch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDark, onToggleTheme } = useDrThemeToggle();
  const palette = getDrPalette(isDark);
  const roundTotal = useLobbySettingsStore((s) => s.rounds);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const [nicknameRaw, setNicknameRaw] = useState("");
  const [avatarId, setAvatarId] = useState<AvatarPresetId>(DEFAULT_AVATAR_PRESET_ID);
  const [manualCommitted, setManualCommitted] = useState(false);
  const [joinGeneration, setJoinGeneration] = useState(0);
  const [brushColor, setBrushColor] = useState("#0f172a");
  const [brushWidthPx, setBrushWidthPx] = useState(4);

  const urlRaw = searchParams.get("code");
  const urlNorm = urlRaw && urlRaw !== "" ? normalizeRoomCode(urlRaw) : null;
  const session = hydrated ? loadSession() : null;
  const sessionRoomNorm =
    session?.role === "guest" ? normalizeRoomCode(session.roomCode) : null;
  const raw =
    urlNorm && isValidRoomCodeForJoin(urlNorm)
      ? urlNorm
      : sessionRoomNorm && isValidRoomCodeForJoin(sessionRoomNorm)
        ? sessionRoomNorm
        : "";

  useEffect(() => {
    if (!hydrated) return;
    const s = loadSession();
    if (s?.role !== "guest") return;
    const roomNorm = normalizeRoomCode(s.roomCode);
    if (!roomNorm || !isValidRoomCodeForJoin(roomNorm)) return;
    if (urlNorm && isValidRoomCodeForJoin(urlNorm) && urlNorm !== roomNorm) return;
    setNicknameRaw(s.displayName);
    setAvatarId(s.avatarPresetId);
    setManualCommitted(true);
    setJoinGeneration((n) => n + 1);
  }, [hydrated, urlNorm]);

  const nicknameTrimmed = nicknameRaw.trim();
  const nicknameSanitized = sanitizeDisplayName(nicknameTrimmed);
  const nicknameOk =
    nicknameTrimmed.length > 0 &&
    nicknameSanitized.length > 0 &&
    countGraphemes(nicknameSanitized) <= NICKNAME_MAX_GRAPHEMES;

  const formatOk = raw !== "" && isValidRoomCodeForJoin(raw);
  const activeJoinAttempt = manualCommitted && formatOk && nicknameOk;

  const guestBootstrapPending =
    hydrated &&
    session?.role === "guest" &&
    !manualCommitted &&
    Boolean(sessionRoomNorm && isValidRoomCodeForJoin(sessionRoomNorm));

  const {
    state: guestState,
    transport: guestTransport,
    chooseWord: guestChooseWord,
    sendGameJsonLine: guestSendGameJsonLine,
    sendChat: guestSendChat,
  } = useGuestJoinRoom({
    activeJoinAttempt,
    connectionAttemptId: joinGeneration,
    roomCodeInput: raw,
    displayName: nicknameTrimmed,
    avatarPresetId: avatarId,
  });

  const bumpGuestConnection = useCallback(() => {
    setJoinGeneration((n) => n + 1);
  }, []);

  useEffect(() => {
    if (guestState.status !== "joined") return;
    if (guestState.phase !== "lobby") return;
    router.replace(`/join?code=${encodeURIComponent(guestState.roomCode)}`);
  }, [guestState, router]);

  if (!hydrated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: palette.bg,
        }}
      >
        <p style={{ color: palette.ink }}>Loading…</p>
      </div>
    );
  }

  if (guestBootstrapPending) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: palette.bg,
        }}
      >
        <p style={{ color: palette.ink }}>Joining your table…</p>
      </div>
    );
  }

  if (!manualCommitted && !activeJoinAttempt) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: palette.bg,
          color: palette.ink,
          gap: 16,
        }}
      >
        <p style={{ margin: 0, textAlign: "center", maxWidth: 420 }}>
          Join a room with a code first. Your match opens here automatically.
        </p>
        <Link
          href="/join"
          style={{
            border: `3px solid ${palette.line}`,
            borderRadius: 14,
            background: MATCH_ACCENT,
            color: "#1a1714",
            padding: "12px 20px",
            fontWeight: 900,
            textDecoration: "none",
          }}
        >
          Join a room
        </Link>
      </div>
    );
  }

  if (guestState.status === "connecting") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: palette.bg,
          color: palette.ink,
        }}
      >
        <p>Connecting…</p>
      </div>
    );
  }

  if (guestState.status === "error") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          background: palette.bg,
        }}
      >
        <p role="alert" style={{ maxWidth: 440, textAlign: "center", color: palette.ink }}>
          {guestState.message}
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={() => bumpGuestConnection()}
            style={{
              border: `2px solid ${palette.line}`,
              borderRadius: 12,
              padding: "10px 16px",
              cursor: "pointer",
              background: palette.panel2,
              fontWeight: 700,
            }}
          >
            Retry
          </button>
          <Link
            href="/join"
            style={{
              border: `2px solid ${palette.line}`,
              borderRadius: 12,
              padding: "10px 16px",
              fontWeight: 700,
              color: palette.ink,
              textDecoration: "none",
            }}
          >
            Join again
          </Link>
        </div>
      </div>
    );
  }

  if (guestState.status !== "joined") {
    return null;
  }

  if (!isMatchFlowPhase(guestState.phase) && guestState.phase !== "matchEnded") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: palette.bg,
        }}
      >
        <p style={{ color: palette.ink }}>Redirecting…</p>
      </div>
    );
  }

  const wsLive = guestTransport === "live";
  const isArtistView =
    guestState.drawerPlayerId === guestState.playerId &&
    (guestState.phase === "choosingWord" || guestState.phase === "drawing");
  const hostPlayer = guestState.players.find((p) => p.isHost);
  const tableTitleLabel = hostPlayer ? `${hostPlayer.displayName}'s table` : "Room";

  return (
    <DrMatchScreen
      palette={palette}
      accentHex={MATCH_ACCENT}
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      phase={guestState.phase}
      players={guestState.players}
      localPlayerId={guestState.playerId}
      isArtistView={isArtistView}
      matchRoundIndex={guestState.matchRoundIndex}
      phaseDeadlineMs={guestState.phaseDeadlineMs}
      roundTotal={roundTotal}
      headerWordSlot={
        <MatchHeaderWord
          palette={palette}
          phase={guestState.phase}
          localPlayerId={guestState.playerId}
          drawerPlayerId={guestState.drawerPlayerId}
          drawingHintRows={guestState.drawingHintRows}
          drawerLocalSecretWord={guestState.drawerLocalSecretWord}
          players={guestState.players}
        />
      }
      wordChoiceBlock={
        guestState.phase === "choosingWord" &&
        guestState.playerId === guestState.drawerPlayerId ? (
          <DrWordChoicePanel
            palette={palette}
            accentHex={MATCH_ACCENT}
            words={guestState.wordChoiceOffer?.words ?? null}
            isLoading={guestState.wordChoiceOffer == null}
            errorMessage={guestState.wordChoicePickError ?? null}
            onPick={guestChooseWord}
            disabled={!wsLive}
          />
        ) : null
      }
      hintFeedBlock={null}
      matchEndedBlock={
        guestState.phase === "matchEnded" ? (
          <DrMatchEndgame
            palette={palette}
            accentHex={MATCH_ACCENT}
            players={guestState.players}
            localPlayerId={guestState.playerId}
            roundsPlayed={roundTotal}
            tableTitleLabel={tableTitleLabel}
            isHost={false}
            backToLobbyHref="/join"
          />
        ) : null
      }
      canvasBlock={
        isMatchFlowPhase(guestState.phase) ? (
          <MatchDrawingColumn
            palette={palette}
            accentHex={MATCH_ACCENT}
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
            wsLive={wsLive}
            showGuessBanner={
              guestState.phase === "drawing" &&
              guestState.drawerPlayerId !== undefined &&
              guestState.playerId !== guestState.drawerPlayerId
            }
          />
        ) : null
      }
      chatBlock={
        <MatchChatPanel
          localPlayerId={guestState.playerId}
          feed={guestState.chatFeed}
          onSend={guestSendChat}
          disabled={!wsLive}
          closeGuessHint={guestState.closeGuessHint}
          variant="doodleRoyale"
          palette={palette}
          accentHex={MATCH_ACCENT}
          showComposer={!isArtistView}
        />
      }
    />
  );
}

export function GameMatchClient() {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<"host" | "guest" | null>(null);

  useEffect(() => {
    const s = loadSession();
    setRole(s?.role ?? null);
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <p className="text-base-content/80">Loading…</p>
      </div>
    );
  }

  if (role === "host") {
    return <HostGameMatch />;
  }

  return <GuestGameMatch />;
}
