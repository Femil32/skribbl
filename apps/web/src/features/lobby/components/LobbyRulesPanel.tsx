"use client";

import type { RoomSettings } from "@skribbl/shared";
import { DR, WORD_PACKS, chunk, type WordPackId } from "@/features/lobby/design/tokens";
import { useLobbySettingsStore } from "@/features/lobby/stores/lobby-settings-store";
import { Stepper } from "@/features/lobby/components/primitives/Stepper";
import { Toggle } from "@/features/lobby/components/primitives/Toggle";
import { SectionLabel } from "@/features/lobby/components/primitives/SectionLabel";

export type LobbyRulesPanelProps = {
  isHost: boolean;
  accentHex: string;
  sendSettings: (partial: Partial<RoomSettings>) => void;
};

export function LobbyRulesPanel({ isHost, accentHex, sendSettings }: LobbyRulesPanelProps) {
  const C = DR.colors;
  const ck = (x = 4, y = 5) => chunk(x, y, C.line);
  const {
    rounds,
    setRounds,
    drawTime,
    setDrawTime,
    maxPlayers,
    setMaxPlayers,
    wordPack,
    setWordPack,
    showHints,
    setShowHints,
    skipAfk,
    setSkipAfk,
    allowVoice,
    setAllowVoice,
  } = useLobbySettingsStore();

  return (
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Stepper
          label="Rounds"
          value={rounds}
          min={1}
          max={20}
          data-testid="settings-rounds"
          setValue={(v) => {
            setRounds(v);
            sendSettings({ rounds: v });
          }}
          disabled={!isHost}
        />
        <Stepper
          label="Draw time"
          value={drawTime}
          min={20}
          max={240}
          step={10}
          unit="s"
          data-testid="settings-drawTime"
          setValue={(v) => {
            setDrawTime(v);
            sendSettings({ drawTime: v });
          }}
          disabled={!isHost}
        />
        <Stepper
          label="Max players"
          value={maxPlayers}
          min={2}
          max={12}
          data-testid="settings-maxPlayers"
          setValue={(v) => {
            setMaxPlayers(v);
            sendSettings({ maxPlayers: v });
          }}
          disabled={!isHost}
        />
      </div>

      <div>
        <SectionLabel>Word pack</SectionLabel>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {WORD_PACKS.map((wp) => {
            const selected = wordPack === wp.id;
            return (
              <button
                key={wp.id}
                type="button"
                data-testid={`settings-wordPack-${wp.id}`}
                onClick={() => {
                  if (isHost) {
                    setWordPack(wp.id as WordPackId);
                    sendSettings({ wordPack: wp.id });
                  }
                }}
                disabled={!isHost}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary"
                style={{
                  border: `2.5px solid ${C.line}`,
                  borderRadius: 12,
                  background: selected ? accentHex : C.panel2,
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

      <div style={{ display: "flex", gap: 10, marginTop: "auto", flexWrap: "wrap" }}>
        <Toggle
          label="Show hints"
          value={showHints}
          data-testid="settings-showHints"
          setValue={(v) => {
            setShowHints(v);
            sendSettings({ showHints: v });
          }}
          disabled={!isHost}
        />
        <Toggle
          label="Auto-skip AFK"
          value={skipAfk}
          data-testid="settings-skipAfk"
          setValue={(v) => {
            setSkipAfk(v);
            sendSettings({ skipAfk: v });
          }}
          disabled={!isHost}
        />
        <Toggle
          label="Allow voice"
          value={allowVoice}
          data-testid="settings-allowVoice"
          setValue={(v) => {
            setAllowVoice(v);
            sendSettings({ allowVoice: v });
          }}
          disabled={!isHost}
        />
      </div>
    </section>
  );
}
