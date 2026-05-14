"use client";

import type { LobbyRosterPlayer, RoomPhase } from "@skribbl/shared";
import { isMatchFlowPhase } from "@skribbl/shared";
import type { ReactNode } from "react";
import { FaceSVG } from "@/features/lobby/components/primitives/FaceSVG";
import {
  AVATAR_PRESET_COLORS,
  DR,
  chunk,
  type DrPalette,
} from "@/features/lobby/design/tokens";
import { sortPlayersByFinalScore } from "@/features/match/lib/sort-players-by-final-score";
import { DrMatchTimer } from "@/features/match/components/DrMatchTimer";

function moodFor(i: number): "smile" | "wink" | "sleepy" {
  return (["smile", "smile", "wink", "sleepy", "smile"] as const)[i % 5];
}

function faceStroke(palette: DrPalette): string {
  return palette.line === "#0a0908" ? palette.ink : "#1a1714";
}

function phaseShowsCountdownTimer(phase: RoomPhase): boolean {
  return phase === "choosingWord" || phase === "drawing";
}

export type DrMatchScreenProps = {
  palette: DrPalette;
  accentHex: string;
  isDark: boolean;
  onToggleTheme: () => void;
  phase: RoomPhase;
  players: LobbyRosterPlayer[];
  localPlayerId: string;
  isArtistView: boolean;
  matchRoundIndex?: number;
  phaseDeadlineMs?: number;
  roundTotal: number;
  headerWordSlot: ReactNode;
  wordChoiceBlock: ReactNode;
  hintFeedBlock: ReactNode;
  matchEndedBlock: ReactNode;
  canvasBlock: ReactNode;
  chatBlock: ReactNode;
};

/**
 * ScreenGame.jsx layout — chunky header + canvas / scoreboard + chat (ui_kits/game).
 */
