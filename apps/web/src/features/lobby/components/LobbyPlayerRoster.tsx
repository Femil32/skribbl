"use client";

import type { LobbyRosterPlayer } from "@skribbl/shared";
import { DR, chunk } from "@/features/lobby/design/tokens";
import { PlayerCard } from "./primitives/PlayerCard";
import { EmptySlot } from "./primitives/EmptySlot";

type LobbyPlayerRosterProps = {
  players: LobbyRosterPlayer[];
  localPlayerId: string;
  maxPlayers: number;
  accent: string;
  /** Host can start a vote to remove another connected player (Story 8.4). */
  onVoteKick?: (playerId: string) => void;
};

export function LobbyPlayerRoster({
  players,
  localPlayerId,
  maxPlayers,
  accent,
  onVoteKick,
}: LobbyPlayerRosterProps) {
  const C = DR.colors;
  const ready = players.filter((p) => (p.connectionStatus ?? "connected") === "connected").length;

  return (
    <section aria-labelledby="lobby-roster-heading">
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
        <h2
          id="lobby-roster-heading"
          style={{ margin: 0, fontFamily: DR.font.display, fontSize: 22, fontWeight: 800, color: C.ink }}
        >
          Doodlers
        </h2>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.inkDim, letterSpacing: ".1em" }}>
          {players.length}/{maxPlayers} · {ready} ready
        </span>
        {/* Capacity pip track */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                border: `2px solid ${C.line}`,
                background: i <= Math.ceil((players.length / maxPlayers) * 5) ? accent : "transparent",
              }}
            />
          ))}
        </div>
      </div>

      {/* Player grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
          gap: 10,
        }}
        role="list"
      >
        {players.map((p, idx) => (
          <div key={p.playerId} role="listitem">
            <PlayerCard
              player={p}
              index={idx}
              isLocalPlayer={p.playerId === localPlayerId}
              accent={accent}
              onVoteKick={onVoteKick ? () => onVoteKick(p.playerId) : undefined}
            />
          </div>
        ))}
        {/* Empty slot placeholders */}
        {Array.from({ length: Math.max(0, maxPlayers - players.length) }).map((_, i) => (
          <div key={`empty-${i}`} role="listitem" aria-hidden>
            <EmptySlot />
          </div>
        ))}
      </div>
    </section>
  );
}
