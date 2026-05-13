import { describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import type { AvatarPresetId } from "@skribbl/shared";
import {
  RoomManager,
  normalizeRoomCode,
  isValidRoomCodeForJoin,
  ROOM_CODE_LENGTH,
} from "./room-manager.js";
import { createStaticWordBank } from "../words/word-bank.js";
import type { RedisClient } from "../lib/redis/client.js";

function testWordBank() {
  return createStaticWordBank(["alpha", "beta", "gamma", "delta"]);
}

function stubRedis(): RedisClient {
  const hashes = new Map<string, Record<string, string>>();
  const strings = new Map<string, string>();
  const client: RedisClient = {
    async hset(key, fields) {
      hashes.set(key, { ...hashes.get(key), ...fields });
    },
    async hgetall(key) {
      return hashes.get(key) ?? null;
    },
    async set(key, value) {
      strings.set(key, value);
    },
    async get(key) {
      return strings.get(key) ?? null;
    },
    async del(...keys) {
      for (const k of keys) {
        hashes.delete(k);
        strings.delete(k);
      }
    },
    async expire(_key, _seconds) {},
    async ping() {
      return "PONG";
    },
    pipeline() {
      const ops: Array<() => void> = [];
      const pipe = {
        hset(key: string, fields: Record<string, string>) {
          ops.push(() => { hashes.set(key, { ...hashes.get(key), ...fields }); });
          return pipe;
        },
        set(key: string, value: string) {
          ops.push(() => { strings.set(key, value); });
          return pipe;
        },
        expire(_key: string, _seconds: number) { return pipe; },
        del(...keys: string[]) {
          ops.push(() => { for (const k of keys) { hashes.delete(k); strings.delete(k); } });
          return pipe;
        },
        async exec() { for (const op of ops) op(); },
      };
      return pipe;
    },
  };
  return client;
}

function stubSocket(): WebSocket {
  return { send: () => {} } as unknown as WebSocket;
}

describe("normalizeRoomCode + validation", () => {
  it("uppercases and strips non-alphanumeric", () => {
    expect(normalizeRoomCode("  ab \t cd  ")).toBe("ABCD");
    expect(normalizeRoomCode("ab-12")).toBe("AB12");
  });

  it("isValidRoomCodeForJoin matches generated charset and length", () => {
    expect(isValidRoomCodeForJoin("A".repeat(ROOM_CODE_LENGTH))).toBe(true);
    expect(isValidRoomCodeForJoin("SHORT")).toBe(false);
    expect(isValidRoomCodeForJoin("O".repeat(ROOM_CODE_LENGTH))).toBe(false);
  });
});

describe("RoomManager", () => {
  const player = (name: string, preset: AvatarPresetId = "preset-1") => ({
    displayName: name,
    avatarPresetId: preset,
  });

  it("createRoom assigns unique codes", () => {
    const m = new RoomManager(8, testWordBank(), stubRedis());
    const a = stubSocket();
    const b = stubSocket();
    const r1 = m.createRoom(a, player("A"));
    const r2 = m.createRoom(b, player("B"));
    expect(r1.code).not.toBe(r2.code);
    expect(r1.code.length).toBe(ROOM_CODE_LENGTH);
  });

  it("joinRoom adds second socket and leaves prior room when switching", () => {
    const m = new RoomManager(8, testWordBank(), stubRedis());
    const ws1 = stubSocket();
    const ws2 = stubSocket();
    const roomA = m.createRoom(ws1, player("1"));
    const roomB = m.createRoom(ws2, player("2"));
    m.joinRoom(ws1, roomB.code, player("1b"));
    expect(m.getRoomForSocket(ws1)?.id).toBe(roomB.id);
    expect(roomA.sockets.size).toBe(0);
    expect(roomB.sockets.size).toBe(2);
  });

  it("returns UNKNOWN_ROOM for missing code", () => {
    const m = new RoomManager(8, testWordBank(), stubRedis());
    const ws = stubSocket();
    m.createRoom(stubSocket(), player("x"));
    expect(m.joinRoom(ws, "ZZZZZZ", player("y"))).toEqual({
      ok: false,
      reason: "UNKNOWN_ROOM",
    });
  });

  it("returns ROOM_FULL at capacity", () => {
    const m = new RoomManager(2, testWordBank(), stubRedis());
    const w1 = stubSocket();
    const w2 = stubSocket();
    const w3 = stubSocket();
    const room = m.createRoom(w1, player("h"));
    expect(m.joinRoom(w2, room.code, player("g")).ok).toBe(true);
    expect(m.joinRoom(w3, room.code, player("x", "preset-3"))).toEqual({
      ok: false,
      reason: "ROOM_FULL",
    });
  });

  it("reconnectHost restores canonical host when socket was dropped", () => {
    const m = new RoomManager(8, testWordBank(), stubRedis());
    const h = stubSocket();
    const g = stubSocket();
    const room = m.createRoom(h, player("Hosta"));
    const createdId = m.getLobbySession(h)!.playerId;
    expect(room.hostPlayerId).toBe(createdId);
    m.joinRoom(g, room.code, player("G"));

    m.leaveSocketRoom(h);

    const h2 = stubSocket();
    const out = m.reconnectHost(h2, room.id, createdId, player("Hosta"));
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unexpected");
    expect(out.room.hostSocket).toBe(h2);
    expect(m.getLobbySession(h2)?.playerId).toBe(createdId);
  });

  describe("applyLobbyChat (Story 8.3)", () => {
    it("broadcasts sanitized lobbyChatMessage to all peers including sender", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const sentHost: string[] = [];
      const sentGuest: string[] = [];
      const hostWs = { send: (msg: string) => sentHost.push(msg) } as unknown as WebSocket;
      const guestWs = { send: (msg: string) => sentGuest.push(msg) } as unknown as WebSocket;

      const room = m.createRoom(hostWs, player("Ho"));
      expect(m.getRoomForSocket(hostWs)).toBeDefined();
      expect(m.getLobbySession(hostWs)).toBeDefined();
      m.joinRoom(guestWs, room.code, player("Gu"));

      const out = m.applyLobbyChat(hostWs, room.code, "  hi  ");
      expect(out).toEqual({ ok: true });

      const hostEv = sentHost.map((s) => JSON.parse(s)).find((x) => x.type === "lobbyChatMessage");
      const guestEv = sentGuest.map((s) => JSON.parse(s)).find((x) => x.type === "lobbyChatMessage");
      expect(hostEv.message).toBe("hi");
      expect(guestEv.message).toBe("hi");
      expect(hostEv.playerId).toBe(m.getLobbySession(hostWs)?.playerId);
    });

    it("returns NOT_IN_ROOM when roomCode mismatches socket room", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const hostWs = stubSocket();
      const room = m.createRoom(hostWs, player("Ho"));
      const other = normalizeRoomCode("AAAAAA");
      expect(other.length === 6 && isValidRoomCodeForJoin(other)).toBe(true);
      expect(room.code.toUpperCase() === other).toBe(false);
      const out = m.applyLobbyChat(hostWs, other, "x");
      expect(out).toEqual({ ok: false, code: "NOT_IN_ROOM" });
    });

    it("returns NOT_IN_ROOM when socket has no room", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const loner = stubSocket();
      const out = m.applyLobbyChat(loner, "AAAAAA", "x");
      expect(out).toEqual({ ok: false, code: "NOT_IN_ROOM" });
    });

    it("returns MATCH_IN_PROGRESS when phase left lobby", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const hostWs = stubSocket();
      const room = m.createRoom(hostWs, player("Ho"));
      room.phase = "matchStarting";
      expect(m.applyLobbyChat(hostWs, room.code, "x")).toEqual({
        ok: false,
        code: "MATCH_IN_PROGRESS",
      });
    });

    it("returns MESSAGE_TOO_LONG after sanitize for oversized message", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const hostWs = stubSocket();
      const room = m.createRoom(hostWs, player("Ho"));
      const big = "x".repeat(400);
      const out = m.applyLobbyChat(hostWs, room.code, big);
      expect(out).toEqual({ ok: false, code: "MESSAGE_TOO_LONG" });
    });

    it("returns RATE_LIMITED on 6th message within 3s window (Story 8.3 AC3)", () => {
      vi.useFakeTimers();
      try {
        const m = new RoomManager(8, testWordBank(), stubRedis());
        const hostWs = stubSocket();
        const room = m.createRoom(hostWs, player("Ho"));
        expect(m.getRoomForSocket(hostWs)).toBeDefined();
        expect(m.getLobbySession(hostWs)).toBeDefined();
        for (let i = 0; i < 5; i++) {
          expect(m.applyLobbyChat(hostWs, room.code, `m${i}`)).toEqual({ ok: true });
        }
        expect(m.applyLobbyChat(hostWs, room.code, "six")).toEqual({
          ok: false,
          code: "RATE_LIMITED",
        });
        vi.advanceTimersByTime(3001);
        expect(m.applyLobbyChat(hostWs, room.code, "after-window")).toEqual({ ok: true });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("updateSettings (Story 8.2)", () => {
    it("returns NOT_HOST when non-host calls updateSettings", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const host = stubSocket();
      const guest = stubSocket();
      const room = m.createRoom(host, player("Host"));
      m.joinRoom(guest, room.code, player("Guest"));
      expect(m.updateSettings(guest, { rounds: 5 })).toEqual({
        ok: false,
        code: "NOT_HOST",
      });
    });

    it("returns MATCH_IN_PROGRESS when phase is not lobby", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const host = stubSocket();
      const guest = stubSocket();
      const room = m.createRoom(host, player("Host"));
      m.joinRoom(guest, room.code, player("Guest"));
      room.phase = "drawing";
      expect(m.updateSettings(host, { rounds: 5 })).toEqual({
        ok: false,
        code: "MATCH_IN_PROGRESS",
      });
    });

    it("returns VALIDATION_ERROR when maxPlayers below current count", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const host = stubSocket();
      const guest = stubSocket();
      const room = m.createRoom(host, player("Host"));
      m.joinRoom(guest, room.code, player("Guest"));
      expect(m.updateSettings(host, { maxPlayers: 1 })).toEqual({
        ok: false,
        code: "VALIDATION_ERROR",
        detail: "maxPlayers below current count",
      });
    });

    it("merges partial settings, preserving unchanged fields", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const host = stubSocket();
      const room = m.createRoom(host, player("Host"));
      const prevDrawTime = room.settings.drawTime;
      const result = m.updateSettings(host, { rounds: 10 });
      expect(result).toEqual({ ok: true });
      expect(room.settings.rounds).toBe(10);
      expect(room.settings.drawTime).toBe(prevDrawTime);
    });

    it("broadcasts settingsUpdated to all sockets", () => {
      const sent: string[] = [];
      const makeSocket = () => ({ send: (msg: string) => { sent.push(msg); } }) as unknown as WebSocket;
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const host = makeSocket();
      const guest = makeSocket();
      const room = m.createRoom(host, player("Host"));
      m.joinRoom(guest, room.code, player("Guest"));
      sent.length = 0;
      m.updateSettings(host, { allowVoice: true });
      expect(sent.length).toBe(2);
      const parsed = JSON.parse(sent[0]!);
      expect(parsed.type).toBe("settingsUpdated");
      expect(parsed.settings.allowVoice).toBe(true);
    });

    it("joinRoom includes settings in result room", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const host = stubSocket();
      const guest = stubSocket();
      const room = m.createRoom(host, player("Host"));
      m.updateSettings(host, { rounds: 3 });
      const outcome = m.joinRoom(guest, room.code, player("Guest"));
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) throw new Error("unexpected");
      expect(outcome.room.settings.rounds).toBe(3);
    });
  });

  describe("vote kick (Story 8.4)", () => {
    function makeCapturingWs(): { ws: WebSocket; sent: string[] } {
      const sent: string[] = [];
      const ws = { send(msg: string) { sent.push(msg); } } as unknown as WebSocket;
      return { ws, sent };
    }

    it("hosts a two-player lobby kicks target immediately when lone voter crosses 55%", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const { ws: hostWs, sent: sentHost } = makeCapturingWs();
      const { ws: targetWs, sent: sentTarget } = makeCapturingWs();

      const room = m.createRoom(hostWs, player("H"));
      m.joinRoom(targetWs, room.code, player("T"));
      const targetSess = m.getLobbySession(targetWs);
      if (!targetSess) throw new Error("expected target lobby session");
      const targetId = targetSess.playerId;

      expect(m.applyInitiateVoteKick(hostWs, room.code, targetId)).toEqual({ ok: true });

      const parsedTarget = sentTarget.map((line) => JSON.parse(line));
      const idxKick = parsedTarget.findIndex((e) => e.type === "voteKickResolved");
      const idxLeft = parsedTarget.findIndex((e) => e.type === "playerLeft");
      expect(idxKick).toBeGreaterThanOrEqual(0);
      expect(idxLeft).toBeGreaterThan(idxKick);
      expect(parsedTarget[idxKick]).toMatchObject({ type: "voteKickResolved", outcome: "kicked" });
      expect(parsedTarget[idxLeft]).toMatchObject({
        type: "playerLeft",
        playerId: targetId,
        reason: "kicked",
      });
      expect(m.getLobbySession(targetWs)).toBeUndefined();

      const hostKickEv = [...sentHost]
        .reverse()
        .find((line) => {
          try {
            const e = JSON.parse(line);
            return e.type === "voteKickResolved" && e.outcome === "kicked";
          } catch {
            return false;
          }
        });
      if (!hostKickEv) throw new Error("expected host voteKickResolved");
      expect(JSON.parse(hostKickEv).type).toBe("voteKickResolved");
      const hostSess = m.getLobbySession(hostWs);
      if (!hostSess) throw new Error("expected host lobby session");
      expect(room.hostPlayerId).toBe(hostSess.playerId);
    });

    it("returns VOTE_IN_PROGRESS when a vote is already pending", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const { ws: hostWs } = makeCapturingWs();
      const aWs = stubSocket();
      const bWs = stubSocket();
      const tWs = stubSocket();
      const room = m.createRoom(hostWs, player("H"));
      m.joinRoom(aWs, room.code, player("A"));
      m.joinRoom(bWs, room.code, player("B"));
      m.joinRoom(tWs, room.code, player("T"));
      const tid = m.getLobbySession(tWs)?.playerId;
      if (!tid) throw new Error("expected target lobby session");
      expect(m.applyInitiateVoteKick(hostWs, room.code, tid)).toEqual({ ok: true });

      expect(m.applyInitiateVoteKick(aWs, room.code, tid)).toEqual({
        ok: false,
        code: "VOTE_IN_PROGRESS",
      });
    });

    it("returns ALREADY_VOTED on duplicate castVoteKick", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const { ws: hostWs } = makeCapturingWs();
      const voterWs = stubSocket();
      const tWs = stubSocket();
      const room = m.createRoom(hostWs, player("H"));
      m.joinRoom(voterWs, room.code, player("V"));
      m.joinRoom(tWs, room.code, player("T"));
      const tid = m.getLobbySession(tWs)?.playerId;
      if (!tid) throw new Error("expected target lobby session");

      expect(m.applyInitiateVoteKick(voterWs, room.code, tid)).toEqual({ ok: true });
      expect(m.applyCastVoteKick(voterWs, room.code, tid, "yes")).toEqual({
        ok: false,
        code: "ALREADY_VOTED",
      });
    });

    it("expires pending vote via pollVoteKicks after window elapses", () => {
      vi.useFakeTimers();
      try {
        const started = Date.now();
        vi.setSystemTime(started);

        const m = new RoomManager(8, testWordBank(), stubRedis());
        const { ws: hostWs, sent } = makeCapturingWs();
        const voterWs = stubSocket();
        const tWs = stubSocket();

        const room = m.createRoom(hostWs, player("H"));
        m.joinRoom(voterWs, room.code, player("V"));
        m.joinRoom(tWs, room.code, player("T"));
        const tid = m.getLobbySession(tWs)?.playerId;
        if (!tid) throw new Error("expected target lobby session");

        expect(m.applyInitiateVoteKick(hostWs, room.code, tid)).toEqual({ ok: true });
        vi.advanceTimersByTime(30_001);
        m.pollVoteKicks();

        const lastResolved = [...sent].reverse().find((line) => {
          try {
            return JSON.parse(line).type === "voteKickResolved";
          } catch {
            return false;
          }
        });
        if (lastResolved === undefined) throw new Error("expected expired voteKickResolved");
        expect(JSON.parse(lastResolved).outcome).toBe("expired");
        expect(m.getRoomForSocket(hostWs)?.voteKick).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it("returns MATCH_IN_PROGRESS when phase leaves lobby", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const { ws: hostWs } = makeCapturingWs();
      const tWs = stubSocket();
      const room = m.createRoom(hostWs, player("H"));
      m.joinRoom(tWs, room.code, player("T"));
      room.phase = "matchStarting";

      const tSess = m.getLobbySession(tWs);
      if (!tSess) throw new Error("expected target lobby session");
      expect(m.applyInitiateVoteKick(hostWs, room.code, tSess.playerId)).toEqual({
        ok: false,
        code: "MATCH_IN_PROGRESS",
      });
    });

    it("returns NOT_IN_ROOM for sockets outside the room", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const { ws: hostWs } = makeCapturingWs();
      const lonerWs = stubSocket();
      const created = m.createRoom(hostWs, player("H"));

      expect(m.applyInitiateVoteKick(lonerWs, created.code, "any-id")).toEqual({
        ok: false,
        code: "NOT_IN_ROOM",
      });
    });

    it("resolves failed target_left when target disconnects mid-vote", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const { ws: hostWs, sent } = makeCapturingWs();
      const keeperWs = stubSocket();
      const tWs = stubSocket();

      const room = m.createRoom(hostWs, player("H"));
      m.joinRoom(keeperWs, room.code, player("K"));
      m.joinRoom(tWs, room.code, player("T"));
      const tid = m.getLobbySession(tWs)?.playerId;
      if (!tid) throw new Error("expected target lobby session");

      expect(m.applyInitiateVoteKick(hostWs, room.code, tid)).toEqual({ ok: true });
      m.leaveSocketRoom(tWs);

      const resolved = [...sent]
        .map((line) => JSON.parse(line))
        .filter((e) => e.type === "voteKickResolved")
        .at(-1);
      expect(resolved).toMatchObject({
        type: "voteKickResolved",
        outcome: "failed",
        reason: "target_left",
      });
    });

    it("resolves failed when voter leaves and yes can no longer reach 55%", () => {
      const m = new RoomManager(8, testWordBank(), stubRedis());
      const { ws: hostWs, sent } = makeCapturingWs();
      const aWs = stubSocket();
      const bWs = stubSocket();
      const tWs = stubSocket();

      const room = m.createRoom(hostWs, player("H"));
      m.joinRoom(aWs, room.code, player("A"));
      m.joinRoom(bWs, room.code, player("B"));
      m.joinRoom(tWs, room.code, player("T"));
      const tid = m.getLobbySession(tWs)?.playerId;
      if (!tid) throw new Error("expected target lobby session");

      expect(m.applyInitiateVoteKick(hostWs, room.code, tid)).toEqual({ ok: true });
      expect(m.applyCastVoteKick(aWs, room.code, tid, "no")).toEqual({ ok: true });

      m.leaveSocketRoom(bWs);

      const resolved = [...sent]
        .map((line) => JSON.parse(line))
        .filter((e) => e.type === "voteKickResolved")
        .at(-1);
      expect(resolved).toMatchObject({ type: "voteKickResolved", outcome: "failed" });
      expect(m.getRoomForSocket(hostWs)?.voteKick).toBeUndefined();
    });
  });
});
