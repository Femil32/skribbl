"use client";

import {
  assertChatMessageLength,
  CHAT_MESSAGE_MAX_GRAPHEMES,
  sanitizeChatMessage,
  type ServerEvent,
} from "@skribbl/shared";
import { FormEvent, useEffect, useRef, useState } from "react";

import type { DrPalette } from "@/features/lobby/design/tokens";
import { DR } from "@/features/lobby/design/tokens";

export type MatchChatFeedEvent = Extract<
  ServerEvent,
  | { type: "chatPlayerMessage" }
  | { type: "chatSystemMessage" }
  | { type: "chatCorrectGuess" }
>;

type MatchChatPanelProps = {
  localPlayerId: string;
  feed: MatchChatFeedEvent[];
  onSend: (text: string) => void;
  disabled: boolean;
  /** Ephemeral private proximity hint (Story 7.1); not part of chat log. */
  closeGuessHint?: { message: string; id: string } | null;
  /** DaisyUI (default) vs Doodle Royale chunky kit (HTML references). */
  variant?: "daisy" | "doodleRoyale";
  /** Required when `variant` is `doodleRoyale`. */
  palette?: DrPalette;
  accentHex?: string;
  /** Hide composer (e.g. drawer “Their guesses” view). */
  showComposer?: boolean;
  composerPlaceholder?: string;
  composerSubmitLabel?: string;
};

/** Whisper banner for close-guess feedback (Story 7.1 / FR24). */
export const CLOSE_GUESS_HINT_BANNER_MS = 3200;
export const CLOSE_GUESS_HINT_BANNER_MS_REDUCED_MOTION = 2000;
/** Banner visibility duration (full motion preference). */
export const CORRECT_GUESS_BANNER_MS = 3600;
/** Shorter dwell time when prefers-reduced-motion matches UX-DR14. */
export const CORRECT_GUESS_BANNER_MS_REDUCED_MOTION = 2200;

/** Exported for unit tests — AC6: prefer server facts only (revealedWord vs censoredAnnouncement). */
export function lineForCorrectGuess(
  ev: Extract<MatchChatFeedEvent, { type: "chatCorrectGuess" }>,
): string {
  const revealed = ev.revealedWord?.trim();
  if (revealed) return `${ev.guesserDisplayName} guessed: ${revealed}`;
  return ev.censoredAnnouncement;
}

