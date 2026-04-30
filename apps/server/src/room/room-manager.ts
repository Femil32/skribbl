import { randomBytes, randomUUID } from "node:crypto";
import pino from "pino";
import {
  assertChatMessageLength,
  buildMaskedWord,
  computeGuesserPoints,
  computeTotalLetters,
  eligibleLetterIndices,
  hintRevealOrderSeed,
  normalizeGuessText,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCodeForJoin,
  normalizeRoomCode,
  sanitizeChatMessage,
  serializeServerEvent,
  shuffleIndicesDeterministic,
  type ClientCommand,
  type LobbyRosterPlayer,
  type DrawingCanvasOpPayload,
  type ServerEvent,
} from "@skribbl/shared";
import type { WebSocket } from "ws";
import {
  resolveDrawerAssistPerCorrect,
  resolveGuesserScoreBracket,
  HINT_SCHEDULE_BEFORE_ROUND_END_MS,
  resolveHintCadenceMs,
  resolveInterRoundGapMs,
  resolveMaxPlayers,
  resolveMatchStartHandshakeMs,
  resolveRoundMs,
  resolveRoundsPerMatch,
  resolveWordChoiceMs,
} from "../config/game.js";
import type { WordBank } from "../words/word-bank.js";
import type { LobbySessionIdentity } from "./lobby-session.js";
import { Room } from "./room.js";

const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  name: "room-manager",
});

export {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidRoomCodeForJoin,
  normalizeRoomCode,
};

export type JoinRoomFailureReason =
  | "UNKNOWN_ROOM"
  | "ROOM_FULL"
  | "JOIN_NOT_ALLOWED";

export type ReconnectHostFailureReason =
  | "UNKNOWN_ROOM"
  | "JOIN_NOT_ALLOWED"
  | "NOT_HOST"
  | "ROOM_FULL"
  | "ALREADY_CONNECTED";

export type NewLobbyPlayer = Pick<
  LobbySessionIdentity,
  "displayName" | "avatarPresetId"
>;

export class RoomManager {
  private readonly roomsByCode = new Map<string, Room>();
  private readonly roomsById = new Map<string, Room>();
  private readonly socketToRoomId = new Map<WebSocket, string>();
  private readonly socketLobbyIdentity = new Map<WebSocket, LobbySessionIdentity>();
  /** Cleared when a room is destroyed or match chain reschedules. */
  private readonly matchTimersByRoomId = new Map<string, ReturnType<typeof setTimeout>[]>();

  readonly maxPlayersPerRoom: number;
  private readonly wordBank: WordBank;

  constructor(maxPlayersPerRoom: number | undefined, wordBank: WordBank) {
    this.maxPlayersPerRoom = maxPlayersPerRoom ?? resolveMaxPlayers();
    this.wordBank = wordBank;
  }

  /** Sorted by `playerId` (deterministic roster order — Story 1.6). */
  buildLobbyRosterPlayers(room: Room): LobbyRosterPlayer[] {
    const rows: LobbyRosterPlayer[] = [];
    for (const ws of room.sockets) {
      const identity = this.socketLobbyIdentity.get(ws);
      if (!identity) continue;
      rows.push({
        playerId: identity.playerId,
        displayName: identity.displayName,
        avatarPresetId: identity.avatarPresetId,
        isHost: room.hostSocket === ws,
        score: room.scoresByPlayerId[identity.playerId] ?? 0,
      });
    }
    rows.sort((a, b) => a.playerId.localeCompare(b.playerId));
    return rows;
  }

  private sendEvent(ws: WebSocket, event: ServerEvent): void {
    try {
      ws.send(serializeServerEvent(event));
    } catch {
      this.leaveSocketRoom(ws);
    }
  }

  private clearMatchTimers(roomId: string): void {
    const room = this.roomsById.get(roomId);
    if (room?.wordChoiceTimerHandle) {
      clearTimeout(room.wordChoiceTimerHandle);
      room.wordChoiceTimerHandle = null;
    }
    const pending = this.matchTimersByRoomId.get(roomId);
    if (!pending) return;
    for (const t of pending) clearTimeout(t);
    this.matchTimersByRoomId.delete(roomId);
  }

