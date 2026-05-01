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

function testWordBank() {
  return createStaticWordBank(["alpha", "beta", "gamma", "delta"]);
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
    const m = new RoomManager(8, testWordBank());
    const a = stubSocket();
    const b = stubSocket();
    const r1 = m.createRoom(a, player("A"));
    const r2 = m.createRoom(b, player("B"));
    expect(r1.code).not.toBe(r2.code);
    expect(r1.code.length).toBe(ROOM_CODE_LENGTH);
  });

  it("joinRoom adds second socket and leaves prior room when switching", () => {
    const m = new RoomManager(8, testWordBank());
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
    const m = new RoomManager(8, testWordBank());
    const ws = stubSocket();
    m.createRoom(stubSocket(), player("x"));
    expect(m.joinRoom(ws, "ZZZZZZ", player("y"))).toEqual({
      ok: false,
      reason: "UNKNOWN_ROOM",
    });
  });

  it("returns ROOM_FULL at capacity", () => {
    const m = new RoomManager(2, testWordBank());
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

  /** Story 5.1 — replaces legacy reconnectHost lobby reclaim (token-required). */
  it("resumeSession restores canonical host when socket was dropped (lobby)", () => {
    const m = new RoomManager(8, testWordBank());
    const h = stubSocket();
    const g = stubSocket();
    const room = m.createRoom(h, player("Hosta"));
    const createdId = m.getLobbySession(h)!.playerId;
    const tok = room.reconnectSecretsByPlayerId.get(createdId);
    expect(tok).toBeTruthy();
    expect(room.hostPlayerId).toBe(createdId);
    m.joinRoom(g, room.code, player("G"));

    m.leaveSocketRoom(h);

    const h2 = stubSocket();
    const out = m.resumeSession(h2, room.id, createdId, tok!, player("Hosta"));
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error("unexpected");
    expect(out.room.hostSocket).toBe(h2);
    expect(m.getLobbySession(h2)?.playerId).toBe(createdId);
  });

  it("resumeSession_rejects_duplicate_tab_already_connected", () => {
    const m = new RoomManager(8, testWordBank());
    const h1 = stubSocket();
    const h2 = stubSocket();
    const room = m.createRoom(h1, player("Hosta"));
    const pid = m.getLobbySession(h1)!.playerId;
    const tok = room.reconnectSecretsByPlayerId.get(pid)!;

    const out = m.resumeSession(h2, room.id, pid, tok, player("Hosta"));
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("unexpected");
    expect(out.reason).toBe("ALREADY_CONNECTED");
  });

  it("resumeSession rejects bad token before reattach", () => {
    const m = new RoomManager(8, testWordBank());
    const h = stubSocket();
    const g = stubSocket();
    const room = m.createRoom(h, player("Hosta"));
    const pid = m.getLobbySession(h)!.playerId;
    expect(m.joinRoom(g, room.code, player("KeepsSeat")).ok).toBe(true);
    m.leaveSocketRoom(h);

    const h2 = stubSocket();
    const out = m.resumeSession(
      h2,
      room.id,
      pid,
      "bogus-token-not-equal-to-server-secret-xx",
      player("Hosta"),
    );
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("unexpected");
    expect(out.reason).toBe("INVALID_SESSION");
  });

  /** Mid-match reconnect skeleton — canvas replay is Story 5.2. */
  it("guest resumeSession attaches during drawing phase after transient disconnect", () => {
    const m = new RoomManager(8, testWordBank());
    const host = stubSocket();
    const guestWs = stubSocket();
    const room = m.createRoom(host, player("Host"));
    const hostId = m.getLobbySession(host)!.playerId;

    expect(m.joinRoom(guestWs, room.code, player("Guest")).ok).toBe(true);
    const guestId = m.getLobbySession(guestWs)!.playerId;
    const guestTok = room.reconnectSecretsByPlayerId.get(guestId)!;

    /** Force non-lobby phase without timers: host still on socket — enter drawing manually-ish via package-private not available; mutate phase minimally for seat policy. */
    room.phase = "drawing";
    room.matchPlayerOrder = [hostId, guestId];
    room.currentDrawerPlayerId = hostId;
    room.offlineIdentityByPlayerId.set(guestId, {
      displayName: "Guest",
      avatarPresetId: "preset-1",
    });

    m.leaveSocketRoom(guestWs);

    const g2 = stubSocket();
    const res = m.resumeSession(g2, room.id, guestId, guestTok, player("Ignored"));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("unexpected");
    expect(res.resumeKind).toBe("guest");
    expect(m.getLobbySession(g2)?.playerId).toBe(guestId);
    expect(m.getLobbySession(g2)?.displayName).toBe("Guest");
    expect(room.sockets.has(g2)).toBe(true);
  });
});
