/**
 * Gameplay constants and env reads — extend in later stories.
 * WORDS_PATH / data/words.json: Story 2.x.
 */
export const GAME_SERVER_DEFAULT_PORT = 3001;

export function resolvePort(): number {
  const raw = process.env.PORT;
  if (!raw) return GAME_SERVER_DEFAULT_PORT;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : GAME_SERVER_DEFAULT_PORT;
}
