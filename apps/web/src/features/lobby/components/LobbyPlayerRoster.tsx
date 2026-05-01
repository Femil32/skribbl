"use client";

import type { ReactNode } from "react";
import type { LobbyRosterPlayer, RosterConnectionStatus } from "@skribbl/shared";
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

function rosterPresenceLine(p: LobbyRosterPlayer): { ariaHint: string; node: ReactNode } {
  const status: RosterConnectionStatus = p.connectionStatus ?? "connected";
  switch (status) {
    case "connected":
      return {
        ariaHint: p.isHost ? "present" : "present, connected",
        node: (
          <>
            Avatar: {presetLabel(p.avatarPresetId)}
            {p.isHost ? " · Host can start the match" : " · Connected"}
          </>
        ),
      };
    case "disconnected":
      return {
        ariaHint: "disconnected, may reconnect",
        node: (
          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-base-content/75">
            <span className="inline-flex items-center gap-1 font-medium" title="Disconnected">
              <svg
                className="size-3.5 shrink-0 text-base-content/80"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M2 12h2M6 12h12M20 12h2" opacity={0.35} />
                <path d="M4 4l16 16" />
              </svg>
              Disconnected · may reconnect
            </span>
            <span className="text-base-content/55">· Avatar: {presetLabel(p.avatarPresetId)}</span>
          </span>
        ),
      };
    default: {
      const _never: never = status;
      return _never;
    }
  }
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
        const disconnected = (p.connectionStatus ?? "connected") === "disconnected";
        const { ariaHint, node } = rosterPresenceLine(p);
        const rowAria = `${p.displayName}${self ? ", you" : ""}${p.isHost ? ", host" : ""}, ${ariaHint}`;
        return (
          <li
            key={p.playerId}
            aria-label={rowAria}
            className={`flex items-center gap-3 rounded-box border px-3 py-2 ${
              disconnected
                ? "border-base-300/60 bg-base-200/35 opacity-80"
                : "border-base-300 bg-base-200/50"
            }`}
          >
            <span
              className="inline-block size-10 shrink-0 rounded-full border border-base-300 bg-linear-to-br from-primary/30 to-secondary/40"
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
              <span className="text-xs text-base-content/60">{node}</span>
            </div>
            {showScores ? (
              <span
                className="shrink-0 text-lg font-semibold tabular-nums text-base-content/90 text-right min-w-10"
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
