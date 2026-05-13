import { randomBytes, randomUUID } from "node:crypto";
import pino from "pino";
import {
  evaluateCloseGuessTier,
  assertChatMessageLength,
  buildMaskedWord,
  clampGuessElapsedMs,
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
  MAX_HYDRATE_CHAT_TAIL,
  type ClientCommand,
  type LobbyRosterPlayer,
  type CanvasReplayEvent,
  type DrawingCanvasOpPayload,
  type ServerEvent,
  type RoomSettings,
} from "@skribbl/shared";
import type { WebSocket } from "ws";
import {
  resolveDrawerAssistPerCorrect,
  resolveGuesserScoreBracket,
  HINT_SCHEDULE_BEFORE_ROUND_END_MS,
  resolveHintCadenceMs,
  resolveCloseGuessHeuristicOptions,
  resolveCloseGuessHintCooldownMs,
  resolveCloseGuessHintLogEnabled,
  resolveCloseGuessHintMessages,
  resolveCloseGuessMaxHintsPerDrawingPhase,
  resolveInterRoundGapMs,
  resolveMaxPlayers,
  resolveMatchStartHandshakeMs,
  resolveRoundMs,
  resolveRoundsPerMatch,
  resolveWordChoiceMs,
} from "../config/game.js";
import type { WordBank } from "../words/word-bank.js";
import type { RedisClient } from "../lib/redis/client.js";
import {
  roomKey,
  roomByIdKey,
  serializeRoom,
  ROOM_TTL_IDLE_S,
  ROOM_TTL_ACTIVE_S,
  playerKey,
  serializePlayer,
  PLAYER_TTL_S,
} from "../lib/redis/room-keys.js";
import type { LobbySessionIdentity } from "./lobby-session.js";
import { Room } from "./room.js";
import {
  transcriptRowsForHydrateRecipient,
  type ChatTranscriptFanoutRow,
} from "./chat-transcript.js";

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

export type ReconnectPlayerFailureReason =
  | "UNKNOWN_ROOM"
  | "ROOM_FULL"
  | "NO_STASHED_SESSION"
  | "ALREADY_CONNECTED"
  | "HOST_USE_RECONNECT_HOST"
  | "IDENTITY_MISMATCH";

export type NewLobbyPlayer = Pick<
  LobbySessionIdentity,
  "displayName" | "avatarPresetId"
>;

export class RoomManager {
  // Redis-backed store: replaces in-memory roomsByCode / roomsById Maps.
  // roomRuntimeByCode holds live Room objects (sockets, timers, volatile state).
  // roomCodeById is a lightweight process-local reverse index (roomId → code).
  private readonly roomRuntimeByCode = new Map<string, Room>();
  private readonly roomCodeById = new Map<string, string>();

  private readonly socketToRoomId = new Map<WebSocket, string>();
  private readonly socketLobbyIdentity = new Map<WebSocket, LobbySessionIdentity>();
  /** Cleared when a room is destroyed or match chain reschedules. */
  private readonly matchTimersByRoomId = new Map<string, ReturnType<typeof setTimeout>[]>();

  readonly maxPlayersPerRoom: number;
  private readonly wordBank: WordBank;
  // Injectable Redis client — real code passes getRedisClient(); tests inject a stub.
  private readonly redis: RedisClient;

  constructor(maxPlayersPerRoom: number | undefined, wordBank: WordBank, redis: RedisClient) {
    this.maxPlayersPerRoom = maxPlayersPerRoom ?? resolveMaxPlayers();
    this.wordBank = wordBank;
    this.redis = redis;
  }

  private getRoomById(id: string): Room | undefined {
    const code = this.roomCodeById.get(id);
    return code ? this.roomRuntimeByCode.get(code) : undefined;
  }

