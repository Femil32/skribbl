"use client";

import type { ServerEvent } from "@skribbl/shared";
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
};

function lineForCorrectGuess(
  ev: Extract<MatchChatFeedEvent, { type: "chatCorrectGuess" }>,
): string {
  if (ev.revealedWord !== undefined && ev.revealedWord !== "") {
    return `${ev.guesserDisplayName} guessed: ${ev.revealedWord}`;
  }
  return ev.censoredAnnouncement;
}

export function MatchChatPanel({ localPlayerId, feed, onSend, disabled }: MatchChatPanelProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const [draft, setDraft] = useState("");
  const [pulseBanner, setPulseBanner] = useState<string | null>(null);

  useEffect(() => {
    const last = feed[feed.length - 1];
    if (!last || last.type !== "chatCorrectGuess") return;
    const text = lineForCorrectGuess(last);
    setPulseBanner(text);
    const id = window.setTimeout(() => setPulseBanner(null), 3600);
    return () => window.clearTimeout(id);
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
    onSend(t);
    setDraft("");
  }

  return (
    <section
      aria-labelledby="match-chat-heading"
      className="flex flex-col min-h-[200px] max-h-[min(50vh,360px)] lg:max-h-[min(64vh,520px)] border border-base-300 rounded-box bg-base-200/40"
    >
      <h2 id="match-chat-heading" className="sr-only">
        Room chat
      </h2>
      {pulseBanner ? (
        <div
          className="shrink-0 px-3 py-2 text-sm bg-success/15 text-success border-b border-success/30 motion-safe:animate-pulse motion-reduce:animate-none"
          role="status"
          aria-live="polite"
        >
          {pulseBanner}
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
              className="text-sm text-success font-medium text-start break-words"
            >
              {lineForCorrectGuess(ev)}
            </li>
          );
        })}
      </ol>
      <form
        className="shrink-0 flex gap-2 p-2 border-t border-base-300 bg-base-100 rounded-b-box"
        onSubmit={onSubmit}
      >
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
          maxLength={600}
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn btn-sm btn-primary shrink-0"
          disabled={disabled || draft.trim() === ""}
        >
          Send
        </button>
      </form>
    </section>
  );
}