  private broadcastMatchPhase(
    room: Room,
    phaseDeadlineMs: number | undefined,
    drawerPlayerId: string | undefined,
    matchRoundIndex: number | undefined,
  ): void {
    const payload: ServerEvent = {
      type: "matchPhase",
      roomId: room.id,
      phase: room.phase,
      ...(phaseDeadlineMs !== undefined ? { phaseDeadlineMs } : {}),
      ...(drawerPlayerId !== undefined ? { drawerPlayerId } : {}),
      ...(matchRoundIndex !== undefined ? { matchRoundIndex } : {}),
    };
    for (const sock of room.sockets) this.sendEvent(sock, payload);
  }

  private emitWordChoiceOffer(
    room: Room,
    drawerPlayerId: string,
    words: [string, string, string],
    matchRoundIndex: number,
    phaseDeadlineMs: number,
  ): void {
    for (const sock of room.sockets) {
      const id = this.socketLobbyIdentity.get(sock);
      if (id?.playerId !== drawerPlayerId) continue;
      this.sendEvent(sock, {
        type: "wordChoiceOffer",
        roomId: room.id,
        words,
        matchRoundIndex,
        phaseDeadlineMs,
      });
    }
  }

  /** Story 2.4 / Epic 4: timer expiry or all guessers correct — leaves `drawing` and schedules next beat. */
  private transitionDrawingToRoundResult(
    room: Room,
    timeouts: ReturnType<typeof setTimeout>[],
    drawerId: string,
    roundIndex: number,
  ): void {
    if (!this.roomsById.get(room.id) || room.phase !== "drawing") return;

    for (const t of timeouts) clearTimeout(t);
    timeouts.length = 0;

    room.phase = "roundResult";
    room.drawingPhaseStartedAtMs = null;
    room.drawingPhaseAwardedGuesserIds = null;
    this.broadcastMatchPhase(room, undefined, drawerId, roundIndex);
    if (roundIndex + 1 < resolveRoundsPerMatch()) {
      const next = setTimeout(
        () => this.queueRoundStart(room, roundIndex + 1, 0, "roundResult", timeouts),
        resolveInterRoundGapMs(),
      );
      timeouts.push(next);
    } else {
      const endMatch = setTimeout(() => {
        if (!this.roomsById.get(room.id) || room.phase !== "roundResult") return;
        this.enterMatchEnded(room, roundIndex);
      }, resolveInterRoundGapMs());
      timeouts.push(endMatch);
    }
  }

  private lockWordAndBeginDrawing(
    room: Room,
    timeouts: ReturnType<typeof setTimeout>[],
    drawerId: string,
    roundIndex: number,
    word: string,
  ): void {
    room.roundSecretWord = word;
    room.phase = "drawing";
    room.drawingStrokeSeq = 0;
    room.drawingPhaseStartedAtMs = Date.now();
    room.drawingPhaseAwardedGuesserIds = new Set();
    const roundMs = resolveRoundMs();
    const cadenceMs = resolveHintCadenceMs();
    const drawingEndsAt = Date.now() + roundMs;
    this.broadcastMatchPhase(room, drawingEndsAt, drawerId, roundIndex);

    const seed = hintRevealOrderSeed({
      roomId: room.id,
      matchRoundIndex: roundIndex,
      secretWord: word,
    });
    const indices = shuffleIndicesDeterministic(eligibleLetterIndices(word), seed);
    const eligibleCount = indices.length;
    const maxSlots = Math.max(
      0,
      Math.floor((roundMs - HINT_SCHEDULE_BEFORE_ROUND_END_MS) / cadenceMs),
    );
    const tickCount = Math.min(eligibleCount, maxSlots);
    const totalLetters = computeTotalLetters(word);
    /** Epic 4: early correct guess should **`clearMatchTimers`** / reuse drawing-end teardown so hints never leak past **`drawing`. */
    const revealedPositions = new Set<number>();
    const secretSnapshot = word;
    const roomSnapshotId = room.id;

    for (let hintIdx = 0; hintIdx < tickCount; hintIdx++) {
      const revealPos = indices[hintIdx]!;
      const delayMs = cadenceMs * (hintIdx + 1);
      const hintTimer = setTimeout(() => {
        if (!this.roomsById.get(roomSnapshotId) || room.phase !== "drawing") return;
        if (room.matchRoundIndex !== roundIndex) return;

        revealedPositions.add(revealPos);
        const revealedLetterCount = revealedPositions.size;
        const maskedWord = buildMaskedWord(secretSnapshot, revealedPositions);
        const tick: ServerEvent = {
          type: "drawingHintTick",
          roomId: room.id,
          matchRoundIndex: roundIndex,
          hintIndex: hintIdx,
          maskedWord,
          totalLetters,
          revealedLetterCount,
        };
        for (const sock of room.sockets) {
          this.sendEvent(sock, tick);
        }
      }, delayMs);
      timeouts.push(hintTimer);
    }

    /** Story 2.4–2.5: clear every queued **`setTimeout`** (hint ticks + drawing end) before inter-round timers. Epic 4: mirror on early correct guess (`clearMatchTimers`). */
    const drawingEnd = setTimeout(() => {
      this.transitionDrawingToRoundResult(room, timeouts, drawerId, roundIndex);
    }, roundMs);
    timeouts.push(drawingEnd);
  }

