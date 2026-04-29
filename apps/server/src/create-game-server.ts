import http from "node:http";
import { WebSocketServer } from "ws";
import pino from "pino";
import { safeParseClientCommand } from "@skribbl/shared";
import {
  MAX_WS_MESSAGE_BYTES,
  inboundWsMessageByteLength,
} from "./config/game.js";
import { RoomManager } from "./room/room-manager.js";
import {
  handleClientCommand,
  sendProtocolError,
} from "./protocol/handlers/handle-client-command.js";

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

export function createGameServer() {
  const roomManager = new RoomManager();

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url?.split("?")[0] === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false }));
  });

  const wss = new WebSocketServer({
    server,
    maxPayload: MAX_WS_MESSAGE_BYTES,
  });

  wss.on("connection", (ws) => {
    ws.on("close", () => {
      roomManager.leaveSocketRoom(ws);
    });

    ws.on("message", (raw) => {
      if (inboundWsMessageByteLength(raw) > MAX_WS_MESSAGE_BYTES) {
        sendProtocolError(
          ws,
          "BAD_PAYLOAD",
          "Message too large",
          roomManager,
        );
        return;
      }

      let body: unknown;
      try {
        body = JSON.parse(
          Buffer.isBuffer(raw)
            ? raw.toString("utf8")
            : raw instanceof ArrayBuffer
              ? Buffer.from(raw).toString("utf8")
              : Buffer.concat(raw).toString("utf8"),
        );
      } catch {
        sendProtocolError(ws, "BAD_PAYLOAD", "Invalid JSON", roomManager);
        return;
      }
      const parsed = safeParseClientCommand(body);
      if (!parsed.success) {
        sendProtocolError(ws, "BAD_PAYLOAD", "Message validation failed", roomManager);
        return;
      }
      try {
        handleClientCommand(ws, parsed.data, roomManager);
      } catch (err) {
        log.error({ err }, "handler error");
        sendProtocolError(ws, "INTERNAL", "Unexpected handler error", roomManager);
      }
    });
  });

  return { server, wss };
}
