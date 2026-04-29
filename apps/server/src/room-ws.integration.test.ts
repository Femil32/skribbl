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
});
