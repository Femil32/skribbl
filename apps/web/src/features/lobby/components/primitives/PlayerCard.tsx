import type { LobbyRosterPlayer } from "@skribbl/shared";
import { DR, AVATAR_PRESET_COLORS, chunk } from "@/features/lobby/design/tokens";
import { FaceSVG } from "./FaceSVG";
import { StatusDot } from "./StatusDot";

// Deterministic mood assignment by player position index
const MOODS = ["smile", "smile", "wink", "sleepy", "smile"] as const;

type PlayerCardProps = {
  player: LobbyRosterPlayer;
  index: number;
  isLocalPlayer: boolean;
  accent: string;
  /** Host can kick non-host, non-self players */
  onKick?: () => void;
};

export function PlayerCard({ player, index, isLocalPlayer, accent, onKick }: PlayerCardProps) {
  const C = DR.colors;
  const ck = (x = 3, y = 4) => chunk(x, y, C.line);
  const avatarColor = AVATAR_PRESET_COLORS[player.avatarPresetId] ?? "#ffd93d";
  const mood = MOODS[index % MOODS.length];
  const disconnected = (player.connectionStatus ?? "connected") === "disconnected";

  return (
    <div
      style={{
        position: "relative",
        background: isLocalPlayer ? accent : C.panel2,
        color: isLocalPlayer ? "#1a1714" : C.ink,
        border: `2.5px solid ${C.line}`,
        borderRadius: DR.radius.lg,
        padding: "8px 10px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: ck(),
        // Subtle per-card tilt for playful feel
        transform: `rotate(${(index % 5 - 2) * 0.4}deg)`,
        opacity: disconnected ? 0.7 : 1,
      }}
      aria-label={`${player.displayName}${isLocalPlayer ? ", you" : ""}${player.isHost ? ", host" : ""}`}
    >
      {/* Avatar face */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <FaceSVG color={avatarColor} mood={mood} size={36} />
        {player.isHost && (
          <div
            style={{ position: "absolute", top: -8, right: -6, fontSize: 14, transform: "rotate(15deg)" }}
            aria-label="host"
          >
            👑
          </div>
        )}
      </div>

      {/* Name + status */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: 13,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {player.displayName}
          {isLocalPlayer && (
            <span style={{ fontWeight: 600, opacity: 0.7 }}> · you</span>
          )}
        </div>
        <div
          style={{
            fontFamily: DR.font.mono,
            fontSize: 10,
            opacity: 0.7,
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <StatusDot ready={!disconnected} />
          {disconnected ? "away" : "ready"}
        </div>
      </div>

      {/* Kick button — host-only, not for self or other host */}
      {onKick && !player.isHost && !isLocalPlayer && (
        <button
          type="button"
          onClick={onKick}
          aria-label={`Kick ${player.displayName}`}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary"
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: 6,
            border: `1.5px solid ${C.line}`,
            background: "transparent",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            color: "inherit",
            padding: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