  private onWordChoiceDeadline(
    room: Room,
    timeouts: ReturnType<typeof setTimeout>[],
    drawerId: string,
    roundIndex: number,
  ): void {
    room.wordChoiceTimerHandle = null;
    if (!this.roomsById.get(room.id)) return;
    if (room.phase !== "choosingWord") return;
    const opts = room.roundWordOptions;
    if (!opts) return;
    if (room.roundSecretWord !== null) return;
    this.lockWordAndBeginDrawing(room, timeouts, drawerId, roundIndex, opts[0]!);
  }

  private enterMatchEnded(room: Room, lastRoundIndex: number): void {
    room.phase = "matchEnded";
    room.roundWordOptions = null;
    room.roundSecretWord = null;
    if (room.wordChoiceTimerHandle) {
      clearTimeout(room.wordChoiceTimerHandle);
      room.wordChoiceTimerHandle = null;
    }
    this.broadcastMatchPhase(room, undefined, undefined, lastRoundIndex);
    this.broadcastLobbyRoster(room);
  }

  /**
   * Host-only: rematch in the same room (Story 2.7). Clears match timers and per-match state;
   * scores reset to zero for current roster.
   */
  returnToLobby(actor: WebSocket): { ok: true } | { ok: false; code: string } {
    const room = this.getRoomForSocket(actor);
    if (!room) return { ok: false, code: "INTERNAL" };
    if (room.hostSocket !== actor) return { ok: false, code: "NOT_HOST" };
    if (room.phase !== "matchEnded") return { ok: false, code: "WRONG_PHASE" };

    this.clearMatchTimers(room.id);
    room.phase = "lobby";
    room.matchPlayerOrder = null;
    room.currentDrawerPlayerId = null;
    room.matchRoundIndex = 0;
    room.roundWordOptions = null;
    room.roundSecretWord = null;
    room.drawingPhaseStartedAtMs = null;
    room.drawingPhaseAwardedGuesserIds = null;

    const roster = this.buildLobbyRosterPlayers(room);
    room.scoresByPlayerId = {};
    for (const p of roster) {
      room.scoresByPlayerId[p.playerId] = 0;
    }

    this.broadcastMatchPhase(room, undefined, undefined, undefined);
    this.broadcastLobbyRoster(room);
    return { ok: true };
  }