  // P-1+P-2: fire-and-forget via pipeline (hset+expire atomic per key) with error logging.
  private writeRoomToRedis(room: Room, ttlSeconds: number = ROOM_TTL_ACTIVE_S): void {
    const codeKey = roomKey(room.code);
    const idKey = roomByIdKey(room.id);
    const fields = serializeRoom({
      id: room.id,
      code: room.code,
      hostPlayerId: room.hostPlayerId,
      hostToken: room.hostToken,
      phase: room.phase,
      maxPlayers: room.maxPlayers,
      matchPlayerOrder: room.matchPlayerOrder,
      matchRoundIndex: room.matchRoundIndex,
      currentDrawerPlayerId: room.currentDrawerPlayerId,
      roundWordOptions: room.roundWordOptions,
      roundSecretWord: room.roundSecretWord,
      drawingStrokeSeq: room.drawingStrokeSeq,
      chatTranscriptFanoutRows: room.chatTranscriptFanoutRows,
      drawingPhaseStartedAtMs: room.drawingPhaseStartedAtMs,
      drawingPhaseAwardedGuesserIds: room.drawingPhaseAwardedGuesserIds,
      scoresByPlayerId: room.scoresByPlayerId,
      settings: room.settings,
    });
    void this.redis
      .pipeline()
      .hset(codeKey, fields)
      .expire(codeKey, ttlSeconds)
      .set(idKey, room.code)
      .expire(idKey, ttlSeconds)
      .exec()
      .catch((err: unknown) => {
        log.error({ err, roomCode: room.code }, "Redis write failed for room");
      });
  }

  private deleteRoomFromRedis(room: Room): void {
    void this.redis
      .del(roomKey(room.code), roomByIdKey(room.id))
      .catch((err: unknown) => {
        log.error({ err, roomCode: room.code }, "Redis delete failed for room");
      });
  }

  /** Sorted by `playerId` (deterministic roster order — Story 1.6). */
  buildLobbyRosterPlayers(room: Room): LobbyRosterPlayer[] {
    const byId = new Map<string, LobbyRosterPlayer>();

    for (const [playerId, stash] of room.awaitingReconnect) {
      byId.set(playerId, {
        playerId: stash.playerId,
        displayName: stash.displayName,
        avatarPresetId: stash.avatarPresetId,
        isHost: room.hostPlayerId === playerId,
        score: room.scoresByPlayerId[playerId] ?? 0,
        connectionStatus: "disconnected",
      });
    }

    for (const ws of room.sockets) {
      const identity = this.socketLobbyIdentity.get(ws);
      if (!identity) continue;
      byId.set(identity.playerId, {
        playerId: identity.playerId,
        displayName: identity.displayName,
        avatarPresetId: identity.avatarPresetId,
        isHost: room.hostPlayerId === identity.playerId,
        score: room.scoresByPlayerId[identity.playerId] ?? 0,
        connectionStatus: "connected",
      });
    }

    return [...byId.values()].sort((a, b) => a.playerId.localeCompare(b.playerId));
  }

  private sendEvent(ws: WebSocket, event: ServerEvent): void {
    try {
      ws.send(serializeServerEvent(event));
    } catch {
      this.leaveSocketRoom(ws);
    }
  }

  private countOccupiedSeatIds(room: Room): number {
    const ids = new Set<string>();
    for (const s of room.sockets) {
      const id = this.socketLobbyIdentity.get(s)?.playerId;
      if (id) ids.add(id);
    }
    for (const pid of room.awaitingReconnect.keys()) ids.add(pid);
    return ids.size;
  }

  private roomHasCapacity(room: Room): boolean {
    return this.countOccupiedSeatIds(room) < room.maxPlayers;
  }

  private transcriptAudiencePlayerIds(room: Room): string[] {
    if (room.matchPlayerOrder?.length) return [...room.matchPlayerOrder];
    const ids: string[] = [];
    for (const s of room.sockets) {
      const pid = this.socketLobbyIdentity.get(s)?.playerId;
      if (pid) ids.push(pid);
    }
    return ids;
  }

  private pushChatTranscriptFanout(room: Room, row: ChatTranscriptFanoutRow): void {
    room.chatTranscriptFanoutRows.push(row);
    while (room.chatTranscriptFanoutRows.length > MAX_HYDRATE_CHAT_TAIL) {
      room.chatTranscriptFanoutRows.shift();
    }
  }

  private notifyCanvasIntegrityFailure(
    actor: WebSocket | undefined,
    room: Room,
    code: string,
    message?: string,
  ): void {
    const resync: ServerEvent = {
      type: "canvasOpLogResync",
      roomId: room.id,
      code,
      ...(message !== undefined ? { message } : {}),
    };
    if (actor) {
      try {
        actor.send(
          serializeServerEvent({
            type: "error",
            code,
            ...(message !== undefined ? { message } : {}),
          }),
        );
      } catch {
        this.leaveSocketRoom(actor);
      }
    }
    for (const sock of room.sockets) this.sendEvent(sock, resync);
  }

