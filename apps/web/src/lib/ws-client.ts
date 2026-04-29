import type { ClientCommand } from "@skribbl/shared";
import { clientCommandSchema } from "@skribbl/shared";

/**
 * Build a connectivity-check ping using only shared shapes (compile-time + runtime).
 * Wire sends JSON; validate outbound in dev/tests with the same schema as the server.
 */
export function createPingCommand(ts = Date.now()): ClientCommand {
  const cmd = { type: "ping" as const, ts };
  return clientCommandSchema.parse(cmd);
}

/**
 * Optional dev helper: open a WebSocket and send one ping when NEXT_PUBLIC debug WS URL is set.
 * Gated so production bundles do not require a live game server.
 */
export function maybeDemoPingWs(): void {
  if (process.env.NODE_ENV === "production") return;
  const url = process.env.NEXT_PUBLIC_WS_URL;
  if (!url || process.env.NEXT_PUBLIC_ENABLE_WS_DEMO !== "1") return;

  try {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify(createPingCommand()));
    });
  } catch {
    /* ignore — demo only */
  }
}
