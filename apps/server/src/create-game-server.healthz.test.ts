import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createGameServer } from "./create-game-server.js";

const REPO_WORDS_JSON = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../data/words.json",
);

function listen(
  server: ReturnType<typeof createGameServer>["server"],
): Promise<number> {
  return new Promise((resolve, reject) => {
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
}

describe("GET /healthz", () => {
  it("returns 200 application/json with { ok: true }", async () => {
    const previousWordsPath = process.env.WORDS_PATH;
    process.env.WORDS_PATH = REPO_WORDS_JSON;
    const { server } = createGameServer();
    const port = await listen(server);
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
