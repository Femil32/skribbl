import { describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import {
  type ClientCommand,
  NICKNAME_MAX_GRAPHEMES,
  parseServerEvent,
} from "@skribbl/shared";
import { RoomManager } from "./room/room-manager.js";
import { createStaticWordBank } from "./words/word-bank.js";
import {
  resolveInterRoundGapMs,
  resolveMatchStartHandshakeMs,
  resolveHintCadenceMs,
  resolveRoundMs,
  resolveWordChoiceMs,
} from "./config/game.js";
import {
  handleClientCommand,
  sendProtocolError,
} from "./protocol/handlers/handle-client-command.js";

function captureWs(): { ws: WebSocket; sent: string[] } {
  const sent: string[] = [];
  const ws = {
    send(data: string | Buffer) {
      sent.push(String(data));
    },
  };
  return { ws: ws as unknown as WebSocket, sent };
}

const integrationWordBank = () =>
  createStaticWordBank(["apple", "banana", "citrus", "dragon", "eagle"]);
const hostIdentity = { displayName: "Hosty", avatarPresetId: "preset-1" as const };
const guestIdentity = { displayName: "Guesty", avatarPresetId: "preset-2" as const };

function lastLobbyRoster(sent: string[]) {
  for (let i = sent.length - 1; i >= 0; i--) {
    const ev = parseServerEvent(JSON.parse(sent[i]!));
    if (ev.type === "lobbyRoster") return ev;
  }
  return undefined;
}

describe("handleClientCommand + RoomManager", () => {
  it("createRoom then joinRoom succeeds for second socket", () => {
    const rm = new RoomManager(8, integrationWordBank());
    const a = captureWs();
    const b = captureWs();

    handleClientCommand(a.ws, { type: "createRoom", ...hostIdentity }, rm);
    expect(a.sent.length).toBeGreaterThanOrEqual(1);
    const created = parseServerEvent(JSON.parse(a.sent[0]!));
    expect(created.type).toBe("roomCreated");
    if (created.type !== "roomCreated") throw new Error("unexpected");
    expect(created.displayName).toBe("Hosty");
    expect(created.playerId).toBeTruthy();

    handleClientCommand(
      b.ws,
      { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
      rm,
    );
    expect(parseServerEvent(JSON.parse(b.sent[0]!)).type).toBe("roomJoined");
    expect(
      b.sent.some((line) => {
        const ev = parseServerEvent(JSON.parse(line));
        return ev.type === "lobbyRoster" && ev.players.length === 2;
      }),
    ).toBe(true);
  });

  it("unknown room yields UNKNOWN_ROOM", () => {
    const rm = new RoomManager(8, integrationWordBank());
    const { ws, sent } = captureWs();
    handleClientCommand(
      ws,
      { type: "joinRoom", roomCode: "ZZZZZZ", ...guestIdentity },
      rm,
    );
    expect(sent).toHaveLength(1);
    const ev = parseServerEvent(JSON.parse(sent[0]!));
    expect(ev.type).toBe("error");
    if (ev.type === "error") expect(ev.code).toBe("UNKNOWN_ROOM");
  });

  it("malformed room code yields BAD_CODE", () => {
    const rm = new RoomManager(8, integrationWordBank());
    const { ws, sent } = captureWs();
    handleClientCommand(
      ws,
      { type: "joinRoom", roomCode: "NO", ...guestIdentity },
      rm,
    );
    expect(sent).toHaveLength(1);
    const ev = parseServerEvent(JSON.parse(sent[0]!));
    expect(ev.type).toBe("error");
    if (ev.type === "error") expect(ev.code).toBe("BAD_CODE");
  });

  it("empty display name yields BAD_NICKNAME", () => {
    const rm = new RoomManager(8, integrationWordBank());
    const { ws, sent } = captureWs();
    handleClientCommand(
      ws,
      { type: "createRoom", displayName: "   ", avatarPresetId: "preset-1" },
      rm,
    );
    expect(sent).toHaveLength(1);
    const ev = parseServerEvent(JSON.parse(sent[0]!));
    expect(ev.type).toBe("error");
    if (ev.type === "error") expect(ev.code).toBe("BAD_NICKNAME");
  });

  it("ROOM_FULL yields stable error.code through handleClientCommand", () => {
    const rm = new RoomManager(2, integrationWordBank());
    const a = captureWs();
    const b = captureWs();
    const c = captureWs();

    handleClientCommand(a.ws, { type: "createRoom", ...hostIdentity }, rm);
    const created = parseServerEvent(JSON.parse(a.sent[0]!));
    expect(created.type).toBe("roomCreated");
    if (created.type !== "roomCreated") throw new Error("unexpected");

    handleClientCommand(
      b.ws,
      { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
      rm,
    );
    expect(parseServerEvent(JSON.parse(b.sent[0]!)).type).toBe("roomJoined");

    handleClientCommand(
      c.ws,
      {
        type: "joinRoom",
        roomCode: created.roomCode,
        displayName: "Third",
        avatarPresetId: "preset-3",
      },
      rm,
    );
    expect(c.sent).toHaveLength(1);
    const third = parseServerEvent(JSON.parse(c.sent[0]!));
    expect(third.type).toBe("error");
    if (third.type === "error") expect(third.code).toBe("ROOM_FULL");
  });

  it("INVALID_AVATAR when handler bypasses schema (unsupported preset string)", () => {
    const rm = new RoomManager(8, integrationWordBank());
    const a = captureWs();
    handleClientCommand(a.ws, { type: "createRoom", ...hostIdentity }, rm);
    const created = parseServerEvent(JSON.parse(a.sent[0]!));
    expect(created.type).toBe("roomCreated");
    if (created.type !== "roomCreated") throw new Error("unexpected");

    const b = captureWs();
    handleClientCommand(
      b.ws,
      {
        type: "joinRoom",
        roomCode: created.roomCode,
        displayName: "Guy",
        avatarPresetId: "not-a-listed-preset",
      } as unknown as ClientCommand,
      rm,
    );
    expect(b.sent).toHaveLength(1);
    const ev = parseServerEvent(JSON.parse(b.sent[0]!));
    expect(ev.type).toBe("error");
    if (ev.type === "error") expect(ev.code).toBe("INVALID_AVATAR");
  });

  it("NICKNAME_TOO_LONG on createRoom", () => {
    const rm = new RoomManager(8, integrationWordBank());
    const { ws, sent } = captureWs();
    const tooLong = "z".repeat(NICKNAME_MAX_GRAPHEMES + 1);
    handleClientCommand(
      ws,
      {
        type: "createRoom",
        displayName: tooLong,
        avatarPresetId: "preset-1",
      },
      rm,
    );
    expect(sent).toHaveLength(1);
    const ev = parseServerEvent(JSON.parse(sent[0]!));
    expect(ev.type).toBe("error");
    if (ev.type === "error") expect(ev.code).toBe("NICKNAME_TOO_LONG");
  });

  it("sendProtocolError matches serializeServerEvent shape", () => {
    const { ws, sent } = captureWs();
    sendProtocolError(ws, "BAD_PAYLOAD", "bad");
    const ev = parseServerEvent(JSON.parse(sent[0]!));
    expect(ev).toEqual({
      type: "error",
      code: "BAD_PAYLOAD",
      message: "bad",
    });
  });

  it("lobby roster after create and join: host flagged, deterministic order by playerId", () => {
    const rm = new RoomManager(8, integrationWordBank());
    const a = captureWs();
    const b = captureWs();

    handleClientCommand(a.ws, { type: "createRoom", ...hostIdentity }, rm);
    const created = parseServerEvent(JSON.parse(a.sent[0]!));
    if (created.type !== "roomCreated") throw new Error("unexpected");

    handleClientCommand(
      b.ws,
      { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
      rm,
    );

    const rA = lastLobbyRoster(a.sent);
    const rB = lastLobbyRoster(b.sent);
    expect(rA?.type).toBe("lobbyRoster");
    expect(rB?.type).toBe("lobbyRoster");
    if (rA?.type !== "lobbyRoster" || rB?.type !== "lobbyRoster") throw new Error("x");
    expect(rA.players.map((p) => p.playerId).join()).toBe(
      [...rA.players].map((p) => p.playerId).sort().join(),
    );
    expect(rA.players.some((p) => p.playerId === created.playerId && p.isHost)).toBe(true);
    expect(rA.players.some((p) => p.displayName === "Guesty" && !p.isHost)).toBe(true);
  });

  it("startMatch: two players succeeds; emits matchStarting to both", () => {
    const rm = new RoomManager(8, integrationWordBank());
    const a = captureWs();
    const b = captureWs();

    handleClientCommand(a.ws, { type: "createRoom", ...hostIdentity }, rm);
    const created = parseServerEvent(JSON.parse(a.sent[0]!));
    if (created.type !== "roomCreated") throw new Error("unexpected");

    handleClientCommand(
      b.ws,
      { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
      rm,
    );

    handleClientCommand(a.ws, { type: "startMatch" }, rm);

    const startA = a.sent.map((line) => parseServerEvent(JSON.parse(line)));
    const startB = b.sent.map((line) => parseServerEvent(JSON.parse(line)));
    expect(startA.some((e) => e.type === "matchStarting")).toBe(true);
    expect(startB.some((e) => e.type === "matchStarting")).toBe(true);
    const ms = startA.find((e) => e.type === "matchStarting");
    expect(ms).toEqual(
      expect.objectContaining({
        type: "matchStarting",
        phase: "matchStarting",
      }),
    );
  });

  it("startMatch: server timers emit matchPhase sequence", () => {
    vi.stubEnv("ROUNDS_PER_MATCH", "1");
    vi.useFakeTimers();
    try {
      const rm = new RoomManager(8, integrationWordBank());
      const a = captureWs();
      const b = captureWs();

      handleClientCommand(a.ws, { type: "createRoom", ...hostIdentity }, rm);
      const created = parseServerEvent(JSON.parse(a.sent[0]!));
      if (created.type !== "roomCreated") throw new Error("unexpected");

      handleClientCommand(
        b.ws,
        { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
        rm,
      );
      handleClientCommand(a.ws, { type: "startMatch" }, rm);

      function matchPhases(sent: string[]) {
        return sent
          .map((line) => parseServerEvent(JSON.parse(line)))
          .filter((e): e is Extract<typeof e, { type: "matchPhase" }> => e.type === "matchPhase");
      }

      vi.advanceTimersByTime(resolveMatchStartHandshakeMs());
      expect(matchPhases(a.sent).some((p) => p.phase === "choosingWord")).toBe(true);
      vi.advanceTimersByTime(resolveWordChoiceMs());
      expect(matchPhases(a.sent).some((p) => p.phase === "drawing")).toBe(true);

      const afterChoose = Date.now();
      const drawingEvents = matchPhases(a.sent).filter((p) => p.phase === "drawing");
      const latestDrawing = drawingEvents[drawingEvents.length - 1]!;
      expect(latestDrawing.phaseDeadlineMs).toBeDefined();
      expect(latestDrawing.phaseDeadlineMs!).toBeGreaterThan(afterChoose);
      expect(latestDrawing.phaseDeadlineMs! - afterChoose).toBeLessThanOrEqual(resolveRoundMs());

      vi.advanceTimersByTime(resolveRoundMs());
      expect(matchPhases(a.sent).some((p) => p.phase === "roundResult")).toBe(true);

      vi.advanceTimersByTime(resolveInterRoundGapMs());
      const endedEv = matchPhases(a.sent).filter((p) => p.phase === "matchEnded");
      expect(endedEv.length).toBeGreaterThanOrEqual(1);
      const lastEnded = endedEv[endedEv.length - 1]!;
      expect(lastEnded.phaseDeadlineMs).toBeUndefined();
      expect(lastEnded.matchRoundIndex).toBe(0);
      const rosterAfterEnd = lastLobbyRoster(a.sent);
      expect(rosterAfterEnd?.type).toBe("lobbyRoster");
      if (rosterAfterEnd?.type === "lobbyRoster") {
        expect(rosterAfterEnd.players.length).toBe(2);
        for (const p of rosterAfterEnd.players) expect(typeof p.score).toBe("number");
      }

      const choosing = matchPhases(a.sent).find((p) => p.phase === "choosingWord");
      const drawing = matchPhases(a.sent).find((p) => p.phase === "drawing");
      expect(typeof choosing?.phaseDeadlineMs).toBe("number");
      expect(typeof drawing?.phaseDeadlineMs).toBe("number");
      expect(choosing!.phaseDeadlineMs!).toBeLessThan(drawing!.phaseDeadlineMs!);
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  it("returnToLobby: host resets to lobby with zero scores after matchEnded", () => {
    vi.stubEnv("ROUNDS_PER_MATCH", "1");
    vi.useFakeTimers();
    try {
      const rm = new RoomManager(8, integrationWordBank());
      const a = captureWs();
      const b = captureWs();

      handleClientCommand(a.ws, { type: "createRoom", ...hostIdentity }, rm);
      const created = parseServerEvent(JSON.parse(a.sent[0]!));
      if (created.type !== "roomCreated") throw new Error("unexpected");

      handleClientCommand(
        b.ws,
        { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
        rm,
      );
      handleClientCommand(a.ws, { type: "startMatch" }, rm);

      vi.advanceTimersByTime(resolveMatchStartHandshakeMs());
      vi.advanceTimersByTime(resolveWordChoiceMs());
      vi.advanceTimersByTime(resolveRoundMs());
      vi.advanceTimersByTime(resolveInterRoundGapMs());

      handleClientCommand(a.ws, { type: "returnToLobby" }, rm);

      function matchPhases(sent: string[]) {
        return sent
          .map((line) => parseServerEvent(JSON.parse(line)))
          .filter((e): e is Extract<typeof e, { type: "matchPhase" }> => e.type === "matchPhase");
      }
      expect(matchPhases(a.sent).some((p) => p.phase === "lobby")).toBe(true);
      expect(matchPhases(b.sent).some((p) => p.phase === "lobby")).toBe(true);
      const roster = lastLobbyRoster(a.sent);
      if (roster?.type === "lobbyRoster") {
        expect(roster.players.every((p) => p.score === 0)).toBe(true);
      }
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  it("returnToLobby: guest gets NOT_HOST", () => {
    vi.stubEnv("ROUNDS_PER_MATCH", "1");
    vi.useFakeTimers();
    try {
      const rm = new RoomManager(8, integrationWordBank());
      const a = captureWs();
      const b = captureWs();

      handleClientCommand(a.ws, { type: "createRoom", ...hostIdentity }, rm);
      const created = parseServerEvent(JSON.parse(a.sent[0]!));
      if (created.type !== "roomCreated") throw new Error("unexpected");

      handleClientCommand(
        b.ws,
        { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
        rm,
      );
      handleClientCommand(a.ws, { type: "startMatch" }, rm);

      vi.advanceTimersByTime(resolveMatchStartHandshakeMs());
      vi.advanceTimersByTime(resolveWordChoiceMs());
      vi.advanceTimersByTime(resolveRoundMs());
      vi.advanceTimersByTime(resolveInterRoundGapMs());

      handleClientCommand(b.ws, { type: "returnToLobby" }, rm);
      const errEv = b.sent
        .map((line) => parseServerEvent(JSON.parse(line)))
        .find((e) => e.type === "error");
      expect(errEv?.type).toBe("error");
      if (errEv?.type === "error") expect(errEv.code).toBe("NOT_HOST");
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  it("startMatch: round-robin advances drawer on next round", () => {
    vi.stubEnv("ROUNDS_PER_MATCH", "2");
    vi.useFakeTimers();
    try {
      const rm = new RoomManager(8, integrationWordBank());
      const a = captureWs();
      const b = captureWs();

      handleClientCommand(a.ws, { type: "createRoom", ...hostIdentity }, rm);
      const created = parseServerEvent(JSON.parse(a.sent[0]!));
      if (created.type !== "roomCreated") throw new Error("unexpected");

      handleClientCommand(
        b.ws,
        { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
        rm,
      );
      handleClientCommand(a.ws, { type: "startMatch" }, rm);

      function matchPhases(sent: string[]) {
        return sent
          .map((line) => parseServerEvent(JSON.parse(line)))
          .filter((e): e is Extract<typeof e, { type: "matchPhase" }> => e.type === "matchPhase");
      }

      vi.advanceTimersByTime(resolveMatchStartHandshakeMs());
      vi.advanceTimersByTime(resolveWordChoiceMs());
      vi.advanceTimersByTime(resolveRoundMs());
      vi.advanceTimersByTime(resolveInterRoundGapMs());
      vi.advanceTimersByTime(resolveWordChoiceMs());

      const choosing = matchPhases(a.sent).filter((e) => e.phase === "choosingWord");
      expect(choosing.length).toBeGreaterThanOrEqual(2);
      expect(choosing[0]!.drawerPlayerId).toBeTruthy();
      expect(choosing[1]!.drawerPlayerId).toBeTruthy();
      expect(choosing[0]!.drawerPlayerId).not.toBe(choosing[1]!.drawerPlayerId);
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  it("startMatch: non-host rejected with NOT_HOST", () => {
    const rm = new RoomManager(8, integrationWordBank());
    const a = captureWs();
    const b = captureWs();

    handleClientCommand(a.ws, { type: "createRoom", ...hostIdentity }, rm);
    const created = parseServerEvent(JSON.parse(a.sent[0]!));
    if (created.type !== "roomCreated") throw new Error("unexpected");

    handleClientCommand(
      b.ws,
      { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
      rm,
    );

    handleClientCommand(b.ws, { type: "startMatch" }, rm);
    const last = parseServerEvent(JSON.parse(b.sent[b.sent.length - 1]!));
    expect(last.type).toBe("error");
    if (last.type === "error") expect(last.code).toBe("NOT_HOST");
  });

  it("startMatch: one player yields NOT_ENOUGH_PLAYERS", () => {
    const rm = new RoomManager(8, integrationWordBank());
    const a = captureWs();
    handleClientCommand(a.ws, { type: "createRoom", ...hostIdentity }, rm);
    handleClientCommand(a.ws, { type: "startMatch" }, rm);
    const last = parseServerEvent(JSON.parse(a.sent[a.sent.length - 1]!));
    expect(last.type).toBe("error");
    if (last.type === "error") expect(last.code).toBe("NOT_ENOUGH_PLAYERS");
  });

  it("join after start yields JOIN_NOT_ALLOWED", () => {
    const rm = new RoomManager(8, integrationWordBank());
    const a = captureWs();
    const b = captureWs();
    const c = captureWs();

    handleClientCommand(a.ws, { type: "createRoom", ...hostIdentity }, rm);
    const created = parseServerEvent(JSON.parse(a.sent[0]!));
    if (created.type !== "roomCreated") throw new Error("unexpected");

    handleClientCommand(
      b.ws,
      { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
      rm,
    );
    handleClientCommand(a.ws, { type: "startMatch" }, rm);

    handleClientCommand(
      c.ws,
      {
        type: "joinRoom",
        roomCode: created.roomCode,
        displayName: "Late",
        avatarPresetId: "preset-3",
      },
      rm,
    );

    const last = parseServerEvent(JSON.parse(c.sent[c.sent.length - 1]!));
    expect(last.type).toBe("error");
    if (last.type === "error") expect(last.code).toBe("JOIN_NOT_ALLOWED");
  });

  it("leaveSocketRoom broadcasts updated roster", () => {
    const rm = new RoomManager(8, integrationWordBank());
    const a = captureWs();
    const b = captureWs();

    handleClientCommand(a.ws, { type: "createRoom", ...hostIdentity }, rm);
    const created = parseServerEvent(JSON.parse(a.sent[0]!));
    if (created.type !== "roomCreated") throw new Error("unexpected");

    handleClientCommand(
      b.ws,
      { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
      rm,
    );

    rm.leaveSocketRoom(b.ws);
    const r = lastLobbyRoster(a.sent);
    expect(r?.players.some((p) => p.displayName === "Guesty")).toBe(false);
    expect(r?.players.some((p) => p.displayName === "Hosty" && p.isHost)).toBe(true);
  });

  it("reconnectHost reclaims lobby when the room still exists", () => {
    const rm = new RoomManager(8, integrationWordBank());
    const host = captureWs();
    const guest = captureWs();

    handleClientCommand(host.ws, { type: "createRoom", ...hostIdentity }, rm);
    const created = parseServerEvent(JSON.parse(host.sent[0]!));
    if (created.type !== "roomCreated") throw new Error("unexpected");

    handleClientCommand(
      guest.ws,
      { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
      rm,
    );

    rm.leaveSocketRoom(host.ws);

    const host2 = captureWs();
    handleClientCommand(
      host2.ws,
      {
        type: "reconnectHost",
        roomId: created.roomId,
        playerId: created.playerId,
        displayName: "Hosty",
        avatarPresetId: "preset-1",
      },
      rm,
    );

    const reclaim = parseServerEvent(JSON.parse(host2.sent[0]!));
    expect(reclaim.type).toBe("roomCreated");
    if (reclaim.type === "roomCreated") {
      expect(reclaim.roomId).toBe(created.roomId);
      expect(reclaim.playerId).toBe(created.playerId);
    }
    const r = lastLobbyRoster(host2.sent);
    expect(r?.players.length).toBe(2);
  });

  it("reconnectHost after room dissolved yields HOST_SESSION_LOST", () => {
    const rm = new RoomManager(8, integrationWordBank());
    const host = captureWs();
    handleClientCommand(host.ws, { type: "createRoom", ...hostIdentity }, rm);
    const created = parseServerEvent(JSON.parse(host.sent[0]!));
    if (created.type !== "roomCreated") throw new Error("unexpected");
    rm.leaveSocketRoom(host.ws);

    const host2 = captureWs();
    handleClientCommand(
      host2.ws,
      {
        type: "reconnectHost",
        roomId: created.roomId,
        playerId: created.playerId,
        displayName: "Hosty",
        avatarPresetId: "preset-1",
      },
      rm,
    );
    const ev = parseServerEvent(JSON.parse(host2.sent[0]!));
    expect(ev.type).toBe("error");
    if (ev.type === "error") expect(ev.code).toBe("HOST_SESSION_LOST");
  });

  it("choosingWord: drawer receives wordChoiceOffer only; chooseWord enters drawing early", () => {
    vi.stubEnv("ROUNDS_PER_MATCH", "1");
    vi.useFakeTimers();
    try {
      const rm = new RoomManager(8, integrationWordBank());
      const host = captureWs();
      const guest = captureWs();

      handleClientCommand(host.ws, { type: "createRoom", ...hostIdentity }, rm);
      const created = parseServerEvent(JSON.parse(host.sent[0]!));
      if (created.type !== "roomCreated") throw new Error("unexpected");

      handleClientCommand(
        guest.ws,
        { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
        rm,
      );

      handleClientCommand(host.ws, { type: "startMatch" }, rm);
      vi.advanceTimersByTime(resolveMatchStartHandshakeMs());

      function choosingDrawerId(sent: string[]): string | undefined {
        const ev = sent
          .map((line) => parseServerEvent(JSON.parse(line)))
          .find((e) => e.type === "matchPhase" && e.phase === "choosingWord");
        return ev?.type === "matchPhase" ? ev.drawerPlayerId : undefined;
      }

      const drawerId = choosingDrawerId(host.sent) ?? choosingDrawerId(guest.sent);
      expect(drawerId).toBeTruthy();

      const drawerIsHost = drawerId === created.playerId;
      const drawerCapt = drawerIsHost ? host : guest;
      const guesserCapt = drawerIsHost ? guest : host;

      const offersDrawer = drawerCapt.sent
        .map((line) => parseServerEvent(JSON.parse(line)))
        .filter((e) => e.type === "wordChoiceOffer");
      expect(offersDrawer.length).toBeGreaterThanOrEqual(1);
      if (offersDrawer[0]?.type === "wordChoiceOffer") {
        expect(offersDrawer[0].words.length).toBe(3);
      }

      expect(
        guesserCapt.sent
          .map((line) => parseServerEvent(JSON.parse(line)))
          .some((e) => e.type === "wordChoiceOffer"),
      ).toBe(false);

      handleClientCommand(drawerCapt.ws, { type: "chooseWord", choiceIndex: 2 }, rm);

      const allPhases = [...host.sent, ...guest.sent]
        .map((line) => parseServerEvent(JSON.parse(line)))
        .filter((e): e is Extract<typeof e, { type: "matchPhase" }> => e.type === "matchPhase");
      expect(allPhases.some((p) => p.phase === "drawing")).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  it("applyCorrectGuessAward updates totals; rejects drawer-as-guesser", () => {
    vi.stubEnv("ROUNDS_PER_MATCH", "1");
    vi.stubEnv("ROUND_MS", "80000");
    vi.useFakeTimers();
    try {
      const rm = new RoomManager(8, integrationWordBank());
      const host = captureWs();
      const guest = captureWs();

      handleClientCommand(host.ws, { type: "createRoom", ...hostIdentity }, rm);
      const created = parseServerEvent(JSON.parse(host.sent[0]!));
      if (created.type !== "roomCreated") throw new Error("unexpected");

      handleClientCommand(
        guest.ws,
        { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
        rm,
      );
      const guestJoined = parseServerEvent(JSON.parse(guest.sent[0]!));
      expect(guestJoined.type).toBe("roomJoined");
      const guestPlayerId =
        guestJoined.type === "roomJoined" ? guestJoined.playerId : "";

      handleClientCommand(host.ws, { type: "startMatch" }, rm);
      vi.advanceTimersByTime(resolveMatchStartHandshakeMs());
      vi.advanceTimersByTime(resolveWordChoiceMs());

      const room = rm.getRoomForSocket(host.ws);
      expect(room).toBeDefined();
      if (!room) throw new Error("unexpected");

      const drawerId = room.currentDrawerPlayerId!;
      const drawerCapt = drawerId === created.playerId ? host : guest;
      handleClientCommand(drawerCapt.ws, { type: "chooseWord", choiceIndex: 0 }, rm);

      expect(room.phase).toBe("drawing");
      const start = room.drawingPhaseStartedAtMs!;
      const guesserId = drawerId === created.playerId ? guestPlayerId : created.playerId;

      expect(
        rm.applyCorrectGuessAward({
          roomId: room.id,
          guesserPlayerId: guesserId,
          occurredAtMs: start + resolveRoundMs() / 2,
        }),
      ).toEqual({ ok: true });

      const roster = lastLobbyRoster([...host.sent, ...guest.sent]);
      expect(roster?.type).toBe("lobbyRoster");
      if (roster?.type !== "lobbyRoster") throw new Error("unexpected");

      const byId = Object.fromEntries(
        roster.players.map((p) => [p.playerId, p.score]),
      );
      expect(byId[guesserId]).toBe(55);
      expect(byId[drawerId]).toBe(10);

      expect(
        rm.applyCorrectGuessAward({
          roomId: room.id,
          guesserPlayerId: guesserId,
          occurredAtMs: start + resolveRoundMs() / 2,
        }),
      ).toEqual({ ok: false, code: "ALREADY_AWARDED_THIS_DRAWING" });

      expect(
        rm.applyCorrectGuessAward({
          roomId: room.id,
          guesserPlayerId: drawerId,
          occurredAtMs: Date.now(),
        }),
      ).toEqual({ ok: false, code: "GUESSER_IS_DRAWER" });
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  it("drawing phase: non-drawer canvas clear yields NOT_DRAWER", () => {
    vi.stubEnv("ROUNDS_PER_MATCH", "1");
    vi.useFakeTimers();
    try {
      const rm = new RoomManager(8, integrationWordBank());
      const host = captureWs();
      const guest = captureWs();

      handleClientCommand(host.ws, { type: "createRoom", ...hostIdentity }, rm);
      const created = parseServerEvent(JSON.parse(host.sent[0]!));
      if (created.type !== "roomCreated") throw new Error("unexpected");

      handleClientCommand(
        guest.ws,
        { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
        rm,
      );

      handleClientCommand(host.ws, { type: "startMatch" }, rm);
      vi.advanceTimersByTime(resolveMatchStartHandshakeMs());
      vi.advanceTimersByTime(resolveWordChoiceMs());

      const room = rm.getRoomForSocket(host.ws);
      expect(room).toBeDefined();
      if (!room) throw new Error("unexpected");

      const drawerId = room.currentDrawerPlayerId!;
      const guesserCapt = drawerId === created.playerId ? guest : host;

      handleClientCommand(
        drawerId === created.playerId ? host.ws : guest.ws,
        { type: "chooseWord", choiceIndex: 0 },
        rm,
      );
      expect(room.phase).toBe("drawing");

      handleClientCommand(
        guesserCapt.ws,
        {
          type: "drawingCanvasClear",
          roomId: room.id,
        } satisfies ClientCommand,
        rm,
      );

      const last = parseServerEvent(JSON.parse(guesserCapt.sent.at(-1)!));
      expect(last.type).toBe("error");
      if (last.type === "error") expect(last.code).toBe("NOT_DRAWER");
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  it("lobby phase: drawer canvas clear yields WRONG_PHASE", () => {
    const rm = new RoomManager(8, integrationWordBank());
    const host = captureWs();
    const guest = captureWs();

    handleClientCommand(host.ws, { type: "createRoom", ...hostIdentity }, rm);
    const created = parseServerEvent(JSON.parse(host.sent[0]!));
    if (created.type !== "roomCreated") throw new Error("unexpected");

    handleClientCommand(
      guest.ws,
      { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
      rm,
    );

    const room = rm.getRoomForSocket(host.ws)!;
    handleClientCommand(
      host.ws,
      {
        type: "drawingCanvasClear",
        roomId: room.id,
      } satisfies ClientCommand,
      rm,
    );

    const err = host.sent.map((l) => parseServerEvent(JSON.parse(l))).find((e) => e.type === "error");
    expect(err?.type).toBe("error");
    if (err?.type === "error") expect(err.code).toBe("WRONG_PHASE");
  });

  it("drawing phase: drawer canvas clear with mismatched roomId yields BAD_ROOM", () => {
    vi.stubEnv("ROUNDS_PER_MATCH", "1");
    vi.useFakeTimers();
    try {
      const rm = new RoomManager(8, integrationWordBank());
      const host = captureWs();
      const guest = captureWs();

      handleClientCommand(host.ws, { type: "createRoom", ...hostIdentity }, rm);
      const created = parseServerEvent(JSON.parse(host.sent[0]!));
      if (created.type !== "roomCreated") throw new Error("unexpected");

      handleClientCommand(
        guest.ws,
        { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
        rm,
      );

      handleClientCommand(host.ws, { type: "startMatch" }, rm);
      vi.advanceTimersByTime(resolveMatchStartHandshakeMs());
      vi.advanceTimersByTime(resolveWordChoiceMs());

      const room = rm.getRoomForSocket(host.ws);
      expect(room).toBeDefined();
      if (!room) throw new Error("unexpected");

      const drawerId = room.currentDrawerPlayerId!;
      const drawerWs = drawerId === created.playerId ? host.ws : guest.ws;

      handleClientCommand(drawerWs, { type: "chooseWord", choiceIndex: 0 }, rm);
      expect(room.phase).toBe("drawing");

      handleClientCommand(
        drawerWs,
        {
          type: "drawingCanvasClear",
          roomId: "not-the-connected-room-id",
        } satisfies ClientCommand,
        rm,
      );

      const drawerSent = drawerId === created.playerId ? host.sent : guest.sent;
      const last = parseServerEvent(JSON.parse(drawerSent.at(-1)!));
      expect(last.type).toBe("error");
      if (last.type === "error") expect(last.code).toBe("BAD_ROOM");
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  it("drawingHintTick: hints fire on cadence until round end; none after teardown", () => {
    vi.stubEnv("ROUNDS_PER_MATCH", "1");
    vi.stubEnv("ROUND_MS", "120000");
    vi.stubEnv("HINT_CADENCE_MS", "2000");
    vi.useFakeTimers();
    try {
      const rm = new RoomManager(8, integrationWordBank());
      const host = captureWs();
      const guest = captureWs();

      handleClientCommand(host.ws, { type: "createRoom", ...hostIdentity }, rm);
      const created = parseServerEvent(JSON.parse(host.sent[0]!));
      if (created.type !== "roomCreated") throw new Error("unexpected");

      handleClientCommand(
        guest.ws,
        { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
        rm,
      );

      handleClientCommand(host.ws, { type: "startMatch" }, rm);
      vi.advanceTimersByTime(resolveMatchStartHandshakeMs());
      vi.advanceTimersByTime(resolveWordChoiceMs());

      const room = rm.getRoomForSocket(host.ws);
      expect(room).toBeDefined();
      if (!room) throw new Error("unexpected");

      const drawerId = room.currentDrawerPlayerId!;
      const drawerWs = drawerId === created.playerId ? host.ws : guest.ws;

      handleClientCommand(drawerWs, { type: "chooseWord", choiceIndex: 0 }, rm);
      expect(room.phase).toBe("drawing");
      const secret = room.roundSecretWord;
      expect(secret).toBeTruthy();

      function hostHints() {
        return host.sent
          .map((line) => parseServerEvent(JSON.parse(line)))
          .filter((e): e is Extract<typeof e, { type: "drawingHintTick" }> =>
            Boolean(e.type === "drawingHintTick"),
          );
      }

      vi.advanceTimersByTime(resolveHintCadenceMs());
      vi.advanceTimersByTime(resolveHintCadenceMs());

      let hints = hostHints();
      expect(hints.length).toBeGreaterThanOrEqual(2);
      expect(hints[1]!.hintIndex).toBeGreaterThan(hints[0]!.hintIndex);

      vi.advanceTimersByTime(resolveHintCadenceMs() * 50);
      hints = hostHints();
      expect(hints.length).toBeGreaterThan(0);

      const lastFully = hints[hints.length - 1]!;
      expect(lastFully.revealedLetterCount).toBe(lastFully.totalLetters);
      expect(lastFully.maskedWord).toBe(secret);

      const countAtFreeze = hints.length;

      vi.advanceTimersByTime(resolveRoundMs());

      hints = hostHints();
      expect(hints.length).toBe(countAtFreeze);

      vi.advanceTimersByTime(10 * 60_000);
      hints = hostHints();
      expect(hints.length).toBe(countAtFreeze);
      expect(room.phase).not.toBe("drawing");

      hints.forEach((h, i) => {
        expect(h.hintIndex).toBe(i);
      });
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  it("chatMessage exact match awards, reveals to drawer and guesser, ends round when lone guesser wins", () => {
    vi.stubEnv("ROUNDS_PER_MATCH", "1");
    vi.stubEnv("ROUND_MS", "80000");
    vi.useFakeTimers();
    try {
      const rm = new RoomManager(8, integrationWordBank());
      const host = captureWs();
      const guest = captureWs();

      handleClientCommand(host.ws, { type: "createRoom", ...hostIdentity }, rm);
      const created = parseServerEvent(JSON.parse(host.sent[0]!));
      if (created.type !== "roomCreated") throw new Error("unexpected");

      handleClientCommand(
        guest.ws,
        { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
        rm,
      );
      const guestJoined = parseServerEvent(JSON.parse(guest.sent[0]!));
      expect(guestJoined.type).toBe("roomJoined");
      const guestPlayerId =
        guestJoined.type === "roomJoined" ? guestJoined.playerId : "";

      handleClientCommand(host.ws, { type: "startMatch" }, rm);
      vi.advanceTimersByTime(resolveMatchStartHandshakeMs());

      const drawerPhaseEv = [...host.sent, ...guest.sent]
        .map((line) => parseServerEvent(JSON.parse(line)))
        .find(
          (e): e is Extract<typeof e, { type: "matchPhase" }> =>
            e.type === "matchPhase" && e.phase === "choosingWord",
        );
      const drawerId = drawerPhaseEv?.drawerPlayerId;
      expect(drawerId).toBeTruthy();

      const drawerCapt = drawerId === created.playerId ? host : guest;
      const guesserCapt = drawerId === created.playerId ? guest : host;
      const guesserId = drawerId === created.playerId ? guestPlayerId : created.playerId;

      const offers = drawerCapt.sent
        .map((line) => parseServerEvent(JSON.parse(line)))
        .filter((e) => e.type === "wordChoiceOffer");
      expect(offers.length).toBeGreaterThanOrEqual(1);
      const words = offers[0]?.type === "wordChoiceOffer" ? offers[0].words : null;
      expect(words).toBeTruthy();
      const choiceIndex = 1;
      const secret = words![choiceIndex]!;

      handleClientCommand(drawerCapt.ws, { type: "chooseWord", choiceIndex }, rm);

      const roomBefore = rm.getRoomForSocket(host.ws);
      expect(roomBefore?.phase).toBe("drawing");
      expect(roomBefore?.roundSecretWord).toBe(secret);

      handleClientCommand(
        guesserCapt.ws,
        { type: "chatMessage", roomId: roomBefore!.id, text: `  ${secret.toUpperCase()} ` },
        rm,
      );

      function lastCorrectGuess(sent: string[]) {
        const all = sent
          .map((line) => parseServerEvent(JSON.parse(line)))
          .filter((e) => e.type === "chatCorrectGuess");
        return all[all.length - 1];
      }

      const hCG = lastCorrectGuess(host.sent);
      const gCG = lastCorrectGuess(guest.sent);
      expect(hCG?.type).toBe("chatCorrectGuess");
      expect(gCG?.type).toBe("chatCorrectGuess");
      if (hCG?.type === "chatCorrectGuess" && gCG?.type === "chatCorrectGuess") {
        expect(hCG.revealedWord).toBe(secret);
        expect(gCG.revealedWord).toBe(secret);
      }

      const roster = lastLobbyRoster([...host.sent, ...guest.sent]);
      expect(roster?.type).toBe("lobbyRoster");
      if (roster?.type === "lobbyRoster") {
        const scores = Object.fromEntries(roster.players.map((p) => [p.playerId, p.score]));
        expect(scores[guesserId]).toBeGreaterThan(0);
        expect(scores[drawerId!]).toBeGreaterThan(0);
      }

      const roomAfter = rm.getRoomForSocket(host.ws);
      expect(roomAfter?.phase).toBe("roundResult");
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  it("chatCorrectGuess omits revealedWord for players still guessing (FR21)", () => {
    vi.stubEnv("ROUNDS_PER_MATCH", "2");
    vi.stubEnv("ROUND_MS", "80000");
    vi.useFakeTimers();
    try {
      const rm = new RoomManager(
        8,
        createStaticWordBank(["onlyone", "onlytwo", "onlythree"]),
      );
      const host = captureWs();
      const g1 = captureWs();
      const g2 = captureWs();

      handleClientCommand(host.ws, { type: "createRoom", ...hostIdentity }, rm);
      const created = parseServerEvent(JSON.parse(host.sent[0]!));
      if (created.type !== "roomCreated") throw new Error("unexpected");
      handleClientCommand(
        g1.ws,
        {
          type: "joinRoom",
          roomCode: created.roomCode,
          displayName: "Ga",
          avatarPresetId: "preset-2",
        },
        rm,
      );
      handleClientCommand(
        g2.ws,
        {
          type: "joinRoom",
          roomCode: created.roomCode,
          displayName: "Gb",
          avatarPresetId: "preset-3",
        },
        rm,
      );
      const g1Join = parseServerEvent(JSON.parse(g1.sent[0]!));
      const g2Join = parseServerEvent(JSON.parse(g2.sent[0]!));
      const g1Id = g1Join.type === "roomJoined" ? g1Join.playerId : "";
      expect(g2Join.type).toBe("roomJoined");
      const g2Id = g2Join.type === "roomJoined" ? g2Join.playerId : "";
      expect(g1Id && g2Id).toBeTruthy();

      handleClientCommand(host.ws, { type: "startMatch" }, rm);
      vi.advanceTimersByTime(resolveMatchStartHandshakeMs());

      const drawerEv = [...host.sent, ...g1.sent, ...g2.sent]
        .map((line) => parseServerEvent(JSON.parse(line)))
        .find(
          (e): e is Extract<typeof e, { type: "matchPhase" }> =>
            e.type === "matchPhase" && e.phase === "choosingWord",
        );
      const drawerId = drawerEv?.drawerPlayerId!;
      expect(drawerId).toBeTruthy();

      let drawerWs: WebSocket;
      let guesserWs: WebSocket;
      let spectatorWs: WebSocket;
      if (drawerId === created.playerId) {
        drawerWs = host.ws;
        guesserWs = g1.ws;
        spectatorWs = g2.ws;
      } else if (drawerId === g1Id) {
        drawerWs = g1.ws;
        guesserWs = host.ws;
        spectatorWs = g2.ws;
      } else {
        drawerWs = g2.ws;
        guesserWs = host.ws;
        spectatorWs = g1.ws;
      }

      const drawerSent =
        drawerWs === host.ws ? host.sent : drawerWs === g1.ws ? g1.sent : g2.sent;
      const offersLines = drawerSent
        .map((line) => parseServerEvent(JSON.parse(line)))
        .filter((e) => e.type === "wordChoiceOffer");
      const words = offersLines[0]?.type === "wordChoiceOffer" ? offersLines[0].words : null;
      expect(words).toBeTruthy();
      const secret = words![0]!;

      const roomRef = rm.getRoomForSocket(host.ws)!;
      handleClientCommand(drawerWs, { type: "chooseWord", choiceIndex: 0 }, rm);
      expect(roomRef.phase).toBe("drawing");

      handleClientCommand(
        guesserWs,
        { type: "chatMessage", roomId: roomRef.id, text: secret },
        rm,
      );

      function lastCg(sent: string[]) {
        const xs = sent
          .map((l) => parseServerEvent(JSON.parse(l)))
          .filter((e) => e.type === "chatCorrectGuess");
        return xs[xs.length - 1];
      }

      const specSent = spectatorWs === host.ws ? host.sent : spectatorWs === g1.ws ? g1.sent : g2.sent;
      const specEv = lastCg(specSent);
      expect(specEv?.type).toBe("chatCorrectGuess");
      if (specEv?.type === "chatCorrectGuess") {
        expect(specEv.revealedWord).toBeUndefined();
        expect(specEv.censoredAnnouncement.length).toBeGreaterThan(0);
      }
      expect(roomRef.phase).toBe("drawing");
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  it("lobby chat never emits chatCorrectGuess (no drawing-phase adjudication)", () => {
    const rm = new RoomManager(8, integrationWordBank());
    const host = captureWs();
    const guest = captureWs();

    handleClientCommand(host.ws, { type: "createRoom", ...hostIdentity }, rm);
    const created = parseServerEvent(JSON.parse(host.sent[0]!));
    if (created.type !== "roomCreated") throw new Error("unexpected");
    handleClientCommand(
      guest.ws,
      { type: "joinRoom", roomCode: created.roomCode, ...guestIdentity },
      rm,
    );

    const roomId = rm.getRoomForSocket(host.ws)?.id;
    expect(roomId).toBeTruthy();
    expect(rm.getRoomForSocket(host.ws)?.phase).toBe("lobby");

    handleClientCommand(
      host.ws,
      { type: "chatMessage", roomId: roomId!, text: "apple" },
      rm,
    );

    const anyCorrectGuess = [...host.sent, ...guest.sent].some((line) => {
      const ev = parseServerEvent(JSON.parse(line));
      return ev.type === "chatCorrectGuess";
    });
    expect(anyCorrectGuess).toBe(false);

    const guestChats = guest.sent
      .map((line) => parseServerEvent(JSON.parse(line)))
      .filter((e) => e.type === "chatPlayerMessage");
    const lastGuest = guestChats[guestChats.length - 1];
    expect(lastGuest?.type).toBe("chatPlayerMessage");
    if (lastGuest?.type === "chatPlayerMessage") expect(lastGuest.text).toBe("apple");
  });

  it("duplicate exact guess masks repeated message as ••• for spectators (already awarded)", () => {
    vi.stubEnv("ROUNDS_PER_MATCH", "2");
    vi.stubEnv("ROUND_MS", "80000");
    vi.useFakeTimers();
    try {
      const rm = new RoomManager(
        8,
        createStaticWordBank(["onlyone", "onlytwo", "onlythree"]),
      );
      const host = captureWs();
      const g1 = captureWs();
      const g2 = captureWs();

      handleClientCommand(host.ws, { type: "createRoom", ...hostIdentity }, rm);
      const created = parseServerEvent(JSON.parse(host.sent[0]!));
      if (created.type !== "roomCreated") throw new Error("unexpected");
      handleClientCommand(
        g1.ws,
        {
          type: "joinRoom",
          roomCode: created.roomCode,
          displayName: "Ga",
          avatarPresetId: "preset-2",
        },
        rm,
      );
      handleClientCommand(
        g2.ws,
        {
          type: "joinRoom",
          roomCode: created.roomCode,
          displayName: "Gb",
          avatarPresetId: "preset-3",
        },
        rm,
      );
      const g1Join = parseServerEvent(JSON.parse(g1.sent[0]!));
      const g2Join = parseServerEvent(JSON.parse(g2.sent[0]!));
      const g1Id = g1Join.type === "roomJoined" ? g1Join.playerId : "";
      const g2Id = g2Join.type === "roomJoined" ? g2Join.playerId : "";
      expect(g1Id && g2Id).toBeTruthy();

      handleClientCommand(host.ws, { type: "startMatch" }, rm);
      vi.advanceTimersByTime(resolveMatchStartHandshakeMs());

      const drawerEv = [...host.sent, ...g1.sent, ...g2.sent]
        .map((line) => parseServerEvent(JSON.parse(line)))
        .find(
          (e): e is Extract<typeof e, { type: "matchPhase" }> =>
            e.type === "matchPhase" && e.phase === "choosingWord",
        );
      const drawerId = drawerEv?.drawerPlayerId!;
      expect(drawerId).toBeTruthy();

      let drawerWs: WebSocket;
      let guesserWs: WebSocket;
      let spectatorWs: WebSocket;
      let spectatorSent: string[];
      if (drawerId === created.playerId) {
        drawerWs = host.ws;
        guesserWs = g1.ws;
        spectatorWs = g2.ws;
        spectatorSent = g2.sent;
      } else if (drawerId === g1Id) {
        drawerWs = g1.ws;
        guesserWs = host.ws;
        spectatorWs = g2.ws;
        spectatorSent = g2.sent;
      } else {
        drawerWs = g2.ws;
        guesserWs = host.ws;
        spectatorWs = g1.ws;
        spectatorSent = g1.sent;
      }

      const drawerSent =
        drawerWs === host.ws ? host.sent : drawerWs === g1.ws ? g1.sent : g2.sent;
      const offersLines = drawerSent
        .map((line) => parseServerEvent(JSON.parse(line)))
        .filter((e) => e.type === "wordChoiceOffer");
      const words = offersLines[0]?.type === "wordChoiceOffer" ? offersLines[0].words : null;
      expect(words).toBeTruthy();
      const secret = words![0]!;

      const roomRef = rm.getRoomForSocket(host.ws)!;
      handleClientCommand(drawerWs, { type: "chooseWord", choiceIndex: 0 }, rm);
      expect(roomRef.phase).toBe("drawing");

      const guesserPlayerId =
        guesserWs === host.ws
          ? created.playerId
          : guesserWs === g1.ws
            ? g1Id
            : g2Id;
      expect(guesserPlayerId).toBeTruthy();

      handleClientCommand(
        guesserWs,
        { type: "chatMessage", roomId: roomRef.id, text: secret },
        rm,
      );
      handleClientCommand(
        guesserWs,
        { type: "chatMessage", roomId: roomRef.id, text: secret },
        rm,
      );

      const spectatorPlayerMsgs = spectatorSent
        .map((line) => parseServerEvent(JSON.parse(line)))
        .filter((e): e is Extract<typeof e, { type: "chatPlayerMessage" }> => e.type === "chatPlayerMessage")
        .filter((e) => e.senderPlayerId === guesserPlayerId);

      const masked = spectatorPlayerMsgs.filter((e) => e.text === "•••");
      expect(masked.length).toBeGreaterThanOrEqual(1);
      expect(roomRef.phase).toBe("drawing");
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  it("drawer typing exact secret fans out — to spectators (never raw secret)", () => {
    vi.stubEnv("ROUNDS_PER_MATCH", "2");
    vi.stubEnv("ROUND_MS", "80000");
    vi.useFakeTimers();
    try {
      const rm = new RoomManager(
        8,
        createStaticWordBank(["onlyone", "onlytwo", "onlythree"]),
      );
      const host = captureWs();
      const g1 = captureWs();
      const g2 = captureWs();

      handleClientCommand(host.ws, { type: "createRoom", ...hostIdentity }, rm);
      const created = parseServerEvent(JSON.parse(host.sent[0]!));
      if (created.type !== "roomCreated") throw new Error("unexpected");
      handleClientCommand(
        g1.ws,
        {
          type: "joinRoom",
          roomCode: created.roomCode,
          displayName: "Ga",
          avatarPresetId: "preset-2",
        },
        rm,
      );
      handleClientCommand(
        g2.ws,
        {
          type: "joinRoom",
          roomCode: created.roomCode,
          displayName: "Gb",
          avatarPresetId: "preset-3",
        },
        rm,
      );
      const g1Join = parseServerEvent(JSON.parse(g1.sent[0]!));
      const g2Join = parseServerEvent(JSON.parse(g2.sent[0]!));
      const g1Id = g1Join.type === "roomJoined" ? g1Join.playerId : "";
      const g2Id = g2Join.type === "roomJoined" ? g2Join.playerId : "";
      expect(g1Id && g2Id).toBeTruthy();

      handleClientCommand(host.ws, { type: "startMatch" }, rm);
      vi.advanceTimersByTime(resolveMatchStartHandshakeMs());

      const drawerEv = [...host.sent, ...g1.sent, ...g2.sent]
        .map((line) => parseServerEvent(JSON.parse(line)))
        .find(
          (e): e is Extract<typeof e, { type: "matchPhase" }> =>
            e.type === "matchPhase" && e.phase === "choosingWord",
        );
      const drawerId = drawerEv?.drawerPlayerId!;
      expect(drawerId).toBeTruthy();

      let drawerWs: WebSocket;
      let spectatorWs: WebSocket;
      let spectatorSent: string[];
      let drawerSent: string[];
      if (drawerId === created.playerId) {
        drawerWs = host.ws;
        spectatorWs = g1.ws;
        spectatorSent = g1.sent;
        drawerSent = host.sent;
      } else if (drawerId === g1Id) {
        drawerWs = g1.ws;
        spectatorWs = host.ws;
        spectatorSent = host.sent;
        drawerSent = g1.sent;
      } else {
        drawerWs = g2.ws;
        spectatorWs = host.ws;
        spectatorSent = host.sent;
        drawerSent = g2.sent;
      }

      const offersLines = drawerSent
        .map((line) => parseServerEvent(JSON.parse(line)))
        .filter((e) => e.type === "wordChoiceOffer");
      const words = offersLines[0]?.type === "wordChoiceOffer" ? offersLines[0].words : null;
      expect(words).toBeTruthy();
      const secret = words![0]!;

      const roomRef = rm.getRoomForSocket(host.ws)!;
      handleClientCommand(drawerWs, { type: "chooseWord", choiceIndex: 0 }, rm);
      expect(roomRef.phase).toBe("drawing");

      handleClientCommand(
        drawerWs,
        { type: "chatMessage", roomId: roomRef.id, text: secret },
        rm,
      );

      const spectatorFromDrawer = spectatorSent
        .map((line) => parseServerEvent(JSON.parse(line)))
        .filter((e): e is Extract<typeof e, { type: "chatPlayerMessage" }> => e.type === "chatPlayerMessage")
        .filter((e) => e.senderPlayerId === drawerId);

      const lastSpec = spectatorFromDrawer[spectatorFromDrawer.length - 1];
      expect(lastSpec?.text).toBe("—");
      expect(lastSpec?.text).not.toBe(secret);

      const drawerSelf = drawerSent
        .map((line) => parseServerEvent(JSON.parse(line)))
        .filter((e): e is Extract<typeof e, { type: "chatPlayerMessage" }> => e.type === "chatPlayerMessage")
        .filter((e) => e.senderPlayerId === drawerId)
        .pop();
      expect(drawerSelf?.text).toBe(secret);

      const anyCorrectGuess = spectatorSent.some((line) => {
        const ev = parseServerEvent(JSON.parse(line));
        return ev.type === "chatCorrectGuess";
      });
      expect(anyCorrectGuess).toBe(false);
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });
});
