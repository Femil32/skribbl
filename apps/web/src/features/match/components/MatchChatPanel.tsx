"use client";

import {
  assertChatMessageLength,
  CHAT_MESSAGE_MAX_GRAPHEMES,
  sanitizeChatMessage,
  type ServerEvent,
} from "@skribbl/shared";
import { FormEvent, useEffect, useRef, useState } from "react";

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
        {feed.map((ev) => {
          if (ev.type === "chatPlayerMessage") {
            const isSelf = ev.senderPlayerId === localPlayerId;
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
        })}
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
