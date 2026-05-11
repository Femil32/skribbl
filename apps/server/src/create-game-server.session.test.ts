import { describe, expect, it } from "vitest";
import { handleSessionRequest } from "./create-game-server.js";
import type { RedisClient } from "./lib/redis/client.js";
import { playerKey } from "./lib/redis/room-keys.js";

function stubRedis(): RedisClient & { hashes: Map<string, Record<string, string>> } {
  const hashes = new Map<string, Record<string, string>>();
  const strings = new Map<string, string>();
  const client: RedisClient & { hashes: Map<string, Record<string, string>> } = {
    hashes,
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
    async expire() {},
    async ping() {
      return "PONG";
    },
    pipeline() {
      const ops: Array<() => void> = [];
      const pipe = {
        hset(key: string, fields: Record<string, string>) {
          ops.push(() => {
            hashes.set(key, { ...hashes.get(key), ...fields });
          });
          return pipe;
        },
        set(key: string, value: string) {
          ops.push(() => {
            strings.set(key, value);
          });
          return pipe;
        },
        expire(_key: string, _seconds: number) {
          return pipe;
        },
        del(...keys: string[]) {
          ops.push(() => {
            for (const k of keys) {
              hashes.delete(k);
              strings.delete(k);
            }
          });
          return pipe;
        },
        async exec() {
          for (const op of ops) op();
        },
      };
      return pipe;
    },
  };
  return client;
}

describe("handleSessionRequest", () => {
  it("creates new session when no token provided", async () => {
    const redis = stubRedis();
    const result = await handleSessionRequest(redis, {});
    expect(typeof result.token).toBe("string");
    expect(result.token.length).toBe(21);
    expect(typeof result.playerId).toBe("string");
    expect(result.playerId.length).toBeGreaterThan(0);
  });

  it("creates new session when body is null", async () => {
    const redis = stubRedis();
    const result = await handleSessionRequest(redis, null);
    expect(result.token).toBeDefined();
    expect(result.playerId).toBeDefined();
  });

  it("reuses existing session when valid token provided", async () => {
    const redis = stubRedis();
    const first = await handleSessionRequest(redis, {});
    const second = await handleSessionRequest(redis, { token: first.token });
    expect(second.token).toBe(first.token);
    expect(second.playerId).toBe(first.playerId);
  });

  it("creates new session when token not found in Redis", async () => {
    const redis = stubRedis();
    const result = await handleSessionRequest(redis, { token: "nonexistent-token-xyz" });
    expect(result.token).not.toBe("nonexistent-token-xyz");
  });

  it("rejects empty string token and creates new", async () => {
    const redis = stubRedis();
    const result = await handleSessionRequest(redis, { token: "" });
    expect(result.token).not.toBe("");
    expect(result.token.length).toBe(21);
  });

  it("stores player hash in Redis for new session", async () => {
    const redis = stubRedis();
    const result = await handleSessionRequest(redis, {});
    const stored = redis.hashes.get(playerKey(result.token));
    expect(stored).toBeDefined();
    expect(stored?.["playerId"]).toBe(result.playerId);
  });
});
