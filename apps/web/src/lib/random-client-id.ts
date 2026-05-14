/**
 * Client-side unique ids for React keys and ephemeral chat rows.
 * `crypto.randomUUID()` is only guaranteed in secure contexts (HTTPS or localhost);
 * plain HTTP on a LAN IP omits it in Chromium-based browsers.
 */
export function randomClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}-${Math.random().toString(36).slice(2, 11)}`;
}
