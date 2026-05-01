import type { HydrateChatTailEvent } from "@skribbl/shared";

export type StoredPlayerChatFanout = {
  kind: "player";
  id: string;
  ts: number;
  roomId: string;
  senderPlayerId: string;
  senderDisplayName: string;
  textByRecipient: Record<string, string>;
};

export type StoredCorrectGuessFanout = {
  kind: "correctGuess";
  id: string;
  ts: number;
  roomId: string;
  guesserPlayerId: string;
  guesserDisplayName: string;
  censoredAnnouncement: string;
  revealedWordByRecipient: Record<string, string | undefined>;
};

export type ChatTranscriptFanoutRow = StoredPlayerChatFanout | StoredCorrectGuessFanout;

/** Project persisted fan-outs into spoiler-safe hydrate rows for a single reconnecting player. */
export function transcriptRowsForHydrateRecipient(
  rows: ChatTranscriptFanoutRow[],
  recipientPlayerId: string,
  maxRows: number,
): HydrateChatTailEvent[] {
  const capped = rows.length <= maxRows ? rows : rows.slice(-maxRows);
  const mapped: HydrateChatTailEvent[] = [];
  for (const row of capped) {
    if (row.kind === "player") {
      mapped.push({
        type: "chatPlayerMessage",
        roomId: row.roomId,
        id: row.id,
        ts: row.ts,
        senderPlayerId: row.senderPlayerId,
        senderDisplayName: row.senderDisplayName,
        text: row.textByRecipient[recipientPlayerId] ?? "",
      });
    } else {
      const revealedWord = row.revealedWordByRecipient[recipientPlayerId];
      mapped.push({
        type: "chatCorrectGuess",
        roomId: row.roomId,
        id: row.id,
        ts: row.ts,
        guesserPlayerId: row.guesserPlayerId,
        guesserDisplayName: row.guesserDisplayName,
        ...(revealedWord !== undefined ? { revealedWord } : {}),
        censoredAnnouncement: row.censoredAnnouncement,
      });
    }
  }
  return mapped;
}
