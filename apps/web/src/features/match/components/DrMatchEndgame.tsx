"use client";

import type { LobbyRosterPlayer } from "@skribbl/shared";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { FaceSVG } from "@/features/lobby/components/primitives/FaceSVG";
import {
  AVATAR_PRESET_COLORS,
  DR,
  chunk,
  type DrPalette,
} from "@/features/lobby/design/tokens";
import { sortPlayersByFinalScore } from "@/features/match/lib/sort-players-by-final-score";

function moodFor(i: number): "smile" | "wink" | "sleepy" {
  return (["smile", "smile", "wink", "sleepy", "smile"] as const)[i % 5];
}

function faceStroke(palette: DrPalette): string {
  return palette.line === "#0a0908" ? palette.ink : "#1a1714";
}

export type DrMatchEndgameProps = {
  palette: DrPalette;
  accentHex: string;
  players: LobbyRosterPlayer[];
  localPlayerId: string;
  roundsPlayed: number;
  tableTitleLabel: string;
  isHost: boolean;
  onPlayAgain?: () => void;
  playAgainDisabled?: boolean;
  backToLobbyHref: string;
};

/**
 * End-game layout aligned to reference HTML (podium, leaderboard, share).
 */
export function DrMatchEndgame({
  palette,
  accentHex,
  players,
  localPlayerId,
  roundsPlayed,
  tableTitleLabel,
  isHost,
  onPlayAgain,
  playAgainDisabled = false,
  backToLobbyHref,
}: DrMatchEndgameProps) {
  const ck = (x = 4, y = 5) => chunk(x, y, palette.line);
  const sorted = useMemo(() => sortPlayersByFinalScore(players), [players]);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const shareText = useMemo(() => {
    const lines = sorted.slice(0, 3).map((p, i) => {
      const ord = i === 0 ? "1st" : i === 1 ? "2nd" : "3rd";
      return `${ord}: ${p.displayName} · ${String(p.score ?? 0)} pts`;
    });
    return `${lines.join("\n")}\nplayed on Doodle Royale 🎨`;
  }, [sorted]);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyStatus("Copied!");
      window.setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      setCopyStatus("Could not copy");
      window.setTimeout(() => setCopyStatus(null), 2500);
    }
  }, [shareText]);

  const mvp = sorted[0];
  const top3 = sorted.slice(0, 3);
  const podiumOrder: (typeof sorted)[number][] = [];
  if (top3[1]) podiumOrder.push(top3[1]);
  if (top3[0]) podiumOrder.push(top3[0]);
  if (top3[2]) podiumOrder.push(top3[2]);

  const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉");

  return (
    <div
      data-testid="scoreboard-summary"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 22,
        maxWidth: 760,
        margin: "0 auto",
        width: "100%",
        padding: "4px 0 24px",
      }}
    >
      <header style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
        <h1
          style={{
            fontFamily: DR.font.display,
            fontSize: 30,
            fontWeight: 900,
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Game over
        </h1>
        <p style={{ margin: 0, color: palette.inkDim, fontWeight: 700, fontSize: 15 }}>
          {tableTitleLabel} — {roundsPlayed} rounds played
        </p>
      </header>

      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Link
          href={backToLobbyHref}
          style={{
            border: `2.5px solid ${palette.line}`,
            borderRadius: 12,
            padding: "10px 18px",
            fontWeight: 800,
            background: palette.panel2,
            color: palette.ink,
            textDecoration: "none",
            boxShadow: ck(3, 4),
          }}
        >
          ← Back to lobby
        </Link>
        {isHost ? (
          <button
            type="button"
            disabled={playAgainDisabled || !onPlayAgain}
            onClick={() => onPlayAgain?.()}
            style={{
              border: `2.5px solid ${palette.line}`,
              borderRadius: 12,
              padding: "10px 18px",
              fontWeight: 900,
              background: accentHex,
              color: "#1a1714",
              cursor: playAgainDisabled || !onPlayAgain ? "not-allowed" : "pointer",
              opacity: playAgainDisabled || !onPlayAgain ? 0.55 : 1,
              boxShadow: ck(3, 4),
            }}
          >
            🔁 Play again
          </button>
        ) : (
          <span style={{ fontSize: 14, color: palette.inkDim, fontWeight: 600 }}>
            Only the host can start a new match.
          </span>
        )}
      </div>

      <div
        style={{
          textAlign: "center",
          fontFamily: DR.font.display,
          fontSize: 24,
          fontWeight: 900,
        }}
      >
        🎉 Game over! 🎉
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          gap: 14,
          flexWrap: "wrap",
          minHeight: 140,
        }}
      >
        {podiumOrder.map((p, i) => {
          const rank = p === top3[0] ? 1 : p === top3[1] ? 2 : 3;
          const tall = rank === 1;
          const fill = AVATAR_PRESET_COLORS[p.avatarPresetId] ?? accentHex;
          return (
            <div
              key={p.playerId}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: tall ? "18px 16px" : "12px 14px",
                minWidth: 120,
                background: rank === 1 ? accentHex : palette.panel2,
                border: `3px solid ${palette.line}`,
                borderRadius: 16,
                boxShadow: ck(5, rank === 1 ? 7 : 5),
                color: rank === 1 ? "#1a1714" : palette.ink,
                transform: rank === 1 ? "translateY(-8px)" : "none",
              }}
            >
              <span style={{ fontSize: 28 }} aria-hidden>
                {medal(rank)}
              </span>
              <FaceSVG
                color={fill}
                size={tall ? 40 : 32}
                mood={moodFor(i)}
                stroke={rank === 1 ? "#1a1714" : faceStroke(palette)}
              />
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 13,
                  textAlign: "center",
                  maxWidth: 110,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {p.displayName}
              </span>
              <span style={{ fontWeight: 900, fontSize: 18 }}>{p.score ?? 0}</span>
              <span style={{ fontWeight: 800, fontSize: 12, opacity: 0.85 }}>{rank}</span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          fontFamily: DR.font.display,
          fontWeight: 900,
          fontSize: 15,
          color: palette.inkDim,
          textAlign: "center",
          letterSpacing: "0.02em",
        }}
      >
        leaderboard rounds
      </div>

      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
        aria-label="Final scores"
      >
        {sorted.map((p, index) => {
          const rank = index + 1;
          const you = p.playerId === localPlayerId;
          const fill = AVATAR_PRESET_COLORS[p.avatarPresetId] ?? accentHex;
          const away = (p.connectionStatus ?? "connected") === "disconnected";
          return (
            <li
              key={p.playerId}
              data-testid={`scoreboard-row-${p.playerId}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 14,
                border: `2.5px solid ${palette.line}`,
                background: you ? accentHex : rank <= 3 ? palette.panel2 : palette.panel,
                color: you ? "#1a1714" : palette.ink,
                boxShadow: you ? ck(3, 4) : "none",
                opacity: away ? 0.75 : 1,
              }}
            >
              <span style={{ fontWeight: 900, fontSize: 14, minWidth: 36 }}>#{rank}</span>
              <FaceSVG
                color={fill}
                size={28}
                mood={moodFor(index)}
                stroke={you ? "#1a1714" : faceStroke(palette)}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.displayName}
                  {you ? (
                    <span style={{ fontWeight: 700, marginLeft: 6, fontSize: 12 }}>that&apos;s you!</span>
                  ) : null}
                </div>
                {away ? (
                  <div style={{ fontSize: 11, opacity: 0.75 }}>Disconnected</div>
                ) : null}
              </div>
              <span style={{ fontWeight: 900, fontSize: 16 }}>{p.score ?? 0}</span>
            </li>
          );
        })}
      </ol>

      {mvp ? (
        <section
          style={{
            border: `3px solid ${palette.line}`,
            borderRadius: 18,
            padding: "16px 18px",
            background: palette.panel2,
            boxShadow: ck(5, 6),
          }}
        >
          <div style={{ fontWeight: 900, fontFamily: DR.font.display, fontSize: 17, marginBottom: 6 }}>
            ★ MVP of the night
          </div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            {mvp.displayName} · {mvp.score ?? 0} pts
          </div>
        </section>
      ) : null}

      <section
        style={{
          border: `3px solid ${palette.line}`,
          borderRadius: 18,
          padding: "16px 18px",
          background: palette.panel,
          boxShadow: ck(4, 5),
        }}
      >
        <div style={{ fontWeight: 900, fontFamily: DR.font.display, fontSize: 17, marginBottom: 8 }}>
          🎨 Stats & fun facts
        </div>
        <p style={{ margin: 0, color: palette.inkDim, fontSize: 14, lineHeight: 1.5 }}>
          Round-by-round highlights (fastest guess, hardest word, and more) will appear here as we
          wire match analytics — for now, celebrate the leaderboard above!
        </p>
      </section>

      <section
        style={{
          border: `3px solid ${palette.line}`,
          borderRadius: 18,
          padding: "16px 18px",
          background: palette.panel,
          boxShadow: ck(4, 5),
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 900, fontFamily: DR.font.display, fontSize: 17 }}>📣 Share results</div>
        <pre
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 12,
            background: palette.panel2,
            border: `2px solid ${palette.line}`,
            fontFamily: DR.font.mono,
            fontSize: 12,
            whiteSpace: "pre-wrap",
            color: palette.ink,
          }}
        >
          {shareText}
        </pre>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void onCopy()}
            style={{
              border: `2.5px solid ${palette.line}`,
              borderRadius: 12,
              padding: "8px 14px",
              fontWeight: 800,
              background: palette.ink,
              color: palette.panel,
              cursor: "pointer",
            }}
          >
            📋 Copy to clipboard
          </button>
          {copyStatus ? (
            <span style={{ fontSize: 13, fontWeight: 700, color: palette.inkDim }}>{copyStatus}</span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