  /** Chain entry: first round after `matchStarting`, or later rounds after `roundResult` gap. */
  private queueRoundStart(
    room: Room,
    roundIndex: number,
    leadMs: number,
    gatePhase: "matchStarting" | "roundResult",
    timeouts: ReturnType<typeof setTimeout>[],
  ): void {
    const order = room.matchPlayerOrder;
    if (!order || order.length === 0) return;

    const t = setTimeout(() => {
      if (!this.roomsById.get(room.id)) return;
      if (room.phase !== gatePhase) return;

      const drawerId = order[roundIndex % order.length]!;
      room.currentDrawerPlayerId = drawerId;
      room.matchRoundIndex = roundIndex;
      room.roundWordOptions = this.wordBank.sampleThree();
      room.roundSecretWord = null;
      room.phase = "choosingWord";
      const wordChoiceMs = resolveWordChoiceMs();
      const choiceDeadline = Date.now() + wordChoiceMs;
      this.broadcastMatchPhase(room, choiceDeadline, drawerId, roundIndex);
      this.emitWordChoiceOffer(room, drawerId, room.roundWordOptions, roundIndex, choiceDeadline);

      const wordChoiceTimer = setTimeout(
        () => this.onWordChoiceDeadline(room, timeouts, drawerId, roundIndex),
        wordChoiceMs,
      );
      room.wordChoiceTimerHandle = wordChoiceTimer;
      timeouts.push(wordChoiceTimer);
    }, leadMs);
    timeouts.push(t);
  }

  /**
   * Epic 2.1–2.3: server timers, round-robin drawer, word bank + drawer choice.
   */
  private scheduleMatchFlow(room: Room): void {
    this.clearMatchTimers(room.id);
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    this.matchTimersByRoomId.set(room.id, timeouts);

    const roster = this.buildLobbyRosterPlayers(room);
    room.scoresByPlayerId = {};
    for (const p of roster) {
      room.scoresByPlayerId[p.playerId] = 0;
    }
    room.matchPlayerOrder = roster.map((p) => p.playerId);
    room.matchRoundIndex = 0;

    this.queueRoundStart(room, 0, resolveMatchStartHandshakeMs(), "matchStarting", timeouts);
  }

  /**
   * Single entry point for correct-guess awards (FR10; Epic 4 chat will delegate here).
   * Validates phase, roster, excludes the drawer as guesser, and awards each guesser at most once per
   * drawing phase (duplicate invokes return `"ALREADY_AWARDED_THIS_DRAWING"`).
   *
   * **Time basis:** Prefer `occurredAtMs = Date.now()` at the instant the server adjudicates an exact word
   * match (same clock basis as when drawing started — see `drawingPhaseStartedAtMs` on the room). Tests may
   * pass offsets from the drawing start when using fake timers; trusting client timestamps would allow
   * gaming scores.
   */
  applyCorrectGuessAward(opts: {
    roomId: string;
    guesserPlayerId: string;
    occurredAtMs: number;
  }): { ok: true } | { ok: false; code: string } {
    const room = this.roomsById.get(opts.roomId);
    if (!room) return { ok: false, code: "UNKNOWN_ROOM" };
    if (room.phase !== "drawing") {
      return { ok: false, code: "WRONG_PHASE" };
    }
    const drawerId = room.currentDrawerPlayerId;
    if (!drawerId) {
      return { ok: false, code: "NO_DRAWER" };
    }
    if (opts.guesserPlayerId === drawerId) {
      return { ok: false, code: "GUESSER_IS_DRAWER" };
    }
    const order = room.matchPlayerOrder;
    if (!order?.includes(opts.guesserPlayerId)) {
      return { ok: false, code: "NOT_IN_MATCH" };
    }
    const start = room.drawingPhaseStartedAtMs;
    if (start === null || !Number.isFinite(start)) {
      return { ok: false, code: "NO_DRAWING_START" };
    }
    const awarded = room.drawingPhaseAwardedGuesserIds;
    if (!awarded) {
      return { ok: false, code: "NO_DRAWING_START" };
    }
    if (awarded.has(opts.guesserPlayerId)) {
      return { ok: false, code: "ALREADY_AWARDED_THIS_DRAWING" };
    }

    const roundMs = resolveRoundMs();
    const elapsed = opts.occurredAtMs - start;
    const { max: maxPts, min: minPts } = resolveGuesserScoreBracket();
    const guesserPts = computeGuesserPoints(elapsed, roundMs, maxPts, minPts);
    const assist = resolveDrawerAssistPerCorrect();

    const scores = room.scoresByPlayerId;
    scores[opts.guesserPlayerId] = (scores[opts.guesserPlayerId] ?? 0) + guesserPts;
    scores[drawerId] = (scores[drawerId] ?? 0) + assist;
    awarded.add(opts.guesserPlayerId);

    log.info(
      {
        event: "correct_guess_award",
        roomId: opts.roomId,
        guesserPlayerId: opts.guesserPlayerId,
        drawerPlayerId: drawerId,
        guesserPts,
        drawerAssistPts: assist,
        elapsedMs: elapsed,
      },
      "Awarded points for correct guess",
    );

    this.broadcastLobbyRoster(room);
    return { ok: true };
  }

