"use client";

import { FormEvent, useEffect, useRef } from "react";
import { DR, chunk } from "@/features/lobby/design/tokens";

export type LobbyDrChatMessage = {
  id: string;
  who: string;
  text: string;
  system?: boolean;
};

export type LobbyPreGameChatPanelProps = {
  messages: LobbyDrChatMessage[];
  draft: string;
  onDraftChange: (next: string) => void;
  localDisplayName: string;
  accentHex: string;
  onSubmit: () => void;
  submitDisabled?: boolean;
  footerNotice?: string | null;
};

export function LobbyPreGameChatPanel({
  messages,
  draft,
  onDraftChange,
  localDisplayName,
  accentHex,
  onSubmit,
  submitDisabled,
  footerNotice,
}: LobbyPreGameChatPanelProps) {
  const C = DR.colors;
  const ck = (x = 4, y = 5) => chunk(x, y, C.line);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: 99999 });
  }, [messages]);

  return (
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
          · {messages.length} messages
        </span>
      </div>

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
        {messages.map((m) =>
          m.system ? (
            <div
              key={m.id}
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
            <div key={m.id} style={{ display: "flex", gap: 8 }}>
              <span
                style={{
                  fontWeight: 800,
                  color: m.who === localDisplayName ? "#1a1714" : C.ink,
                  background: m.who === localDisplayName ? accentHex : "transparent",
                  padding: m.who === localDisplayName ? "0 6px" : 0,
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
        {messages.length === 0 ? (
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
        ) : null}
      </div>

      {footerNotice ? (
        <p className="text-warning text-xs text-center" role="status" style={{ margin: 0 }}>
          {footerNotice}
        </p>
      ) : null}

      <form
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          onSubmit();
        }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="say hi…"
          aria-label="Chat message"
          disabled={submitDisabled}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary"
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
          disabled={submitDisabled}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary"
          style={{
            border: `2.5px solid ${C.line}`,
            borderRadius: 12,
            background: C.ink,
            color: C.panel,
            padding: "0 14px",
            fontWeight: 800,
            cursor: submitDisabled ? "not-allowed" : "pointer",
            opacity: submitDisabled ? 0.55 : 1,
            boxShadow: ck(3, 4),
            fontFamily: DR.font.body,
          }}
        >
          send
        </button>
      </form>
    </div>
  );
}