  /** Targeted canvas + chat tail for one socket after successful reconnect (Story 5.2). */
  sendRoomHydrate(ws: WebSocket, room: Room, recipientPlayerId: string): void {
    let canvasCommits: CanvasReplayEvent[] = [];
    if (room.phase === "drawing") {
      const verified = room.canvasPhaseLog.verifyAgainstWatermark(room.drawingStrokeSeq);
      if (!verified.ok) {
        this.notifyCanvasIntegrityFailure(
          ws,
          room,
          verified.code,
          "Canvas hydrate aborted — op log inconsistent with server seq.",
        );
        return;
      }
      canvasCommits = [...room.canvasPhaseLog.snapshot()];
    }

    const chatTail = transcriptRowsForHydrateRecipient(
      room.chatTranscriptFanoutRows,
      recipientPlayerId,
      MAX_HYDRATE_CHAT_TAIL,
    );

    const hydrate: ServerEvent = {
      type: "roomHydrate",
      roomId: room.id,
      phase: room.phase,
      drawingStrokeSeq: room.drawingStrokeSeq,
      matchRoundIndex:
        room.phase === "lobby"
          ? undefined
          : Number.isFinite(room.matchRoundIndex)
            ? room.matchRoundIndex
            : undefined,
      drawerPlayerId:
        room.phase === "lobby" || room.phase === "matchEnded"
          ? null
          : room.currentDrawerPlayerId ?? null,
      canvasCommits,
      chatTail,
    };
    this.sendEvent(ws, hydrate);
  }

