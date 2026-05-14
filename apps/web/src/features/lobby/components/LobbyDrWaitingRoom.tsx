"use client";

import type { RoomSettings } from "@skribbl/shared";
import type { ReactNode } from "react";
import { DR, chunk } from "@/features/lobby/design/tokens";
import { LobbyPreGameChatPanel } from "@/features/lobby/components/LobbyPreGameChatPanel";
import type { LobbyDrChatMessage } from "@/features/lobby/components/LobbyPreGameChatPanel";
import { LobbyRulesPanel } from "@/features/lobby/components/LobbyRulesPanel";

export type { LobbyDrChatMessage };

const DEFAULT_ACCENT = DR.accent.tomato;

export type LobbyDrWaitingRoomProps = {
  /** Full-width strip above the header (e.g. guest join context). */
  callout?: ReactNode;
  roomCode: string;
  headerEyebrow: string;
  headerTitle: string;
  localDisplayName: string;
  accentHex?: string;
  toast: string | null;
  /** Highlight copy-code affordance after successful copy. */
  codeCopiedHighlight: boolean;
  copyError: string | null;
  onCopyRoomCode: () => void | Promise<void>;
  transportLive: boolean;
  /** When false, Leave lobby control is omitted. */
  showLeaveLobby?: boolean;
  onLeaveLobby?: () => void;
  chatMessages: LobbyDrChatMessage[];
  chatDraft: string;
  onChatDraftChange: (v: string) => void;
  onSendLobbyChat: () => void;
  chatSubmitDisabled?: boolean;
  chatFooterNotice?: string | null;
  /** Wrapped roster + vote-kick UI. */
  playersPanel: ReactNode;
  rulesIsHost: boolean;
  sendRoomSettings: (partial: Partial<RoomSettings>) => void;
  /** Invite row, primary action, helpers (host START / guest messaging). */
  sidebarFooter: ReactNode;
};

export function LobbyDrWaitingRoom({
  callout,
  roomCode,
  headerEyebrow,
  headerTitle,
  localDisplayName,
  accentHex = DEFAULT_ACCENT,
  toast,
  codeCopiedHighlight,
  copyError,
  onCopyRoomCode,
  transportLive,
  showLeaveLobby = true,
  onLeaveLobby,
  chatMessages,
  chatDraft,
  onChatDraftChange,
  onSendLobbyChat,
  chatSubmitDisabled,
  chatFooterNotice,
  playersPanel,
  rulesIsHost,
  sendRoomSettings,
  sidebarFooter,
}: LobbyDrWaitingRoomProps) {
  const C = DR.colors;
  const ck = (x = 4, y = 5) => chunk(x, y, C.line);

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
        minHeight: "calc(100vh - 60px)",
      }}
    >
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

      {callout ? (
        <div
          style={{
            gridColumn: "1 / -1",
            position: "relative",
            zIndex: 1,
          }}
        >
          {callout}
        </div>
      ) : null}

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
        <div
          style={{
            fontFamily: DR.font.display,
            fontSize: 38,
            lineHeight: 0.9,
            fontWeight: 900,
            letterSpacing: "-.02em",
            padding: "10px 16px 14px",
            background: accentHex,
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
            {headerEyebrow}
          </div>
          <div style={{ fontFamily: DR.font.display, fontSize: 26, fontWeight: 800 }}>
            {headerTitle}
          </div>
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            alignItems: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={() => {
              void onCopyRoomCode();
            }}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
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
                color: codeCopiedHighlight ? DR.semantic.success : C.inkDim,
                transition: "color .2s",
              }}
            >
              {codeCopiedHighlight ? "✓ copied" : "⧉ copy"}
            </span>
          </button>
          {showLeaveLobby && onLeaveLobby ? (
            <button
              type="button"
              onClick={() => onLeaveLobby()}
              disabled={!transportLive}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              style={{
                background: "transparent",
                color: C.inkDim,
                border: `2px solid ${C.line}`,
                borderRadius: 12,
                padding: "8px 12px",
                fontFamily: DR.font.body,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: ".06em",
                textTransform: "uppercase",
                cursor: transportLive ? "pointer" : "not-allowed",
                opacity: transportLive ? 1 : 0.55,
              }}
            >
              Leave lobby
            </button>
          ) : null}
          {copyError ? (
            <p style={{ fontSize: 12, color: DR.semantic.danger, margin: 0 }}>{copyError}</p>
          ) : null}
        </div>
      </header>

      <section
        aria-label="Players and game settings"
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateRows: "auto 1fr",
          gap: 20,
          minHeight: 0,
        }}
      >
        <section
          style={{
            background: C.panel,
            border: `3px solid ${C.line}`,
            borderRadius: 22,
            boxShadow: ck(6, 7),
            padding: "18px 20px 20px",
          }}
        >
          {playersPanel}
        </section>

        <LobbyRulesPanel isHost={rulesIsHost} accentHex={accentHex} sendSettings={sendRoomSettings} />
      </section>

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
        <LobbyPreGameChatPanel
          messages={chatMessages}
          draft={chatDraft}
          onDraftChange={onChatDraftChange}
          localDisplayName={localDisplayName}
          accentHex={accentHex}
          onSubmit={onSendLobbyChat}
          submitDisabled={chatSubmitDisabled}
          footerNotice={chatFooterNotice}
        />

        {sidebarFooter}
      </aside>
    </div>
  );
}
