import pino from "pino";
import { createGameServer } from "./create-game-server.js";
import { resolvePort } from "./config/game.js";

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

const port = resolvePort();
const { server } = createGameServer();
server.listen(port, () => {
  log.info({ port }, "game server listening");
});
