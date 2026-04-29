import { describe, expect, it } from "vitest";
import type { WebSocket } from "ws";
import type { AvatarPresetId } from "@skribbl/shared";
import {
  RoomManager,
  normalizeRoomCode,
  isValidRoomCodeForJoin,
  ROOM_CODE_LENGTH,
} from "./room-manager.js";

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
    const m = new RoomManager(8);
    const a = stubSocket();
    const b = stubSocket();
    const r1 = m.createRoom(a, player("A"));
    const r2 = m.createRoom(b, player("B"));
    expect(r1.code).not.toBe(r2.code);
    expect(r1.code.length).toBe(ROOM_CODE_LENGTH);
  });

  it("joinRoom adds second socket and leaves prior room when switching", () => {
    const m = new RoomManager(8);
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
    const m = new RoomManager(8);
    const ws = stubSocket();
    m.createRoom(stubSocket(), player("x"));
    expect(m.joinRoom(ws, "ZZZZZZ", player("y"))).toEqual({
      ok: false,
      reason: "UNKNOWN_ROOM",
    });
  });

  it("returns ROOM_FULL at capacity", () => {
    const m = new RoomManager(2);
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
});
