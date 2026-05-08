import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { RedisClient } from "./lib/redis/client.js";

vi.mock("./lib/redis/client.js", () => ({
  getRedisClient: async (): Promise<RedisClient> => ({
    async hset() {},
    async hgetall() { return null; },
    async set() {},
    async get() { return null; },
    async del() {},
    async expire() {},
    async ping() { return "PONG"; },
    pipeline() {
      const pipe = {
        hset() { return pipe; },
        set() { return pipe; },
        expire() { return pipe; },
        del() { return pipe; },
        async exec() {},
      };
      return pipe;
    },
  }),
}));

import { createGameServer } from "./create-game-server.js";

const REPO_WORDS_JSON = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../data/words.json",
);

describe("GET /healthz", () => {
  it("returns 200 application/json with { ok: true }", async () => {
    const previousWordsPath = process.env.WORDS_PATH;
    process.env.WORDS_PATH = REPO_WORDS_JSON;
    const { server } = await createGameServer();
    const port = await new Promise<number>((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          reject(new Error("expected TCP port"));
          return;
        }
        resolve(addr.port);
      });
      server.on("error", reject);
    });
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");
      await expect(res.json()).resolves.toEqual({ ok: true });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      if (previousWordsPath === undefined) delete process.env.WORDS_PATH;
      else process.env.WORDS_PATH = previousWordsPath;
    }
  });
});
