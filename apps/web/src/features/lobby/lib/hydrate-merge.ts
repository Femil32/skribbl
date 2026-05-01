import type { CanvasReplayEvent, HydrateChatTailEvent, ServerEvent } from "@skribbl/shared";

export type ChatFeedEvent = Extract<
  ServerEvent,
  | { type: "chatPlayerMessage" }
  | { type: "chatSystemMessage" }
  | { type: "chatCorrectGuess" }
>;

/** Merge authoritative hydrate canvas ops with whatever the client already buffered (Story 5.2). */
export function mergeCanvasReplayBySeq(
  prev: CanvasReplayEvent[],
  incoming: CanvasReplayEvent[],
  maxBuffer: number,
): CanvasReplayEvent[] {
  const bySeq = new Map<number, CanvasReplayEvent>();
  for (const c of prev) bySeq.set(c.seq, c);
  for (const c of incoming) bySeq.set(c.seq, c);
  return [...bySeq.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v)
    .slice(-maxBuffer);
}

function hydrateTailToChatReplay(ev: HydrateChatTailEvent): ChatFeedEvent {
  switch (ev.type) {
    case "chatPlayerMessage":
      return {
        type: "chatPlayerMessage",
        roomId: ev.roomId,
        id: ev.id,
        ts: ev.ts,
        senderPlayerId: ev.senderPlayerId,
        senderDisplayName: ev.senderDisplayName,
        text: ev.text,
      };
    case "chatSystemMessage":
      return {
        type: "chatSystemMessage",
        roomId: ev.roomId,
        id: ev.id,
        ts: ev.ts,
        text: ev.text,
      };
    case "chatCorrectGuess":
      return {
        type: "chatCorrectGuess",
        roomId: ev.roomId,
        id: ev.id,
        ts: ev.ts,
        guesserPlayerId: ev.guesserPlayerId,
        guesserDisplayName: ev.guesserDisplayName,
        ...(ev.revealedWord !== undefined ? { revealedWord: ev.revealedWord } : {}),
        censoredAnnouncement: ev.censoredAnnouncement,
      };
    default: {
      const _x: never = ev;
      return _x;
    }
  }
}

/** Id-keyed merge so hydrate replays do not duplicate rows already received live. */
export function mergeChatFeedWithHydrateTail(
  prev: ChatFeedEvent[],
  tail: HydrateChatTailEvent[],
  maxFeed: number,
): ChatFeedEvent[] {
  const byId = new Map<string, ChatFeedEvent>();
  for (const row of prev) byId.set(row.id, row);
  for (const row of tail) {
    const mapped = hydrateTailToChatReplay(row);
    byId.set(mapped.id, mapped);
  }
  return [...byId.values()].sort((a, b) => a.ts - b.ts).slice(-maxFeed);
}
