import http from "node:http";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import pino from "pino";
import {
  safeParseClientCommand,
  serializeServerEvent,
  type ClientCommand,
} from "@skribbl/shared";

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

function handleClientCommand(ws: WebSocket, cmd: ClientCommand) {
  switch (cmd.type) {
    case "ping":
      ws.send(
        serializeServerEvent({
          type: "pong",
          ts: Date.now(),
        }),
      );
      return;
    case "noop":
      return;
    default: {
      const _exhaustive: never = cmd;
      return _exhaustive;
    }
  }
}

function sendError(ws: WebSocket, code: string, message?: string) {
  ws.send(
    serializeServerEvent({
      type: "error",
      code,
      message,
    }),
  );
}

export function createGameServer() {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url?.split("?")[0] === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false }));
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      let body: unknown;
      try {
        body = JSON.parse(String(raw));
      } catch {
        sendError(ws, "BAD_PAYLOAD", "Invalid JSON");
        return;
      }
      const parsed = safeParseClientCommand(body);
      if (!parsed.success) {
        sendError(ws, "BAD_PAYLOAD", "Message validation failed");
        return;
      }
      try {
        handleClientCommand(ws, parsed.data);
      } catch (err) {
        log.error({ err }, "handler error");
        sendError(ws, "INTERNAL", "Unexpected handler error");
      }
    });
  });

  return { server, wss };
}
