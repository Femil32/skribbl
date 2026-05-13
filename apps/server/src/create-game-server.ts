import http from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import pino from "pino";
import {
  lobbyChatCommandSchema,
  safeParseClientCommand,
  wireCodeFromLobbyChatZodError,
} from "@skribbl/shared";
import {
  MAX_WS_MESSAGE_BYTES,
  inboundWsMessageByteLength,
} from "./config/game.js";
import { RoomManager } from "./room/room-manager.js";
import { createWordBankFromEnv } from "./words/word-bank.js";
import { getRedisClient } from "./lib/redis/client.js";
import type { RedisClient } from "./lib/redis/client.js";
import { playerKey, PLAYER_TTL_S } from "./lib/redis/room-keys.js";
import {
  handleClientCommand,
  sendProtocolError,
} from "./protocol/handlers/handle-client-command.js";
import type { IncomingMessage } from "node:http";

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

export async function handleSessionRequest(
  redis: RedisClient,
  body: unknown,
): Promise<{ token: string; playerId: string }> {
  const token =
    body !== null &&
    typeof body === "object" &&
    "token" in body &&
    typeof (body as Record<string, unknown>)["token"] === "string" &&
    (body as Record<string, unknown>)["token"] !== ""
      ? ((body as Record<string, unknown>)["token"] as string)
      : null;

  if (token) {
    const existing = await redis.hgetall(playerKey(token));
    if (existing && existing["playerId"]) {
      return { token, playerId: existing["playerId"] };
    }
  }

  const newToken = randomBytes(16).toString("base64url").slice(0, 21);
  const playerId = randomUUID();
  await redis
    .pipeline()
    .hset(playerKey(newToken), { playerId, displayName: "", avatarPresetId: "", updatedAt: new Date().toISOString() })
    .expire(playerKey(newToken), PLAYER_TTL_S)
    .exec();
  return { token: newToken, playerId };
}

export async function createGameServer() {
  const redis = await getRedisClient();
  const roomManager = new RoomManager(undefined, createWordBankFromEnv(), redis);

  const voteKickPollMs = 30_000;
  setInterval(() => {
    try {
      roomManager.pollLobbyReconnectGrace();
      roomManager.pollVoteKicks();
    } catch (err) {
      log.error({ err }, "lobby poll error");
    }
  }, voteKickPollMs).unref();

  const server = http.createServer(async (req, res) => {
    const path = req.url?.split("?")[0];

    if (req.method === "OPTIONS" && path === "/api/session") {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    if (req.method === "POST" && path === "/api/session") {
      try {
        const body = await readJsonBody(req);
        const result = await handleSessionRequest(redis, body);
        res.writeHead(200, { "Content-Type": "application/json", ...CORS_HEADERS });
        res.end(JSON.stringify(result));
      } catch (err) {
        log.error({ err }, "session endpoint error");
        res.writeHead(500, { "Content-Type": "application/json", ...CORS_HEADERS });
        res.end(JSON.stringify({ error: "internal" }));
      }
      return;
    }

    if (req.method === "GET" && path === "/healthz") {
      log.debug({ probe: true, path: "/healthz" }, "healthz");
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

    let commandChain: Promise<void> = Promise.resolve();

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
        const isLobbyChat =
          typeof body === "object" &&
          body !== null &&
          (body as { type?: unknown }).type === "lobbyChat";
        if (isLobbyChat) {
          const lobbyTry = lobbyChatCommandSchema.safeParse(body);
          if (!lobbyTry.success) {
            const wire = wireCodeFromLobbyChatZodError(lobbyTry.error);
            if (wire === "MESSAGE_TOO_LONG") {
              sendProtocolError(ws, "MESSAGE_TOO_LONG", "Message is too long.", roomManager);
              return;
            }
            if (wire === "CHAT_EMPTY") {
              sendProtocolError(ws, "CHAT_EMPTY", "Enter something to send.", roomManager);
              return;
            }
          }
        }
        sendProtocolError(ws, "BAD_PAYLOAD", "Message validation failed", roomManager);
        return;
      }
      commandChain = commandChain.then(async () => {
        try {
          await handleClientCommand(ws, parsed.data, roomManager);
        } catch (err) {
          log.error({ err }, "handler error");
          sendProtocolError(ws, "INTERNAL", "Unexpected handler error", roomManager);
        }
      });
    });
  });

  return { server, wss };
}