export function DrMatchScreen({
  palette,
  accentHex,
  isDark,
  onToggleTheme,
  phase,
  players,
  localPlayerId,
  isArtistView,
  matchRoundIndex,
  phaseDeadlineMs,
  roundTotal,
  headerWordSlot,
  wordChoiceBlock,
  hintFeedBlock,
  matchEndedBlock,
  canvasBlock,
  chatBlock,
}: DrMatchScreenProps) {
  const ck = (x = 4, y = 5) => chunk(x, y, palette.line);
  const dark = isDark;
  const showTimer =
    phaseDeadlineMs !== undefined && phaseShowsCountdownTimer(phase);
  const chipResetKey = `${String(phase)}-${String(matchRoundIndex ?? "—")}-${String(phaseDeadlineMs)}`;

  const headerMini = players.slice(0, 4);
  const faceStrokeColor = faceStroke(palette);
  const isEndgame = phase === "matchEnded";
  const rightPanelPx = isArtistView ? 260 : 320;
  const chatPanelTitle = isArtistView ? "💬 Their guesses" : "💬 Chat & guesses";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100vh",
        background: palette.bg,
        color: palette.ink,
        fontFamily: DR.font.body,
        display: "grid",
        gridTemplateRows: "auto 1fr",
        backgroundImage: dark
          ? "radial-gradient(rgba(255,255,255,.05) 1.2px,transparent 1.5px)"
          : "radial-gradient(rgba(26,23,20,.07) 1.2px,transparent 1.5px)",
        backgroundSize: "22px 22px",
      }}
    >
      <header
        data-testid="phase-bar"
        style={{
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          background: palette.panel,
          border: `3px solid ${palette.line}`,
          margin: 16,
          marginBottom: 0,
          borderRadius: 18,
          boxShadow: ck(5, 6),
          zIndex: 2,
          position: "relative",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontFamily: DR.font.display,
            fontSize: 18,
            fontWeight: 900,
            lineHeight: 1,
            padding: "6px 12px 8px",
            background: accentHex,
            color: "#1a1714",
            border: `2.5px solid ${palette.line}`,
            borderRadius: 12,
            boxShadow: ck(3, 4),
            transform: "rotate(-2deg)",
            flexShrink: 0,
          }}
        >
          DR
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          style={{
            border: `2.5px solid ${palette.line}`,
            borderRadius: 10,
            padding: "5px 10px",
            background: palette.panel2,
            color: palette.ink,
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {isDark ? "☀️" : "🌙"}
        </button>

        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            minWidth: 200,
          }}
        >
          {phase === "matchEnded" ? (
            <div
              style={{
                fontFamily: DR.font.display,
                fontSize: 20,
                fontWeight: 900,
                background: palette.panel2,
                border: `2.5px solid ${palette.line}`,
                borderRadius: 12,
                padding: "6px 18px",
                boxShadow: ck(),
              }}
            >
              Game over
            </div>
          ) : (
            headerWordSlot
          )}
        </div>

        {phase !== "matchEnded" && matchRoundIndex !== undefined ? (
          <div
            style={{
              padding: "6px 12px",
              border: `2.5px solid ${palette.line}`,
              borderRadius: DR.radius.md,
              background: palette.panel2,
              fontWeight: 700,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            Round <strong>{matchRoundIndex + 1}</strong> / {roundTotal}
          </div>
        ) : null}

        {showTimer && phaseDeadlineMs !== undefined ? (
          <DrMatchTimer
            palette={palette}
            accentHex={accentHex}
            deadlineMs={phaseDeadlineMs}
            resetKey={chipResetKey}
          />
        ) : null}

        {phase !== "matchEnded" && isMatchFlowPhase(phase) ? (
          <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
            {headerMini.map((p, i) => {
              const you = p.playerId === localPlayerId;
              const fill =
                AVATAR_PRESET_COLORS[p.avatarPresetId] ?? accentHex;
              return (
                <div
                  key={p.playerId}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    padding: "4px 8px",
                    border: `2px solid ${palette.line}`,
                    borderRadius: 10,
                    background: you ? accentHex : palette.panel2,
                    color: you ? "#1a1714" : palette.ink,
                    minWidth: 48,
                  }}
                >
                  <FaceSVG
                    color={fill}
                    size={20}
                    mood={moodFor(i)}
                    stroke={you ? "#1a1714" : faceStrokeColor}
                  />
                  <span style={{ fontSize: 10, fontWeight: 700 }}>
                    {p.displayName.slice(0, 6)}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800 }}>
                    {p.score ?? 0}
                  </span>
                </div>
              );
            })}
            {players.length > 4 ? (
              <div
                style={{
                  padding: "4px 8px",
                  border: `2px solid ${palette.line}`,
                  borderRadius: 10,
                  background: palette.panel2,
                  display: "flex",
                  alignItems: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: palette.inkDim,
                }}
              >
                +{players.length - 4}
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isEndgame ? "1fr" : `1fr minmax(${String(rightPanelPx)}px, ${String(rightPanelPx)}px)`,
          gap: 16,
          padding: 16,
          minHeight: 0,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minHeight: 0,
            minWidth: 0,
          }}
        >
          {isEndgame ? matchEndedBlock : null}
          {!isEndgame ? wordChoiceBlock : null}
          {!isEndgame ? hintFeedBlock : null}
          {!isEndgame ? (
            <div style={{ flex: 1, minHeight: 280, display: "flex", flexDirection: "column", minWidth: 0 }}>
              {canvasBlock}
            </div>
          ) : null}
        </div>

        {!isEndgame ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minHeight: 0,
          }}
        >
          <div
            style={{
              background: palette.panel,
              border: `3px solid ${palette.line}`,
              borderRadius: 18,
              boxShadow: ck(5, 6),
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                fontFamily: DR.font.display,
                fontSize: 16,
                fontWeight: 900,
                marginBottom: 2,
              }}
            >
              Scoreboard
            </div>
            {sortPlayersByFinalScore(players)
              .slice(0, 6)
              .map((p, i) => {
                const you = p.playerId === localPlayerId;
                const fill =
                  AVATAR_PRESET_COLORS[p.avatarPresetId] ?? accentHex;
                return (
                  <div
                    key={p.playerId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: you
                        ? accentHex
                        : i === 0
                          ? palette.panel2
                          : "transparent",
                      border: you ? `2px solid ${palette.line}` : "none",
                      borderRadius: 10,
                      padding: you ? "4px 8px" : "2px 0",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 12,
                        width: 18,
                        textAlign: "center",
                        /*
                         * Using accent for rank 1 in `!you` rows keeps parity with ScreenGame.jsx;
                         * it stays readable on both palettes because our accent is vivid.
                         */
                        color: i === 0 ? accentHex : palette.inkDim,
                      }}
                    >
                      {i + 1}
                    </span>
                    <FaceSVG
                      color={fill}
                      size={24}
                      mood={moodFor(i)}
                      stroke={you ? "#1a1714" : faceStrokeColor}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontWeight: 700,
                        fontSize: 13,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: you ? "#1a1714" : palette.ink,
                      }}
                    >
                      {p.displayName}
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 14,
                        color: you ? "#1a1714" : palette.ink,
                      }}
                    >
                      {p.score ?? 0}
                    </span>
                  </div>
                );
              })}
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              background: palette.panel,
              border: `3px solid ${palette.line}`,
              borderRadius: 18,
              boxShadow: ck(5, 6),
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontFamily: DR.font.display,
                fontSize: 16,
                fontWeight: 900,
              }}
            >
              {chatPanelTitle}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              {chatBlock}
            </div>
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
}