  private allNonDrawerGuessersAwarded(room: Room): boolean {
    const drawer = room.currentDrawerPlayerId;
    const order = room.matchPlayerOrder;
    const awarded = room.drawingPhaseAwardedGuesserIds;
    if (!drawer || !order?.length || !awarded) return false;
    for (const pid of order) {
      if (pid === drawer) continue;
      if (!awarded.has(pid)) return false;
    }
    return true;
  }

  /**
   * Epic 4 — chat ingress: sanitize, optional exact-guess adjudication (FR20–FR22), spoiler-safe fan-out (FR21).
   */
  applyChatMessage(
    ws: WebSocket,
    roomId: string,
    rawText: string,
  ): { ok: true } | { ok: false; code: string } {
    const room = this.getRoomForSocket(ws);
    const session = this.getLobbySession(ws);
    if (!room || !session) return { ok: false, code: "INTERNAL" };
    if (roomId !== room.id) return { ok: false, code: "BAD_ROOM" };

    const sanitized = sanitizeChatMessage(rawText);
    if (sanitized === "") return { ok: false, code: "CHAT_EMPTY" };
    const len = assertChatMessageLength(sanitized);
    if (!len.ok) return { ok: false, code: len.code };

    const senderId = session.playerId;
    const senderName = session.displayName;
    const secret = room.roundSecretWord;
    const drawerId = room.currentDrawerPlayerId;
    const inDrawing = room.phase === "drawing";
    const normalizedSecret =
      secret && inDrawing ? normalizeGuessText(secret) : null;
    const normalizedMsg = normalizeGuessText(sanitized);
    const isExact = Boolean(
      normalizedSecret &&
        normalizedSecret.length > 0 &&
        normalizedMsg === normalizedSecret,
    );

    if (inDrawing && isExact && secret) {
      if (senderId === drawerId) {
        this.broadcastPlayerChatWithPerRecipientText(
          room,
          senderId,
          senderName,
          sanitized,
          (recipientId) => {
            const awarded = room.drawingPhaseAwardedGuesserIds;
            const mayKnow =
              recipientId === senderId || (awarded?.has(recipientId) ?? false);
            return mayKnow ? sanitized : "—";
          },
        );
        return { ok: true };
      }

      const t = Date.now();
      const award = this.applyCorrectGuessAward({
        roomId: room.id,
        guesserPlayerId: senderId,
        occurredAtMs: t,
      });

      if (award.ok) {
        const censored = `${senderName} guessed the word!`;
        this.broadcastCorrectGuess(room, senderId, senderName, secret, censored);
        if (this.allNonDrawerGuessersAwarded(room)) {
          const timeouts = this.matchTimersByRoomId.get(room.id);
          const d = room.currentDrawerPlayerId;
          if (timeouts && d) {
            this.transitionDrawingToRoundResult(room, timeouts, d, room.matchRoundIndex);
          }
        }
        return { ok: true };
      }

      if (award.code === "ALREADY_AWARDED_THIS_DRAWING") {
        this.broadcastPlayerChatWithPerRecipientText(
          room,
          senderId,
          senderName,
          sanitized,
          (recipientId) => {
            const awarded = room.drawingPhaseAwardedGuesserIds;
            const mayKnow =
              recipientId === senderId ||
              recipientId === drawerId ||
              (awarded?.has(recipientId) ?? false);
            return mayKnow ? sanitized : "•••";
          },
        );
        return { ok: true };
      }

      return award;
    }

    this.broadcastPlayerChatWithPerRecipientText(room, senderId, senderName, sanitized, () => sanitized);
    return { ok: true };
  }

