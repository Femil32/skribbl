import pino from "pino";
import { createGameServer } from "./create-game-server.js";
import { resolvePort } from "./config/game.js";

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

const port = resolvePort();
createGameServer()
  .then(({ server }) => {
    server.listen(port, () => {
      log.info({ port }, "game server listening");
    });
  })
  .catch((err: unknown) => {
    log.error({ err }, "Failed to start server — check Redis availability");
    process.exit(1);
  });
