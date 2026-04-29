"use client";

import type { LobbyRosterPlayer } from "@skribbl/shared";
import {
  avatarPresets,
  type AvatarPresetId,
} from "@skribbl/shared";

type LobbyPlayerRosterProps = {
  players: LobbyRosterPlayer[];
  localPlayerId: string;
  /** When true, show authoritative match totals (tabular numerals UX-DR5). */
  showScores?: boolean;
};

function presetLabel(id: AvatarPresetId): string {
  return avatarPresets.find((p) => p.id === id)?.label ?? id;
}

/**
 * Lobby roster rows: avatar preset, display name (plain text), host badge, accessible status hints (UX-DR8).
 */
export function LobbyPlayerRoster({
  players,
  localPlayerId,
  showScores = false,
}: LobbyPlayerRosterProps) {
  if (players.length === 0) {
    return (
      <p className="text-sm text-base-content/70" id="lobby-roster-empty">
        Waiting for players…
      </p>
    );
  }

  return (
    <section className="space-y-2" aria-labelledby="lobby-roster-heading">
      <h2 id="lobby-roster-heading" className="sr-only">
        Players in this room
      </h2>
      <ul className="space-y-3">
      {players.map((p) => {
        const self = p.playerId === localPlayerId;
        return (
          <li
            key={p.playerId}
            className="flex items-center gap-3 rounded-box border border-base-300 bg-base-200/50 px-3 py-2"
          >
            <span
              className="inline-block size-10 shrink-0 rounded-full border border-base-300 bg-gradient-to-br from-primary/30 to-secondary/40"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium truncate">{p.displayName}</span>
                {self ? (
                  <span className="badge badge-ghost badge-sm">You</span>
                ) : null}
                {p.isHost ? (
                  <span className="badge badge-primary badge-sm">Host</span>
                ) : null}
              </div>
              <span className="text-xs text-base-content/60">
                Avatar: {presetLabel(p.avatarPresetId)}
                {p.isHost ? " · Host can start the match" : " · Connected"}
              </span>
            </div>
            {showScores ? (
              <span
                className="shrink-0 text-lg font-semibold tabular-nums text-base-content/90 text-right min-w-[2.5rem]"
                aria-label={`Score for ${p.displayName}: ${String(p.score ?? 0)}`}
              >
                {p.score ?? 0}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
    </section>
  );
}