  private clearMatchTimers(roomId: string): void {
    const room = this.getRoomById(roomId);
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
    if (!this.getRoomById(room.id) || room.phase !== "drawing") return;

    for (const t of timeouts) clearTimeout(t);
    timeouts.length = 0;

    room.phase = "roundResult";
    room.drawingPhaseStartedAtMs = null;
    room.drawingPhaseAwardedGuesserIds = null;
    room.drawingPhaseCloseGuessHintsByPlayerId = null;
    this.broadcastMatchPhase(room, undefined, drawerId, roundIndex);
    this.writeRoomToRedis(room, ROOM_TTL_ACTIVE_S);
    if (roundIndex + 1 < resolveRoundsPerMatch()) {
      const next = setTimeout(
        () => this.queueRoundStart(room, roundIndex + 1, 0, "roundResult", timeouts),
        resolveInterRoundGapMs(),
      );
      timeouts.push(next);
    } else {
      const endMatch = setTimeout(() => {
        if (!this.getRoomById(room.id) || room.phase !== "roundResult") return;
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
    room.canvasPhaseLog.reset();
    room.drawingPhaseStartedAtMs = Date.now();
    room.drawingPhaseAwardedGuesserIds = new Set();
    room.drawingPhaseCloseGuessHintsByPlayerId = new Map();
    this.writeRoomToRedis(room, ROOM_TTL_ACTIVE_S);
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
        if (!this.getRoomById(roomSnapshotId) || room.phase !== "drawing") return;
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
    if (!this.getRoomById(room.id)) return;
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
    this.writeRoomToRedis(room, ROOM_TTL_ACTIVE_S);
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
    room.awaitingReconnect.clear();
    room.chatTranscriptFanoutRows = [];
    room.canvasPhaseLog.reset();
    room.drawingStrokeSeq = 0;
    room.phase = "lobby";
    room.matchPlayerOrder = null;
    room.currentDrawerPlayerId = null;
    room.matchRoundIndex = 0;
    room.roundWordOptions = null;
    room.roundSecretWord = null;
    room.drawingPhaseStartedAtMs = null;
    room.drawingPhaseAwardedGuesserIds = null;
    room.drawingPhaseCloseGuessHintsByPlayerId = null;

    const roster = this.buildLobbyRosterPlayers(room);
    room.scoresByPlayerId = {};
    for (const p of roster) {
      room.scoresByPlayerId[p.playerId] = 0;
    }

    this.broadcastMatchPhase(room, undefined, undefined, undefined);
    this.broadcastLobbyRoster(room);
    this.writeRoomToRedis(room, ROOM_TTL_ACTIVE_S);
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
      if (!this.getRoomById(room.id)) return;
      if (room.phase !== gatePhase) return;

      const drawerId = order[roundIndex % order.length]!;
      room.currentDrawerPlayerId = drawerId;
      room.matchRoundIndex = roundIndex;
      room.roundWordOptions = this.wordBank.sampleThree();
      room.roundSecretWord = null;
      room.phase = "choosingWord";
      this.writeRoomToRedis(room, ROOM_TTL_ACTIVE_S);
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
    room.awaitingReconnect.clear();
    room.chatTranscriptFanoutRows = [];
    room.canvasPhaseLog.reset();
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
   * Single entry point for correct-guess awards (FR10; Epic 4 chat delegates here).
   * Validates phase, roster, excludes the drawer as guesser, and awards each guesser at most once per
   * drawing phase (duplicate invokes return `"ALREADY_AWARDED_THIS_DRAWING"`).
   *
   * **Exclusive ledger mutation for chat wins:** Only this method increments `scoresByPlayerId` for
   * adjudicated exact guesses (`applyChatMessage` success path calls it exactly once per first-time
   * guesser each drawing phase). Match bootstrapping resets scores elsewhere; avoid parallel score forks.
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
    const room = this.getRoomById(opts.roomId);
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
    const effectiveElapsedMs = clampGuessElapsedMs(elapsed, roundMs);
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
        effectiveElapsedMs,
        roundMs,
        guesserScoreMax: maxPts,
        guesserScoreMin: minPts,
      },
      "Awarded points for correct guess",
    );

    this.broadcastLobbyRoster(room);
    this.writeRoomToRedis(room, ROOM_TTL_ACTIVE_S);
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
      secret && inDrawing
        ? normalizeGuessText(sanitizeChatMessage(secret))
        : null;
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
        // Story 4.3 / FR22: ledger + roster fan-out precedes celebration so totals are authoritative
        // when `chatCorrectGuess` arrives (`applyCorrectGuessAward` broadcasts `lobbyRoster` internally).
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

    // Story 7.1 / AC3: only active match roster (non-drawer already excluded). Join is lobby-only today;
    // this stays explicit for future mid-match roles. Skip Levenshtein when hints are off (rate cap 0).
    if (
      inDrawing &&
      senderId !== drawerId &&
      secret &&
      normalizedSecret &&
      normalizedSecret.length > 0 &&
      !isExact &&
      (room.matchPlayerOrder?.includes(senderId) ?? false)
    ) {
      const hintMap = room.drawingPhaseCloseGuessHintsByPlayerId;
      const maxHints = resolveCloseGuessMaxHintsPerDrawingPhase();
      if (hintMap && maxHints > 0) {
        const tier = evaluateCloseGuessTier(
          normalizedMsg,
          normalizedSecret,
          resolveCloseGuessHeuristicOptions(),
        );
        if (tier !== "none") {
          const cooldownMs = resolveCloseGuessHintCooldownMs();
          const now = Date.now();
          const prev = hintMap.get(senderId) ?? { count: 0, lastAtMs: 0 };
          const cooled = now - prev.lastAtMs >= cooldownMs;
          const underCap = prev.count < maxHints;
          if (cooled && underCap) {
            hintMap.set(senderId, { count: prev.count + 1, lastAtMs: now });
            const { veryClose, close } = resolveCloseGuessHintMessages();
            const message = tier === "veryClose" ? veryClose : close;
            const id = randomUUID();
            this.sendEvent(ws, {
              type: "chatCloseGuessHint",
              roomId: room.id,
              matchRoundIndex: room.matchRoundIndex,
              message,
              id,
              ts: now,
            });
            if (resolveCloseGuessHintLogEnabled()) {
              log.info(
                {
                  event: "close_guess_hint",
                  roomId: room.id,
                  matchRoundIndex: room.matchRoundIndex,
                  playerId: senderId,
                },
                "Close guess hint sent",
              );
            }
          }
        }
      }
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
    const audience = this.transcriptAudiencePlayerIds(room);
    const textByRecipient: Record<string, string> = {};
    for (const pid of audience) {
      textByRecipient[pid] = textForRecipient(pid);
    }
    this.pushChatTranscriptFanout(room, {
      kind: "player",
      id,
      ts,
      roomId: room.id,
      senderPlayerId,
      senderDisplayName,
      textByRecipient,
    });
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

    const audience = this.transcriptAudiencePlayerIds(room);
    const revealedWordByRecipient: Record<string, string | undefined> = {};
    for (const pid of audience) {
      const mayReveal =
        pid === guesserPlayerId || pid === drawerId || awarded.has(pid);
      revealedWordByRecipient[pid] = mayReveal ? secretWord : undefined;
    }
    this.pushChatTranscriptFanout(room, {
      kind: "correctGuess",
      id,
      ts,
      roomId: room.id,
      guesserPlayerId,
      guesserDisplayName,
      censoredAnnouncement,
      revealedWordByRecipient,
    });

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
    // P-4: lockWordAndBeginDrawing already calls writeRoomToRedis — no second write needed
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
    this.writeRoomToRedis(room, ROOM_TTL_ACTIVE_S);
    return { ok: true };
  }

  updateSettings(
    actor: WebSocket,
    partial: Partial<RoomSettings>,
  ): { ok: true } | { ok: false; code: string; detail?: string } {
    const room = this.getRoomForSocket(actor);
    if (!room) return { ok: false, code: "NOT_IN_ROOM" };
    if (room.hostSocket !== actor) return { ok: false, code: "NOT_HOST" };
    if (room.phase !== "lobby") return { ok: false, code: "MATCH_IN_PROGRESS" };
    if (Object.keys(partial).length === 0) return { ok: true };
    if (
      partial.maxPlayers !== undefined &&
      partial.maxPlayers < room.sockets.size
    ) {
      return { ok: false, code: "VALIDATION_ERROR", detail: "maxPlayers below current count" };
    }
    const knownKeys: (keyof RoomSettings)[] = ["rounds", "drawTime", "maxPlayers", "wordPack", "showHints", "skipAfk", "allowVoice"];
    const filtered = Object.fromEntries(
      knownKeys.filter((k) => k in partial).map((k) => [k, partial[k]])
    ) as Partial<RoomSettings>;
    room.settings = { ...room.settings, ...filtered };
    this.writeRoomToRedis(room);
    const event: ServerEvent = { type: "settingsUpdated", roomId: room.id, settings: room.settings };
    for (const ws of room.sockets) {
      this.sendEvent(ws, event);
    }
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
      if (!this.roomRuntimeByCode.has(code)) return code;
    }
    throw new Error("ROOM_CODE_COLLISION_RETRY_EXHAUSTED");
  }

  leaveSocketRoom(ws: WebSocket): void {
    const roomId = this.socketToRoomId.get(ws);
    const identity = roomId ? this.socketLobbyIdentity.get(ws) : undefined;
    if (!roomId) {
      this.socketLobbyIdentity.delete(ws);
      return;
    }
    const room = this.getRoomById(roomId);
    if (room && identity && room.phase !== "lobby") {
      room.awaitingReconnect.set(identity.playerId, {
        playerId: identity.playerId,
        displayName: identity.displayName,
        avatarPresetId: identity.avatarPresetId,
      });
    }
    if (room) {
      room.sockets.delete(ws);
      if (room.hostSocket === ws) {
        const next = room.sockets.values().next().value as WebSocket | undefined;
        room.hostSocket = next ?? null;
      }
      const survivors = room.sockets.size;
      if (survivors === 0) {
        this.clearMatchTimers(room.id);
        this.roomRuntimeByCode.delete(room.code);
        this.roomCodeById.delete(room.id);
        this.deleteRoomFromRedis(room);
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

  createRoom(ws: WebSocket, player: NewLobbyPlayer & { token?: string }): Room {
    this.leaveSocketRoom(ws);
    const playerId = randomUUID();
    this.socketLobbyIdentity.set(ws, {
      playerId,
      displayName: player.displayName,
      avatarPresetId: player.avatarPresetId,
    });
    const code = this.generateUniqueCode();
    const hostToken = randomBytes(16).toString("base64url").slice(0, 21);
    const room = new Room({
      id: randomUUID(),
      code,
      maxPlayers: this.maxPlayersPerRoom,
      hostPlayerId: playerId,
    });
    room.hostToken = hostToken;
    room.sockets.add(ws);
    room.hostSocket = ws;
    this.roomRuntimeByCode.set(code, room);
    this.roomCodeById.set(room.id, code);
    this.socketToRoomId.set(ws, room.id);
    this.writeRoomToRedis(room, ROOM_TTL_IDLE_S);
    if (player.token) {
      void this.redis
        .pipeline()
        .hset(playerKey(player.token), serializePlayer({
          playerId,
          displayName: player.displayName,
          avatarPresetId: player.avatarPresetId,
          updatedAt: new Date().toISOString(),
        }))
        .expire(playerKey(player.token), PLAYER_TTL_S)
        .exec()
        .catch((err: unknown) => {
          log.error({ err, token: player.token }, "Redis player token upsert failed in createRoom");
        });
    }
    return room;
  }

  reconnectHost(
    ws: WebSocket,
    roomId: string,
    expectedPlayerId: string,
    player: NewLobbyPlayer & { token?: string },
  ): { ok: true; room: Room } | { ok: false; reason: ReconnectHostFailureReason } {
    const room = this.getRoomById(roomId);
    if (!room) return { ok: false, reason: "UNKNOWN_ROOM" };
    if (room.hostPlayerId !== expectedPlayerId) return { ok: false, reason: "NOT_HOST" };

    const stashedSession = room.awaitingReconnect.get(expectedPlayerId);
    const midMatchReclaim = stashedSession !== undefined;
    if (!midMatchReclaim && room.phase !== "lobby") {
      return { ok: false, reason: "JOIN_NOT_ALLOWED" };
    }

    for (const s of room.sockets) {
      const id = this.socketLobbyIdentity.get(s);
      if (id?.playerId === expectedPlayerId) return { ok: false, reason: "ALREADY_CONNECTED" };
    }

    if (!this.roomHasCapacity(room)) return { ok: false, reason: "ROOM_FULL" };

    this.leaveSocketRoom(ws);

    if (stashedSession) {
      room.awaitingReconnect.delete(expectedPlayerId);
    }

    const displayName = stashedSession ? stashedSession.displayName : player.displayName;
    const avatarPresetId = stashedSession ? stashedSession.avatarPresetId : player.avatarPresetId;

    // Legacy rooms (pre-8-1) may have an empty hostToken; generate one on reconnect.
    if (!room.hostToken) {
      room.hostToken = randomBytes(16).toString("base64url").slice(0, 21);
    }

    this.socketLobbyIdentity.set(ws, {
      playerId: expectedPlayerId,
      displayName,
      avatarPresetId,
    });
    room.sockets.add(ws);
    room.hostSocket = ws;
    this.socketToRoomId.set(ws, room.id);
    this.writeRoomToRedis(room, ROOM_TTL_ACTIVE_S);
    if (player.token) {
      void this.redis
        .pipeline()
        .hset(playerKey(player.token), serializePlayer({
          playerId: expectedPlayerId,
          displayName,
          avatarPresetId,
          updatedAt: new Date().toISOString(),
        }))
        .expire(playerKey(player.token), PLAYER_TTL_S)
        .exec()
        .catch((err: unknown) => {
          log.error({ err, token: player.token }, "Redis player token upsert failed in reconnectHost");
        });
    }
    return { ok: true, room };
  }

  reconnectPlayer(
    ws: WebSocket,
    roomId: string,
    expectedPlayerId: string,
    player: NewLobbyPlayer & { token?: string },
  ): { ok: true; room: Room } | { ok: false; reason: ReconnectPlayerFailureReason } {
    const room = this.getRoomById(roomId);
    if (!room) return { ok: false, reason: "UNKNOWN_ROOM" };
    if (room.hostPlayerId === expectedPlayerId) {
      return { ok: false, reason: "HOST_USE_RECONNECT_HOST" };
    }
    const stashed = room.awaitingReconnect.get(expectedPlayerId);
    if (!stashed) return { ok: false, reason: "NO_STASHED_SESSION" };
    if (
      stashed.displayName !== player.displayName ||
      stashed.avatarPresetId !== player.avatarPresetId
    ) {
      return { ok: false, reason: "IDENTITY_MISMATCH" };
    }

    for (const s of room.sockets) {
      const id = this.socketLobbyIdentity.get(s);
      if (id?.playerId === expectedPlayerId) return { ok: false, reason: "ALREADY_CONNECTED" };
    }

    if (!this.roomHasCapacity(room)) return { ok: false, reason: "ROOM_FULL" };

    this.leaveSocketRoom(ws);

    room.awaitingReconnect.delete(expectedPlayerId);

    this.socketLobbyIdentity.set(ws, {
      playerId: expectedPlayerId,
      displayName: stashed.displayName,
      avatarPresetId: stashed.avatarPresetId,
    });
    room.sockets.add(ws);
    this.socketToRoomId.set(ws, room.id);
    this.writeRoomToRedis(room, ROOM_TTL_ACTIVE_S);
    if (player.token) {
      void this.redis
        .pipeline()
        .hset(playerKey(player.token), serializePlayer({
          playerId: expectedPlayerId,
          displayName: stashed.displayName,
          avatarPresetId: stashed.avatarPresetId,
          updatedAt: new Date().toISOString(),
        }))
        .expire(playerKey(player.token), PLAYER_TTL_S)
        .exec()
        .catch((err: unknown) => {
          log.error({ err, token: player.token }, "Redis player token upsert failed in reconnectPlayer");
        });
    }
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

    const nextSeq = room.drawingStrokeSeq + 1;
    const payload: CanvasReplayEvent = {
      type: "drawingStrokeCommitted",
      roomId: room.id,
      seq: nextSeq,
      senderPlayerId: playerId,
      strokeId: cmd.strokeId,
      chunkId: cmd.chunkId,
      points: cmd.points,
      color: cmd.color,
      lineWidthPx: cmd.lineWidthPx,
    };

    const appended = room.canvasPhaseLog.tryAppend(payload);
    if (!appended.ok) {
      this.notifyCanvasIntegrityFailure(ws, room, appended.code);
      return { ok: false, code: appended.code };
    }
    room.drawingStrokeSeq = nextSeq;

    for (const sock of room.sockets) {
      this.sendEvent(sock, payload);
    }

    return { ok: true, seq: room.drawingStrokeSeq };
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

    const nextSeq = room.drawingStrokeSeq + 1;
    const payload: CanvasReplayEvent = {
      type: "drawingCanvasOpCommitted",
      roomId: room.id,
      seq: nextSeq,
      senderPlayerId: playerId,
      op,
    };

    const appended = room.canvasPhaseLog.tryAppend(payload);
    if (!appended.ok) {
      this.notifyCanvasIntegrityFailure(ws, room, appended.code);
      return { ok: false, code: appended.code };
    }
    room.drawingStrokeSeq = nextSeq;

    for (const sock of room.sockets) {
      this.sendEvent(sock, payload);
    }

    return { ok: true, seq: room.drawingStrokeSeq };
  }

  joinRoom(
    ws: WebSocket,
    normalizedCode: string,
    player: NewLobbyPlayer & { token?: string },
  ):
    | { ok: true; room: Room }
    | { ok: false; reason: JoinRoomFailureReason } {
    const room = this.roomRuntimeByCode.get(normalizedCode);
    if (!room) return { ok: false, reason: "UNKNOWN_ROOM" };

    const current = this.getRoomForSocket(ws);
    if (current?.id === room.id) {
      return { ok: true, room };
    }

    if (room.phase !== "lobby") {
      return { ok: false, reason: "JOIN_NOT_ALLOWED" };
    }

    if (!this.roomHasCapacity(room)) return { ok: false, reason: "ROOM_FULL" };

    this.leaveSocketRoom(ws);
    const playerId = randomUUID();
    this.socketLobbyIdentity.set(ws, {
      playerId,
      displayName: player.displayName,
      avatarPresetId: player.avatarPresetId,
    });
    room.sockets.add(ws);
    this.socketToRoomId.set(ws, room.id);
    this.writeRoomToRedis(room, ROOM_TTL_ACTIVE_S);
    if (player.token) {
      void this.redis
        .pipeline()
        .hset(playerKey(player.token), serializePlayer({
          playerId,
          displayName: player.displayName,
          avatarPresetId: player.avatarPresetId,
          updatedAt: new Date().toISOString(),
        }))
        .expire(playerKey(player.token), PLAYER_TTL_S)
        .exec()
        .catch((err: unknown) => {
          log.error({ err, token: player.token }, "Redis player token upsert failed in joinRoom");
        });
    }
    return { ok: true, room };
  }

  getRoomForSocket(ws: WebSocket): Room | undefined {
    const id = this.socketToRoomId.get(ws);
    return id ? this.getRoomById(id) : undefined;
  }
}
