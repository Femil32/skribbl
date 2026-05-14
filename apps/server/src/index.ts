import pino from "pino";
import { createGameServer } from "./create-game-server.js";
import { resolvePort } from "./config/game.js";

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

const port = resolvePort();
/** Listen on all interfaces so LAN clients can use ws://<host-ip>:port (override with HOST=127.0.0.1). */
const listenHost = process.env.HOST?.trim() || "0.0.0.0";

createGameServer()
  .then(({ server }) => {
    server.listen(port, listenHost, () => {
      log.info({ port, host: listenHost }, "game server listening");
    });
  })
  .catch((err: unknown) => {
    log.error({ err }, "Failed to start server — check Redis availability");
    process.exit(1);
  });