  private broadcastPlayerChatWithPerRecipientText(
    room: Room,
    senderPlayerId: string,
    senderDisplayName: string,
    _canonicalText: string,
    textForRecipient: (recipientId: string) => string,
  ): void {
    const ts = Date.now();
    const id = randomUUID();
    for (const sock of room.sockets) {
      const recipientId = this.socketLobbyIdentity.get(sock)?.playerId;
      if (!recipientId) continue;
      this.sendEvent(sock, {
        type: "chatPlayerMessage",
        roomId: room.id,
        id,
        ts,
        senderPlayerId,
        senderDisplayName,
        text: textForRecipient(recipientId),
      });
    }
  }

  private broadcastCorrectGuess(
    room: Room,
    guesserPlayerId: string,
    guesserDisplayName: string,
    secretWord: string,
    censoredAnnouncement: string,
  ): void {
    const id = randomUUID();
    const ts = Date.now();
    const awarded = room.drawingPhaseAwardedGuesserIds;
    const drawerId = room.currentDrawerPlayerId;
    if (!awarded || !drawerId) return;

    for (const sock of room.sockets) {
      const recipientId = this.socketLobbyIdentity.get(sock)?.playerId;
      if (!recipientId) continue;
      const mayReveal =
        recipientId === guesserPlayerId ||
        recipientId === drawerId ||
        awarded.has(recipientId);
      this.sendEvent(sock, {
        type: "chatCorrectGuess",
        roomId: room.id,
        id,
        ts,
        guesserPlayerId,
        guesserDisplayName,
        ...(mayReveal ? { revealedWord: secretWord } : {}),
        censoredAnnouncement,
      });
    }
  }

  /** Drawer-only: lock word and skip remaining word-choice wait (Story 2.3). */
  chooseWord(
    ws: WebSocket,
    choiceIndex: number,
  ): { ok: true } | { ok: false; code: string } {
    const room = this.getRoomForSocket(ws);
    const session = this.getLobbySession(ws);
    if (!room || !session) return { ok: false, code: "INTERNAL" };
    if (room.phase !== "choosingWord") return { ok: false, code: "WRONG_PHASE" };
    if (session.playerId !== room.currentDrawerPlayerId) return { ok: false, code: "NOT_DRAWER" };
    const opts = room.roundWordOptions;
    if (!opts) return { ok: false, code: "NO_WORD_OFFER" };
    const word = opts[choiceIndex];
    if (word === undefined) return { ok: false, code: "BAD_CHOICE" };
    if (room.roundSecretWord !== null) return { ok: false, code: "ALREADY_CHOSE" };

    if (room.wordChoiceTimerHandle) {
      clearTimeout(room.wordChoiceTimerHandle);
      room.wordChoiceTimerHandle = null;
    }
    const timeouts = this.matchTimersByRoomId.get(room.id);
    if (!timeouts) return { ok: false, code: "INTERNAL" };
    const drawerId = room.currentDrawerPlayerId;
    if (!drawerId) return { ok: false, code: "INTERNAL" };
    this.lockWordAndBeginDrawing(room, timeouts, drawerId, room.matchRoundIndex, word);
    return { ok: true };
  }

  broadcastLobbyRoster(room: Room): void {
    const payload: ServerEvent = {
      type: "lobbyRoster",
      roomId: room.id,
      players: this.buildLobbyRosterPlayers(room),
    };
    for (const sock of room.sockets) this.sendEvent(sock, payload);
  }

  /** Host-only authoritative start (Story 1.6). Transitions phase to `matchStarting`. */
  startMatch(actor: WebSocket): { ok: true } | { ok: false; code: string } {
    const room = this.getRoomForSocket(actor);
    if (!room) return { ok: false, code: "INTERNAL" };
    if (room.hostSocket !== actor) return { ok: false, code: "NOT_HOST" };
    if (room.phase !== "lobby") return { ok: false, code: "WRONG_PHASE" };
    if (room.playerCount < 2) return { ok: false, code: "NOT_ENOUGH_PLAYERS" };

    room.phase = "matchStarting";
    const payload: ServerEvent = {
      type: "matchStarting",
      roomId: room.id,
      phase: "matchStarting",
    };
    for (const sock of room.sockets) this.sendEvent(sock, payload);
    this.scheduleMatchFlow(room);
    return { ok: true };
  }

