import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomInt } from "node:crypto";

export type WordBank = {
  /** Three distinct non-empty words for one round. */
  sampleThree(): [string, string, string];
};

const MIN_WORDS = 3;

function normalizeWords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (t.length > 0) out.push(t);
  }
  return out;
}

function sampleThreeIndices(length: number): [number, number, number] {
  const picked = new Set<number>();
  while (picked.size < 3) {
    picked.add(randomInt(0, length));
  }
  const [a, b, c] = [...picked];
  return [a!, b!, c!];
}

function createBankFromList(words: string[]): WordBank {
  if (words.length < MIN_WORDS) {
    throw new Error(`WORD_BANK_TOO_SMALL:${words.length}`);
  }
  return {
    sampleThree(): [string, string, string] {
      const [a, b, c] = sampleThreeIndices(words.length);
      return [words[a]!, words[b]!, words[c]!];
    },
  };
}

export function loadWordBankFromResolvedPath(absolutePath: string): WordBank {
  const raw = JSON.parse(readFileSync(absolutePath, "utf8")) as unknown;
  return createBankFromList(normalizeWords(raw));
}

/**
 * `WORDS_PATH` — absolute or cwd-relative JSON array of strings.
 * Default: `<cwd>/data/words.json` (run game server from monorepo root).
 */
export function createWordBankFromEnv(cwd = process.cwd()): WordBank {
  const fromEnv = process.env.WORDS_PATH?.trim();
  const resolved = resolve(fromEnv && fromEnv.length > 0 ? fromEnv : resolve(cwd, "data", "words.json"));
  return loadWordBankFromResolvedPath(resolved);
}

/** Vitest helper — fixed word list. */
export function createStaticWordBank(words: string[]): WordBank {
  return createBankFromList(normalizeWords(words));
}
