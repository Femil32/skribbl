import { describe, expect, it } from "vitest";
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
});