  /** Unique non-guessable code using crypto-grade randomness + collision retry. */
  private generateUniqueCode(): string {
    const alphabet = ROOM_CODE_ALPHABET;
    const len = ROOM_CODE_LENGTH;
    const maxAttempts = 256;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const bytes = randomBytes(len);
      let code = "";
      for (let i = 0; i < len; i++) {
        code += alphabet[bytes[i]! % alphabet.length]!;
      }
      if (!this.roomsByCode.has(code)) return code;
    }
    throw new Error("ROOM_CODE_COLLISION_RETRY_EXHAUSTED");
  }

  leaveSocketRoom(ws: WebSocket): void {
    const roomId = this.socketToRoomId.get(ws);
    if (!roomId) {
      this.socketLobbyIdentity.delete(ws);
      return;
    }
    const room = this.roomsById.get(roomId);
    if (room) {
      room.sockets.delete(ws);
      if (room.hostSocket === ws) {
        const next = room.sockets.values().next().value as WebSocket | undefined;
        room.hostSocket = next ?? null;
      }
      const survivors = room.sockets.size;
      if (survivors === 0) {
        this.clearMatchTimers(room.id);
        this.roomsByCode.delete(room.code);
        this.roomsById.delete(room.id);
      } else {
        this.broadcastLobbyRoster(room);
      }
    }
    this.socketToRoomId.delete(ws);
    this.socketLobbyIdentity.delete(ws);
  }

  getLobbySession(ws: WebSocket): LobbySessionIdentity | undefined {
    return this.socketLobbyIdentity.get(ws);
  }

  createRoom(ws: WebSocket, player: NewLobbyPlayer): Room {
    this.leaveSocketRoom(ws);
    const playerId = randomUUID();
    this.socketLobbyIdentity.set(ws, {
      playerId,
      displayName: player.displayName,
      avatarPresetId: player.avatarPresetId,
    });
    const code = this.generateUniqueCode();
    const room = new Room({
      id: randomUUID(),
      code,
      maxPlayers: this.maxPlayersPerRoom,
      hostPlayerId: playerId,
    });
    room.sockets.add(ws);
    room.hostSocket = ws;
    this.roomsByCode.set(code, room);
    this.roomsById.set(room.id, room);
    this.socketToRoomId.set(ws, room.id);
    return room;
  }

  reconnectHost(
    ws: WebSocket,
    roomId: string,
    expectedPlayerId: string,
    player: NewLobbyPlayer,
  ): { ok: true; room: Room } | { ok: false; reason: ReconnectHostFailureReason } {
    const room = this.roomsById.get(roomId);
    if (!room) return { ok: false, reason: "UNKNOWN_ROOM" };
    if (room.phase !== "lobby") return { ok: false, reason: "JOIN_NOT_ALLOWED" };
    if (room.hostPlayerId !== expectedPlayerId) return { ok: false, reason: "NOT_HOST" };

    for (const s of room.sockets) {
      const id = this.socketLobbyIdentity.get(s);
      if (id?.playerId === expectedPlayerId) return { ok: false, reason: "ALREADY_CONNECTED" };
    }

    if (!room.hasCapacity()) return { ok: false, reason: "ROOM_FULL" };

    this.leaveSocketRoom(ws);

    this.socketLobbyIdentity.set(ws, {
      playerId: expectedPlayerId,
      displayName: player.displayName,
      avatarPresetId: player.avatarPresetId,
    });
    room.sockets.add(ws);
    room.hostSocket = ws;
    this.socketToRoomId.set(ws, room.id);
    return { ok: true, room };
  }

  /**
   * Shared gate for drawer-only canvas commands during `drawing` (Story 3.4 + 3.6).
   * `room.drawingStrokeSeq` is the unified monotonic sequence for stroke chunks and canvas ops.
   */
  private validateDrawerCanvasCommand(
    ws: WebSocket,
    roomId: string,
  ):
    | { ok: true; room: Room; playerId: string }
    | { ok: false; code: string } {
    const room = this.getRoomForSocket(ws);
    const session = this.getLobbySession(ws);
    if (!room || !session) return { ok: false, code: "INTERNAL" };
    if (roomId !== room.id) return { ok: false, code: "BAD_ROOM" };
    if (room.phase !== "drawing") return { ok: false, code: "WRONG_PHASE" };
    if (!room.currentDrawerPlayerId || session.playerId !== room.currentDrawerPlayerId) {
      return { ok: false, code: "NOT_DRAWER" };
    }
    return { ok: true, room, playerId: session.playerId };
  }

  applyDrawingStrokeChunk(
    ws: WebSocket,
    cmd: {
      type: "drawingStrokeChunk";
      roomId: string;
      strokeId: string;
      chunkId: string;
      points: { x: number; y: number }[];
      color: string;
      lineWidthPx: number;
    },
  ): { ok: true; seq: number } | { ok: false; code: string } {
    const gate = this.validateDrawerCanvasCommand(ws, cmd.roomId);
    if (!gate.ok) return gate;

    const { room, playerId } = gate;

    room.drawingStrokeSeq += 1;
    const seq = room.drawingStrokeSeq;
    const payload: ServerEvent = {
      type: "drawingStrokeCommitted",
      roomId: room.id,
      seq,
      senderPlayerId: playerId,
      strokeId: cmd.strokeId,
      chunkId: cmd.chunkId,
      points: cmd.points,
      color: cmd.color,
      lineWidthPx: cmd.lineWidthPx,
    };

    for (const sock of room.sockets) {
      this.sendEvent(sock, payload);
    }

    return { ok: true, seq };
  }

  applyDrawingCanvasCommand(
    ws: WebSocket,
    cmd: Extract<
      ClientCommand,
      | { type: "drawingCanvasClear" }
      | { type: "drawingCanvasFill" }
      | { type: "drawingEraserChunk" }
    >,
  ): { ok: true; seq: number } | { ok: false; code: string } {
    const gate = this.validateDrawerCanvasCommand(ws, cmd.roomId);
    if (!gate.ok) return gate;

    const { room, playerId } = gate;

    let op: DrawingCanvasOpPayload;
    switch (cmd.type) {
      case "drawingCanvasClear":
        op = { op: "clear" };
        break;
      case "drawingCanvasFill":
        op = { op: "fill", x: cmd.x, y: cmd.y, color: cmd.color };
        break;
      case "drawingEraserChunk":
        op = {
          op: "eraserChunk",
          strokeId: cmd.strokeId,
          chunkId: cmd.chunkId,
          points: cmd.points,
          lineWidthPx: cmd.lineWidthPx,
        };
        break;
      default: {
        const _exhaustive: never = cmd;
        return _exhaustive;
      }
    }

    room.drawingStrokeSeq += 1;
    const seq = room.drawingStrokeSeq;
    const payload: ServerEvent = {
      type: "drawingCanvasOpCommitted",
      roomId: room.id,
      seq,
      senderPlayerId: playerId,
      op,
    };

    for (const sock of room.sockets) {
      this.sendEvent(sock, payload);
    }

    return { ok: true, seq };
  }

  joinRoom(
    ws: WebSocket,
    normalizedCode: string,
    player: NewLobbyPlayer,
  ):
    | { ok: true; room: Room }
    | { ok: false; reason: JoinRoomFailureReason } {
    const room = this.roomsByCode.get(normalizedCode);
    if (!room) return { ok: false, reason: "UNKNOWN_ROOM" };

    const current = this.getRoomForSocket(ws);
    if (current?.id === room.id) {
      return { ok: true, room };
    }

    if (room.phase !== "lobby") {
      return { ok: false, reason: "JOIN_NOT_ALLOWED" };
    }

    if (!room.hasCapacity()) return { ok: false, reason: "ROOM_FULL" };

    this.leaveSocketRoom(ws);
    const playerId = randomUUID();
    this.socketLobbyIdentity.set(ws, {
      playerId,
      displayName: player.displayName,
      avatarPresetId: player.avatarPresetId,
    });
    room.sockets.add(ws);
    this.socketToRoomId.set(ws, room.id);
    return { ok: true, room };
  }

  getRoomForSocket(ws: WebSocket): Room | undefined {
    const id = this.socketToRoomId.get(ws);
    return id ? this.roomsById.get(id) : undefined;
  }
}