export function MatchChatPanel({
  localPlayerId,
  feed,
  onSend,
  disabled,
  closeGuessHint = null,
  variant = "daisy",
  palette,
  accentHex,
  showComposer = true,
  composerPlaceholder = "type your guess…",
  composerSubmitLabel = "go",
}: MatchChatPanelProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const [draft, setDraft] = useState("");
  const [pulseBanner, setPulseBanner] = useState<string | null>(null);
  const [closeHintBanner, setCloseHintBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!closeGuessHint) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- sync ephemeral hint clearing with prop */
      setCloseHintBanner(null);
      return;
    }
    setCloseHintBanner(closeGuessHint.message);
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = prefersReduced
      ? CLOSE_GUESS_HINT_BANNER_MS_REDUCED_MOTION
      : CLOSE_GUESS_HINT_BANNER_MS;
    const hideId = window.setTimeout(() => setCloseHintBanner(null), ms);
    return () => window.clearTimeout(hideId);
  }, [closeGuessHint?.id, closeGuessHint?.message]);

  useEffect(() => {
    const last = feed[feed.length - 1];
    if (!last || last.type !== "chatCorrectGuess") {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- drop celebration when feed focus moves past the latest correct guess */
      setPulseBanner(null);
      return;
    }
    const text = lineForCorrectGuess(last);
    setPulseBanner(text);
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = prefersReduced ? CORRECT_GUESS_BANNER_MS_REDUCED_MOTION : CORRECT_GUESS_BANNER_MS;
    const hideId = window.setTimeout(() => setPulseBanner(null), ms);
    return () => window.clearTimeout(hideId);
  }, [feed]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [feed.length]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = draft.trim();
    if (t === "" || disabled) return;
    if (!assertChatMessageLength(sanitizeChatMessage(t)).ok) return;
    onSend(t);
    setDraft("");
  }

  const trimmedDraft = draft.trim();
  const chatLengthOk =
    trimmedDraft === "" || assertChatMessageLength(sanitizeChatMessage(trimmedDraft)).ok;

  const useDr = variant === "doodleRoyale" && palette !== undefined && accentHex !== undefined;
  const C = palette;
  const accent = accentHex;

  function messagesInner() {
    return feed.map((ev) => {
      if (ev.type === "chatPlayerMessage") {
        const isSelf = ev.senderPlayerId === localPlayerId;
        if (useDr && C) {
          return (
            <li key={`${ev.id}:${ev.ts}`} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontWeight: 800,
                  color: isSelf ? accent : C.ink,
                  flexShrink: 0,
                }}
              >
                {ev.senderDisplayName}
              </span>
              <span style={{ fontWeight: 500, color: C.ink }}>{ev.text}</span>
            </li>
          );
        }
        return (
          <li
            key={`${ev.id}:${ev.ts}`}
            className={`text-sm break-words ${isSelf ? "text-end" : "text-start"}`}
          >
            <span className="font-semibold text-base-content/85">
              {ev.senderDisplayName}:{" "}
            </span>
            <span className="text-base-content">{ev.text}</span>
          </li>
        );
      }
      if (ev.type === "chatSystemMessage") {
        if (useDr && C) {
          return (
            <li key={`${ev.id}:${ev.ts}`} style={{ fontSize: 12, color: C.inkDim, fontStyle: "italic" }}>
              <span style={{ fontWeight: 600, fontStyle: "normal" }}>System · </span>
              {ev.text}
            </li>
          );
        }
        return (
          <li
            key={`${ev.id}:${ev.ts}`}
            className="text-xs text-base-content/75 italic text-start break-words"
          >
            <span className="font-medium not-italic">System · </span>
            {ev.text}
          </li>
        );
      }
      if (useDr && C) {
        return (
          <li
            key={`${ev.id}:${ev.ts}`}
            data-chat-row="correctGuess"
            style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
          >
            <span style={{ fontWeight: 800, color: DR.semantic.success, flexShrink: 0 }}>✓</span>
            <span style={{ fontWeight: 700, color: C.ink, background: "rgba(42,143,74,.12)", borderRadius: 6, padding: "0 6px" }}>
              {lineForCorrectGuess(ev)}
            </span>
          </li>
        );
      }
      return (
        <li
          key={`${ev.id}:${ev.ts}`}
          className="text-sm text-success font-medium text-start break-words flex gap-2 items-start"
          data-chat-row="correctGuess"
        >
          <span className="shrink-0 mt-px" aria-hidden="true">
            ✓
          </span>
          <span className="min-w-0">{lineForCorrectGuess(ev)}</span>
        </li>
      );
    });
  }

  if (useDr && C) {
    return (
      <section
        aria-labelledby="match-chat-heading"
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          maxHeight: "min(64vh, 520px)",
        }}
      >
        <h2 id="match-chat-heading" className="sr-only">
          Room chat
        </h2>
        {closeHintBanner ? (
          <div
            data-testid="close-guess-hint"
            style={{
              flexShrink: 0,
              padding: "8px 10px",
              fontSize: 13,
              background: "rgba(91,141,239,0.15)",
              borderBottom: `1px solid rgba(91,141,239,0.35)`,
              color: C.ink,
            }}
            role="status"
            aria-live="polite"
          >
            {closeHintBanner}
          </div>
        ) : null}
        {pulseBanner ? (
          <div
            data-testid="correct-guess-pulse-banner"
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "8px 10px",
              fontSize: 13,
              background: "rgba(42,143,74,0.12)",
              borderBottom: `1px solid rgba(42,143,74,0.35)`,
              color: C.ink,
            }}
            role="status"
            aria-live="polite"
          >
            <span aria-hidden>✓</span>
            <span className="min-w-0">{pulseBanner}</span>
          </div>
        ) : null}
        <ol
          ref={listRef}
          style={{
            flex: 1,
            overflowY: "auto",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            background: C.panel2,
            border: `2px solid ${C.line}`,
            borderRadius: 12,
            padding: 10,
            margin: 0,
            listStyle: "none",
            fontSize: 13,
            lineHeight: 1.45,
          }}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {messagesInner()}
        </ol>
        {showComposer ? (
          <form
            style={{ display: "flex", gap: 8, marginTop: 10, flexShrink: 0 }}
            onSubmit={onSubmit}
          >
            <label className="sr-only" htmlFor="match-chat-composer">
              Type a guess in chat
            </label>
            <input
              id="match-chat-composer"
              data-testid="chat-composer-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={disabled}
              autoComplete="off"
              placeholder={composerPlaceholder}
              aria-invalid={trimmedDraft !== "" && !chatLengthOk}
              aria-describedby={
                trimmedDraft !== "" && !chatLengthOk ? "match-chat-composer-limit" : undefined
              }
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
                minWidth: 0,
              }}
            />
            <button
              type="submit"
              disabled={disabled || trimmedDraft === "" || !chatLengthOk}
              style={{
                border: `2.5px solid ${C.line}`,
                borderRadius: 12,
                background: C.ink,
                color: C.panel,
                padding: "0 14px",
                fontWeight: 800,
                cursor:
                  disabled || trimmedDraft === "" || !chatLengthOk ? "not-allowed" : "pointer",
                fontFamily: DR.font.body,
                opacity: disabled || trimmedDraft === "" || !chatLengthOk ? 0.5 : 1,
              }}
            >
              {composerSubmitLabel}
            </button>
          </form>
        ) : null}
        {trimmedDraft !== "" && !chatLengthOk ? (
          <p id="match-chat-composer-limit" style={{ fontSize: 12, color: DR.semantic.danger }} role="alert">
            Message is too long (max {CHAT_MESSAGE_MAX_GRAPHEMES} graphemes).
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="match-chat-heading"
      className="flex flex-col min-h-[200px] max-h-[min(50vh,360px)] lg:max-h-[min(64vh,520px)] border border-base-300 rounded-box bg-base-200/40"
    >
      <h2 id="match-chat-heading" className="sr-only">
        Room chat
      </h2>
      {closeHintBanner ? (
        <div
          data-testid="close-guess-hint"
          className="shrink-0 px-3 py-2 text-sm bg-info/15 text-info border-b border-info/30 motion-safe:animate-pulse motion-reduce:animate-none"
          role="status"
          aria-live="polite"
        >
          {closeHintBanner}
        </div>
      ) : null}
      {pulseBanner ? (
        <div
          data-testid="correct-guess-pulse-banner"
          className="shrink-0 flex items-start gap-2 px-3 py-2 text-sm bg-success/15 text-success border-b border-success/30 motion-safe:animate-pulse motion-reduce:animate-none"
          role="status"
          aria-live="polite"
        >
          <span className="shrink-0 text-base leading-tight mt-px" aria-hidden="true">
            ✓
          </span>
          <span className="min-w-0">{pulseBanner}</span>
        </div>
      ) : null}
      <ol
        ref={listRef}
        className="flex-1 overflow-y-auto p-2 space-y-2 list-none min-h-0"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messagesInner()}
      </ol>
      <form
        className="shrink-0 flex flex-col gap-1 p-2 border-t border-base-300 bg-base-100 rounded-b-box"
        onSubmit={onSubmit}
      >
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="match-chat-composer">
            Type a guess in chat
          </label>
          <input
            id="match-chat-composer"
            data-testid="chat-composer-input"
            className="input input-bordered input-sm flex-1 min-w-0"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={disabled}
            autoComplete="off"
            aria-invalid={trimmedDraft !== "" && !chatLengthOk}
            aria-describedby={
              trimmedDraft !== "" && !chatLengthOk ? "match-chat-composer-limit" : undefined
            }
          />
          <button
            type="submit"
            className="btn btn-sm btn-primary shrink-0"
            disabled={disabled || trimmedDraft === "" || !chatLengthOk}
          >
            Send
          </button>
        </div>
        {trimmedDraft !== "" && !chatLengthOk ? (
          <p id="match-chat-composer-limit" className="text-xs text-error px-1" role="alert">
            Message is too long (max {CHAT_MESSAGE_MAX_GRAPHEMES} graphemes).
          </p>
        ) : null}
      </form>
    </section>
  );
}
