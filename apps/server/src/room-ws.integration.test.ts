import { describe, expect, it } from "vitest";
import type { WebSocket } from "ws";
import {
  type ClientCommand,
  NICKNAME_MAX_GRAPHEMES,
  parseServerEvent,
} from "@skribbl/shared";
import { RoomManager } from "./room/room-manager.js";
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

const hostIdentity = { displayName: "Hosty", avatarPresetId: "preset-1" as const };
const guestIdentity = { displayName: "Guesty", avatarPresetId: "preset-2" as const };

describe("handleClientCommand + RoomManager", () => {
  it("createRoom then joinRoom succeeds for second socket", () => {
    const rm = new RoomManager(8);
    const a = captureWs();
    const b = captureWs();

    handleClientCommand(a.ws, { type: "createRoom", ...hostIdentity }, rm);
    expect(a.sent).toHaveLength(1);
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
    expect(b.sent).toHaveLength(1);
    const joined = parseServerEvent(JSON.parse(b.sent[0]!));
    expect(joined.type).toBe("roomJoined");
    if (joined.type === "roomJoined") expect(joined.playerCount).toBe(2);
    if (joined.type === "roomJoined") expect(joined.displayName).toBe("Guesty");
  });

  it("unknown room yields UNKNOWN_ROOM", () => {
    const rm = new RoomManager(8);
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
    const rm = new RoomManager(8);
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
    const rm = new RoomManager(8);
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
    const rm = new RoomManager(2);
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
    const rm = new RoomManager(8);
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
      } as ClientCommand,
      rm,
    );
    expect(b.sent).toHaveLength(1);
    const ev = parseServerEvent(JSON.parse(b.sent[0]!));
    expect(ev.type).toBe("error");
    if (ev.type === "error") expect(ev.code).toBe("INVALID_AVATAR");
  });

  it("NICKNAME_TOO_LONG on createRoom", () => {
    const rm = new RoomManager(8);
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
});
